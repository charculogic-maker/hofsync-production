/**
 * Tenant module flags from Firestore `tenants/{id}.enabledModules`.
 * Keys: mhd, receiving, kitchen, haccp, knowledge, buero, traceability
 */

export const TENANT_MODULE_KEYS = ['mhd', 'receiving', 'kitchen', 'haccp', 'knowledge', 'buero', 'traceability'];

export const ENABLED_MODULE_TO_BRANDING = {
  mhd: 'mhdMonitor',
  receiving: 'wareneingang',
  kitchen: 'wurstkueche',
  haccp: 'haccp',
  knowledge: 'knowledge',
  buero: 'batches',
  traceability: 'traceability',
};

const ADMIN_MODULE_KEYS = ['haccp', 'knowledge', 'buero'];

export function mergeEnabledModulesIntoBranding(enabledModules, branding = window.BRANDING) {
  if (!branding || !enabledModules || typeof enabledModules !== 'object') return branding;
  branding.enabledModules = { ...enabledModules };
  const modules = { ...(branding.modules || {}) };
  TENANT_MODULE_KEYS.forEach((key) => {
    if (!(key in enabledModules)) return;
    const brandingKey = ENABLED_MODULE_TO_BRANDING[key];
    if (brandingKey) modules[brandingKey] = enabledModules[key] !== false;
  });
  branding.modules = modules;
  return branding;
}

export function isTenantModuleEnabled(moduleKey, branding = window.BRANDING || {}) {
  const enabled = branding.enabledModules;
  if (enabled && typeof enabled === 'object' && moduleKey in enabled) {
    return enabled[moduleKey] !== false;
  }
  const modules = branding.modules || {};
  switch (moduleKey) {
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
    case 'traceability':
      return modules.traceability !== false;
    default:
      return false;
  }
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
