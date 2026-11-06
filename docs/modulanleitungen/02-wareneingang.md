# Wareneingang (Tab „Neu“)

Hier erfassen wir **Lieferungen**: Lieferschein-Fotos, Lieferant, Temperatur und die einzelnen **Posten** (Artikel mit MHD).

> **Hinweis:** Der frühere KI-Lieferschein-Flow ist in der Laden-App deaktiviert (Code unter `legacy/`).

## Zwei Bereiche

Oben wählen wir zuerst den **Lieferant** (Weiling, Naturverbund, Stautenhof, Sonstige oder Eigenproduktion). Danach wechseln wir zwischen:

| Modus | Inhalt |
|-------|--------|
| **Laden** | Kategorie, Barcode/EAN, Menge, MHD, Postenliste |
| **Metzgerei** | Waren-Kategorie, Temperatur, Lieferschein-Fotos/PDF |

Speichern-Buttons und **offene Lieferungen** gelten für die ganze Lieferung.

> **StevesHof Hofladen (`StevesHof_Hauptbetrieb`):** Nur der Bereich **Laden** ist aktiv (Metzgerei ausgeblendet). Der **Lieferant** bleibt oben sichtbar. Vor **MHD** und **Neu** wählen wir unser **Profil** (keine PIN). Posten sammeln wir in einer Lieferung und schließen mit **Gesamte Lieferung abschließen** ab. Der **KI-Lieferschein** ist am Laden-iPhone noch **nicht freigeschaltet** — bis dahin gilt der Barcode-Scan unten.

---

## Laden (Schnellerfassung)

![Laden – Barcode und Posten](./screenshots/02-wareneingang-schnell.png)

### Schritte

1. Tab **Neu** → zuerst **Lieferant** wählen (Weiling, Naturverbund, Stautenhof, Sonstige oder Eigenproduktion)
2. **Laden** öffnen und **Kategorie (Laden)** wählen — Frische, MoPro, Kühlware, Aufschnitt, TK, Getränke, Trockenware oder Gewürze
3. **Barcode scannen** (grüner Button) oder **EAN** eintippen und **OK**
4. **Bekannte EAN**: Posten landet sofort als **oberste Karte** in der Liste; das MHD bleibt leer, bis wir es von der Verpackung eintippen (Ausnahme: GS1-Kartoncode mit MHD). Der Scanner bleibt für den nächsten Artikel bereit, sobald wir im Overlay **Fertig** tippen.
5. **Unbekannte EAN**: **Produktname** eintragen, Menge/MHD setzen und **➕ Posten hinzufügen**
6. Optional **Hersteller / Zusatz** ergänzen (erscheint später in der MHD-Ansicht)
7. Auf der Erfassungskarte korrigieren wir bei Bedarf **Menge** (Tap → Nummernpad bzw. VPE +3/+5/+9) und **MHD** (Tap → Datum von der Verpackung als TT.MM.JJJJ) oder entfernen den Posten mit **✕**
8. **💾 Gesamte Lieferung abschließen** — unsere App fragt kurz **Liste nochmals prüfen?** (Übersicht der Posten). Ohne MHD an jedem Posten lässt sich **nicht** abschließen. Mit **Jetzt abschließen** buchen wir sofort, mit **Liste prüfen** springen wir zurück zu den Karten. Fehlt der Lieferant, erscheint zusätzlich ein Auswahl-Pop-up
9. Optional **Letzte Eingänge** — Kategorien nachträglich korrigieren (siehe unten; für alle Nutzer mit Tab **Neu**)
10. Optional **Stammdaten** — nur Büro-/Admin-Zugang (gelernte EANs auf diesem Gerät)

### Kategorie bei Serien-Scans

Die ausgewählte Laden-Kategorie bleibt für den nächsten Scan erhalten. Wer gerade nur MoPro, Frische oder TK-Ware verräumt, muss die Kategorie daher nicht bei jedem Artikel neu auswählen.

Die Kategorie kann jederzeit geändert werden — sie gilt für den nächsten Posten.

Jeder neue Posten erscheint **oben** in der Liste (zuletzt gescannt zuerst), damit wir beim Auspacken nicht nach unten scrollen müssen.

### Letzte Eingänge korrigieren

Über **Letzte Eingänge** werden die zuletzt erfassten Wareneingänge angezeigt. Pro Artikel kann die Kategorie geprüft, per Dropdown geändert und mit **Kategorie speichern** berichtigt werden. Die Änderung wird auch bei schwacher Verbindung synchronisiert.

| Funktion | Zugriff |
|----------|---------|
| **Letzte Eingänge** (Button im Tab **Neu**) | Alle angemeldeten Nutzer mit sichtbarem Tab **Neu** — kein separater Büro-Login |
| **Stammdaten** | Nur Büro-/Admin-Konten |
| **Letzte Eingänge** (Tab **Büro**) | Zusätzlich im Büro-Bereich für Auswertung am Schreibtisch (gleiche Ansicht) |

Test- und Fehleinträge können dort auch **gelöscht** oder über **Posten ansehen** geöffnet werden.

### Scanner

![Barcode-Scanner](./screenshots/02b-barcode-scanner.png)

- Barcode ins **grüne Feld** halten (ca. 15–25 cm Abstand)
- **Umverpackung / Karton:** lange Strichcodes mit Klammern wie `(01)…(15)…(10)…` etwas weiter weg halten (ca. 25–40 cm). Unsere App liest daraus die Artikelnummer und – wenn vorhanden – das MHD.
- Unten: **Eintippen** → Barcode manuell → **OK** (bei Kartons reicht die Zahl unter dem Strichcode bzw. die EAN aus dem `(01)`-Teil)
- Bekannte Artikel werden sofort eingebucht; der Scanner bleibt für den Serien-Scan offen
- Unbekannte Artikel wechseln in die manuelle Erfassung

### Posten erkannt

![EAN erkannt und Posten in der Lieferung](./screenshots/02c-posten-erkannt.png)

- Bekannte EAN: Quittungston und neue Karte ganz oben
- Auf der Karte: Menge tippen, **MHD von der Verpackung** eintippen oder Posten mit **✕** entfernen

---

## KI-Lieferschein (derzeit deaktiviert)

Der frühere KI-Lieferschein-Scan und -Abgleich ist in der Laden-App **ausgeschaltet** (Code unter `legacy/`). Am Laden-iPhone gilt der **Barcode-Serien-Scan** mit manuellem MHD von der Verpackung.

Beim Abschließen legt unsere App jeden Posten mit dem eingetragenen MHD im Tab **MHD** an und schreibt danach den Lieferungsbeleg.

---

## Metzgerei

![Metzgerei – Lieferant und Lieferschein](./screenshots/03-wareneingang-metzgerei.png)

### Schritte

1. Auf **Metzgerei** wechseln
2. **Waren-Kategorie** und **Temperatur (°C)**
3. **📸 Lieferscheine fotografieren / PDF** (mindestens ein Foto oder PDF für Entwurf)
4. **📝 Als offenen Entwurf speichern** – auch ohne Posten (morgens nur dokumentieren)

![Lieferschein-Fotos in der Vorschau](./screenshots/03b-lieferschein-fotos.png)

Mit **×** auf der Miniatur ein Foto wieder entfernen.

Bei Temperatur über 7 °C kann eine **Meister-Freigabe** (PIN) nötig sein.

---

## Lieferung abschließen

1. Oben **Lieferant** wählen (oder beim Abschließen im Pop-up nachholen)
2. Unter **Laden** mindestens einen Posten erfassen
3. Optional unter **Metzgerei** Temperatur und Fotos/PDF pflegen
4. **💾 Gesamte Lieferung abschließen**

## Offene Lieferungen (unten)

- Liste **📋 Offene Lieferungen zur Nachbearbeitung**
- Entwurf antippen → App springt zur Erfassung
- Posten anhand der Fotos nachtragen → **Lieferung abschließen**

## Wichtig

Jeder Wareneingang ist ein **eigener Posten** im Tab **MHD** – neue Lieferung ersetzt nicht automatisch alte Ware mit kurzem MHD.
