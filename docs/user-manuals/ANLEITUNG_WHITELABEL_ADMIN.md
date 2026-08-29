# [C E N T E R | L O G I C]
## 🔐 ADMINISTRATOR DEPLOYMENT & ONBOARDING GUIDE
***
> **Primärfarbe:** `#2C3E50` (Slate Blue) | **Sekundärfarbe:** `#95A5A6` (Concrete Gray)
***

# CenterLogic / CharcuLogic — Administrator-Handbuch (White-Label SaaS)

**Zielgruppe:** Plattform-Administratoren, Integratoren, DevOps
**Produkt:** Multi-Tenant-Betriebs-PWA auf Firebase (Hosting, Firestore, Cloud Functions, App Check)

Dieses Handbuch beschreibt das **Onboarding neuer Mandanten** auf der refaktorierten Plattform — claim-gesteuerte Mandantenisolation, neutrales Branding-Fallback, App-Check-Pflicht und das Telemetrie-Schema für Client-Fehler.

**Technische Tiefe:** [TECHNIK_BACKEND.md](../TECHNIK_BACKEND.md) · **Kurz-Setup:** [WHITELABEL-SETUP.md](../../WHITELABEL-SETUP.md)

---

## 1. Architektur-Grundsätze (Stand Juni 2026)

| Prinzip | Umsetzung |
|---------|-----------|
| **Mandantentrennung** | Alle Betriebsdaten unter `tenants/{tenantId}/…` |
| **Autorisierung** | Firestore-Rules prüfen **`request.auth.token.tenantId`** — kein Profil-Fallback in Rules |
| **Client-Schutz** | Firebase **App Check** (reCAPTCHA v3) — Hard-Block bei fehlenden Keys |
| **Telemetrie** | `system_errors` — Write-Only, schema-validiert, max. 999 Zeichen `message` |
| **Release-Gate** | `npm run build` → Service-Worker-Version-Guard vor Deploy |

---

## 2. Drei-Schritte-Onboarding neuer Mandanten

### Schritt 1 — Custom Claims via Admin SDK

Firestore-Rules und Callables vertrauen **ausschließlich** den Custom Claims im ID-Token. Ein Firestore-Profil `users/{uid}` allein reicht **nicht** für Schreibzugriffe.

#### 1.1 Pflicht-Claims

```javascript
await admin.auth().setCustomUserClaims(uid, {
  tenantId: 'NEW_TENANT',      // exakt wie in tenants/{tenantId}/ und branding.js
  role: 'admin',               // admin | employee | helper
  isAdmin: true,               // optional, für Storage-Rules-Übergang
});
```

| Rolle | Typische Nutzung |
|-------|------------------|
| `admin` | Leitstand, Rezepte, Bulletin, WRS-Preis-Trigger |
| `employee` | Operative Erfassung (MHD, Wareneingang, Team) |
| `helper` | Eingeschränkte Ansicht (nur Start + MHD lesen) |

#### 1.2 CLI-Synchronisation aus Firestore-Profil

Wenn `users/{uid}` bereits `tenantId` und `role` enthält:

```bash
node tools/set-user-claims.mjs --uid=<UID> --project=<PROJECT_ID>
node tools/set-user-claims.mjs --tenant=NEW_TENANT --project=<PROJECT_ID>
node tools/set-user-claims.mjs --all --project=<PROJECT_ID>
```

**Wichtig:** Claims invalidieren **keine** Refresh Tokens sofort — Clients sollten nach dem Lauf `getIdToken(true)` ausführen (passiert in `web/auth.js` beim Login-Refresh).

#### 1.3 Validierung

| Check | Erwartung |
|-------|-----------|
| Token-Inspector (JWT) | `tenantId`, `role` gesetzt |
| Cross-Tenant-Write | `permission-denied` auf fremdem Pfad |
| Callable `triggerManualMeatPriceRun` | Nur `admin` + eigener `tenantId` aus Token |

---

### Schritt 2 — Branding & Identitätsschutz (`web/branding.js`)

#### 2.1 Mandanten-Eintrag anlegen

Jeder produktive Mandant **muss** in `TENANT_BRANDING` hinterlegt sein:

```javascript
const TENANT_BRANDING = {
  NEW_TENANT: {
    appName: 'CenterLogic',
    betriebsName: 'Metzgerei Beispiel GmbH',
    primaryColor: '#00A651',
    primaryColorHover: '#008541',
    darkHeaderBg: '#1e293b',
    textOnHeader: '#ffffff',
    accentAlert: '#dc3545',
    lightBg: '#f8fafc',
    supportEmail: 'support@kunde.example',
    standardBereich: 'Allgemein',
    modules: {
      mhdMonitor: true,
      wareneingang: true,
      wareneingangMetzgerei: true,
      rezeptAudit: false,
      wurstkueche: false,        // true → Tab Prod. / WRS
      haccp: true,
      orders: true,
      chargenDoku: true,         // Tab Thekenbuch/Herkunft + Thekenklade
      batches: true,
      knowledge: false,
    },
  },
};
```

#### 2.2 Identity Leak Protection

| Verhalten | Details |
|-----------|---------|
| **DEFAULT_BRANDING** | Neutral (*Betriebs-App*, Slate-Farben) — **keine** fremden Betriebsnamen |
| **Fehlendes Profil** | `console.warn`: *Kein Mandanten-Profil gefunden* — erzwingt bewusstes Onboarding |
| **Modul-Flags** | Steuern sichtbare Tabs (z. B. TorFabrik: `wurstkueche: false`) |
| **Runtime** | Zusätzlich `tenants/{id}.enabledModules` via `/dev-dashboard` (`web/tenant-modules.js`) |

##### Modul-Flag → sichtbarer Bereich

| Flag | Schaltet frei |
|------|---------------|
| `mhdMonitor` | Tab **MHD** |
| `wareneingang` | Tab **Neu** (Wareneingang); `wareneingangMetzgerei` zusätzlich den Metzgerei-Modus |
| `chargenDoku` | Tab **Thekenbuch/Herkunft** + Dev-Dashboard **Rückverfolgbarkeit** |
| `traceability` | Legacy-Alias für bestehende Mandanten; neue Seeds/Dashboard-Speicherungen nutzen `chargenDoku` |
| `wurstkueche` | Tab **Prod.** (Rezepte / WRS) |
| `haccp` | Admin-Modul **HACCP** (und ggf. Team-Reiter Temperatur-Check, wenn Team aktiv) |
| `orders` | Im Tab **Team** die Reiter **💬 Nachrichten** und **🛒 Bestellungen** |
| `teamboard` | Tab **Start / Schwarzes Brett** und den Team-Reiter **💬 Nachrichten** |
| `batches` | Tab **Büro / Chargen** |
| `knowledge` / `cutGlossary` | Admin-Modul **Wissen** |
| `retterBox` | Retter-Box-Angebot (mandantenspezifisch, rules-gestützt) |

**`enabledModules`-Keys (Firestore):** `start`, `team`, `mhd`, `receiving`, `kitchen`, `haccp`, `knowledge`, `buero`, `chargenDoku`.

**Tab Team — kombinierte Sichtbarkeit (Stand Juli 2026):**

- Der Tab **Team** erscheint, sobald **`orders`** *oder* **`haccp`** *oder* **`teamboard`** aktiv ist (`web/app.js` → `applyModuleVisibility`).
- Die Reiter innerhalb von **Team** werden einzeln nach Modul geschaltet (`web/team-tab.js` → `visibleTeamPanels`):
  - **💬 Nachrichten**: `teamboard` *oder* `orders` aktiv
  - **🛒 Bestellungen**: `orders` aktiv
  - **🌡️ Temperatur-Check**: `haccp` aktiv (nutzt dieselben Stationen/Protokolle wie die HACCP-Seite)
- Helper-Konten (`role: helper`) sehen den Tab **Team** grundsätzlich nicht.

**Konkrete Profile:**

| Mandant | `orders` | `haccp` | `teamboard` | Tab **Team** zeigt |
|---------|----------|---------|-------------|--------------------|
| `steveshof_hauptbetrieb` | `false` | oft via `enabledModules` | `false` | Tab Team ausgeblendet; HACCP über Admin-Menü |
| `torfabrik` | `true` | `true` | (Standard `true`) | **Nachrichten · Bestellungen · Temperatur-Check** |
| `DEFAULT_BRANDING` | `true` | `true` | `true` | **Nachrichten · Bestellungen · Temperatur-Check** |

> **Kundenbestellungen für StevesHof:** Im Hofladen-Profil ist `orders: false`, daher erfasst StevesHof aktuell **keine** Kundenbestellungen über den Tab **Team**. Soll der Hofladen Bestellungen aufnehmen, in `TENANT_BRANDING.steveshof_hauptbetrieb.modules` `orders: true` setzen und die Service-Worker-Cache-Version erhöhen.

#### 2.3 Bootstrap-Daten (kein Client-Seeding)

Team, Rezepte, PINs **nicht** aus dem Browser initialisieren:

```bash
node tools/seed-tenant-bootstrap.mjs --tenant=NEW_TENANT --project=<PROJECT_ID> --all
```

Terminal-PINs liegen gehasht in `tenants/{tenantId}/terminalCredentials/current` — Verifikation nur über Callable `verifyTerminalPin`.

#### 2.4 Shared-Terminal-Storage

`web/teamboard-storage.js` prefixiert localStorage-Keys mit `{tenantId}_`. Kein manueller Eingriff nötig — bei Onboarding dokumentieren, dass gemeinsame Geräte pro Mandant isoliert bleiben.

#### 2.5 Neutrale Terminalkonten

Ein Betrieb kann ein bewusst schlankes Terminalkonto erhalten. Für StevesHof ist dies `bestellung@steveshof-hofladen.de` mit `tenantId: StevesHof_Hauptbetrieb` und Rolle `employee`.

Der Sondermodus ist in `web/app.js` absichtlich an **Mandant und E-Mail-Adresse** gebunden:

- zusätzlicher Mitarbeiter-PIN entfällt,
- neutraler Bearbeiter ist `StevesHof-Team`,
- Startansicht ist `MHD`,
- sichtbare Tabs kommen weiterhin aus den Modul-Flags in `web/branding.js`.

Bei Änderung der Terminal-E-Mail-Adresse muss auch `STEVESHOF_TERMINAL_EMAIL` in `web/app.js` angepasst und die Service-Worker-Cache-Version erhöht werden.

---

### Schritt 3 — App Check & reCAPTCHA v3

App Check ist **Pflicht-Gateway** für Callables und schützt vor unautorisierten API-Aufrufen.

#### 3.1 Firebase Console

1. **App Check** → Web-App registrieren
2. Provider **reCAPTCHA v3** → **Site Key** erzeugen
3. **Enforcement** für Cloud Functions (schrittweise auch Firestore) aktivieren
4. **Debug-Tokens** für Entwickler/CI hinterlegen

#### 3.2 `web/firebase-config.js`

Pro Firebase-Projekt (`production` / `whitelabel`):

```javascript
appCheckRecaptchaSiteKey: '6Lc…',  // kein REPLACE_-Platzhalter
```

#### 3.3 Hard-Block-Verhalten (Frontend)

| Zustand | Reaktion |
|---------|----------|
| Key fehlt / Platzhalter | `initAppCheckModule()` wirft Fehler — Callables gesperrt |
| Aktivierung fehlgeschlagen | `waitForAppCheckReady()` lehnt ab (kein Silent-Fail) |
| Compat SDK | `firebase-app-check-compat.js` v10.8.x — **gleiche** Major-Version wie `firebase-app.js` |

#### 3.4 Domain-Validierung

| Prüfung | Aktion |
|---------|--------|
| Hosting-URL des Kunden | In reCAPTCHA-Admin und Firebase App Check erlauben |
| Lokale Entwicklung | Debug-Token in Console registrieren |
| Staging-Smoke | `SECURITY_TEST_CALLABLE_BASE_URL=… npm run test:security` in `functions/` |

---

## 3. Security Constraints — Referenz

### 3.1 Firestore: Mandant & Rollen

```
request.auth.token.tenantId == tenantId   // Pfad-Mandant
request.auth.token.role in ['admin','employee','helper']
```

Payload-Felder `tenantId` in Dokumenten müssen dem Token entsprechen, sofern im Schema geprüft.

### 3.2 `system_errors` — Write-Only Client-Telemetrie

Clients dürfen **nur anlegen**, nie lesen/ändern/löschen.

**Erlaubtes Dokument:**

| Feld | Regel |
|------|--------|
| `tenantId` | == `request.auth.token.tenantId` |
| `errorCode` | string, z. B. `ERR_SYNC_PERMISSION_DENIED` |
| `message` | string, **size() < 1000** |
| `timestamp` | `serverTimestamp()` → muss `request.time` entsprechen |
| `userId` | optional |
| `context` | optional, z. B. `sync:tasks · op:update` |

**Verboten:** Zusätzliche Felder, Cross-Tenant-`tenantId`, Client-seitiges Lesen.

Implementierung Client-Flush: `web/sync.js` → `buildSystemErrorDocument()` · Operatoren-Toasts: `web/operator-errors.js`.

### 3.3 `pushTokens`

`allow read: if false` — kein Token-Scraping durch Clients. Schreiben schema-validiert für Mandanten-Nutzer.

### 3.4 `priceRuns` / `fleischpreise`

| Collection | Client |
|------------|--------|
| `priceRuns/{runId}` | read/write: **false** |
| `tenants/{id}/fleischpreise/{kw}` | write: **false** (nur Cloud Function) |

Callable `triggerManualMeatPriceRun`: `tenantId` aus **Token**, nicht aus Request-Body.

### 3.5 Anti-Double-Click (UI-Idempotenz)

Kritische Schreibpfade nutzen `inFlight`-Sperren + Button-Deaktivierung:

- `customer-orders.js` — Bestellungen
- `teamboard.js` — Aufgaben abschließen
- `production.js` — Charge dokumentieren
- `delivery-note.js` — OCR & Speichern

---

## 4. Build & Deploy-Pipeline

### 4.1 Pre-Deploy

```bash
npm run build
```

Check 5 (**Service-Worker-Version-Guard**): Bei Änderungen an `web/app.js`, `web/mhd.js` oder `web/index.html` muss `CACHE_NAME` in `web/sw.js` erhöht werden.

### 4.2 Standard-Release

```bash
npm run build
firebase deploy --only "firestore:rules,functions,hosting"
```

Optional Storage: `firebase deploy --only storage`

### 4.3 Automatisierte Security-Tests

| Suite | Befehl |
|-------|--------|
| Vitest (lokal) | `cd functions && npm run test:security` |
| Staging Smoke (App Check) | `SECURITY_TEST_CALLABLE_BASE_URL=https://europe-west3-<PROJECT>.cloudfunctions.net npm run test:security` |
| Firestore Rules | `npm run test:rules` (JDK 21+) |

---

## 5. Onboarding-Checkliste (Druckvorlage)

| # | Aufgabe | Status |
|---|---------|--------|
| 1 | Firebase-Projekt + `.firebaserc`-Alias | ☐ |
| 2 | Auth-User angelegt | ☐ |
| 3 | `users/{uid}` mit `tenantId` + `role` | ☐ |
| 4 | Custom Claims gesetzt (`set-user-claims.mjs`) | ☐ |
| 5 | `TENANT_BRANDING[tenantId]` in `branding.js` | ☐ |
| 6 | `firebase-config.js` — Projekt-Keys + `appCheckRecaptchaSiteKey` | ☐ |
| 7 | App Check Console: Web-App + reCAPTCHA v3 + Enforcement | ☐ |
| 8 | `seed-tenant-bootstrap.mjs --all` | ☐ |
| 9 | `npm run build` grün | ☐ |
| 10 | Deploy `firestore:rules,functions,hosting` | ☐ |
| 11 | Login + PIN + Cross-Tenant-Negativtest | ☐ |
| 12 | `npm run test:functions:security` | ☐ |

---

## 6. Referenz — Dateien & Pfade

| Bereich | Datei / Pfad |
|---------|----------------|
| Branding | `web/branding.js` |
| Modul-Runtime | `web/tenant-modules.js`, `/dev-dashboard` |
| LMIV-Herkunft | `web/traceability.js` |
| Firebase + App Check Keys | `web/firebase-config.js` |
| App Check Init | `web/app-check.js` |
| Terminal localStorage | `web/teamboard-storage.js` |
| Firestore Rules | `firebase.rules` |
| Claims-Skript | `tools/set-user-claims.mjs` |
| Tenant-Seed | `tools/seed-tenant-bootstrap.mjs` |
| Build-Guard | `tools/check-web-app.mjs` |
| Security Tests | `functions/tests/security.test.js` |

---

*CenterLogic Platform Administration · CharcuLogic White-Label SaaS*
