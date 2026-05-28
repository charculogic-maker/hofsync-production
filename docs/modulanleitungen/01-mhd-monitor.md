# MHD-Monitor

Der **MHD-Monitor** ist der zentrale Tab für den täglichen Morgencheck: Welche Ware ist abgelaufen, muss reduziert oder aus dem Verkauf?

![MHD-Monitor – Filter und Toolbar](./screenshots/01-mhd-monitor.png)

## Wofür?

- Qualitätssicherung im Hofladen
- Übersicht nach **Dringlichkeit** (ALARM, AKTION, …)
- Einzelne **Posten** bearbeiten (nicht nur Produkte – gleiche Artikel können mehrfach vorkommen)

## Oberfläche

### 1. Filter (Dropdowns)

| Feld | Funktion |
|------|----------|
| **Bereich** | Frische & Kühlung oder Trockenware |
| **Ansicht** | ALARM (morgens), AKTION, ALLE, ERLEDIGT |
| **Kategorie** | Nur bei Frische & Kühlung: Alle, Frische, MoPro, Kühlware, TK |

Typische Morgen-Einstellung: **Frische & Kühlung · Alle · ALARM**.

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

Für den Morgencheck meist nicht nötig – bei langen Listen oder gezielter Suche:

1. **🔍 Artikel suchen** antippen
2. Suchbegriff eingeben (z. B. „milch“)
3. Mit **▲ Suche schließen** einklappen – Filter bleibt aktiv

### 4. Speichern

**💾 Änderungen speichern** – bei aktivem Firebase-Sync werden Änderungen in die Cloud geschrieben.

## Ablauf Morgencheck

1. Tab **MHD-Monitor** öffnen
2. Filter: **ALARM**, Bereich und Kategorie wählen
3. Karten der Reihe nach abarbeiten
4. Bei Trockenware **Bereich** umstellen und erneut prüfen

## Hinweise

- **„3 aktive Posten“** unter dem Namen = mehrere offene Einträge mit gleichem Barcode
- Ohne Firebase-Verbindung erscheint ein Hinweis, dass keine MHD-Daten geladen werden können
