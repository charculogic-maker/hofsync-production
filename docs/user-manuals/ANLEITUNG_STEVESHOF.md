# CharcuLogic: Bedienungsanleitung StevesHof Hofladen

> **Mandant:** `StevesHof_Hauptbetrieb` · **Einsatz:** Laden-iPhone im Hofladen · **Stand:** Juni 2026

CharcuLogic ist für unseren Hofladen bewusst schlank konfiguriert. Wir arbeiten im Alltag nur mit:

- **MHD**: tägliche Haltbarkeitskontrolle (7-Tage-Horizont)
- **Neu**: Wareneingang im Laden (Schnellerfassung)
- **Prod.**: Rezepte, Produktion und WRS-Kalkulation

Die ausführliche Schritt-für-Schritt-Anleitung für den Liefertag steht unter [KOLLEGEN_ANLEITUNG_HOFLADEN_APP.md](../KOLLEGEN_ANLEITUNG_HOFLADEN_APP.md).

## 1. Gemeinsamer Zugang am Laden-iPhone

Unser **Laden-iPhone** wird einmal mit diesem neutralen Betriebszugang angemeldet:

```text
bestellung@steveshof-hofladen.de
```

Das Passwort bleibt intern. Es gehört nicht in Anleitungen oder Aushänge.

Für diesen Zugang überspringt unsere App die zusätzliche Mitarbeiter-PIN-Abfrage. Alle Vorgänge werden neutral als **StevesHof-Team** erfasst. Ein persönlicher Wechsel zwischen einzelnen Kolleginnen und Kollegen ist im Hofladen-Modus nicht nötig.

## 2. Verhalten nach dem Start

Nach erfolgreicher Anmeldung öffnet CharcuLogic automatisch den Tab **MHD**.

In der unteren Navigation sehen wir drei Tabs:

| Tab | Zweck |
|-----|-------|
| **MHD** | Posten mit MHD in den nächsten 7 Tagen prüfen, Mengen korrigieren, Ware als OK, Raus, Küche oder Ausverkauft markieren |
| **Neu** | Neue Ware scannen; Menge, MHD und optional **Hersteller / Zusatz** erfassen |
| **Prod.** | Rezepte, Produktion und WRS-Kalkulation |

Weitere Module (Team, Metzgerei-Erfassung, HACCP, Büro) sind für `StevesHof_Hauptbetrieb` derzeit deaktiviert.

## 3. MHD-Monitor (vereinfacht)

Der MHD-Tab zeigt automatisch alle relevanten Posten der **nächsten 7 Tage**. Es gibt einen Filter:

- **Kategorie** — Alle Kategorien oder gezielt Frische, MoPro, Kühlware, TK, Getränke, Trockenware, Gewürze

Die früheren Filter **Bereich** und **Ansicht (ALARM/AKTION)** entfallen. Kritische Ware erscheint von selbst, sobald das MHD in der Frist liegt.

Änderungen an Mengen und Status bündeln wir mit **Änderungen speichern**.

![StevesHof MHD-Start](../modulanleitungen/screenshots/steveshof-01-mhd-start.png)

## 4. Wareneingang mit Serien-Scans

Beim Einräumen ähnlicher Ware wählen wir die Kategorie nur einmal. Nach einem erfolgreichen Scan werden Barcode und Menge geleert, die **Kategorie (Laden)** bleibt erhalten.

Beispiel:

1. **Neu** öffnen (Modus **Laden**).
2. **MoPro** auswählen.
3. Artikel scannen, Produktname, **Hersteller / Zusatz**, Menge und MHD prüfen, **Posten hinzufügen**.
4. Den nächsten MoPro-Artikel scannen.
5. Erst beim Wechsel zu Frische oder TK-Ware die Kategorie ändern.

Das MHD-Datum setzen wir im **nativen Datumsfeld**. Hersteller und Zusatzinfos erscheinen später auch in der MHD-Karten-Ansicht.

![StevesHof Wareneingang](../modulanleitungen/screenshots/steveshof-02-neu-wareneingang.png)

### Gespeicherte Kategorien prüfen und korrigieren

Unter **Neu → Letzte Eingänge** sehen wir die zuletzt erfassten Artikel mit ihrer Kategorie. Wir können die Kategorie per Dropdown ändern und mit **Kategorie speichern** übernehmen. Die App aktualisiert dabei sowohl die Laden-Kategorie als auch die interne MHD-Zuordnung.

**Letzte Eingänge** ist im Tab **Neu** für unser Team sichtbar — auch am Laden-iPhone ohne Admin-Anmeldung. **Stammdaten** und weitere Büro-Funktionen bleiben Admin vorbehalten und sind im Hofladen-Modus ausgeblendet.

![StevesHof Letzte Eingänge mit Kategoriekorrektur](../modulanleitungen/screenshots/steveshof-04-letzte-eingaenge-korrigieren.png)

## 5. Prod. öffnen

Der Tab **Prod.** enthält Rezepte, Produktion und WRS-Kalkulation.

![StevesHof Prod.-Tab mit Rezeptliste](../modulanleitungen/screenshots/steveshof-04-prod.png)

## 6. Offline-Betrieb

Kurze WLAN-Ausfälle sind unkritisch. Bereits geladene Bereiche bleiben nutzbar; unsere App zeigt beim Speichern **Lokal vorgemerkt** und synchronisiert die Einträge automatisch, sobald WLAN wieder verfügbar ist.

| Situation | Verhalten |
|-----------|-----------|
| Kein Internet beim Speichern | Eintrag wird lokal vorgemerkt. |
| Verbindung kommt zurück | Vorgemerkte Einträge werden automatisch übertragen. |
| Erstmalige Anmeldung am Laden-iPhone | Benötigt eine Internetverbindung. |

## 7. Administration

| Thema | Vorgehen |
|-------|----------|
| Passwort Hofladen-Zugang ändern | Firebase Console → Authentication → Nutzer → `bestellung@steveshof-hofladen.de` → **Passwort zurücksetzen** |
| Laden-iPhone neu anmelden | Neutralen Betriebszugang verwenden und angemeldet lassen |
| Logout am festen Laden-iPhone | Im Alltagsbetrieb bewusst ausgeblendet, um versehentliches Abmelden zu vermeiden |
| Weitere Module aktivieren | Erst nach Abstimmung in `web/branding.js` für `steveshof_hauptbetrieb` freischalten |

---

*CharcuLogic · StevesHof Hofladen · `StevesHof_Hauptbetrieb`*
