const { onCall, HttpsError } = require('firebase-functions/v2/https');
const adminDb = require('./adminDb');
const { verifyPinRecord, verifyPinWithTimingPadding } = require('./pinHash');
const { cleanTenantId, resolveAuthContext } = require('./authContext');

const REGION = 'europe-west3';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const PIN_MODES = new Set(['employee', 'resolve', 'meister']);

function credentialsRef(tenantId) {
  return adminDb.firestore().doc(`tenants/${tenantId}/terminalCredentials/current`);
}

function attemptsRef(tenantId, uid) {
  return adminDb.firestore().doc(`tenants/${tenantId}/pinAttempts/${uid}`);
}

async function assertNotLockedOut(tenantId, uid) {
  const snap = await attemptsRef(tenantId, uid).get();
  if (!snap.exists) return;
  const data = snap.data() || {};
  const lockedUntil = data.lockedUntil?.toMillis?.() || 0;
  if (lockedUntil > Date.now()) {
    throw new HttpsError('resource-exhausted', 'Zu viele Fehlversuche. Bitte später erneut versuchen.');
  }
}

async function recordFailedAttempt(tenantId, uid) {
  const ref = attemptsRef(tenantId, uid);
  await adminDb.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const prev = snap.exists ? snap.data() : {};
    const count = Number(prev.count || 0) + 1;
    const payload = {
      count,
      lastFailedAt: adminDb.FieldValue.serverTimestamp(),
      tenantId,
    };
    if (count >= MAX_ATTEMPTS) {
      payload.lockedUntil = adminDb.Timestamp.fromMillis(Date.now() + LOCKOUT_MS);
    }
    tx.set(ref, payload, { merge: true });
  });
}

async function clearAttempts(tenantId, uid) {
  await attemptsRef(tenantId, uid).delete().catch(() => null);
}

async function loadCredentials(tenantId) {
  const snap = await credentialsRef(tenantId).get();
  if (!snap.exists) {
    throw new HttpsError('failed-precondition', 'Terminal-Zugangsdaten sind noch nicht eingerichtet.');
  }
  return snap.data() || {};
}

function normalizePin(value) {
  const pin = String(value || '').trim();
  if (!/^\d{4}$/.test(pin)) {
    throw new HttpsError('invalid-argument', 'PIN muss 4-stellig numerisch sein.');
  }
  return pin;
}

function findEmployeeByPin(credentials, pin) {
  const employees = credentials.employees && typeof credentials.employees === 'object'
    ? credentials.employees
    : {};
  for (const [employeeName, record] of Object.entries(employees)) {
    if (verifyPinRecord(pin, record)) return employeeName;
  }
  return null;
}

function findMeisterByPin(credentials, pin) {
  const meister = credentials.meister && typeof credentials.meister === 'object'
    ? credentials.meister
    : {};
  for (const [meisterName, record] of Object.entries(meister)) {
    if (verifyPinRecord(pin, record)) return meisterName;
  }
  return null;
}

async function handleVerifyTerminalPin(request) {
  const ctx = await resolveAuthContext(request.auth);
  if (!ctx.tenantId) {
    throw new HttpsError('permission-denied', 'Kein Mandant für dieses Konto hinterlegt.');
  }

  const mode = String(request.data?.mode || 'employee').trim();
  if (!PIN_MODES.has(mode)) {
    throw new HttpsError('invalid-argument', 'Unbekannter PIN-Modus.');
  }

  const pin = normalizePin(request.data?.pin);
  const tenantId = cleanTenantId(ctx.tenantId);
  await assertNotLockedOut(tenantId, ctx.uid);
  const credentials = await loadCredentials(tenantId);

  if (mode === 'employee') {
    const employeeName = String(request.data?.employeeName || '').trim();
    if (!employeeName) {
      throw new HttpsError('invalid-argument', 'Mitarbeitername fehlt.');
    }
    const record = credentials.employees?.[employeeName];
    const ok = verifyPinWithTimingPadding(pin, record);
    if (!ok) {
      await recordFailedAttempt(tenantId, ctx.uid);
      return { ok: false };
    }
    await clearAttempts(tenantId, ctx.uid);
    return { ok: true, employeeName };
  }

  if (mode === 'resolve') {
    const employeeName = findEmployeeByPin(credentials, pin);
    if (!employeeName) {
      await recordFailedAttempt(tenantId, ctx.uid);
      return { ok: false, employeeName: null };
    }
    await clearAttempts(tenantId, ctx.uid);
    return { ok: true, employeeName };
  }

  const meisterName = findMeisterByPin(credentials, pin);
  if (!meisterName) {
    await recordFailedAttempt(tenantId, ctx.uid);
    return { ok: false, meisterName: null };
  }
  await clearAttempts(tenantId, ctx.uid);
  return { ok: true, meisterName };
}

exports.verifyTerminalPin = onCall(
  {
    region: REGION,
    enforceAppCheck: true,
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (request) => handleVerifyTerminalPin(request),
);

module.exports.handleVerifyTerminalPin = handleVerifyTerminalPin;
