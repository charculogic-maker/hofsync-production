# StevesHof Hofladen: Kurzanleitung für das Team

Diese Anleitung gilt für den Hofladen von **StevesHof**. Die App heißt **CharcuLogic** und ist für den Laden bewusst auf die wichtigsten Aufgaben reduziert:

1. **MHD kontrollieren**
2. **Neue Ware erfassen**
3. **Rezepte und Produktion öffnen**

Nach dem Öffnen startet die App direkt mit der **MHD-Kontrolle**.

## Anmeldung am Tablet

Das Tablet wird einmal mit dem neutralen Hofladen-Zugang angemeldet:

```text
bestellung@steveshof-hofladen.de
```

Das Passwort wird intern verwaltet. Die Anmeldung bleibt auf dem Hofladen-Tablet gespeichert.

Eine zusätzliche Anmeldung mit Mitarbeitername oder PIN ist im Hofladen nicht erforderlich. Erfassungen werden neutral als **StevesHof-Team** gespeichert.

## Navigation

In der unteren Leiste sind für den Hofladen nur diese Tabs sichtbar:

| Tab | Zweck |
|-----|-------|
| **MHD** | Haltbarkeiten prüfen und Ware bearbeiten |
| **Neu** | Neue Ware im Laden per Barcode erfassen |
| **Prod.** | Rezepte, Produktion und WRS-Kalkulation |

Andere Bereiche der Plattform sind für den Hofladen derzeit absichtlich ausgeblendet.

---

## 1. MHD-Kontrolle

Im Tab **MHD** seht ihr, welche Ware geprüft werden muss.

1. App öffnen. Der Tab **MHD** erscheint automatisch.
2. Bei Bedarf **Bereich**, **Ansicht** und **Kategorie** wählen.
3. Kritische Artikel nacheinander bearbeiten:
   - **OK**: Ware bleibt im Verkauf.
   - **Raus**: Ware wird aus dem Verkauf genommen.
   - **Küche**: Ware wird zur weiteren Verwendung weitergegeben.
   - **Ausverkauft**: Posten ist nicht mehr vorhanden.
4. Die Menge bei Bedarf mit **− / +** korrigieren.
5. Änderungen speichern.

Optional könnt ihr über **Artikel suchen** gezielt nach einem Produkt suchen.

![StevesHof MHD-Start mit Filtern und Artikelkarte](./modulanleitungen/screenshots/steveshof-01-mhd-start.png)

---

## 2. Neue Ware erfassen

Im Tab **Neu** wird Ware beim Einräumen im Laden erfasst.

1. Tab **Neu** öffnen.
2. Einmal die passende **Kategorie** auswählen, zum Beispiel:
   - Trockenware
   - MoPro
   - Frische
   - TK-Ware
3. Barcode scannen oder EAN eintippen und bestätigen.
4. Bei einer unbekannten EAN den Produktnamen ergänzen.
5. Menge und MHD prüfen oder eintragen.
6. **Posten hinzufügen** wählen.
7. Den nächsten Artikel scannen.

### Wichtig: Kategorie bleibt erhalten

Die gewählte Kategorie bleibt nach dem Speichern eines Artikels aktiv. Wenn ihr zum Beispiel gerade nur MoPro verräumt, müsst ihr **MoPro** nicht bei jedem Scan neu auswählen.

Während ein gescannter Artikel bearbeitet wird, ist die Kategorie gesperrt. Dadurch wird ein versehentlicher Wechsel vermieden. Nach **Posten hinzufügen** kann die Kategorie für die nächsten Scans wieder geändert werden.

### Zuordnung nachträglich korrigieren

1. Im Tab **Neu** auf **Letzte Eingänge** tippen.
2. Beim gewünschten Artikel die Kategorie prüfen.
3. Bei Bedarf eine andere Kategorie auswählen.
4. **Kategorie speichern** tippen.

So können falsch zugeordnete Artikel ohne Zugriff auf die technische Datenbank berichtigt werden.

![StevesHof Wareneingang im Laden](./modulanleitungen/screenshots/steveshof-02-neu-wareneingang.png)
![Barcode-Scanner](./modulanleitungen/screenshots/02b-barcode-scanner.png)
![StevesHof Letzte Eingänge mit Kategoriekorrektur](./modulanleitungen/screenshots/steveshof-04-letzte-eingaenge-korrigieren.png)

---

## 3. Prod. öffnen

Im Tab **Prod.** stehen Rezepte, Produktion und WRS-Kalkulation bereit.

![StevesHof Prod.-Tab mit Rezeptliste](./modulanleitungen/screenshots/steveshof-04-prod.png)

---

## Liefertag: Kurzfassung

1. App öffnen: **MHD**-Kontrolle erscheint automatisch.
2. Offene MHD-Punkte bearbeiten.
3. Zu **Neu** wechseln.
4. Kategorie für die aktuelle Warenart auswählen.
5. Artikel nacheinander scannen und als Posten hinzufügen.
6. Vor dem Wechsel zu einer anderen Warenart die Kategorie einmal ändern.

## Hilfe

| Problem | Lösung |
|---------|-------|
| Tablet zeigt die Anmeldung | Mit `bestellung@steveshof-hofladen.de` anmelden. |
| Passwort fehlt oder funktioniert nicht | Internen Ansprechpartner um ein neues Tablet-Passwort bitten. |
| Falsche Kategorie gewählt | Aktuellen Posten fertig erfassen oder verwerfen, danach die Kategorie für die folgenden Scans ändern. |
| Kategorie eines gespeicherten Artikels ist falsch | **Neu → Letzte Eingänge** öffnen, Kategorie auswählen und speichern. |
| Kein Internet | Erfassung fortsetzen. Die App synchronisiert gespeicherte Einträge nach Wiederherstellung der Verbindung. |

## Logout am Hofladen-Tablet

Das Tablet bleibt im Normalbetrieb angemeldet. Ein Logout-Button wird deshalb im Hofladen-Modus nicht angezeigt. Das verhindert versehentliches Abmelden während des Verkaufs.

---

*CharcuLogic · StevesHof Hofladen · `StevesHof_Hauptbetrieb`*
