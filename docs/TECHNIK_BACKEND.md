# Technische Dokumentation – Backend, Sicherheit & Deployment

Diese Doku richtet sich an Entwickler/Tech-Partner und beschreibt das Datenmodell, das Rollen-/Rechtemodell (Firestore- & Storage-Rules), die Cloud Functions (inkl. Gemini-Fleischpreislauf) und den Deployment-Prozess.

Projektüberblick & Modulstruktur: [../README.md](../README.md) · Endnutzer-Anleitungen: [modulanleitungen/README.md](./modulanleitungen/README.md)

Firebase-Projekt: **`hofsync-production`** (siehe `.firebaserc`).

---

## 1. Mandanten-Architektur (White-Label)

Alle Betriebsdaten liegen unter einem Mandantenpfad:

```text
tenants/{tenantId}/…
```

Der aktuelle Hauptmandant ist `StevesHof_Hauptbetrieb`. Die `tenantId` wird beim Login ermittelt (`web/auth.js`) – aus einem Custom Claim (`tenantId` / `tenant_id` / `tenant`) **oder** aus dem Benutzerprofil (`users/{uid}` bzw. `userTenants/{uid}`), mit lokalem Cache als Fallback.

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
| `users/{uid}` *(global)* | Benutzerprofil (Rolle, Mandant) | nur serverseitig |
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

- `isAuthenticated()` – `request.auth != null`.
- `isTenantUser(tenantId)` – Mandantenzugehörigkeit über **Custom Claim** (`token.tenantId` / `token.tenant_id`) **oder** über das Profildokument (`users/{uid}` bzw. `userTenants/{uid}` mit passendem `tenantId`/`tenant_id`).

### 3.3 Admin-Erkennung (`firebase.rules`)

`isAdmin(tenantId)` ist **robust** und akzeptiert mehrere Quellen:

```
isTenantUser(tenantId) && (
     request.auth.token.role  == 'admin'      // Custom Claim
  || request.auth.token.admin == true         // Custom Claim
  || users/{uid}.role        == 'admin'       // Firestore-Profil
  || userTenants/{uid}.role  == 'admin'       // Firestore-Profil
)
```

**Konsequenz:** In den deployten Firestore-Rules sperrt man sich **nicht** aus, wenn (noch) keine Custom Claims gesetzt sind – das Profildokument `users/{uid}.role == 'admin'` genügt. Das deckt sich mit der Admin-Ableitung im Frontend (`web/auth.js`: `profile.role` aus `users/{uid}`).

### 3.4 ⚠️ Inkonsistenz in `storage.rules`

Die **Storage-Rules** nutzen ein **anderes**, strengeres Admin-Kriterium:

```
function istAdmin() {
  return istAngemeldet() && request.auth.token.isAdmin == true;  // nur Custom Claim
}
```

Für **Bulletin-Uploads** (`tenants/{tenantId}/bulletin/**`, z. B. Bild-/PDF-Anhänge der Tagesnachricht) ist also ein echter Custom Claim `isAdmin == true` nötig. Solange dieser Claim nicht gesetzt wird, schlagen Admin-Uploads ins Storage fehl – obwohl die Firestore-Admin-Prüfung (per Profildokument) erfolgreich ist.

**To-do für den Tech-Partner:** Claim-Strategie vereinheitlichen. Sauberster Weg sind echte Custom Claims (z. B. `role: 'admin'` + `tenantId`) per Admin SDK; dann beide Rules-Dateien auf dasselbe Kriterium ziehen.

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

### 4.1 `fetchWeeklyMeatPrices` – Gemini-Fleischpreislauf

- **Typ:** geplanter Lauf (`onSchedule`), Cron `0 8 * * 3` → **Mittwochs 08:00 Uhr** (Zeitzone `Europe/Berlin`).
- **Timeout:** 120 s, `retryCount: 2`.
- **Secret:** `GEMINI_API_KEY` (Cloud Secret Manager, in der Funktion über `secrets: ['GEMINI_API_KEY']` gebunden).
- **Ablauf** (`functions/meatPrices.js`):
  1. Prompt für aktuelle KW bauen (VEZG/AMI/MEG-Notierungen).
  2. Gemini-Modell (`GEMINI_MODEL`, Default `gemini-2.0-flash`) mit **Google-Search-Grounding** aufrufen.
  3. Antwort als JSON-Array parsen/normalisieren (mind. `MIN_PRICE_ENTRIES = 3` Einträge).
  4. Ergebnis nach `tenants/{TENANT_ID}/fleischpreise/{jahr_kwXX}` schreiben (Felder `preise`/`prices`, `kw`, `fetchedAt`, …).
- **Wichtig:** Durch das Search-Grounding kann ein Lauf **bis ~60 s** dauern.

> **Kein manueller Trigger vorhanden.** Es gibt aktuell **keinen** HTTP-/Callable-Endpoint und **keinen** UI-Button zum manuellen Anstoßen. Das Frontend (`web/app.js → subscribeFleischpreise`) **liest** die Preise nur passiv via `onSnapshot`.
>
> Falls ein manueller „Aktualisieren"-Button gewünscht ist, braucht es:
> 1. eine zusätzliche `onCall`/HTTP-Function (Scheduler ist vom Client nicht aufrufbar),
> 2. im Frontend zwingend einen **Lade-Indikator + `disabled`-Button**, um Mehrfachklicks während der bis zu 60 s Laufzeit zu verhindern.

### 4.2 `notifyTeamEntryCreated` – Push bei neuer Team-Aufgabe

- **Typ:** Firestore-Trigger (`onDocumentCreated`) auf `tenants/{tenantId}/tasks/{taskId}`, Region `europe-west3`.
- **Ablauf** (`functions/teamPush.js`):
  1. Nur bei `status == 'open'` aktiv.
  2. Zielgruppe aus `settings/teamDashboard` (Mitarbeiter/Gruppen) auflösen, Autor ausschließen.
  3. FCM-Tokens aus `tenants/{tenantId}/pushTokens` ziehen.
  4. Push via `messaging().sendEachForMulticast` versenden.

### 4.3 Lokales Testen

```bash
cd functions
npm install
npm run serve        # firebase emulators:start --only functions
```

---

## 5. Deployment

Voraussetzung: Firebase CLI installiert, an `hofsync-production` angemeldet (`firebase login`, `firebase use default`).

```bash
# Frontend-PWA (Hosting-Root = web/)
firebase deploy --only hosting

# Cloud Functions (functions/)
firebase deploy --only functions

# Firestore-Rules  ->  rollt firebase.rules aus (siehe firebase.json)
firebase deploy --only firestore:rules

# Storage-Rules
firebase deploy --only storage

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

---

## 6. Offene technische Punkte (Stand: Mai 2026)

1. **Rules-Dateien konsolidieren:** `firestore.rules` (nicht deployt) entfernen oder eindeutig kennzeichnen; einzige Quelle der Wahrheit ist `firebase.rules`.
2. **Admin-Claim-Strategie vereinheitlichen:** `firebase.rules` (role/profil) vs. `storage.rules` (`isAdmin`-Claim) angleichen; idealerweise echte Custom Claims setzen.
3. **MHD-Datenladen ohne `limit()`:** `web/mhd.js → loadMhdFromCloud` lädt die gesamte Collection per Live-Listener (DOM-Rendering ist auf `MHD_RENDER_LIMIT = 50` gedeckelt, aber Daten werden vollständig geladen). Bei stark wachsenden Beständen serverseitige Begrenzung/Pagination erwägen.
4. **Mitarbeitername-Normalisierung:** Namen werden nur via `.trim()` gespeichert (Matching ist case-insensitiv, der DB-Wert aber roh). Für saubere Auswertungen ggf. kanonische Normalisierung beim Schreiben ergänzen.
