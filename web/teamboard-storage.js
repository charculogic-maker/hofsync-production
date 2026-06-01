export const ACTIVE_EMPLOYEE_STORAGE_KEY = 'charculogic_active_employee';
export const ACTIVE_AREA_STORAGE_KEY = 'charculogic_active_area';
export const LEGACY_SHIFT_STORAGE_KEY = 'charculogic_active_shift';

export function scopedTeamboardStorageKey(baseKey, tenantId) {
  const prefix = String(tenantId || '').trim();
  return prefix ? `${prefix}_${baseKey}` : baseKey;
}

export function clearTeamboardTenantStorage(tenantId) {
  const prefix = String(tenantId || '').trim();
  if (!prefix) return;
  [ACTIVE_EMPLOYEE_STORAGE_KEY, ACTIVE_AREA_STORAGE_KEY, LEGACY_SHIFT_STORAGE_KEY].forEach((baseKey) => {
    try {
      localStorage.removeItem(`${prefix}_${baseKey}`);
    } catch (_) { /* noop */ }
  });
}
