# Team (Nachrichten & Bestellungen)

Der Tab **Team** bündelt Kommunikation und Kundenbestellungen. Die Anmeldung erfolgt immer zuerst unter **Start** (Name + PIN).

**Mitarbeiter & PINs** sind mandantenabhängig (z. B. TorFabrik: Stephan, Boris, Aushilfe). Sie werden aus `tenants/{tenantId}/settings/teamDashboard` geladen – siehe [Kollegen-Anleitungen](../README.md).

> **StevesHof Hofladen:** Im aktuellen schlanken Hofladen-Profil ist der Tab **Team** ausgeblendet. Das gemeinsame Laden-iPhone arbeitet neutral als `StevesHof-Team` ohne zusätzliche Mitarbeiter-PIN. Diese Anleitung bleibt für andere Mandanten und eine mögliche spätere Freischaltung erhalten.

![Team – Nachrichten und Bestellungen](./screenshots/07-team.png)

## Nachrichten

### Benachrichtigungen

- **Push** optional aktivieren – sonst nur Anzeige in der App.
- Statuszeile zeigt, ob Push registriert ist.

### Nachricht senden

- **Info** oder **Aufgabe** an alle, Gruppen, einzelne Kollegen oder Schichten.
- Empfänger und Priorität (Rot / Gelb / Grün) wählen.
- Gesendete Infos erscheinen bei den Empfängern unter **Team-Infos für mich** (auch auf **Start**).

### Team-Infos für mich

- Eingehende Nachrichten und Aufgaben.
- Mit **✓** quittieren, wenn erledigt oder gelesen.

## Bestellungen

Wechsel über **🛒 Bestellungen** in der Team-Leiste.

### Kundenbestellung aufnehmen

| Feld | Bedeutung |
|------|-----------|
| **Name des Kunden** | Pflicht |
| **Rückrufnummer** oder **E-Mail** | mindestens eines empfohlen |
| **Bereit am** / **Uhrzeit** | Abholtermin |
| **Bestellpositionen** | Artikelzeilen mit **+ Position** |
| **Weitere Wünsche** | z. B. mariniert, vakuumiert, TK |
| **Bestellzettel** | Foto oder PDF – Übergang reicht oft ohne alle Details |

**Angenommen von** wird automatisch aus der Anmeldung unter **Start** übernommen.

### Offene Bestellungen

Liste aller noch nicht erledigten Kundenaufträge – für Küche und Verkauf zur Planung.

## Typischer Ablauf

1. Unter **Start** anmelden.
2. Tab **Team** → Nachricht lesen oder neue Info senden.
3. Bei Kundenwunsch: **Bestellungen** → Formular ausfüllen → **Bestellung speichern**.
4. Küche sieht den Auftrag über Team-Infos / Produktionsplanung.

## Hinweis

Ohne Anmeldung bleibt der Bereich sichtbar, zeigt aber den Hinweis: *Bitte zuerst unter Start mit Name und PIN anmelden.*

## Shared Terminals (gemeinsame Geräte)

Auf Hofladen-Terminals, die von mehreren Betrieben oder Schichten genutzt werden, merkt sich die App Mitarbeiter und Bereich **pro Mandant** — nicht global im Browser. Technisch prefixiert `web/teamboard-storage.js` alle Terminal-Einstellungen mit der `tenantId` (z. B. `torfabrik_charculogic_active_employee`). Beim Betriebs-Logout werden mandantenspezifische Einstellungen gelöscht, damit keine Auswahl an den nächsten Mandanten „durchblutet“.
