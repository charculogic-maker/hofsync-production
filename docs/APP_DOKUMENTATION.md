# CharcuLogic / HofSync – App-Dokumentation (aktueller Stand)

> **Stand:** Juni 2026  
> **Zielgruppe:** Entwicklung, Betrieb, Admins und Kolleginnen/Kollegen mit technischem Hintergrund  
> **Produktivsystem:** Progressive Web App im Ordner `web/` (Vanilla JavaScript + Firebase)  
> **Nicht produktiv:** `lib/main.dart` (früher Flutter-Prototyp)

Diese Dokumentation beschreibt den **aktuellen Ist-Zustand** der Anwendung — Module, Mandanten, Rollen, Datenflüsse, Backend und Deployment. Für reine Tagesabläufe am Laden-iPhone siehe die [Kollegen-Anleitungen](./README.md#kollegen-anleitungen-nach-mandant). Für Security-Details und Rules-Referenz: [TECHNIK_BACKEND.md](./TECHNIK_BACKEND.md).

---

## Inhaltsverzeichnis

1. [Produktüberblick](#1-produktüberblick)
2. [Systemarchitektur](#2-systemarchitektur)
3. [Mandanten & White-Label](#3-mandanten--white-label)
4. [Navigation & Module](#4-navigation--module)
5. [StevesHof Hofladen (aktuell)](#5-steveshof-hofladen-aktuell)
6. [TorFabrik Krefeld (aktuell)](#6-torfabrik-krefeld-aktuell)
7. [Rollen & Sichtbarkeit](#7-rollen--sichtbarkeit)
8. [Offline, Sync & PWA](#8-offline-sync--pwa)
9. [Cloud Functions](#9-cloud-functions)
10. [Kunden-Signal (Abholbenachrichtigung)](#10-kunden-signal-abholbenachrichtigung)
11. [Firestore-Datenmodell](#11-firestore-datenmodell)
12. [Sicherheit (Kurzüberblick)](#12-sicherheit-kurzüberblick)
13. [Deployment & Betrieb](#13-deployment--betrieb)
14. [Projektstruktur](#14-projektstruktur)
15. [Weitere Dokumente](#15-weitere-dokumente)

---

## 1. Produktüberblick

**CharcuLogic** (Produktname am StevesHof) bzw. **CenterLogic** (TorFabrik) ist eine touch-optimierte, offline-fähige Betriebs-App für Hofläden und handwerkliche Metzgereien. Sie deckt den operativen Alltag ab:

| Bereich | Funktion |
|---------|----------|
| **MHD-Monitor** | Haltbarkeiten prüfen, Ware bearbeiten (OK / Raus / Küche / Ausverkauft) |
| **Wareneingang** | Schnellerfassung per Barcode, Lieferungen dokumentieren |
| **Wurstküche / Prod.** | Rezepte, Produktion, WRS-Kalkulation, Chargen |
| **HACCP** | Tageskontrollen (Temperaturen, Reinigung), Geräte einrichten |
| **Team** | Schwarzes Brett, Aufgaben, Kundenbestellungen (mandantenabhängig) |
| **Büro** | Chargen-Archiv, Leitstand, Team-Konfiguration (Admin) |

Das System ist als **White-Label-Lösung mit strikter Mandantentrennung** gebaut: Alle Betriebsdaten liegen unter `tenants/{tenantId}/…`. Mehrere Betriebe teilen sich dieselbe Firebase-Infrastruktur, können aber keine fremden Daten lesen oder schreiben.

### Designprinzipien („Wet Finger“)

- Große Touch-Targets für feuchte Hände und Handschuhe
- Primäre Aktionen im unteren Bildschirmdrittel (One-Hand-Ergonomie)
- Taktiles Audio-Feedback (Web Audio API)
- Dark Mode mit System-Voreinstellung und manuellem Umschalter
- Deutsche Bedienoberfläche; technische Fehler nur in `console.error`, Nutzer sehen freundliche Toasts (`web/operator-errors.js`)

---

## 2. Systemarchitektur

```
┌─────────────────────────────────────────────────────────────────┐
│  Laden-iPhone (PWA)                                             │
│  web/index.html · app.js · Module (mhd, haccp, production, …)   │
│  sw.js (Offline-Cache) · sync.js (Warteschlange)                │
└───────────────┬───────────────────────────────┬─────────────────┘
                │ Firebase Auth + App Check      │ Firestore onSnapshot
                ▼                                ▼
┌───────────────────────────┐    ┌────────────────────────────────┐
│  Firebase Authentication  │    │  Cloud Firestore                 │
│  Custom Claims:           │    │  tenants/{tenantId}/…            │
│  tenantId, role           │    │  users/{uid} (global)            │
└───────────────────────────┘    └───────────────┬────────────────────┘
                │                                │ Triggers
                ▼                                ▼
┌───────────────────────────┐    ┌────────────────────────────────┐
│  Firebase Storage         │    │  Cloud Functions (Node 20)       │
│  Bulletin, Bestellzettel  │    │  europe-west3                    │
└───────────────────────────┘    └────────────────────────────────┘
```

| Schicht | Technologie | Ort |
|---------|-------------|-----|
| Frontend | PWA, ES-Module, kein Build-Step (Pre-Deploy-Check via `npm run build`) | `web/` |
| Auth | Firebase Auth (E-Mail/Passwort), Mandant + Rolle aus **Custom Claims** | `web/auth.js` |
| App-Schutz | Firebase App Check (reCAPTCHA v3) — Pflicht vor Callables | `web/app-check.js` |
| Datenbank | Cloud Firestore (Live-Sync) | `firebase.rules` |
| Dateien | Firebase Storage | `storage.rules` |
| Offline | Service Worker + lokale Sync-Queue | `web/sw.js`, `web/sync.js` |
| Backend | Cloud Functions v2 | `functions/` |
| KI | Gemini (Lieferschein-OCR, Fleischpreise) | `functions/deliveryNote.js`, `functions/meatPrices.js` |
| E-Mail/SMS | nodemailer (Mittwald SMTP), Twilio | `functions/orderNotifications.js` |

### Firebase-Projekte

| Alias (`.firebaserc`) | Projekt-ID | Typische Nutzung |
|----------------------|------------|------------------|
| `default` | `hofsync-production` | StevesHof-Produktion (`hofsync-production.web.app`) |
| `whitelabel` | `charculogic-whitelabel-test` | TorFabrik-Test (`charculogic-whitelabel-test.web.app`) |

Die Web-App wählt `apiKey` / `projectId` automatisch nach Hostname (`web/firebase-config.js`). Lokal: `?firebase=whitelabel` oder `?firebase=production` auf `localhost`.

---

## 3. Mandanten & White-Label

### Konfiguration

Mandantenprofile stehen in `web/branding.js` unter `TENANT_BRANDING`. Der Lookup-Key ist die **lowercase**-Variante der `tenantId` (z. B. `StevesHof_Hauptbetrieb` → `steveshof_hauptbetrieb`).

Pro Mandant konfigurierbar:

- App-Name, Betriebsname, Farben (CSS-Variablen)
- **Modul-Flags** (`modules.*`) — steuern, welche Tabs sichtbar sind
- Standardbereich-Label (z. B. „Laden / Verkauf“)

### Modul-Flags (Referenz)

| Flag | Wirkung |
|------|---------|
| `mhdMonitor` | Tab **MHD** |
| `wareneingang` | Tab **Neu** (Wareneingang) |
| `wareneingangMetzgerei` | Metzgerei-Untermodus im Wareneingang |
| `wurstkueche` | Tab **Prod.** (zusätzlich: `torfabrik` ist hardcoded ausgeschlossen) |
| `cutGlossary` | Tab **Cuts** (regionales Cut-Lexikon, optional) |
| `haccp` | Tab **HACCP** |
| `teamboard` | Tab **Start** (Teamboard) |
| `team` | Tab **Team** (nur wenn explizit `true` oder abhängige Module aktiv) |
| `orders` | Kundenbestellungen im Team-Tab |
| `batches` | Tab **Büro** (Chargen & Leitstand) |
| `rezeptAudit` | Rezept-Audit-Karte in Prod. |
| `retterBox` | Retter-Box-Funktion im MHD (nur StevesHof) |

Die Sichtbarkeit wird in `applyModuleVisibility()` (`web/app.js`) gesetzt; danach filtert `applyRoleBasedUi()` nach Rolle und Mandant.

---

## 4. Navigation & Module

Untere Navigationsleiste — bis zu sieben Tabs, mandanten- und rollenabhängig:

| Tab-ID | Label | Seite | Hauptmodule | Kurzbeschreibung |
|--------|-------|-------|-------------|------------------|
| `teamboard` | Start | `page-teamboard` | `teamboard.js`, `team-notify.js` | PIN-Anmeldung, Nachricht des Tages, Aufgaben, Historie |
| `team` | Team | `page-team` | `team-tab.js`, `customer-orders.js` | Nachrichten, Kundenbestellungen |
| `mhd` | MHD | `page-mhd` | `mhd.js`, `scanner.js`, `retter-box.js` | MHD-Monitor, Barcode, Retter-Box |
| `receiving` | Neu | `page-receiving` | `mhd.js` | Wareneingang Laden/Metzgerei, Letzte Eingänge |
| `kitchen` | Prod. | `page-kitchen` | `production.js`, `beffe_calc.js` | Rezepte, Produktion, WRS |
| `haccp` | HACCP | `page-haccp` | `haccp.js` | Tageskontrollen, Geräte-Setup |
| `cuts` | Cuts | `page-cuts` | `cuts.js` | Cut-Bezeichnungen, Synonyme, Muskelgruppen, Menschen-Vergleich |
| `batches` | Büro | `page-batches` | `production.js`, `team-config.js` | Chargen, Leitstand, Admin-Panels |

### MHD-Monitor (`web/mhd.js`)

- Zeigt Posten aus `tenants/{tenantId}/mhd_liste` nach Zeitraum (7 / 14 / 21 Tage) und Kategorie
- Aktionen: OK, Raus, Küche, Ausverkauft; Mengenkorrektur
- Barcode-Scanner für Suche und Wareneingang
- **Retter-Box** (StevesHof): Angebote für kurz vor MHD ablaufende Ware (`retter_boxen`)
- Sticky-Speicherleiste; Helper sehen keine Speichern-Leiste

### Wareneingang (`web/mhd.js`, Tab Neu)

- **Laden-Modus:** Schnellerfassung mit Kategorie (Frische, MoPro, Kühlware, TK, …), EAN-Scan, Hersteller/Zusatz, MHD
- **Letzte Eingänge:** Kategorie-Korrektur für alle Nutzer mit Tab Neu
- **Metzgerei-Modus:** mandantenabhängig (`wareneingangMetzgerei`)
- **Stammdaten / KI-Lieferschein (Büro):** `#btn-master-data`, `#btn-delivery-note-ai` — nur `isOfficeUser()`
- **StevesHof KI-Parser** (`web/delivery-parser.js`): Testweise nur für `patrik@charculogic.de`; schreibt in `mhd_liste` / `stammdaten`
- **TorFabrik KI-Lieferschein** (`web/delivery-note.js`): Callable `parseDeliveryNote` → `inventory`

### Wurstküche / Prod. (`web/production.js`, `web/beffe_calc.js`)

- Rezeptliste, Produktionserfassung, Chargen-Dokumentation
- WRS-Kalkulation mit wöchentlichen Fleischpreisen aus `fleischpreise/{kw}`
- Fleischpreis-Update-Button nur für Büro-Admins
- Modul deaktiviert für Mandant `torfabrik`

### HACCP (`web/haccp.js`)

Drei Bereiche über Modus-Leiste:

| Modus | Button | Funktion |
|-------|--------|----------|
| Temperaturen | `temperatur` | Kühlstellen, TK, Sollwerte, Tages-Messwerte |
| Reinigung | `reinigung` | Reinigungs-Checklisten nach Bereich |
| Geräte einrichten | `+` (Setup) | Admin: Geräte anlegen/bearbeiten (`haccp_geraete`) |

**Team-Auswahl „Wer trägt gerade ein?“** (alphabetisch, `Aushilfe (andere)` immer unten):

Bettina, Efecan, Finn, Heiko, Melanie, Mimi, Nicole, Paddy, Stephie, Thomas, Aushilfe (andere)

- Protokolle in `haccp_logs` — **unveränderlich** nach Anlage (Firestore Rules)
- Offline: Einträge in Sync-Queue; veraltete Payloads (>48h) → `haccp_stale_archive`
- Meister-Override bei Temperatur-Abweichung (PIN via `verifyTerminalPin`)
- Druckansicht für Tagesprotokoll

### Cut-Lexikon (`web/cuts.js`)

- Optionaler Tab **Cuts** ueber `modules.cutGlossary: true`
- Kuratierte Offline-Liste fuer Rind, Schwein und Lamm
- Suche ueber Cut-Namen, regionale Synonyme, anatomische Lage, Muskelgruppe und Menschen-Vergleich
- Keine Firestore-Daten und keine Schreibvorgaenge; reines Nachschlage-Modul

### Team & Teamboard

- **Teamboard** (`teamboard.js`): Mitarbeiter-PIN, Aufgaben, Bulletin, Push-Tokens
- **Team-Tab** (`team-tab.js`): Unterpanels Nachrichten + Bestellungen
- **Kundenbestellungen** (`customer-orders.js`): Annahme, Sammel-Pickliste, Status „abholbereit“, Gewichtsnachberechnung

### Büro (`page-batches`)

- Chargen-Archiv und Rückverfolgung
- Büro-Re-Login-Sperre für Nicht-Admins auf diesem Tab
- Team-Konfiguration (Mitarbeiter, Gruppen, PINs) — Admin only

---

## 5. StevesHof Hofladen (aktuell)

| Eigenschaft | Wert |
|-------------|------|
| `tenantId` | `StevesHof_Hauptbetrieb` |
| App-Name | CharcuLogic |
| Firebase-Projekt | `hofsync-production` |
| Hosting | `https://hofsync-production.web.app` |
| Branding-Key | `steveshof_hauptbetrieb` |

### Aktive Module (`web/branding.js`)

| Modul | Status |
|-------|--------|
| MHD | ✅ |
| Wareneingang (Laden) | ✅ |
| Wareneingang Metzgerei | ❌ |
| Wurstküche / Prod. | ✅ |
| HACCP | ✅ |
| Teamboard (Start) | ❌ |
| Team (Bestellungen) | ❌ |
| Kundenbestellungen (`orders`) | ❌ (Backend vorbereitet, UI aus) |
| Büro / Chargen | ✅ (nur Admin/Büro) |
| Retter-Box | ✅ |

### Sichtbare Tabs am Laden-iPhone (Terminal)

**Zugang:** `bestellung@steveshof-hofladen.de` · Rolle `employee` · Mandant `StevesHof_Hauptbetrieb`

| Tab | Sichtbar |
|-----|----------|
| MHD | ✅ (Start-Tab) |
| Neu | ✅ |
| Prod. | ✅ |
| HACCP | ✅ |
| Büro | ❌ (nur persönliche Admin-Konten) |
| Team / Start | ❌ |

### Terminal-Modus (`web/app.js`)

Für die Kombination StevesHof + `bestellung@steveshof-hofladen.de`:

- Keine Mitarbeiter-PIN-Abfrage
- Bearbeiter automatisch **StevesHof-Team**
- App startet direkt im Tab **MHD**
- Logout-Button im Alltag ausgeblendet (`dataset.fixedTerminal = 'steveshof'`)
- `applyEarlyTenantShell()` setzt Branding vor Auth-Abschluss

### Persönliche Admin-Konten

Z. B. `paddy@steveshof-hofladen.de` mit `role: admin` sehen zusätzlich Tab **Büro** (Chargen, Leitstand, Team-Konfiguration).

---

## 6. TorFabrik Krefeld (aktuell)

| Eigenschaft | Wert |
|-------------|------|
| `tenantId` | `torfabrik` |
| App-Name | CenterLogic |
| Firebase-Projekt | `charculogic-whitelabel-test` |
| Hosting | `https://charculogic-whitelabel-test.web.app` |

### Aktive Module

| Modul | Status |
|-------|--------|
| MHD | ✅ |
| Wareneingang | ✅ |
| Wurstküche | ❌ (hardcoded + Branding) |
| HACCP | ✅ |
| Teamboard | ✅ |
| Team + Bestellungen | ✅ |
| KI-Lieferschein (Wareneingang) | ✅ (UI TorFabrik-only) |

### Rollen am Laden

- **Helper:** Tabs Start + MHD (Wareneingang, Prod., HACCP, Büro ausgeblendet)
- **Employee / Admin:** volle Modul-Sichtbarkeit gemäß Branding
- Mitarbeiter-PIN über Callable `verifyTerminalPin` + `terminalCredentials/current`

---

## 7. Rollen & Sichtbarkeit

### Rollen (Custom Claims)

| Rolle | Claim | Firestore-Schreiben | Typische Nutzung |
|-------|-------|---------------------|------------------|
| `admin` | `role: admin` | Ja (inkl. Admin-only Collections) | Büro, Leitstand, Konfiguration |
| `employee` | `role: employee` | Ja (operative Daten) | Laden-iPhone, Produktion |
| `helper` | `role: helper` | **Nein** (read-only) | eingeschränktes Terminal |

**Büro-Nutzer:** `isOfficeUser()` = Admin **und nicht** Helper (`web/auth.js`).

Login schlägt fehl ohne `tenantId` **und** `role` in den Custom Claims.

### UI-Filter (`applyRoleBasedUi` in `web/app.js`)

| Element | Helper | Employee | Admin (Büro) |
|---------|--------|----------|----------------|
| Tabs team, receiving, kitchen, batches | ausgeblendet | — | — |
| Tab HACCP bei StevesHof | **sichtbar** (Ausnahme) | sichtbar | sichtbar |
| Tab Büro bei StevesHof | ausgeblendet | ausgeblendet | sichtbar |
| Stammdaten, KI-Lieferschein, Office-Tools | ausgeblendet | ausgeblendet | sichtbar |
| MHD Speichern-Leiste | ausgeblendet | sichtbar | sichtbar |
| WRS „Preise aktualisieren“ | ausgeblendet | ausgeblendet | sichtbar |

Claims setzen:

```bash
node tools/set-user-claims.mjs --all --project=hofsync-production
```

---

## 8. Offline, Sync & PWA

### Service Worker (`web/sw.js`)

- Cached kritische Assets für Offline-Nutzung
- `CACHE_NAME` muss bei Änderungen an `app.js`, `mhd.js` oder `index.html` erhöht werden (sonst bricht `npm run build` ab)
- Update-Button (↻) im Header löst Hard-Reload und SW-Refresh aus

### Sync-Engine (`web/sync.js`)

| Mechanismus | Beschreibung |
|-------------|--------------|
| Firestore Persistence | `enablePersistence()` in `app.js` |
| Warteschlange | `charculogic.pendingSyncs.{tenantId}` in localStorage |
| Schreibweg | `writeFirestoreDocOrQueue()` — online direkt, offline/fehler → Queue |
| Lie-Fi-Timeout | 3,5 s, dann Queue |
| Flush | bei `online` und `visibilitychange`, max. 5 Versuche |
| Dead Letter | `charculogic.pendingSyncs.dead.{tenantId}` (max. 100) |
| Mandanten-Safety | Pfade werden gegen Token-`tenantId` geprüft |

Nutzer-Toasts bei Offline: *„Wird automatisch synchronisiert, sobald WLAN verfügbar ist.“*

### Shared Terminals

`web/teamboard-storage.js` prefixiert localStorage-Keys mit `{tenantId}_`, damit Mitarbeiter-Auswahl nicht zwischen Mandanten vermischt wird.

---

## 9. Cloud Functions

Alle Functions: Region **`europe-west3`**, Node **20**. Einstieg: `functions/index.js`.

| Export | Typ | Auslöser | Datei |
|--------|-----|----------|-------|
| `notifyTeamEntryCreated` | Firestore Trigger | `onCreate` `tenants/{tenantId}/tasks/{taskId}` | `teamPush.js` |
| `parseDeliveryNote` | Callable (App Check) | Client-Aufruf | `parseDeliveryNoteCallable.js` → `deliveryNote.js` |
| `verifyTerminalPin` | Callable (App Check) | PIN-Prüfung Terminal | `verifyTerminalPinCallable.js` |
| `fetchWeeklyMeatPrices` | Scheduler | Mi 08:00 Europe/Berlin | `meatPrices.js` |
| `triggerManualMeatPriceRun` | Callable (Admin) | manueller Fleischpreis-Lauf | `meatPrices.js` |
| `onOrderReadySendSignal` | Firestore Trigger | `onUpdate` `customerOrders` → `status: ready` | `orderNotifications.js` |

### Secrets / Umgebungsvariablen (Functions)

| Variable | Zweck |
|----------|-------|
| `GEMINI_API_KEY` | Lieferschein-OCR, Fleischpreise |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | E-Mail Kunden-Signal (Mittwald) |
| `FROM_EMAIL` | Absender (Default: `bestellung@steveshof-hofladen.de`) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `FROM_NUMBER` | SMS Kunden-Signal (optional) |

Konfiguration über `functions/.env` (lokal/Deploy) oder Firebase Params (`defineString` in `orderNotifications.js`).

---

## 10. Kunden-Signal (Abholbenachrichtigung)

**Datei:** `functions/orderNotifications.js`  
**Trigger:** Bestellung wechselt auf `status: 'ready'` in `tenants/{tenantId}/customerOrders/{orderId}`.

### Ablauf

1. Mitarbeiter markiert Bestellung als abholbereit (inkl. Gewichtsnachberechnung in `customer-orders.js`)
2. Cloud Function berechnet Waagen-Endpreis aus `actualQuantity` × Stückpreis
3. Versand parallel über verfügbare Kanäle:

| Kanal | Bedingung | Technik |
|-------|-----------|---------|
| E-Mail | `customerEmail` gesetzt + SMTP konfiguriert | nodemailer → `mail.agenturserver.de` |
| SMS | `callbackPhone` gesetzt + Twilio konfiguriert | Twilio SDK, E.164-Normalisierung |

### Beispiel-Nachricht (StevesHof-Stil)

> Hallo Anna, dein Genuss-Paket ist fertig gepackt! Thomas aus der Metzgerei hat alles frisch vorbereitet. Der genaue Waagen-Endpreis beträgt 15,00 €. Du kannst es ab Fr. um 09:00 Uhr abholen. Wir freuen uns auf dich! Dein StevesHof-Team.

Fehlende Zugangsdaten → Kanal wird übersprungen, Function bricht nicht ab.

**Hinweis:** StevesHof hat `orders: false` — die Bestell-UI ist am Hofladen-iPhone derzeit ausgeblendet. Die Backend-Logik ist deploybereit, sobald das Modul freigeschaltet wird.

### Deploy (nur diese Function)

```bash
firebase use default   # oder whitelabel
firebase deploy --only functions:onOrderReadySendSignal
```

---

## 11. Firestore-Datenmodell

Alle Mandantendaten unter `tenants/{tenantId}/`:

| Collection | Inhalt |
|------------|--------|
| `mhd_liste` | MHD-Posten |
| `wareneingang_lieferungen` | Lieferungen inkl. Fotos |
| `stammdaten` | Artikelstammdaten |
| `inventory` | KI-Lieferschein-Bestand (TorFabrik) |
| `rezepte` | Rezepturen |
| `produktion_chargen` | Produktionschargen |
| `fleischpreise` | Wochen-Fleischpreise (nur Functions schreiben) |
| `haccp_geraete` | HACCP-Messpunkte/Geräte |
| `haccp_logs` | HACCP-Protokolle (immutable) |
| `haccp_stale_archive` | Abgewiesene Offline-Payloads |
| `retter_boxen` | Retter-Box-Angebote (StevesHof) |
| `tasks` | Team-Aufgaben |
| `bulletinBoard` | Nachricht des Tages |
| `customerOrders` | Kundenbestellungen |
| `settings` | Team-Konfiguration |
| `pushTokens` | FCM-Tokens |
| `terminalCredentials` | Gehashte PINs (Client: kein Lesen) |
| `pinAttempts` | PIN-Lockout (Client: kein Zugriff) |

**Global (nicht mandantenbezogen):**

| Collection | Inhalt |
|------------|--------|
| `users/{uid}` | Benutzerprofil (read: eigener User) |
| `system_errors` | Client-Telemetrie (append-only) |
| `priceRuns` | Fleischpreis-Lauf-Lifecycle |

**Storage:** `tenants/{tenantId}/bulletin/…`, `tenants/{tenantId}/order_slips/…`

Pfad-Helfer im Client: `web/tenant-db.js` → `getTenantCollection(name)`.

---

## 12. Sicherheit (Kurzüberblick)

- **Mandantenisolation:** Firestore Rules prüfen `request.auth.token.tenantId` gegen Pfad — kein Profil-Fallback für Schreibzugriffe
- **App Check:** Pflicht für alle Callables (`parseDeliveryNote`, `verifyTerminalPin`, `triggerManualMeatPriceRun`)
- **Helper:** read-only für operative Collections
- **HACCP-Logs:** nach Create nicht änderbar/löschbar
- **Terminal-PINs:** PBKDF2-Hash in Firestore, Prüfung nur serverseitig
- **Security-Tests:** `npm run test:functions:security`, `npm run test:rules`

Details, Schemata und Deployment-Checkliste: [TECHNIK_BACKEND.md](./TECHNIK_BACKEND.md).

---

## 13. Deployment & Betrieb

### Vor jedem Release

```bash
npm run build
```

Prüft Service-Worker-Version, Syntax und PWA-Integrität.

### Standard-Release

```bash
firebase use default          # StevesHof-Produktion
npm run build
firebase deploy --only "firestore:rules,functions,hosting"
```

### Einzelne Targets

```bash
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only functions:onOrderReadySendSignal
firebase deploy --only firestore:rules
firebase deploy --only storage
```

### Lokal testen

```powershell
cd web
python -m http.server 5173 --bind 127.0.0.1
```

Dann `http://127.0.0.1:5173/index.html` — Firebase-Login erforderlich für Live-Daten.

### Mandanten-Bootstrap (einmalig)

```bash
node tools/seed-tenant-bootstrap.mjs --tenant=StevesHof_Hauptbetrieb --credentials
node tools/seed-tenant-bootstrap.mjs --tenant=torfabrik --project=charculogic-whitelabel-test --all
```

---

## 14. Projektstruktur

```
craft_food_app/
├── web/                    # Produktiv-PWA
│   ├── index.html          # App-Shell, alle Seiten
│   ├── app.js              # Bootstrap, Tabs, Rollen-UI
│   ├── branding.js         # White-Label pro Mandant
│   ├── auth.js             # Login, Claims, Office-User
│   ├── sync.js             # Offline-Queue
│   ├── sw.js               # Service Worker
│   ├── mhd.js              # MHD + Wareneingang
│   ├── haccp.js            # HACCP Tageskontrollen
│   ├── production.js       # Wurstküche, Chargen
│   ├── customer-orders.js  # Kundenbestellungen
│   ├── teamboard.js        # Start-Tab
│   └── …
├── functions/              # Cloud Functions (Node 20)
├── firebase.rules          # Firestore Security Rules (deployt)
├── storage.rules           # Storage Rules
├── firebase.json
├── .firebaserc
├── tools/                  # Bootstrap, Claims, Screenshots, Build-Check
└── docs/                   # Dokumentation
```

---

## 15. Weitere Dokumente

| Dokument | Inhalt |
|----------|--------|
| [README.md](./README.md) | Übersicht aller Projekt-Dokumente |
| [TECHNIK_BACKEND.md](./TECHNIK_BACKEND.md) | Security, Rules-Schemata, Functions im Detail |
| [KOLLEGEN_ANLEITUNG_HOFLADEN_APP.md](./KOLLEGEN_ANLEITUNG_HOFLADEN_APP.md) | Tagesablauf StevesHof (Kollegen) |
| [KOLLEGEN_ANLEITUNG_TORFABRIK.md](./KOLLEGEN_ANLEITUNG_TORFABRIK.md) | Tagesablauf TorFabrik |
| [user-manuals/ANLEITUNG_STEVESHOF.md](./user-manuals/ANLEITUNG_STEVESHOF.md) | Laden-iPhone Handbuch |
| [modulanleitungen/README.md](./modulanleitungen/README.md) | Screenshots pro Modul |
| [WHITE_LABEL_UPLOAD_ANLEITUNG.md](./WHITE_LABEL_UPLOAD_ANLEITUNG.md) | CSV-Import Rezepte & MHD |

### Bekannte Abweichungen älterer Anleitungen

Einige Kollegen-Dokumente beschreiben noch den Tab **Team** mit Temperatur-Check oder aktive Kundenbestellungen am StevesHof-Laden-iPhone. **Aktueller Code:**

- Temperatur-Check liegt im Tab **HACCP** (nicht Team)
- StevesHof: Tabs **Team** und **Start** sind deaktiviert (`team: false`, `teamboard: false`)
- Kundenbestell-UI: `orders: false` (Backend Kunden-Signal ist vorbereitet)

Bei UI-Änderungen diese Doku und die Kollegen-Anleitungen gemeinsam pflegen.

---

*CharcuLogic / HofSync · Dokumentation generiert aus Codebase-Stand Juni 2026*
