import {
  getGlobalTenantId,
  normalizeTenantId,
  setGlobalTenantId,
  tenantIdsMatch,
} from './tenant-db.js';
import {
  ACTIVE_EMPLOYEE_STORAGE_KEY,
  clearTeamboardTenantStorage,
  scopedTeamboardStorageKey,
} from './teamboard-storage.js';

const TERMINAL_DEVICE_TOKEN_KEY = 'charculogic_terminal_device_token';

let authContext = null;
let authReadyPromise = null;
let resolveAuthReady = null;
let authStateListenerBound = false;

let authState = {
  firebase: null,
  db: null,
  showHUD: () => {},
  overlay: null,
  errorBox: null,
};

const CACHED_TENANT_ID_KEY = 'charculogic_cached_tenant_id';
export const AUTH_LOOP_BREAKER_KEY = 'charculogic_auth_loop_breaker';

export function activateAuthLoopBreaker() {
  try {
    sessionStorage.setItem(AUTH_LOOP_BREAKER_KEY, 'true');
  } catch (_) { /* noop */ }
}

export function isAuthLoopBreakerActive() {
  try {
    return sessionStorage.getItem(AUTH_LOOP_BREAKER_KEY) === 'true';
  } catch (_) {
    return false;
  }
}

export function clearAuthLoopBreaker() {
  try {
    sessionStorage.removeItem(AUTH_LOOP_BREAKER_KEY);
  } catch (_) { /* noop */ }
}

export function canStartFirestoreLiveListeners(firebaseInstance = authState.firebase) {
  if (isAuthLoopBreakerActive()) return false;
  try {
    const auth = firebaseInstance?.auth?.();
    if (!auth?.currentUser) return false;
    if (!authContext?.tenantId) return false;
    return true;
  } catch (_) {
    return false;
  }
}

export function hideAppShellForAuthLockdown() {
  document.body?.classList.add('auth-loop-lockdown');
  ensureLoginOverlay();
  showLoginOverlay('');
  setAuthError('');
}

export function restoreAppShellAfterAuth() {
  document.body?.classList.remove('auth-loop-lockdown');
  if (typeof window.applyModuleVisibility === 'function') {
    window.applyModuleVisibility(window.BRANDING || {});
  }
}

export function enforceAuthLoopBreakerShell() {
  hideAppShellForAuthLockdown();
}

function withTimeout(promise, timeoutMs, label = 'Operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} Timeout nach ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

function resolveFirebaseAppInstance() {
  if (authState.firebase?.apps?.length) return authState.firebase;
  if (typeof firebase !== 'undefined' && firebase.apps?.length) return firebase;
  return authState.firebase || (typeof firebase !== 'undefined' ? firebase : null);
}

export async function shutdownFirestoreClient({ clearPersistence = false } = {}) {
  const firebaseApp = resolveFirebaseAppInstance();
  if (!firebaseApp?.apps?.length) return;

  let firestoreInstance = null;
  try {
    firestoreInstance = firebaseApp.firestore();
    if (firestoreInstance && typeof firestoreInstance.terminate === 'function') {
      await firestoreInstance.terminate();
    }
  } catch (e) {
    console.error('Firestore termination failed', e);
  }

  if (!clearPersistence || !firestoreInstance) return;

  try {
    if (typeof firestoreInstance.clearPersistence === 'function') {
      await firestoreInstance.clearPersistence();
    }
  } catch (e) {
    console.error('Firestore clearPersistence failed', e);
  }
}

function cleanTenantId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function terminalDeviceTokenStorageKey(tenantId) {
  return scopedTeamboardStorageKey(TERMINAL_DEVICE_TOKEN_KEY, tenantId);
}

function readTerminalDeviceToken(tenantId) {
  try {
    return String(localStorage.getItem(terminalDeviceTokenStorageKey(tenantId)) || '').trim();
  } catch (_) {
    return '';
  }
}

function cacheTerminalDeviceToken(tenantId, token) {
  const cleanTenant = normalizeTenantId(tenantId);
  const cleanToken = String(token || '').trim();
  if (!cleanTenant || !cleanToken) return;
  try {
    localStorage.setItem(terminalDeviceTokenStorageKey(cleanTenant), cleanToken);
  } catch (err) {
    console.warn('[CharcuLogic Auth] Geräte-Zugangscode konnte nicht gespeichert werden:', err);
  }
}

function clearTerminalDeviceToken(tenantId) {
  try {
    localStorage.removeItem(terminalDeviceTokenStorageKey(tenantId));
  } catch (_) { /* noop */ }
}

function prefillTerminalLoginEmail(terminalEmail = '') {
  const email = String(terminalEmail || '').trim();
  if (!email) return;
  const emailEl = document.getElementById('auth-login-email');
  if (emailEl && !emailEl.value.trim()) {
    emailEl.value = email;
  }
}

function cachedTenantId() {
  try {
    return localStorage.getItem(CACHED_TENANT_ID_KEY);
  } catch (err) {
    console.warn('[CharcuLogic Auth] Tenant-Cache konnte nicht gelesen werden:', err);
    return '';
  }
}

function cacheTenantId(tenantId) {
  try {
    localStorage.setItem(CACHED_TENANT_ID_KEY, tenantId);
  } catch (err) {
    console.warn('[CharcuLogic Auth] Tenant-Cache konnte nicht geschrieben werden:', err);
  }
}

function clearSessionCaches() {
  try {
    const tenantId = authContext?.tenantId || cachedTenantId() || '';
    clearTeamboardTenantStorage(tenantId);
    localStorage.removeItem(CACHED_TENANT_ID_KEY);
    localStorage.removeItem(ACTIVE_EMPLOYEE_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('charculogic:active-employee-changed', {
      detail: { employeeName: '' },
    }));
  } catch (err) {
    console.warn('[CharcuLogic Auth] Session-Cache konnte nicht geloescht werden:', err);
  }
}

function roleFromClaims(claims = {}) {
  if (claims.isAdmin === true || claims.admin === true) return 'admin';
  const role = typeof claims.role === 'string' ? claims.role.trim() : '';
  if (role === 'admin' || role === 'employee' || role === 'helper') return role;
  return '';
}

function tenantIdFromClaims(claims = {}) {
  return cleanTenantId(claims.tenantId || claims.tenant_id || claims.tenantID);
}

function claimsAreComplete(claims = {}) {
  return Boolean(tenantIdFromClaims(claims) && roleFromClaims(claims));
}

function ensureAuthConfigured() {
  if (!authState.firebase?.auth) {
    throw new Error('Firebase Auth ist nicht geladen.');
  }
}

function setAuthError(message) {
  if (authState.errorBox) {
    authState.errorBox.textContent = message || '';
    authState.errorBox.style.display = message ? 'block' : 'none';
  }
}

function ensureLoginOverlay() {
  let overlay = document.getElementById('auth-lock-screen');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'auth-lock-screen';
    overlay.innerHTML = `
      <div class="auth-lock-card" role="dialog" aria-modal="true" aria-labelledby="auth-lock-title">
        <div class="auth-lock-brand brand-app-name"></div>
        <h1 id="auth-lock-title"><span class="brand-betriebs-name"></span></h1>
        <p class="auth-lock-tagline"></p>
        <form id="auth-login-form" class="auth-lock-form">
          <label>
            <span>E-Mail</span>
            <input id="auth-login-email" type="email" autocomplete="username" required>
          </label>
          <label>
            <span>Passwort</span>
            <input id="auth-login-password" type="password" autocomplete="current-password" required>
          </label>
          <button type="submit">Anmelden</button>
        </form>
        <details class="auth-token-panel">
          <summary>Geräte-Zugang verwenden</summary>
          <form id="auth-token-form" class="auth-lock-form">
            <label>
              <span>Zugangscode</span>
              <textarea id="auth-login-token" rows="3" spellcheck="false"></textarea>
            </label>
            <button type="submit">Mit Zugangscode anmelden</button>
          </form>
        </details>
        <div id="auth-login-error" class="auth-lock-error" role="alert"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    const style = document.createElement('style');
    style.id = 'auth-lock-styles';
    style.textContent = `
      #auth-lock-screen {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: rgba(8, 12, 18, 0.92);
        color: #f8fafc;
      }
      #auth-lock-screen.active { display: flex; }
      body.auth-loop-lockdown #auth-lock-screen {
        display: flex !important;
        z-index: 100000;
        pointer-events: auto;
      }
      body.auth-loop-lockdown .app-container {
        pointer-events: none;
        user-select: none;
      }
      .auth-lock-card {
        width: min(440px, 100%);
        background: #111827;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 8px;
        padding: 28px;
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.42);
      }
      .auth-lock-brand {
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0;
        color: #93c5fd;
        margin-bottom: 10px;
      }
      .auth-lock-card h1 {
        font-size: 24px;
        line-height: 1.2;
        margin: 0 0 10px;
      }
      .auth-lock-card p {
        color: #cbd5e1;
        line-height: 1.45;
        margin: 0 0 20px;
      }
      .auth-lock-form {
        display: grid;
        gap: 14px;
      }
      .auth-lock-form label {
        display: grid;
        gap: 6px;
        color: #e2e8f0;
        font-size: 14px;
      }
      .auth-lock-form input,
      .auth-lock-form textarea {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid rgba(148, 163, 184, 0.45);
        border-radius: 6px;
        background: #020617;
        color: #f8fafc;
        font: inherit;
        padding: 11px 12px;
      }
      .auth-lock-form button {
        min-height: 44px;
        border: 0;
        border-radius: 6px;
        background: #2563eb;
        color: #ffffff;
        font-weight: 800;
        cursor: pointer;
      }
      .auth-token-panel {
        margin-top: 16px;
        color: #cbd5e1;
      }
      .auth-token-panel summary {
        cursor: pointer;
        margin-bottom: 12px;
      }
      .auth-lock-error {
        display: none;
        margin-top: 16px;
        padding: 10px 12px;
        border-radius: 6px;
        background: rgba(220, 38, 38, 0.16);
        color: #fecaca;
      }
    `;
    document.head.appendChild(style);
  }

  authState.overlay = overlay;
  authState.errorBox = document.getElementById('auth-login-error');

  if (typeof window.applyResolvedBranding === 'function') {
    const brandingTenantId = typeof window.resolveEffectiveTenantId === 'function'
      ? window.resolveEffectiveTenantId()
      : '';
    window.applyResolvedBranding(brandingTenantId || undefined);
  } else if (typeof window.applyBranding === 'function') {
    window.applyBranding();
  }

  document.getElementById('auth-login-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    setAuthError('');
    const email = document.getElementById('auth-login-email')?.value.trim();
    const password = document.getElementById('auth-login-password')?.value || '';
    try {
      await loginTenant(email, password);
    } catch (err) {
      console.warn('[CharcuLogic Auth] Anmeldung fehlgeschlagen:', err);
      const message = String(err?.message || '');
      if (message.includes('Mandant')) {
        setAuthError(message);
      } else if (err?.code === 'auth/invalid-credential' || err?.code === 'auth/wrong-password' || err?.code === 'auth/user-not-found') {
        setAuthError('Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.');
      } else {
        setAuthError('Anmeldung fehlgeschlagen. Bitte Zugangsdaten prüfen.');
      }
    }
  });

  document.getElementById('auth-token-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    setAuthError('');
    const token = document.getElementById('auth-login-token')?.value.trim();
    try {
      await loginWithToken(token);
    } catch (err) {
      console.warn('[CharcuLogic Auth] Token-Anmeldung fehlgeschlagen:', err);
      setAuthError('Geräte-Zugang fehlgeschlagen. Bitte Zugangscode prüfen.');
    }
  });
}

function bindHeaderLogoutButton() {
  const trigger = document.getElementById('header-logout-btn');
  if (!trigger || trigger.dataset.authBound === '1') return;
  trigger.dataset.authBound = '1';
  trigger.addEventListener('click', async () => {
    try {
      window.showToast?.("Abgemeldet. System wird neu geladen...", "warning");
      clearSessionCaches();
      authContext = null;
      await shutdownFirestoreClient();
      if (authState.firebase?.auth) {
        await authState.firebase.auth().signOut();
      }
    } catch (err) {
      console.warn('[CharcuLogic Auth] Emergency Logout fehlgeschlagen:', err);
      clearSessionCaches();
    } finally {
      setTimeout(() => {
        window.location.reload(true);
      }, 800);
    }
  });
}

function showLoginOverlay(message = '') {
  ensureLoginOverlay();
  authState.overlay.classList.add('active');
  document.documentElement.dataset.authenticatedTenant = '';
  setAuthError(message);
}

function hideLoginOverlay() {
  ensureLoginOverlay();
  authState.overlay.classList.remove('active');
  setAuthError('');
}

async function waitForAuthDb(maxMs = 5000) {
  const started = Date.now();
  while (!authState.db && Date.now() - started < maxMs) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return authState.db;
}

async function readFirestoreProfileDoc(collectionName, uid) {
  const snap = await withTimeout(
    authState.db.collection(collectionName).doc(uid).get(),
    5000,
    `Profil-Read ${collectionName}/${uid}`,
  );
  if (!snap.exists) return null;
  return snap.data() || {};
}

/**
 * Liest zuerst /users/{uid}, danach /userTenants/{uid} (Fallback ohne Custom Claims).
 */
async function readUserProfile(uid) {
  if (!uid) return { source: null, data: {} };

  await waitForAuthDb();
  if (!authState.db) {
    console.warn('[CharcuLogic Auth] Firestore nicht bereit – Nutzerprofil kann nicht geladen werden.');
    return { source: null, data: {} };
  }

  for (const collectionName of ['users', 'userTenants']) {
    try {
      const data = await readFirestoreProfileDoc(collectionName, uid);
      if (data) {
        return { source: collectionName, data };
      }
    } catch (err) {
      console.warn(`[CharcuLogic Auth] Profil ${collectionName}/${uid} konnte nicht gelesen werden:`, err);
    }
  }
  return { source: null, data: {} };
}

async function buildAuthContext(user) {
  // Erzwingt frische Custom Claims nach set-user-claims.mjs (ohne Logout-Zyklus).
  await user.getIdToken(true);
  const tokenResult = await user.getIdTokenResult();
  let claims = tokenResult?.claims || {};

  if (!claimsAreComplete(claims)) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await user.getIdToken(true);
    const retryResult = await user.getIdTokenResult();
    claims = retryResult?.claims || {};
  }

  const tenantId = tenantIdFromClaims(claims);
  const role = roleFromClaims(claims);

  if (!tenantId || !role) {
    console.warn('[CharcuLogic Auth] Custom Claims fehlen oder sind unvollständig.', {
      uid: user.uid,
      hasTenantId: Boolean(tenantId),
      hasRole: Boolean(role),
    });
    throw new Error(
      'Anmeldung ist noch nicht vollständig eingerichtet. Bitte im Büro Bescheid geben.',
    );
  }

  let profile = {};
  let profileSource = null;
  try {
    ({ source: profileSource, data: profile } = await readUserProfile(user.uid));
  } catch (err) {
    console.warn('[CharcuLogic Auth] Profil-Read optional fehlgeschlagen:', err);
  }

  cacheTenantId(tenantId);
  setGlobalTenantId(tenantId);

  return {
    user,
    uid: user.uid,
    email: user.email || '',
    tenantId,
    role,
    claims,
    profile,
    profileSource,
    isAdmin: role === 'admin',
    isHelper: role === 'helper',
  };
}

export function isHelperUser() {
  return authContext?.role === 'helper' || authContext?.isHelper === true;
}

/** Admin-Konto im Büro (nicht Helper-Terminal am Laden). */
export function isOfficeUser(session = authContext) {
  if (!session) return false;
  return Boolean(session.isAdmin && !session.isHelper);
}

export function initAuthModule(firebaseInstance, databaseInstance, { showHUD } = {}) {
  authState.firebase = firebaseInstance;
  authState.db = databaseInstance;
  authState.showHUD = typeof showHUD === 'function' ? showHUD : authState.showHUD;

  ensureAuthConfigured();
  ensureLoginOverlay();
  bindHeaderLogoutButton();

  if (!authReadyPromise) {
    authReadyPromise = new Promise((resolve) => {
      resolveAuthReady = resolve;
    });
  }

  authState.firebase.auth().setPersistence(authState.firebase.auth.Auth.Persistence.LOCAL).catch((err) => {
    console.warn('[CharcuLogic Auth] Persistenz konnte nicht gesetzt werden:', err);
  });

  if (authStateListenerBound) {
    return authReadyPromise;
  }
  authStateListenerBound = true;

  authState.firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) {
      authContext = null;
      document.documentElement.dataset.authenticatedTenant = '';
      if (isAuthLoopBreakerActive()) {
        enforceAuthLoopBreakerShell();
      } else {
        setGlobalTenantId(null);
        showLoginOverlay();
      }
      return;
    }

    try {
      const nextContext = await buildAuthContext(user);
      clearAuthLoopBreaker();
      authContext = nextContext;
      document.documentElement.dataset.authenticatedTenant = nextContext.tenantId;
      if (typeof window.applyResolvedBranding === 'function') {
        window.applyResolvedBranding(nextContext.tenantId);
      }
      completeSuccessfulAuthUnlock(nextContext);
      if (resolveAuthReady) {
        resolveAuthReady(nextContext);
        resolveAuthReady = null;
      }
    } catch (err) {
      authContext = null;
      setGlobalTenantId(null);
      console.warn('[CharcuLogic Auth] Mandant konnte nicht ermittelt werden:', err);
      showLoginOverlay('Anmeldung ist noch nicht vollständig eingerichtet. Bitte im Büro Bescheid geben.');
    }
  });

  return authReadyPromise;
}

export function waitForAuthReady() {
  if (!authReadyPromise) throw new Error('Auth-Modul wurde noch nicht initialisiert.');
  return authReadyPromise;
}

export function getAuthContext() {
  return authContext;
}

export function getTenantId() {
  return authContext?.tenantId || '';
}

export function getFirebaseAuthUser() {
  return authState.firebase?.auth?.().currentUser || authContext?.user || null;
}

export function isFirebaseAuthActiveForTenant(expectedTenantId) {
  const sessionTenantId = authContext?.tenantId || getGlobalTenantId();
  if (!tenantIdsMatch(expectedTenantId, sessionTenantId)) return false;
  return Boolean(getFirebaseAuthUser());
}

export async function waitForFirebaseUser(timeoutMs = 4000) {
  ensureAuthConfigured();
  const auth = authState.firebase.auth();
  if (auth.currentUser) return auth.currentUser;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (user) => {
      if (settled) return;
      settled = true;
      unsub();
      resolve(user || auth.currentUser || null);
    };
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) finish(user);
    });
    setTimeout(() => finish(auth.currentUser || null), timeoutMs);
  });
}

export async function ensureFirebaseAuthForTenant(expectedTenantId, options = {}) {
  const expected = cleanTenantId(expectedTenantId);
  if (!normalizeTenantId(expected)) return false;
  if (options.skipAutoRestore) {
    prefillTerminalLoginEmail(options.terminalEmail);
    showLoginOverlay('');
    setAuthError('');
    return false;
  }
  if (isFirebaseAuthActiveForTenant(expected)) return true;

  const restoredUser = await waitForFirebaseUser(3000);
  if (restoredUser) {
    try {
      if (!authContext || !tenantIdsMatch(authContext.tenantId, expected)) {
        authContext = await buildAuthContext(restoredUser);
      }
      if (isFirebaseAuthActiveForTenant(expected)) {
        hideLoginOverlay();
        return true;
      }
    } catch (err) {
      console.warn('[CharcuLogic Auth] Wiederhergestellte Firebase-Session ist ungültig:', err);
    }
  }

  const storedToken = readTerminalDeviceToken(expected);
  if (storedToken) {
    try {
      await loginWithToken(storedToken, { persistDeviceToken: true, expectedTenantId: expected });
      const restoredAfterToken = authState.firebase.auth().currentUser;
      if (!authContext && restoredAfterToken) {
        authContext = await buildAuthContext(restoredAfterToken);
      }
      if (isFirebaseAuthActiveForTenant(expected)) {
        hideLoginOverlay();
        return true;
      }
    } catch (err) {
      console.warn('[CharcuLogic Auth] Gespeicherter Geräte-Zugangscode ist ungültig:', err);
      clearTerminalDeviceToken(expected);
    }
  }

  prefillTerminalLoginEmail(options.terminalEmail);
  showLoginOverlay('Bitte den Betriebs-Gerätezugang bestätigen. Die Mitarbeiter-Auswahl folgt danach.');
  return false;
}

let lastSuccessfulAuthUnlockKey = '';
let lastAuthUnlockAt = 0;

function completeSuccessfulAuthUnlock(nextContext) {
  const unlockKey = `${nextContext?.uid || ''}:${normalizeTenantId(nextContext?.tenantId)}`;
  const now = Date.now();
  const isRepeatUnlock = Boolean(
    unlockKey
    && unlockKey === lastSuccessfulAuthUnlockKey
    && (now - lastAuthUnlockAt) < 30000,
  );

  clearAuthLoopBreaker();
  hideLoginOverlay();
  restoreAppShellAfterAuth();

  if (!isRepeatUnlock) {
    lastSuccessfulAuthUnlockKey = unlockKey;
    lastAuthUnlockAt = now;
    if (typeof window.startTenantLiveDataListeners === 'function') {
      window.startTenantLiveDataListeners();
    }
    window.dispatchEvent(new CustomEvent('charculogic:auth-changed', { detail: nextContext }));
    return;
  }

  if (typeof window.startTenantLiveDataListeners === 'function') {
    window.startTenantLiveDataListeners();
  }
}

export async function loginTenant(email, password) {
  ensureAuthConfigured();
  if (!email || !password) throw new Error('E-Mail und Passwort sind erforderlich.');
  return authState.firebase.auth().signInWithEmailAndPassword(email, password);
}

export async function loginWithToken(token, options = {}) {
  ensureAuthConfigured();
  if (!token) throw new Error('Zugangscode fehlt.');

  const expectedTenantId = cleanTenantId(options.expectedTenantId || '');
  if (expectedTenantId && isFirebaseAuthActiveForTenant(expectedTenantId)) {
    return { user: authState.firebase.auth().currentUser };
  }

  const credential = await authState.firebase.auth().signInWithCustomToken(token);
  if (credential?.user && options.persistDeviceToken !== false) {
    const tenantId = authContext?.tenantId || expectedTenantId || getGlobalTenantId();
    if (tenantId) cacheTerminalDeviceToken(tenantId, token);
  }
  return credential;
}

export async function logoutTenant(options = {}) {
  ensureAuthConfigured();
  const tenantId = authContext?.tenantId || cachedTenantId();
  clearSessionCaches();
  if (tenantId) clearTerminalDeviceToken(tenantId);
  await shutdownFirestoreClient(options);
  return authState.firebase.auth().signOut();
}

export function verifyAdminAction(callback) {
  if (authContext?.isAdmin) {
    callback();
    return;
  }
  authState.showHUD('Admin-Rechte erforderlich', 'Diese Aktion erfordert ein Admin-Konto.', '!');
}
