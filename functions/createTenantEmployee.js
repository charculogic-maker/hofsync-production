const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const adminDb = require('./adminDb');
const { resolveAuthContext } = require('./authContext');
const { normalizeAllowedModules, assertAdminAccessForTenant } = require('./manageTenantEmployees');

const REGION = 'europe-west3';

const CALLABLE_BASE_OPTIONS = {
  region: REGION,
  enforceAppCheck: true,
};

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeDisplayName(value) {
  return String(value || '').trim();
}

exports.createTenantEmployee = onCall(
  CALLABLE_BASE_OPTIONS,
  async (request) => {
    const baseCtx = resolveAuthContext(request.auth);
    const requestedTenantId = String(request.data?.tenantId || '').trim();
    const ctx = assertAdminAccessForTenant(request.auth, requestedTenantId || baseCtx.tenantId);
    const targetTenantId = (requestedTenantId || ctx.tenantId || baseCtx.tenantId || '').trim();

    if (!targetTenantId) {
      throw new HttpsError('invalid-argument', 'Mandant (tenantId) konnte nicht ermittelt werden.');
    }

    const email = normalizeEmail(request.data?.email);
    const password = String(request.data?.password || '');
    const displayName = normalizeDisplayName(request.data?.name || request.data?.displayName);

    if (!email) {
      throw new HttpsError('invalid-argument', 'E-Mail ist erforderlich.');
    }
    if (!displayName) {
      throw new HttpsError('invalid-argument', 'Name des Mitarbeiters ist erforderlich.');
    }
    if (!password || password.length < 6) {
      throw new HttpsError('invalid-argument', 'Passwort muss mindestens 6 Zeichen haben.');
    }

    let userRecord;
    try {
      userRecord = await admin.auth().createUser({
        email,
        password,
        displayName,
      });
    } catch (err) {
      if (err?.code === 'auth/email-already-exists') {
        throw new HttpsError('already-exists', 'Diese E-Mail ist bereits registriert.');
      }
      if (err?.code === 'auth/invalid-email') {
        throw new HttpsError('invalid-argument', 'Die E-Mail-Adresse ist ungültig.');
      }
      if (err?.code === 'auth/invalid-password') {
        throw new HttpsError('invalid-argument', 'Das Passwort ist ungültig (mind. 6 Zeichen).');
      }
      console.error('[createTenantEmployee] Auth-Nutzer konnte nicht erstellt werden:', err);
      throw new HttpsError(
        'internal',
        'Mitarbeiter-Konto konnte nicht erstellt werden.',
        { code: String(err?.code || ''), reason: String(err?.message || err || 'unbekannt') },
      );
    }

    const allowedModules = normalizeAllowedModules(request.data?.allowedModules);
    const claims = {
      tenantId: targetTenantId,
      role: 'employee',
      isAdmin: false,
      allowedModules,
    };

    try {
      await admin.auth().setCustomUserClaims(userRecord.uid, claims);
      await adminDb.firestore().doc(`users/${userRecord.uid}`).set({
        email,
        displayName,
        tenantId: targetTenantId,
        role: 'employee',
        allowedModules,
        createdAt: adminDb.FieldValue.serverTimestamp(),
        createdBy: ctx.uid,
      });
    } catch (err) {
      console.error('[createTenantEmployee] Claims/Profil fehlgeschlagen — Auth-Nutzer wird entfernt:', err);
      await admin.auth().deleteUser(userRecord.uid).catch(() => null);
      throw new HttpsError(
        'internal',
        'Mitarbeiter-Profil konnte nicht angelegt werden.',
        { code: String(err?.code || ''), reason: String(err?.message || err || 'unbekannt') },
      );
    }

    return {
      ok: true,
      uid: userRecord.uid,
      email,
      displayName,
      tenantId: targetTenantId,
    };
  },
);
