# MHD-Monitor

Der Tab **MHD** ist der zentrale Bereich für den täglichen Morgencheck: Welche Ware ist abgelaufen, muss reduziert oder aus dem Verkauf?

![MHD – Filter und Toolbar](./screenshots/01-mhd-monitor.png)

## Wofür?

- Qualitätssicherung im Hofladen
- Übersicht nach **Ansicht** (ALARM, AKTION, ALLE, ERLEDIGT)
- Einzelne **Posten** bearbeiten (gleiche Artikel können mehrfach vorkommen)

## Oberfläche

### 1. Filter (Dropdowns in der Toolbar)

| Feld | Funktion |
|------|----------|
| **Bereich** | Frische & Kühlung oder Trockenware |
| **Ansicht** | ALARM (morgens), AKTION, ALLE, ERLEDIGT |
| **Kategorie** | Nur bei Frische & Kühlung: Alle, Frische, MoPro, Kühlware, TK |

Typische Morgen-Einstellung: **Frische & Kühlung · ALARM · Alle**.

### 2. MHD-Karte (Posten)

Jede Karte ist **ein Posten** (eigenes MHD / eigene Lieferung).

![MHD-Karte mit Aktionen](./screenshots/01b-mhd-karte.png)

- **Badge oben**: empfohlene Aktion (z. B. Rabatt, Prüfen, Tonne)
- **Menge**: **−** / **+** korrigieren
- **🗑️ Ausverkauft** oder Wischen nach **links**
- **Aktionen**: **↩️ Raus** · **✓ OK** · **🥣 Küche**
- **Reduziert**: Karte nach **rechts wischen**

### 3. Artikel suchen (optional)

![Suche geöffnet](./screenshots/01c-mhd-suche-offen.png)

1. **🔍 Artikel suchen** antippen
2. Suchbegriff eingeben (z. B. „milch“)
3. Mit **▲ Suche schließen** einklappen – Filter bleiben aktiv

### 4. Speichern

**💾 Änderungen speichern** – bei aktivem Firebase-Sync werden Änderungen in die Cloud geschrieben.

## Ablauf Morgencheck

1. Tab **MHD** öffnen
2. Filter: **ALARM**, Bereich und Kategorie wählen
3. Karten der Reihe nach abarbeiten
4. Bei Trockenware **Bereich** umstellen und erneut prüfen
5. **Änderungen speichern**

## Hinweise

- **„X aktive Posten“** unter dem Namen = mehrere offene Einträge mit gleichem Barcode
- Ohne Firebase-Verbindung erscheint ein Hinweis, dass keine MHD-Daten geladen werden können
