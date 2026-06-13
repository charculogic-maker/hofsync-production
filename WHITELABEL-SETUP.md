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

Öffne die Datei und trage den neuen Mandanten unter **`TENANT_BRANDING`** ein (Schlüssel = `tenantId`):

| Feld | Wirkung |
|------|---------|
| `betriebsName` | Name im Header, Login-Screen und als **voller App-Name** auf dem Homescreen (PWA) |
| `appName` | Kurzname in der Navigationsleiste und als **Icon-Beschriftung** unter dem App-Symbol |

> **Pflicht:** Ohne Eintrag in `TENANT_BRANDING` greift nur die neutrale White-Label-Vorlage (`DEFAULT_BRANDING`, z. B. „Betriebs-App“) — kein fremder Betriebsname wird mehr angezeigt. Die Browser-Konsole warnt: *Kein Mandanten-Profil gefunden*.

### Farben – gesamtes UI & PWA-Icon

Die Farbvariablen steuern Look & Feel der App **ohne CSS anfassen zu müssen**:

| Variable | Steuert u. a. |
|----------|----------------|
| `primaryColor` | Buttons, Akzente, **Statusleiste**, Browser-Tab (`theme-color`) und **PWA-Rahmenfarbe** auf dem Homescreen |
| `lightBg` | Hintergrund beim App-Start und im PWA-Manifest (`background_color`) |

**Beispiel:**

```javascript
const TENANT_BRANDING = {
  metzgerei_mueller: {
    appName: "HofSync",
    betriebsName: "Metzgerei Müller",
    primaryColor: "#c62828",
    lightBg: "#fff8f8",
    modules: {
      mhdMonitor: true,
      wareneingang: true,
      wurstkueche: true,
      knowledge: false,
      cutGlossary: false,
      haccp: true,
      orders: true,
    },
  },
};
```

Die Modul-Flags können auch ein bewusst schlankes Terminalprofil abbilden. Beispiel StevesHof Hofladen (`web/branding.js`): `mhdMonitor`, `wareneingang`, `wurstkueche`, `knowledge`, `haccp`, `batches` und `retterBox` sind aktiv; `teamboard`, `team`, `orders`, `wareneingangMetzgerei` und `cutGlossary` bleiben deaktiviert. Dadurch sieht das Laden-iPhone MHD, Neu, Prod., HACCP und Wissen, aber keinen Team-/Start-Tab.

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

### 2c · Custom Claims setzen (Pflicht für Rules)

Firestore-Rules prüfen **ausschließlich** `request.auth.token.tenantId` und `request.auth.token.role` — nicht das Firestore-Profil allein.

Nach Anlage des Admin-Nutzers Claims synchronisieren:

```bash
node tools/set-user-claims.mjs --uid=<UID> --project=<PROJECT_ID>
```

Beim ersten Login liest `web/auth.js` Claims (und ggf. Profil als Fallback für die UI), setzt die Mandanten-ID und öffnet den Zugang zum Betrieb.

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

Die Firestore-Rules in `firebase.rules` erlauben Lese-/Schreibzugriff **nur**, wenn `request.auth.token.tenantId` dem Pfad-Mandanten entspricht. Payload-Manipulation (falsche `tenantId` im JSON) oder URL-Tricks werden serverseitig abgewiesen. Betrieb A sieht **niemals** die Daten von Betrieb B.

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
4. In **`web/firebase-config.js`** die Web-App-Konfiguration und **`appCheckRecaptchaSiteKey`** eintragen (Project settings → Your apps → Web app).

### 3a-bis · App Check (reCAPTCHA v3) — Pflicht

Ohne gültigen App-Check-Site-Key startet die App **nicht** in den Callable-Modus (harte Blockade in `web/app-check.js`).

1. Firebase Console → **App Check** → Web-App registrieren.
2. Provider **reCAPTCHA v3** → Site Key kopieren.
3. In `web/firebase-config.js` unter `appCheckRecaptchaSiteKey` eintragen (kein `REPLACE_`-Platzhalter).
4. Debug-Token für lokale Entwicklung registrieren (siehe [docs/TECHNIK_BACKEND.md §4.5](docs/TECHNIK_BACKEND.md)).

### 3b · Online bringen – Terminal-Befehle

Im Projektordner (`craft_food_app/`):

```bash
# Einmalig: bei Firebase anmelden
firebase login

# Alias des neuen Betriebs aktivieren
firebase use metzgerei_mueller

# Pre-Deploy-Validierung (Service-Worker-Guard, Syntax, PWA)
npm run build

# Standard-Release: Rules + Functions + Hosting
firebase deploy --only "firestore:rules,functions,hosting"

# Storage-Rules separat (bei Bedarf)
firebase deploy --only storage
```

| Befehl | Was passiert |
|--------|--------------|
| `npm run build` | 6 Checks inkl. **Service-Worker-Version-Guard** — bei Änderungen an `app.js`/`mhd.js`/`index.html` muss `CACHE_NAME` in `web/sw.js` erhöht werden |
| `firebase use <alias>` | Schaltet CLI auf das richtige Firebase-Projekt |
| `firebase deploy --only "firestore:rules,functions,hosting"` | Rules, Cloud Functions (App-Check-Gateway) und PWA |

**Optional — nur Hosting nach Frontend-Fix:**

```bash
npm run build && firebase deploy --only hosting
```

### 3c · Checkliste nach dem Deploy

- [ ] `web/branding.js` → `TENANT_BRANDING[<tenantId>]` angepasst (Name + Farben)
- [ ] `web/firebase-config.js` → Projekt-Keys + **`appCheckRecaptchaSiteKey`**
- [ ] Firebase Console → App Check → Web-App registriert, Enforcement aktiv
- [ ] Custom Claims gesetzt (`node tools/set-user-claims.mjs …`)
- [ ] Admin-Nutzer in Authentication angelegt
- [ ] `users/{uid}` mit `role` + `tenantId` in Firestore
- [ ] `npm run build` grün; bei Frontend-Änderungen `web/sw.js` → `CACHE_NAME` erhöht
- [ ] App-URL aus Firebase Hosting öffnen → Login testen
- [ ] Auf dem Handy: **„Zum Home-Bildschirm hinzufügen“** → Branding prüfen
- [ ] Optional: `cd functions && npm run test:security`

---

## Kurzreferenz

```text
Branding      →  web/branding.js (TENANT_BRANDING)
Firebase-Keys →  web/firebase-config.js (+ appCheckRecaptchaSiteKey)
Mandant-ID    →  Custom Claims tenantId + Firestore users/{uid}
Datenpfad     →  /tenants/{tenantId}/…
Terminal-Keys →  web/teamboard-storage.js ({tenantId}_…)
Build         →  npm run build
Deploy        →  firebase use <alias> && firebase deploy --only "firestore:rules,functions,hosting"
```

Bei Fragen zur Architektur: [docs/TECHNIK_BACKEND.md](docs/TECHNIK_BACKEND.md)
