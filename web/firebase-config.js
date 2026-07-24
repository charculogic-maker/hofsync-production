/**
 * Firebase-Web-Konfiguration pro Hosting-Ziel / Projekt.
 * Auflösung über Hostname (TorFabrik vs. Whitelabel-Test) — strikte Projekt-Isolation.
 */

/** Whitelabel-Host: enthält diesen Marker → eigenes Firebase-Projekt. */
export const WHITELABEL_HOST_MARKER = 'charculogic-whitelabel-test.web.app';

const WHITELABEL_AUTH_HOST_MARKER = 'charculogic-whitelabel-test.firebaseapp.com';

export const FIREBASE_PROJECTS = {
  production: {
    /** Anzeigename für [System]-Log und Operator-Kontext */
    displayName: 'TorFabrik',
    label: 'hofsync-production',
    apiKey: 'AIzaSyAdbEHEVn5gxB2OWPmX6AqNOdqiM9FPlPg',
    authDomain: 'hofsync-production.firebaseapp.com',
    projectId: 'hofsync-production',
    storageBucket: 'hofsync-production.firebasestorage.app',
    messagingSenderId: '610455484308',
    appId: '1:610455484308:web:ebb65b005da77124da8181',
    measurementId: 'G-BRTGB862D0',
    /** reCAPTCHA v3 — Firebase Console → App Check (hofsync-production), Domains: TorFabrik-Hosting */
    appCheckRecaptchaSiteKey: '6LdOjgYtAAAAAI16VAfLgMFbx168IwIL75wQNMTR',
  },
  whitelabel: {
    displayName: 'CharcuLogic Whitelabel',
    label: 'charculogic-whitelabel-test',
    apiKey: 'AIzaSyB7RTZon424tPEUYF1_3DNkrOd1nIP2fJ0',
    authDomain: 'charculogic-whitelabel-test.firebaseapp.com',
    projectId: 'charculogic-whitelabel-test',
    storageBucket: 'charculogic-whitelabel-test.firebasestorage.app',
    messagingSenderId: '227867568924',
    appId: '1:227867568924:web:627892d5e2ce4e746428d9',
    measurementId: 'G-RTWRWJVFQQ',
    /** reCAPTCHA v3 — Firebase Console → App Check (charculogic-whitelabel-test), Domains: Whitelabel-Hosting */
    appCheckRecaptchaSiteKey: '6LdOjgYtAAAAAI16VAfLgMFbx168IwIL75wQNMTR',
  },
};

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

function readFirebaseQueryOverride() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('firebase') || params.get('project');
    if (fromQuery === 'whitelabel' || fromQuery === 'production') return fromQuery;
  } catch (_) { /* noop */ }
  return null;
}

function warnIgnoredFirebaseProjectQueryOverride() {
  const attempt = readFirebaseQueryOverride();
  if (!attempt) return;
  console.warn(
    `[System] URL-Override ?firebase=${attempt} ignoriert — `
    + 'nur auf localhost oder 127.0.0.1 erlaubt. Profil bleibt domain-gebunden.',
  );
}

/**
 * Dev-Override (Query + localStorage) — ausschließlich auf localhost / 127.0.0.1.
 * Auf Produktions-Hosting (z. B. torfabrik-app.web.app) wird ?firebase=whitelabel hart ignoriert.
 * @returns {'production' | 'whitelabel' | null}
 */
export function readFirebaseProjectOverride() {
  if (!isLocalDevHost()) {
    warnIgnoredFirebaseProjectQueryOverride();
    return null;
  }
  try {
    const fromQuery = readFirebaseQueryOverride();
    if (fromQuery) return fromQuery;
    const fromStorage = localStorage.getItem('charculogic_firebase_project');
    if (fromStorage === 'whitelabel' || fromStorage === 'production') return fromStorage;
  } catch (_) { /* noop */ }
  return null;
}

/**
 * @param {string} [hostname]
 * @returns {boolean}
 */
export function isWhitelabelFirebaseHost(hostname = window.location?.hostname) {
  const host = String(hostname || '').toLowerCase();
  return host.includes(WHITELABEL_HOST_MARKER)
    || host.includes(WHITELABEL_AUTH_HOST_MARKER);
}

/**
 * @returns {'production' | 'whitelabel'}
 */
export function resolveFirebaseProjectKey() {
  const override = readFirebaseProjectOverride();
  if (override === 'whitelabel' || override === 'production') return override;

  if (isWhitelabelFirebaseHost()) return 'whitelabel';
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
 * @param {'production' | 'whitelabel'} [projectKey]
 * @returns {string} Leerer String bei fehlendem oder Platzhalter-Key.
 */
export function getAppCheckSiteKey(projectKey = resolveFirebaseProjectKey()) {
  const siteKey = FIREBASE_PROJECTS[projectKey]?.appCheckRecaptchaSiteKey || '';
  const trimmed = String(siteKey).trim();
  if (!trimmed || trimmed.startsWith('REPLACE_')) return '';
  return trimmed;
}
