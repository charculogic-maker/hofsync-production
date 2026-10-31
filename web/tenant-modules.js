/**
 * Tenant module flags — Single Source of Truth for HofSync.
 *
 * Auflösung (Tenant-Decke):
 *   Firestore `tenants/{id}.enabledModules` (führend)
 *   → Fallback: `branding.js` Defaults (erster Boot / Offline).
 *
 * Session-Zugriff (nach Tenant-Decke, lokal, kein Cache):
 *   Tenant ∩ roleModuleDefaults[role] ∩ user.allowedModules
 *   → `resolveAccessModules` / `applySessionAccessModuleOverride`
 *
 * Kanonische Branding-Keys (UI / BRANDING.modules):
 *   mhdMonitor, wareneingang, wareneingangMetzgerei, wurstkueche,
 *   haccp, teamboard, team, orders, batches, retterBox
 *
 * Firestore-/Dashboard-Keys (TENANT_MODULE_KEYS) bleiben parallel
 * für Dev-Dashboard und Legacy-Dokumente.
 */

/** @type {readonly string[]} */
export const CANONICAL_MODULE_KEYS = Object.freeze([
  'mhdMonitor',
  'wareneingang',
  'wareneingangMetzgerei',
  'wurstkueche',
  'averyLabels',
  'haccp',
  'teamboard',
  'team',
  'orders',
  'batches',
  'retterBox',
]);

/**
 * Keys unter `tenants/{id}.enabledModules` (Dev-Dashboard / Callables).
 * `orders` ist bewusst eigenständig — nicht an `team` gekoppelt.
 */
export const TENANT_MODULE_KEYS = [
  'start',
  'team',
  'orders',
  'mhd',
  'receiving',
  'kitchen',
  'averyLabels',
  'haccp',
  'knowledge',
  'buero',
  'chargenDoku',
];

/**
 * Module, die pro Rolle / Nutzer einschränkbar sind (Claims `allowedModules`,
 * Tenant-Settings `settings/role_modules`).
 * @type {readonly string[]}
 */
export const ACCESS_MODULE_KEYS = Object.freeze([
  'start',
  'team',
  'orders',
  'mhd',
  'receiving',
  'kitchen',
  'averyLabels',
  'haccp',
  'knowledge',
  'buero',
  'chargenDoku',
  'retterBox',
]);

/** Access-Key → Bottom-Nav / Tab-IDs (für Session-UI). */
export const ACCESS_MODULE_TO_TAB = Object.freeze({
  start: 'teamboard',
  team: 'team',
  orders: 'orders',
  mhd: 'mhd',
  receiving: 'receiving',
  kitchen: 'kitchen',
  averyLabels: 'avery',
  haccp: 'haccp',
  knowledge: 'knowledge',
  buero: 'batches',
  chargenDoku: 'chargenDoku',
});

/** @type {readonly string[]} */
export const TENANT_ROLES_FOR_MODULES = Object.freeze(['admin', 'employee', 'helper']);

/**
 * Code-Defaults je Rolle, wenn `settings/role_modules` fehlt.
 * Fehlende Keys in gespeicherten Maps = erlaubt (Abwärtskompatibilität).
 */
export const DEFAULT_ROLE_MODULE_DEFAULTS = Object.freeze({
  admin: Object.freeze(Object.fromEntries(ACCESS_MODULE_KEYS.map((key) => [key, true]))),
  employee: Object.freeze({
    start: true,
    team: true,
    orders: true,
    mhd: true,
    receiving: true,
    kitchen: true,
    averyLabels: true,
    haccp: true,
    knowledge: true,
    buero: false,
    chargenDoku: true,
    retterBox: true,
  }),
  helper: Object.freeze({
    start: true,
    team: false,
    orders: false,
    mhd: true,
    receiving: false,
    kitchen: false,
    averyLabels: false,
    haccp: true,
    knowledge: false,
    buero: false,
    chargenDoku: true,
    retterBox: false,
  }),
});

/** Aliase: Access-Key → Keys in enabledModules / Branding. */
const ACCESS_KEY_ALIASES = Object.freeze({
  start: ['start', 'teamboard'],
  team: ['team'],
  orders: ['orders'],
  mhd: ['mhd', 'mhdMonitor'],
  receiving: ['receiving', 'wareneingang'],
  kitchen: ['kitchen', 'wurstkueche', 'kueche'],
  averyLabels: ['averyLabels', 'avery', 'zerlegung', 'cutting'],
  haccp: ['haccp'],
  knowledge: ['knowledge'],
  buero: ['buero', 'batches'],
  chargenDoku: ['chargenDoku', 'traceability'],
  retterBox: ['retterBox'],
});

/** @deprecated Legacy Firestore key – mapped to chargenDoku */
const LEGACY_CHARGEN_DOKU_KEY = 'traceability';

/**
 * Firestore-/Alias-Key → kanonischer Branding-Modul-Key.
 * team und orders sind getrennt (kein gegenseitiges Überschreiben).
 */
export const ENABLED_MODULE_TO_BRANDING = {
  start: 'teamboard',
  teamboard: 'teamboard',
  team: 'team',
  orders: 'orders',
  mhd: 'mhdMonitor',
  mhdMonitor: 'mhdMonitor',
  receiving: 'wareneingang',
  wareneingang: 'wareneingang',
  wareneingangMetzgerei: 'wareneingangMetzgerei',
  kitchen: 'wurstkueche',
  wurstkueche: 'wurstkueche',
  averyLabels: 'averyLabels',
  avery: 'averyLabels',
  zerlegung: 'averyLabels',
  cutting: 'averyLabels',
  haccp: 'haccp',
  knowledge: 'knowledge',
  buero: 'batches',
  batches: 'batches',
  chargenDoku: 'chargenDoku',
  retterBox: 'retterBox',
};

const ADMIN_MODULE_KEYS = ['haccp', 'knowledge', 'buero'];

/**
 * Stale-While-Revalidate: letzte effektive Modul-Map für Zero-Flicker-Boot.
 * v2: invalidiert Caches, die vor dem FOUC-Fix aus Branding-Defaults geschrieben wurden.
 */
export const LAST_EFFECTIVE_MODULES_KEY = 'charculogic.lastEffectiveModules.v2';

/** Soft-Lock Speicherschlüssel (Session-Mitarbeiter, unscoped Mirror). */
export const ACTIVE_EMPLOYEE_SOFT_LOCK_KEY = 'charculogic.activeEmployee';

/**
 * StevesHof-Fallback: Verkaufs-/Service-Namen → PROD. (kueche) lokal ausblenden.
 * Wortgrenzen für „Laden“, damit z. B. „Magdalena“ nicht greift.
 */
const KITCHEN_SALES_NAME_HINTS = Object.freeze(['laden-team', 'laden team', 'verkauf', 'service']);

/** Produktion/Metzgerei-Namen → Mandanten-Einstellung für PROD. behalten. */
const KITCHEN_PRODUCTION_NAME_HINTS = Object.freeze([
  'paddy',
  'metzgerei',
  'küche',
  'kueche',
  'produktion',
]);

/**
 * Liest den Soft-Lock-Mitarbeiternamen aus localStorage (unscoped Mirror).
 * @returns {string}
 */
export function readActiveEmployeeFromStorage() {
  try {
    return String(localStorage.getItem(ACTIVE_EMPLOYEE_SOFT_LOCK_KEY) || '').trim();
  } catch (_) {
    return '';
  }
}

/**
 * Prüft, ob der Name ein Verkaufs-/Service-Hinweis enthält (StevesHof-Fallback).
 * @param {string} employeeName
 * @returns {boolean}
 */
export function isSalesFloorEmployeeName(employeeName) {
  const name = String(employeeName || '').trim().toLowerCase();
  if (!name) return false;
  if (KITCHEN_SALES_NAME_HINTS.some((hint) => name.includes(hint))) return true;
  // „Laden“ als eigenes Token / Team-Label (nicht Teil von Magdalena o. ä.)
  return /(^|[\s\-_./])laden($|[\s\-_./])/i.test(name) || name === 'laden';
}

/**
 * Prüft, ob der Name Produktion/Metzgerei/Küche signalisiert.
 * @param {string} employeeName
 * @returns {boolean}
 */
export function isProductionEmployeeName(employeeName) {
  const name = String(employeeName || '').trim().toLowerCase();
  if (!name) return false;
  return KITCHEN_PRODUCTION_NAME_HINTS.some((hint) => name.includes(hint));
}

/**
 * Role-Based Access für Modul kueche / kitchen / wurstkueche (Tab PROD.).
 * @param {string} employeeName
 * @param {{ role?: string }|null|undefined} [employeeRecord]
 * @param {string} [authRole] Firebase-/Auth-Rolle (z. B. admin)
 * @returns {'allow'|'deny'} allow = Mandanten-Einstellung behalten; deny = lokal ausblenden
 */
export function resolveEmployeeKitchenAccess(employeeName, employeeRecord = null, authRole = '') {
  const role = String(employeeRecord?.role || authRole || '').trim().toLowerCase();
  if (role === 'admin' || role === 'produktion') return 'allow';

  const name = String(employeeName || '').trim();
  if (!name) return 'deny';

  if (isProductionEmployeeName(name)) return 'allow';
  if (isSalesFloorEmployeeName(name)) return 'deny';

  // Unbekannte Namen: sicher ausblenden (nur Produktion/Admin sieht PROD.)
  return 'deny';
}

/**
 * Session-Sichtbarkeit für PROD./Küche: Mandant aktiv UND Mitarbeiter berechtigt.
 * Schreibt nicht in lastEffectiveModules (reine Session-Überschreibung).
 * @param {boolean} tenantKitchenEnabled
 * @param {{ employeeName?: string, employeeRecord?: { role?: string }|null, authRole?: string }} [options]
 * @returns {boolean}
 */
export function isKitchenModuleVisibleForSession(tenantKitchenEnabled, options = {}) {
  if (!tenantKitchenEnabled) return false;
  const employeeName = options.employeeName !== undefined
    ? options.employeeName
    : readActiveEmployeeFromStorage();
  return resolveEmployeeKitchenAccess(
    employeeName,
    options.employeeRecord || null,
    options.authRole || '',
  ) === 'allow';
}

/**
 * Wendet die Session-RBAC-Überschreibung auf eine Modul-Map an (nur lokal, kein Cache-Write).
 * @param {Record<string, boolean>|null|undefined} modules
 * @param {{ employeeName?: string, employeeRecord?: { role?: string }|null, authRole?: string }} [options]
 * @returns {Record<string, boolean>}
 */
export function applySessionKitchenModuleOverride(modules, options = {}) {
  const next = { ...(modules && typeof modules === 'object' ? modules : {}) };
  const tenantEnabled = next.wurstkueche === true
    || next.kitchen === true
    || next.kueche === true;
  const visible = isKitchenModuleVisibleForSession(tenantEnabled, options);
  next.wurstkueche = visible;
  next.kitchen = visible;
  next.kueche = visible;

  // Avery-Etiketten: gleiches RBAC wie PROD./Metzgerei (Verkauf ausblenden)
  const averyTenantOn = next.averyLabels === true
    || next.avery === true
    || next.zerlegung === true
    || next.cutting === true;
  const averyVisible = isKitchenModuleVisibleForSession(averyTenantOn, options);
  next.averyLabels = averyVisible;
  next.avery = averyVisible;
  next.zerlegung = averyVisible;
  return next;
}

/**
 * Normalisiert eine Access-Modul-Map (fehlende Keys = defaultAllow).
 * @param {Record<string, boolean>|null|undefined} value
 * @param {{ defaultAllow?: boolean }} [options]
 * @returns {Record<string, boolean>}
 */
export function normalizeAccessModuleMap(value, options = {}) {
  const defaultAllow = options.defaultAllow !== false;
  /** @type {Record<string, boolean>} */
  const result = {};
  ACCESS_MODULE_KEYS.forEach((key) => {
    if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key)) {
      result[key] = value[key] === true;
    } else {
      result[key] = defaultAllow;
    }
  });
  return result;
}

/**
 * @param {string} role
 * @returns {'admin'|'employee'|'helper'}
 */
export function normalizeTenantRoleForModules(role) {
  const clean = String(role || '').trim().toLowerCase();
  if (clean === 'admin' || clean === 'helper') return clean;
  return 'employee';
}

/**
 * Rollen-Allowlist: Tenant-Settings überschreiben Code-Defaults (Key für Key).
 * @param {string} role
 * @param {Record<string, Record<string, boolean>>|null|undefined} roleModuleDefaults
 * @returns {Record<string, boolean>}
 */
export function resolveRoleModuleAllowlist(role, roleModuleDefaults = null) {
  const roleKey = normalizeTenantRoleForModules(role);
  const codeDefault = DEFAULT_ROLE_MODULE_DEFAULTS[roleKey] || DEFAULT_ROLE_MODULE_DEFAULTS.employee;
  const fromTenant = roleModuleDefaults && typeof roleModuleDefaults === 'object'
    ? roleModuleDefaults[roleKey]
    : null;
  if (!fromTenant || typeof fromTenant !== 'object') {
    return { ...codeDefault };
  }
  /** @type {Record<string, boolean>} */
  const merged = { ...codeDefault };
  ACCESS_MODULE_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(fromTenant, key)) {
      merged[key] = fromTenant[key] === true;
    }
  });
  return merged;
}

/**
 * Prüft, ob die Tenant-Decke den Access-Key freigibt.
 * Fehlende Keys in einer vorhandenen Map → false nur wenn kanonisch/Alias explizit false
 * oder kein Treffer und Map bereits aufgelöst (mindestens ein verwandter Key gesetzt).
 * Ohne Tenant-Map → true (kein Extra-Block).
 * @param {string} accessKey
 * @param {Record<string, boolean>|null|undefined} tenantModules
 * @returns {boolean}
 */
export function isTenantAccessKeyEnabled(accessKey, tenantModules) {
  if (!tenantModules || typeof tenantModules !== 'object') return true;
  if (!Object.keys(tenantModules).length) return true;
  const aliases = ACCESS_KEY_ALIASES[accessKey] || [accessKey];
  const present = aliases.filter((alias) => Object.prototype.hasOwnProperty.call(tenantModules, alias));
  if (present.length) {
    return present.some((alias) => tenantModules[alias] === true);
  }
  const brandingKey = ENABLED_MODULE_TO_BRANDING[accessKey];
  if (brandingKey && Object.prototype.hasOwnProperty.call(tenantModules, brandingKey)) {
    return tenantModules[brandingKey] === true;
  }
  // Partielle enabledModules-Map ohne diesen Key → nicht freigeschaltet.
  return false;
}

/**
 * Effektiver Session-Zugriff: Tenant ∩ Rolle ∩ Nutzer.
 * Schreibt nicht in lastEffectiveModules (Shared Terminals / Soft-Lock).
 * @param {{
 *   tenantModules?: Record<string, boolean>|null,
 *   role?: string,
 *   roleModuleDefaults?: Record<string, Record<string, boolean>>|null,
 *   allowedModules?: Record<string, boolean>|null,
 * }} [options]
 * @returns {Record<string, boolean>}
 */
export function resolveAccessModules(options = {}) {
  const roleAllow = resolveRoleModuleAllowlist(options.role, options.roleModuleDefaults);
  const userAllow = normalizeAccessModuleMap(options.allowedModules, { defaultAllow: true });
  /** @type {Record<string, boolean>} */
  const access = {};
  ACCESS_MODULE_KEYS.forEach((key) => {
    const tenantOn = isTenantAccessKeyEnabled(key, options.tenantModules);
    access[key] = tenantOn && roleAllow[key] === true && userAllow[key] === true;
  });
  return access;
}

/**
 * Sichtbare Bottom-/App-Tab-IDs aus Custom-Claim-Rolle (Tenant ∩ Rolle ∩ Nutzer).
 * Spiegel der Session-Logik hinter `resolveSessionAllowedTabs` in `app.js`.
 * `retterBox` hat keinen Nav-Tab und erscheint hier nicht.
 *
 * @param {string} role Claim-Rolle (`admin` | `employee` | `helper` | Alias)
 * @param {{
 *   tenantModules?: Record<string, boolean>|null,
 *   roleModuleDefaults?: Record<string, Record<string, boolean>>|null,
 *   allowedModules?: Record<string, boolean>|null,
 * }} [options]
 * @returns {string[]} Tab-IDs in ACCESS_MODULE_KEYS-Reihenfolge
 */
export function resolveTabsForClaimRole(role, options = {}) {
  const access = resolveAccessModules({
    tenantModules: options.tenantModules,
    role,
    roleModuleDefaults: options.roleModuleDefaults,
    allowedModules: options.allowedModules,
  });
  /** @type {string[]} */
  const tabs = [];
  ACCESS_MODULE_KEYS.forEach((key) => {
    if (access[key] !== true) return;
    const tabId = ACCESS_MODULE_TO_TAB[key];
    if (tabId) tabs.push(tabId);
  });
  return tabs;
}

/**
 * Wendet Rollen-/Nutzer-Zugriff auf eine Modul-Map an (lokal, kein Cache).
 * @param {Record<string, boolean>|null|undefined} modules
 * @param {{
 *   role?: string,
 *   roleModuleDefaults?: Record<string, Record<string, boolean>>|null,
 *   allowedModules?: Record<string, boolean>|null,
 * }} [options]
 * @returns {Record<string, boolean>}
 */
export function applySessionAccessModuleOverride(modules, options = {}) {
  const next = { ...(modules && typeof modules === 'object' ? modules : {}) };
  const access = resolveAccessModules({
    tenantModules: next,
    role: options.role,
    roleModuleDefaults: options.roleModuleDefaults,
    allowedModules: options.allowedModules,
  });
  ACCESS_MODULE_KEYS.forEach((accessKey) => {
    if (access[accessKey] === true) return;
    const aliases = ACCESS_KEY_ALIASES[accessKey] || [accessKey];
    aliases.forEach((alias) => {
      next[alias] = false;
    });
  });
  return next;
}

/**
 * Normalisiert gespeicherte role_modules-Settings (admin/employee/helper).
 * @param {object|null|undefined} raw
 * @returns {Record<string, Record<string, boolean>>}
 */
export function normalizeRoleModuleDefaults(raw) {
  /** @type {Record<string, Record<string, boolean>>} */
  const result = {};
  TENANT_ROLES_FOR_MODULES.forEach((role) => {
    const fromDoc = raw && typeof raw === 'object' ? raw[role] : null;
    result[role] = resolveRoleModuleAllowlist(role, fromDoc ? { [role]: fromDoc } : null);
  });
  return result;
}

/**
 * Resolve chargenDoku flag with legacy `traceability` fallback.
 * @param {Record<string, boolean>|null|undefined} enabled
 * @returns {boolean|undefined} undefined if neither key is present
 */
function resolveChargenDokuEnabled(enabled) {
  if (!enabled || typeof enabled !== 'object') return undefined;
  if ('chargenDoku' in enabled) return enabled.chargenDoku === true;
  if (LEGACY_CHARGEN_DOKU_KEY in enabled) return enabled[LEGACY_CHARGEN_DOKU_KEY] === true;
  return undefined;
}

/**
 * Liest einen Modulwert aus Firestore/Settings, ohne Alias-Gruppen zu koppeln.
 * @param {Record<string, boolean>|null|undefined} source
 * @param {string[]} keys
 * @returns {boolean|undefined}
 */
function readFirstPresentFlag(source, keys) {
  if (!source || typeof source !== 'object') return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      return source[key] === true;
    }
  }
  return undefined;
}

/**
 * Kanonische Modul-Auflösung: Firestore führend, Branding nur Fallback.
 *
 * @param {object|null|undefined} tenantConfig Branding-/Tenant-Defaults (`modules` o.ä.)
 * @param {object|null|undefined} firestoreSettings Firestore-Tenant-Doc oder `{ enabledModules }`
 * @returns {Record<string, boolean>}
 */
export function resolveEffectiveModules(tenantConfig, firestoreSettings) {
  const brandingModules = {
    ...((tenantConfig && tenantConfig.modules) || {}),
  };
  const enabledFromDoc = firestoreSettings?.enabledModules
    && typeof firestoreSettings.enabledModules === 'object'
    ? firestoreSettings.enabledModules
    : (firestoreSettings && typeof firestoreSettings === 'object'
      && !firestoreSettings.modules
      && ('mhd' in firestoreSettings || 'orders' in firestoreSettings || 'team' in firestoreSettings
        || 'mhdMonitor' in firestoreSettings || 'start' in firestoreSettings)
      ? firestoreSettings
      : null);

  /** @type {Record<string, boolean>} */
  const resolved = {};

  const applyCanonical = (canonicalKey, value) => {
    if (typeof value !== 'boolean') return;
    resolved[canonicalKey] = value;
  };

  // 1) Branding-Defaults (Offline / erster Boot)
  CANONICAL_MODULE_KEYS.forEach((key) => {
    if (typeof brandingModules[key] === 'boolean') {
      applyCanonical(key, brandingModules[key]);
    }
  });
  if (typeof brandingModules.chargenDoku === 'boolean') {
    resolved.chargenDoku = brandingModules.chargenDoku;
  }
  if (typeof brandingModules.knowledge === 'boolean') {
    resolved.knowledge = brandingModules.knowledge;
  }

  // 2) Firestore überschreibt gezielt vorhandene Keys (keine False-Defaults für fehlende Keys)
  if (enabledFromDoc) {
    const overlays = [
      ['mhdMonitor', ['mhdMonitor', 'mhd']],
      ['wareneingang', ['wareneingang', 'receiving']],
      ['wareneingangMetzgerei', ['wareneingangMetzgerei']],
      ['wurstkueche', ['wurstkueche', 'kitchen', 'rezepte']],
      ['averyLabels', ['averyLabels', 'avery', 'zerlegung', 'cutting']],
      ['haccp', ['haccp']],
      ['teamboard', ['teamboard', 'start']],
      ['team', ['team']],
      ['orders', ['orders']],
      ['batches', ['batches', 'buero']],
      ['retterBox', ['retterBox']],
      ['knowledge', ['knowledge']],
    ];
    overlays.forEach(([canonical, keys]) => {
      const value = readFirstPresentFlag(enabledFromDoc, keys);
      if (typeof value === 'boolean') applyCanonical(canonical, value);
    });
    const chargen = resolveChargenDokuEnabled(enabledFromDoc);
    if (typeof chargen === 'boolean') {
      resolved.chargenDoku = chargen;
      resolved.traceability = chargen;
    }
  }

  // Fehlende Kanonik-Keys: konservativ false (außer bereits gesetzt)
  CANONICAL_MODULE_KEYS.forEach((key) => {
    if (typeof resolved[key] !== 'boolean') resolved[key] = false;
  });

  return resolved;
}

/**
 * @param {Record<string, boolean>|null|undefined} left
 * @param {Record<string, boolean>|null|undefined} right
 * @returns {boolean}
 */
export function effectiveModulesEqual(left, right) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (Boolean(left[key]) !== Boolean(right[key])) return false;
  }
  return true;
}

/**
 * @returns {Record<string, boolean>|null}
 */
export function readCachedEffectiveModules() {
  try {
    const raw = localStorage.getItem(LAST_EFFECTIVE_MODULES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    /** @type {Record<string, boolean>} */
    const cleaned = {};
    Object.entries(parsed).forEach(([key, value]) => {
      if (typeof value === 'boolean') cleaned[key] = value;
    });
    return Object.keys(cleaned).length ? cleaned : null;
  } catch (_) {
    return null;
  }
}

/**
 * @param {Record<string, boolean>|null|undefined} effectiveModules
 */
export function writeCachedEffectiveModules(effectiveModules) {
  if (!effectiveModules || typeof effectiveModules !== 'object') return;
  try {
    localStorage.setItem(LAST_EFFECTIVE_MODULES_KEY, JSON.stringify(effectiveModules));
  } catch (_) { /* private mode / quota */ }
}

/**
 * Cached/resolvierte Modul-Map in Branding spiegeln (modules + enabledModules).
 * @param {Record<string, boolean>} effectiveModules
 * @param {object} [branding]
 */
export function applyEffectiveModulesToBranding(effectiveModules, branding = window.BRANDING) {
  if (!branding || !effectiveModules || typeof effectiveModules !== 'object') return branding;
  branding.modules = { ...(branding.modules || {}), ...effectiveModules };
  branding.enabledModules = { ...(branding.enabledModules || {}), ...effectiveModules };
  // Firestore-Aliase für isTenantModuleEnabled
  const enabled = branding.enabledModules;
  if (typeof effectiveModules.mhdMonitor === 'boolean') enabled.mhd = effectiveModules.mhdMonitor;
  if (typeof effectiveModules.wareneingang === 'boolean') enabled.receiving = effectiveModules.wareneingang;
  if (typeof effectiveModules.wurstkueche === 'boolean') enabled.kitchen = effectiveModules.wurstkueche;
  if (typeof effectiveModules.averyLabels === 'boolean') {
    enabled.averyLabels = effectiveModules.averyLabels;
    enabled.zerlegung = effectiveModules.averyLabels;
  }
  if (typeof effectiveModules.teamboard === 'boolean') enabled.start = effectiveModules.teamboard;
  if (typeof effectiveModules.batches === 'boolean') enabled.buero = effectiveModules.batches;
  if (typeof effectiveModules.chargenDoku === 'boolean') {
    enabled.chargenDoku = effectiveModules.chargenDoku;
    enabled.traceability = effectiveModules.chargenDoku;
  }
  return branding;
}

/**
 * Branding + optional Firestore → effektive Map, Cache schreiben, Branding aktualisieren.
 * @returns {{ effective: Record<string, boolean>, changed: boolean }}
 */
export function publishEffectiveModules(tenantConfig, firestoreSettings) {
  const effective = resolveEffectiveModules(tenantConfig, firestoreSettings);
  const previous = readCachedEffectiveModules();
  const changed = !effectiveModulesEqual(previous, effective);
  writeCachedEffectiveModules(effective);
  applyEffectiveModulesToBranding(effective, tenantConfig || window.BRANDING);
  return { effective, changed };
}

/**
 * Merkt Firestore-`enabledModules` in `window.BRANDING` ein (Mutation in-place).
 * Überschreibt nur Keys, die in Firestore vorkommen — kein Blind-Reset fehlender Module.
 */
export function mergeEnabledModulesIntoBranding(enabledModules, branding = window.BRANDING) {
  if (!branding || !enabledModules || typeof enabledModules !== 'object') return branding;
  branding.enabledModules = { ...enabledModules };
  const modules = { ...(branding.modules || {}) };

  const overlays = [
    ['mhdMonitor', ['mhdMonitor', 'mhd']],
    ['wareneingang', ['wareneingang', 'receiving']],
    ['wareneingangMetzgerei', ['wareneingangMetzgerei']],
    ['wurstkueche', ['wurstkueche', 'kitchen', 'rezepte']],
    ['averyLabels', ['averyLabels', 'avery', 'zerlegung', 'cutting']],
    ['haccp', ['haccp']],
    ['teamboard', ['teamboard', 'start']],
    ['team', ['team']],
    ['orders', ['orders']],
    ['batches', ['batches', 'buero']],
    ['retterBox', ['retterBox']],
    ['knowledge', ['knowledge']],
  ];
  overlays.forEach(([canonical, keys]) => {
    const value = readFirstPresentFlag(enabledModules, keys);
    if (typeof value === 'boolean') modules[canonical] = value;
  });
  const chargen = resolveChargenDokuEnabled(enabledModules);
  if (typeof chargen === 'boolean') {
    modules.chargenDoku = chargen;
    modules.traceability = chargen;
  }
  branding.modules = modules;
  return branding;
}

export function isTenantModuleEnabled(moduleKey, branding = window.BRANDING || {}) {
  const key = moduleKey === LEGACY_CHARGEN_DOKU_KEY ? 'chargenDoku' : moduleKey;
  const enabled = branding.enabledModules;
  // Legacy: enabledModules als Array von Keys
  if (Array.isArray(enabled)) {
    const aliases = key === 'haccp' ? ['haccp'] : [key];
    if (aliases.some((alias) => enabled.includes(alias))) return true;
  } else if (key === 'chargenDoku') {
    const fromEnabled = resolveChargenDokuEnabled(enabled);
    if (typeof fromEnabled === 'boolean') return fromEnabled;
  } else if (enabled && typeof enabled === 'object') {
    // Firestore-Keys und Branding-Aliase prüfen — team ≠ orders
    const aliasGroups = {
      start: ['start', 'teamboard'],
      teamboard: ['teamboard', 'start'],
      team: ['team'],
      orders: ['orders'],
      mhd: ['mhd', 'mhdMonitor'],
      mhdMonitor: ['mhdMonitor', 'mhd'],
      receiving: ['receiving', 'wareneingang'],
      wareneingang: ['wareneingang', 'receiving'],
      wareneingangMetzgerei: ['wareneingangMetzgerei'],
      kitchen: ['kitchen', 'wurstkueche', 'rezepte'],
      wurstkueche: ['wurstkueche', 'kitchen', 'rezepte'],
      averyLabels: ['averyLabels', 'avery', 'zerlegung', 'cutting'],
      avery: ['averyLabels', 'avery', 'zerlegung', 'cutting'],
      zerlegung: ['averyLabels', 'avery', 'zerlegung', 'cutting'],
      haccp: ['haccp'],
      knowledge: ['knowledge'],
      buero: ['buero', 'batches'],
      batches: ['batches', 'buero'],
      retterBox: ['retterBox'],
      deliveryParser: ['deliveryParser'],
    };
    const aliases = aliasGroups[key] || [key];
    const present = aliases.filter((alias) => Object.prototype.hasOwnProperty.call(enabled, alias));
    if (present.length) {
      return present.some((alias) => enabled[alias] === true);
    }
  }
  const modules = branding.modules || {};
  switch (key) {
    case 'start':
    case 'teamboard':
      return modules.teamboard === true;
    case 'team':
      return modules.team === true;
    case 'orders':
      return modules.orders === true;
    case 'mhd':
    case 'mhdMonitor':
      return modules.mhdMonitor !== false;
    case 'receiving':
    case 'wareneingang':
      return modules.wareneingang !== false;
    case 'wareneingangMetzgerei':
      return modules.wareneingangMetzgerei === true;
    case 'kitchen':
    case 'wurstkueche':
      return modules.wurstkueche !== false;
    case 'averyLabels':
    case 'avery':
    case 'zerlegung':
      return modules.averyLabels === true;
    case 'retterBox':
      return modules.retterBox === true;
    case 'deliveryParser':
      if (enabled && typeof enabled === 'object' && 'deliveryParser' in enabled) {
        return enabled.deliveryParser === true;
      }
      return modules.deliveryParser !== false;
    case 'haccp':
      return modules.haccp !== false;
    case 'knowledge':
      return modules.knowledge === true || modules.cutGlossary === true;
    case 'buero':
    case 'batches':
      return modules.batches !== false;
    case 'chargenDoku':
      return modules.chargenDoku !== false && modules.traceability !== false;
    default:
      return false;
  }
}

/**
 * Convenience alias used by route/module guards.
 * @param {string} moduleKey
 * @param {object} [branding]
 * @returns {boolean}
 */
export function hasModule(moduleKey, branding = window.BRANDING || {}) {
  return isTenantModuleEnabled(moduleKey, branding);
}

export function hasAnyAdminModuleEnabled(branding = window.BRANDING || {}) {
  return ADMIN_MODULE_KEYS.some((key) => isTenantModuleEnabled(key, branding));
}

export async function loadTenantEnabledModules(db, tenantId) {
  if (!db || !tenantId) return null;
  try {
    const tenantRef = db.collection('tenants').doc(tenantId);
    const snap = await tenantRef.get();
    let enabledModules = snap.data()?.enabledModules && typeof snap.data().enabledModules === 'object'
      ? { ...snap.data().enabledModules }
      : null;
    // Optional: tenants/{id}/settings/modules überschreibt gezielt (Firestore führend)
    try {
      const settingsSnap = await tenantRef.collection('settings').doc('modules').get();
      const fromSettings = settingsSnap.data()?.enabledModules;
      if (fromSettings && typeof fromSettings === 'object') {
        enabledModules = { ...(enabledModules || {}), ...fromSettings };
      }
    } catch (_) { /* settings/modules optional */ }
    if (enabledModules) {
      mergeEnabledModulesIntoBranding(enabledModules);
      publishEffectiveModules(window.BRANDING, { enabledModules });
    } else if (window.BRANDING) {
      // Kein enabledModules-Dokument: Offline-/Erstboot-Fallback Branding (jetzt erst cachen).
      publishEffectiveModules(window.BRANDING, null);
    }
    return enabledModules || null;
  } catch (err) {
    console.warn('[CharcuLogic] enabledModules konnten nicht geladen werden:', err);
    // Netzwerkfehler: Branding-Fallback cachen, damit Nav nicht dauerhaft leer bleibt.
    if (window.BRANDING) {
      try {
        publishEffectiveModules(window.BRANDING, null);
      } catch (_) { /* noop */ }
    }
    return null;
  }
}

export function subscribeTenantEnabledModules(db, tenantId, onChange) {
  if (!db || !tenantId || typeof onChange !== 'function') return () => {};
  return db.collection('tenants').doc(tenantId).onSnapshot(
    (snap) => {
      const enabledModules = snap.data()?.enabledModules;
      if (enabledModules && typeof enabledModules === 'object') {
        const previous = readCachedEffectiveModules();
        mergeEnabledModulesIntoBranding(enabledModules);
        const { effective } = publishEffectiveModules(
          window.BRANDING,
          { enabledModules },
        );
        const changed = !effectiveModulesEqual(previous, effective);
        onChange(enabledModules, { changed, effective });
      }
    },
    (err) => console.warn('[CharcuLogic] enabledModules-Listener fehlgeschlagen:', err),
  );
}

// Für ältere Call-Sites / Debugging
if (typeof window !== 'undefined') {
  window.resolveEffectiveModules = resolveEffectiveModules;
  window.CANONICAL_MODULE_KEYS = CANONICAL_MODULE_KEYS;
  window.ACCESS_MODULE_KEYS = ACCESS_MODULE_KEYS;
  window.DEFAULT_ROLE_MODULE_DEFAULTS = DEFAULT_ROLE_MODULE_DEFAULTS;
  window.readCachedEffectiveModules = readCachedEffectiveModules;
  window.writeCachedEffectiveModules = writeCachedEffectiveModules;
  window.applyEffectiveModulesToBranding = applyEffectiveModulesToBranding;
  window.publishEffectiveModules = publishEffectiveModules;
  window.isKitchenModuleVisibleForSession = isKitchenModuleVisibleForSession;
  window.resolveEmployeeKitchenAccess = resolveEmployeeKitchenAccess;
  window.applySessionKitchenModuleOverride = applySessionKitchenModuleOverride;
  window.resolveAccessModules = resolveAccessModules;
  window.resolveTabsForClaimRole = resolveTabsForClaimRole;
  window.applySessionAccessModuleOverride = applySessionAccessModuleOverride;
  window.normalizeAccessModuleMap = normalizeAccessModuleMap;
  window.normalizeRoleModuleDefaults = normalizeRoleModuleDefaults;
  window.resolveRoleModuleAllowlist = resolveRoleModuleAllowlist;
}
