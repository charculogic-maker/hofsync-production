# Testmatrix: Betriebs-Admin UI & RBAC

Manuelle / E2E-Checks für `/dev-dashboard` und die Verwaltungs-Navigation.
Automatisierte Gegenstücke: `npm run test:functions:security`, `npm run test:rules`.

**Umgebung:** nur Staging / Whitelabel-Test / Emulator — nicht Production (`hofsync-production`).

| Rolle / Kontext | Ziel-Route / Aktion | Erwartetes UI-Verhalten | Backend-Grenze |
|-----------------|---------------------|-------------------------|----------------|
| Mitarbeiter / Helper | Sidebar / Bottom-Nav | Link **Verwaltung** ausgeblendet (`has-admin-nav` fehlt) | – |
| Mitarbeiter / Helper | Klick auf `#nav-admin-dashboard` (falls manipulierbar) | Toast „Die Verwaltung ist nur für Betriebs-Admins.“, kein Wechsel | Callables/Rules blocken |
| Mitarbeiter / Helper | Direktaufruf `/dev-dashboard` | Redirect auf `/` + Toast nach Reload | `useTenantAdminAuth()`; Callables `permission-denied` |
| Tenant-Admin (A) | `/dev-dashboard` öffnen | Tabs Übersicht / Nutzer / Einstellungen / Protokoll / Thekenklade | Claim `role: admin` + `tenantId: A` |
| Tenant-Admin (A) | Betrieb-Switcher (Super-Admin-Selector) | Selector unsichtbar / gesperrt | Rules: `request.auth.token.tenantId` |
| Tenant-Admin (A) | Fremden Tenant B in Callable `tenantId` setzen | UI sendet nur eigenen Tenant; bei Manipulation Fehler-Toast | `assertAdminAccessForTenant` → `permission-denied` |
| Tenant-Admin (A) | Einstellungen speichern (Name/Logo) | Lokaler Draft + Vorschau; Validation vor Speichern | Firestore: `displayName`/`logoUrl` nach Create für Tenant-Admin eingeschränkt; Module-Updates erlaubt |
| Tenant-Admin (A) | Modul-Toggle eigener Betrieb | Sofort sichtbar auf Geräten des Betriebs | Rules: Update nur `enabledModules`/`updatedAt` unter `tenants/A` |
| Tenant-Admin (A) | Nutzer anlegen / Rolle ändern | Tabelle aktualisiert, Protokoll-Eintrag lokal | `createTenantEmployee` / `manageTenantEmployees` + App Check |
| Super-Admin | `/dev-dashboard` | Plattform-Panel „Betriebe“, Tenant-Selector sichtbar | Platform-UID/E-Mail; Rules `isPlatformDevAdmin` |
| Ohne App-Check-Token | Callable `createTenantEmployee` / `manageTenantEmployees` | UI: generischer Fehler / Operator-Toast | HTTP 401/403 (Staging-Smoke) |
| Tenant A User | Lesen/Schreiben `tenants/B/...` | Kein UI-Pfad | Rules Emulator: `PERMISSION_DENIED` |

## Automatisierte Suites

| Suite | Befehl | Deckt |
|-------|--------|------|
| Callable RBAC + PIN/Fleischpreis | `npm run test:functions:security` | `permission-denied` ohne Admin; Cross-Tenant-Admin; App-Check-Contract |
| Firestore/Storage Rules | `npm run test:rules` | Cross-Tenant Isolation inkl. Tenant-Root Module |
| Staging App-Check Smoke | `SECURITY_TEST_CALLABLE_BASE_URL=… npm run test:functions:security` | fehlendes/gefälschtes App-Check-Header |

## Kurz-Checkliste vor Merge

- [ ] `npm run test:functions:security` grün
- [ ] `npm run test:rules` grün (Emulator)
- [ ] Manuell: Mitarbeiter sieht keinen Verwaltungs-Link
- [ ] Manuell: Mitarbeiter `/dev-dashboard` → Redirect + Toast
- [ ] Manuell: Tenant-Admin nur eigener Betrieb in Nutzerliste
