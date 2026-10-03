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

function ensureApp(options) {
  const apps = getApps();
  if (apps.length) return getApp();
  return initializeApp(options);
}

function firestore(...args) {
  ensureApp();
  return getFirestore(...args);
}

firestore.FieldValue = FieldValue;
firestore.Timestamp = Timestamp;

module.exports = {
  initializeApp: (options) => ensureApp(options),
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
    ensureApp();
    return getAuth(...args);
  },
  firestore,
  messaging(...args) {
    ensureApp();
    return getMessaging(...args);
  },
};
