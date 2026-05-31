# StevesHof Hofladen: Walkthrough für das Team (CharcuLogic)

Diese Anleitung gilt für den Mandanten **StevesHof** (`tenantId: StevesHof_Hauptbetrieb`). Die App erscheint als **CharcuLogic** (grüner Hofladen-Stil).

**Weitere Mandanten:** [Dokumentations-Übersicht](./README.md) · **TorFabrik:** [KOLLEGEN_ANLEITUNG_TORFABRIK.md](./KOLLEGEN_ANLEITUNG_TORFABRIK.md)

**Ausführliche Modulanleitungen (alle Details):** [modulanleitungen/README.md](./modulanleitungen/README.md)

## Mitarbeiter & PINs (PIN-Login unter Start)

| Mitarbeiter | PIN |
|-------------|-----|
| Stephie | `1122` |
| Finn | `2233` |
| Nicole | `3344` |
| Bettina | `4455` |
| Heiko | `5566` |
| Paddy | `6677` |

Die Liste wird aus der **Team-Konfiguration** geladen (`tenants/StevesHof_Hauptbetrieb/settings/teamDashboard`). Admins können sie unter **Büro → Leitstand → Team-Konfiguration** pflegen.

## Tabs in der unteren Leiste

| Tab | Zweck |
|-----|--------|
| **Start** | Anmeldung, Nachricht des Tages, Aufgaben, Historie |
| **Team** | Nachrichten senden, Team-Infos, Kundenbestellungen |
| **MHD** | Morgencheck Verkauf & Kühlung |
| **Neu** | Wareneingang Laden & Metzgerei |
| **Prod.** | Rezepte, Produktion, WRS-Kalkulation |
| **HACCP** | Produktionsprotokoll & Tageskontrollen |
| **Büro** | Chargen, Rezept-Sync, Leitstand (Admin) |

---

## 1. Start (Schwarzes Brett + Aufgaben)

Der Tab **Start** ist der Einstieg für das Team.

1. App öffnen und im Tab **Start** bleiben.
2. **Mitarbeiter** eintippen (Vorschläge aus der Liste) und **PIN** (4-stellig) eingeben.
3. Auf **Anmelden** tippen – unter **Angemeldet als:** erscheint der Name.
4. **Nachricht des Tages** lesen (inkl. Bilder/PDF-Anhänge).
5. **Mein Bereich** prüfen (z. B. Laden / Verkauf, Metzgerei / Produktion, Küche / Gastro).
6. Offene Punkte unter **Meine Aufgaben** mit **✓** quittieren.
7. Erledigte Aufgaben in der **Erledigt-Historie** nachsehen (Zeitraum: **Heute**, **7 Tage**, **30 Tage**, **Alle**).

Unter **Team-Infos für mich** seht ihr dieselben Nachrichten wie im Tab **Team** – ohne Tabwechsel.

![Start-Tab mit Anmeldung, Nachricht und Aufgaben](./modulanleitungen/screenshots/00-start.png)

---

## 2. Team (Nachrichten & Bestellungen)

Für Kommunikation und Kundenaufträge.

### Nachrichten

1. Tab **Team** öffnen (ohne Anmeldung erscheint ein Hinweis – zuerst unter **Start** anmelden).
2. Optional: **Push** für neue Infos aktivieren.
3. Unter **Nachricht senden** Info oder Aufgabe an Kollegen, Gruppen oder Schichten schicken.
4. Eingehende Einträge unter **Team-Infos für mich** mit **✓** quittieren.

### Bestellungen

1. Im Team-Tab auf **🛒 Bestellungen** wechseln.
2. Kunde, Rückruf, **Bereit am** und Positionen erfassen.
3. Optional Bestellzettel fotografieren oder PDF anhängen.
4. **Bestellung speichern** – offene Bestellungen stehen darunter zur Bearbeitung.

![Team-Tab Nachrichten und Bestellungen](./modulanleitungen/screenshots/07-team.png)

---

## 3. MHD (täglicher Morgencheck)

Im Tab **MHD** prüft ihr, welche Ware sofort bearbeitet werden muss.

1. Tab **MHD** öffnen.
2. In der Toolbar **Bereich**, **Ansicht** und (bei Frische) **Kategorie** wählen – typisch morgens: **Frische & Kühlung · ALARM · Alle**.
3. Optional **🔍 Artikel suchen** für gezielte Suche.
4. Karten nacheinander bearbeiten:
   - **✓ OK**
   - **↩️ Raus**
   - **🥣 Küche**
   - **🗑️ Ausverkauft**
5. Menge bei Bedarf mit **− / +** korrigieren.
6. Am Ende **💾 Änderungen speichern** (bei Cloud-Sync).

![MHD Übersicht](./modulanleitungen/screenshots/01-mhd-monitor.png)
![MHD Kartenbeispiel](./modulanleitungen/screenshots/01b-mhd-karte.png)
![MHD Suche geöffnet](./modulanleitungen/screenshots/01c-mhd-suche-offen.png)

---

## 4. Neu (Wareneingang)

Der Tab **Neu** erfasst Lieferungen – oben wählt ihr **Laden** oder **Metzgerei**.

### Laden (Schnellerfassung)

1. Tab **Neu** → **Laden**.
2. **Kategorie** setzen, **Barcode scannen** oder **EAN** eintippen und **OK**.
3. Bei bekannter EAN: grüne Zeile **Erkannt:** – sonst **Produktname** ergänzen.
4. **Menge** und **MHD** eintragen.
5. **➕ Posten hinzufügen** – weitere Artikel wiederholen.
6. Optional **Letzte Eingänge** / **Stammdaten**.

### Metzgerei

1. Auf **Metzgerei** wechseln.
2. **Lieferant** (oder **🏠 Eigenproduktion**), **Waren-Kategorie**, **Temperatur**.
3. **📸 Lieferscheine fotografieren** (morgens reicht oft ein Entwurf).
4. **📝 Als offenen Entwurf speichern** oder mit Posten **💾 Gesamte Lieferung abschließen**.
5. Offene Entwürfe unten unter **📋 Offene Lieferungen zur Nachbearbeitung** fortsetzen.

![Neu – Laden](./modulanleitungen/screenshots/02-wareneingang-schnell.png)
![Barcode-Scanner](./modulanleitungen/screenshots/02b-barcode-scanner.png)
![Erkannter Posten](./modulanleitungen/screenshots/02c-posten-erkannt.png)
![Neu – Metzgerei](./modulanleitungen/screenshots/03-wareneingang-metzgerei.png)
![Lieferscheinfotos](./modulanleitungen/screenshots/03b-lieferschein-fotos.png)

---

## 5. Prod. (Wurstküche)

Der Tab **Prod.** hat zwei aufklappbare Bereiche:

- **Rezepte** (standardmäßig offen) – Suche, Kategorien, Rezeptliste, Detail mit Produktionsmenge und Verkaufseinheiten.
- **WRS Kalkulation** (standardmäßig zu) – BEFFE-Skalierer, Kosten, Einwiege-Packliste.

Ablauf Produktion:

1. Rezept antippen → Detail öffnen.
2. **Tagesproduktion (kg)** einstellen, Zutaten und Schritte prüfen.
3. **Charge dokumentieren** – Daten erscheinen später unter **Büro**.

![Prod. – Rezeptliste](./modulanleitungen/screenshots/04-wurstkueche.png)
![Prod. – Rezeptdetail](./modulanleitungen/screenshots/04b-rezept-detail.png)

---

## 6. HACCP

Im Tab **HACCP** dokumentiert ihr Produktion und Tageskontrollen.

### Produktions-Protokoll (oben)

1. **Kerntemperatur** und **pH-Wert** einstellen.
2. **Chargen-Nummer** prüfen oder mit **⚡ Neu** erzeugen.
3. **📝 Protokoll eintragen**.

### Tageskontrollen (Mitte)

Umschalter **Temperaturen** · **Reinigung** · **Geräte** – Messwerte eintragen und mit **OK** bzw. **Reinigung erledigt** bestätigen.

### Export (unten)

**🖨️ Druckansicht generieren** – Protokolle der letzten 7 Tage für Behördenkontrollen.

![HACCP Übersicht](./modulanleitungen/screenshots/05-haccp.png)
![HACCP Temperaturen](./modulanleitungen/screenshots/05b-haccp-temperaturen.png)
![HACCP Reinigung](./modulanleitungen/screenshots/05c-haccp-reinigung.png)

---

## 7. Büro (Chargen & Leitstand)

Der Tab **Büro** dient der Rückverfolgung und (mit Admin-Rechten) der Pflege von Nachricht und Team-Konfiguration.

1. Tab **Büro** öffnen.
2. **Rezeptdaten-Prüfung**: Masterliste vs. Cloud prüfen.
3. Nach **Charge, Rezept oder Macher** suchen und Einträge kontrollieren.
4. Admins: **Leitstand** – Nachricht des Tages veröffentlichen, Team-Gruppen pflegen.

![Büro – Chargenübersicht](./modulanleitungen/screenshots/06-chargen.png)
![Büro – Chargenliste](./modulanleitungen/screenshots/06b-chargen-liste.png)

---

## Morgenroutine (Kurz)

1. **Start**: anmelden, Nachricht lesen, Aufgaben abarbeiten.
2. **MHD**: Filter **ALARM**, Karten bearbeiten, speichern.
3. **HACCP**: **Temperaturen** (und bei Bedarf **Reinigung**) dokumentieren.
4. **Neu > Metzgerei**: Lieferschein-Fotos als Entwurf, Posten nachmittags nachziehen.

## Liefertag (Kurz)

1. **Neu > Laden**: Ware per Scan erfassen.
2. **Neu > Metzgerei**: Lieferant, Temperatur, Fotos.
3. **Gesamte Lieferung abschließen** – Status und offene Entwürfe prüfen.

## Kundenbestellung (Kurz)

1. **Start** anmelden.
2. **Team > Bestellungen**: Auftrag aufnehmen, Zettel anhängen.
3. Produktion plant über **Prod.** / Team-Infos.
