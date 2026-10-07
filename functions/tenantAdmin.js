/**
 * Instant Demo-Tenant Provisioning for Patrik / CharcuLogic platform admins.
 * Callable: provisionDemoTenant
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { roleFromToken } = require('./authContext');
const { isSuperAdminForDashboard } = require('./superAdmin');
const { getAdminDb, getAdminAuth, firestore } = require('./firebaseAdmin');

const REGION = 'europe-west3';

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
 * Office admins (token.role === 'admin') and platform admins.
 * Shopfloor employees and helpers cannot create tenants.
 * v2 callable auth lives on request.auth — never a v1 (data, context) pair.
 */
function assertProvisionAccess(auth) {
  if (!auth) {
    throw new HttpsError('permission-denied', 'Keine Admin-Berechtigung auf diesem Account.');
  }
  const token = auth.token || {};
  const role = roleFromToken(token);
  const isPlatformAdmin = token.isPlatformAdmin === true || isSuperAdminForDashboard(auth);
  if (role !== 'admin' && token.role !== 'admin' && !isPlatformAdmin) {
    throw new HttpsError('permission-denied', 'Keine Admin-Berechtigung auf diesem Account.');
  }
  return { uid: auth.uid, role: role || 'admin', isSuperAdmin: isPlatformAdmin };
}

function buildEnabledModules(modules) {
  const kitchen = modules.kitchen === true || modules.wurstkueche === true;
  return {
    start: modules.start === true,
    team: modules.team === true,
    mhd: modules.mhd === true,
    receiving: modules.receiving === true,
    kitchen,
    wurstkueche: kitchen,
    haccp: modules.haccp === true,
    knowledge: modules.knowledge === true,
    buero: modules.buero === true,
    chargenDoku: modules.cutting === true || modules.chargenDoku === true,
    cutting: modules.cutting === true,
    retterBox: modules.retterBox === true,
  };
}

async function findOrCreateAuthUser({ email, adminName }) {
  try {
    const existing = await getAdminAuth().getUserByEmail(email);
    if (adminName && existing.displayName !== adminName) {
      try {
        await getAdminAuth().updateUser(existing.uid, { displayName: adminName });
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
    const userRecord = await getAdminAuth().createUser({
      email,
      displayName: adminName,
      emailVerified: false,
      disabled: false,
    });
    return { userRecord, created: true };
  } catch (err) {
    if (err?.code === 'auth/email-already-exists') {
      const existing = await getAdminAuth().getUserByEmail(email);
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
  try {
    const auth = request?.auth;
    const data = request?.data || {};
    return await provisionDemoTenantInner(auth, data);
  } catch (err) {
    console.error('[PROVISION_FAIL_TRACE]', err);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError(
      'internal',
      err?.message || 'Provisioning failed',
      { code: err?.code, details: err?.stack },
    );
  }
}

async function provisionDemoTenantInner(auth, data) {
  const ctx = assertProvisionAccess(auth);
  const payload = data && typeof data === 'object' ? data : {};

  const companyName = normalizeDisplayName(payload.companyName);
  const adminEmail = normalizeEmail(payload.adminEmail);
  const adminName = normalizeDisplayName(payload.adminName);
  const modules = normalizeModules(payload.modules);
  const continueUrl = String(payload.continueUrl || DEFAULT_CONTINUE_URL).trim()
    || DEFAULT_CONTINUE_URL;

  console.log('[provisionDemoTenant] Step 1: validating payload', {
    companyName,
    adminName,
    adminEmail,
  });
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

  const tenantRef = getAdminDb().doc(`tenants/${tenantId}`);
  const existingTenant = await tenantRef.get();
  if (existingTenant.exists) {
    throw new HttpsError(
      'already-exists',
      `Mandant „${tenantId}“ existiert bereits. Bitte einen anderen Betriebsnamen wählen.`,
    );
  }

  console.log('[provisionDemoTenant] Step 2: creating or fetching Auth user', adminEmail);
  const { userRecord, created: userCreated } = await findOrCreateAuthUser({
    email: adminEmail,
    adminName,
  });
  console.log('[provisionDemoTenant] Step 2 result', {
    uid: userRecord.uid,
    created: userCreated,
  });

  const claims = {
    tenantId,
    role: 'admin',
    isAdmin: true,
  };

  console.log('[provisionDemoTenant] Step 3: setting custom claims', userRecord.uid);
  try {
    await getAdminAuth().setCustomUserClaims(userRecord.uid, claims);
  } catch (err) {
    console.error('[provisionDemoTenant] setCustomUserClaims failed:', err);
    throw new HttpsError(
      'internal',
      'Custom Claims konnten nicht gesetzt werden.',
      { code: String(err?.code || ''), reason: String(err?.message || err || 'unbekannt') },
    );
  }

  const enabledModules = buildEnabledModules(modules);
  const now = firestore.FieldValue.serverTimestamp();
  const brandingPayload = {
    companyName,
    themeColor: '#1e293b',
    createdAt: now,
  };
  const modulesPayload = {
    ...modules,
    updatedAt: now,
  };

  console.log('[provisionDemoTenant] Step 4: writing tenants/' + tenantId);
  console.log('[provisionDemoTenant] Step 5: seeding modules and branding');
  try {
    const batch = getAdminDb().batch();
    batch.set(tenantRef, {
      displayName: companyName,
      status: 'active',
      enabledModules,
      demo: payload.demo === true,
      provisionedBy: ctx.uid,
      createdAt: now,
      updatedAt: now,
    });
    batch.set(tenantRef.collection('settings').doc('branding'), brandingPayload);
    batch.set(tenantRef.collection('settings').doc('modules'), modulesPayload);
    batch.set(getAdminDb().doc(`users/${userRecord.uid}`), {
      email: adminEmail,
      displayName: adminName,
      tenantId,
      role: 'admin',
      allowedModules: {
        mhd: modules.mhd === true,
        kitchen: modules.kitchen === true || modules.wurstkueche === true,
        buero: modules.buero === true,
      },
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
    inviteLink = await getAdminAuth().generatePasswordResetLink(adminEmail, {
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
/**
 * Vercel hosts (hofsync.vercel.app, craftfoodapp.vercel.app) mint reCAPTCHA
 * tokens that App Check rejects, which the browser reports as a CORS 403.
 * Auth stays required; App Check is not enforced on this callable.
 */
exports.provisionDemoTenant = onCall(
  {
    region: REGION,
    cors: true,
    enforceAppCheck: false,
  },
  async (request) => {
    const auth = request?.auth;
    const data = request?.data || {};
    return handleProvisionDemoTenant({ ...(request || {}), auth, data });
  },
);
