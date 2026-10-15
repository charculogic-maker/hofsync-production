if (global.__CRAFT_ADMINDB_MOCK__) {
  module.exports = global.__CRAFT_ADMINDB_MOCK__;
} else {
  const admin = require('./firebaseAdmin');

  function ensureApp() {
    if (typeof admin.ensureAdminApp === 'function') {
      admin.ensureAdminApp();
      return;
    }
    if (!admin.apps.length) {
      admin.initializeApp();
    }
  }

  function firestore() {
    ensureApp();
    return admin.firestore();
  }

  module.exports = {
    firestore,
    ensureApp,
    get FieldValue() {
      ensureApp();
      if (typeof admin.ensureFirestoreStatics === 'function') admin.ensureFirestoreStatics();
      return admin.firestore.FieldValue;
    },
    get Timestamp() {
      ensureApp();
      if (typeof admin.ensureFirestoreStatics === 'function') admin.ensureFirestoreStatics();
      return admin.firestore.Timestamp;
    },
  };
}
