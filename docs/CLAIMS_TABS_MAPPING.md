# Claims ↔ sichtbare Tabs (HofSync)

Single Source of Truth für die **Session-Tab-Freigabe** nach Login.

## Auflösung

```
Custom Claims.role (+ optional claims.allowedModules / Profil)
        ↓
Tenant.enabledModules  ∩  settings/role_modules[role]  ∩  Nutzer-allowedModules
        ↓
resolveTabsForClaimRole()  →  Tab-IDs
        ↓
applyRoleBasedUi() blendet .nav-item[data-tab] aus
```

| Schicht | Quelle | Code |
|---------|--------|------|
| Claim-Rolle | Firebase ID-Token `role` (`admin` \| `employee` \| `helper`); `isAdmin`/`admin` → `admin` | `web/auth.js` → `roleFromClaims` |
| Tenant-Decke | `tenants/{id}.enabledModules` (Branding-Fallback) | `web/tenant-modules.js` |
| Rollen-Defaults | Code `DEFAULT_ROLE_MODULE_DEFAULTS`, Override `settings/role_modules` | `resolveRoleModuleAllowlist` |
| Nutzer-Feinrecht | `claims.allowedModules` oder Profil `allowedModules` | `resolveAccessModules` |
| Tab-IDs | `ACCESS_MODULE_TO_TAB` | `resolveTabsForClaimRole` / `resolveSessionAllowedTabs` |

Login ohne `tenantId` **und** `role` in den Claims schlägt fehl.

## Access-Key → Tab

| Access-Key | Tab-ID | Fußleiste (Laden) |
|------------|--------|-------------------|
| `mhd` | `mhd` | Primär **MHD** |
| `receiving` | `receiving` | Primär **Neu** |
| `orders` | `orders` | Primär **Packtisch** |
| `chargenDoku` | `chargenDoku` | Primär **Herkunft** |
| `start` | `teamboard` | Mehr → Start |
| `team` | `team` | Mehr → Team |
| `haccp` | `haccp` | Mehr → HACCP |
| `kitchen` | `kitchen` | Mehr → Prod. |
| `averyLabels` | `avery` | Mehr → Etiketten |
| `knowledge` | `knowledge` | Admin-Header / Theken-Auskunft (Employee + Admin) |
| `buero` | `batches` | Admin-Zone **Büro** |
| `retterBox` | — | kein Nav-Tab (Modul-Flag only) |

## Default-Matrix (alle Tenant-Module an, keine Nutzer-Overrides)

| Tab | `employee` | `admin` | `helper` |
|-----|:----------:|:-------:|:--------:|
| MHD | ✅ | ✅ | ✅ |
| Neu (Wareneingang) | ✅ | ✅ | ❌ |
| Packtisch | ✅ | ✅ | ❌ |
| Herkunft | ✅ | ✅ | ✅ |
| Start | ✅ | ✅ | ✅ |
| Team | ✅ | ✅ | ❌ |
| HACCP | ✅ | ✅ | ✅ |
| Prod. | ✅ | ✅ | ❌ |
| Etiketten | ✅ | ✅ | ❌ |
| Wissen | ✅ | ✅ | ❌ |
| Büro | ❌ | ✅ | ❌ |

**Employee vs Admin (Code-Default):** Admin hat zusätzlich **Büro** (`batches`). **Wissen** (`knowledge`) ist für Mitarbeiter an der Theke freigegeben. Operative Laden-Tabs sind für beide gleich, sofern die Tenant-Decke sie freigibt.

Zusätzlich (nicht über Access-Keys, aber rollenabhängig in der UI):

| UI | Employee | Admin (Büro = `isOfficeUser`) | Helper |
|----|----------|-------------------------------|--------|
| MHD Speichern-Leiste | sichtbar | sichtbar | ausgeblendet |
| Stammdaten / Office-Tools | ausgeblendet | sichtbar | ausgeblendet |
| MHD Admin-Suche | ausgeblendet | sichtbar | ausgeblendet |
| Dev-Dashboard | Guard | erlaubt | Guard |

## Overrides

1. **Tenant** schaltet Modul global aus → Tab weg für alle Rollen.  
2. **`settings/role_modules`** überschreibt Code-Defaults je Rolle.  
   Legacy-Dokumente mit `employee.knowledge: false` / `admin.knowledge: false` werden beim Laden bereinigt (`stripLegacyKnowledgeDenials`) und per Migration `tools/migrate-role-modules-knowledge.mjs` in Firestore korrigiert. `helper.knowledge: false` bleibt gültig.
3. **`allowedModules`** am Nutzer (Claim/Profil) kann einzelne Tabs zusätzlich sperren (fehlende Keys = erlaubt).

Claims setzen:

```bash
node tools/set-user-claims.mjs --all --project=hofsync-production
```

Tests: `test/claims-tabs-mapping.test.mjs`, ergänzend `test/module-access-resolve.test.mjs`.
