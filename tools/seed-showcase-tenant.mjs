/**
 * Showcase-Mandant test_auto_seed mit meisterlichem Demo-Datenbestand füllen.
 *
 *   node tools/seed-showcase-tenant.mjs
 *   node tools/seed-showcase-tenant.mjs --dry-run
 *   node tools/seed-showcase-tenant.mjs --project=hofsync-production
 *
 * Credentials: GOOGLE_APPLICATION_CREDENTIALS oder GOOGLE_APPLICATION_CREDENTIALS_JSON.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import admin from 'firebase-admin';

const TENANT_ID = 'test_auto_seed';
const DISPLAY_NAME = 'Fleischerei & Hofladen Musterbetrieb';
const SEED_VERSION = 1;
const SEED_TAG = 'seed-showcase-tenant';

const ENABLED_MODULES = Object.freeze({
  start: true,
  team: true,
  mhd: true,
  receiving: true,
  wareneingang: true,
  kitchen: true,
  kueche: true,
  wurstkueche: true,
  haccp: true,
  knowledge: true,
  wissen: true,
  buero: true,
  chargenDoku: true,
  chargen: true,
  cutting: true,
  averyLabels: true,
  avery: true,
  zerlegung: true,
  retterBox: true,
  orders: true,
});

function parseArgs(argv) {
  const args = {
    project: process.env.FIREBASE_PROJECT || process.env.GCLOUD_PROJECT || 'hofsync-production',
    tenant: TENANT_ID,
    dryRun: false,
  };
  argv.forEach((arg) => {
    if (arg === '--dry-run') args.dryRun = true;
    if (arg.startsWith('--project=')) args.project = arg.slice('--project='.length).trim() || args.project;
    if (arg.startsWith('--tenant=')) args.tenant = arg.slice('--tenant='.length).trim() || TENANT_ID;
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
    const tmp = '/tmp/hofsync-sa-showcase.json';
    writeFileSync(tmp, JSON.stringify(sa));
    process.env.GOOGLE_APPLICATION_CREDENTIALS = tmp;
    return admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: sa.project_id || projectId,
    });
  }

  return admin.initializeApp({ projectId });
}

function isoDatePlusDays(daysFromToday) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysFromToday);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysAgoIso(daysAgo, hour = 9, minute = 15) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

function dateOnlyDaysAgo(daysAgo) {
  return isoDatePlusDays(-daysAgo);
}

function slugId(value) {
  return String(value || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || `item-${Date.now()}`;
}

function buildMhdItems(tenantId) {
  const items = [
    {
      id: 'showcase-bratwurst-500g',
      name: 'Frische grobe Bratwurst (500g)',
      kategorie: '🍎 Frische',
      resttage: 4,
      status: 'ok',
      qty: 12,
      ean: '4000001001001',
    },
    {
      id: 'showcase-rinder-rouladen',
      name: 'Rinder-Rouladen aus der Oberschale',
      kategorie: '🍎 Frische',
      resttage: 1,
      status: 'rabatt',
      qty: 6,
      ean: '4000001001002',
      rabattiert: true,
    },
    {
      id: 'showcase-hackfleisch-bio',
      name: 'Hackfleisch gemischt (Bio-Rind & Schwein)',
      kategorie: '🍎 Frische',
      resttage: 0,
      status: 'kueche',
      qty: 4,
      ean: '4000001001003',
      kuecheAngefragt: true,
    },
    {
      id: 'showcase-leberwurst-glas',
      name: 'Hausmacher Leberwurst im Glas',
      kategorie: '📦 Trockenware',
      resttage: 45,
      status: 'ok',
      qty: 18,
      ean: '4000001001004',
    },
  ];

  return items.map((item) => {
    const mhd = isoDatePlusDays(item.resttage);
    const mhdDate = new Date(`${mhd}T00:00:00`);
    return {
      id: item.id,
      data: {
        id: item.id,
        postenId: item.id,
        name: item.name,
        produkt: item.name,
        articleName: item.name,
        ean: item.ean,
        barcode: item.ean,
        kategorie: item.kategorie,
        category: item.kategorie,
        mhd,
        mhdDate: mhd,
        date: mhdDate.toLocaleDateString('de-DE'),
        mhdTimestamp: mhdDate,
        tage: item.resttage,
        resttage: item.resttage,
        mhdText: `${item.resttage} Resttage`,
        status: item.status,
        qty: item.qty,
        menge: item.qty,
        eingangMenge: item.qty,
        soldOut: false,
        active: true,
        archived: false,
        rabattiert: item.rabattiert === true,
        kuecheAngefragt: item.kuecheAngefragt === true,
        source: SEED_TAG,
        postentyp: 'showcase',
        tenantId,
        seedVersion: SEED_VERSION,
        seedTag: SEED_TAG,
        wareneingangAt: daysAgoIso(2, 8, 30),
        scannedBy: 'Paddy (Meister)',
      },
    };
  });
}

function buildShowcaseRecipe(tenantId) {
  const chargeKg = 30;
  const materials = [
    { name: 'S II Magerfleisch', kg: 15, typ: 'base' },
    { name: 'S IV Speck', kg: 7.5, typ: 'base' },
    { name: 'Eisschüttung', kg: 7.5, typ: 'spice' },
  ];
  const ingredients = materials.map((row) => ({
    name: row.name,
    kg: row.kg,
    pct: Number(((row.kg / chargeKg) * 100).toFixed(2)),
    typ: row.typ,
    allergen: false,
    hinweis: '',
  }));

  return {
    id: 'feine-schinkenwurst-dls',
    data: {
      id: 'feine-schinkenwurst-dls',
      firestoreId: 'feine-schinkenwurst-dls',
      name: 'Feine Schinkenwurst nach DLS (Spitzenqualität)',
      kat: 'Brühwurst',
      produktgattung: 'Schinkenwurst / Aufschnittwurst',
      leitsatzNr: '2.222',
      leitsatz: '2.222 (Feine Schinkenwurst)',
      basis_g: '30.000,00',
      standardChargeKg: chargeKg,
      chargeKg,
      chargePresetsKg: [10, 20, 30],
      ingredients,
      material: materials,
      kpis: {
        beffe: 12.8,
        beffeIst: 12.8,
        beffeSoll: 11.0,
        beffeLabel: '≥ 11,0 % BEFFE (Ist 12,8 %)',
        kutterEndTempMax: 12.0,
        coreTempTarget: 72,
        coreTempLabel: 'Kerntemperatur 72 °C',
      },
      kutterEndTempMax: 12.0,
      kernTempTarget: 72,
      tipp: 'Showcase-Rezept: Kutterendtemperatur max. 12,0 °C, Garprozess auf Kerntemperatur 72 °C.',
      hinweis: 'BEFFE-Vorgabe ≥ 11,0 % · Ist 12,8 % · Charge 30 kg.',
      anweisung_A: 'S II und S IV kalt vorbereiten, Eisschüttung bereitstellen.',
      anweisung_B: 'Magerfleisch mit Salz und Schüttung fein kuttern; Speck kalt einarbeiten. Kutterendtemperatur max. 12,0 °C.',
      anweisung_C: 'Brät blasenfrei füllen und portionieren.',
      anweisung_D: 'Garprozess bis Kerntemperatur 72 °C, danach zügig rückkühlen.',
      auditStatus: 'verified',
      tenantId,
      seedVersion: SEED_VERSION,
      seedTag: SEED_TAG,
      source: SEED_TAG,
    },
  };
}

function buildHaccpDevices(tenantId) {
  const devices = [
    {
      id: 'showcase-kuehlhaus',
      name: 'Kühlhaus',
      bereich: 'Lager',
      tempMin: 0,
      tempMax: 4,
      geraeteTyp: 'kuehlung',
    },
    {
      id: 'showcase-frischetheke',
      name: 'Frischetheke',
      bereich: 'Verkauf',
      tempMin: 0,
      tempMax: 4,
      geraeteTyp: 'kuehlung',
    },
    {
      id: 'showcase-tk',
      name: 'TK',
      bereich: 'Lager',
      tempMin: -24,
      tempMax: -18,
      geraeteTyp: 'tk',
    },
  ];

  return devices.map((device, index) => ({
    id: device.id,
    data: {
      id: device.id,
      name: device.name,
      bereich: device.bereich,
      type: 'manual_temp',
      tempMin: device.tempMin,
      tempMax: device.tempMax,
      unit: '°C',
      sollMin: device.tempMin,
      sollMax: device.tempMax,
      einheit: '°C',
      protokollTyp: 'temperatur',
      geraeteTyp: device.geraeteTyp,
      intervall: 'taeglich',
      aktiv: true,
      isActive: true,
      sortOrder: (index + 1) * 10,
      tenantId,
      seedVersion: SEED_VERSION,
      seedTag: SEED_TAG,
      updatedBy: SEED_TAG,
    },
  }));
}

function buildHaccpLogs(tenantId) {
  const rows = [
    {
      id: 'showcase-log-kuehlhaus',
      daysAgo: 2,
      deviceId: 'showcase-kuehlhaus',
      deviceName: 'Kühlhaus',
      bereich: 'Lager',
      wert: 1.4,
      hour: 7,
      minute: 40,
    },
    {
      id: 'showcase-log-frischetheke',
      daysAgo: 1,
      deviceId: 'showcase-frischetheke',
      deviceName: 'Frischetheke',
      bereich: 'Verkauf',
      wert: 2.8,
      hour: 8,
      minute: 10,
    },
    {
      id: 'showcase-log-tk',
      daysAgo: 0,
      deviceId: 'showcase-tk',
      deviceName: 'TK',
      bereich: 'Lager',
      wert: -19.2,
      hour: 9,
      minute: 5,
    },
  ];

  return rows.map((row) => {
    const createdAt = daysAgoIso(row.daysAgo, row.hour, row.minute);
    const datum = dateOnlyDaysAgo(row.daysAgo);
    return {
      id: row.id,
      data: {
        id: row.id,
        logTyp: 'temperatur',
        type: 'temperature',
        deviceId: row.deviceId,
        deviceName: row.deviceName,
        bereich: row.bereich,
        doneBy: 'Paddy (Meister)',
        user: 'Paddy (Meister)',
        wert: row.wert,
        value: row.wert,
        einheit: '°C',
        unit: '°C',
        status: 'ok',
        massnahme: '',
        tenantId,
        datum,
        createdAt,
        timestamp: createdAt,
        seedVersion: SEED_VERSION,
        seedTag: SEED_TAG,
        source: SEED_TAG,
      },
    };
  });
}

function buildWareneingang(tenantId) {
  const id = 'showcase-we-metzgerei-001';
  const deliveredAt = daysAgoIso(2, 8, 30);
  return {
    id,
    data: {
      id,
      lieferant: 'Muster-Metzgerei Großhandel',
      supplier: 'Muster-Metzgerei Großhandel',
      bereich: 'Metzgerei',
      department: 'kueche',
      status: 'verbucht',
      temperature: 2.1,
      temperatur: 2.1,
      note: 'Showcase-Wareneingang für Demo-Screenshots',
      items: [
        {
          name: 'Frische grobe Bratwurst (500g)',
          qty: 12,
          unit: 'Stk',
          mhd: isoDatePlusDays(4),
          category: '🍎 Frische',
        },
        {
          name: 'Rinder-Rouladen aus der Oberschale',
          qty: 6,
          unit: 'kg',
          mhd: isoDatePlusDays(1),
          category: '🍎 Frische',
        },
      ],
      deliveredAt,
      createdAt: deliveredAt,
      createdBy: 'Paddy (Meister)',
      tenantId,
      seedVersion: SEED_VERSION,
      seedTag: SEED_TAG,
      source: SEED_TAG,
    },
  };
}

async function upsertDocs(db, collectionPath, docs, { dryRun }) {
  if (dryRun) {
    docs.forEach((doc) => {
      console.log(`[dry-run] ${collectionPath}/${doc.id}`);
    });
    return;
  }
  const batch = db.batch();
  const now = admin.firestore.FieldValue.serverTimestamp();
  docs.forEach((doc) => {
    const ref = db.doc(`${collectionPath}/${doc.id}`);
    batch.set(ref, {
      ...doc.data,
      updatedAt: now,
      createdAt: doc.data.createdAt || now,
    }, { merge: true });
  });
  await batch.commit();
  console.log(`[ok] ${docs.length} Docs → ${collectionPath}`);
}

async function upsertTenantRoot(db, tenantId, { dryRun }) {
  const payload = {
    id: tenantId,
    name: DISPLAY_NAME,
    displayName: DISPLAY_NAME,
    status: 'active',
    active: true,
    enabledModules: { ...ENABLED_MODULES },
    modules: { ...ENABLED_MODULES },
    seedVersion: SEED_VERSION,
    seedTag: SEED_TAG,
    showcaseReady: true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (dryRun) {
    console.log('[dry-run] tenants/' + tenantId, JSON.stringify({
      displayName: payload.displayName,
      enabledModules: payload.enabledModules,
    }, null, 2));
    return;
  }
  const ref = db.doc(`tenants/${tenantId}`);
  const snap = await ref.get();
  if (!snap.exists) {
    payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
    payload.tier = 'metzgerei';
  }
  await ref.set(payload, { merge: true });
  console.log(`[ok] tenants/${tenantId} → ${DISPLAY_NAME} (Module aktiv)`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`Projekt: ${args.project}`);
  console.log(`Mandant: ${args.tenant}`);
  console.log(`Modus: ${args.dryRun ? 'dry-run' : 'write'}`);

  initAdmin(args.project);
  const db = admin.firestore();

  const mhdDocs = buildMhdItems(args.tenant);
  const recipe = buildShowcaseRecipe(args.tenant);
  const devices = buildHaccpDevices(args.tenant);
  const logs = buildHaccpLogs(args.tenant);
  const wareneingang = buildWareneingang(args.tenant);

  await upsertTenantRoot(db, args.tenant, args);
  await upsertDocs(db, `tenants/${args.tenant}/mhd_liste`, mhdDocs, args);
  await upsertDocs(db, `tenants/${args.tenant}/rezepte`, [recipe], args);
  await upsertDocs(db, `tenants/${args.tenant}/haccp_geraete`, devices, args);
  await upsertDocs(db, `tenants/${args.tenant}/haccp_logs`, logs, args);
  await upsertDocs(db, `tenants/${args.tenant}/wareneingang_lieferungen`, [wareneingang], args);

  if (!args.dryRun) {
    const verify = {
      tenant: (await db.doc(`tenants/${args.tenant}`).get()).data()?.displayName,
      mhd: (await db.collection(`tenants/${args.tenant}/mhd_liste`).where('seedTag', '==', SEED_TAG).get()).size,
      rezepte: (await db.collection(`tenants/${args.tenant}/rezepte`).where('seedTag', '==', SEED_TAG).get()).size,
      haccpLogs: (await db.collection(`tenants/${args.tenant}/haccp_logs`).where('seedTag', '==', SEED_TAG).get()).size,
      wareneingang: (await db.collection(`tenants/${args.tenant}/wareneingang_lieferungen`).where('seedTag', '==', SEED_TAG).get()).size,
    };
    console.log('[verify]', JSON.stringify(verify, null, 2));
  }

  console.log('[done] Showcase-Seed abgeschlossen.');
}

const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('seed-showcase-tenant.mjs')
  || process.argv[1].includes('seed-showcase-tenant')
);

if (isDirectRun) {
  main().catch((err) => {
    console.error('[seed-showcase-tenant] fehlgeschlagen:', err);
    process.exitCode = 1;
  });
}

export {
  TENANT_ID,
  DISPLAY_NAME,
  ENABLED_MODULES,
  buildMhdItems,
  buildShowcaseRecipe,
  buildHaccpLogs,
  buildWareneingang,
  slugId,
};
