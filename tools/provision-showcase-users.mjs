/**
 * Legt Auth-Nutzer für den Showcase-Mandanten test_auto_seed an:
 * 1 Admin, 3 Mitarbeiter, 2 Aushilfen (helper).
 *
 *   node tools/provision-showcase-users.mjs
 *   node tools/provision-showcase-users.mjs --dry-run
 *   node tools/provision-showcase-users.mjs --reset-passwords
 *
 * Schreibt Zugangsdaten nach /tmp/musterbetrieb-credentials.json (nicht committen).
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import admin from 'firebase-admin';

const TENANT_ID = 'test_auto_seed';
const DISPLAY_NAME = 'Fleischerei & Hofladen Musterbetrieb';
const CREATED_BY = 'provision-showcase-users';
const CREDENTIALS_OUT = '/tmp/musterbetrieb-credentials.json';
const ARTIFACT_OUT = '/opt/cursor/artifacts/musterbetrieb-credentials.json';

const EMPLOYEE_MODULES = Object.freeze({
  start: true,
  team: true,
  orders: true,
  mhd: true,
  receiving: true,
  kitchen: true,
  averyLabels: true,
  haccp: true,
  knowledge: true,
  buero: true,
  chargenDoku: true,
  retterBox: true,
});

/** Aushilfen: Theke/MHD lesen & buchen, kein Büro/Produktion. */
const HELPER_MODULES = Object.freeze({
  start: true,
  team: false,
  orders: false,
  mhd: true,
  receiving: true,
  kitchen: false,
  averyLabels: false,
  haccp: false,
  knowledge: false,
  buero: false,
  chargenDoku: false,
  retterBox: true,
});

const USERS = Object.freeze([
  {
    key: 'admin',
    role: 'admin',
    email: 'muster.admin@charculogic.de',
    displayName: 'Meister Admin',
    allowedModules: EMPLOYEE_MODULES,
  },
  {
    key: 'employee_1',
    role: 'employee',
    email: 'muster.lena@charculogic.de',
    displayName: 'Lena Theke',
    allowedModules: EMPLOYEE_MODULES,
  },
  {
    key: 'employee_2',
    role: 'employee',
    email: 'muster.markus@charculogic.de',
    displayName: 'Markus Zerlegung',
    allowedModules: EMPLOYEE_MODULES,
  },
  {
    key: 'employee_3',
    role: 'employee',
    email: 'muster.sabine@charculogic.de',
    displayName: 'Sabine Büro',
    allowedModules: EMPLOYEE_MODULES,
  },
  {
    key: 'helper_1',
    role: 'helper',
    email: 'muster.tim@charculogic.de',
    displayName: 'Tim Aushilfe',
    allowedModules: HELPER_MODULES,
  },
  {
    key: 'helper_2',
    role: 'helper',
    email: 'muster.nina@charculogic.de',
    displayName: 'Nina Aushilfe',
    allowedModules: HELPER_MODULES,
  },
]);

function parseArgs(argv) {
  const args = {
    project: process.env.FIREBASE_PROJECT || process.env.GCLOUD_PROJECT || 'hofsync-production',
    dryRun: false,
    resetPasswords: false,
  };
  argv.forEach((arg) => {
    if (arg === '--dry-run') args.dryRun = true;
    if (arg === '--reset-passwords') args.resetPasswords = true;
    if (arg.startsWith('--project=')) args.project = arg.slice('--project='.length).trim() || args.project;
  });
  return args;
}

function initAdmin(projectId) {
  if (admin.apps.length) return admin.app();
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || '';
  if (credPath && existsSync(credPath)) {
    const sa = JSON.parse(readFileSync(credPath, 'utf8'));
    return admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: sa.project_id || projectId,
    });
  }
  const credJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '';
  if (credJson) {
    const sa = JSON.parse(credJson);
    writeFileSync('/tmp/hofsync-sa.json', JSON.stringify(sa));
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/tmp/hofsync-sa.json';
    return admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: sa.project_id || projectId,
    });
  }
  return admin.initializeApp({ projectId });
}

function generatePassword() {
  // 12 Zeichen, URL-safe, ohne leicht verwechselbare Zeichenfolgen
  return randomBytes(9).toString('base64url');
}

function buildClaims(user) {
  return {
    tenantId: TENANT_ID,
    role: user.role,
    isAdmin: user.role === 'admin',
    allowedModules: { ...user.allowedModules },
  };
}

async function findOrCreateAuthUser(auth, { email, displayName, password, resetPasswords }) {
  try {
    const existing = await auth.getUserByEmail(email);
    let passwordRotated = false;
    if (resetPasswords) {
      await auth.updateUser(existing.uid, { password, displayName, disabled: false });
      passwordRotated = true;
    } else if (displayName && existing.displayName !== displayName) {
      await auth.updateUser(existing.uid, { displayName });
    }
    return { userRecord: existing, created: false, passwordRotated };
  } catch (err) {
    if (err?.code !== 'auth/user-not-found') throw err;
    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
      emailVerified: false,
      disabled: false,
    });
    return { userRecord, created: true, passwordRotated: false };
  }
}

async function upsertProfiles(db, authUser, userSpec, now) {
  const uid = authUser.uid;
  const claims = buildClaims(userSpec);
  await admin.auth().setCustomUserClaims(uid, claims);

  const profile = {
    email: userSpec.email,
    displayName: userSpec.displayName,
    tenantId: TENANT_ID,
    role: userSpec.role,
    allowedModules: { ...userSpec.allowedModules },
    status: 'active',
    disabled: false,
    source: 'auth',
    updatedAt: now,
    updatedBy: CREATED_BY,
  };

  await db.doc(`users/${uid}`).set({
    ...profile,
    createdAt: now,
    createdBy: CREATED_BY,
  }, { merge: true });

  await db.doc(`tenants/${TENANT_ID}/employees/${uid}`).set({
    ...profile,
    createdAt: now,
    createdBy: CREATED_BY,
  }, { merge: true });
}

async function upsertTeamRoster(db, now) {
  const employees = USERS.map((u) => u.displayName);
  const groups = {
    theke: {
      label: 'Theke / Laden',
      members: ['Lena Theke', 'Tim Aushilfe', 'Nina Aushilfe', 'Meister Admin'],
    },
    produktion: {
      label: 'Zerlegung / Küche',
      members: ['Markus Zerlegung', 'Meister Admin'],
    },
    buero: {
      label: 'Büro',
      members: ['Sabine Büro', 'Meister Admin'],
    },
  };
  await db.doc(`tenants/${TENANT_ID}/settings/teamDashboard`).set({
    employees,
    groups,
    tenantId: TENANT_ID,
    updatedAt: now,
    updatedBy: CREATED_BY,
  }, { merge: true });
}

async function touchTenant(db, adminEmail, now) {
  await db.doc(`tenants/${TENANT_ID}`).set({
    displayName: DISPLAY_NAME,
    name: DISPLAY_NAME,
    status: 'active',
    active: true,
    billing: {
      adminEmail,
    },
    updatedAt: now,
    updatedBy: CREATED_BY,
  }, { merge: true });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`Projekt: ${args.project}`);
  console.log(`Mandant: ${TENANT_ID}`);
  console.log(`Modus: ${args.dryRun ? 'dry-run' : 'write'}${args.resetPasswords ? ' + reset-passwords' : ''}`);

  initAdmin(args.project);
  const db = admin.firestore();
  const auth = admin.auth();
  const now = admin.firestore.FieldValue.serverTimestamp();

  const credentials = {
    tenantId: TENANT_ID,
    displayName: DISPLAY_NAME,
    appUrl: 'https://hofsync-charculogic.vercel.app/',
    createdAt: new Date().toISOString(),
    users: [],
  };

  for (const user of USERS) {
    const password = generatePassword();
    if (args.dryRun) {
      console.log(`[dry-run] ${user.role.padEnd(8)} ${user.email} · ${user.displayName}`);
      credentials.users.push({
        role: user.role,
        email: user.email,
        displayName: user.displayName,
        password: '(dry-run)',
        created: false,
      });
      continue;
    }

    const { userRecord, created, passwordRotated } = await findOrCreateAuthUser(auth, {
      email: user.email,
      displayName: user.displayName,
      password,
      resetPasswords: args.resetPasswords,
    });

    // Neuer User: Passwort ist bekannt. Bestehender ohne --reset-passwords: kein Klartext.
    let passwordOut = null;
    if (created || passwordRotated) {
      passwordOut = password;
      if (!created && passwordRotated) {
        // ensure the rotated password is the one we generated above
        await auth.updateUser(userRecord.uid, { password });
      }
    } else if (!created && !passwordRotated) {
      // Existing account kept — rotate so the caller gets usable credentials.
      await auth.updateUser(userRecord.uid, { password });
      passwordOut = password;
    }

    await upsertProfiles(db, userRecord, user, now);
    console.log(`[ok] ${user.role.padEnd(8)} ${user.email} · ${user.displayName} · ${created ? 'created' : 'updated'} · uid=${userRecord.uid}`);

    credentials.users.push({
      role: user.role,
      email: user.email,
      displayName: user.displayName,
      uid: userRecord.uid,
      password: passwordOut,
      created,
    });
  }

  if (!args.dryRun) {
    await upsertTeamRoster(db, now);
    await touchTenant(db, USERS[0].email, now);
    writeFileSync(CREDENTIALS_OUT, `${JSON.stringify(credentials, null, 2)}\n`, { mode: 0o600 });
    try {
      writeFileSync(ARTIFACT_OUT, `${JSON.stringify(credentials, null, 2)}\n`, { mode: 0o600 });
    } catch (_) {
      /* artifact dir optional */
    }
    console.log(`[ok] Zugangsdaten geschrieben: ${CREDENTIALS_OUT}`);
  }

  console.log('[done] Showcase-Nutzer provisioniert.');
}

const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('provision-showcase-users.mjs')
  || process.argv[1].includes('provision-showcase-users')
);

if (isDirectRun) {
  main().catch((err) => {
    console.error('[provision-showcase-users] fehlgeschlagen:', err);
    process.exitCode = 1;
  });
}

export { TENANT_ID, USERS, EMPLOYEE_MODULES, HELPER_MODULES, generatePassword, buildClaims };
