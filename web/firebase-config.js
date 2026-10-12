/**
 * Firebase-Web-Konfiguration. Einziges Hosting-Ziel ist hofsync-production.
 * Lokaler Dev-Modus (localhost) nutzt dieselbe Konfiguration; Emulatoren bleiben opt-in.
 */

export const FIREBASE_PROJECTS = {
  production: {
    /** Anzeigename für [System]-Log und Operator-Kontext */
    displayName: 'HofSync',
    label: 'hofsync-production',
    apiKey: 'AIzaSyAdbEHEVn5gxB2OWPmX6AqNOdqiM9FPlPg',
    authDomain: 'hofsync-production.firebaseapp.com',
    projectId: 'hofsync-production',
    storageBucket: 'hofsync-production.firebasestorage.app',
    messagingSenderId: '610455484308',
    appId: '1:610455484308:web:ebb65b005da77124da8181',
    measurementId: 'G-BRTGB862D0',
    /** reCAPTCHA v3 — Firebase Console → App Check (hofsync-production) */
    appCheckRecaptchaSiteKey: '6LdOjgYtAAAAAI16VAfLgMFbx168IwIL75wQNMTR',
  },
};

/**
 * Firebase Auth authorizedDomains enthält bereits hofsync.vercel.app.
 * Der Browser-API-Key braucht zusätzlich HTTP-Referrer:
 * https://hofsync.vercel.app/* und https://*.vercel.app/*
 * Sonst: 403 API_KEY_HTTP_REFERRER_BLOCKED (Login von Vercel schlägt fehl).
 */

/** Cold-Start: Auth und Firestore-Persistenz dürfen so lange brauchen, bevor ein Config-Toast erscheint. */
export const FIREBASE_BOOT_GRACE_MS = 3000;

const SDK_CONFIG_KEYS = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
  'measurementId',
];

export function isLocalDevHost(hostname = window.location?.hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1';
}

/**
 * Projektwechsel per URL ist entfernt. Lokal und live gilt hofsync-production.
 * @returns {null}
 */
export function readFirebaseProjectOverride() {
  return null;
}

/**
 * @returns {'production'}
 */
export function resolveFirebaseProjectKey() {
  return 'production';
}

export function resolveFirebaseProjectDisplayName() {
  const key = resolveFirebaseProjectKey();
  const entry = FIREBASE_PROJECTS[key] || FIREBASE_PROJECTS.production;
  return entry.displayName || entry.label || entry.projectId;
}

export function resolveFirebaseConfig() {
  const key = resolveFirebaseProjectKey();
  const config = FIREBASE_PROJECTS[key] || FIREBASE_PROJECTS.production;
  return { ...config, projectKey: key };
}

/** Nur Felder, die firebase.initializeApp() erwartet — keine Meta-Keys (displayName, appCheckRecaptchaSiteKey, …). */
export function toFirebaseSdkConfig(config = resolveFirebaseConfig()) {
  const sdkConfig = {};
  SDK_CONFIG_KEYS.forEach((key) => {
    if (config[key]) sdkConfig[key] = config[key];
  });
  return sdkConfig;
}

/**
 * reCAPTCHA v3 Site Key des aktiven Profils (domain-gebunden, nicht Teil der SDK-Config).
 * @param {'production'} [projectKey]
 * @returns {string} Leerer String bei fehlendem oder Platzhalter-Key.
 */
export function getAppCheckSiteKey(projectKey = resolveFirebaseProjectKey()) {
  const siteKey = FIREBASE_PROJECTS[projectKey]?.appCheckRecaptchaSiteKey || '';
  const trimmed = String(siteKey).trim();
  if (!trimmed || trimmed.startsWith('REPLACE_')) return '';
  return trimmed;
}
