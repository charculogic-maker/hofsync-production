# CharcuLogic: Bedienungsanleitung StevesHof Hofladen

> **Mandant:** `StevesHof_Hauptbetrieb` · **Einsatz:** Hofladen-Tablet · **Stand:** Juni 2026

CharcuLogic ist für den Hofladen bewusst schlank konfiguriert. Das Team arbeitet nur mit:

- **MHD**: tägliche Haltbarkeitskontrolle
- **Neu**: Wareneingang im Laden
- **Prod.**: Rezepte, Produktion und WRS-Kalkulation

Die ausführliche Schritt-für-Schritt-Anleitung für Kollegen steht unter [KOLLEGEN_ANLEITUNG_HOFLADEN_APP.md](../KOLLEGEN_ANLEITUNG_HOFLADEN_APP.md).

## 1. Gemeinsamer Tablet-Zugang

Das Hofladen-Tablet wird einmal mit diesem neutralen Betriebszugang angemeldet:

```text
bestellung@steveshof-hofladen.de
```

Das Passwort bleibt intern. Es soll nicht in Anleitungen oder Aushängen dokumentiert werden.

Für diesen Zugang überspringt die App die zusätzliche Mitarbeiter-PIN-Abfrage. Alle Vorgänge werden neutral als **StevesHof-Team** erfasst. Ein persönlicher Wechsel zwischen Stephie, Finn oder anderen Kollegen ist im Hofladen-Modus nicht nötig.

## 2. Verhalten nach dem Start

Nach erfolgreicher Anmeldung öffnet CharcuLogic automatisch den Tab **MHD**.

In der unteren Navigation sind drei Tabs sichtbar:

| Tab | Zweck |
|-----|-------|
| **MHD** | MHD prüfen, Mengen korrigieren, Ware als OK, Raus, Küche oder Ausverkauft markieren |
| **Neu** | Neue Ware im Laden scannen und mit Menge sowie MHD erfassen |
| **Prod.** | Rezepte, Produktion und WRS-Kalkulation |

Die Plattform enthält weitere Module für andere Betriebe und spätere Ausbaustufen. Team, Metzgerei-Erfassung, HACCP und Büro sind für `StevesHof_Hauptbetrieb` derzeit deaktiviert.

## 3. Wareneingang mit Serien-Scans

Beim Einräumen ähnlicher Ware wählt das Team die Kategorie nur einmal aus. Nach einem erfolgreichen Scan werden Barcode und Menge geleert, die Kategorie bleibt jedoch erhalten.

Beispiel:

1. **Neu** öffnen.
2. **MoPro** auswählen.
3. Artikel scannen, Menge und MHD prüfen, Posten hinzufügen.
4. Den nächsten MoPro-Artikel scannen.
5. Erst beim Wechsel zu Frische oder TK-Ware die Kategorie ändern.

Während ein einzelner gescannter Posten bearbeitet wird, ist die Kategorie gesperrt. Das reduziert versehentliche Fehlzuordnungen.

### Gespeicherte Kategorien prüfen und korrigieren

Unter **Neu → Letzte Eingänge** stehen die zuletzt erfassten Artikel mit ihrer Kategorie. Die Kategorie kann dort per Dropdown geändert und mit **Kategorie speichern** korrigiert werden. Die App aktualisiert dabei sowohl die Laden-Kategorie als auch die interne MHD-Zuordnung.

![StevesHof Letzte Eingänge mit Kategoriekorrektur](../modulanleitungen/screenshots/steveshof-04-letzte-eingaenge-korrigieren.png)

## 4. Prod. öffnen

Der Tab **Prod.** enthält Rezepte, Produktion und WRS-Kalkulation.

![StevesHof Prod.-Tab mit Rezeptliste](../modulanleitungen/screenshots/steveshof-04-prod.png)

## 5. Offline-Betrieb

Kurze WLAN-Ausfälle sind unkritisch. Bereits geladene Bereiche bleiben nutzbar und gespeicherte Einträge werden nach Wiederherstellung der Verbindung synchronisiert.

| Situation | Verhalten |
|-----------|-----------|
| Kein Internet beim Speichern | Eintrag landet lokal in der Warteschlange. |
| Verbindung kommt zurück | Warteschlange wird automatisch übertragen. |
| Erstmalige Tablet-Anmeldung | Benötigt eine Internetverbindung. |

## 6. Administration

| Thema | Vorgehen |
|-------|----------|
| Tablet-Passwort ändern | Firebase Console → Authentication → Nutzer → `bestellung@steveshof-hofladen.de` → **Passwort zurücksetzen** |
| Tablet neu anmelden | Neutralen Betriebszugang verwenden und angemeldet lassen |
| Logout am festen Tablet | Im Alltagsbetrieb bewusst ausgeblendet, um versehentliches Abmelden zu vermeiden |
| Weitere Module aktivieren | Erst nach Abstimmung in `web/branding.js` für `steveshof_hauptbetrieb` freischalten |

---

*CharcuLogic · StevesHof Hofladen · `StevesHof_Hauptbetrieb`*
