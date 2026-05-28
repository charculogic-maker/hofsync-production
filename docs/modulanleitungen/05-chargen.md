# Chargen

Nachverfolgung und Büro-Kontrolle: gespeicherte Produktionschargen und Abgleich der Rezeptdaten.

![Chargen – Rezeptdaten-Prüfung und Suche](./screenshots/06-chargen.png)

## Oberfläche

### Rezeptdaten-Prüfung

- **Masterliste** vs. **Cloud** (Anzahl Einträge)
- **Status** und Detailtext, sobald Firestore antwortet
- Hilft zu erkennen, ob Rezepte in der Wurstküche aktuell sind

### Suche

**🔍 Charge, Rezept oder Macher suchen…** – filtert die Liste darunter.

### Chargenliste

![Beispiel-Chargen in der Liste](./screenshots/06b-chargen-liste.png)

- Einträge aus der Produktion (Charge, Rezept, verantwortliche Person, …)
- Antippen zum Prüfen der Details (je nach App-Stand)

## Wofür?

- Rückverfolgung bei Rückfragen
- Kontrolle durch Büro / Meister
- Abgleich, ob Cloud-Rezepte mit der Masterliste übereinstimmen

## Typischer Ablauf

1. Tab **Chargen** öffnen
2. Sync-Status der Rezeptdaten prüfen
3. Nach Charge oder Rezept suchen
4. Eintrag für Dokumentation oder Prüfung öffnen

Dieser Tab ist **kein** Erfassungs-Tab für den Laufenden Betrieb – dafür sind **Wurstküche** (Produktion) und **HACCP** (Kontrollen) zuständig.
