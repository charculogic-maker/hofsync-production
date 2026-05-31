# Modulanleitungen – CharcuLogic / CenterLogic / HofSync

Visuelle Anleitungen für alle Hauptbereiche der App (iPhone / PWA). Screenshots zeigen überwiegend die **StevesHof**-Oberfläche; Funktionen sind mandantenübergreifend gleich, einzelne Tabs können pro Betrieb fehlen (z. B. **Prod.** bei TorFabrik).

| Modul | Tab (Leiste) | Details |
|-------|----------------|---------|
| Start & Aufgaben | **Start** | Screenshots `00-start` |
| Team | **Team** | [06-team.md](./06-team.md) |
| MHD-Monitor | **MHD** | [01-mhd-monitor.md](./01-mhd-monitor.md) |
| Wareneingang | **Neu** | [02-wareneingang.md](./02-wareneingang.md) |
| Wurstküche | **Prod.** | [03-wurstkueche.md](./03-wurstkueche.md) *(nur wenn Modul aktiv)* |
| HACCP | **HACCP** | [04-haccp.md](./04-haccp.md) |
| Chargen / Büro | **Büro** | [05-chargen.md](./05-chargen.md) |

## Kollegen-Walkthroughs (Tagesablauf)

| Mandant | Anleitung |
|---------|-----------|
| StevesHof (`StevesHof_Hauptbetrieb`) | [KOLLEGEN_ANLEITUNG_HOFLADEN_APP.md](../KOLLEGEN_ANLEITUNG_HOFLADEN_APP.md) |
| TorFabrik Krefeld (`torfabrik`) | [KOLLEGEN_ANLEITUNG_TORFABRIK.md](../KOLLEGEN_ANLEITUNG_TORFABRIK.md) |

Übersicht: [docs/README.md](../README.md)

Für Entwickler/Tech-Partner (Architektur, Datenmodell, Security-Rules, Cloud Functions, Deployment): [TECHNIK_BACKEND.md](../TECHNIK_BACKEND.md)

## Alle Screenshots

| Datei | Inhalt |
|-------|--------|
| `00-start.png` | Start: Anmeldung, Nachricht des Tages, Aufgaben |
| `07-team.png` | Team: Nachrichten & Bestellungen |
| `01-mhd-monitor.png` | MHD: Filter & Toolbar |
| `01b-mhd-karte.png` | Beispiel-Posten mit Aktionen |
| `01c-mhd-suche-offen.png` | Artikelsuche geöffnet |
| `02-wareneingang-schnell.png` | Neu · Laden |
| `02b-barcode-scanner.png` | Kamera-Scanner |
| `02c-posten-erkannt.png` | EAN erkannt + Postenliste |
| `03-wareneingang-metzgerei.png` | Neu · Metzgerei |
| `03b-lieferschein-fotos.png` | Lieferschein-Vorschau |
| `04-wurstkueche.png` | Prod. · Rezeptliste |
| `04b-rezept-detail.png` | Rezept-Detailansicht |
| `05-haccp.png` | HACCP Produktions-Protokoll |
| `05b-haccp-temperaturen.png` | Tageskontrolle Temperaturen |
| `05c-haccp-reinigung.png` | Tageskontrolle Reinigung |
| `06-chargen.png` | Büro · Rezeptdaten & Suche |
| `06b-chargen-liste.png` | Chargenliste |

## Screenshots neu erzeugen

1. Im Ordner `web/` (PowerShell):

   ```powershell
   cd web
   python -m http.server 5173 --bind 127.0.0.1
   ```

2. Im Browser öffnen: **http://127.0.0.1:5173/index.html** (nicht `http://[::]:5173/` – das führt unter Windows oft zu `ERR_ADDRESS_INVALID`).

3. Im Projektroot: `node tools/capture-module-screenshots.mjs`

Detail-Screenshots nutzen **Beispieldaten** (Demo-Karten, Mock-Listen), wenn Firebase offline ist – für die Schulung reicht das. Mit Live-Daten sehen die Listen in Produktion genauso aus, nur mit echten Einträgen.

Die Übersichts-Screenshots werden **ohne Betriebs-Login-Overlay** erstellt (nur Doku). In Produktion kann zusätzlich der **Betriebs-Login** (PIN auf App-Ebene) erscheinen – danach wie gewohnt unter **Start** mit Mitarbeitername anmelden.
