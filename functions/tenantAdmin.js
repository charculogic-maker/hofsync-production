/**
 * Instant Demo-Tenant Provisioning for Patrik / CharcuLogic platform admins.
 * Callable: provisionDemoTenant
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const adminDb = require('./adminDb');
const { roleFromToken } = require('./authContext');
const { isSuperAdminForDashboard } = require('./superAdmin');

const REGION = 'europe-west3';

const CALLABLE_BASE_OPTIONS = {
  region: REGION,
  enforceAppCheck: true,
};

const DEFAULT_CONTINUE_URL = 'https://hofsync-production.web.app/';

const MODULE_KEYS = ['mhd', 'receiving', 'kitchen', 'cutting', 'haccp'];

/** Frontend may send friendly keys (mhdMonitor, wareneingang, …) or internal keys. */
const MODULE_ALIASES = {
  mhd: ['mhd', 'mhdMonitor'],
  receiving: ['receiving', 'wareneingang'],
  kitchen: ['kitchen', 'wurstkueche'],
  cutting: ['cutting', 'zerlegung'],
  haccp: ['haccp'],
};

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeDisplayName(value) {
  return String(value || '').trim();
}

/** companyName → clean tenantId, e.g. "Metzgerei Schmidt" → "metzgerei_schmidt" */
function slugifyTenantId(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]+/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

function normalizeModules(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  /** @type {Record<string, boolean>} */
  const modules = {};
  MODULE_KEYS.forEach((key) => {
    const aliases = MODULE_ALIASES[key] || [key];
    modules[key] = aliases.some((alias) => src[alias] === true);
  });
  return modules;
}

/**
 * Platform admins only: token.role === 'admin' OR CharcuLogic super-admin.
 * Creating tenants is intentionally not available to shopfloor employees/helpers.
 */
function assertProvisionAccess(auth) {
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'Anmeldung erforderlich.');
  }
  const role = roleFromToken(auth.token || {});
  const isAdminRole = role === 'admin';
  const isSuper = isSuperAdminForDashboard(auth);
  if (!isAdminRole && !isSuper) {
    throw new HttpsError(
      'permission-denied',
      'Nur Admins dürfen Demo-Mandanten anlegen.',
    );
  }
  // Tenant-Admins of an existing shop must not spin up arbitrary new tenants.
  if (!isSuper) {
    throw new HttpsError(
      'permission-denied',
      'Demo-Mandanten dürfen nur von Plattform-Admins angelegt werden.',
    );
  }
  return { uid: auth.uid, role: role || 'admin', isSuperAdmin: isSuper };
}

function buildEnabledModules(modules) {
  return {
    start: false,
    team: false,
    mhd: modules.mhd === true,
    receiving: modules.receiving === true,
    kitchen: modules.kitchen === true,
    haccp: modules.haccp === true,
    knowledge: false,
    buero: true,
    chargenDoku: modules.cutting === true,
    cutting: modules.cutting === true,
  };
}

async function findOrCreateAuthUser({ email, adminName }) {
  try {
    const existing = await admin.auth().getUserByEmail(email);
    if (adminName && existing.displayName !== adminName) {
      try {
        await admin.auth().updateUser(existing.uid, { displayName: adminName });
      } catch (_) {
        /* non-fatal */
      }
    }
    return { userRecord: existing, created: false };
  } catch (err) {
    if (err?.code !== 'auth/user-not-found') {
      throw err;
    }
  }

  try {
    const userRecord = await admin.auth().createUser({
      email,
      displayName: adminName,
      emailVerified: false,
      disabled: false,
    });
    return { userRecord, created: true };
  } catch (err) {
    if (err?.code === 'auth/email-already-exists') {
      const existing = await admin.auth().getUserByEmail(email);
      return { userRecord: existing, created: false };
    }
    if (err?.code === 'auth/invalid-email') {
      throw new HttpsError('invalid-argument', 'Die E-Mail-Adresse ist ungültig.');
    }
    console.error('[provisionDemoTenant] Auth createUser failed:', err);
    throw new HttpsError(
      'internal',
      'Auth-Nutzer konnte nicht angelegt werden.',
      { code: String(err?.code || ''), reason: String(err?.message || err || 'unbekannt') },
    );
  }
}

async function handleProvisionDemoTenant(request) {
  const ctx = assertProvisionAccess(request.auth);

  const companyName = normalizeDisplayName(request.data?.companyName);
  const adminEmail = normalizeEmail(request.data?.adminEmail);
  const adminName = normalizeDisplayName(request.data?.adminName);
  const modules = normalizeModules(request.data?.modules);
  const continueUrl = String(request.data?.continueUrl || DEFAULT_CONTINUE_URL).trim()
    || DEFAULT_CONTINUE_URL;

  if (!companyName) {
    throw new HttpsError('invalid-argument', 'Betriebsname ist erforderlich.');
  }
  if (!adminEmail) {
    throw new HttpsError('invalid-argument', 'E-Mail-Adresse ist erforderlich.');
  }
  if (!adminName) {
    throw new HttpsError('invalid-argument', 'Name des Inhabers / Meisters ist erforderlich.');
  }

  const tenantId = slugifyTenantId(companyName);
  if (!tenantId || tenantId.length < 2) {
    throw new HttpsError(
      'invalid-argument',
      'Aus dem Betriebsnamen konnte keine gültige Mandanten-ID abgeleitet werden.',
    );
  }

  const tenantRef = adminDb.firestore().doc(`tenants/${tenantId}`);
  const existingTenant = await tenantRef.get();
  if (existingTenant.exists) {
    throw new HttpsError(
      'already-exists',
      `Mandant „${tenantId}“ existiert bereits. Bitte einen anderen Betriebsnamen wählen.`,
    );
  }

  const { userRecord, created: userCreated } = await findOrCreateAuthUser({
    email: adminEmail,
    adminName,
  });

  const claims = {
    tenantId,
    role: 'admin',
    isAdmin: true,
  };

  try {
    await admin.auth().setCustomUserClaims(userRecord.uid, claims);
  } catch (err) {
    console.error('[provisionDemoTenant] setCustomUserClaims failed:', err);
    throw new HttpsError(
      'internal',
      'Custom Claims konnten nicht gesetzt werden.',
      { code: String(err?.code || ''), reason: String(err?.message || err || 'unbekannt') },
    );
  }

  const enabledModules = buildEnabledModules(modules);
  const now = adminDb.FieldValue.serverTimestamp();
  const brandingPayload = {
    companyName,
    themeColor: '#1e293b',
    createdAt: now,
  };
  const modulesPayload = {
    ...modules,
    updatedAt: now,
  };

  try {
    const batch = adminDb.firestore().batch();
    batch.set(tenantRef, {
      displayName: companyName,
      status: 'active',
      enabledModules,
      demo: true,
      provisionedBy: ctx.uid,
      createdAt: now,
      updatedAt: now,
    });
    batch.set(tenantRef.collection('settings').doc('branding'), brandingPayload);
    batch.set(tenantRef.collection('settings').doc('modules'), modulesPayload);
    batch.set(adminDb.firestore().doc(`users/${userRecord.uid}`), {
      email: adminEmail,
      displayName: adminName,
      tenantId,
      role: 'admin',
      allowedModules: { mhd: true, kitchen: true, buero: true },
      createdAt: now,
      createdBy: ctx.uid,
      demoProvisioned: true,
    }, { merge: true });
    await batch.commit();
  } catch (err) {
    console.error('[provisionDemoTenant] Firestore seed failed:', err);
    throw new HttpsError(
      'internal',
      'Mandanten-Konfiguration konnte nicht gespeichert werden.',
      { code: String(err?.code || ''), reason: String(err?.message || err || 'unbekannt') },
    );
  }

  let inviteLink = '';
  try {
    inviteLink = await admin.auth().generatePasswordResetLink(adminEmail, {
      url: continueUrl,
      handleCodeInApp: false,
    });
  } catch (err) {
    console.error('[provisionDemoTenant] generatePasswordResetLink failed:', err);
    throw new HttpsError(
      'internal',
      'Einladungs-Link konnte nicht erzeugt werden. Mandant wurde angelegt — Link manuell nachziehen.',
      {
        tenantId,
        email: adminEmail,
        code: String(err?.code || ''),
        reason: String(err?.message || err || 'unbekannt'),
      },
    );
  }

  return {
    success: true,
    tenantId,
    inviteLink,
    email: adminEmail,
    adminName,
    companyName,
    userCreated,
    modules,
  };
}

exports.slugifyTenantId = slugifyTenantId;
exports.normalizeModules = normalizeModules;
exports.assertProvisionAccess = assertProvisionAccess;
exports.handleProvisionDemoTenant = handleProvisionDemoTenant;
exports.MODULE_KEYS = MODULE_KEYS;
exports.provisionDemoTenant = onCall(
  CALLABLE_BASE_OPTIONS,
  handleProvisionDemoTenant,
);
