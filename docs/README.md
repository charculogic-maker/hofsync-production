# Dokumentation – CharcuLogic / CenterLogic (White-Label)

Übersicht aller Anleitungen und technischen Unterlagen im Projekt.

## Kollegen-Anleitungen (nach Mandant)

| Mandant | `tenantId` | App-Anzeige | Walkthrough |
|---------|------------|-------------|-------------|
| **StevesHof Hofladen** | `StevesHof_Hauptbetrieb` | CharcuLogic | [KOLLEGEN_ANLEITUNG_HOFLADEN_APP.md](./KOLLEGEN_ANLEITUNG_HOFLADEN_APP.md) |
| **TorFabrik Krefeld** | `torfabrik` | CenterLogic | [KOLLEGEN_ANLEITUNG_TORFABRIK.md](./KOLLEGEN_ANLEITUNG_TORFABRIK.md) |

Weitere Mandanten folgen dem gleichen Muster: eigene Kollegen-Anleitung + Einträge in `web/branding.js` und `web/team-config.js`.

## Modulanleitungen (Screenshots)

Visuelle Detail-Doku zu einzelnen Tabs (überwiegend am StevesHof-UI aufgenommen, Inhalte sind mandantenübergreifend vergleichbar):

➡️ [modulanleitungen/README.md](./modulanleitungen/README.md)

## Technik & Betrieb

| Dokument | Zielgruppe | Inhalt |
|----------|------------|--------|
| [TECHNIK_BACKEND.md](./TECHNIK_BACKEND.md) | Entwickler, Admins | Firebase-Projekte, Datenmodell, Rules, Cloud Functions, Deploy |
| [WHITE_LABEL_UPLOAD_ANLEITUNG.md](./WHITE_LABEL_UPLOAD_ANLEITUNG.md) | Onboarding | CSV-Import Rezepte & MHD pro Mandant |

## Firebase-Projekte (Hosting)

| Alias (`.firebaserc`) | Projekt-ID | Typische URL |
|----------------------|------------|--------------|
| `default` | `hofsync-production` | Produktion StevesHof |
| `whitelabel` | `charculogic-whitelabel-test` | Test: `charculogic-whitelabel-test.web.app` |

Die App wählt die Firebase-Konfiguration automatisch anhand des Hostnamens (`web/firebase-config.js`).
