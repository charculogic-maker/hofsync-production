/**
 * Zentraler Firebase-App-Bootstrap — ein einziger initializeApp()-Einstieg.
 */
import {
  getAppCheckSiteKey,
  resolveFirebaseConfig,
  resolveFirebaseProjectDisplayName,
  resolveFirebaseProjectKey,
  toFirebaseSdkConfig,
} from './firebase-config.js';

export { getAppCheckSiteKey };

let isolationLogged = false;

const EMERGENCY_LOGOUT_FLAG = '__charculogicEmergencyLogoutInFlight';

/**
 * Notausgang-Check: erkennt ?logout=true oder ?forceLogout=true in der URL.
 * Rein synchron, damit er ganz oben vor jedem Auth-/Routing-Check laufen kann.
 */
export function isEmergencyLogoutRequested(search = (typeof window !== 'undefined' ? window.location?.search : '') || '') {
  try {
    const params = new URLSearchParams(search);
    return params.get('logout') === 'true' || params.get('forceLogout') === 'true';
  } catch (_) {
    return false;
  }
}

function clearLocalSessionCache() {
  const stores = [];
  try { if (window.localStorage) stores.push(window.localStorage); } catch (_) { /* noop */ }
  try { if (window.sessionStorage) stores.push(window.sessionStorage); } catch (_) { /* noop */ }

  stores.forEach((store) => {
    let keys = [];
    try {
      for (let i = 0; i < store.length; i += 1) {
        const key = store.key(i);
        if (key) keys.push(key);
      }
    } catch (_) {
      keys = [];
    }
    keys.forEach((key) => {
      const lower = String(key).toLowerCase();
      if (
        lower.includes('charculogic')
        || lower.includes('firebase')
        || lower.includes('hofsync')
        || lower.includes('tenant')
        || lower.includes('employee')
      ) {
        try { store.removeItem(key); } catch (_) { /* noop */ }
      }
    });
  });
}

/**
 * Führt den Notausgang aus: Session-Cache leeren, Firebase-SignOut, sauberer Reload.
 * Idempotent über ein Fenster-Flag, damit App.js und Dev-Dashboard ihn gefahrlos
 * beide aufrufen können.
 */
export async function handleEmergencyLogoutParam() {
  if (typeof window === 'undefined') return false;
  if (!isEmergencyLogoutRequested()) return false;
  if (window[EMERGENCY_LOGOUT_FLAG]) return true;
  window[EMERGENCY_LOGOUT_FLAG] = true;

  console.warn('[CharcuLogic Auth] Notausgang ausgelöst — Session wird beendet.');

  clearLocalSessionCache();

  try {
    const firebaseApi = typeof firebase !== 'undefined' ? firebase : null;
    if (firebaseApi) {
      if (!firebaseApi.apps?.length) {
        try { ensureFirebaseApp(firebaseApi); } catch (_) { /* App evtl. noch nicht konfigurierbar */ }
      }
      if (firebaseApi.apps?.length && typeof firebaseApi.auth === 'function') {
        await firebaseApi.auth().signOut().catch(() => { /* trotzdem reloaden */ });
      }
    }
  } catch (err) {
    console.warn('[CharcuLogic Auth] Notausgang-SignOut fehlgeschlagen:', err);
  }

  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('logout');
    url.searchParams.delete('forceLogout');
    window.location.replace(url.toString());
  } catch (_) {
    window.location.replace(window.location.pathname || '/');
  }
  return true;
}

export function ensureFirebaseApp(firebaseApi = typeof firebase !== 'undefined' ? firebase : null) {
  if (!firebaseApi) {
    throw new Error('[CharcuLogic Firebase] Firebase SDK nicht geladen.');
  }
  if (!firebaseApi.apps?.length) {
    firebaseApi.initializeApp(toFirebaseSdkConfig(resolveFirebaseConfig()));
    logProjectIsolation(firebaseApi);
  }
  return firebaseApi.app();
}

export function logProjectIsolation(firebaseApi = typeof firebase !== 'undefined' ? firebase : null) {
  if (isolationLogged) return;
  isolationLogged = true;

  const displayName = resolveFirebaseProjectDisplayName();
  const projectKey = resolveFirebaseProjectKey();
  const expectedProjectId = resolveFirebaseConfig().projectId;
  const activeProjectId = String(firebaseApi?.app?.()?.options?.projectId || expectedProjectId).trim();

  const host = typeof window !== 'undefined' ? String(window.location?.hostname || '') : '';
  const sdk = firebaseApi?.app?.()?.options || {};

  console.info(`[System] Initialisiert für: ${displayName}`);
  console.info('[System] Auth-Ziel', {
    host: host || '(kein Browser-Host)',
    projectKey,
    projectId: activeProjectId,
    authDomain: sdk.authDomain || resolveFirebaseConfig().authDomain,
    apiKeyPrefix: String(sdk.apiKey || resolveFirebaseConfig().apiKey || '').slice(0, 8),
    localhostHardwired: false,
  });

  if (activeProjectId && activeProjectId !== expectedProjectId) {
    console.error(
      '[System] Cross-Projekt-Kontamination erkannt — '
      + `aktive App="${activeProjectId}", erwartet="${expectedProjectId}" (${projectKey}).`,
    );
    return;
  }

  console.info(
    `[System] Firebase-Projekt "${activeProjectId}" (${projectKey}) — `
    + 'Mandanten-Tenant bleibt dynamisch, Backend-Kontext ist domain-gebunden.',
  );
}

export function assertFirebaseProjectIsolation(firebaseApi = typeof firebase !== 'undefined' ? firebase : null) {
  const expectedProjectId = resolveFirebaseConfig().projectId;
  const activeProjectId = String(firebaseApi?.app?.()?.options?.projectId || '').trim();
  if (activeProjectId && activeProjectId !== expectedProjectId) {
    console.error(
      '[System] Cross-Projekt-Kontamination erkannt — '
      + `aktive App="${activeProjectId}", erwartet="${expectedProjectId}".`,
    );
    return false;
  }
  return true;
}
