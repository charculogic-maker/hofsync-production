/**
 * Dev-only Overrides (Firebase-Projekt, Tenant-URL) – in Produktion deaktiviert.
 */
export {
  isLocalDevHost,
  readFirebaseProjectOverride as readDevFirebaseProjectOverride,
} from './firebase-config.js';

export function readDevTenantOverride() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('tenant') || params.get('tenantId');
    if (fromQuery) return String(fromQuery).trim().toLowerCase();
  } catch (_) { /* noop */ }
  return '';
}
