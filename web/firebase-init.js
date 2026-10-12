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

const SECRET_LOGO_SELECTOR = [
  '.brand-logo',
  '#cldc-logo',
  '#tenant-header-logo',
  '#dev-dashboard-tenant-logo',
  '#app-nav-brand-logo',
  '.app-badge',
].join(', ');

/**
 * Sitzung beenden, lokale Mandanten-Caches leeren und neu laden.
 * Der Reload zeigt die Login-Maske, sobald kein Firebase-User mehr da ist.
 */
export async function signOutAndShowLogin() {
  if (typeof window === 'undefined') return;
  if (window.__charculogicSecretSignOut) return;
  window.__charculogicSecretSignOut = true;

  try {
    const { logoutTenant } = await import('./auth.js');
    await logoutTenant({ clearPersistence: true });
  } catch (err) {
    console.warn('[CharcuLogic Auth] Abmelden fehlgeschlagen:', err);
    try {
      const firebaseApi = typeof firebase !== 'undefined' ? firebase : null;
      if (firebaseApi?.apps?.length && typeof firebaseApi.auth === 'function') {
        await firebaseApi.auth().signOut();
      }
    } catch (_) { /* Reload zeigt trotzdem die Login-Maske. */ }
  }

  clearLocalSessionCache();
  window.location.reload();
}

/** Dreifachklick aufs Logo und Strg+Alt+L. Mehrfachaufruf bleibt einmalig. */
export function installSecretLogoutGestures() {
  if (typeof document === 'undefined') return;
  if (window.__charculogicSecretLogoutGestures) return;
  window.__charculogicSecretLogoutGestures = true;

  let clicks = [];
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest(SECRET_LOGO_SELECTOR)) return;
    const now = Date.now();
    clicks = clicks.filter((stamp) => now - stamp <= 1500);
    clicks.push(now);
    if (clicks.length < 3) return;
    clicks = [];
    if (!window.confirm('Möchtest du dich wirklich abmelden?')) return;
    void signOutAndShowLogin();
  });

  document.addEventListener('keydown', (event) => {
    if (!event.ctrlKey || !event.altKey) return;
    if (String(event.key || '').toLowerCase() !== 'l') return;
    event.preventDefault();
    void signOutAndShowLogin();
  });
}

export function ensureFirebaseApp(firebaseApi = typeof firebase !== 'undefined' ? firebase : null) {
  if (!firebaseApi) {
    throw new Error('[CharcuLogic Firebase] Firebase SDK nicht geladen.');
  }
  if (!firebaseApi.apps?.length) {
    firebaseApi.initializeApp(toFirebaseSdkConfig(resolveFirebaseConfig()));
    logProjectIsolation(firebaseApi);
  }
  const app = firebaseApi.app();
  if (typeof window !== 'undefined') window.firebaseApp = app;
  return app;
}

/**
 * Firestore v10+: IndexedDB-Cache über persistentLocalCache statt
 * enableIndexedDbPersistence. Schlägt der Abruf fehl, bleibt der bisherige
 * Compat-Pfad in app.js der Fallback.
 */
export async function ensureFirestorePersistentCache(app, firebaseApi = typeof firebase !== 'undefined' ? firebase : null) {
  if (!app) return 'unavailable';
  if (app.__hofsyncPersistentCache === 'persistentLocalCache') return 'persistentLocalCache';
  try {
    const modular = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
    if (typeof modular.initializeFirestore !== 'function'
      || typeof modular.persistentLocalCache !== 'function'
      || typeof modular.persistentMultipleTabManager !== 'function') {
      return 'fallback';
    }
    modular.initializeFirestore(app, {
      localCache: modular.persistentLocalCache({
        tabManager: modular.persistentMultipleTabManager(),
      }),
    });
    app.__hofsyncPersistentCache = 'persistentLocalCache';
    return 'persistentLocalCache';
  } catch (err) {
    console.warn('[CharcuLogic Firebase] persistentLocalCache nicht gesetzt:', err?.message || err);
    if (firebaseApi) return 'fallback';
    return 'fallback';
  }
}

/** Bereits initialisierte Compat-App. Kein parameterloses getApp(). */
export function getFirebaseApp(firebaseApi = typeof firebase !== 'undefined' ? firebase : null) {
  if (typeof window !== 'undefined' && window.firebaseApp) return window.firebaseApp;
  if (firebaseApi?.apps?.length && typeof firebaseApi.app === 'function') {
    const app = firebaseApi.app();
    if (typeof window !== 'undefined') window.firebaseApp = app;
    return app;
  }
  return null;
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
