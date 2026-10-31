# Navigation – HofSync / CharcuLogic (Teststand)

> **Stand:** Oktober 2026 (nach Nav-Cleanup: eine Admin-Tür pro Viewport).  
> **Zielgruppe:** neue Mandanten, Kollegen, Admins — schnelle Orientierung „wo finde ich was?“.

## Kurz-Cheat-Sheet

```text
Primär (Fußleiste):  MHD · Neu · Packtisch · Herkunft · Mehr
Mehr:                Start · Team · HACCP · Prod. · Etiketten · Auskunft
⚙️ mobil / Admin desktop (nur Büro/Admin):
                     Büro · Chargen · Retter-Box · Verwaltung
Thekenklade:         Herkunft → Thekenklade   (Deep-Link /#thekenbuch)
```

Welche Tabs ein Betrieb und eine Rolle wirklich sehen, steuert  
`enabledModules` ∩ `role_modules` ∩ `allowedModules` — Details: [CLAIMS_TABS_MAPPING.md](./CLAIMS_TABS_MAPPING.md).

## Primärtabs (Laden-Alltag)

| Tab | Zweck | Modulanleitung |
|-----|--------|----------------|
| **MHD** | Haltbarkeiten, Retter-Box vormerken | [01-mhd-monitor.md](./modulanleitungen/01-mhd-monitor.md) |
| **Neu** | Wareneingang (Barcode) | [02-wareneingang.md](./modulanleitungen/02-wareneingang.md) |
| **Packtisch** | Kundenbestellungen zusammenstellen | [06-team.md](./modulanleitungen/06-team.md) (Bestellungen) |
| **Herkunft** | LMIV-Erfassung + **Thekenklade** | [07-herkunft.md](./modulanleitungen/07-herkunft.md) |
| **Mehr** | Overflow für seltener genutzte Alltagsthemen | — |

## Unter Mehr

| Eintrag | Zweck | Hinweis |
|---------|--------|---------|
| **Start** | Teamboard / Schwarzes Brett | oft mandantenspezifisch aus |
| **Team** | Team-Hub | oft mandantenspezifisch aus |
| **HACCP** | Temperaturen & Reinigung | [04-haccp.md](./modulanleitungen/04-haccp.md) |
| **Prod.** | Rezepte, Produktion, WRS | [03-wurstkueche.md](./modulanleitungen/03-wurstkueche.md) |
| **Etiketten** | Avery-Zerlegeetiketten | — |
| **Auskunft** | Theken-Auskunft (Allergene/Zutaten) + Fleisch-Lexikon | früher „Wissen“ / Admin-Header |

## Admin (⚙️ mobil · Sidebar desktop)

Nur für **Büro-/Admin-Konten** (`isOfficeUser`). Am Smartphone: Zahnrad oben rechts. Am Desktop: Bereich **Admin** in der linken Leiste (kein paralleles Header-⚙️).

| Eintrag | Zweck |
|---------|--------|
| **Büro · Chargen** | Produktionschargen, Leitstand, Stammdaten | [05-chargen.md](./modulanleitungen/05-chargen.md) |
| **Retter-Box** | Vormerken / Drucken / Verkaufen (wenn freigeschaltet) |
| **Verwaltung** | `/dev-dashboard` — Übersicht, Nutzer, Mein Betrieb, Protokoll (+ Plattform für Super-Admin) |

**Nicht** mehr im ⚙️-Menü: HACCP, Auskunft, Thekenklade (liegen unter Mehr bzw. Herkunft).

## Verwaltung (`/dev-dashboard`)

Tabs: **Übersicht · Nutzer · Mein Betrieb · Protokoll** (plus Plattform für Super-Admin).

Auf der **Übersicht** gibt es Sprungmarken z. B. zur Thekenklade (`/#thekenbuch`), Retter-Box und Theken-Auskunft. Es gibt **keinen** eigenen Tab „Rückverfolgbarkeit“ mehr — die Digitale Thekenklade liegt unter **Herkunft → Thekenklade**.

## Weiterlesen

| Rolle | Einstieg |
|-------|----------|
| Kollegen am Laden-iPhone | [KOLLEGEN_ANLEITUNG_HOFLADEN_APP.md](./KOLLEGEN_ANLEITUNG_HOFLADEN_APP.md) · [KOLLEGEN_ANLEITUNG_TORFABRIK.md](./KOLLEGEN_ANLEITUNG_TORFABRIK.md) |
| StevesHof Handbuch | [user-manuals/ANLEITUNG_STEVESHOF.md](./user-manuals/ANLEITUNG_STEVESHOF.md) |
| Neuer Mandant / Admin | [user-manuals/ANLEITUNG_WHITELABEL_ADMIN.md](./user-manuals/ANLEITUNG_WHITELABEL_ADMIN.md) |
| Technik & Ist-Stand | [APP_DOKUMENTATION.md](./APP_DOKUMENTATION.md) · [TECHNIK_BACKEND.md](./TECHNIK_BACKEND.md) |
| Doc-Landkarte | [README.md](./README.md) |
