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
    /** reCAPTCHA v3 Site Key – Firebase Console → App Check → Web-App registrieren */
    appCheckRecaptchaSiteKey: '6LdOjgYtAAAAAI16VAfLgMFbx168IwIL75wQNMTR',
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
    appCheckRecaptchaSiteKey: '6LdOjgYtAAAAAI16VAfLgMFbx168IwIL75wQNMTR',
  },
};

import { readDevFirebaseProjectOverride } from './dev-guards.js';

const WHITELABEL_HOST_MARKERS = [
  'charculogic-whitelabel-test.web.app',
  'charculogic-whitelabel-test.firebaseapp.com',
];

export function resolveFirebaseProjectKey() {
  const override = readDevFirebaseProjectOverride();
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
