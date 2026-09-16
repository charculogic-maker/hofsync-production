# HofSync / CharcuLogic – Produktportfolio

> **Stand:** August 2026  
> **Zielgruppe:** Vertrieb, Partner, Mandanten-Onboarding, Produktentscheidungen  
> **Produktivsystem:** Progressive Web App (`web/`) + Firebase Cloud Functions  
> **Technische Vertiefung:** [APP_DOKUMENTATION.md](./APP_DOKUMENTATION.md) · [TECHNIK_BACKEND.md](./TECHNIK_BACKEND.md)

Dieses Portfolio beschreibt die **verkaufs- und paketierbaren Bausteine** der Plattform – nicht den Code. Module lassen sich pro Betrieb (Mandant) freischalten; Branding, App-Name und Farben sind White-Label.

---

## 1. Plattform auf einen Blick

| | |
|---|---|
| **Plattformname** | **HofSync** (Infrastruktur / White-Label) |
| **Markennamen am Betrieb** | z. B. **CharcuLogic** (StevesHof), **CenterLogic** (TorFabrik) |
| **Produktart** | Touch-optimierte Betriebs-App (PWA) für Laden-iPhone & Büro |
| **Zielbranchen** | Hofläden, handwerkliche Metzgereien, Thekenbetriebe, Lebensmittelproduktion |
| **Kernversprechen** | Alltag am Laden digitalisieren – MHD, Wareneingang, Herkunft, Produktion, HACCP, Team – offline-fähig und mandantensicher |

### Was die Plattform löst

| Problem im Betrieb | Lösung |
|--------------------|--------|
| Papier-Listen und Zettelwirtschaft | Digitale MHD-, Herkunfts- und Chargen-Erfassung am Laden-iPhone |
| Feuchte Hände / Handschuhe | Große Touch-Flächen, One-Hand-Ergonomie („Wet Finger“) |
| Mehrere Betriebe auf einer Infrastruktur | Strikte Mandantentrennung (`tenants/{tenantId}/…`) |
| Eigenes Erscheinungsbild | White-Label: Name, Farben, Logo, Modul-Set |
| Schlechte Netzabdeckung | Offline-Cache + Sync-Warteschlange |
| Büro vs. Theke | Rollen `admin` / `employee` / `helper` mit klarer UI-Trennung |

---

## 2. Zielgruppen & typische Profile

| Profil | Typische Bedarfe | Empfohlenes Paket |
|--------|------------------|-------------------|
| **Hofladen / Direktvermarktung** | Morgencheck MHD, schneller Wareneingang, Herkunft am Tresen, ggf. Wurstküche | [Hofladen-Alltag](#41-paket-hofladen-alltag) |
| **Handwerksmetzgerei / Produktion** | Rezepte, Chargen, WRS-Kalkulation, HACCP, Büro-Leitstand | [Produktion & Küche](#42-paket-produktion--küche) |
| **Theke / Team-Betrieb** | Schicht-PIN, Aufgaben, Bestellungen, Push, Dokumentation | [Theke & Team](#43-paket-theke--team) |
| **Multi-Standort / Franchise-ähnlich** | Isolierte Daten, eigenes Branding, zentrales Hosting | [White-Label Plattform](#44-paket-white-label-plattform) |

---

## 3. Modulportfolio (Bausteine)

Jedes Modul ist einzeln freischaltbar (Branding-Flags + optional Runtime `enabledModules` im Dev-Dashboard).

### 3.1 Alltag am Laden (Bottom-Navigation)

| Modul | Tab | Nutzen | Typische Nutzer |
|-------|-----|--------|-----------------|
| **MHD-Monitor** | MHD | Haltbarkeiten prüfen; Aktionen OK / Raus / Küche / Ausverkauft; Suche & Barcode | Laden-Team |
| **Wareneingang** | Neu | Schnellerfassung (Kategorien, EAN, MHD); Letzte Eingänge korrigieren; optional Metzgerei-Modus | Laden / Wareneingang |
| **Herkunft (LMIV)** | Herkunft | Etikettfoto + Charge/LOT + Herkunftsfelder; Digitale Thekenklade für Admins | Theke + Büro |
| **Wurstküche** | Prod. | Rezepte, Produktionserfassung, Chargen, WRS-/BEFFE-Kalkulation | Produktion / Büro |
| **Teamboard** | Start | PIN-/Profil-Anmeldung, Nachricht des Tages, Aufgaben, Historie | Schichtbetrieb |
| **Team-Hub** | Team | Nachrichten, Push, Kundenbestellungen (wenn aktiv) | Team + Büro |

### 3.2 Admin- & Büro-Module (Header / Dev-Dashboard)

| Modul | Zugang | Nutzen |
|-------|--------|--------|
| **HACCP** | Admin-Menü | Temperaturen, Reinigungs-Checklisten, Geräte-Setup |
| **Wissen / Cuts** | Admin-Menü | Lexikon / Cut-Glossar (optional) |
| **Büro / Chargen** | Admin-Menü | Chargen-Archiv, Leitstand, Team-Konfiguration |
| **Chargen-Doku (Thekenbuch)** | Laden-Alltag (wenn freigeschaltet) | Operative Chargen-Dokumentation am Tresen |
| **Dev-Dashboard** | `/dev-dashboard` (nur `admin`) | Modul-Toggles, Mitarbeiter, Digitale Thekenklade |

### 3.3 Add-ons & Intelligenz

| Add-on | Beschreibung | Status / Hinweis |
|--------|--------------|------------------|
| **Retter-Box** | Angebote für Ware kurz vor MHD | z. B. StevesHof |
| **KI-Lieferschein** | Gemini-OCR → Bestand / Inventar | z. B. TorFabrik (`parseDeliveryNote`) |
| **KI-Fleischpreise** | Wöchentliche Marktpreise für WRS-Kalkulation | Scheduler + manueller Trigger (Büro) |
| **Barcode-Scanner** | Kamera-EAN für MHD & Wareneingang | Kernfunktion, PWA |
| **Kundenbestellungen** | Bestellaufnahme + Benachrichtigungen | Modul `orders` / Team |
| **Kunden-Signal** | Abholbenachrichtigung (E-Mail/SMS) | Backend vorbereitet |
| **Push / Team-Notify** | Benachrichtigung bei neuen Aufgaben | Teamboard-Ökosystem |

---

## 4. Empfohlene Pakete

Pakete sind **Konfigurationsprofile**, keine getrennten Codebases. Freischaltung über `web/branding.js` und optional `tenants/{tenantId}.enabledModules`.

### 4.1 Paket „Hofladen-Alltag“

**Ziel:** Morgens MHD, tagsüber Wareneingang und Herkunft – minimaler Schulungsaufwand.

| Enthalten | Optional |
|-----------|----------|
| MHD-Monitor | Retter-Box |
| Wareneingang (Laden) | Herkunft / LMIV |
| Offline & Sync | Wurstküche / Prod. |
| Rollen Employee / Helper | HACCP (Admin) |

**Referenz:** StevesHof – Alltagstabs MHD · Neu · Herkunft · Prod.; Terminal ohne PIN-Kartenchaos.

### 4.2 Paket „Produktion & Küche“

**Ziel:** Rezepttreue, Kostenkontrolle und Chargen-Nachweis.

| Enthalten | Optional |
|-----------|----------|
| Wurstküche / Prod. | Rezept-Audit |
| WRS-/BEFFE-Kalkulation | Bratwurst-Masterliste |
| Chargen / Büro | KI-Fleischpreis-Update |
| HACCP | Wissen / Cuts |

### 4.3 Paket „Theke & Team“

**Ziel:** Schichtbetrieb mit Aufgaben, Kommunikation und Bestellungen.

| Enthalten | Optional |
|-----------|----------|
| Teamboard (Start) | Kundenbestellungen |
| Team-Hub | HACCP-Tageskontrollen |
| Mitarbeiter-PIN | KI-Lieferschein |
| MHD + Wareneingang | Herkunft / Thekenklade |

**Referenz:** TorFabrik (CenterLogic) – Teamboard, Team, Bestellungen, KI-Lieferschein; ohne Wurstküche.

### 4.4 Paket „White-Label Plattform“

**Ziel:** Eigener Betrieb unter eigener Marke auf gemeinsamer Infrastruktur.

| Leistung | Inhalt |
|----------|--------|
| **Mandant** | Eigene `tenantId`, isolierte Firestore-/Storage-Pfade |
| **Branding** | App-Name, Betriebsname, Farben, Logo, PWA-Manifest |
| **Module** | Individuelles Modul-Set (siehe §3) |
| **Rollen** | Admin / Employee / Helper + Claims |
| **Sicherheit** | App Check, Security Rules, Callable-Guards |
| **Onboarding** | CSV-Import MHD/Rezepte, Admin-Handbuch |

Setup-Leitfaden: [WHITELABEL-SETUP.md](../WHITELABEL-SETUP.md) · [ANLEITUNG_WHITELABEL_ADMIN.md](./user-manuals/ANLEITUNG_WHITELABEL_ADMIN.md)

---

## 5. Plattformfähigkeiten (übergreifend)

| Fähigkeit | Kurzbeschreibung |
|-----------|------------------|
| **PWA / Laden-iPhone** | Homescreen-App, touch-first, Dark Mode |
| **Offline-First** | Service Worker + Sync-Queue; freundliche Offline-Hinweise |
| **Live-Sync** | Firestore `onSnapshot` bei Verbindung |
| **Multi-Tenant** | Absolute Datentrennung; keine cross-tenant Queries |
| **RBAC** | UI-Guards + Rules + Callable-Auth (`authContext`) |
| **White-Label** | Eine Codebasis, viele Betriebsgesichter |
| **Operator-UX** | Deutsche Toasts; Technikfehler nur in der Konsole |
| **Security-Baseline** | App Check Pflicht für Callables; Security-Tests |

---

## 6. Referenzmandanten (Ist-Stand)

| Mandant | Marke | Schwerpunkt | Hosting-Kontext |
|---------|-------|-------------|-----------------|
| **StevesHof Hofladen** (`StevesHof_Hauptbetrieb`) | CharcuLogic | MHD, Neu, Herkunft, Prod., Retter-Box, Chargen | Produktion (`hofsync-production`) |
| **TorFabrik Krefeld** (`torfabrik`) | CenterLogic | Teamboard, Team/Bestellungen, HACCP, KI-Lieferschein | Whitelabel-Test |
| **Whitelabel Testbetrieb** | CharcuLogic Test | Schlankes Terminal-Profil | Test |

Details: [APP_DOKUMENTATION.md §5–6](./APP_DOKUMENTATION.md)

---

## 7. Modulmatrix (Freischaltung)

| Modul-Flag / Key | Sichtbarer Bereich |
|------------------|--------------------|
| `mhdMonitor` / `mhd` | Tab **MHD** |
| `wareneingang` / `receiving` | Tab **Neu** |
| `wareneingangMetzgerei` | Metzgerei-Untermodus Wareneingang |
| `traceability` / Herkunft | Tab **Herkunft** + Thekenklade |
| `wurstkueche` / `kitchen` | Tab **Prod.** |
| `teamboard` / `start` | Tab **Start** |
| `team` (+ ggf. `orders`) | Tab **Team** / Bestellungen |
| `haccp` | Admin **HACCP** |
| `knowledge` / `cutGlossary` | Admin **Wissen** |
| `batches` / `buero` | Admin **Büro** |
| `chargenDoku` | Chargen-Doku / Thekenbuch |
| `retterBox` | Retter-Box im MHD |
| `employeePin` / `employeeAuth` | PIN vs. Profil vs. Firebase-Auth |

---

## 8. Abgrenzung der Produktnamen

| Name | Bedeutung |
|------|-----------|
| **HofSync** | Plattform / Produktiv-Infrastruktur (Firebase-Projekt, White-Label-Basis) |
| **CharcuLogic** | Betriebsmarke / App-Name (u. a. StevesHof) |
| **CenterLogic** | Betriebsmarke TorFabrik |
| **Dev-Dashboard** | Mandanten-Admin-Oberfläche – nicht für Laden-Alltag |

---

## 9. Weiterführende Dokumente

| Dokument | Nutzen |
|----------|--------|
| [docs/README.md](./README.md) | Dokumenten-Landkarte |
| [modulanleitungen/](./modulanleitungen/README.md) | Visuelle Modul-Anleitungen |
| [KOLLEGEN_ANLEITUNG_HOFLADEN_APP.md](./KOLLEGEN_ANLEITUNG_HOFLADEN_APP.md) | Tagesablauf StevesHof |
| [KOLLEGEN_ANLEITUNG_TORFABRIK.md](./KOLLEGEN_ANLEITUNG_TORFABRIK.md) | Tagesablauf TorFabrik |
| [user-manuals/](./user-manuals/README.md) | Rollen-Handbücher |
| [TECHNIK_BACKEND.md](./TECHNIK_BACKEND.md) | Architektur, Rules, Deployment |

---

*Portfolio-Inhalt spiegelt den dokumentierten Ist-Stand der Module und Mandantenprofile wider. Neue Module oder Pakete hier und in `web/branding.js` / `enabledModules` parallel nachziehen.*
