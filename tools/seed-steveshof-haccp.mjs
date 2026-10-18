/**
 * Seed / Upsert der StevesHof HACCP-Messpunkte (Temperatur-Rundgang).
 * Nur Laden & Lager (8 Prüfstellen) — kein Obergeschoss / keine Verbundanlage.
 *
 * Bevorzugt In-App-Seeding im HACCP-Setup (authentifiziertes Client-SDK).
 * Dieses Script bleibt für Admin-SDK-Läufe mit Credentials:
 *   node tools/seed-steveshof-haccp.mjs --dry-run
 *   node tools/seed-steveshof-haccp.mjs --project=hofsync-production
 */
import admin from 'firebase-admin';

const TENANT_ID = 'StevesHof_Hauptbetrieb';
const SEED_VERSION = 3;

/** @type {Array<Record<string, unknown>>} */
export const STEVESHOF_HACCP_DEVICES = [
  {
    name: 'Fleischtheke',
    bereich: 'Verkauf',
    type: 'manual_temp',
    tempMin: 0,
    tempMax: 2,
    unit: '°C',
    activeDays: [4, 5, 6],
    sortOrder: 10,
    isActive: true,
  },
  {
    name: 'Käsetheke (SB)',
    bereich: 'Verkauf',
    type: 'manual_temp',
    tempMin: 2,
    tempMax: 7,
    unit: '°C',
    activeDays: null,
    sortOrder: 20,
    isActive: true,
  },
  {
    name: 'SB-Theke Fleisch & Wurst',
    bereich: 'Verkauf',
    type: 'manual_temp',
    tempMin: 0,
    tempMax: 4,
    unit: '°C',
    activeDays: null,
    sortOrder: 30,
    isActive: true,
  },
  {
    name: 'SB-Kühlschrank Frische & MoPro',
    bereich: 'Verkauf',
    type: 'manual_temp',
    tempMin: 2,
    tempMax: 6,
    unit: '°C',
    activeDays: null,
    sortOrder: 40,
    isActive: true,
  },
  {
    name: 'SB-TK Obst & Eis',
    bereich: 'Verkauf',
    type: 'manual_temp',
    tempMin: -24,
    tempMax: -18,
    unit: '°C',
    activeDays: null,
    sortOrder: 50,
    isActive: true,
  },
  {
    name: 'SB-TK Gemüse',
    bereich: 'Verkauf',
    type: 'manual_temp',
    tempMin: -24,
    tempMax: -18,
    unit: '°C',
    activeDays: null,
    sortOrder: 60,
    isActive: true,
  },
  {
    name: 'SB-TK Fleisch, Pizza & Brot',
    bereich: 'Verkauf',
    type: 'manual_temp',
    tempMin: -24,
    tempMax: -18,
    unit: '°C',
    activeDays: null,
    sortOrder: 70,
    isActive: true,
  },
  {
    name: 'Lager-TK-Truhe Aufbackbrötchen',
    bereich: 'Lager',
    type: 'manual_temp',
    tempMin: -22,
    tempMax: -16,
    unit: '°C',
    activeDays: null,
    sortOrder: 80,
    isActive: true,
  },
];

function parseArgs(argv) {
  const args = {
    project: process.env.FIREBASE_PROJECT || process.env.GCLOUD_PROJECT || 'hofsync-production',
    dryRun: false,
    tenant: TENANT_ID,
  };
  argv.forEach((arg) => {
    if (arg === '--dry-run') args.dryRun = true;
    if (arg.startsWith('--project=')) args.project = arg.slice('--project='.length).trim();
    if (arg.startsWith('--tenant=')) args.tenant = arg.slice('--tenant='.length).trim() || TENANT_ID;
  });
  return args;
}

export function haccpDeviceDocId(name) {
  return String(name || 'geraet')
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || `geraet-${Date.now()}`;
}

export function buildStevesHofHaccpPayload(device, tenantId = TENANT_ID) {
  return {
    id: haccpDeviceDocId(device.name),
    name: device.name,
    bereich: device.bereich,
    type: 'manual_temp',
    tempMin: device.tempMin,
    tempMax: device.tempMax,
    unit: device.unit || '°C',
    activeDays: device.activeDays == null ? null : device.activeDays,
    sortOrder: device.sortOrder,
    isActive: device.isActive !== false,
    protokollTyp: 'temperatur',
    geraeteTyp: Number(device.tempMax) <= -10 ? 'tk' : 'kuehlung',
    sollMin: device.tempMin,
    sollMax: device.tempMax,
    einheit: device.unit || '°C',
    intervall: 'taeglich',
    aktiv: device.isActive !== false,
    tenantId,
    seedVersion: SEED_VERSION,
    updatedBy: 'seed-steveshof-haccp',
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`Projekt: ${args.project}`);
  console.log(`Mandant: ${args.tenant}`);
  console.log(`Geräte: ${STEVESHOF_HACCP_DEVICES.length}`);

  if (args.dryRun) {
    STEVESHOF_HACCP_DEVICES.forEach((device) => {
      const payload = buildStevesHofHaccpPayload(device, args.tenant);
      console.log(`[dry-run] ${payload.id} → ${payload.name} (${payload.bereich}, ${payload.type})`);
    });
    return;
  }

  if (!admin.apps.length) {
    admin.initializeApp({ projectId: args.project });
  }
  const db = admin.firestore();
  const batch = db.batch();
  const now = admin.firestore.FieldValue.serverTimestamp();

  STEVESHOF_HACCP_DEVICES.forEach((device) => {
    const payload = buildStevesHofHaccpPayload(device, args.tenant);
    const ref = db.doc(`tenants/${args.tenant}/haccp_geraete/${payload.id}`);
    batch.set(ref, {
      ...payload,
      updatedAt: now,
      createdAt: now,
    }, { merge: true });
    console.log(`[upsert] ${payload.id}`);
  });

  await batch.commit();
  console.log(`[ok] ${STEVESHOF_HACCP_DEVICES.length} HACCP-Geräte für ${args.tenant} geschrieben.`);
}

const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('seed-steveshof-haccp.mjs')
  || process.argv[1].includes('seed-steveshof-haccp')
);

if (isDirectRun) {
  main().catch((err) => {
    console.error('[seed-steveshof-haccp] fehlgeschlagen:', err);
    process.exitCode = 1;
  });
}
