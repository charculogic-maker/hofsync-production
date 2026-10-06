/**
 * Firebase App Check – Compat SDK (aligned with firebase-app.js v10.8.x).
 * Requires firebase-app-check-compat.js loaded before this module runs.
 */
import { isLocalDevHost } from './dev-guards.js';
import { getAppCheckSiteKey, resolveFirebaseProjectKey } from './firebase-config.js';
import { getFirebaseApp } from './firebase-init.js';

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

function appCheckForApp(app) {
  if (!app) {
    throw new Error('[AppCheck] Firebase App muss vor App Check initialisiert sein.');
  }
  if (typeof app.appCheck === 'function') return app.appCheck();
  if (typeof firebase !== 'undefined' && typeof firebase.appCheck === 'function') {
    return firebase.appCheck(app);
  }
  throw new Error('[AppCheck] firebase-app-check-compat.js fehlt in index.html.');
}

/**
 * App Check initialisieren – muss vor dem ersten httpsCallable-Aufruf abgeschlossen sein.
 * @returns {Promise<void>}
 */
export function isRecaptchaAppCheckError(err) {
  const code = String(err?.code || '').toLowerCase();
  const message = String(err?.message || err || '').toLowerCase();
  const stack = String(err?.stack || '').toLowerCase();
  return code.includes('recaptcha')
    || code.includes('app-check')
    || code.includes('appcheck')
    || /recaptcha|app-check|appcheck|use-before-activation/.test(`${message} ${stack}`);
}

function isAppCheckNoise(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return isRecaptchaAppCheckError(err) || /timeout/.test(msg);
}

function isVercelHost() {
  if (typeof window === 'undefined') return false;
  return String(window.location.hostname || '').toLowerCase().endsWith('.vercel.app');
}

function installRecaptchaRejectionGuard() {
  if (typeof window === 'undefined' || window.__charculogicRecaptchaGuard) return;
  window.__charculogicRecaptchaGuard = true;

  const swallow = (event) => {
    const reason = event?.reason ?? event?.error;
    const filename = String(event?.filename || '');
    const message = String(reason?.message || reason || event?.message || '');
    const blob = `${message} ${filename} ${reason?.stack || ''} ${reason?.code || ''}`;
    if (!isRecaptchaAppCheckError(reason) && !/recaptcha|app-check|appcheck/i.test(blob)) return;
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    console.warn('[AppCheck] reCAPTCHA-Fehler abgefangen, Auth und Netzwerk laufen weiter.', message || reason?.code || 'recaptcha');
  };

  window.addEventListener('unhandledrejection', swallow, true);
  window.addEventListener('error', swallow, true);
}

installRecaptchaRejectionGuard();

export function initAppCheckModule() {
  installRecaptchaRejectionGuard();
  if (appCheckReadyPromise) return appCheckReadyPromise;

  appCheckReadyPromise = (async () => {
    try {
      const app = getFirebaseApp();
      if (!app) {
        throw new Error('[AppCheck] Firebase App muss vor App Check initialisiert sein.');
      }

      const projectKey = resolveFirebaseProjectKey();
      const siteKey = getAppCheckSiteKey(projectKey);
      if (!siteKey) {
        appCheckActivationFailed = true;
        console.warn(`[AppCheck] Site Key fehlt für Profil "${projectKey}". App läuft mit lokalen Daten weiter.`);
        return;
      }

      // reCAPTCHA v3 lehnt *.vercel.app ab und @firebase/app-check loggt das als roten Fehler.
      if (isVercelHost()) {
        appCheckActivationFailed = true;
        console.info('[AppCheck] Auf dieser Vercel-Domain aus. Firestore und Anmeldung laufen ohne reCAPTCHA-Token.');
        return;
      }

      configureAppCheckDebugProvider();

      const appCheck = appCheckForApp(app);
      appCheck.activate(
        new firebase.appCheck.ReCaptchaV3Provider(siteKey),
        true,
      );

      appCheckActivationFailed = false;
      console.info(`[AppCheck] Initialisiert (${projectKey}, reCAPTCHA v3, profilgebundener Site Key).`);

      // Token-Fehler (Domain-Mismatch auf Vercel) dürfen die Init-Promise nicht verwerfen.
      if (typeof appCheck.getToken === 'function') {
        appCheck.getToken(false).catch((tokenErr) => {
          appCheckActivationFailed = true;
          console.warn(
            '[AppCheck] reCAPTCHA-Token übersprungen.',
            tokenErr?.code || tokenErr?.message || tokenErr,
          );
        });
      }
    } catch (err) {
      appCheckActivationFailed = true;
      console.warn('[AppCheck] Aktivierung fehlgeschlagen. Vorschau/Offline nutzt gecachte Daten.', err?.code || err?.message || err);
    }
  })().catch((err) => {
    appCheckActivationFailed = true;
    console.warn('[AppCheck] Initialisierung abgefangen.', err?.code || err?.message || err);
  });

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
