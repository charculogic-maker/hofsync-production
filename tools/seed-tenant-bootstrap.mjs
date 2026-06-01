/**
 * Einmalige Mandanten-Initialisierung (Admin SDK) – kein Client-Seeding mehr.
 *
 * Beispiele:
 *   node tools/seed-tenant-bootstrap.mjs --tenant=torfabrik --project=charculogic-whitelabel-test --all
 *   node tools/seed-tenant-bootstrap.mjs --tenant=StevesHof_Hauptbetrieb --credentials
 *   node tools/seed-tenant-bootstrap.mjs --tenant=torfabrik --team
 */
import { createRequire } from 'node:module';
import admin from 'firebase-admin';

const require = createRequire(import.meta.url);
const { createPinRecord } = require('../functions/pinHash.js');

const TEAM_DOC_ID = 'teamDashboard';
const CREDENTIALS_DOC_ID = 'current';
const SEED_VERSION = 1;

const TENANT_PRESETS = {
  torfabrik: {
    team: {
      employees: ['Stephan', 'Boris', 'Aushilfe'],
      groups: {
        center: { label: 'Center-Team', members: ['Stephan', 'Boris'] },
        aushilfe: { label: 'Aushilfe', members: ['Aushilfe'] },
      },
    },
    employeePins: {
      Stephan: '1111',
      Boris: '2222',
      Aushilfe: '3333',
    },
    meisterPins: {
      Meister: '7788',
    },
  },
  steveshof_hauptbetrieb: {
    team: {
      employees: ['Stephie', 'Finn', 'Nicole', 'Bettina', 'Heiko', 'Paddy'],
      groups: {
        finn_stephie: { label: 'Finn & Stephie', members: ['Finn', 'Stephie'] },
        metzgerei: { label: 'Metzgerei', members: ['Nicole', 'Bettina', 'Heiko', 'Paddy'] },
        laden: { label: 'Hofladen / Theke', members: ['Stephie', 'Finn', 'Paddy'] },
      },
    },
    employeePins: {
      Stephie: '1122',
      Finn: '2233',
      Nicole: '3344',
      Bettina: '4455',
      Heiko: '5566',
      Paddy: '6677',
    },
    meisterPins: {
      Meister: '7788',
    },
  },
};

function parseArgs(argv) {
  const args = {
    tenant: '',
    project: process.env.FIREBASE_PROJECT || 'hofsync-production',
    team: false,
    credentials: false,
    all: false,
  };
  argv.forEach((arg) => {
    if (arg.startsWith('--tenant=')) args.tenant = arg.slice('--tenant='.length).trim();
    if (arg.startsWith('--project=')) args.project = arg.slice('--project='.length).trim();
    if (arg === '--team') args.team = true;
    if (arg === '--credentials') args.credentials = true;
    if (arg === '--all') args.all = true;
  });
  if (args.all) {
    args.team = true;
    args.credentials = true;
  }
  return args;
}

function normalizeTenantKey(tenantId) {
  return String(tenantId || '').trim().toLowerCase();
}

function resolvePreset(tenantId) {
  const key = normalizeTenantKey(tenantId);
  if (key === 'torfabrik') return TENANT_PRESETS.torfabrik;
  if (key === 'steveshof_hauptbetrieb') return TENANT_PRESETS.steveshof_hauptbetrieb;
  return null;
}

function hashPinMap(pinMap = {}) {
  const out = {};
  Object.entries(pinMap).forEach(([name, pin]) => {
    out[name] = createPinRecord(pin);
  });
  return out;
}

async function seedTeamDashboard(db, tenantId, preset) {
  const ref = db.doc(`tenants/${tenantId}/settings/${TEAM_DOC_ID}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      console.log(`[skip] teamDashboard existiert bereits: tenants/${tenantId}/settings/${TEAM_DOC_ID}`);
      return;
    }
    tx.create(ref, {
      employees: preset.team.employees,
      groups: preset.team.groups,
      tenantId,
      seedVersion: SEED_VERSION,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'seed-tenant-bootstrap',
    });
    console.log(`[ok] teamDashboard angelegt für ${tenantId}`);
  });
}

async function seedTerminalCredentials(db, tenantId, preset) {
  const ref = db.doc(`tenants/${tenantId}/terminalCredentials/${CREDENTIALS_DOC_ID}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      console.log(`[skip] terminalCredentials existieren bereits: tenants/${tenantId}/terminalCredentials/${CREDENTIALS_DOC_ID}`);
      return;
    }
    tx.create(ref, {
      tenantId,
      seedVersion: SEED_VERSION,
      employees: hashPinMap(preset.employeePins),
      meister: hashPinMap(preset.meisterPins),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'seed-tenant-bootstrap',
    });
    console.log(`[ok] terminalCredentials angelegt für ${tenantId}`);
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.tenant) {
    console.error('Bitte --tenant=<id> angeben (z. B. torfabrik oder StevesHof_Hauptbetrieb).');
    process.exitCode = 1;
    return;
  }
  if (!args.team && !args.credentials) {
    console.error('Bitte mindestens --team, --credentials oder --all wählen.');
    process.exitCode = 1;
    return;
  }

  const preset = resolvePreset(args.tenant);
  if (!preset) {
    console.error(`Kein Preset für Mandant "${args.tenant}". Nur torfabrik und StevesHof_Hauptbetrieb unterstützt.`);
    process.exitCode = 1;
    return;
  }

  if (!admin.apps.length) {
    admin.initializeApp({ projectId: args.project });
  }

  const db = admin.firestore();
  console.log(`Projekt: ${args.project}`);
  console.log(`Mandant: ${args.tenant}`);

  if (args.team) {
    await seedTeamDashboard(db, args.tenant, preset);
  }
  if (args.credentials) {
    await seedTerminalCredentials(db, args.tenant, preset);
  }

  console.log('Bootstrap abgeschlossen.');
}

main().catch((err) => {
  console.error('Bootstrap fehlgeschlagen:', err);
  process.exitCode = 1;
});
