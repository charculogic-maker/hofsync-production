/**
 * One Admin app for every service. initializeApp() returns the app;
 * Auth and Firestore receive that same instance. Never look it up
 * with getApp() after a different module initialized it.
 */
const adminSdk = require('firebase-admin');

const DEFAULT_APP_NAME = '[DEFAULT]';

/**
 * Production installs firebase-admin 13.x (namespace: admin.apps, no getApps).
 * Local node_modules may be 14.x (modular getApps, no admin.apps).
 * Cloud Functions also creates a named app "__FIREBASE_FUNCTIONS_SDK__",
 * so "any app exists" is not the same as "[DEFAULT] exists".
 */
function listedApps() {
  if (typeof adminSdk.getApps === 'function') return adminSdk.getApps();
  if (Array.isArray(adminSdk.apps)) return adminSdk.apps;
  return [];
}

function ensureAdminApp() {
  const existing = listedApps().find((app) => app && app.name === DEFAULT_APP_NAME);
  if (existing) return existing;
  return adminSdk.initializeApp();
}

function loadFirestoreLib() {
  const lib = require('firebase-admin/firestore');
  firestore.FieldValue = lib.FieldValue;
  firestore.Timestamp = lib.Timestamp;
  return lib;
}

function getAdminDb() {
  const app = ensureAdminApp();
  const db = loadFirestoreLib().getFirestore(app);
  if (!db.app) db.app = app;
  return db;
}

function getAdminAuth() {
  const app = ensureAdminApp();
  const { getAuth } = require('firebase-admin/auth');
  return getAuth(app);
}

function firestore(...args) {
  if (args.length) return loadFirestoreLib().getFirestore(...args);
  return getAdminDb();
}

function auth(...args) {
  const { getAuth } = require('firebase-admin/auth');
  if (args.length) return getAuth(...args);
  return getAdminAuth();
}

function storage(...args) {
  const { getStorage } = require('firebase-admin/storage');
  if (args.length) return getStorage(...args);
  return getStorage(ensureAdminApp());
}

function messaging(...args) {
  const { getMessaging } = require('firebase-admin/messaging');
  if (args.length) return getMessaging(...args);
  return getMessaging(ensureAdminApp());
}

const admin = {
  initializeApp: () => ensureAdminApp(),
  ensureAdminApp,
  ensureFirestoreStatics: loadFirestoreLib,
  get apps() {
    return listedApps();
  },
  auth,
  firestore,
  storage,
  messaging,
};

module.exports = {
  ensureAdminApp,
  getAdminDb,
  getAdminAuth,
  ensureFirestoreStatics: loadFirestoreLib,
  initializeApp: () => ensureAdminApp(),
  auth,
  firestore,
  storage,
  messaging,
  admin,
};

Object.defineProperty(module.exports, 'apps', {
  enumerable: true,
  get() {
    return listedApps();
  },
});
