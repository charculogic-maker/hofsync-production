/**
 * Instant Demo-Tenant Provisioning for Patrik / CharcuLogic platform admins.
 * Callable: provisionDemoTenant
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { roleFromToken } = require('./authContext');
const { isSuperAdminForDashboard } = require('./superAdmin');
const { getAdminDb, getAdminAuth, firestore } = require('./firebaseAdmin');
const { isConfiguredParam, readSmtpConfig } = require('./runtimeParams');
const {
  modulesForTier,
  minimalReadOnlyModules,
  applyModulePatch,
  TIER_IDS,
} = require('./billingTiers');

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

const DEFAULT_PRIMARY = '#0284c7';
const BASELINE_TEAM = ['Betriebsleiter', 'Mitarbeiter 1'];
const BASELINE_SUPPLIERS = ['Eigener Wareneingang', 'Großhandel'];

function assertSuperAdmin(auth) {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Anmeldung erforderlich.');
  }
  if (!isSuperAdminForDashboard(auth)) {
    throw new HttpsError('permission-denied', 'Nur die Plattform-Verwaltung darf Module und Mandanten anlegen.');
  }
  return { uid: auth.uid };
}

function normalizeColor(value) {
  const color = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_PRIMARY;
}

function colorPalette(primaryColor) {
  if (primaryColor.toLowerCase() === DEFAULT_PRIMARY) {
    return {
      primaryColor: DEFAULT_PRIMARY,
      primaryColorHover: '#0369a1',
      darkHeaderBg: '#0c4a6e',
    };
  }
  return {
    primaryColor,
    primaryColorHover: primaryColor,
    darkHeaderBg: primaryColor,
  };
}

function deviceDocId(name) {
  return String(name || 'geraet')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'geraet';
}

function baselineDiscountMatrix(actorUid) {
  const badge = (percent) => `🏷️ -${percent} % Aufkleber`;
  return {
    enabled: true,
    defaultRules: [
      { daysRemainingMax: 0, discountPercent: 50, badgeText: badge(50) },
      { daysRemainingMax: 1, discountPercent: 30, badgeText: badge(30) },
      { daysRemainingMax: 2, discountPercent: 20, badgeText: badge(20) },
      { daysRemainingMax: 3, discountPercent: 10, badgeText: badge(10) },
    ],
    rounding: 'commercial_cent',
    updatedBy: actorUid,
  };
}

function baselineCategories() {
  return [
    { name: 'MoPro & Kühlware', mhdWarningDays: 2 },
    { name: 'Frische Fleisch- & Wurstwaren', mhdWarningDays: 2 },
    { name: 'Obst & Gemüse', mhdWarningDays: 1 },
    { name: 'Trockenware & Feinkost', mhdWarningDays: 7 },
    { name: 'Tiefkühlware (TK)', mhdWarningDays: 14 },
  ];
}

function baselineHaccpDevices() {
  return [
    {
      name: 'Kühlhaus 1 (Fleisch/MoPro)',
      bereich: 'Kühlung',
      protokollTyp: 'temperatur',
      geraeteTyp: 'kuehlung',
      sollMin: 0,
      sollMax: 4,
      einheit: '°C',
      intervall: 'taeglich',
      aktiv: true,
    },
    {
      name: 'Verkaufstheke / Kühlregal',
      bereich: 'Theke',
      protokollTyp: 'temperatur',
      geraeteTyp: 'kuehlung',
      sollMin: 1,
      sollMax: 7,
      einheit: '°C',
      intervall: 'taeglich',
      aktiv: true,
    },
    {
      name: 'Tiefkühltruhe',
      bereich: 'Tiefkühlung',
      protokollTyp: 'temperatur',
      geraeteTyp: 'tk',
      sollMin: -25,
      sollMax: -15,
      einheit: '°C',
      intervall: 'taeglich',
      aktiv: true,
    },
  ];
}

async function writeModuleAudit(tenantId, errorCode, message, actorUid) {
  await getAdminDb().collection('tenants').doc(tenantId).collection('system_errors').add({
    tenantId,
    errorCode,
    message: String(message || '').slice(0, 900),
    timestamp: firestore.FieldValue.serverTimestamp(),
    context: { actorUid: String(actorUid || '') },
  });
}

async function sendWelcomeMail({ adminEmail, companyName, inviteLink }) {
  const config = readSmtpConfig();
  const fromEmail = String(config.fromEmail || config.smtpUser || '').trim();
  if (!isConfiguredParam(fromEmail) || !isConfiguredParam(config.smtpPass) || !inviteLink) {
    return false;
  }
  const nodemailer = require('nodemailer');
  const port = Number.parseInt(String(config.smtpPort || '465'), 10) || 465;
  const transport = nodemailer.createTransport({
    host: String(config.smtpHost || '').trim(),
    port,
    secure: port === 465,
    auth: {
      user: String(config.smtpUser || fromEmail).trim(),
      pass: String(config.smtpPass || ''),
    },
  });
  await transport.sendMail({
    from: { address: fromEmail, name: 'HofSync' },
    to: adminEmail,
    subject: `Zugang zu HofSync für ${companyName}`,
    text: [
      `Hallo,`,
      ``,
      `der Mandant „${companyName}“ ist in HofSync angelegt.`,
      `Über diesen Link setzt du das Passwort für ${adminEmail}:`,
      inviteLink,
      ``,
      `Der Link ist nur für diese E-Mail-Adresse gültig.`,
    ].join('\n'),
  });
  return true;
}

async function handleSetTenantModules(request) {
  const ctx = assertSuperAdmin(request?.auth);
  const data = request?.data && typeof request.data === 'object' ? request.data : {};
  const targetTenantId = String(data.targetTenantId || '').trim();
  if (!targetTenantId || targetTenantId.includes('/')) {
    throw new HttpsError('invalid-argument', 'targetTenantId ist erforderlich.');
  }
  const tenantRef = getAdminDb().doc(`tenants/${targetTenantId}`);
  const snap = await tenantRef.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Mandant wurde nicht gefunden.');
  }
  let enabledModules;
  try {
    enabledModules = applyModulePatch(snap.data()?.enabledModules, data.enabledModules);
  } catch (err) {
    throw new HttpsError('invalid-argument', err.message || 'enabledModules ist ungültig.');
  }
  await tenantRef.update({
    enabledModules,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });
  await writeModuleAudit(
    targetTenantId,
    'MODULE_UPDATE',
    'enabledModules aktualisiert',
    ctx.uid,
  );
  return { success: true, targetTenantId, enabledModules };
}

async function findTenantByBilling({ subscriptionId, email }) {
  const db = getAdminDb();
  if (subscriptionId) {
    const snap = await db.collection('tenants')
      .where('billing.subscriptionId', '==', subscriptionId)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0];
  }
  if (email) {
    const snap = await db.collection('tenants')
      .where('billing.adminEmail', '==', email)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0];
  }
  return null;
}

async function deactivateTenantForBilling(event = {}) {
  const doc = await findTenantByBilling({
    subscriptionId: String(event.subscriptionId || '').trim(),
    email: normalizeEmail(event.email),
  });
  if (!doc) return { tenantId: '' };
  await doc.ref.update({
    active: false,
    status: 'inactive',
    enabledModules: minimalReadOnlyModules(),
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });
  await writeModuleAudit(doc.id, 'BILLING_CANCEL', 'Abo beendet, Module gesperrt', 'billing-webhook');
  return { tenantId: doc.id };
}

async function seedNewTenant(tenantRef, {
  tenantId,
  companyName,
  adminEmail,
  adminUid,
  enabledModules,
  tier,
  primaryColor,
  actorUid,
  billing,
}) {
  const now = firestore.FieldValue.serverTimestamp();
  const colors = colorPalette(normalizeColor(primaryColor));
  const batch = getAdminDb().batch();
  batch.set(tenantRef, {
    displayName: companyName,
    name: companyName,
    status: 'active',
    active: true,
    tier,
    enabledModules,
    demo: false,
    provisionedBy: actorUid,
    billing: {
      provider: String(billing?.provider || ''),
      adminEmail,
      subscriptionId: String(billing?.subscriptionId || ''),
      customerId: String(billing?.customerId || ''),
    },
    createdAt: now,
    updatedAt: now,
  });
  batch.set(tenantRef.collection('settings').doc('profile'), {
    betriebsName: companyName,
    appName: 'HofSync',
    ...colors,
    standardBereich: 'Laden / Verkauf',
    defaultTeam: BASELINE_TEAM,
    tenantId,
    updatedBy: actorUid,
    updatedAt: now,
  });
  batch.set(tenantRef.collection('settings').doc('terminal'), {
    isFixedTerminal: false,
    bypassPin: false,
    defaultOperatorName: 'Team',
    tenantId,
    updatedBy: actorUid,
    updatedAt: now,
  });
  batch.set(tenantRef.collection('settings').doc('suppliers'), {
    names: BASELINE_SUPPLIERS,
    tenantId,
    updatedBy: actorUid,
    updatedAt: now,
  });
  batch.set(tenantRef.collection('settings').doc('categories'), {
    groups: baselineCategories(),
    tenantId,
    updatedBy: actorUid,
    updatedAt: now,
  });
  batch.set(tenantRef.collection('settings').doc('discount_matrix'), {
    ...baselineDiscountMatrix(actorUid),
    tenantId,
    updatedAt: now,
  });
  baselineHaccpDevices().forEach((device) => {
    batch.set(tenantRef.collection('haccp_geraete').doc(deviceDocId(device.name)), {
      ...device,
      tenantId,
      createdAt: now,
    });
  });
  batch.set(getAdminDb().doc(`users/${adminUid}`), {
    email: adminEmail,
    displayName: companyName,
    tenantId,
    role: 'admin',
    createdAt: now,
    createdBy: actorUid,
  }, { merge: true });
  await batch.commit();
}

async function provisionNewCustomerTenantInner({
  companyName: rawCompanyName,
  adminEmail: rawEmail,
  tier,
  primaryColor,
  actorUid,
  billing,
}) {
  const companyName = normalizeDisplayName(rawCompanyName);
  const adminEmail = normalizeEmail(rawEmail);
  const plan = String(tier || '').trim();
  if (!companyName) {
    throw new HttpsError('invalid-argument', 'Betriebsname ist erforderlich.');
  }
  if (!adminEmail || !adminEmail.includes('@')) {
    throw new HttpsError('invalid-argument', 'E-Mail-Adresse ist erforderlich.');
  }
  if (!TIER_IDS.includes(plan)) {
    throw new HttpsError('invalid-argument', 'Tarif ist ungültig.');
  }
  const tenantId = slugifyTenantId(companyName);
  if (!tenantId || tenantId.length < 2) {
    throw new HttpsError('invalid-argument', 'Aus dem Betriebsnamen konnte keine Mandanten-ID abgeleitet werden.');
  }

  const enabledModules = modulesForTier(plan);
  const tenantRef = getAdminDb().doc(`tenants/${tenantId}`);
  const existingTenant = await tenantRef.get();
  if (existingTenant.exists) {
    const owner = normalizeEmail(existingTenant.data()?.billing?.adminEmail);
    if (owner && owner === adminEmail) {
      await tenantRef.update({
        tier: plan,
        enabledModules,
        active: true,
        status: 'active',
        billing: {
          provider: String(billing?.provider || existingTenant.data()?.billing?.provider || ''),
          adminEmail,
          subscriptionId: String(billing?.subscriptionId || existingTenant.data()?.billing?.subscriptionId || ''),
          customerId: String(billing?.customerId || existingTenant.data()?.billing?.customerId || ''),
        },
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      await writeModuleAudit(tenantId, 'BILLING_PROVISION', `Tarif ${plan} aktualisiert`, actorUid);
      return {
        success: true,
        tenantId,
        created: false,
        inviteLink: '',
        emailed: false,
        email: adminEmail,
        companyName,
        tier: plan,
        enabledModules,
      };
    }
    throw new HttpsError('already-exists', `Mandant „${tenantId}“ existiert bereits.`);
  }

  const { userRecord, created: userCreated } = await findOrCreateAuthUser({
    email: adminEmail,
    adminName: companyName,
  });
  const previousTenant = String(userRecord.customClaims?.tenantId || '').trim();
  if (previousTenant && previousTenant !== tenantId) {
    throw new HttpsError('already-exists', 'Diese E-Mail gehört bereits zu einem anderen Mandanten.');
  }
  await getAdminAuth().setCustomUserClaims(userRecord.uid, {
    tenantId,
    role: 'admin',
    isAdmin: true,
  });

  try {
    await seedNewTenant(tenantRef, {
      tenantId,
      companyName,
      adminEmail,
      adminUid: userRecord.uid,
      enabledModules,
      tier: plan,
      primaryColor,
      actorUid,
      billing,
    });
  } catch (err) {
    console.error('[provisionNewCustomerTenant] Firestore seed failed:', err);
    throw new HttpsError('internal', 'Mandanten-Konfiguration konnte nicht gespeichert werden.');
  }

  let inviteLink = '';
  try {
    inviteLink = await getAdminAuth().generatePasswordResetLink(adminEmail, {
      url: DEFAULT_CONTINUE_URL,
      handleCodeInApp: false,
    });
  } catch (err) {
    console.error('[provisionNewCustomerTenant] generatePasswordResetLink failed:', err?.message || err);
  }

  let emailed = false;
  if (inviteLink) {
    try {
      emailed = await sendWelcomeMail({ adminEmail, companyName, inviteLink });
    } catch (err) {
      console.error('[provisionNewCustomerTenant] Willkommens-Mail fehlgeschlagen:', err?.message || err);
    }
  }
  await writeModuleAudit(tenantId, 'BILLING_PROVISION', `Tarif ${plan} angelegt`, actorUid);

  return {
    success: true,
    tenantId,
    created: true,
    userCreated,
    inviteLink,
    emailed,
    email: adminEmail,
    companyName,
    tier: plan,
    enabledModules,
  };
}

function assertPlatformTenantReader(auth) {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Anmeldung erforderlich.');
  }
  const token = auth.token || {};
  const email = String(token.email || '').trim().toLowerCase();
  if (email === 'patrik@charculogic.de' || token.superAdmin === true || isSuperAdminForDashboard(auth)) {
    return { uid: auth.uid };
  }
  throw new HttpsError('permission-denied', 'Die Betriebsliste ist nur für die Plattform-Verwaltung sichtbar.');
}

async function handleListPlatformTenants(request) {
  assertPlatformTenantReader(request?.auth);
  const snap = await getAdminDb().collection('tenants').get();
  const tenants = snap.docs.map((doc) => {
    const data = doc.data() || {};
    const name = String(data.displayName || data.name || data.betriebsName || doc.id).trim() || doc.id;
    const inactive = data.status === 'inactive' || data.active === false;
    return {
      id: doc.id,
      name,
      tier: String(data.tier || ''),
      status: inactive ? 'inactive' : 'active',
      enabledModules: data.enabledModules && typeof data.enabledModules === 'object'
        ? data.enabledModules
        : {},
    };
  }).sort((left, right) => left.id.localeCompare(right.id, 'de'));
  return { tenants };
}

async function handleProvisionNewCustomerTenant(request) {
  const ctx = assertSuperAdmin(request?.auth);
  const data = request?.data && typeof request.data === 'object' ? request.data : {};
  return provisionNewCustomerTenantInner({
    companyName: data.companyName,
    adminEmail: data.adminEmail,
    tier: data.tier,
    primaryColor: data.primaryColor,
    actorUid: ctx.uid,
    billing: { provider: 'manual', adminEmail: normalizeEmail(data.adminEmail) },
  });
}

exports.slugifyTenantId = slugifyTenantId;
exports.normalizeModules = normalizeModules;
exports.assertProvisionAccess = assertProvisionAccess;
exports.handleProvisionDemoTenant = handleProvisionDemoTenant;
exports.handleSetTenantModules = handleSetTenantModules;
exports.handleListPlatformTenants = handleListPlatformTenants;
exports.handleProvisionNewCustomerTenant = handleProvisionNewCustomerTenant;
exports.provisionNewCustomerTenantInner = provisionNewCustomerTenantInner;
exports.deactivateTenantForBilling = deactivateTenantForBilling;
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
