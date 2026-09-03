# StevesHof Hofladen: Kurzanleitung für unser Team

Diese Anleitung gilt für unseren Hofladen bei **StevesHof**. Unsere App heißt **CharcuLogic** und ist im Laden bewusst auf die wichtigsten Aufgaben reduziert:

1. **MHD kontrollieren** (inkl. Retter-Box vormerken)
2. **Neue Ware erfassen** (Barcode-Scan, Lieferung abschließen)
3. **Fleisch-Herkunft erfassen** (LMIV / Thekenklade)
4. **Rezepte und Produktion öffnen**
5. **Temperaturen und Reinigung dokumentieren** (HACCP)
6. **Wissen nachlesen**

Nach dem Öffnen starten wir direkt in der **MHD-Kontrolle**.

## Anmeldung am Laden-iPhone

Unser **Laden-iPhone** hat zwei Stufen — **Geräte-Zugang** (einmalig) und **Profil** (pro Schicht oder Kollege).

### 1. Geräte-Zugang (einmal am Laden-iPhone)

```text
bestellung@steveshof-hofladen.de
```

Das Passwort verwalten wir intern. Diese Anmeldung bleibt auf dem Laden-iPhone gespeichert. Eine **PIN** brauchen wir im Hofladen nicht.

### 2. Profil wählen (vor MHD, Wareneingang und Herkunft)

Nach dem Geräte-Zugang — oder wenn unsere App danach fragt — wählen wir **unser Profil**, z. B. Bettina, Finn, Stephie, Nicole, Heiko, Paddy, Melanie, Efecan oder Mimi. Über **Andere** können wir einen Namen eintippen, falls wir nicht in der Liste stehen.

- Das gewählte Profil erscheint **oben rechts** in der App.
- Für **MHD**, **Neu** (Wareneingang) und **Herkunft** ist ein Profil **Pflicht**.
- Nach **zwei Stunden ohne Aktivität** fragt unsere App beim nächsten MHD-, Wareneingang- oder Herkunft-Schritt erneut nach dem Profil.

**Wichtig:** Safari **nicht** im privaten Modus nutzen — sonst vergisst das Laden-iPhone den Geräte-Zugang nach dem Schließen.

## Navigation

Oben zeigt unsere App den **aktuellen Betrieb** (Name + Logo). In der unteren Leiste sehen wir im Hofladen typischerweise:

| Tab | Zweck |
|-----|-------|
| **MHD** | Haltbarkeiten prüfen und Ware bearbeiten |
| **Neu** | Wareneingang: Posten scannen und Lieferung abschließen |
| **Herkunft** | Fleisch-Etikett fotografieren und LMIV-Herkunft für die Theke erfassen |
| **Prod.** | Rezepte, Produktion und WRS-Kalkulation |

**HACCP**, **Wissen** und **Büro** öffnen wir bei Bedarf über das **Verwaltungs-Menü** oben (persönliche Admin-Konten), nicht als Alltagstab in der unteren Leiste. Den Eintrag **Verwaltung** (/dev-dashboard) sehen nur **Betriebs-Admins** — andere Rollen werden zur Haupt-App zurückgeleitet. Unter **/dev-dashboard** gibt es **Übersicht**, **Nutzer** (unser Betrieb ist vorausgewählt), **Einstellungen**, **Protokoll** und **Thekenklade**.

Auf großen Bildschirmen erscheint die Navigation als **linke Seitenleiste** mit klar getrennten Bereichen **Laden-Alltag** und **Verwaltung**.

---

## 1. MHD-Kontrolle

Im Tab **MHD** zeigt unsere App automatisch alle Posten im passenden Zeitraum: **MoPro 0-3 Tage**, **Trockenware 0-21 Tage**. Bei Bedarf stellen wir den Zeitraum für sonstige Artikel auf **0-3**, **0-7**, **0-14** oder **0-21 Tage**.

Wenn eine Kategorie falsch ist, tippen wir in der MHD-Karte **✏️ Bearbeiten** oder das Kategorie-Badge an. Unter **Artikel-Stammdaten bearbeiten** korrigieren wir Bezeichnung, Marke, EAN und die Zuordnung zu **MoPro & Kühlware** oder **Trockenware**. Nach dem Speichern zeigt unsere App den Artikel im passenden Filter.

Wenn ein MHD falsch erfasst wurde, tippen wir **MHD ändern** in der Karte. Unsere App korrigiert nur diesen Eintrag und fragt vor dem Speichern noch einmal nach.

Oben auf der MHD-Karte steht der vorgeschlagene Rabatt:

- **Frischmilch:** einen Tag vor dem MHD **10 %**, am MHD-Tag **20 %**. Früher reduzieren wir Frischmilch nicht.
- **Pasteurisierte Milch** (H-Milch, ESL, länger haltbar) **und übrige Kühlware:** zwei Tage vorher **10 %**, einen Tag vorher **20 %**, am MHD-Tag **50 %**.

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

### Retter-Box vormerken

Ware, die wir als **Retter-Box** verkaufen wollen, markieren wir direkt in der MHD-Karte mit **Box**. Kurz erscheint **Zur Retter-Box gelegt** — der Posten ist im heutigen Vorschlag gespeichert.

**Drucken**, Rezeptvorschlag und Status (**Verkauft** / **Verwerfen**) erledigen wir im **Büro-Bereich** mit Admin-Zugang unter **Retter-Boxen**. Am neutralen Laden-iPhone nutzen wir nur die **Box**-Aktion in der MHD-Karte.

![StevesHof MHD-Start mit Kategoriefilter und Artikelkarte](./modulanleitungen/screenshots/steveshof-01-mhd-start.png)

---

## 2. Neue Ware erfassen (Wareneingang)

Im Tab **Neu** erfassen wir Ware beim Einräumen — im Modus **Laden**. Die Posten sammeln wir in einer **Lieferung** und schließen sie am Ende mit **Gesamte Lieferung abschließen** ab.

1. Tab **Neu** öffnen — bei Bedarf zuerst **unser Profil** wählen.
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
8. **➕ Posten hinzufügen** wählen — der Artikel erscheint in der Liste **Posten in Lieferung**.
9. Den nächsten Artikel scannen und wieder **Posten hinzufügen**.
10. Wenn alle Artikel der Lieferung drin sind: **💾 Gesamte Lieferung abschließen** tippen.
11. Bei Erfolg erscheint **Gesamte Lieferung erfolgreich gebucht!** — die Posten landen im **MHD-Monitor**.

Fehlt der Lieferant, speichert unsere App die Lieferung als **Direkterfassung** (mit unserem Profilnamen). Das ist in Ordnung für schnelles Einräumen ohne Lieferschein.

### Wichtig: Kategorie bleibt erhalten

Die gewählte Kategorie bleibt nach **Posten hinzufügen** aktiv. Wenn wir gerade nur MoPro verräumen, müssen wir **MoPro** nicht bei jedem Scan neu wählen.

Die Kategorie können wir jederzeit ändern — sie gilt für den **nächsten** Posten.

---

## 2b. Fleisch-Herkunft erfassen (LMIV)

Im Tab **Herkunft** hinterlegen wir die gesetzliche Fleisch-Rückverfolgbarkeit für die Theke:

1. Tab **Herkunft** öffnen — bei Bedarf zuerst **unser Profil** wählen.
2. **Etikett fotografieren / scannen** — die Kamera des Laden-iPhones öffnet sich. Unsere App liest das Etikett per KI vor; wir prüfen die Felder kurz.
3. **Charge / LOT-Nummer** eintragen (Pflicht).
4. Optional das **Identitätskennzeichen** (ovales Kennzeichen) ergänzen.
5. Optional **Öko-Kontrollstelle** (z. B. DE-ÖKO-006) und **Bio-Verband** wählen.
6. **Tierart** wählen (Rind, Schwein, Geflügel, Schaf, Ziege).
7. Bei **Ursprung aus einem einzigen Land** nur das Land wählen. Sonst die Mehrländer-Felder ausfüllen (bei Rind zusätzlich Geboren/Zerlegt inkl. Zulassungsnummer).
8. **Herkunft speichern** tippen — der Eintrag ist danach **aktiv in der Theke**.

Ohne WLAN speichert unsere App den Eintrag lokal und synchronisiert automatisch, sobald WLAN wieder verfügbar ist.

Admins sehen alle Einträge unter **/dev-dashboard → Rückverfolgbarkeit** (Digitale Thekenklade: Suche nach LOT/Datum, Status umschalten, Original-Etikett für Kontrollen öffnen).

---

### Lieferschein per Foto (KI-Wareneingang) — noch nicht am Laden-iPhone

Am neutralen Laden-iPhone erfassen wir Ware **per Barcode-Scan** (Schritte oben unter Wareneingang). Der KI-Wareneingang ist technisch vorbereitet, am Hofladen-Terminal aber **noch ausgeblendet** (interner Testlauf vor Freigabe). Der Button **📸 Lieferschein fotografieren / hochladen** erscheint dort deshalb noch nicht.

Sobald die Funktion freigeschaltet ist, läuft der Ablauf so:

1. Im Tab **Neu** auf **📸 Lieferschein fotografieren / hochladen** tippen.
2. Lieferschein fotografieren oder ein Foto wählen.
3. Animation **„Die KI liest den Lieferschein für uns...“** abwarten.
4. In der Vorschau **Name**, **Liefermenge** und **vorgeschlagenes MHD** prüfen.
5. **📥 Artikel in den Bestand einbuchen** tippen — Bestätigung: **„Lieferschein erfolgreich verbucht. Alle Bestände wurden erhöht!“**

Das **vorgeschlagene MHD** nutzt **Erfahrungswerte früherer Lieferungen** (Kennzeichen **Erfahrungswert**). Ohne Historie schlägt unsere App je Warengruppe vor — z. B. MoPro/Milch **14 Tage**, Wurst **10 Tage**, Trockenware **90 Tage**; sonst **7 Tage** (Kennzeichen **Standard-Haltbarkeit**). Jedes MHD lässt sich vor dem Einbuchen als `TT.MM.JJJJ` anpassen.

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

**Wissen** öffnen wir über das **Verwaltungs-Menü** (wenn freigeschaltet). Dort gibt es zwei aufklappbare Bereiche:

- **🥩 Fleisch-Lexikon (Cuts)**: Wir suchen nach Zuschnitten, regionalen Namen und passenden Verwendungen.
- **📋 Hofladen-Handbücher**: Wir lesen die kurzen Anleitungen zu MHD-Ablauf-Regeln, Reinigung der Wurstküche und HACCP-Erklärung.

Die Filter im Fleisch-Lexikon sind für das Laden-iPhone groß genug, damit wir sie auch im Arbeitsalltag sicher treffen.

![StevesHof Wissen · Fleisch-Lexikon](./modulanleitungen/screenshots/steveshof-06-wissen.png)

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

**HACCP** öffnen wir über das **Verwaltungs-Menü** (wenn freigeschaltet). Dort tragen wir die aktuellen Werte unserer Kühlstellen ein und dokumentieren Reinigungen.

1. **HACCP** öffnen.
2. Wir sehen je Kühlstelle eine Karte, zum Beispiel **Kühlauslage Hofladen** oder **TK-Truhe**, mit dem Hinweis, welcher Wert in Ordnung ist (z. B. *„Alles gut bis 7 °C.“*).
3. Den gemessenen Wert in das große Feld **„____ °C“** eintippen.
4. **Speichern** tippen. Es erscheint kurz **Wert gespeichert**.

Ist ein Wert zu hoch – zum Beispiel die Kühlung über 7 °C – färbt sich das Feld dezent orange und wir sehen sofort den Hinweis **„⚠️ Wert erhöht! Bitte Kühlung prüfen.“**. Den Wert speichern wir trotzdem, damit nichts verloren geht, und kümmern uns gleich um die Kühlung.

Unter jeder Karte steht der zuletzt eingetragene Wert (z. B. *„Heute, 08:30 – 3,5 °C (in Ordnung)“*), damit wir auf einen Blick sehen, was heute schon kontrolliert wurde.

Ohne Internet ist das kein Problem: Unsere App zeigt dann **Lokal vorgemerkt** und überträgt den Wert automatisch, sobald WLAN wieder verfügbar ist.

![StevesHof HACCP Temperaturen](./modulanleitungen/screenshots/steveshof-05-haccp.png)

---

## Liefertag: Kurzfassung

1. CharcuLogic öffnen — **Profil** wählen, falls gefragt.
2. **MHD**-Kontrolle erscheint automatisch; offene Punkte bearbeiten und **Änderungen speichern**.
3. Zu **Neu** wechseln (ggf. erneut Profil bestätigen).
4. Kategorie für die aktuelle Warenart einmal wählen.
5. Artikel scannen, **Posten hinzufügen**, nächsten Artikel scannen.
6. **Gesamte Lieferung abschließen**.
7. Bei Fleischware: Tab **Herkunft** — Etikett fotografieren, LOT eintragen, speichern.
8. Vor dem Wechsel zu einer anderen Warenart die Kategorie einmal ändern.

## App aktualisieren (nach Büro-Update)

Wenn uns das Büro bittet, die App zu aktualisieren:

1. Offene Eingaben kurz **speichern** oder abbrechen.
2. Oben rechts den **runden Pfeil ↻** tippen (**App aktualisieren**).
3. Warten, bis die App neu lädt.
4. Ggf. Geräte-Zugang und **Profil** erneut wählen.

Falls die App hängen bleibt (weißer Bildschirm, ständig Anmeldung): einmal  
`https://hofsync-production.web.app/?reset=true` in Safari öffnen, dann Schritt 4.

## Hilfe

| Problem | Lösung |
|---------|-------|
| Laden-iPhone zeigt die Anmeldung | Mit `bestellung@steveshof-hofladen.de` anmelden, danach Profil wählen. |
| „Bitte zuerst dein Profil wählen“ | Namen aus der Profil-Liste oder **Andere** tippen. |
| Passwort fehlt oder funktioniert nicht | Internen Ansprechpartner um ein neues Passwort für den Hofladen-Zugang bitten. |
| Falsche Kategorie für nächsten Scan | Kategorie im Formular anpassen, bevor der nächste Posten erfasst wird. |
| Kategorie eines gespeicherten Artikels ist falsch | **Neu → Letzte Eingänge** öffnen, Kategorie auswählen und speichern. |
| Lieferung lässt sich nicht abschließen | Profil prüfen (oben rechts), WLAN prüfen, **↻** App aktualisieren. |
| Kein Internet beim Speichern | Erfassung fortsetzen. Unsere App zeigt **Lokal vorgemerkt** und synchronisiert automatisch, sobald WLAN wieder verfügbar ist. |
| KI-Lieferschein-Button fehlt unter **Neu** | Am Laden-iPhone noch nicht freigeschaltet — Ware per Barcode scannen. |
| **Box**-Button in der MHD-Karte | Retter-Box vormerken. Drucken und Verkauf im Büro-Bereich (Admin). |
| Herkunft speichern schlägt fehl | Profil prüfen, Foto erneut aufnehmen, WLAN prüfen; Offline speichert unsere App nach. |
| App-Update | Pfeil **↻** oben rechts; bei hartnäckigen Problemen `?reset=true` (siehe oben). |

## Logout am Laden-iPhone

Unser Laden-iPhone bleibt im Normalbetrieb angemeldet. Ein Logout-Button wird im Hofladen-Modus deshalb nicht angezeigt — so vermeiden wir versehentliches Abmelden während des Verkaufs.

---

*CharcuLogic · StevesHof Hofladen · `StevesHof_Hauptbetrieb`*
