# Dokumentation – CharcuLogic / CenterLogic (White-Label)

> **Diese README:** Zentrale Landkarte für alle Projekt-Dokumente.
> **Zielgruppe:** Team, Betreiber, Admins und Entwicklung, wenn ein passendes Handbuch gesucht wird.
> **Nicht hier:** Vollständige Architekturdetails; diese stehen in [TECHNIK_BACKEND.md](./TECHNIK_BACKEND.md).

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

## Benutzerhandbücher (Rollen-spezifisch)

Professionelle Anleitungen nach Mandant und Zielgruppe:

➡️ [user-manuals/README.md](./user-manuals/README.md)

| Handbuch | Inhalt |
|----------|--------|
| [ANLEITUNG_STEVESHOF.md](./user-manuals/ANLEITUNG_STEVESHOF.md) | Neutraler Laden-iPhone-Zugang, MHD, Laden-Wareneingang inkl. Letzte Eingänge, Prod., Offline |
| [ANLEITUNG_TORFABRIK.md](./user-manuals/ANLEITUNG_TORFABRIK.md) | KI-Lieferschein, Teamboard, Dokumentation |
| [ANLEITUNG_WHITELABEL_ADMIN.md](./user-manuals/ANLEITUNG_WHITELABEL_ADMIN.md) | Mandanten-Onboarding, App Check, Security |
| [STYLE_GUIDE.md](./user-manuals/STYLE_GUIDE.md) | Design System, Tokens, Fehler-Mapping (`@STYLE_GUIDE.md`) |

Cursor-Referenzen: `@ANLEITUNG_STEVESHOF.md` · `@ANLEITUNG_TORFABRIK.md` · `@ANLEITUNG_WHITELABEL_ADMIN.md`

## Gesamtdokumentation App

| Dokument | Zielgruppe | Inhalt |
|----------|------------|--------|
| [APP_DOKUMENTATION.md](./APP_DOKUMENTATION.md) | Alle (technisch) | **Ausführlicher Ist-Stand:** Architektur, Module, Mandanten, Rollen, Sync, Functions, Kunden-Signal, Deployment (Juni 2026) |

## Technik & Betrieb

| Dokument | Zielgruppe | Inhalt |
|----------|------------|--------|
| [TECHNIK_BACKEND.md](./TECHNIK_BACKEND.md) | Entwickler, Admins | Firebase-Projekte, Mandantenisolation, Rules, App Check, Cloud Functions, Build/Deploy, Security-Tests |
| [WHITE_LABEL_UPLOAD_ANLEITUNG.md](./WHITE_LABEL_UPLOAD_ANLEITUNG.md) | Onboarding | CSV-Import Rezepte & MHD pro Mandant |

### Security-Tests (Kurzreferenz)

| Suite | Befehl | Voraussetzung |
|-------|--------|---------------|
| Functions Security (Vitest) | `cd functions && npm run test:security` | Node 20 |
| Staging App-Check-Smoke | `SECURITY_TEST_CALLABLE_BASE_URL=https://europe-west3-<PROJECT>.cloudfunctions.net npm run test:security` (in `functions/`) | Erreichbare Callables |
| Firestore Rules (Emulator) | `npm run test:rules` (Repo-Root) | JDK 21+, Firebase CLI |

Details: [TECHNIK_BACKEND.md §6](./TECHNIK_BACKEND.md#6-automatisierte-security-tests)

## Firebase-Projekte (Hosting)

| Alias (`.firebaserc`) | Projekt-ID | Typische URL |
|----------------------|------------|--------------|
| `default` | `hofsync-production` | Produktion StevesHof |
| `whitelabel` | `charculogic-whitelabel-test` | Test: `charculogic-whitelabel-test.web.app` |

Die App wählt die Firebase-Konfiguration automatisch anhand des Hostnamens (`web/firebase-config.js`).
