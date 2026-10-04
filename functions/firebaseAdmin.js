/**
 * Namespaced Admin SDK facade for firebase-admin v14+ (modular-only).
 * Service modules load only after initializeApp(), never at require() time.
 */
const {
  initializeApp,
  getApps,
  getApp,
  applicationDefault,
  cert,
  refreshToken,
  deleteApp,
} = require('firebase-admin/app');

function ensureAdminApp(options) {
  if (!getApps().length) {
    initializeApp(options);
  }
  return getApp();
}

function loadFirestoreLib() {
  const lib = require('firebase-admin/firestore');
  firestore.FieldValue = lib.FieldValue;
  firestore.Timestamp = lib.Timestamp;
  return lib;
}

function firestore(...args) {
  const app = ensureAdminApp();
  const { getFirestore } = loadFirestoreLib();
  return args.length ? getFirestore(...args) : getFirestore(app);
}

function auth(...args) {
  const app = ensureAdminApp();
  const { getAuth } = require('firebase-admin/auth');
  return args.length ? getAuth(...args) : getAuth(app);
}

function storage(...args) {
  const app = ensureAdminApp();
  const { getStorage } = require('firebase-admin/storage');
  return args.length ? getStorage(...args) : getStorage(app);
}

function messaging(...args) {
  const app = ensureAdminApp();
  const { getMessaging } = require('firebase-admin/messaging');
  return args.length ? getMessaging(...args) : getMessaging(app);
}

function getAdminAuth() {
  if (!getApps().length) initializeApp();
  return auth();
}

function getAdminDb() {
  if (!getApps().length) initializeApp();
  return firestore();
}

module.exports = {
  initializeApp: (options) => ensureAdminApp(options),
  ensureAdminApp,
  ensureFirestoreStatics: loadFirestoreLib,
  getAdminAuth,
  getAdminDb,
  getApps,
  getApp,
  deleteApp,
  applicationDefault,
  cert,
  refreshToken,
  get apps() {
    return getApps();
  },
  auth,
  firestore,
  storage,
  messaging,
};
