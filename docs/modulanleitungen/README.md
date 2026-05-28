# Modulanleitungen – CharcuLogic / HofSync

Visuelle Anleitungen für alle Hauptbereiche der App (Hofladen-iPhone und Büro).

| Modul | Tab | Übersicht | Details |
|-------|-----|-----------|---------|
| MHD-Monitor | 📅 MHD-Monitor | [01-mhd-monitor.md](./01-mhd-monitor.md) | Karte, Suche |
| Wareneingang | 📥 Eingang | [02-wareneingang.md](./02-wareneingang.md) | Scanner, Posten, Fotos |
| Wurstküche | 🥣 Wurstküche | [03-wurstkueche.md](./03-wurstkueche.md) | Rezept-Detail |
| HACCP | 🛡️ HACCP | [04-haccp.md](./04-haccp.md) | Temperaturen, Reinigung |
| Chargen | 📋 Chargen | [05-chargen.md](./05-chargen.md) | Chargenliste |

Kurzüberblick Tagesbetrieb: [KOLLEGEN_ANLEITUNG_HOFLADEN_APP.md](../KOLLEGEN_ANLEITUNG_HOFLADEN_APP.md)

## Alle Screenshots

| Datei | Inhalt |
|-------|--------|
| `00-start.png` | Start-Tab mit Login, Schwarzes Brett und Aufgaben |
| `01-mhd-monitor.png` | Filter & Toolbar |
| `01b-mhd-karte.png` | Beispiel-Posten mit Aktionen |
| `01c-mhd-suche-offen.png` | Eingeklappte Suche geöffnet |
| `02-wareneingang-schnell.png` | Schnellerfassung |
| `02b-barcode-scanner.png` | Kamera-Scanner |
| `02c-posten-erkannt.png` | EAN erkannt + Postenliste |
| `03-wareneingang-metzgerei.png` | Metzgerei-Kopf |
| `03b-lieferschein-fotos.png` | Lieferschein-Vorschau |
| `04-wurstkueche.png` | Rezeptliste & Skalierer |
| `04b-rezept-detail.png` | Rezept-Detailansicht |
| `05-haccp.png` | Produktions-Protokoll |
| `05b-haccp-temperaturen.png` | Tageskontrolle Temperaturen |
| `05c-haccp-reinigung.png` | Tageskontrolle Reinigung |
| `06-chargen.png` | Rezeptdaten-Prüfung |
| `06b-chargen-liste.png` | Chargenliste |

## Screenshots neu erzeugen

1. `cd web` → `python -m http.server 5173`
2. Im Projektroot: `node tools/capture-module-screenshots.mjs`

Detail-Screenshots nutzen **Beispieldaten** (Demo-Karten, Mock-Listen), wenn Firebase offline ist – für die Schulung reicht das. Mit Live-Daten sehen die Listen in Produktion genauso aus, nur mit echten Einträgen.

Die Übersichts-Screenshots werden **ohne Login-Overlay** erstellt (nur Doku). In Produktion erscheint zuerst der **Betriebs-Login**.
