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
        mergeEnabledModulesIntoBranding(enabledModules);
        onChange(enabledModules);
      }
    },
    (err) => console.warn('[CharcuLogic] enabledModules-Listener fehlgeschlagen:', err),
  );
}

// Für ältere Call-Sites / Debugging
if (typeof window !== 'undefined') {
  window.resolveEffectiveModules = resolveEffectiveModules;
  window.CANONICAL_MODULE_KEYS = CANONICAL_MODULE_KEYS;
}
