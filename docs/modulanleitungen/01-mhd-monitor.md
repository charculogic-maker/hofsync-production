# MHD-Monitor

Der Tab **MHD** ist der zentrale Bereich für den täglichen Morgencheck: Welche Ware läuft in den nächsten Tagen ab, muss reduziert oder aus dem Verkauf?

![MHD – Filter und Toolbar](./screenshots/01-mhd-monitor.png)

## Wofür?

- Qualitätssicherung im Hofladen
- Automatische Liste aller Posten mit **MHD im passenden Zeitraum**: MoPro 0-3 Tage, Trockenware 0-21 Tage
- Optional nach **Zeitraum** und **Kategorie** filtern
- Einzelne **Posten** bearbeiten (gleiche Artikel können mehrfach vorkommen)

## Oberfläche

### 1. Filter (Toolbar)

| Element | Funktion |
|---------|----------|
| **Zeitraum** | Auswahl zwischen **0-3**, **0-7**, **0-14** und **0-21 Tagen**; MoPro bleibt bei **0-3**, Trockenware bei **0-21** |
| **Kategorie** | Alle Kategorien oder gezielt: Frische, MoPro, Kühlware, TK, Getränke, Trockenware, Gewürze |

Es gibt keine separaten Filter mehr für **Bereich** oder **Ansicht (ALARM/AKTION)**. Kritische Ware erscheint automatisch, sobald das MHD im gewählten Zeitraum liegt.

### 2. MHD-Karte (Posten)

Jede Karte ist **ein Posten** (eigenes MHD / eigene Lieferung).

![MHD-Karte mit Aktionen](./screenshots/01b-mhd-karte.png)

- **Badge oben**: empfohlene Aktion (z. B. Rabatt, Prüfen, Tonne)
- **Kategorie-Badge oben**: antippen, wenn die Kategorie falsch ist; vor dem Speichern bestätigen wir die Änderung
- **MHD ändern**: korrigiert ein falsch erfasstes MHD nur für diesen Eintrag; vor dem Speichern bestätigen wir die Änderung
- **Menge**: **−** / **+** oder direkt in das Zahlenfeld tippen
- **🗑️ Ausverkauft** oder Wischen nach **links**
- **Aktionen**: **↩️ Raus** · **✓ OK** · **🥣 Küche** · **Box** *(nur StevesHof — Retter-Box vormerken)*
- **Reduziert**: Karte nach **rechts wischen**

### 3. Artikel suchen (optional)

![Suche geöffnet](./screenshots/01c-mhd-suche-offen.png)

1. **🔍 Artikel suchen** antippen
2. Suchbegriff eingeben (z. B. „milch“)
3. Mit **▲ Suche schließen** einklappen – der Kategorie-Filter bleibt aktiv

### 4. Speichern

**💾 Änderungen speichern** – bei aktivem Firebase-Sync werden Änderungen in die Cloud geschrieben.

## Ablauf Morgencheck

1. Tab **MHD** öffnen (beim Laden-iPhone automatisch)
2. Bei Bedarf **Zeitraum** und **Kategorie** wählen
3. Karten der Reihe nach abarbeiten
4. **Änderungen speichern**

## Retter-Box (StevesHof)

Mit **Box** in der MHD-Karte merken wir einen Posten für die heutige **Retter-Box** vor. Die Bestätigung lautet **Zur Retter-Box gelegt**.

**Drucken**, Rezeptvorschlag und Status (**Verkauft** / **Verwerfen**) erledigen wir im **Büro-Bereich** unter **Retter-Boxen** (Admin-Zugang). Am neutralen Laden-iPhone steht nur die **Box**-Aktion zur Verfügung.

## Hinweise

- Die zweite Zeile zeigt **Hersteller / Zusatz** und das echte **MHD-Datum**
- Ohne Firebase-Verbindung erscheint ein Hinweis, dass keine MHD-Daten geladen werden können
