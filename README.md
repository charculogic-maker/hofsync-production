# CharcuLogic / HofSync – Betriebs-App für Hofläden & Metzgereien

**CharcuLogic** (Produktivsystem: **HofSync**) ist eine touch-optimierte, offline-fähige Betriebs-App für Hofläden, handwerkliche Metzgereien und Lebensmittelproduzenten. Sie deckt MHD-Monitoring, Wareneingang, Wurstküche/Rezeptur, HACCP-Dokumentation, Chargen-Rückverfolgung, Team-Kommunikation und Kundenbestellungen ab.

Das System ist als **White-Label-Lösung mit Mandantentrennung** ausgelegt: Alle Betriebsdaten liegen unter `tenants/{tenantId}/…`, sodass mehrere Betriebe auf derselben Infrastruktur strikt getrennt arbeiten können.

> **Wichtig:** Das Produktivsystem ist die **Web-PWA im Ordner `web/`** (Vanilla-JavaScript + Firebase). Die Datei `lib/main.dart` ist ein **früher Flutter-Designprototyp** (mit fest verdrahtetem `isFirebaseConnected = false`) und **nicht** die ausgelieferte Anwendung.

---

## 🏗️ Architektur im Überblick

| Schicht | Technologie | Ort |
|---------|-------------|-----|
| Frontend | Progressive Web App, Vanilla-JS (ES-Module), kein Build-Step | `web/` |
| Auth & Mandant | Firebase Authentication (E-Mail/Passwort + Custom Token), Tenant + Rolle aus Claims/Profil | `web/auth.js` |
| Datenbank | Cloud Firestore (Live-Sync via `onSnapshot`) | Projekt `hofsync-production` |
| Datei-Uploads | Firebase Storage (Bulletin-Anhänge, Bestellzettel) | `tenants/{tenantId}/…` |
| Offline | Service Worker + lokale Sync-Warteschlange (Dead-Letter-Queue) | `web/sw.js`, `web/sync.js` |
| Backend | Cloud Functions (Node 20, `firebase-functions` v2) | `functions/` |
| KI | Gemini + Google-Search-Grounding für Wochen-Fleischpreise | `functions/meatPrices.js` |
| Sicherheit | Firestore- & Storage-Security-Rules (mandanten- und rollenbasiert) | `firebase.rules`, `storage.rules` |

**Technische Details, Datenmodell, Rollen-/Rechtemodell, Cloud Functions und Deployment:**
➡️ [docs/TECHNIK_BACKEND.md](docs/TECHNIK_BACKEND.md)

---

## 📁 Projektstruktur

```
craft_food_app/
├── web/                          # Produktiv-PWA (Hosting-Root)
│   ├── index.html                # App-Shell, alle Tab-Seiten
│   ├── style.css                 # Hochkontrast-CSS, große Touch-Targets
│   ├── sw.js                     # Service Worker (PWA, Offline-Cache)
│   ├── app.js                    # Bootstrap & Orchestrierung aller Module
│   ├── auth.js                   # Login, Mandant (tenantId), Rolle/Admin
│   ├── sync.js                   # Offline-Sync-Queue, writeFirestoreDocOrQueue
│   ├── mhd.js                    # MHD-Monitor + Wareneingang
│   ├── production.js             # Wurstküche: Rezepte, Produktion, Chargen
│   ├── beffe_calc.js             # WRS-Kalkulation (BEFFE/Kosten-Engine)
│   ├── haccp.js                  # HACCP-Protokolle & Tageskontrollen
│   ├── teamboard.js              # Tab „Start": Aufgaben, Schwarzes Brett
│   ├── team-tab.js               # Tab „Team": Container
│   ├── customer-orders.js        # Kundenbestellungen
│   ├── team-config.js            # Team-Gruppen, Push-Registrierung
│   ├── team-notify.js            # Push-/Notify-Logik (Client)
│   ├── scanner.js                # Barcode-/EAN-Scanner (Kamera)
│   ├── date-input.js             # Deutsche Datumseingaben
│   └── libs/                     # Gevendorte Libs (Firebase SDK, Scanner)
├── functions/                    # Cloud Functions (Backend)
│   ├── index.js                  # Einstieg, Funktions-Exports
│   ├── meatPrices.js             # Gemini-Fleischpreislauf (Scheduler)
│   ├── teamPush.js               # Push bei neuer Team-Aufgabe (Trigger)
│   └── package.json              # Node 20, Abhängigkeiten
├── firebase.rules                # Firestore-Security-Rules (DEPLOYT)
├── storage.rules                 # Storage-Security-Rules
├── firebase.json                 # Hosting/Functions/Rules-Konfiguration
├── .firebaserc                   # Default-Projekt (hofsync-production)
├── firestore.rules               # ⚠️ Veralteter Spiegel – wird NICHT deployt
├── lib/main.dart                 # Legacy-Flutter-Designprototyp (nicht produktiv)
├── data/                         # Stammdaten, CSV-Importvorlagen, SOPs
└── docs/                         # Anleitungen & technische Doku
```

---

## 🧩 Module / Tabs

Die untere Navigationsleiste der App umfasst sieben Bereiche:

| Tab (Leiste) | Bereich | Code | Funktion |
|--------------|---------|------|----------|
| **Start** | Teamboard | `teamboard.js` | Mitarbeiter-Anmeldung (Name + PIN), Nachricht des Tages, Aufgaben, Historie |
| **Team** | Team-Hub | `team-tab.js`, `customer-orders.js`, `team-config.js` | Nachrichten, Push, Kundenbestellungen |
| **MHD** | MHD-Monitor | `mhd.js` | Täglicher Morgencheck, Postenbearbeitung, Suche |
| **Neu** | Wareneingang | `mhd.js` | Laden-Schnellerfassung & Metzgerei-Lieferungen, Scanner, Fotos |
| **Prod.** | Wurstküche | `production.js`, `beffe_calc.js` | Rezepte, Produktion, WRS-Kalkulation |
| **HACCP** | HACCP | `haccp.js` | Produktionsprotokoll, Temperatur-/Reinigungskontrollen |
| **Büro** | Chargen & Leitstand | `production.js`, `teamboard.js`, `team-config.js` | Rückverfolgung, Nachricht veröffentlichen, Team-Konfiguration (Admin) |

---

## 📱 Touch-Optimierung („Wet Finger"-Regel)

1. **Große Touch-Targets** für zuverlässiges Tippen mit feuchten Händen oder Handschuhen.
2. **Breite Tasten-Abstände** gegen Fehleingaben („Fat-Fingering").
3. **One-Hand-Ergonomie**: primäre Aktionen und Navigation im unteren Bildschirmdrittel.
4. **Taktiles Audio-Feedback** über die Web Audio API als künstliche Haptik.
5. **Dark Mode** mit System-Voreinstellung und manuellem Umschalter.

---

## 🚀 Lokal starten

Die App ist ein statisches PWA-Frontend ohne Build-Step. Für lokale Tests einen einfachen Webserver im Ordner `web/` starten:

```powershell
cd web
python -m http.server 5173 --bind 127.0.0.1
```

Dann **http://127.0.0.1:5173/index.html** öffnen (nicht `http://[::]:5173/` – das führt unter Windows oft zu `ERR_ADDRESS_INVALID`).

> Hinweis: Funktionen mit echten Mandantendaten erfordern eine gültige Firebase-Anmeldung. Ohne Login erscheint das Betriebs-Login-Overlay.

---

## ☁️ Deployment (Kurzfassung)

Voraussetzung: Firebase CLI installiert und am Projekt `hofsync-production` angemeldet.

```bash
firebase deploy --only hosting                 # PWA (web/)
firebase deploy --only functions               # Cloud Functions
firebase deploy --only firestore:rules         # Firestore-Rules (firebase.rules)
firebase deploy --only storage                 # Storage-Rules
```

Details, Secrets (z. B. `GEMINI_API_KEY`) und Fallstricke: ➡️ [docs/TECHNIK_BACKEND.md](docs/TECHNIK_BACKEND.md)

---

## 📚 Dokumentation

| Dokument | Inhalt |
|----------|--------|
| [docs/KOLLEGEN_ANLEITUNG_HOFLADEN_APP.md](docs/KOLLEGEN_ANLEITUNG_HOFLADEN_APP.md) | Tagesablauf-Walkthrough für das Team |
| [docs/modulanleitungen/README.md](docs/modulanleitungen/README.md) | Visuelle Modulanleitungen (mit Screenshots) |
| [docs/WHITE_LABEL_UPLOAD_ANLEITUNG.md](docs/WHITE_LABEL_UPLOAD_ANLEITUNG.md) | CSV-Import für Rezepte & MHD-Listen (Mandanten-Onboarding) |
| [docs/TECHNIK_BACKEND.md](docs/TECHNIK_BACKEND.md) | Architektur, Datenmodell, Rules/Admin-Modell, Cloud Functions, Deployment |

CSV-Vorlagen für den White-Label-Import:

- [rezept_import_v1.csv](data/import_templates/rezept_import_v1.csv)
- [mhd_import_v1.csv](data/import_templates/mhd_import_v1.csv)
