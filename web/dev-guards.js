/**
 * Dev-only Overrides (Firebase-Projekt, Tenant-URL) – in Produktion deaktiviert.
 */

export function isLocalDevHost() {
  const host = String(window.location?.hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1';
}

export function readDevFirebaseProjectOverride() {
  if (!isLocalDevHost()) return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('firebase') || params.get('project');
    if (fromQuery === 'whitelabel' || fromQuery === 'production') return fromQuery;
    const fromStorage = localStorage.getItem('charculogic_firebase_project');
    if (fromStorage === 'whitelabel' || fromStorage === 'production') return fromStorage;
  } catch (_) { /* noop */ }
  return null;
}

export function readDevTenantOverride() {
  if (!isLocalDevHost()) return '';
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('tenant') || params.get('tenantId');
    if (fromQuery) return String(fromQuery).trim().toLowerCase();
  } catch (_) { /* noop */ }
  return '';
}
