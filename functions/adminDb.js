if (global.__CRAFT_ADMINDB_MOCK__) {
  module.exports = global.__CRAFT_ADMINDB_MOCK__;
} else {
  const admin = require('firebase-admin');

  function firestore() {
    return admin.firestore();
  }

  module.exports = {
    firestore,
    get FieldValue() {
      return admin.firestore.FieldValue;
    },
    get Timestamp() {
      return admin.firestore.Timestamp;
    },
  };
}
