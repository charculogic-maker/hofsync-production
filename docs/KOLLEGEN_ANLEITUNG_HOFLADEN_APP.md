# StevesHof Hofladen: Kurzanleitung für unser Team

Diese Anleitung gilt für unseren Hofladen bei **StevesHof**. Unsere App heißt **CharcuLogic** und ist im Laden bewusst auf die wichtigsten Aufgaben reduziert:

1. **MHD kontrollieren**
2. **Neue Ware erfassen**
3. **Rezepte und Produktion öffnen**

Nach dem Öffnen starten wir direkt in der **MHD-Kontrolle**.

## Anmeldung am Laden-iPhone

Unser **Laden-iPhone** wird einmal mit dem neutralen Hofladen-Zugang angemeldet:

```text
bestellung@steveshof-hofladen.de
```

Das Passwort verwalten wir intern. Die Anmeldung bleibt auf dem Laden-iPhone gespeichert.

Eine zusätzliche Anmeldung mit Mitarbeitername oder PIN brauchen wir im Hofladen nicht. Alle Vorgänge werden neutral als **StevesHof-Team** gespeichert.

## Navigation

In der unteren Leiste sehen wir im Hofladen nur diese Tabs:

| Tab | Zweck |
|-----|-------|
| **MHD** | Haltbarkeiten prüfen und Ware bearbeiten |
| **Neu** | Neue Ware im Laden per Barcode erfassen |
| **Prod.** | Rezepte, Produktion und WRS-Kalkulation |

Weitere Bereiche der Plattform sind am Laden-iPhone weiterhin absichtlich ausgeblendet. Persönliche Admin-Konten können auf einem eigenen iPhone zusätzlich HACCP und Büro/Chargen sehen.

---

## 1. MHD-Kontrolle

Im Tab **MHD** zeigt unsere App automatisch alle Posten, deren MHD im gewählten Zeitraum abläuft. Standard ist **21 Tage**; bei Bedarf stellen wir den Zeitraum auf **7**, **14** oder **21 Tage**.

1. CharcuLogic öffnen — der Tab **MHD** erscheint von selbst.
2. Bei Bedarf den **Zeitraum** oder die **Kategorie** wählen (z. B. MoPro, Frische, TK).
3. Kritische Artikel nacheinander bearbeiten:
   - **OK**: Ware bleibt im Verkauf.
   - **Raus**: Ware wird aus dem Verkauf genommen.
   - **Küche**: Ware geht zur weiteren Verwendung.
   - **Ausverkauft**: Posten ist nicht mehr vorhanden.
4. Die Menge bei Bedarf mit **− / +** oder direkt im Zahlenfeld korrigieren.
5. **Änderungen speichern** tippen.

Optional nutzen wir **Artikel suchen**, um gezielt nach einem Produkt zu filtern.

![StevesHof MHD-Start mit Kategoriefilter und Artikelkarte](./modulanleitungen/screenshots/steveshof-01-mhd-start.png)

---

## 2. Neue Ware erfassen

Im Tab **Neu** erfassen wir Ware beim Einräumen — im Modus **Laden** (Schnellerfassung).

1. Tab **Neu** öffnen.
2. Einmal die passende **Kategorie (Laden)** wählen:
   - Frische
   - MoPro
   - Kühlware
   - TK
   - Getränke
   - Trockenware
   - Gewürze
3. **Barcode scannen** (grüner Button) oder EAN eintippen und **OK** tippen.
4. Bei bekannter EAN: grüne Zeile **Erkannt: …**
5. Bei unbekannter EAN den **Produktnamen** ergänzen.
6. Optional **Hersteller / Zusatz** eintragen (z. B. Bauer Meier) — erscheint später auch in der MHD-Karte.
7. **Menge** prüfen und **MHD** eintippen, z. B. `31.12.2026`.
8. **Posten hinzufügen** wählen.
9. Den nächsten Artikel scannen.

### Wichtig: Kategorie bleibt erhalten

Die gewählte Kategorie bleibt nach **Posten hinzufügen** aktiv. Wenn wir gerade nur MoPro verräumen, müssen wir **MoPro** nicht bei jedem Scan neu wählen.

Die Kategorie können wir jederzeit ändern — sie gilt für den **nächsten** Posten.

### Zuordnung nachträglich korrigieren

1. Im Tab **Neu** auf **Letzte Eingänge** tippen.
2. Beim gewünschten Artikel die Kategorie prüfen.
3. Bei Bedarf eine andere Kategorie auswählen.
4. **Kategorie speichern** tippen.

So berichtigen wir falsch zugeordnete Artikel ohne Zugriff auf die technische Datenbank. **Letzte Eingänge** ist für uns im Hofladen direkt sichtbar — ein Büro-Login ist dafür nicht nötig. (**Stammdaten** und andere Büro-Funktionen sind im Laden-Modus ausgeblendet.)

![StevesHof Wareneingang im Laden](./modulanleitungen/screenshots/steveshof-02-neu-wareneingang.png)
![Barcode-Scanner](./modulanleitungen/screenshots/02b-barcode-scanner.png)
![StevesHof Letzte Eingänge mit Kategoriekorrektur](./modulanleitungen/screenshots/steveshof-04-letzte-eingaenge-korrigieren.png)

---

## 3. Prod. öffnen

Im Tab **Prod.** nutzen wir Rezepte, Produktion und WRS-Kalkulation.

![StevesHof Prod.-Tab mit Rezeptliste](./modulanleitungen/screenshots/steveshof-04-prod.png)

---

## 4. Kundenbestellungen zusammenstellen

Im Tab **Team** nehmen wir Kundenbestellungen auf und behalten die offenen Bestellungen im Blick. Im Bürobereich gibt es dafür die **Sammel-Pickliste für heute**.

1. **Team** öffnen.
2. Unter **Produktions-Aufträge** sehen wir, was in der Küche und in der Metzgerei zu tun ist.
3. Bei Wiegeartikeln prüfen wir **Tatsächliches Gewicht** und übernehmen den **Waagen-Wert**.
4. Fertige Posten haken wir als **Fertig für den Laden** ab.
5. Im Bereich **Kundenbestellungen** auf **Sammel-Pickliste für heute** tippen.
6. Unsere App fasst gleiche Artikel aus allen offenen Bestellungen zusammen, zum Beispiel `12 Glas Fleischsalat`.
7. Wir holen die Artikel nach Bereich, etwa **Wurstküche**, **Molkereiprodukte** oder **Hofladen-Spezialitäten**.
8. Beim Einpacken haken wir jede Zeile direkt am Laden-iPhone ab und korrigieren bei Bedarf den **Waagen-Wert**.
9. Wenn alles im Laden-Kühlschrank steht, tippen wir auf **Alle enthaltenen Bestellungen als 'Abholbereit' markieren**.
10. Wir bestätigen **Sind alle Artikel für heute wirklich eingepackt?**.
11. Mit **Liste zurücksetzen** beginnen wir die Runde bei Bedarf neu.

Nach der Bestätigung setzt unsere App die enthaltenen Bestellungen auf **Abholbereit**, speichert erfasste Waagen-Werte in den Bestellpositionen und schreibt automatisch eine kurze Info aufs Schwarze Brett. Danach ist die Sammel-Pickliste für heute leer, solange keine neue offene Bestellung dazukommt.

---

## Liefertag: Kurzfassung

1. CharcuLogic öffnen: **MHD**-Kontrolle erscheint automatisch.
2. Offene MHD-Punkte bearbeiten und **Änderungen speichern**.
3. Zu **Neu** wechseln.
4. Kategorie für die aktuelle Warenart einmal wählen.
5. Artikel nacheinander scannen und als Posten hinzufügen.
6. Vor dem Wechsel zu einer anderen Warenart die Kategorie einmal ändern.

## Hilfe

| Problem | Lösung |
|---------|-------|
| Laden-iPhone zeigt die Anmeldung | Mit `bestellung@steveshof-hofladen.de` anmelden. |
| Passwort fehlt oder funktioniert nicht | Internen Ansprechpartner um ein neues Passwort für den Hofladen-Zugang bitten. |
| Falsche Kategorie für nächsten Scan | Kategorie im Formular anpassen, bevor der nächste Posten erfasst wird. |
| Kategorie eines gespeicherten Artikels ist falsch | **Neu → Letzte Eingänge** öffnen, Kategorie auswählen und speichern. |
| Kein Internet beim Speichern | Erfassung fortsetzen. Unsere App zeigt **Lokal vorgemerkt** und synchronisiert automatisch, sobald WLAN wieder verfügbar ist. |

## Logout am Laden-iPhone

Unser Laden-iPhone bleibt im Normalbetrieb angemeldet. Ein Logout-Button wird im Hofladen-Modus deshalb nicht angezeigt — so vermeiden wir versehentliches Abmelden während des Verkaufs.

---

*CharcuLogic · StevesHof Hofladen · `StevesHof_Hauptbetrieb`*
