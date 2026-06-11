# StevesHof Hofladen: Kurzanleitung für unser Team

Diese Anleitung gilt für unseren Hofladen bei **StevesHof**. Unsere App heißt **CharcuLogic** und ist im Laden bewusst auf die wichtigsten Aufgaben reduziert:

1. **MHD kontrollieren**
2. **Neue Ware erfassen**
3. **Rezepte und Produktion öffnen**
4. **Wissen nachlesen**

Nach dem Öffnen starten wir direkt in der **MHD-Kontrolle**.

## Anmeldung am Laden-iPhone

Unser **Laden-iPhone** wird einmal mit dem neutralen Hofladen-Zugang angemeldet:

```text
bestellung@steveshof-hofladen.de
```

Das Passwort verwalten wir intern. Die Anmeldung bleibt auf dem Laden-iPhone gespeichert.

Eine zusätzliche Anmeldung mit Mitarbeitername oder PIN brauchen wir im Hofladen nicht. Alle Vorgänge werden neutral als **StevesHof-Team** gespeichert.

## Navigation

In der unteren Leiste sehen wir im Hofladen diese Tabs:

| Tab | Zweck |
|-----|-------|
| **MHD** | Haltbarkeiten prüfen und Ware bearbeiten |
| **Neu** | Neue Ware im Laden per Barcode erfassen |
| **Prod.** | Rezepte, Produktion und WRS-Kalkulation |
| **HACCP** | Temperaturen und Reinigung dokumentieren |
| **Wissen** | Fleisch-Lexikon und Hofladen-Handbücher lesen |

Im Tab **Wissen** lesen wir direkt am Laden-iPhone das Fleisch-Lexikon und die kurzen Hofladen-Handbücher zu MHD, Reinigung und HACCP. Weitere Bereiche der Plattform sind am Laden-iPhone absichtlich ausgeblendet. Persönliche Admin-Konten können auf einem eigenen iPhone zusätzlich Büro/Chargen sehen.

---

## 1. MHD-Kontrolle

Im Tab **MHD** zeigt unsere App automatisch alle Posten im passenden Zeitraum: **MoPro 0-3 Tage**, **Trockenware 0-21 Tage**. Bei Bedarf stellen wir den Zeitraum für sonstige Artikel auf **0-3**, **0-7**, **0-14** oder **0-21 Tage**.

Wenn eine Kategorie falsch ist, tippen wir in der MHD-Karte das Kategorie-Badge an und bestätigen die Änderung. Unsere App speichert sie für alle vorhandenen Einträge mit gleicher EAN und nutzt sie beim nächsten Scan wieder.

Wenn ein MHD falsch erfasst wurde, tippen wir **MHD ändern** in der Karte. Unsere App korrigiert nur diesen Eintrag und fragt vor dem Speichern noch einmal nach.

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

### Lieferschein per Foto einlesen (KI-Wareneingang)

Wenn wir nicht jeden Artikel einzeln eintippen möchten, lassen wir den Lieferschein von der KI lesen:

1. Im Tab **Neu** auf **📸 Lieferschein fotografieren / hochladen** tippen.
2. Lieferschein mit dem Laden-iPhone fotografieren oder ein Foto auswählen.
3. Kurz warten, während die Animation **„Die KI liest den Lieferschein für uns...“** läuft.
4. In der Vorschau-Tabelle **Name**, **Liefermenge** und das **vorgeschlagene MHD** prüfen.
5. **📥 Artikel in den Bestand einbuchen** tippen.

Wir sehen dann die Bestätigung **„Lieferschein erfolgreich verbucht. Alle Bestände wurden erhöht!“**

Das **vorgeschlagene MHD** ist schon ausgefüllt: Unsere App nutzt die **Erfahrungswerte der letzten Lieferungen** für denselben Artikel. Gab es noch keine Lieferung, greift ein Standardwert (Gemüse 3 Tage, Molkerei 10 Tage). Jedes MHD lässt sich vorher noch als `TT.MM.JJJJ` anpassen.

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
Mit dem Kategorie-Button unter der Rezeptsuche grenzen wir die Rezeptliste im Filterblatt ein.

![StevesHof Prod.-Tab mit Rezeptliste](./modulanleitungen/screenshots/steveshof-04-prod.png)

---

## 4. Wissen nachlesen

Im Tab **Wissen** gibt es zwei aufklappbare Bereiche:

- **🥩 Fleisch-Lexikon (Cuts)**: Wir suchen nach Zuschnitten, regionalen Namen und passenden Verwendungen.
- **📋 Hofladen-Handbücher**: Wir lesen die kurzen Anleitungen zu MHD-Ablauf-Regeln, Reinigung der Wurstküche und HACCP-Erklärung.

Die Filter im Fleisch-Lexikon sind für das Laden-iPhone groß genug, damit wir sie auch im Arbeitsalltag sicher treffen.

---

## 5. Kundenbestellungen zusammenstellen

Kundenbestellungen sind am Laden-iPhone im aktuellen StevesHof-Profil nicht aktiv. Im Bürobereich gibt es dafür weiterhin die **Sammel-Pickliste für heute**, wenn Bestellungen später wieder freigeschaltet werden.

1. Im Bürobereich **Sammel-Pickliste für heute** öffnen.
2. Unsere App fasst gleiche Artikel aus allen offenen Bestellungen zusammen, zum Beispiel `12 Glas Fleischsalat`.
3. Wir holen die Artikel nach Bereich, etwa **Wurstküche**, **Molkereiprodukte** oder **Hofladen-Spezialitäten**.
4. Beim Einpacken haken wir jede Zeile ab und korrigieren bei Bedarf den **Waagen-Wert**.
5. Wenn alles im Laden-Kühlschrank steht, markieren wir die Bestellungen als **Abholbereit**.

Nach der Bestätigung setzt unsere App die enthaltenen Bestellungen auf **Abholbereit**, speichert erfasste Waagen-Werte in den Bestellpositionen, schreibt automatisch eine kurze Info aufs Schwarze Brett und verschickt das **Kunden-Signal** als freundliche **Abhol-Nachricht** an die Kunden. Danach ist die Sammel-Pickliste für heute leer, solange keine neue offene Bestellung dazukommt.

Bei abholbereiten Bestellungen können wir **Lieferschein drucken** wählen. Der **Kisten-Zettel** zeigt Kundennamen, Abholdatum, bestellte Menge, tatsächliche Menge und den **Endpreis**. Wenn wir einen Waagen-Wert erfasst haben, nutzt unsere App diesen Wert für den **Abholpreis**.

Wenn der Kunde die Kiste mitnimmt, tippen wir **Als abgeholt markieren**. Unsere App zieht die tatsächliche Menge vom Lager ab und zeigt **Bestand aktualisiert**, sobald alles verbucht ist.

---

## 6. Temperatur-Check (Qualität sichern)

Im Tab **HACCP** tragen wir die aktuellen Werte unserer Kühlstellen ein und dokumentieren Reinigungen.

1. **HACCP** öffnen.
2. Wir sehen je Kühlstelle eine Karte, zum Beispiel **Kühlauslage Hofladen** oder **TK-Truhe**, mit dem Hinweis, welcher Wert in Ordnung ist (z. B. *„Alles gut bis 7 °C.“*).
3. Den gemessenen Wert in das große Feld **„____ °C“** eintippen.
4. **Speichern** tippen. Es erscheint kurz **Wert gespeichert**.

Ist ein Wert zu hoch – zum Beispiel die Kühlung über 7 °C – färbt sich das Feld dezent orange und wir sehen sofort den Hinweis **„⚠️ Wert erhöht! Bitte Kühlung prüfen.“**. Den Wert speichern wir trotzdem, damit nichts verloren geht, und kümmern uns gleich um die Kühlung.

Unter jeder Karte steht der zuletzt eingetragene Wert (z. B. *„Heute, 08:30 – 3,5 °C (in Ordnung)“*), damit wir auf einen Blick sehen, was heute schon kontrolliert wurde.

Ohne Internet ist das kein Problem: Unsere App zeigt dann **Lokal vorgemerkt** und überträgt den Wert automatisch, sobald WLAN wieder verfügbar ist.

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
