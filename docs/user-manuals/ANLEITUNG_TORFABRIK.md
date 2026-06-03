# [T O R | F A B R I K]
## 🏭 BEDIENUNGSANLEITUNG: GROSSPRODUKTION & OCR
***
> **Mandant:** `TorFabrik_Werk_Nord` | **Primärfarbe:** `#0F172A` (Schwarz) | **Akzent:** `#1565C0` (Blau)
***

# CenterLogic — Bedienungsanleitung TorFabrik Krefeld

**Zielgruppe:** Leitung, Produktion, Theke, Event-Küche  
**Mandant:** `torfabrik`  
**App-Anzeige:** CenterLogic (grüner Akzent, gelber Header)

CenterLogic ist auf **hohes Tagesvolumen**, klare Prozesse und zentrale Teamsteuerung ausgelegt. Diese Anleitung fokussiert die drei Säulen eures Betriebs: **Wareneingang mit KI-Lieferschein**, **Teamboard ohne Bereichs-Chaos** und **lückenlose Dokumentation** entlang der Produktionskette.

**Weitere Dokumentation:** [Kollegen-Walkthrough](../KOLLEGEN_ANLEITUNG_TORFABRIK.md) · [Modulanleitungen](../modulanleitungen/README.md)

---

## 1. Mandanten-Profil TorFabrik (Überblick)

| Thema | CenterLogic-Verhalten |
|-------|------------------------|
| **Tabs aktiv** | Start · Team · MHD · Neu · HACCP · Büro |
| **Tab Prod. (Wurstküche)** | Für TorFabrik **deaktiviert** — Rezept-Skalierung läuft nicht über den WRS |
| **Standard-Ansicht Aufgaben** | **„Alle meine Bereiche“** — Theke, Küche & Events, Halle auf einen Blick |
| **Betriebsbereiche** | Theke · Küche & Events · Halle · Allgemein |
| **KI-Lieferschein** | Tab **Neu** → Metro / Jakob Bayen |

> **Datenisolation:** Alle Einträge liegen ausschließlich unter `tenants/torfabrik/…`. Andere CenterLogic-Mandanten sehen eure Bestände, Aufgaben und Lieferscheine **nicht** — auch nicht bei gemeinsam genutzter Hardware.

---

## 2. Produktions- und Chargen-Dokumentation

TorFabrik nutzt den **Prod.-Tab nicht**; Dokumentation erfolgt über **HACCP**, **Wareneingang/Inventar** und **Büro/Chargen**. So bleibt die Rückverfolgung auch bei hohem Durchsatz belastbar.

### 2.1 HACCP — Produktions-Protokoll (Kerndokumentation)

Für laufende Produktion und Events:

1. Tab **HACCP** öffnen.
2. Im Bereich **Produktions-Protokoll**:
   - **Kerntemperatur** und **pH-Wert** eintragen
   - **Chargen-Nummer** prüfen oder mit **⚡ Neu** erzeugen
3. **📝 Protokoll eintragen** — der Eintrag ist **unveränderlich** (Revisionssicherheit).

| Feld | Bedeutung |
|------|-----------|
| Chargen-Nummer | Eindeutige Referenz für Rückfragen und Behörden |
| Kerntemperatur / pH | Pflichtkenngrößen der Produktion |
| Zeitstempel | Automatisch beim Speichern |

**Doppelklick-Schutz:** Während ein Protokoll gespeichert wird, blockiert die App parallele Schreibversuche — ein versehentliches Doppeltippen erzeugt **keine doppelte Charge**.

### 2.2 Inventar aus Lieferscheinen (skalierte Erfassung)

Große Lieferungen (Metro, Jakob Bayen) werden nicht Position für Position getippt, sondern über den **KI-Lieferschein** (siehe Kapitel 3) in `inventory` überführt. Das ist eure **skalierte Wareneingangs-Dokumentation** — geeignet für hohe Postenanzahlen pro Lieferschein.

Fehlkategorien nach dem Laden-Scan: Tab **Neu** → **Letzte Eingänge** (für alle Mitarbeiter mit Tab **Neu**, nicht für die reine Firebase-Rolle `helper`).

### 2.3 Büro — Chargen & Rückverfolgung

1. Tab **Büro** öffnen.
2. **🔍 Charge, Rezept oder Macher suchen…** nutzen.
3. Liste der gespeicherten Chargen prüfen (HACCP-Protokolle, ggf. historische Produktionseinträge).
4. **Rezeptdaten-Prüfung:** Status Masterliste vs. Cloud — relevant, wenn Rezept-Module für euren Mandanten später aktiviert werden.

> **Hinweis für CenterLogic-Administratoren:** Mandanten mit aktivem Modul **Wurstküche** dokumentieren Chargen zusätzlich unter **Prod. → Charge dokumentieren** (Rezept, Macher, Verkaufseinheiten). TorFabrik konzentriert sich auf HACCP + Inventar.

---

## 3. Digitaler Lieferschein — OCR-Workflow

Der **KI-Lieferschein** wandelt Papier-Lieferscheine in strukturierte Bestandspositionen um.

### 3.1 Voraussetzungen

- Betriebs-Login (E-Mail) aktiv
- Mitarbeiter unter **Start** per PIN angemeldet
- **WLAN** für die KI-Analyse (Offline-Scan speichert lokal, die Erkennung braucht Verbindung)
- Rolle **keine reine Aushilfe** (`helper`) für den KI-Button

### 3.2 Schritt-für-Schritt

| Schritt | Aktion |
|---------|--------|
| 1 | Tab **Neu** → **📸 Lieferschein scannen (KI)** |
| 2 | Foto aufnehmen oder Bild aus Galerie wählen (gute Beleuchtung, vollständiger Schein) |
| 3 | Warten — Button ist während der Analyse **gesperrt** (kein Doppel-Scan) |
| 4 | **Vorschau-Tabelle** prüfen: Artikel · Menge · Kategorie |
| 5 | Fehler in der Tabelle **manuell korrigieren** |
| 6 | **In Bestand speichern** — Positionen gehen nach `tenants/torfabrik/inventory` |

### 3.3 Fehler abfangen — ohne Panik

Die App zeigt **verständliche deutsche Meldungen**, keine technischen Fehlercodes:

| Meldung (Beispiel) | Was tun? |
|--------------------|----------|
| *KI-Analyse fehlgeschlagen …* | Foto wiederholen (schärfer, gerader, weniger Schatten) |
| *Aktion nicht erlaubt …* | Betriebs-Login / Rolle prüfen — Admin kontaktieren |
| *Netzwerkfehler …* | WLAN prüfen, erneut versuchen |
| Vorschau unvollständig | Fehlende Zeilen **manuell in der Tabelle ergänzen** vor dem Speichern |

**Speicher-Schutz:** Auch **In Bestand speichern** ist gegen Doppeltippen abgesichert — parallele Speichervorgänge werden blockiert.

### 3.4 Qualitäts-Checkliste vor dem Speichern

- [ ] Lieferant/Kategorie passt (Metro vs. Jakob Bayen)
- [ ] Mengen plausibel (Dezimalzahlen mit Komma oder Punkt)
- [ ] Keine leeren Artikelzeilen
- [ ] Stichprobe: 3 Positionen mit Papier-Lieferschein verglichen

---

## 4. Teamboard — zentral steuern, Bereiche trennen

Das **Teamboard** (Tab **Start** + **Team**) koordiniert Theke, Küche & Events und Halle — ohne dass Aufgaben zwischen Abteilungen „verrutschen“.

### 4.1 Anmeldung & Bereichsfilter

1. **Betriebs-Login** (Stephan / Boris — E-Mail).
2. Tab **Start** → Mitarbeiter + **PIN** (Stephan, Boris, Aushilfe).
3. **Mein Bereich:**
   - **Solo / Übersicht:** *Alle meine Bereiche* — alle offenen Tokens sichtbar
   - **Fokus:** z. B. nur *Theke* oder *Küche & Events*

Die Auswahl wird **nur für `torfabrik`** auf dem Gerät gespeichert (`torfabrik_charculogic_active_area` o. Ä. im Hintergrund). Schichtwechsel: **Abmelden** → nächste Person anmelden.

### 4.2 Aufgaben ohne Abteilungs-Leaks

| Mechanismus | Wirkung |
|-------------|---------|
| **Zielgruppe** beim Senden | Info/Aufgabe nur an Gruppe, Schicht oder Personen |
| **Bereichsfilter** | Jede Person sieht nur passende offene Aufgaben |
| **Mandantentrennung** | Aufgaben anderer CenterLogic-Kunden existieren in eurer Ansicht **nicht** |
| **Quittieren mit ✓** | Erledigung wird mit Mitarbeitername und Zeitstempel verbunden |

**Doppelklick-Schutz beim Abhaken:** Schnelles Mehrfach-Tippen auf **✓** löst **keine doppelte** Erledigung aus — der erste Klick sperrt den Vorgang kurz.

### 4.3 Nachrichten & Bestellungen (Tab Team)

| Bereich | Prozess |
|---------|---------|
| **Nachricht senden** | Info oder Aufgabe · Empfänger wählen · Priorität Rot/Gelb/Grün |
| **Team-Infos für mich** | Eingehend lesen · mit **✓** quittieren |
| **🛒 Bestellungen** | Kundenauftrag erfassen · **Bestellung speichern** (ebenfalls doppelklick-geschützt) |

Push-Benachrichtigungen optional aktivieren — sonst reicht die Anzeige in der App.

### 4.4 Rolle „helper“ (Firebase)

Nutzer mit Rolle **`helper`** sehen nur **Start** und **MHD** — kein Team, kein Neu, kein HACCP. Das ist eine **Konten-Einschränkung**, unabhängig vom PIN-Namen „Aushilfe“.

---

## 5. Prozess-Heatmap — typischer Tag

```
06:30  Start (PIN) → MHD ALARM → HACCP Temperaturen
       ↓
08:00  Lieferung Metro → Neu → KI-Lieferschein → Vorschau → Bestand
       ↓
tagsüber  Teamboard: Aufgaben quittieren · Infos an Küche/Theke
       ↓
17:00  MHD Restpunkte · offene Wareneingänge abschließen
       ↓
Schichtende  Mitarbeiter-Abmeldung unter Start
```

---

## 6. Admin-Kurzreferenz (Stephan / Boris)

| Aufgabe | Ort |
|---------|-----|
| Mitarbeiter & PINs | **Büro → Leitstand → Team-Konfiguration** |
| Nachricht des Tages | **Büro → Leitstand** |
| Team-Gruppen | **Büro → Leitstand** |
| Inventar prüfen | Firestore `tenants/torfabrik/inventory` (Console) oder Auswertung über Büro-Prozesse |

---

*CenterLogic · TorFabrik Krefeld · Mandant `torfabrik`*
