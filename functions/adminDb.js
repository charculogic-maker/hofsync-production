if (global.__CRAFT_ADMINDB_MOCK__) {
  module.exports = global.__CRAFT_ADMINDB_MOCK__;
} else {
  const admin = require('./firebaseAdmin');

  function ensureApp() {
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
      return admin.firestore.FieldValue;
    },
    get Timestamp() {
      ensureApp();
      return admin.firestore.Timestamp;
    },
  };
}
