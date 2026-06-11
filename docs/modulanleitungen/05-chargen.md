# Chargen (Tab „Büro“)

Nachverfolgung und Büro-Kontrolle: gespeicherte Produktionschargen, Abgleich der Rezeptdaten und (für Admins) Leitstand-Funktionen.

![Büro – Rezeptdaten-Prüfung und Suche](./screenshots/06-chargen.png)

## Oberfläche

### Rezeptdaten-Prüfung

- **Masterliste** vs. **Cloud** (Anzahl Einträge)
- **Status** und Detailtext, sobald Firestore antwortet
- Hilft zu erkennen, ob Rezepte in **Prod.** aktuell sind

### Suche

**🔍 Charge, Rezept oder Macher suchen…** – filtert die Liste darunter.

### Chargenliste

![Beispiel-Chargen in der Liste](./screenshots/06b-chargen-liste.png)

- Einträge aus der Produktion (Charge, Rezept, verantwortliche Person, …)
- Antippen zum Prüfen der Details (je nach App-Stand)

### Leitstand (Admin)

Für berechtigte Nutzer im gleichen Tab:

- **Nachricht des Tages** veröffentlichen (Text, Foto/PDF)
- **Team-Gruppen & Mitarbeiter** pflegen
- Team-Nachrichten / Aufgaben anlegen

## Wofür?

- Rückverfolgung bei Rückfragen
- Kontrolle durch Büro / Meister
- Abgleich Cloud-Rezepte mit Masterliste

## Typischer Ablauf

1. Tab **Büro** öffnen
2. Sync-Status der Rezeptdaten prüfen
3. Nach Charge oder Rezept suchen
4. Eintrag für Dokumentation oder Prüfung öffnen

Dieser Tab ist **kein** Erfassungs-Tab für den laufenden Verkauf – dafür sind **MHD**, **Neu**, **Prod.** und **HACCP** zuständig.
