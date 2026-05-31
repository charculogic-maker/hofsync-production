/**
 * Firebase-Web-Konfiguration pro Hosting-Ziel / Projekt.
 * Auflösung über Hostname (Production vs. Whitelabel-Test).
 */

export const FIREBASE_PROJECTS = {
  production: {
    label: 'hofsync-production',
    apiKey: 'AIzaSyAdbEHEVn5gxB2OWPmX6AqNOdqiM9FPlPg',
    authDomain: 'hofsync-production.firebaseapp.com',
    projectId: 'hofsync-production',
    storageBucket: 'hofsync-production.firebasestorage.app',
    messagingSenderId: '610455484308',
    appId: '1:610455484308:web:ebb65b005da77124da8181',
    measurementId: 'G-BRTGB862D0',
  },
  whitelabel: {
    label: 'charculogic-whitelabel-test',
    apiKey: 'AIzaSyB7RTZon424tPEUYF1_3DNkrOd1nIP2fJ0',
    authDomain: 'charculogic-whitelabel-test.firebaseapp.com',
    projectId: 'charculogic-whitelabel-test',
    storageBucket: 'charculogic-whitelabel-test.firebasestorage.app',
    messagingSenderId: '227867568924',
    appId: '1:227867568924:web:627892d5e2ce4e746428d9',
    measurementId: 'G-RTWRWJVFQQ',
  },
};

const WHITELABEL_HOST_MARKERS = [
  'charculogic-whitelabel-test.web.app',
  'charculogic-whitelabel-test.firebaseapp.com',
];

function readDevProjectOverride() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('firebase') || params.get('project');
    if (fromQuery === 'whitelabel' || fromQuery === 'production') return fromQuery;
    const fromStorage = localStorage.getItem('charculogic_firebase_project');
    if (fromStorage === 'whitelabel' || fromStorage === 'production') return fromStorage;
  } catch (_) { /* noop */ }
  return null;
}

export function resolveFirebaseProjectKey() {
  const override = readDevProjectOverride();
  if (override) return override;

  const host = String(window.location?.hostname || '').toLowerCase();
  if (WHITELABEL_HOST_MARKERS.some((marker) => host === marker || host.endsWith(`.${marker}`))) {
    return 'whitelabel';
  }
  return 'production';
}

export function resolveFirebaseConfig() {
  const key = resolveFirebaseProjectKey();
  const config = FIREBASE_PROJECTS[key] || FIREBASE_PROJECTS.production;
  return { ...config };
}
