# Technische Dokumentation – Backend, Sicherheit & Deployment

Diese Doku richtet sich an Entwickler/Tech-Partner und beschreibt das Datenmodell, das Rollen-/Rechtemodell (Firestore- & Storage-Rules), App Check, die Cloud Functions (inkl. Gemini-Fleischpreislauf), Build/Deploy-Pipeline und Security-Tests.

> **Stand:** Juli 2026 — inkl. LMIV-Herkunftsmodul (`traceabilityRecords`, Digitale Thekenklade) und P0-Security-/Multi-Tenancy-Refactor.

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
| `StevesHof_Hauptbetrieb` | StevesHof Hofladen | CharcuLogic, Hofladen-Profil: MHD + Neu + Herkunft + Prod. |
| `superbiomarkt` | SuperBioMarkt – Bedientheke | CharcuLogic, Schlankes Profil: nur Herkunft (LMIV + Öko-Kontrollstelle) |
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

**StevesHof-Hofladen-Terminal:** Für `bestellung@steveshof-hofladen.de` mit Claim `tenantId: StevesHof_Hauptbetrieb` und Rolle `employee` greift in `web/app.js` der feste Terminalmodus (`dataset.fixedTerminal = steveshof`): Alltags-Logout ausgeblendet, nach dem App-Start `showTab('mhd')`. Statt PIN nutzt StevesHof **`employeeAuth: profile`** (`web/branding.js`): nach dem Geräte-Zugang wählen Kollegen ein Profil aus `team-config.js` (MHD + Wareneingang + Herkunft). Firestore-Pfade behalten die kanonische Schreibweise `StevesHof_Hauptbetrieb`; localStorage-Keys werden lowercase-normalisiert (`web/tenant-db.js`).

**Datensicherung:** Firestore **PITR** ist in der Default-Datenbank aktiv. Quellcode liegt in GitHub; Geräte-Offline-Queues sind nicht zentral gesichert.

**Cloud Scheduler `fetchWeeklyMeatPrices`:** Läuft mittwochs 08:00 (`Europe/Berlin`) nur sinnvoll in **`hofsync-production`** (Mandant `StevesHof_Hauptbetrieb`, Secret `GEMINI_API_KEY`). Im Testprojekt **`charculogic-whitelabel-test`** wird der Lauf bewusst übersprungen (keine WRS/Fleischpreis-Pipeline für TorFabrik).

**Dev-Overrides:** `?firebase=whitelabel` und `?tenant=` funktionieren nur auf `localhost` / `127.0.0.1` (`web/dev-guards.js`). In Produktion ist Mandantenzuordnung **ausschließlich token-claim-gesteuert** — URL-Parameter oder Payload-Manipulation reichen nicht aus, um fremde `tenants/{tenantId}/…`-Pfade zu erreichen.

### 1.1 Mandantenisolation über Custom Claims (Security Wall)

Firestore- und Callable-Zugriffe prüfen in `firebase.rules` und Cloud Functions **nur** `request.auth.token.tenantId` gegen den Pfad-Mandanten:

- **Kein Profil-Fallback in Firestore-Rules** für Schreibzugriffe auf Mandantendaten.
- Jedes Dokument mit `tenantId`-Feld muss exakt dem Token-Mandanten entsprechen.
- Cross-Tenant-Zugriff (Lesen/Schreiben auf fremde Pfade) wird serverseitig abgewiesen — unabhängig davon, welche IDs der Client in URLs oder JSON-Payloads mitschickt.

Claims setzen (invalidiert keine Refresh Tokens):

```bash
node tools/set-user-claims.mjs --all --project=hofsync-production
node tools/set-user-claims.mjs --uid=<UID> --project=charculogic-whitelabel-test
```

Nach dem Lauf refresht das Frontend Claims automatisch via `getIdToken(true)` in `web/auth.js`.

### 1.2 Shared Terminals & localStorage-Namensraum

Auf gemeinsam genutzten iPhones oder Terminals wechseln Betriebs-Logins und Mitarbeiter-Anmeldungen häufig. Globale `localStorage`-Keys würden Auswahl und PIN-Kontext zwischen Mandanten vermischen.

**Lösung:** `web/teamboard-storage.js` — alle Teamboard-Terminal-Keys werden dynamisch mit `{tenantId}_` prefixiert:

| Basis-Key | Inhalt |
|-----------|--------|
| `charculogic_active_employee` | Aktiver Mitarbeiter (Name + PIN-Kontext) |
| `charculogic_active_area` | Gewählter Bereich / Schicht |
| `charculogic_active_shift` | Legacy-Alias (Migration) |

Beispiel: `torfabrik_charculogic_active_employee`.

- **Lesen/Schreiben:** `web/teamboard.js` nutzt `scopedTeamboardStorageKey()`.
- **Logout:** `web/auth.js` → `clearSessionCaches()` ruft `clearTeamboardTenantStorage(tenantId)` auf und leert mandantenspezifische Keys beim Betriebs-Abmelden.
- **StevesHof-Ausnahme:** Der neutrale Hofladen-Zugang setzt den aktiven Bearbeiter automatisch auf `StevesHof-Team`; ein persönlicher PIN-Wechsel ist dort derzeit nicht Teil des Ablaufs.

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
| `pushTokens/{tokenId}` | FCM-Tokens je Gerät/Mitarbeiter | create/update: Mandanten-Nutzer; **read: gesperrt** |
| `fleischpreise/{kw}` | KI-Wochennotierung Fleischpreise | **nur Cloud Function** (Client: `write: false`) |
| `inventory/{id}` | KI-Lieferschein-Posten (TorFabrik) | Mandanten-Nutzer (schema-validiert) |
| `traceabilityRecords/{id}` | LMIV-Herkunft / Thekenklade | create/read: Mandanten-Nutzer; update (Status)/delete: Admin |
| `users/{uid}` *(global)* | Benutzerprofil (Rolle, Mandant) | read: eigener User |
| `userTenants/{uid}` *(global)* | alternatives Profil/Mandanten-Mapping | nur serverseitig |
| `system_errors/{id}` *(global)* | Append-only Client-Telemetrie | **create:** schema-validiert; **read/update/delete:** gesperrt |
| `priceRuns/{runId}` *(global)* | Fleischpreis-Lauf-Lifecycle | nur Admin SDK / Cloud Functions |

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

**Nur Custom Claims** — kein Firestore-Profil-Fallback in Firestore-Rules:

- `request.auth.token.tenantId == tenantId` (Pfad-Mandant)
- `request.auth.token.role` ∈ `admin` | `employee` | `helper`
- `request.auth.token.isAdmin == true` für Admin-Checks

Payload-Tampering (falsche `tenantId` im Dokument) wird abgewiesen, sobald das Feld vom Schema geprüft wird. Cross-Tenant-Pfadzugriff ist ohne passenden Token-Mandanten unmöglich.

Claims setzen — siehe **§1.1**.

### 3.3 Admin-Erkennung (`firebase.rules`)

`isAdmin(tenantId)` akzeptiert Custom Claims **oder** Firestore-Profil (Übergangsphase). **`isHelper(tenantId)`** und **`isEmployeeOrAdmin(tenantId)`** steuern Schreibzugriffe: Aushilfe-Konten (`role: helper`) dürfen lesen, aber nicht in operative Collections schreiben.

### 3.4 Storage-Rules (`storage.rules`)

Storage nutzt **Custom Claims** (`tenantId`, `role`) — ohne Firestore-Lookup. Bulletin-Uploads: Admin; Lieferschein-Fotos (`order_slips/`): Mitarbeiter; LMIV-Etikettfotos (`traceability/`): Mandanten-Mitglieder.

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

### 3.6 `system_errors` — Write-Only-Telemetrie-Schema

Clients dürfen Fehler **nur blind anlegen** (append-only). Lesen, Aktualisieren und Löschen ist für alle Clients gesperrt — Auswertung erfolgt über Backend/Admin SDK.

**Erlaubtes Create-Payload** (`web/sync.js` → `buildSystemErrorDocument()`):

```json
{
  "tenantId": "<muss request.auth.token.tenantId entsprechen>",
  "errorCode": "ERR_SYNC_PERMISSION_DENIED",
  "message": "Kurzbeschreibung für Ops (< 1000 Zeichen)",
  "timestamp": "<serverTimestamp>",
  "userId": "<optional, UID>",
  "context": "<optional, z. B. sync:tasks · op:update>"
}
```

**Rules-Validierung** (`firebase.rules`, `match /system_errors/{document}`):

| Regel | Zweck |
|-------|--------|
| `tenantId == request.auth.token.tenantId` | Kein Cross-Tenant-Spam |
| Pflichtfelder: `tenantId`, `errorCode`, `message`, `timestamp` | Strikt definiertes Schema |
| `keys().hasOnly(…)` | Keine injizierten Fremdfelder |
| `message.size() < 1000` | Schutz vor Payload-Flutung |
| `timestamp == request.time` | Nur Server-Zeitstempel (kein Client-Faking) |
| `allow read, update, delete: if false` | Kein Client-Lesezugriff |

Roh-Fehlerdetails bleiben in `console.error`; Operatoren sehen über `web/operator-errors.js` bereinigte deutsche Toast-Texte.

### 3.7 `pushTokens` — Read-Lockout

`match /tenants/{tenantId}/pushTokens/{tokenId}`: **`allow read: if false`** — Clients können FCM-Tokens anderer Geräte/Mitarbeiter nicht enumerieren. Schreiben/Löschen bleibt für authentifizierte Mandanten-Nutzer schema-validiert.

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
- **Mandant:** Scheduler nutzt `MEAT_PRICE_TENANT_ID` (Function-Env) oder Fallback aus der Deployment-Konfiguration — **kein** hardcodierter Cross-Tenant-Schreibzugriff mehr.

#### Manueller Admin-Trigger – `triggerManualMeatPriceRun`

- **Typ:** Gen2 `onCall`, Region `europe-west3`, `enforceAppCheck: true`, Timeout 120 s.
- **Auth:** `request.auth.token.role === 'admin'`, sonst `HttpsError('permission-denied')`.
- **Mandant:** `tenantId` ausschließlich aus `request.auth.token.tenantId`; fehlt der Claim → `unauthenticated`. Kein Client-Override möglich.
- **Pipeline:** `executeMeatPriceRun({ tenantId, … })` schreibt strikt nach `tenants/{tenantId}/fleischpreise/`.
- **`initiatedBy`:** `request.auth.uid` (Audit-Trail).

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

#### Frontend – Wareneingang-Hilfen (Tab **Neu**)

`web/app.js` → `applyRoleBasedUi()` setzt `hidden` auf Büro-only-Controls:

| Element | Sichtbarkeit |
|---------|----------------|
| `#btn-recent-receipts` (**Letzte Eingänge**) | Alle Nutzer mit Tab **Neu** (kein `isOfficeUser`) |
| `#btn-master-data`, `#btn-delivery-note-ai`, `#office-tools-panel` | Nur `isOfficeUser()` |
| `#btn-office-recent-receipts` | Büro-Panel (zusätzlich, gleiche Funktion `showRecentReceipts()` in `web/mhd.js`) |

Die Rolle `helper` blendet den gesamten Tab **Neu** aus — damit auch **Letzte Eingänge**.

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

### 4.3a `parseMeatLabel` – KI-Fleisch-Etikett (LMIV / Bio)

- **Typ:** Callable HTTPS (`onCall`), Region `europe-west3`, Secret `GEMINI_API_KEY`, Modell `gemini-2.5-flash` (Override `GEMINI_MEAT_LABEL_MODEL`).
- **App Check:** `enforceAppCheck: true`.
- **Client:** `web/traceability.js` → Tab **Herkunft** – nach Foto automatische Felder-Vorbelegung.
- **Auth:** `resolveAuthContext` + `requireEmployeeAccess` (eigener Mandant, keine Aushilfe).
- **Payload:** `imageBase64` / `imageBytes` (+ `mimeType`) oder mandantentreuer `storagePath` unter `tenants/{tenantId}/…`.
- **Antwort:** strukturiertes Label (LOT, Identitätskennzeichen, Öko-Kontrollstelle/Verband, Tierart, Herkunft); Failsafe → manuelle Eingabe in der PWA.

### 4.4 `verifyTerminalPin` – Terminal-PIN-Prüfung

- **Typ:** Callable HTTPS, Region `europe-west3`.
- **App Check:** `enforceAppCheck: true`.
- **Speicher:** `tenants/{tenantId}/terminalCredentials/current` (nur Admin SDK / Functions).
- **Modi:** `employee` (Name + PIN), `resolve` (PIN → Name), `meister` (Meister-Freigabe).
- **Schutz:** PBKDF2-Hash, Lockout nach 5 Fehlversuchen (15 min).

### 4.5 Firebase App Check — Pflicht & Gateway-Schutz

App Check (reCAPTCHA v3) ist **produktiv verpflichtend** — sowohl im Frontend als auch als Gateway vor sensiblen Callables. Anfragen ohne gültiges App-Check-Token werden abgewiesen, **bevor** Business-Logik (Gemini, PIN-Hashing, Fleischpreis-Pipeline) ausgeführt wird.

**Backend (`enforceAppCheck: true`):** `parseDeliveryNote`, `parseMeatLabel`, `verifyTerminalPin`, `triggerManualMeatPriceRun`.

**Frontend:** `web/app-check.js` nutzt das **Compat SDK** (aligned mit `firebase-app.js` v10.8.x — kein paralleler modularer Import). Initialisierung direkt nach `initFirebase()` in `bootstrapAuthenticatedApp()`, **vor** Auth und dem ersten `httpsCallable`.

#### Hard-Block bei fehlender Konfiguration

Wenn `appCheckRecaptchaSiteKey` in `web/firebase-config.js` fehlt, leer ist oder mit `REPLACE_` beginnt:

1. `initAppCheckModule()` wirft einen **harten Fehler** (`console.error` + Exception).
2. `waitForAppCheckReady()` **lehnt ab** — kein stilles No-Op. Callables (KI-Lieferschein, Terminal-PIN, Fleischpreis-Button) bleiben gesperrt.

Damit ist ein Deploy ohne gültige Keys sofort erkennbar, statt still fehlende Backend-Schutzschicht zu übersehen.

#### Einrichtung (neue Deployments / Mandanten)

1. **Firebase Console** → **App Check** → Web-App des Projekts registrieren.
2. Provider **reCAPTCHA v3** aktivieren → **Site Key** kopieren.
3. Site Key in `web/firebase-config.js` unter `appCheckRecaptchaSiteKey` eintragen (Einträge `production` und `whitelabel` je Projekt).
4. In App Check **Enforcement** für Firestore / Functions aktivieren (schrittweise nach Key-Rollout).
5. Hosting + Functions deployen (siehe **§5**).

#### Troubleshooting

| Symptom | Ursache | Maßnahme |
|---------|---------|----------|
| Konsole: `[AppCheck] appCheckRecaptchaSiteKey fehlt…` | Platzhalter oder leerer Key | Web-App in Console registrieren, echten Site Key in `firebase-config.js` eintragen, neu deployen |
| Callables: `403` / `failed-precondition` | Enforcement aktiv, kein gültiges Token | Hard-Reload; prüfen ob reCAPTCHA-Domain in Console erlaubt ist |
| Lokal: Callables blockiert | Debug-Token fehlt | Konsole öffnen → Debug-Token kopieren → Console → App Check → **Manage debug tokens** |
| `firebase-app-check-compat.js fehlt` | SDK-Reihenfolge in `index.html` | Compat-Script vor `app-check.js` laden (gleiche Major-Version wie `firebase-app.js`) |

#### Lokal / CI (Debug Provider)

- App auf `http://localhost` oder `127.0.0.1` starten.
- Beim ersten Start erscheint in der **Browser-Konsole** ein Debug-Token, z. B.:
  `App Check debug token: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"`
- Token kopieren → Firebase Console → App Check → **Manage debug tokens** → hinzufügen.
- Optional persistieren: `?appCheckDebugToken=<UUID>` oder `localStorage.setItem('charculogic_appcheck_debug_token', '<UUID>')`.
- **GitHub Actions:** Secret `FIREBASE_APPCHECK_DEBUG_TOKEN` anlegen.

**Deploy-Reihenfolge:** App-Check-Provider in Console aktivieren → Site Keys pflegen → `npm run build` → Hosting + Rules + Functions deployen → Debug-Tokens für Entwickler/CI registrieren.

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

## 5. Build, Deployment & Release-Pipeline

Voraussetzung: Firebase CLI installiert (`firebase login`), **Node 20**. Projekt wählen:

```bash
firebase use default      # hofsync-production
firebase use whitelabel   # charculogic-whitelabel-test
```

### 5.1 Pre-Deploy-Validierung (`npm run build`)

Obwohl die PWA kein Bundler-Build hat, **blockiert** `npm run build` fehlerhafte Releases. Das Skript `tools/check-web-app.mjs` führt **6 Checks** aus:

| # | Check | Zweck |
|---|--------|--------|
| 1 | JavaScript-Syntax (`web/*.js`) | Syntaxfehler vor Deploy |
| 2 | Service-Worker-Cache-Assets | Alle in `sw.js` gelisteten Dateien existieren |
| 3 | HTML-Referenzen | `index.html`-Scripts/Styles vorhanden |
| 4 | PWA-Manifest & Icons | `manifest.json` valide |
| 5 | **Service-Worker-Version-Guard** | `web/sw.js` muss neuer sein als Kerndateien |
| 6 | Anti-Regression-Marker | Keine verbotenen Debug-/Logout-Reste |

#### Service-Worker-Version-Guard (Check 5)

Wenn `web/app.js`, `web/mhd.js` oder `web/index.html` **neuer** sind als `web/sw.js` (mtime), bricht der Build ab:

```text
⚠️ ACHTUNG: App-Logik wurde geändert, aber 'web/sw.js' wurde seitdem nicht aktualisiert.
Bitte CACHE_NAME erhöhen!
```

**Pflicht bei Frontend-Änderungen:** `CACHE_NAME` in `web/sw.js` anheben, z. B.:

```javascript
const CACHE_NAME = 'charculogic-v20260602-76';
```

Empfohlenes Muster: Datums-Präfix + laufende Nummer (`vYYYYMMDD-NN`), damit Browser-Caches nach Deploy invalidiert werden.

```bash
npm run build    # Validierung — muss grün sein vor jedem Release
```

Das Root-Skript `npm run deploy` führt automatisch `npm run build` vor `firebase deploy` aus.

### 5.2 Standard-Release-Deploy

Empfohlener Befehl für Security-/Backend-Releases:

```bash
npm run build
firebase deploy --only "firestore:rules,functions,hosting"
```

| Target | Inhalt |
|--------|--------|
| `firestore:rules` | `firebase.rules` (Mandantenisolation, `system_errors`, `pushTokens`, …) |
| `functions` | Cloud Functions inkl. App-Check-geschützter Callables |
| `hosting` | PWA unter `web/` inkl. `sw.js`, `app-check.js`, Branding |

Weitere Einzel-Deploys:

```bash
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules,storage
firebase deploy --only storage
```

### 5.3 Hinweise

- **Secret für Functions** vor dem ersten Lauf setzen:
  ```bash
  firebase functions:secrets:set GEMINI_API_KEY
  ```
- **Firestore-Rules:** Immer `firebase.rules` bearbeiten (nicht `firestore.rules`).
- **Hosting-Root** ist `web/` (siehe `firebase.json`).
- **Indizes:** Aktuell ist keine `firestore.indexes.json` hinterlegt. Falls Firestore bei neuen zusammengesetzten Abfragen einen Index verlangt, den vorgeschlagenen Index anlegen und versionieren.

---

## 6. Automatisierte Security-Tests

### 6.1 Vitest — Functions Security Suite

Suite: `functions/tests/security.test.js` (PIN-Leak-Contract, Fleischpreis-Corruption-Guard, optional Staging-Smoke für App Check).

**Lokal (ohne Netzwerk, Standard-CI):**

```bash
cd functions
npm install
npm run test:security
```

**Alternativ vom Repo-Root:**

```bash
npm run test:functions:security
```

**Staging Live-Smoke (App-Check-Gateway):** Setzt erreichbare Callable-Base-URL; ohne Variable werden Vector-2-Tests übersprungen.

```bash
cd functions
SECURITY_TEST_CALLABLE_BASE_URL=https://europe-west3-<PROJECT_ID>.cloudfunctions.net npm run test:security
```

Ersetze `<PROJECT_ID>` durch die Firebase-Projekt-ID (z. B. `charculogic-whitelabel-test`). Die Smoke-Tests prüfen u. a., dass `verifyTerminalPin` und `triggerManualMeatPriceRun` fehlende oder gefälschte `X-Firebase-AppCheck`-Header mit HTTP 401/403 ablehnen.

### 6.2 Firestore Rules Tests (Emulator)

Voraussetzungen: **Node 20**, **JDK 21+**, Firebase CLI.

```bash
npm install
npm run test:rules
```

Dev-Dependencies: `@firebase/rules-unit-testing@^5`, `mocha`, `chai`. Suite: `test/security-rules.test.mjs` — inkl. Cross-Tenant-Isolation, `system_errors`-Schema und `pushTokens`-Read-Deny.

> **CI-Hinweis:** Emulator-Start schlägt fehl, wenn JDK &lt; 21 installiert ist. JDK 21+ auf Build-Runnern sicherstellen.

---

## 7. Offene technische Punkte (Stand: Juni 2026)

1. **Custom Claims produktiv setzen** und Token-Refresh erzwingen (Firestore-Profil-Fallback in Storage perspektivisch entfernen).
2. **App Check Enforcement** in Firebase Console für alle Zielressourcen aktivieren, sobald Site Keys in allen Umgebungen live sind.
3. **Rules- + Security-Tests in CI** — `npm run test:rules` (JDK 21+) und `npm run test:functions:security` in Pipeline verankern.
4. **Fleischpreislauf:** GCP-Alert-Policy gemäß §4.6 in Produktion anlegen (`alert-policy.json` als Vorlage).
5. **MHD-Datenladen ohne `limit()`:** Pagination bei wachsenden Beständen.
