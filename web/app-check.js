/**
 * Firebase App Check – Compat SDK (aligned with firebase-app.js v10.8.x).
 * Requires firebase-app-check-compat.js loaded before this module runs.
 */
import { isLocalDevHost } from './dev-guards.js';
import { getAppCheckSiteKey, resolveFirebaseProjectKey } from './firebase-config.js';

const DEBUG_TOKEN_STORAGE_KEY = 'charculogic_appcheck_debug_token';

/** @type {Promise<void> | null} */
let appCheckReadyPromise = null;
let appCheckActivationFailed = false;

export function configureAppCheckDebugProvider() {
  if (!isLocalDevHost()) return false;

  try {
    try { localStorage.removeItem(DEBUG_TOKEN_STORAGE_KEY); } catch (_) { /* noop */ }
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = "92603496-35B1-47B1-BBC1-6FE31249BF21";
    console.info(
      '[AppCheck] Lokaler Debug-Modus aktiv. Registrierter Debug-Schlüssel wird verwendet.',
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
function isAppCheckNoise(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return /app-check|appcheck|recaptcha|timeout/.test(msg);
}

export function initAppCheckModule() {
  if (appCheckReadyPromise) return appCheckReadyPromise;

  appCheckReadyPromise = (async () => {
    try {
      assertCompatAppCheckAvailable();

      const projectKey = resolveFirebaseProjectKey();
      const siteKey = getAppCheckSiteKey(projectKey);
      if (!siteKey) {
        appCheckActivationFailed = true;
        console.warn(`[AppCheck] Site Key fehlt für Profil "${projectKey}". App läuft mit lokalen Daten weiter.`);
        return;
      }

      configureAppCheckDebugProvider();

      const appCheck = firebase.appCheck();
      appCheck.activate(
        new firebase.appCheck.ReCaptchaV3Provider(siteKey),
        true,
      );

      appCheckActivationFailed = false;
      console.info(`[AppCheck] Initialisiert (${projectKey}, reCAPTCHA v3, profilgebundener Site Key).`);
    } catch (err) {
      appCheckActivationFailed = true;
      console.warn('[AppCheck] Aktivierung fehlgeschlagen. Vorschau/Offline nutzt gecachte Daten.', err);
    }
  })();

  return appCheckReadyPromise;
}

/**
 * Wartet auf App Check, blockiert die UI aber nicht.
 * Fehlende reCAPTCHA-/Vorschau-Umgebung löst trotzdem auf, damit Firestore-Cache weiterläuft.
 */
export function waitForAppCheckReady() {
  if (!appCheckReadyPromise) return Promise.resolve();
  return appCheckReadyPromise.catch((err) => {
    if (!isAppCheckNoise(err)) {
      console.warn('[AppCheck] Warten abgebrochen, lokale Daten bleiben nutzbar.', err);
    }
  });
}

export function isAppCheckInitialized() {
  return Boolean(appCheckReadyPromise) && !appCheckActivationFailed;
}
