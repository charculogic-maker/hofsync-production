# Technische Dokumentation – Backend, Sicherheit & Deployment

Diese Doku richtet sich an Entwickler/Tech-Partner und beschreibt das Datenmodell, das Rollen-/Rechtemodell (Firestore- & Storage-Rules), die Cloud Functions (inkl. Gemini-Fleischpreislauf) und den Deployment-Prozess.

Projektüberblick & Modulstruktur: [../README.md](../README.md) · Doku-Übersicht: [README.md](./README.md) · Endnutzer: [StevesHof](./KOLLEGEN_ANLEITUNG_HOFLADEN_APP.md) · [TorFabrik](./KOLLEGEN_ANLEITUNG_TORFABRIK.md) · Modulanleitungen: [modulanleitungen/README.md](./modulanleitungen/README.md)

Firebase-Projekte (siehe `.firebaserc` und `web/firebase-config.js`):

| Alias | Projekt-ID | Hosting (Beispiel) |
|-------|------------|-------------------|
| `default` | `hofsync-production` | StevesHof-Produktion |
| `whitelabel` | `charculogic-whitelabel-test` | `charculogic-whitelabel-test.web.app` |

Die Web-App wählt `apiKey` / `projectId` automatisch nach Hostname; lokal: `?firebase=whitelabel` erzwingt das Testprojekt.

---

## 1. Mandanten-Architektur (White-Label)

Alle Betriebsdaten liegen unter einem Mandantenpfad:

```text
tenants/{tenantId}/…
```

Bekannte Mandanten:

| `tenantId` | Betrieb | Branding (`web/branding.js`) |
|------------|---------|------------------------------|
| `StevesHof_Hauptbetrieb` | StevesHof Hofladen | CharcuLogic, alle Module |
| `torfabrik` | TorFabrik Krefeld | CenterLogic, ohne Wurstküche (`wurstkueche: false`) |

Die `tenantId` wird beim Login ermittelt (`web/auth.js`):

1. Custom Claims (`tenantId`, `tenant_id`, `tenant`, `tenantID`)
2. Firestore-Profil `users/{uid}` oder `userTenants/{uid}` (Felder `tenantId` **oder** `tenantID`, `role`)
3. Lokaler Cache `charculogic_cached_tenant_id`

**Kein Client-Seeding mehr:** Team-Konfiguration, Terminal-PINs, MHD-Bestand, Rezepte und HACCP-Defaults werden **nicht** beim Login aus dem Browser geschrieben. Einmalige Initialisierung nur über Admin SDK:

```bash
node tools/seed-tenant-bootstrap.mjs --tenant=torfabrik --project=charculogic-whitelabel-test --all
node tools/seed-tenant-bootstrap.mjs --tenant=StevesHof_Hauptbetrieb --credentials
```

**Terminal-PINs:** Gehashte Zugangsdaten liegen in `tenants/{tenantId}/terminalCredentials/current` (Client: kein Lesezugriff). Prüfung über Callable `verifyTerminalPin` (Region `europe-west3`).

**Dev-Overrides:** `?firebase=whitelabel` und `?tenant=` funktionieren nur auf `localhost` / `127.0.0.1` (`web/dev-guards.js`).

---

## 2. Firestore-Datenmodell

Genutzte Collections (alle unter `tenants/{tenantId}/`, sofern nicht anders angegeben):

| Collection | Inhalt | Schreibrechte (Kurz) |
|------------|--------|----------------------|
| `mhd_liste/{itemId}` | MHD-Posten (Verkauf & Kühlung) | Mandanten-Nutzer (schema-validiert) |
| `wareneingang_lieferungen/{id}` | Lieferungen (Kopf, Posten, Fotos) | Mandanten-Nutzer (schema-validiert) |
| `rezepte/{id}` | Rezepturen (Betriebswissen) | nur Admin |
| `produktion_chargen/{id}` | Produktions-/Chargen-Doku | create: Nutzer; update/delete: Admin |
| `haccp_geraete/{id}` | HACCP-Geräte/Messpunkte | nur Admin |
| `haccp_logs/{id}` | HACCP-Protokolle | create: Nutzer; **update/delete: gesperrt** (unveränderlich) |
| `haccp_stale_archive/{id}` | Cold-Storage abgewiesener Protokolle | create: Nutzer; update/delete: Admin |
| `tasks/{taskId}` | Aufgaben & Team-Infos | create: Nutzer; update: Admin **oder** reines Abhaken; delete: Admin |
| `customerOrders/{orderId}` | Kundenbestellungen | create: Nutzer; update: Admin **oder** Status-Übergang; delete: Admin |
| `bulletinBoard/current` | Nachricht des Tages | nur Admin |
| `settings/{document}` | Team-Konfiguration (Gruppen, Mitarbeiter) | nur Admin |
| `pushTokens/{tokenId}` | FCM-Tokens je Gerät/Mitarbeiter | Mandanten-Nutzer |
| `fleischpreise/{kw}` | KI-Wochennotierung Fleischpreise | **nur Cloud Function** (Client: `write: false`) |
| `inventory/{id}` | KI-Lieferschein-Posten (TorFabrik) | Mandanten-Nutzer (schema-validiert) |
| `users/{uid}` *(global)* | Benutzerprofil (Rolle, Mandant) | read: eigener User |
| `userTenants/{uid}` *(global)* | alternatives Profil/Mandanten-Mapping | nur serverseitig |
| `system_errors/{id}` *(global)* | Append-only Fehler-Telemetrie | create: angemeldet; read/update/delete: gesperrt |

Die maßgeblichen Schemata (erlaubte Felder, Pflichtfelder, Validierungen) stehen in `firebase.rules`.

---

## 3. Security Rules & Rollenmodell

### 3.1 ⚠️ Welche Rules-Datei wird wirklich deployt?

`firebase.json` legt fest, welche Datei für Firestore ausgerollt wird:

```json
"firestore": { "rules": "firebase.rules" }
```

**Es wird also `firebase.rules` deployt – NICHT `firestore.rules`.**

- ✅ **`firebase.rules`** = aktive, vollständige, schema-validierte Produktions-Rules.
- ⚠️ **`firestore.rules`** = veralteter, vereinfachter **Spiegel**, der **nicht** ausgerollt wird. Änderungen daran haben **keine** Wirkung in Produktion.

> **Empfehlung:** `firestore.rules` entweder löschen oder klar als „nicht deployt" kennzeichnen, um Verwechslungen zu vermeiden. Alle echten Regeländerungen müssen in `firebase.rules` erfolgen und mit `firebase deploy --only firestore:rules` ausgerollt werden.

### 3.2 Authentifizierung & Mandantenzugehörigkeit (`firebase.rules`)

**Nur Custom Claims** – kein Firestore-Profil-Fallback in Rules oder Storage:

- `request.auth.token.tenantId == tenantId` (Pfad-Mandant)
- `request.auth.token.role` ∈ `admin` | `employee` | `helper`
- `request.auth.token.isAdmin == true` für Admin-Checks

Claims setzen (invalidiert keine Refresh Tokens):

```bash
node tools/set-user-claims.mjs --all --project=hofsync-production
node tools/set-user-claims.mjs --uid=<UID> --project=charculogic-whitelabel-test
```

Nach dem Lauf refresht das Frontend Claims automatisch via `getIdToken(true)` in `web/auth.js`.

### 3.3 Admin-Erkennung (`firebase.rules`)

`isAdmin(tenantId)` akzeptiert Custom Claims **oder** Firestore-Profil (Übergangsphase). **`isHelper(tenantId)`** und **`isEmployeeOrAdmin(tenantId)`** steuern Schreibzugriffe: Aushilfe-Konten (`role: helper`) dürfen lesen, aber nicht in operative Collections schreiben.

### 3.4 Storage-Rules (`storage.rules`)

Storage nutzt **`firestore.get()`** auf `users/{uid}` bzw. `userTenants/{uid}` für Mandantenzugehörigkeit und Rolle – analog zu Firestore. Bulletin-Uploads: Admin; Lieferschein-Fotos: Mitarbeiter (keine Aushilfe).

**Empfehlung:** Custom Claims (`tenantId`, `role`, optional `isAdmin`) per Admin SDK setzen und Token-Refresh erzwingen.

### 3.5 Empfehlung: Custom Claims setzen

Sobald gewünscht, Claims serverseitig (Admin SDK / Cloud Function / Skript) setzen:

```js
await admin.auth().setCustomUserClaims(uid, {
  tenantId: 'StevesHof_Hauptbetrieb',
  role: 'admin',   // deckt firebase.rules ab
  isAdmin: true,   // deckt storage.rules ab
});
```

Nach dem Setzen muss der Client das ID-Token erneuern (Re-Login oder `getIdToken(true)`).

---

## 4. Cloud Functions (`functions/`)

Laufzeit: **Node 20**, `firebase-functions` v2, `firebase-admin`. Exporte in `functions/index.js`.

### 4.1 Fleischpreis-Automation (`fetchWeeklyMeatPrices` + `triggerManualMeatPriceRun`)

Implementierung: `functions/meatPrices.js` (gemeinsame Pipeline `executeMeatPriceRun`).

#### Geplanter Lauf – `fetchWeeklyMeatPrices`

- **Typ:** Gen2 `onSchedule` (`firebase-functions/v2/scheduler`).
- **Cron:** `0 8 * * 3` → **Mittwochs 08:00 Uhr**, Zeitzone **`Europe/Berlin`** (DST-sicher).
- **Timeout:** 120 s, `retryCount: 2`.
- **Secret:** `GEMINI_API_KEY` (Cloud Secret Manager, `secrets: ['GEMINI_API_KEY']`).
- **`initiatedBy`:** `"system"`.

#### Manueller Admin-Trigger – `triggerManualMeatPriceRun`

- **Typ:** Gen2 `onCall`, Region `europe-west3`, `enforceAppCheck: true`, Timeout 120 s.
- **Auth:** `request.auth.token.role === 'admin'`, sonst `HttpsError('permission-denied')`.
- **`initiatedBy`:** `request.auth.uid` (Audit-Trail).
- Nutzt dieselbe Pipeline wie der Scheduler (Parsing, Validierung, Schreiben).

#### Lifecycle-Logging – `/priceRuns/{runId}`

Jeder Lauf (automatisch oder manuell) schreibt in die Root-Collection **`priceRuns`**:

| Phase | Felder |
|-------|--------|
| Start | `startedAt`, `status: "running"`, `initiatedBy`, `modelVersion`, `targetPath`, … |
| Erfolg | `finishedAt`, `status: "success"`, `sourceUrls`, `rawEvidence`, `parsedValues`, `firestorePath` |
| Fehler | `finishedAt`, `status: "failed"`, `error` (Stack/Message) |

Firestore-Rules: **`priceRuns` — Client read/write: false** (nur Admin SDK / Cloud Functions).

#### Ablauf & Anti-Corruption

1. Prompt für aktuelle KW (VEZG/AMI/MEG) bauen.
2. Gemini (`GEMINI_MODEL`, Default `gemini-2.0-flash`) mit **Google-Search-Grounding** aufrufen.
3. JSON-Array parsen und **validieren** (mind. `MIN_PRICE_ENTRIES = 3`, `category`/`cut` Pflicht, Preise `> 0` und `≤ 500` EUR).
4. **Nur bei erfolgreicher Validierung:** Schreiben nach `tenants/{TENANT_ID}/fleischpreise/{jahr_kwXX}`.
5. **Failsafe:** Bei API-, Parse- oder Validierungsfehler → `priceRuns.status = "failed"`, Log `[FLEISCHPREIS_RUN_FAILED]`, **`fleischpreise/` bleibt unverändert**.

> Durch Search-Grounding kann ein Lauf **bis ~60 s** dauern. Das Frontend (`web/app.js → subscribeFleischpreise`) liest die Preise passiv via `onSnapshot`.

#### Frontend – WRS Admin-Button

- **Markup:** `web/index.html` → `#kitchen-wrs-panel` / `#wrs-meat-price-update-btn` (neben `#wrs-status-pill`).
- **Logik:** `web/app.js` → `bindWrsMeatPriceUpdateButton()`, Callable `triggerManualMeatPriceRun` (Region `europe-west3`, App Check Pflicht via `waitForAppCheckReady()`).
- **Sichtbarkeit:** Nur bei Custom Claims `role === 'admin'` → `#wrs-meat-price-update-btn` mit `style.display = 'inline-block'` (`refreshWrsMeatPriceAdminButton()` nach Login und in `applyRoleBasedUi`).
- **UX:** Native `confirm()` vor dem Lauf; Button deaktiviert, Label „Lädt Preise…“ (~60–120 s); Erfolg → Toast „Marktpreise erfolgreich aktualisiert!“ + `subscribeFleischpreise()`; Fehler → roter Toast mit Details. Monitoring-Alerts: **§4.6**.

### 4.2 `notifyTeamEntryCreated` – Push bei neuer Team-Aufgabe

- **Typ:** Firestore-Trigger (`onDocumentCreated`) auf `tenants/{tenantId}/tasks/{taskId}`, Region `europe-west3`.
- **Ablauf** (`functions/teamPush.js`):
  1. Nur bei `status == 'open'` aktiv.
  2. Zielgruppe aus `settings/teamDashboard` (Mitarbeiter/Gruppen) auflösen, Autor ausschließen.
  3. FCM-Tokens aus `tenants/{tenantId}/pushTokens` ziehen.
  4. Push via `messaging().sendEachForMulticast` versenden.

### 4.3 `parseDeliveryNote` – KI-Lieferschein (TorFabrik)

- **Typ:** Callable HTTPS (`onCall`), Region `europe-west3`, Secret `GEMINI_API_KEY`, Modell `gemini-2.5-flash`.
- **App Check:** `enforceAppCheck: true` – Anfragen ohne gültiges App-Check-Token werden abgewiesen, bevor Gemini aufgerufen wird.
- **Client:** `web/delivery-note.js` → Tab **Neu** → „Lieferschein scannen (KI)“.
- **Auth:** Mandant `torfabrik`, Rolle **keine Aushilfe**; Tenant/Rolle nur aus Custom Claims (`functions/authContext.js`).
- **Limits:** max. Base64-Länge, MIME-Whitelist, serverseitige Schema-Validierung; Antwort als Vorschau (`previewOnly: true`).

### 4.4 `verifyTerminalPin` – Terminal-PIN-Prüfung

- **Typ:** Callable HTTPS, Region `europe-west3`.
- **App Check:** `enforceAppCheck: true`.
- **Speicher:** `tenants/{tenantId}/terminalCredentials/current` (nur Admin SDK / Functions).
- **Modi:** `employee` (Name + PIN), `resolve` (PIN → Name), `meister` (Meister-Freigabe).
- **Schutz:** PBKDF2-Hash, Lockout nach 5 Fehlversuchen (15 min).

### 4.5 Firebase App Check (Web + Callables)

**Backend:** Gen2-Callables `parseDeliveryNote`, `verifyTerminalPin` und `triggerManualMeatPriceRun` setzen `enforceAppCheck: true`.

**Frontend:** `web/app-check.js` initialisiert App Check direkt nach `initFirebase()` in `bootstrapAuthenticatedApp()` (vor Auth und Callables).

1. **Firebase Console** → App Check → Web-App registrieren → **reCAPTCHA v3** Site Key erzeugen.
2. Site Key in `web/firebase-config.js` unter `appCheckRecaptchaSiteKey` (pro Projekt `production` / `whitelabel`) eintragen.
3. **Lokal / CI (Debug Provider):**
   - App auf `http://localhost` oder `127.0.0.1` starten.
   - Beim ersten Start erscheint in der **Browser-Konsole** ein Debug-Token, z. B.:
     `App Check debug token: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"`
   - Token kopieren → Firebase Console → App Check → **Manage debug tokens** → hinzufügen.
   - Optional persistieren: `?appCheckDebugToken=<UUID>` oder `localStorage.setItem('charculogic_appcheck_debug_token', '<UUID>')`.
   - **GitHub Actions:** Secret `FIREBASE_APPCHECK_DEBUG_TOKEN` anlegen und vor dem E2E-Lauf setzen:
     `localStorage.setItem('charculogic_appcheck_debug_token', process.env.FIREBASE_APPCHECK_DEBUG_TOKEN)`.

**Deploy-Reihenfolge:** App-Check-Provider in Console aktivieren → Site Keys pflegen → Hosting deployen → Functions deployen → Debug-Tokens für Entwickler/CI registrieren.

### 4.6 GCP Cloud Monitoring & Alerting Setup

Automatisierte Benachrichtigung, wenn der Fleischpreis-Engine-Lauf fehlschlägt (Gemini, Validierung, Firestore). Einrichtung im Firebase-/GCP-Projekt (z. B. `hofsync-production`).

**Voraussetzung:** Notification Channel in **Monitoring → Alerting → Edit notification channels** (E-Mail, SMS, PagerDuty) anlegen.

#### Log Filter Query (Cloud Logging)

In **Logging → Logs Explorer** oder als Basis für log-basierte Metriken:

```
resource.type="cloud_function"
resource.labels.function_name="fetchWeeklyMeatPrices"
textPayload=~"\[FLEISCHPREIS_RUN_FAILED\]"
```

> **Hinweis Gen2:** Läuft die Function auf Cloud Run, ggf. ergänzen: `resource.type="cloud_run_revision"` und `resource.labels.service_name="fetchweeklymeatprices"`. Der Filter oben deckt klassische Cloud-Function-Log-Ressourcen ab.

#### Alerting Policy (gcloud)

Programmatische Anlage der Alert Policy (Projekt setzen: `gcloud config set project <PROJECT_ID>`):

```bash
gcloud alpha monitoring policies create \
  --display-name="Alert: Fleischpreislauf fehlgeschlagen" \
  --condition-filter='resource.type="cloud_function" AND resource.labels.function_name="fetchWeeklyMeatPrices" AND textpayload=~"\[FLEISCHPREIS_RUN_FAILED\]"' \
  --duration="0s" \
  --combiner="OR" \
  --trigger-count=1
```

Nach Erstellung in der Console **Notification Channels** an die Policy binden.

#### Runbook

1. Cloud Logging → obigen Filter → `runId` / Stacktrace aus dem Log.
2. Firestore (Admin SDK / Console): `/priceRuns/{runId}` → Feld `error` lesen.
3. Ursache: `GEMINI_API_KEY`, Grounding, Validierung; ggf. manuell über WRS-Button **Preise aktualisieren** (Admin, App Check aktiv).
4. **Nicht** manuell in `fleischpreise/` schreiben — bei Fehler bleibt die letzte gültige KW erhalten (Failsafe).

**Erweiterungen (optional):**

- Log-Metric `fleischpreis_run_failed` mit `--log-filter='textPayload=~"\[FLEISCHPREIS_RUN_FAILED\]"'` und Threshold-Alert auf `rate(...) > 0`.
- Absence-Alert Mittwochs 08:00–09:00 `Europe/Berlin`: kein Log `Firestore geschrieben` von `fetchWeeklyMeatPrices`.
- Filter `[GEMINI_DETAILED_ERROR]` als Frühwarnung.

### 4.7 Lokales Testen

```bash
cd functions
npm install
npm run serve        # firebase emulators:start --only functions
```

---

## 5. Deployment

Voraussetzung: Firebase CLI installiert (`firebase login`). Projekt wählen:

```bash
firebase use default      # hofsync-production
firebase use whitelabel   # charculogic-whitelabel-test
```

```bash
# Frontend-PWA (Hosting-Root = web/)
firebase deploy --only hosting

# Cloud Functions (functions/)
firebase deploy --only functions

# Firestore + Storage Rules (immer gemeinsam testen!)
firebase deploy --only firestore:rules,storage

# Alles zusammen
firebase deploy
```

### Hinweise

- **Secret für Functions** vor dem ersten Lauf setzen:
  ```bash
  firebase functions:secrets:set GEMINI_API_KEY
  ```
- **Firestore-Rules:** Immer `firebase.rules` bearbeiten (nicht `firestore.rules`).
- **Hosting-Root** ist `web/` (siehe `firebase.json`); es gibt **keinen Build-Step**.
- **Indizes:** Aktuell ist keine `firestore.indexes.json` hinterlegt. Falls Firestore bei neuen zusammengesetzten Abfragen einen Index verlangt, den vorgeschlagenen Index anlegen und versionieren.

### Security Rules Tests (Emulator)

Voraussetzungen: **Node 20**, **JDK 21+**, Firebase CLI.

```bash
npm install
npm run test:rules
```

Dev-Dependencies: `@firebase/rules-unit-testing@^5`, `mocha`, `chai`. Suite: `test/security-rules.test.mjs`.

---

## 6. Offene technische Punkte (Stand: Mai 2026)

1. **Custom Claims produktiv setzen** und Token-Refresh erzwingen (Firestore-Profil-Fallback perspektivisch entfernen).
2. **App Check** für Callables ist implementiert (`enforceAppCheck: true`); reCAPTCHA v3 Site Keys in `firebase-config.js` pflegen.
3. **Rules-Emulator-Tests in CI** – Suite vorhanden (`npm run test:rules`); JDK 21+ in CI-Runner erforderlich.
4. **Fleischpreislauf:** WRS-Admin-Button implementiert; GCP-Alert-Policy gemäß §4.6 in Produktion anlegen.
5. **MHD-Datenladen ohne `limit()`:** Pagination bei wachsenden Beständen.
