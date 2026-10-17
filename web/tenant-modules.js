/**
 * Tenant module flags — Single Source of Truth for HofSync.
 *
 * Auflösung: Firestore `tenants/{id}.enabledModules` (führend)
 * → Fallback: `branding.js` Defaults (erster Boot / Offline).
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
  'haccp',
  'knowledge',
  'buero',
  'chargenDoku',
];

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
  haccp: 'haccp',
  knowledge: 'knowledge',
  buero: 'batches',
  batches: 'batches',
  chargenDoku: 'chargenDoku',
  retterBox: 'retterBox',
};

const ADMIN_MODULE_KEYS = ['haccp', 'knowledge', 'buero'];

/** Stale-While-Revalidate: letzte effektive Modul-Map für Zero-Flicker-Boot. */
export const LAST_EFFECTIVE_MODULES_KEY = 'charculogic.lastEffectiveModules';

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
  return next;
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
  if (key === 'chargenDoku') {
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
      publishEffectiveModules(window.BRANDING, null);
    }
    return enabledModules || null;
  } catch (err) {
    console.warn('[CharcuLogic] enabledModules konnten nicht geladen werden:', err);
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
  window.readCachedEffectiveModules = readCachedEffectiveModules;
  window.publishEffectiveModules = publishEffectiveModules;
  window.isKitchenModuleVisibleForSession = isKitchenModuleVisibleForSession;
  window.resolveEmployeeKitchenAccess = resolveEmployeeKitchenAccess;
  window.applySessionKitchenModuleOverride = applySessionKitchenModuleOverride;
}
