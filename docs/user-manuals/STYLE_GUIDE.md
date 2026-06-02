# [CENTERLOGIC] - Multi-Tenant Design System & Style Guide (Version June 2026)

Dieses Dokument definiert das **Corporate Design (CD)**, die **Design Tokens** und die **UX-Sicherheitsmuster** der CenterLogic-/CharcuLogic-Plattform. Es ergänzt die rollenspezifischen Handbücher:

| Handbuch | Cursor-Referenz | Datei |
|----------|-----------------|-------|
| StevesHof — schlankes Hofladen-Terminal | `@ANLEITUNG_STEVESHOF.md` | [ANLEITUNG_STEVESHOF.md](./ANLEITUNG_STEVESHOF.md) |
| TorFabrik — Großproduktion & OCR | `@ANLEITUNG_TORFABRIK.md` | [ANLEITUNG_TORFABRIK.md](./ANLEITUNG_TORFABRIK.md) |
| White-Label Admin & Onboarding | `@ANLEITUNG_WHITELABEL_ADMIN.md` | [ANLEITUNG_WHITELABEL_ADMIN.md](./ANLEITUNG_WHITELABEL_ADMIN.md) |

**Implementierung im Code:** `web/branding.js` · `web/style.css` · `web/operator-errors.js` · `web/teamboard-storage.js`

---

## 1. Whitelabel-Basis (Plattform-Default)

Die neutrale Vorlage gilt für unbekannte Mandanten und Admin-Oberflächen — **ohne** fremde Betriebsidentitäten (`DEFAULT_BRANDING` in `web/branding.js`).

### 1.1 Farb-Tokens

| Token | Hex | Verwendung |
|-------|-----|------------|
| **Primary** | `#1a365d` | Header, Primär-Navigation, Vertrauensanker |
| **Secondary** | `#2c3e50` | Sekundäre Flächen, Admin-Guides, Tabellenköpfe |
| **Accent** | `#3498db` | Links, Fokus-Ringe, informative Aktionen |
| **Background** | `#f1f5f9` | Seitenhintergrund (neutral) |
| **Alert** | `#dc3545` | Kritische Hinweise, MHD-Alarm |

### 1.2 Typografie & Struktur

- Überschriften: klar hierarchisch (`#` Plattform · `##` Modul · `###` Feature)
- Tabellen für Tokens, Checklisten und Fehler-Mapping
- Blockquotes (`>`) für Mandanten-Meta und Release-Hinweise

### 1.3 Anti-Double-Click-Locks (Plattform-weit)

Kritische Schreiboperationen nutzen ein **asynchrones Sperr-Muster**:

```javascript
if (state.inFlight) return;

try {
  state.inFlight = true;
  if (button) button.disabled = true;
  await persistToFirestore(/* … */);
} catch (err) {
  logAndMapOperatorError(err, context);
} finally {
  state.inFlight = false;
  if (button) button.disabled = false;
}
```

| Regel | Begründung |
|-------|------------|
| `inFlight` vor dem `try` prüfen | Parallele Aufrufe sofort verwerfen |
| `disabled = true` während des Laufs | Visuelles Feedback + weniger Fehltips |
| **`finally` entsperrt immer** | Auch bei Fehler oder frühem `return` im `try` |
| Kein stilles No-Op bei App Check | `waitForAppCheckReady()` lehnt bei Fehlstart ab |

**Betroffene Module:** `customer-orders.js` · `teamboard.js` · `production.js` · `delivery-note.js` · WRS-Button in `app.js`

---

## 2. Mandant: StevesHof (`StevesHof_Hauptbetrieb`)

**Produktname:** CharcuLogic · **Handbuch:** `@ANLEITUNG_STEVESHOF.md`

### 2.1 Design Tokens

| Token | Hex | Verwendung |
|-------|-----|------------|
| **Primary** | `#5d4037` | Braunes Markenfundament — Header, Navigationsakzent |
| **Accent** | `#ea580c` | Orange — CTAs und wichtige Hofladen-Hinweise |
| **Background** | `#fff8e1` | Warmes Creme — Hofladen-Atmosphäre, PWA `background_color` |
| **Header dunkel** | `#334155` | Kontrast für Betriebsname im Login |

### 2.2 Touch-optimiertes UI („Wet Finger“-Regel)

| Spezifikation | Wert | CSS / Verhalten |
|---------------|------|-----------------|
| Mindest-Touch-Ziel | **48 px** | Buttons, Nav-Tabs (`min-height: 48px` in `style.css`) |
| Empfohlenes Ziel | **64 px** | `--touch-target-size: 64px` für primäre Aktionen |
| Abstand | großzügig | Verhindert Fat-Fingering mit Handschuhen |
| Feedback | Web Audio API | Kurze Klick-Töne als Haptik-Ersatz |
| Navigation | unten fixiert | One-Hand-Ergonomie auf Tablets |

**Module aktiv:** MHD · Wareneingang (**Laden**) · Wurstküche / WRS (**Prod.**)

**Hofladen-Terminal:** Startet direkt im Tab **MHD**. Der neutrale Zugang `bestellung@steveshof-hofladen.de` arbeitet ohne zusätzliche Mitarbeiter-PIN als `StevesHof-Team`. Team, Metzgerei, HACCP und Büro sind derzeit bewusst ausgeblendet. Der Alltags-Logout bleibt am festen Tablet verborgen.

### 2.3 Graceful Offline & Fallback

| Layer | Verhalten |
|-------|-----------|
| **Service Worker** | Kerndateien gecacht (`web/sw.js` — `CACHE_NAME` bei Frontend-Änderungen bumpen) |
| **Sync-Warteschlange** | `writeFirestoreDocOrQueue()` → lokale Queue bei `!navigator.onLine` |
| **Toast (Operator)** | *„Wird automatisch synchronisiert, sobald WLAN verfügbar.“* |
| **Plattform-Fallback** | Statische `/data/beffe_data.json` für Mandanten mit aktivem WRS; im aktuellen Hofladen-Profil ausgeblendet |
| **Telemetrie** | Fehler in Queue → Flush nach Reconnect nach `system_errors`-Schema |

Kein Datenverlust bei kurzem Funkloch — Operatoren sehen **gelbe** Hinweise, keine Stacktraces.

---

## 3. Mandant: TorFabrik (`torfabrik` / Dokumentation `TorFabrik_Werk_Nord`)

**Produktname:** CenterLogic · **Handbuch:** `@ANLEITUNG_TORFABRIK.md`

> **Hinweis:** Produktive `tenantId` in Firebase: `torfabrik`. Das CD-Banner in der Bedienungsanleitung nutzt die Marketing-Bezeichnung `TorFabrik_Werk_Nord`.

### 3.1 Design Tokens

| Token | Hex | Verwendung |
|-------|-----|------------|
| **Primary** | `#0f172a` | Slate-Black — industrielle Seriosität, hoher Kontrast |
| **Accent** | `#1565c0` | Blau — aktive Prozesse, Links, KI-Aktionen |
| **Warning** | `#ffb300` | Amber — MHD-Alarme, Lieferungs-Hinweise |
| **Header (Branding)** | `#ffc20e` | Gelber Header-Balken (TorFabrik in `TENANT_BRANDING`) |

### 3.2 High-Contrast Industrial UI

| Prinzip | Umsetzung |
|---------|-----------|
| Kontrast | Dunkle Primärfarbe + helle Warn-Akzente |
| Informationsdichte | Tabellen, Filter-Chips, Bereichs-Umschalter |
| Solo-Ansicht | **„Alle meine Bereiche“** — aggregierte Aufgabenliste |
| Modul-Skip | `wurstkueche: false` — kein Prod./WRS-Tab |

### 3.3 OCR-Pipeline (3 Schritte)

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│ 1. ERFASSEN │ ──► │ 2. VORSCHAU  │ ──► │ 3. PERSISTIEREN │
│ Foto/PDF    │     │ Tabelle edit │     │ inventory/…     │
└─────────────┘     └──────────────┘     └─────────────────┘
```

| Schritt | UI-Zustand | Lock |
|---------|------------|------|
| **1 — Erfassen** | Tab **Neu** → **📸 Lieferschein scannen (KI)** | `ocrInFlight` — kein Doppel-Scan |
| **2 — Vorschau** | Overlay-Tabelle: Artikel · Menge · Kategorie | Manuelle Korrektur vor Commit |
| **3 — Persistieren** | **In Bestand speichern** | `saveInFlight` — kein Doppel-Save |

Callable `parseDeliveryNote` erfordert **App Check** + Mandant `torfabrik`. Fehler → `@ANLEITUNG_TORFABRIK.md` Kapitel 3.3.

### 3.4 localStorage-Präfix (`{tenantId}_`)

Shared Terminals: Keys in `web/teamboard-storage.js`

| Basis-Key | Beispiel (`torfabrik`) |
|-----------|-------------------------|
| `charculogic_active_employee` | `torfabrik_charculogic_active_employee` |
| `charculogic_active_area` | `torfabrik_charculogic_active_area` |
| `charculogic_active_shift` | `torfabrik_charculogic_active_shift` (Legacy) |

Logout (`web/auth.js` → `clearTeamboardTenantStorage`) löscht mandantenspezifische Keys — **kein Bereichs-Leak** beim Mandantenwechsel.

---

## 4. Fehler-Mapping (Operator vs. Telemetrie)

Implementierung: `web/operator-errors.js` — Rohfehler nur in `console.error`, UI ausschließlich deutsche Operatoren-Texte.

| Roh-Signal / Code | Kontext | Operator-Nachricht (Toast/HUD) |
|-------------------|---------|----------------------------------|
| `permission-denied` / `PERMISSION_DENIED` | *alle* | Aktion nicht erlaubt. Fehlende Berechtigung. |
| `unauthenticated` / `UNAUTHENTICATED` | *alle* | Anmeldung abgelaufen. Bitte erneut anmelden. |
| `unavailable` / `network` | *alle* | Netzwerkfehler bei der Übertragung. Der Administrator wurde benachrichtigt. |
| `failed-precondition` | `app-check` | App Check nicht aktiv. Bitte Seite neu laden oder Administrator kontaktieren. |
| `deadline-exceeded` / `timeout` | *alle* | Zeitüberschreitung bei der Anfrage. Bitte erneut versuchen. |
| `resource-exhausted` | *alle* | Zu viele Anfragen. Bitte kurz warten und erneut versuchen. |
| *(beliebig)* | `meat-prices` | Fleischpreis-Aktualisierung fehlgeschlagen. Bitte später erneut versuchen. |
| *(beliebig)* | `delivery-note` | KI-Analyse fehlgeschlagen. Bitte Foto erneut aufnehmen oder manuell erfassen. |
| *(beliebig)* | `sync` | Synchronisation fehlgeschlagen. Daten bleiben in der Warteschlange. |
| *(Fallback)* | *alle* | Ein technischer Fehler ist aufgetreten. Der Administrator wurde benachrichtigt. |

**API:** `logAndMapOperatorError(error, context)` — immer für UI-Toasts verwenden, nie `error.message` direkt anzeigen.

---

## 5. Telemetrie: `/system_errors` (Write-Only)

Clients melden anonymisierte Fehler **nur per Create**. Auswertung über Backend/Admin SDK — **kein Client-Read**.

### 5.1 Erlaubtes Dokument (Client-Payload)

```json
{
  "tenantId": "<request.auth.token.tenantId>",
  "errorCode": "ERR_SYNC_PERMISSION_DENIED",
  "message": "Kurzbeschreibung (< 1000 Zeichen)",
  "timestamp": "<serverTimestamp>",
  "userId": "<optional>",
  "context": "<optional, z. B. sync:tasks · op:update>"
}
```

### 5.2 Firestore Rules (`firebase.rules`)

```javascript
match /system_errors/{document} {
  allow read, update, delete: if false;

  allow create: if request.auth != null
    && request.resource.data.tenantId == request.auth.token.tenantId
    && request.resource.data.keys().hasAll(['tenantId', 'errorCode', 'message', 'timestamp'])
    && request.resource.data.keys().hasOnly(['tenantId', 'errorCode', 'message', 'timestamp', 'userId', 'context'])
    && request.resource.data.errorCode is string
    && request.resource.data.message is string
    && request.resource.data.message.size() < 1000
    && request.resource.data.timestamp == request.time;
}
```

| Constraint | Schutz vor |
|------------|------------|
| `read/update/delete: false` | Token-Scraping, Log-Manipulation |
| `tenantId == token.tenantId` | Cross-Tenant-Spam |
| `keys().hasOnly(…)` | Feld-Injektion |
| `message.size() < 1000` | Payload-Flutung |
| `timestamp == request.time` | Client-seitiges Zeit-Faking |

Client-Flush: `web/sync.js` → `buildSystemErrorDocument()` · `flushErrorTelemetry()`.

---

## 6. Dokumentations-Banner (Corporate Headers)

Jedes Handbuch trägt am Dateianfang ein CD-Banner — siehe:

- `@ANLEITUNG_WHITELABEL_ADMIN.md` — Slate Blue `#2C3E50`
- `@ANLEITUNG_STEVESHOF.md` — Braun `#5D4037` / Orange `#EA580C`
- `@ANLEITUNG_TORFABRIK.md` — Schwarz `#0F172A` / Blau `#1565C0`

---

## 7. Release-Checkliste (Design & UX)

| # | Prüfung |
|---|---------|
| 1 | `TENANT_BRANDING[tenantId]` vollständig — kein unbeabsichtigtes `DEFAULT_BRANDING` |
| 2 | Touch-Targets ≥ 48 px auf neuen Buttons |
| 3 | Neue Schreibpfade mit `inFlight` + `finally` |
| 4 | UI-Fehler über `logAndMapOperatorError` |
| 5 | `npm run build` grün (SW-Version-Guard) |
| 6 | Telemetrie-Flush respektiert `system_errors`-Schema |

---

*CenterLogic Multi-Tenant Design System · Version June 2026*
