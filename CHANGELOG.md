# CharcuLogic - Entwicklungstagebuch & Changelog

Chronologisches Protokoll der wichtigsten Meilensteine. **Neueste Einträge stehen oben.**

---

## [v1.2.0] - 2026-06-02

### Sicherheit & Multi-Tenancy (P0-Release)

- **App Check Pflicht:** reCAPTCHA v3 via Compat SDK (`web/app-check.js`); harte Initialisierungsblockade bei fehlenden Site Keys; Gateway auf Callables (`enforceAppCheck: true`).
- **Mandantenisolation:** Firestore-Rules strikt claim-gesteuert (`request.auth.token.tenantId`); `system_errors` Write-Only-Schema; `pushTokens` Client-Read gesperrt.
- **Fleischpreis-Engine:** Callable `triggerManualMeatPriceRun` nutzt Token-`tenantId` — kein Cross-Tenant-Schreiben mehr.
- **Shared Terminals:** `web/teamboard-storage.js` — localStorage-Keys mit `{tenantId}_`-Prefix; Cleanup beim Logout.
- **Operator-UX:** `web/operator-errors.js` — deutsche Toast-Texte; Anti-Double-Click-Locks auf kritischen Schreibpfaden.
- **Build-Pipeline:** `npm run build` mit Service-Worker-Version-Guard (`tools/check-web-app.mjs`).
- **Security-Tests:** Vitest-Suite `functions/tests/security.test.js`; erweiterte Rules-Tests für `system_errors` und `pushTokens`.

---

## [v1.1.0] - 2026-05-29

### Hinzugefügt (White-Label & Multi-Tenant)

- Komplettes White-Labeling über zentrale `web/branding.js` (Farben, App-Name, Betriebs-Name).
- Dynamische PWA-Manifest-Generierung via Blob-URL in `index.html` für Homescreen-Personalisierung.
- Login-Overlay und Seitentitel nutzen `applyBranding()` aus `web/app.js`.
- CSS-Kernfarben als White-Label-Variablen in `web/style.css` (`--primary-color`, `--dark-header-bg`, `--accent-alert`, …).
- Echte Backend-Mandantentrennung (`web/tenant-db.js`) – alle Betriebsdaten laufen isoliert unter `/tenants/{tenantId}/`.
- Zentrale Hilfsfunktion `getTenantCollection()`; Module (MHD, HACCP, Team, Produktion, …) angebunden.

### Optimiert (UX-Feedback von Stephie & Finn / StevesHof)

- **Mengenfeld:** Standard-Eins entfernt, `placeholder="1"` gesetzt und Smartphone-Ziffernblock (`inputmode="numeric"`) erzwungen; leere Eingabe wird als Menge 1 interpretiert.
- **Kategorie-Gedächtnis:** System merkt sich die zuletzt genutzte Kategorie beim Scannen, um Massen-Scans (z. B. MoPro) zu beschleunigen.
- **Manueller Fallback:** Wenn ein Barcode unbekannt ist, blockiert die App nicht mehr, sondern bietet ein Banner an, um den Artikel direkt manuell anzulegen (Wareneingang + MHD-Monitor).

### Technik

- Service-Worker-Cache und `tools/check-web-app.mjs` (6 Checks) für Deploy-Sicherheit.

---

## [v1.0.2] - 2026-05-28

### Hinzugefügt

- Team-Nachrichten für alle Mitarbeiter; Posteingang auf **Start** und **Team**.
- Deutsche Datumseingaben (`date-input.js`) und kompakte Prioritäts-Auswahl für Aufgaben.

### Geändert / Behoben

- Wareneingang: getrennte Kategorien **Laden** vs. **Metzgerei**; stabilere Offline-Synchronisation.
- Mitarbeiter-Rollen: Zugriff auf **MHD** und **Neu** für Team; Rezept-Seed nur noch für Admins.
- Modulanleitungen und Screenshots für Kollegen aktualisiert (`docs/modulanleitungen/`).

---

## [v1.0.1] - 2026-05-25

### Behoben

- Barcode-Scanner: `formatsToSupport` korrekt im Html5Qrcode-Konstruktor – zuverlässigeres Scannen von 1D-EANs in der Praxis.

---

## Hinweise zur Pflege

- Bei größeren Features, Fixes oder Releases einen neuen Abschnitt **oben** ergänzen.
- Versionsschema: `vMAJOR.MINOR.PATCH` – Datum im Format `YYYY-MM-DD`.
- Kategorien: `Hinzugefügt`, `Geändert`, `Optimiert`, `Behoben`, `Technik` (nach Bedarf).
