# White-Label Setup – Neuer Betrieb in 5 Minuten

Offizielles Handbuch für **Entwickler und Administratoren**, um einen neuen Mandanten (Betrieb) auf der CharcuLogic/HofSync-Plattform einzurichten.

> **Zeitaufwand:** ca. 5 Minuten, wenn Firebase-Zugang und Terminal bereitstehen.

---

## 🎨 Schritt 1: Das visuelle Branding (`web/branding.js`)

Alle sichtbaren Texte und Farben des Betriebs liegen in **einer einzigen Datei**:

```text
web/branding.js
```

### Betriebsname anpassen

Öffne die Datei und passe mindestens diese Felder an:

| Feld | Wirkung |
|------|---------|
| `betriebsName` | Name im Header, Login-Screen und als **voller App-Name** auf dem Homescreen (PWA) |
| `appName` | Kurzname in der Navigationsleiste und als **Icon-Beschriftung** unter dem App-Symbol |

**Beispiel:**

```javascript
const BRANDING = {
  appName: "HofSync",
  betriebsName: "Metzgerei Müller",
  // …
};
```

### Farben – gesamtes UI & PWA-Icon

Die Farbvariablen steuern Look & Feel der App **ohne CSS anfassen zu müssen**:

| Variable | Steuert u. a. |
|----------|----------------|
| `primaryColor` | Buttons, Akzente, **Statusleiste**, Browser-Tab (`theme-color`) und **PWA-Rahmenfarbe** auf dem Homescreen |
| `lightBg` | Hintergrund beim App-Start und im PWA-Manifest (`background_color`) |

**Beispiel für einen roten Metzgerei-Look:**

```javascript
const BRANDING = {
  appName: "HofSync",
  betriebsName: "Metzgerei Müller",

  primaryColor: "#c62828",   // Rot – Buttons, Theme-Leiste, PWA-Akzent
  lightBg: "#fff8f8",        // Heller Hintergrund beim Laden

  supportEmail: "info@metzgerei-mueller.de",
  standardBereich: "Frische & Kühlung",

  modules: {
    mhdMonitor: true,
    wareneingang: true,
    wurstkueche: true,
    haccp: true,
    orders: true,
  },
};
```

**So wirken die Farben technisch:**

1. `web/index.html` liest `window.BRANDING` **beim Start** und baut daraus das **PWA-Manifest** (`theme_color`, `background_color`, `name`).
2. `web/app.js` → `applyBranding()` setzt Betriebsname und `theme-color` im Browser.
3. Buttons und Highlights in der App nutzen die CSS-Variable `--primary-color` (Standard: Grün `#28a745`).

> **Tipp:** Passe bei einem komplett neuen Erscheinungsbild auch `web/icon-192.png` und `web/icon-512.png` an – das sind die App-Symbole auf dem Homescreen.

---

## 🗄️ Schritt 2: Den Mandanten in der Datenbank anlegen

Jeder Betrieb bekommt eine eigene **`tenantId`** (z. B. `metzgerei_mueller`).  
Regeln: **klein schreiben**, **Unterstriche statt Leerzeichen**, keine Sonderzeichen.

### 2a · Firebase Authentication – Admin-Nutzer anlegen

1. Öffne die [Firebase Console](https://console.firebase.google.com/) → dein Projekt.
2. Gehe zu **Authentication** → **Users** → **Add user**.
3. E-Mail + Passwort eingeben → **Add user**.
4. Die **UID** des neuen Nutzers kopieren (Spalte „User UID“).

### 2b · Cloud Firestore – Profil-Dokument erstellen

1. Gehe zu **Firestore Database**.
2. Collection **`users`** anlegen (falls noch nicht vorhanden).
3. Neues Dokument mit der **UID als Document ID** erstellen.
4. Folgende Felder eintragen:

| Feld | Typ | Beispielwert | Bedeutung |
|------|-----|---------------|-----------|
| `role` | string | `"admin"` | Voller Zugriff auf Büro-Leitstand, Rezepte, Bulletin |
| `tenantId` | string | `"metzgerei_mueller"` | Eindeutige Mandanten-ID – muss überall gleich heißen |

**Beispiel-Dokument:**

```json
{
  "role": "admin",
  "tenantId": "metzgerei_mueller"
}
```

> **Wichtig:** Das Profil kann **nicht aus der App heraus** geschrieben werden (`users/{uid}` ist schreibgeschützt). Anlegen nur über Firebase Console oder Admin SDK.

Beim ersten Login liest `web/auth.js` dieses Dokument, setzt die Mandanten-ID und öffnet den Zugang zum Betrieb.

### 🔒 Sicherheit – Mandantentrennung

Durch das Modul **`web/tenant-db.js`** greift die App **ausschließlich** auf Daten unter folgendem Pfad zu:

```text
/tenants/{tenantId}/
```

Beispiele:

```text
/tenants/metzgerei_mueller/mhd_liste/…
/tenants/metzgerei_mueller/tasks/…
/tenants/metzgerei_mueller/rezepte/…
```

Die Firestore-Rules in `firebase.rules` erlauben Lese-/Schreibzugriff **nur**, wenn der angemeldete Nutzer zur gleichen `tenantId` gehört. Betrieb A sieht **niemals** die Daten von Betrieb B – auch nicht bei versehentlich falscher Konfiguration im Frontend.

---

## 🚀 Schritt 3: Der Deployment-Workflow

### 3a · Firebase-Projekt verknüpfen (`.firebaserc`)

Im Projektroot liegt die Datei **`.firebaserc`**. Sie mappt **Alias-Namen** auf Firebase-Projekt-IDs:

```json
{
  "projects": {
    "default": "hofsync-production",
    "metzgerei_mueller": "metzgerei-mueller-prod"
  }
}
```

| Schlüssel | Bedeutung |
|-----------|-----------|
| `default` | Projekt, das ohne Angabe von Alias verwendet wird |
| `metzgerei_mueller` | Frei wählbarer Alias für den neuen Betrieb |
| Wert rechts | Echte **Project ID** aus der Firebase Console |

**Neues Firebase-Projekt anlegen (einmalig):**

1. [Firebase Console](https://console.firebase.google.com/) → **Add project**.
2. Authentication (E-Mail/Passwort), Firestore und Storage aktivieren.
3. Project ID notieren und in `.firebaserc` eintragen.
4. In `web/app.js` das Objekt **`firebaseConfig`** mit den Werten aus **Project settings → Your apps → Web app** ersetzen.

### 3b · Online bringen – Terminal-Befehle

Im Projektordner (`craft_food_app/`):

```bash
# Einmalig: bei Firebase anmelden
firebase login

# Alias des neuen Betriebs aktivieren
firebase use metzgerei_mueller

# App + Regeln deployen
firebase deploy --only hosting,firestore,storage
```

| Befehl | Was passiert |
|--------|--------------|
| `firebase use <alias>` | Schaltet CLI auf das richtige Firebase-Projekt |
| `firebase deploy --only hosting,firestore,storage` | Lädt PWA hoch, rollt Security-Rules aus, aktiviert Datei-Uploads |

**Optional – Cloud Functions (Push, KI-Fleischpreise):**

```bash
firebase deploy --only functions
```

### 3c · Checkliste nach dem Deploy

- [ ] `web/branding.js` angepasst (Name + Farben)
- [ ] `web/app.js` → `firebaseConfig` zeigt auf das richtige Projekt
- [ ] Admin-Nutzer in Authentication angelegt
- [ ] `users/{uid}` mit `role` + `tenantId` in Firestore
- [ ] App-URL aus Firebase Hosting öffnen → Login testen
- [ ] Auf dem Handy: **„Zum Home-Bildschirm hinzufügen“** → Branding prüfen

---

## Kurzreferenz

```text
Branding     →  web/branding.js
Firebase-Keys → web/app.js (firebaseConfig)
Mandant-ID   →  Firestore: users/{uid}.tenantId
Datenpfad    →  /tenants/{tenantId}/…
Deploy       →  firebase use <alias> && firebase deploy --only hosting,firestore,storage
```

Bei Fragen zur Architektur: [docs/TECHNIK_BACKEND.md](docs/TECHNIK_BACKEND.md)
