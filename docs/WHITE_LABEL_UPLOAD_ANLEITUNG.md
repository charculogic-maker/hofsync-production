# White-Label Upload-Anleitung

Dokumentations-Übersicht: [README.md](./README.md)

Diese Anleitung beschreibt die zwei Upload-Kanäle, die für spätere White-Label-Mandanten vorbereitet werden sollen:

1. eigene Rezepturen
2. bestehende MHD-Listen

Ziel ist, dass jeder Betrieb seine Daten selbst einlesen kann, ohne dass Rezeptgeheimnisse oder Bestandsdaten zwischen Mandanten vermischt werden. Alle Importe müssen unter dem jeweiligen Mandantenpfad landen:

```text
tenants/{tenantId}/rezepte
tenants/{tenantId}/mhd_liste
```

Aktuelle Mandanten-IDs:

| Betrieb | `tenantId` | Kollegen-Anleitung |
|---------|------------|-------------------|
| StevesHof Hofladen | `StevesHof_Hauptbetrieb` | [KOLLEGEN_ANLEITUNG_HOFLADEN_APP.md](./KOLLEGEN_ANLEITUNG_HOFLADEN_APP.md) |
| TorFabrik Krefeld | `torfabrik` | [KOLLEGEN_ANLEITUNG_TORFABRIK.md](./KOLLEGEN_ANLEITUNG_TORFABRIK.md) |

Beispielpfade:

```text
tenants/StevesHof_Hauptbetrieb/rezepte
tenants/torfabrik/mhd_liste
```

## Grundregeln

- Jeder Upload gehört eindeutig zu genau einem Mandanten.
- Rezept-Uploads dürfen niemals in eine globale Sammlung geschrieben werden.
- Original-Rezeptnamen und Original-IDs bleiben im Dokument gespeichert.
- Firestore-Dokument-IDs werden technisch bereinigt, damit Zeichen wie `/` keinen Pfadfehler auslösen.
- Importierte Daten werden zuerst geprüft, dann gespeichert.
- Fehlerhafte Zeilen werden nicht stillschweigend verworfen, sondern als Importfehler angezeigt.
- Beim Rezeptimport sollen bestehende Rezepturen nicht ungefragt überschrieben werden.

## Upload-Kanal 1: Eigene Rezepte

Dieser Kanal ist für Betriebe gedacht, die ihre eigenen Rezepturen importieren. Das ist besonders sensibel, weil Rezepturen Betriebswissen sind.

### Datenschutz und Mandantenschutz

- Rezeptdaten bleiben ausschließlich im Mandantenpfad.
- Ein White-Label-Kunde sieht nur seine eigenen Rezepte.
- StevesHof-Rezepte dürfen nicht als Demo-Daten für andere Betriebe ausgeliefert werden.
- Für neue Mandanten sollte die App entweder leer starten oder nur neutrale Beispielrezepte verwenden.

### Erwartetes CSV-Format

Eine Rezeptdatei darf mehrere Zeilen pro Rezept enthalten. Jede Zeile beschreibt eine Zutat.

Pflichtspalten:

```text
ID,Name,Kategorie,Basis_g,Zutat,Prozent,Typ,Allergen,Hinweis,Anweisung
```

Spaltenbedeutung:

| Spalte | Bedeutung | Beispiel |
| --- | --- | --- |
| ID | stabile Rezept-ID | Chili-Cheese-Griller |
| Name | Anzeigename in der App | Chili Cheese Griller |
| Kategorie | Rezeptgruppe | Bratwurst, Rohwurst, Kochwurst, Patties |
| Basis_g | Bezugsmenge der Rezeptur | 10000 |
| Zutat | einzelne Zutat | Rindfleisch R II |
| Prozent | Anteil bezogen auf Zielmenge | 35,00 |
| Typ | grobe Einordnung | base, fat, spice, liquid, additive |
| Allergen | TRUE/FALSE | TRUE |
| Hinweis | optionaler Verarbeitungshinweis | kalt zugeben |
| Anweisung | SOP/Herstellhinweis | Fleisch gut kühlen... |

### Validierung vor dem Speichern

Der Import soll je Rezept prüfen:

- ID ist vorhanden.
- Name ist vorhanden.
- Kategorie ist vorhanden.
- Mindestens eine Zutat ist vorhanden.
- Jede Zutat hat einen Namen.
- Jeder Prozentwert ist lesbar.
- Summe der Zutaten ist plausibel.
- Allergenwerte werden auf `true` oder `false` normalisiert.
- Die Firestore-ID wird mit `getSafeFirestoreId(id)` bereinigt.

### Zielstruktur in Firestore

```text
tenants/{tenantId}/rezepte/{safeRecipeId}
```

Beispieldokument:

```json
{
  "id": "G-Bierwurst / G-Bier-Griller",
  "firestoreId": "G-Bierwurst - G-Bier-Griller",
  "name": "G-Bierwurst / G-Bier-Griller",
  "kat": "Bratwurst",
  "basis_g": 10000,
  "allergene": ["SENF"],
  "sop": {
    "vorbereiten": "Rohstoffe auf 0 bis 2 °C kühlen.",
    "verarbeiten": "Fleisch und Fett passend wolfen und bindig mengen.",
    "fertigstellen": "Masse füllen oder portionieren.",
    "kontrolle": "Temperatur, Gewicht und Abweichungen dokumentieren."
  },
  "ingredients": [
    {
      "name": "Rindfleisch R II",
      "pct": 40,
      "typ": "base",
      "allergen": false,
      "hinweis": ""
    }
  ]
}
```

### Empfohlener Ablauf in der App

1. Mandant auswählen oder aus Login ableiten.
2. CSV-Datei auswählen.
3. Vorschau anzeigen: Anzahl Rezepte, Anzahl Zutaten, erkannte Kategorien.
4. Warnungen anzeigen: fehlende Pflichtfelder, doppelte IDs, ungültige Prozentwerte.
5. Importmodus wählen:
   - neue Rezepte ergänzen
   - bestehende Rezepte aktualisieren
   - Testlauf ohne Speichern
6. Daten in `tenants/{tenantId}/rezepte` schreiben.
7. Importprotokoll speichern.

## Upload-Kanal 2: Bestehende MHD-Listen

Dieser Kanal ist für Betriebe gedacht, die bereits mit Excel, Google Sheets, Warenwirtschaft oder Scannerlisten arbeiten.

### Erwartetes CSV-Format

Pflichtspalten:

```text
ID,Barcode,Marke,Produktname,MHD,Menge,kategorie
```

Optionale Spalten:

```text
Zeitstempel,abverkauft,Resttage,old_Marke,old_Produktname
```

Spaltenbedeutung:

| Spalte | Bedeutung | Beispiel |
| --- | --- | --- |
| ID | vorhandene Artikel-ID, sonst automatisch erzeugen | 2ca24651 |
| Barcode | EAN/GTIN ohne Leerzeichen | 8022836008281 |
| Marke | Hersteller oder Marke | SONNENTOR |
| Produktname | Artikelname | Camembert D'Isigny |
| MHD | Mindesthaltbarkeitsdatum | 28.05.2026 |
| Menge | Bestandseinheiten | 3 |
| kategorie | Warengruppe | MoPro, Kühlware, Trockenware |
| abverkauft | optionaler Status | TRUE/FALSE |

### Validierung vor dem Speichern

Der Import soll je Artikel prüfen:

- Barcode enthält nur Ziffern.
- Produktname ist vorhanden.
- MHD ist als Datum lesbar.
- Menge ist eine Zahl.
- Kategorie wird auf App-Kategorien normalisiert.
- Bereits abverkaufte Artikel können optional übersprungen werden.
- Doppelte Kombinationen aus Barcode und MHD werden erkannt.

### Zielstruktur in Firestore

```text
tenants/{tenantId}/mhd_liste/{itemId}
```

Beispieldokument:

```json
{
  "id": "2ca24651",
  "ean": "8022836008281",
  "marke": "",
  "produkt": "Pizzolato Spumante rose alkoholfrei",
  "mhd": "2028-11-01",
  "mhdText": "01.11.2028",
  "menge": 6,
  "kategorie": "Trockenware",
  "status": "aktiv",
  "soldOut": false
}
```

### Empfohlener Ablauf in der App

1. Mandant auswählen oder aus Login ableiten.
2. CSV-Datei auswählen.
3. Vorschau anzeigen: Anzahl Artikel, fällige Artikel, fehlerhafte Zeilen.
4. Spaltenzuordnung bestätigen.
5. Importmodus wählen:
   - Bestand ersetzen
   - Bestand ergänzen
   - nur Stammdaten aktualisieren
   - Testlauf ohne Speichern
6. Daten in `tenants/{tenantId}/mhd_liste` schreiben.
7. Importprotokoll speichern.

## Importprotokoll

Jeder Upload sollte zusätzlich dokumentiert werden:

```text
tenants/{tenantId}/importe/{importId}
```

Empfohlene Felder:

```json
{
  "typ": "recipes",
  "dateiname": "kundenrezepte.csv",
  "status": "completed",
  "zeilenGesamt": 128,
  "geschrieben": 39,
  "fehler": 0,
  "warnungen": 2,
  "erstelltAm": "serverTimestamp",
  "erstelltVon": "userId oder Name"
}
```

## Fehlertexte für die App

- Rezept-ID fehlt.
- Zutat ohne Prozentwert.
- Prozentwert konnte nicht gelesen werden.
- MHD ist kein gültiges Datum.
- Barcode enthält ungültige Zeichen.
- Zeile wurde übersprungen, weil sie bereits als abverkauft markiert ist.
- Import wurde nur geprüft, aber nicht gespeichert.

## Nächste technische Ausbaustufe

Für die App sollten später zwei Upload-Dialoge entstehen:

- `Rezepte importieren`
- `MHD-Liste importieren`

Beide Dialoge brauchen:

- Datei-Auswahl
- CSV-Vorschau
- Spaltenprüfung
- Testlauf
- Importbericht
- Mandantenpfad-Anzeige

