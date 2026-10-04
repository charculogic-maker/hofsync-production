/**
 * Namespaced Admin SDK facade for firebase-admin v14+ (modular-only).
 * Keeps existing call sites on admin.auth() / admin.firestore() / admin.messaging().
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
const {
  getFirestore,
  FieldValue,
  Timestamp,
} = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { getMessaging } = require('firebase-admin/messaging');
const { getStorage } = require('firebase-admin/storage');

function ensureAdminApp(options) {
  if (!getApps().length) {
    initializeApp(options);
  }
  return getApp();
}

function firestore(...args) {
  const app = ensureAdminApp();
  return args.length ? getFirestore(...args) : getFirestore(app);
}

firestore.FieldValue = FieldValue;
firestore.Timestamp = Timestamp;

module.exports = {
  initializeApp: (options) => ensureAdminApp(options),
  ensureAdminApp,
  getApps,
  getApp,
  deleteApp,
  applicationDefault,
  cert,
  refreshToken,
  get apps() {
    return getApps();
  },
  auth(...args) {
    const app = ensureAdminApp();
    return args.length ? getAuth(...args) : getAuth(app);
  },
  firestore,
  storage(...args) {
    const app = ensureAdminApp();
    return args.length ? getStorage(...args) : getStorage(app);
  },
  messaging(...args) {
    const app = ensureAdminApp();
    return args.length ? getMessaging(...args) : getMessaging(app);
  },
};
