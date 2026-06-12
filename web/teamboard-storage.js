import { normalizeTenantId } from './tenant-db.js';

export const ACTIVE_EMPLOYEE_STORAGE_KEY = 'charculogic_active_employee';
export const ACTIVE_AREA_STORAGE_KEY = 'charculogic_active_area';
export const LEGACY_SHIFT_STORAGE_KEY = 'charculogic_active_shift';

export function scopedTeamboardStorageKey(baseKey, tenantId) {
  const prefix = normalizeTenantId(tenantId);
  return prefix ? `${prefix}_${baseKey}` : baseKey;
}

function migrateLegacyScopedStorageValue(baseKey, cleanTenantId, primaryKey) {
  const suffix = `_${baseKey}`;
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.endsWith(suffix)) continue;
      const legacyPrefix = key.slice(0, -suffix.length);
      if (!legacyPrefix || legacyPrefix.toLowerCase() !== cleanTenantId || legacyPrefix === cleanTenantId) {
        continue;
      }
      const legacyValue = String(localStorage.getItem(key) || '').trim();
      if (!legacyValue) continue;
      try {
        localStorage.setItem(primaryKey, legacyValue);
        localStorage.removeItem(key);
      } catch (_) { /* noop */ }
      return legacyValue;
    }
  } catch (_) { /* noop */ }
  return '';
}

export function readScopedLocalStorageValue(baseKey, tenantId) {
  const cleanTenantId = normalizeTenantId(tenantId);
  if (!cleanTenantId) return '';
  const primaryKey = scopedTeamboardStorageKey(baseKey, cleanTenantId);
  const primaryValue = String(localStorage.getItem(primaryKey) || '').trim();
  if (primaryValue) return primaryValue;
  return migrateLegacyScopedStorageValue(baseKey, cleanTenantId, primaryKey);
}

export function writeScopedLocalStorageValue(baseKey, tenantId, value) {
  const cleanTenantId = normalizeTenantId(tenantId);
  const cleanValue = String(value || '').trim();
  if (!cleanTenantId || !cleanValue) return;
  try {
    localStorage.setItem(scopedTeamboardStorageKey(baseKey, cleanTenantId), cleanValue);
  } catch (_) { /* noop */ }
}

export function clearTeamboardTenantStorage(tenantId) {
  const prefix = normalizeTenantId(tenantId);
  if (!prefix) return;
  [ACTIVE_EMPLOYEE_STORAGE_KEY, ACTIVE_AREA_STORAGE_KEY, LEGACY_SHIFT_STORAGE_KEY].forEach((baseKey) => {
    try {
      localStorage.removeItem(`${prefix}_${baseKey}`);
    } catch (_) { /* noop */ }
  });
}
