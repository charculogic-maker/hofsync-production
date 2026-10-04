/**
 * One Admin app for every service. initializeApp() returns the app;
 * Auth and Firestore receive that same instance. Never look it up
 * with getApp() after a different module initialized it.
 */
const { initializeApp, getApps } = require('firebase-admin/app');

const DEFAULT_APP_NAME = '[DEFAULT]';

function ensureAdminApp() {
  const existing = getApps().find((app) => app.name === DEFAULT_APP_NAME);
  if (existing) return existing;
  return initializeApp();
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
    return getApps();
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
    return getApps();
  },
});
