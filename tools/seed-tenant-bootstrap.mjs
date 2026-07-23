/**
 * Einmalige Mandanten-Initialisierung (Admin SDK) – kein Client-Seeding mehr.
 *
 * Beispiele:
 *   node tools/seed-tenant-bootstrap.mjs --tenant=torfabrik --project=charculogic-whitelabel-test --all
 *   node tools/seed-tenant-bootstrap.mjs --tenant=StevesHof_Hauptbetrieb --credentials
 *   node tools/seed-tenant-bootstrap.mjs --tenant=StevesHof_Hauptbetrieb --all
 *   node tools/seed-tenant-bootstrap.mjs --tenant=torfabrik --team
 *   node tools/seed-tenant-bootstrap.mjs --tenant=AP23 --project=charculogic-whitelabel-test --tenant-root
 */
import { createRequire } from 'node:module';
import admin from 'firebase-admin';

const require = createRequire(import.meta.url);
const { createPinRecord } = require('../functions/pinHash.js');

const TEAM_DOC_ID = 'teamDashboard';
const CREDENTIALS_DOC_ID = 'current';
const SEED_VERSION = 1;

const DEFAULT_ENABLED_MODULES = {
  mhd: true,
  receiving: true,
  kitchen: true,
  haccp: true,
  knowledge: true,
  buero: true,
  traceability: true,
};

const TENANT_ENABLED_MODULES = {
  torfabrik: {
    mhd: true,
    receiving: true,
    kitchen: false,
    haccp: true,
    knowledge: false,
    buero: false,
    traceability: true,
  },
  steveshof_hauptbetrieb: {
    mhd: true,
    receiving: true,
    kitchen: true,
    haccp: true,
    knowledge: true,
    buero: true,
    traceability: true,
  },
  whitelabel_test: {
    mhd: true,
    receiving: true,
    kitchen: false,
    haccp: false,
    knowledge: false,
    buero: false,
    traceability: true,
  },
  ap23: {
    mhd: true,
    receiving: false,
    kitchen: true,
    haccp: false,
    knowledge: false,
    buero: true,
    traceability: true,
  },
};

const TENANT_DISPLAY_NAMES = {
  torfabrik: 'TorFabrik Krefeld',
  steveshof_hauptbetrieb: 'StevesHof Hofladen',
  whitelabel_test: 'Whitelabel Testbetrieb',
  ap23: 'AP23',
};

const DEFAULT_HACCP_DEVICES = [
  { name: 'Kühlauslage Hofladen', bereich: 'Hofladen', protokollTyp: 'temperatur', geraeteTyp: 'kuehlung', sollMin: 0, sollMax: 7, einheit: '°C', intervall: 'taeglich', aktiv: true },
  { name: 'MoPro-Kühlung', bereich: 'Hofladen', protokollTyp: 'temperatur', geraeteTyp: 'kuehlung', sollMin: 0, sollMax: 7, einheit: '°C', intervall: 'taeglich', aktiv: true },
  { name: 'TK-Truhe', bereich: 'Hofladen', protokollTyp: 'temperatur', geraeteTyp: 'tk', sollMin: null, sollMax: -18, einheit: '°C', intervall: 'taeglich', aktiv: true },
  { name: 'Schneidemaschine', bereich: 'Produktion', protokollTyp: 'reinigung', geraeteTyp: 'geraet', intervall: 'nach_benutzung', aktiv: true },
  { name: 'Vakuumierer', bereich: 'Produktion', protokollTyp: 'reinigung', geraeteTyp: 'geraet', intervall: 'nach_benutzung', aktiv: true },
];

const FLY_PREVENTION_HACCP_DEVICES = [
  { name: 'Fliegengitter Verkaufsraum', bereich: 'Hofladen', protokollTyp: 'reinigung', geraeteTyp: 'hygiene', intervall: 'woechentlich', aktiv: true },
  { name: 'UV-Insektenlampe Käse-Theke', bereich: 'Hofladen', protokollTyp: 'reinigung', geraeteTyp: 'hygiene', intervall: 'woechentlich', aktiv: true },
];

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
  // Whitelabel: Firebase Auth + Rollen (kein PIN-Terminal).
  // patrik@charculogic.de → admin | rehm.patrik@gmail.com → employee (via Admin-Dashboard)
  whitelabel_test: {
    team: {
      employees: [],
      groups: {},
    },
  },
  // Firebase Auth + Rollen (kein PIN-Terminal) — Heimküche / Leitstand
  ap23: {
    team: {
      employees: [],
      groups: {},
    },
  },
  steveshof_hauptbetrieb: {
    team: {
      employees: ['Stephie', 'Finn', 'Nicole', 'Bettina', 'Heiko', 'Paddy', 'Melanie', 'Ernst'],
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
    haccp: false,
    all: false,
    tenantRoot: false,
  };
  argv.forEach((arg) => {
    if (arg.startsWith('--tenant=')) args.tenant = arg.slice('--tenant='.length).trim();
    if (arg.startsWith('--project=')) args.project = arg.slice('--project='.length).trim();
    if (arg === '--team') args.team = true;
    if (arg === '--credentials') args.credentials = true;
    if (arg === '--haccp') args.haccp = true;
    if (arg === '--tenant-root') args.tenantRoot = true;
    if (arg === '--all') args.all = true;
  });
  if (args.all) {
    args.team = true;
    args.credentials = true;
    args.haccp = true;
    args.tenantRoot = true;
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
  if (key === 'whitelabel_test') return TENANT_PRESETS.whitelabel_test;
  if (key === 'ap23') return TENANT_PRESETS.ap23;
  return null;
}

function resolveEnabledModules(tenantId) {
  const key = normalizeTenantKey(tenantId);
  return { ...DEFAULT_ENABLED_MODULES, ...(TENANT_ENABLED_MODULES[key] || {}) };
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
  if (!preset?.employeePins && !preset?.meisterPins) {
    console.log(`[skip] terminalCredentials — kein PIN-Preset für ${tenantId}`);
    return;
  }
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

function haccpDeviceDocId(name) {
  return String(name || 'geraet')
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || `geraet-${Date.now()}`;
}

async function seedTenantRoot(db, tenantId) {
  const key = normalizeTenantKey(tenantId);
  const ref = db.doc(`tenants/${tenantId}`);
  const displayName = TENANT_DISPLAY_NAMES[key] || tenantId;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      console.log(`[skip] tenants/${tenantId} existiert bereits`);
      return;
    }
    tx.create(ref, {
      displayName,
      enabledModules: resolveEnabledModules(tenantId),
      seedVersion: SEED_VERSION,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`[ok] tenants/${tenantId} mit enabledModules angelegt`);
  });
}

async function seedHaccpDevices(db, tenantId, { includeFlyPrevention = true } = {}) {
  const collectionPath = `tenants/${tenantId}/haccp_geraete`;
  const existing = await db.collection(collectionPath).limit(1).get();
  if (!existing.empty) {
    console.log(`[skip] haccp_geraete existieren bereits: ${collectionPath}`);
    return;
  }

  const devices = [
    ...DEFAULT_HACCP_DEVICES,
    ...(includeFlyPrevention ? FLY_PREVENTION_HACCP_DEVICES : []),
  ];
  const batch = db.batch();
  devices.forEach((device) => {
    const docId = haccpDeviceDocId(device.name);
    const ref = db.doc(`${collectionPath}/${docId}`);
    batch.set(ref, {
      ...device,
      tenantId,
      seedVersion: SEED_VERSION,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'seed-tenant-bootstrap',
    });
  });
  await batch.commit();
  console.log(`[ok] ${devices.length} HACCP-Geräte angelegt für ${tenantId}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.tenant) {
    console.error('Bitte --tenant=<id> angeben (z. B. torfabrik oder StevesHof_Hauptbetrieb).');
    process.exitCode = 1;
    return;
  }
  if (!args.team && !args.credentials && !args.haccp && !args.tenantRoot) {
    console.error('Bitte mindestens --team, --credentials, --haccp, --tenant-root oder --all wählen.');
    process.exitCode = 1;
    return;
  }

  const preset = resolvePreset(args.tenant);
  const hasEnabledModules = Boolean(TENANT_ENABLED_MODULES[normalizeTenantKey(args.tenant)]);
  if (!preset && !hasEnabledModules) {
    console.error(`Kein Preset für Mandant "${args.tenant}". Unterstützt: torfabrik, StevesHof_Hauptbetrieb, whitelabel_test, AP23.`);
    process.exitCode = 1;
    return;
  }

  if (!admin.apps.length) {
    admin.initializeApp({ projectId: args.project });
  }

  const db = admin.firestore();
  console.log(`Projekt: ${args.project}`);
  console.log(`Mandant: ${args.tenant}`);

  if (args.tenantRoot) {
    await seedTenantRoot(db, args.tenant);
  }
  if (args.team && preset) {
    await seedTeamDashboard(db, args.tenant, preset);
  }
  if (args.credentials && preset) {
    await seedTerminalCredentials(db, args.tenant, preset);
  }
  if (args.haccp) {
    await seedHaccpDevices(db, args.tenant, { includeFlyPrevention: true });
  }

  console.log('Bootstrap abgeschlossen.');
}

main().catch((err) => {
  console.error('Bootstrap fehlgeschlagen:', err);
  process.exitCode = 1;
});
