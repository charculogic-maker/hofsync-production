/**
 * Firebase App Check – Compat SDK (aligned with firebase-app.js v10.8.x).
 * Requires firebase-app-check-compat.js loaded before this module runs.
 */
import { isLocalDevHost } from './dev-guards.js';
import { FIREBASE_PROJECTS, resolveFirebaseProjectKey } from './firebase-config.js';

const DEBUG_TOKEN_STORAGE_KEY = 'charculogic_appcheck_debug_token';

/** @type {Promise<void> | null} */
let appCheckReadyPromise = null;
let appCheckActivationFailed = false;

function readConfiguredSiteKey() {
  const projectKey = resolveFirebaseProjectKey();
  const siteKey = FIREBASE_PROJECTS[projectKey]?.appCheckRecaptchaSiteKey || '';
  const trimmed = String(siteKey).trim();
  if (!trimmed || trimmed.startsWith('REPLACE_')) return '';
  return trimmed;
}

export function configureAppCheckDebugProvider() {
  if (!isLocalDevHost()) return false;

  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('appCheckDebugToken')?.trim();
    const fromStorage = localStorage.getItem(DEBUG_TOKEN_STORAGE_KEY)?.trim();

    if (fromQuery) {
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = fromQuery;
      localStorage.setItem(DEBUG_TOKEN_STORAGE_KEY, fromQuery);
      console.info('[AppCheck] Debug-Token aus URL/localStorage aktiv.');
      return true;
    }
    if (fromStorage) {
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = fromStorage;
      console.info('[AppCheck] Debug-Token aus localStorage aktiv.');
      return true;
    }

    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    console.info(
      '[AppCheck] Debug-Modus aktiv. Kopiere das Token aus der Browser-Konsole '
      + 'und registriere es in Firebase Console → App Check → Apps → Debug-Tokens.',
    );
    return true;
  } catch (err) {
    console.warn('[AppCheck] Debug-Provider konnte nicht konfiguriert werden:', err);
    return false;
  }
}

function assertCompatAppCheckAvailable() {
  if (typeof firebase === 'undefined' || !firebase.apps?.length) {
    throw new Error('[AppCheck] Firebase App muss vor App Check initialisiert sein.');
  }
  if (typeof firebase.appCheck !== 'function') {
    throw new Error('[AppCheck] firebase-app-check-compat.js fehlt in index.html.');
  }
}

/**
 * App Check initialisieren – muss vor dem ersten httpsCallable-Aufruf abgeschlossen sein.
 * @returns {Promise<void>}
 */
export function initAppCheckModule() {
  if (appCheckReadyPromise) return appCheckReadyPromise;

  appCheckReadyPromise = (async () => {
    assertCompatAppCheckAvailable();

    const siteKey = readConfiguredSiteKey();
    if (!siteKey) {
      const msg = '[AppCheck] appCheckRecaptchaSiteKey fehlt oder ist Platzhalter in web/firebase-config.js.';
      console.error(msg);
      appCheckActivationFailed = true;
      throw new Error(msg);
    }

    configureAppCheckDebugProvider();

    const appCheck = firebase.appCheck();
    appCheck.activate(
      new firebase.appCheck.ReCaptchaV3Provider(siteKey),
      true,
    );

    appCheckActivationFailed = false;
    console.info(`[AppCheck] Initialisiert (${resolveFirebaseProjectKey()}, Compat reCAPTCHA v3).`);
  })().catch((err) => {
    appCheckActivationFailed = true;
    appCheckReadyPromise = null;
    console.error('[AppCheck] Aktivierung fehlgeschlagen:', err);
    throw err;
  });

  return appCheckReadyPromise;
}

/** Wartet auf abgeschlossene App-Check-Initialisierung — lehnt ab wenn nie gestartet oder fehlgeschlagen. */
export function waitForAppCheckReady() {
  if (appCheckActivationFailed) {
    return Promise.reject(new Error('[AppCheck] Initialisierung fehlgeschlagen — Callables gesperrt.'));
  }
  if (!appCheckReadyPromise) {
    return Promise.reject(new Error('[AppCheck] initAppCheckModule() wurde noch nicht aufgerufen.'));
  }
  return appCheckReadyPromise;
}

export function isAppCheckInitialized() {
  return Boolean(appCheckReadyPromise) && !appCheckActivationFailed;
}
