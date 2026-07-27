/**
 * Tenant module flags from Firestore `tenants/{id}.enabledModules`.
 * Keys: start, team, mhd, receiving, kitchen, haccp, knowledge, buero, chargenDoku
 */

export const TENANT_MODULE_KEYS = [
  'start',
  'team',
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

export const ENABLED_MODULE_TO_BRANDING = {
  start: 'teamboard',
  team: 'team',
  mhd: 'mhdMonitor',
  receiving: 'wareneingang',
  kitchen: 'wurstkueche',
  haccp: 'haccp',
  knowledge: 'knowledge',
  buero: 'batches',
  chargenDoku: 'chargenDoku',
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

export function mergeEnabledModulesIntoBranding(enabledModules, branding = window.BRANDING) {
  if (!branding || !enabledModules || typeof enabledModules !== 'object') return branding;
  branding.enabledModules = { ...enabledModules };
  const modules = { ...(branding.modules || {}) };
  TENANT_MODULE_KEYS.forEach((key) => {
    if (!(key in enabledModules)) return;
    const brandingKey = ENABLED_MODULE_TO_BRANDING[key];
    if (brandingKey) modules[brandingKey] = enabledModules[key] === true;
  });
  // Legacy key → branding.chargenDoku
  const chargenResolved = resolveChargenDokuEnabled(enabledModules);
  if (typeof chargenResolved === 'boolean') {
    modules.chargenDoku = chargenResolved;
    // Keep legacy branding key in sync for older callers
    modules.traceability = chargenResolved;
  }
  // Team-Tab-Inhalte (Bestellungen) folgen dem team-Schalter.
  if ('team' in enabledModules) {
    modules.orders = enabledModules.team === true;
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
  } else if (enabled && typeof enabled === 'object' && key in enabled) {
    return enabled[key] === true;
  }
  const modules = branding.modules || {};
  switch (key) {
    case 'start':
      return modules.teamboard === true;
    case 'team':
      return modules.team === true || modules.orders === true;
    case 'mhd':
      return modules.mhdMonitor !== false;
    case 'receiving':
      return modules.wareneingang !== false;
    case 'kitchen':
      return modules.wurstkueche !== false;
    case 'haccp':
      return modules.haccp !== false;
    case 'knowledge':
      return modules.knowledge === true || modules.cutGlossary === true;
    case 'buero':
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
    const snap = await db.collection('tenants').doc(tenantId).get();
    const enabledModules = snap.data()?.enabledModules;
    if (enabledModules && typeof enabledModules === 'object') {
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
