const { getAdminDb, getAdminAuth } = require('./firebaseAdmin');

async function runDiagnostic() {
  try {
    const db = getAdminDb();
    const auth = getAdminAuth();
    console.log('Admin SDK initialized successfully. Default app:', db.app.name);
    const email = 'rehm.patrik@gmail.com';
    const user = await auth.getUserByEmail(email).catch(() => null);
    console.log('User lookup result for', email, ':', user ? user.uid : 'NOT_FOUND');
    if (user) {
      console.log('User custom claims:', user.customClaims);
    }
  } catch (e) {
    console.error('DIAGNOSTIC ERROR:', e);
  }
}

runDiagnostic();
