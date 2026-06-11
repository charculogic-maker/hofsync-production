# HACCP

Dokumentation für Produktion (pH, Kerntemperatur, Charge) und **tägliche Betriebskontrollen** (Temperaturen, Reinigung, Kühlstellen).

![HACCP – Produktions-Protokoll](./screenshots/05-haccp.png)

## Bereich 1: Produktions-Protokoll (oben)

Für einzelne Chargen / Produktionsschritte:

| Feld | Bedeutung |
|------|-----------|
| **Kerntemperatur** | Garziel u. a. > 72 °C |
| **pH-Wert** | Slider 4,0 – 7,0 (optimal ca. 5,2–5,8) |
| **Chargen-Nummer** | z. B. CH-2026-0523 – **⚡ Neu** erzeugt Nummer |
| **📝 Protokoll eintragen** | Speichern |

Bei Werten außerhalb der Toleranz erscheint eine **Warnung**.

## Bereich 2: Tageskontrollen (Mitte)

Umschalter:

- **Temperaturen** – Kühlstellen prüfen
- **Reinigung** – erledigte Reinigungen abhaken
- **Einrichten** – Kühlstellen und Reinigungsaufgaben anlegen oder deaktivieren

### Temperaturen

![Temperaturen mit Messwert](./screenshots/05b-haccp-temperaturen.png)

Messwert eintragen → **OK**. Optional Notiz bei Abweichung.

> **StevesHof Hofladen:** Wir dokumentieren Temperaturen und Reinigung **ausschließlich im Tab HACCP**. Der Tab **Team** ist für `StevesHof_Hauptbetrieb` deaktiviert.
>
> **Andere Mandanten:** Zusätzlich gibt es dieselben Kühlstellen als schlanken Reiter **🌡️ Temperatur-Check** im Tab **Team** (siehe [06-team.md](./06-team.md)). Stationen, Sollwerte und Speicherweg sind identisch — die Werte landen in denselben Protokollen. Reinigung, Einrichten und Druckansicht bleiben auf der HACCP-Seite.

### Reinigung

![Reinigungsaufgaben](./screenshots/05c-haccp-reinigung.png)

Pro Aufgabe **Reinigung erledigt** tippen.

Morgens typisch: **Temperaturen** → Werte eintragen → optional **Reinigung**.

Der Bereich **Einrichten** ist für seltene Änderungen gedacht, zum Beispiel wenn eine neue Kühlstelle dazukommt oder eine Reinigungsaufgabe nicht mehr aktiv ist.

## Bereich 3: Export / Büro (unten)

**🖨️ Druckansicht generieren** – Temperatur- und Reinigungsprotokolle der letzten 7 Tage als DIN-A4-Tabelle (Behördenkontrolle).

## Morgenroutine (Kurz)

1. Tab **HACCP**
2. **Temperaturen** prüfen und bestätigen
3. **Reinigung** dokumentieren
4. Bei Produktion: pH, Kerntemperatur und Charge im oberen Bereich erfassen
