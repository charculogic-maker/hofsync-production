const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const crypto = require('crypto');
const adminDb = require('./adminDb');
const { resolveAuthContext } = require('./authContext');

const REGION = 'europe-west3';

const CALLABLE_BASE_OPTIONS = {
  region: REGION,
  enforceAppCheck: true,
};

const SUPER_ADMIN_EMAIL = 'patrik@charculogic.de';
const SUPER_ADMIN_UIDS = new Set(['VYwMy5IAlAR26pj8ZbFfc5PNdou2']);

const EMPLOYEE_MODULE_KEYS = ['mhd', 'kitchen', 'buero'];

const TENANT_PROFILE_DEFAULTS = Object.freeze({
  StevesHof_Hauptbetrieb: Object.freeze([
    'Bettina', 'Efecan', 'Finn', 'Heiko', 'Melanie', 'Mimi', 'Nicole', 'Paddy', 'Stephie',
  ]),
});

function profileUidFromName(name, tenantId) {
  const slug = String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `profile:${String(tenantId || '').trim()}:${slug || 'unbekannt'}`;
}

function isProfileUid(uid) {
  return String(uid || '').startsWith('profile:');
}

function defaultProfileNamesForTenant(tenantId) {
  return TENANT_PROFILE_DEFAULTS[String(tenantId || '').trim()] || [];
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isSuperAdmin(auth) {
  const email = normalizeEmail(auth?.token?.email || auth?.email);
  if (email === SUPER_ADMIN_EMAIL) return true;
  return SUPER_ADMIN_UIDS.has(String(auth?.uid || '').trim());
}

function assertAdminAccess(auth, targetTenantId) {
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'Anmeldung erforderlich.');
  }
  const expected = String(targetTenantId || '').trim();
  if (!expected) {
    throw new HttpsError('invalid-argument', 'Mandant (tenantId) fehlt.');
  }

  // Plattform-Super-Admin zuerst: Claim tenantId ist optional, Ziel-Mandant kommt aus dem Payload.
  if (isSuperAdmin(auth)) {
    return {
      uid: auth.uid,
      tenantId: expected,
      role: 'admin',
      isAdmin: true,
      isHelper: false,
      isSuperAdmin: true,
    };
  }

  const ctx = resolveAuthContext(auth);
  if (!ctx.isAdmin) {
    throw new HttpsError('permission-denied', 'Nur Admins dürfen Mitarbeiter verwalten.');
  }
  if (ctx.tenantId !== expected) {
    throw new HttpsError('permission-denied', 'Kein Zugriff auf diesen Mandanten.');
  }
  return { ...ctx, isSuperAdmin: false };
}

function generateStartPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(10);
  let token = '';
  for (const byte of bytes) {
    token += alphabet[byte % alphabet.length];
  }
  return `Hof-${token.slice(0, 8)}`;
}

function normalizeAllowedModules(value) {
  const result = {};
  EMPLOYEE_MODULE_KEYS.forEach((key) => {
    if (value && typeof value === 'object' && key in value) {
      result[key] = value[key] !== false;
    } else {
      result[key] = true;
    }
  });
  return result;
}

function serializeTimestamp(value) {
  if (!value) return null;
  try {
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
  } catch (_) {
    return null;
  }
  return null;
}

function serializeUserDoc(doc, fallbackTenantId = '') {
  const data = typeof doc?.data === 'function' ? (doc.data() || {}) : (doc || {});
  const id = doc?.id || data.uid || '';
  const status = String(data.status || (data.disabled === true ? 'inactive' : 'active')).trim();
  return {
    uid: String(id || '').trim(),
    email: String(data.email || '').trim(),
    displayName: String(data.displayName || data.name || '').trim(),
    role: String(data.role || 'employee').trim(),
    tenantId: String(data.tenantId || fallbackTenantId).trim(),
    allowedModules: normalizeAllowedModules(data.allowedModules),
    status: status === 'inactive' ? 'inactive' : 'active',
    disabled: data.disabled === true || status === 'inactive',
    source: String(data.source || 'auth').trim() || 'auth',
    createdAt: serializeTimestamp(data.createdAt),
  };
}

function employeeDedupeKey(employee) {
  const uid = String(employee?.uid || '').trim();
  if (uid && !isProfileUid(uid)) return `uid:${uid}`;
  const email = String(employee?.email || '').trim().toLowerCase();
  if (email) return `email:${email}`;
  const name = String(employee?.displayName || '').trim().toLowerCase();
  if (name) return `name:${name}`;
  return `uid:${uid || 'unknown'}`;
}

function mergeEmployeeRecord(existing, incoming) {
  if (!existing) return incoming;
  if (!incoming) return existing;
  const preferIncoming = isProfileUid(existing.uid) && incoming.uid && !isProfileUid(incoming.uid);
  const primary = preferIncoming ? incoming : existing;
  const secondary = preferIncoming ? existing : incoming;
  return {
    ...secondary,
    ...primary,
    email: primary.email || secondary.email || '',
    displayName: primary.displayName || secondary.displayName || '',
    role: primary.role && primary.role !== 'employee' ? primary.role : (secondary.role || primary.role || 'employee'),
    allowedModules: normalizeAllowedModules(primary.allowedModules || secondary.allowedModules),
    source: isProfileUid(primary.uid) ? (secondary.source || primary.source) : (primary.source || secondary.source),
  };
}

/**
 * Führt Auth-/users-Dokumente, tenants/{id}/employees und Team-Profilnamen zusammen.
 * Auth-User ohne Custom Claims bleiben über die nested employees-Collection
 * bzw. den Profil-Store sichtbar.
 */
function mergeEmployeeSources({
  users = [],
  nestedEmployees = [],
  authUsers = [],
  profileNames = [],
  tenantId = '',
} = {}) {
  const byKey = new Map();
  const upsert = (raw) => {
    if (!raw) return;
    const employee = {
      uid: String(raw.uid || '').trim(),
      email: String(raw.email || '').trim(),
      displayName: String(raw.displayName || raw.name || '').trim(),
      role: String(raw.role || 'employee').trim() || 'employee',
      tenantId: String(raw.tenantId || tenantId).trim(),
      allowedModules: normalizeAllowedModules(raw.allowedModules),
      status: raw.disabled === true || raw.status === 'inactive' ? 'inactive' : 'active',
      disabled: raw.disabled === true || raw.status === 'inactive',
      source: String(raw.source || 'auth').trim() || 'auth',
      createdAt: raw.createdAt ?? null,
    };
    if (!employee.uid && !employee.email && !employee.displayName) return;
    if (!employee.uid) {
      employee.uid = profileUidFromName(employee.displayName || employee.email, tenantId);
      employee.source = employee.source === 'auth' ? 'profile' : employee.source;
    }
    const key = employeeDedupeKey(employee);
    byKey.set(key, mergeEmployeeRecord(byKey.get(key), employee));
  };

  users.forEach(upsert);
  nestedEmployees.forEach(upsert);
  authUsers.forEach(upsert);

  const knownNames = new Set(
    [...byKey.values()].map((entry) => String(entry.displayName || '').trim().toLowerCase()).filter(Boolean),
  );
  profileNames.forEach((name) => {
    const displayName = String(name || '').trim();
    if (!displayName) return;
    if (knownNames.has(displayName.toLowerCase())) return;
    knownNames.add(displayName.toLowerCase());
    upsert({
      uid: profileUidFromName(displayName, tenantId),
      displayName,
      role: 'employee',
      tenantId,
      source: 'profile',
    });
  });

  return [...byKey.values()]
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'de') || a.email.localeCompare(b.email, 'de'));
}

async function listUsersCollection(tenantId) {
  try {
    const snap = await adminDb.firestore()
      .collection('users')
      .where('tenantId', '==', tenantId)
      .get();
    return snap.docs.map((doc) => serializeUserDoc(doc, tenantId));
  } catch (err) {
    console.warn('[manageTenantEmployees] users-Query fehlgeschlagen:', err?.message || err);
    return [];
  }
}

async function listNestedEmployees(tenantId) {
  try {
    const nestedSnap = await adminDb.firestore()
      .collection('tenants')
      .doc(tenantId)
      .collection('employees')
      .get();
    return nestedSnap.docs.map((doc) => serializeUserDoc(doc, tenantId));
  } catch (err) {
    console.warn('[manageTenantEmployees] tenants/.../employees nicht lesbar:', err?.message || err);
    return [];
  }
}

async function listTeamDashboardProfileNames(tenantId) {
  try {
    const snap = await adminDb.firestore().doc(`tenants/${tenantId}/settings/teamDashboard`).get();
    const names = Array.isArray(snap.data()?.employees) ? snap.data().employees : [];
    return names.map((name) => String(name || '').trim()).filter(Boolean);
  } catch (err) {
    console.warn('[manageTenantEmployees] Team-Profil-Store nicht lesbar:', err?.message || err);
    return [];
  }
}

async function listAuthUsersForTenant(tenantId) {
  if (typeof admin.auth !== 'function') return [];
  try {
    const matches = [];
    let pageToken;
    do {
      const page = await admin.auth().listUsers(1000, pageToken);
      (page.users || []).forEach((user) => {
        const claims = user.customClaims || {};
        if (String(claims.tenantId || '').trim() !== tenantId) return;
        matches.push({
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || '',
          role: claims.role || (claims.isAdmin ? 'admin' : 'employee'),
          tenantId,
          allowedModules: normalizeAllowedModules(claims.allowedModules),
          disabled: user.disabled === true,
          status: user.disabled ? 'inactive' : 'active',
          source: 'auth',
          createdAt: user.metadata?.creationTime ? Date.parse(user.metadata.creationTime) : null,
        });
      });
      pageToken = page.pageToken;
    } while (pageToken);
    return matches;
  } catch (err) {
    console.warn('[manageTenantEmployees] Auth-User-Liste nicht lesbar:', err?.message || err);
    return [];
  }
}

async function listTenantEmployees(tenantId) {
  const [users, nestedEmployees, authUsers, storedProfiles] = await Promise.all([
    listUsersCollection(tenantId),
    listNestedEmployees(tenantId),
    listAuthUsersForTenant(tenantId),
    listTeamDashboardProfileNames(tenantId),
  ]);
  const profileNames = storedProfiles.length ? storedProfiles : defaultProfileNamesForTenant(tenantId);
  return mergeEmployeeSources({
    users,
    nestedEmployees,
    authUsers,
    profileNames,
    tenantId,
  });
}

async function updateTenantEmployee(auth, payload) {
  const targetUid = String(payload?.uid || '').trim();
  const tenantId = String(payload?.tenantId || resolveAuthContext(auth).tenantId || '').trim();
  if (!targetUid) {
    throw new HttpsError('invalid-argument', 'Mitarbeiter-UID fehlt.');
  }
  const ctx = assertAdminAccess(auth, tenantId);

  const userRef = adminDb.firestore().doc(`users/${targetUid}`);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new HttpsError('not-found', 'Mitarbeiter nicht gefunden.');
  }
  const userData = userSnap.data() || {};
  if (String(userData.tenantId || '').trim() !== tenantId) {
    throw new HttpsError('permission-denied', 'Mitarbeiter gehört nicht zu diesem Mandanten.');
  }

  const patch = { updatedAt: adminDb.FieldValue.serverTimestamp(), updatedBy: ctx.uid };
  const claimsPatch = {
    tenantId,
  };

  if (payload.role !== undefined) {
    const nextRole = String(payload.role || '').trim();
    if (nextRole !== 'admin' && nextRole !== 'employee' && nextRole !== 'helper') {
      throw new HttpsError('invalid-argument', 'Rolle muss admin, employee oder helper sein.');
    }
    if (targetUid === ctx.uid && nextRole !== 'admin') {
      throw new HttpsError('failed-precondition', 'Du kannst deine eigene Admin-Rolle nicht entfernen.');
    }
    patch.role = nextRole;
    claimsPatch.role = nextRole;
    claimsPatch.isAdmin = nextRole === 'admin';
  }

  if (payload.allowedModules !== undefined) {
    const allowedModules = normalizeAllowedModules(payload.allowedModules);
    patch.allowedModules = allowedModules;
    claimsPatch.allowedModules = allowedModules;
  }

  const authUser = await admin.auth().getUser(targetUid);
  const existingClaims = authUser.customClaims || {};
  const nextClaims = {
    ...existingClaims,
    ...claimsPatch,
    tenantId,
  };

  await admin.auth().setCustomUserClaims(targetUid, nextClaims);
  await userRef.set(patch, { merge: true });

  return { ok: true, uid: targetUid };
}

async function removeTenantEmployee(auth, payload) {
  const targetUid = String(payload?.uid || '').trim();
  const tenantId = String(payload?.tenantId || resolveAuthContext(auth).tenantId || '').trim();
  if (!targetUid) {
    throw new HttpsError('invalid-argument', 'Mitarbeiter-UID fehlt.');
  }
  const ctx = assertAdminAccess(auth, tenantId);
  if (targetUid === ctx.uid) {
    throw new HttpsError('failed-precondition', 'Du kannst dich nicht selbst entfernen.');
  }

  const userRef = adminDb.firestore().doc(`users/${targetUid}`);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new HttpsError('not-found', 'Mitarbeiter nicht gefunden.');
  }
  const userData = userSnap.data() || {};
  if (String(userData.tenantId || '').trim() !== tenantId) {
    throw new HttpsError('permission-denied', 'Mitarbeiter gehört nicht zu diesem Mandanten.');
  }

  await admin.auth().deleteUser(targetUid);
  await userRef.delete();

  return { ok: true, uid: targetUid };
}

function resolveTargetTenantId(auth, payloadTenantId) {
  const fromPayload = String(payloadTenantId || '').trim();
  if (fromPayload) return fromPayload;
  if (isSuperAdmin(auth)) {
    throw new HttpsError('invalid-argument', 'Mandant (tenantId) fehlt.');
  }
  return resolveAuthContext(auth).tenantId;
}

async function loadTenantEmployeeOrThrow(auth, payload) {
  const targetUid = String(payload?.uid || '').trim();
  const tenantId = resolveTargetTenantId(auth, payload?.tenantId);
  if (!targetUid) {
    throw new HttpsError('invalid-argument', 'Mitarbeiter-UID fehlt.');
  }
  const ctx = assertAdminAccess(auth, tenantId);
  const userRef = adminDb.firestore().doc(`users/${targetUid}`);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new HttpsError('not-found', 'Mitarbeiter nicht gefunden.');
  }
  const userData = userSnap.data() || {};
  if (String(userData.tenantId || '').trim() !== tenantId) {
    throw new HttpsError('permission-denied', 'Mitarbeiter gehört nicht zu diesem Mandanten.');
  }
  return { ctx, tenantId, targetUid, userRef, userData };
}

async function resetTenantEmployeePassword(auth, payload) {
  const { ctx, tenantId, targetUid } = await loadTenantEmployeeOrThrow(auth, payload);
  const requested = String(payload?.password || '').trim();
  const temporaryPassword = requested.length >= 6 ? requested : generateStartPassword();
  await admin.auth().updateUser(targetUid, { password: temporaryPassword });
  await adminDb.firestore().doc(`users/${targetUid}`).set({
    updatedAt: adminDb.FieldValue.serverTimestamp(),
    updatedBy: ctx.uid,
    passwordResetAt: adminDb.FieldValue.serverTimestamp(),
  }, { merge: true });
  return { ok: true, uid: targetUid, tenantId, temporaryPassword };
}

async function setTenantEmployeeDisabled(auth, payload) {
  const { ctx, tenantId, targetUid, userRef } = await loadTenantEmployeeOrThrow(auth, payload);
  const disabled = payload?.disabled !== false;
  if (disabled && targetUid === ctx.uid) {
    throw new HttpsError('failed-precondition', 'Du kannst dich nicht selbst deaktivieren.');
  }
  await admin.auth().updateUser(targetUid, { disabled });
  await userRef.set({
    disabled,
    status: disabled ? 'inactive' : 'active',
    updatedAt: adminDb.FieldValue.serverTimestamp(),
    updatedBy: ctx.uid,
  }, { merge: true });
  return { ok: true, uid: targetUid, tenantId, disabled, status: disabled ? 'inactive' : 'active' };
}

function toHttpsError(err, context) {
  if (err instanceof HttpsError) return err;
  console.error(`[manageTenantEmployees] Unerwarteter Fehler (${context}):`, err);
  return new HttpsError(
    'internal',
    'Mitarbeiter-Verwaltung fehlgeschlagen.',
    { reason: String(err?.message || err || 'unbekannt') },
  );
}

async function handleManageTenantEmployees(request) {
  const action = String(request.data?.action || '').trim();
  const tenantId = String(request.data?.tenantId || '').trim();

  try {
    if (action === 'list') {
      const effectiveTenantId = resolveTargetTenantId(request.auth, tenantId);
      assertAdminAccess(request.auth, effectiveTenantId);
      const employees = await listTenantEmployees(effectiveTenantId);
      return { ok: true, tenantId: effectiveTenantId, employees };
    }

    if (action === 'update') {
      return await updateTenantEmployee(request.auth, request.data);
    }

    if (action === 'remove') {
      return await removeTenantEmployee(request.auth, request.data);
    }

    if (action === 'resetPassword') {
      return await resetTenantEmployeePassword(request.auth, request.data);
    }

    if (action === 'disable' || action === 'enable') {
      return await setTenantEmployeeDisabled(request.auth, {
        ...request.data,
        disabled: action === 'disable',
      });
    }

    throw new HttpsError('invalid-argument', 'Unbekannte Aktion.');
  } catch (err) {
    throw toHttpsError(err, action || 'unknown');
  }
}

exports.handleManageTenantEmployees = handleManageTenantEmployees;
exports.manageTenantEmployees = onCall(
  CALLABLE_BASE_OPTIONS,
  handleManageTenantEmployees,
);

exports.isSuperAdminForDashboard = isSuperAdmin;
exports.assertAdminAccessForTenant = assertAdminAccess;
exports.EMPLOYEE_MODULE_KEYS = EMPLOYEE_MODULE_KEYS;
exports.normalizeAllowedModules = normalizeAllowedModules;
exports.generateStartPassword = generateStartPassword;
exports.mergeEmployeeSources = mergeEmployeeSources;
exports.profileUidFromName = profileUidFromName;
exports.defaultProfileNamesForTenant = defaultProfileNamesForTenant;
exports.isProfileUid = isProfileUid;
exports.listTenantEmployees = listTenantEmployees;
