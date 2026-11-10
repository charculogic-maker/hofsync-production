/**
 * Standard-Branchen-Presets für neue Mandanten (HACCP + Avery 3475 + Meister-Rezepte).
 * Gespiegelt in functions/tenantPresets.js — bei Änderungen beide Dateien anpassen.
 */

/** @typedef {{
 *   name: string,
 *   bereich: string,
 *   type: 'manual_temp',
 *   tempMin: number,
 *   tempMax: number,
 *   unit: string,
 *   activeDays: null,
 *   sortOrder: number,
 *   isActive: boolean,
 *   protokollTyp: string,
 *   geraeteTyp: string,
 *   sollMin: number,
 *   sollMax: number,
 *   einheit: string,
 *   intervall: string,
 *   aktiv: boolean,
 * }} StandardHaccpDevice */

/** @type {ReadonlyArray<StandardHaccpDevice>} */
export const STANDARD_HACCP_DEVICES = Object.freeze([
  Object.freeze({
    name: 'Kühlhaus Fleisch / Frische',
    bereich: 'Küche/Lager',
    type: 'manual_temp',
    tempMin: 0,
    tempMax: 2,
    unit: '°C',
    activeDays: null,
    sortOrder: 10,
    isActive: true,
    protokollTyp: 'temperatur',
    geraeteTyp: 'kuehlung',
    sollMin: 0,
    sollMax: 2,
    einheit: '°C',
    intervall: 'taeglich',
    aktiv: true,
  }),
  Object.freeze({
    name: 'Verkaufstheke / Kühltheke',
    bereich: 'Verkauf',
    type: 'manual_temp',
    tempMin: 2,
    tempMax: 4,
    unit: '°C',
    activeDays: null,
    sortOrder: 20,
    isActive: true,
    protokollTyp: 'temperatur',
    geraeteTyp: 'kuehlung',
    sollMin: 2,
    sollMax: 4,
    einheit: '°C',
    intervall: 'taeglich',
    aktiv: true,
  }),
  Object.freeze({
    name: 'Tiefkühllager (TK)',
    bereich: 'Lager',
    type: 'manual_temp',
    tempMin: -24,
    tempMax: -18,
    unit: '°C',
    activeDays: null,
    sortOrder: 30,
    isActive: true,
    protokollTyp: 'temperatur',
    geraeteTyp: 'tk',
    sollMin: -24,
    sollMax: -18,
    einheit: '°C',
    intervall: 'taeglich',
    aktiv: true,
  }),
]);

/** Avery 3475 — 3×8 auf A4, 70×36 mm. */
export const STANDARD_PRINTER_SETTINGS = Object.freeze({
  labelType: 'avery_3475',
  format: 'A4',
  orientation: 'portrait',
  columns: 3,
  rows: 8,
  labelWidthMm: 70,
  labelHeightMm: 36,
  marginTopMm: 4.5,
  marginBottomMm: 4.5,
  marginLeftMm: 0,
  marginRightMm: 0,
  scalePercent: 100,
});

const RECIPE_CATEGORY_LABELS = Object.freeze({
  bruehwurst: 'Brühwurst',
  kochwurst: 'Kochwurst',
  frische: 'Frischeware',
});

/**
 * 7 DLS-/Meister-Starterrezepte (neutrale Sortierungen S I–S VII / R I–R V).
 * Für metzgerei_pro-Neuanlage und Showcase-Seed.
 * @type {ReadonlyArray<Record<string, unknown>>}
 */
export const MEISTER_STARTER_RECIPES = Object.freeze([
  Object.freeze({
    id: 'rezept_feine_schinkenwurst',
    name: 'Feine Schinkenwurst / Lyoner (DLS)',
    category: 'bruehwurst',
    targetBatchKg: 30,
    beffeTargetPct: 11.0,
    beffeActualPct: 12.8,
    meat: Object.freeze([
      Object.freeze({ cut: 'S II', kg: 15.0 }),
      Object.freeze({ cut: 'S IV', kg: 7.5 }),
    ]),
    waterIceKg: 7.5,
    haccp: Object.freeze({ cutterEndTempMax: 12.0, coreTempTarget: 72.0, brewTemp: 75.0 }),
  }),
  Object.freeze({
    id: 'rezept_rostbratwurst_grob',
    name: 'Rostbratwurst grob',
    category: 'bruehwurst',
    targetBatchKg: 20,
    beffeTargetPct: 9.0,
    beffeActualPct: 10.5,
    meat: Object.freeze([
      Object.freeze({ cut: 'S II', kg: 10.0 }),
      Object.freeze({ cut: 'S IV', kg: 6.0 }),
    ]),
    waterIceKg: 4.0,
    haccp: Object.freeze({ wolfMm: 4, coreTempTarget: 72.0, brewTemp: 75.0 }),
  }),
  Object.freeze({
    id: 'rezept_muenchner_weisswurst',
    name: 'Münchner Weißwurst',
    category: 'bruehwurst',
    targetBatchKg: 25,
    beffeTargetPct: 10.0,
    beffeActualPct: 11.2,
    meat: Object.freeze([
      Object.freeze({ cut: 'R II', kg: 10.0 }),
      Object.freeze({ cut: 'S IV', kg: 7.5 }),
      Object.freeze({ cut: 'Schwarten', kg: 2.5 }),
    ]),
    waterIceKg: 5.0,
    haccp: Object.freeze({
      cutterEndTempMax: 12.0,
      coreTempTarget: 72.0,
      brewTemp: 75.0,
      note: 'Kochsalz (kein NPS!)',
    }),
  }),
  Object.freeze({
    id: 'rezept_bierwurst_dls',
    name: 'Bierwurst nach DLS (Spitzenqualität)',
    category: 'bruehwurst',
    targetBatchKg: 30,
    beffeTargetPct: 12.0,
    beffeActualPct: 13.5,
    meat: Object.freeze([
      Object.freeze({ cut: 'S II (Brät)', kg: 7.0 }),
      Object.freeze({ cut: 'S I (Einlage)', kg: 12.0 }),
      Object.freeze({ cut: 'R II (Einlage)', kg: 5.0 }),
      Object.freeze({ cut: 'Speck', kg: 3.0 }),
    ]),
    waterIceKg: 3.0,
    haccp: Object.freeze({
      kaliberMm: 90,
      cutterEndTempMax: 12.0,
      coreTempTarget: 72.0,
      brewTemp: 75.0,
    }),
  }),
  Object.freeze({
    id: 'rezept_leberwurst_delikatess',
    name: 'Hausmacher Delikatess-Leberwurst',
    category: 'kochwurst',
    targetBatchKg: 25,
    beffeTargetPct: 9.0,
    beffeActualPct: 10.2,
    meat: Object.freeze([
      Object.freeze({ cut: 'Schweineleber', kg: 6.25 }),
      Object.freeze({ cut: 'Bauch gegart', kg: 11.25 }),
    ]),
    waterIceKg: 7.5,
    waterIceLabel: 'Kesselbrühe',
    haccp: Object.freeze({ emulsionTempMax: 46.0, coreTempTarget: 72.0, brewTemp: 80.0 }),
  }),
  Object.freeze({
    id: 'rezept_rotwurst_thueringer',
    name: 'Hausmacher Rotwurst Thüringer Art',
    category: 'kochwurst',
    targetBatchKg: 25,
    beffeTargetPct: 8.5,
    beffeActualPct: 9.8,
    meat: Object.freeze([
      Object.freeze({ cut: 'Blut', kg: 6.0 }),
      Object.freeze({ cut: 'Speck gegart', kg: 11.0 }),
      Object.freeze({ cut: 'Schwarten gegart', kg: 5.0 }),
    ]),
    waterIceKg: 3.0,
    waterIceLabel: 'Brühe',
    haccp: Object.freeze({ mixTemp: 40.0, coreTempTarget: 75.0, brewTemp: 85.0 }),
  }),
  Object.freeze({
    id: 'rezept_rinder_hackfleisch',
    name: 'Rinder-Hackfleisch & Burger',
    category: 'frische',
    targetBatchKg: 20,
    fatMaxPct: 20.0,
    meat: Object.freeze([
      Object.freeze({ cut: 'R II Magerfleisch', kg: 14.0 }),
      Object.freeze({ cut: 'R IV Rindfett', kg: 6.0 }),
    ]),
    waterIceKg: 0,
    haccp: Object.freeze({ wolfMm: 3, coolingTempMax: 4.0 }),
  }),
]);

/**
 * @param {Record<string, unknown>} recipe
 * @param {string} tenantId
 * @param {{ createdAt?: unknown, seedTag?: string, seedVersion?: number|string }} [meta]
 * @returns {{ id: string, data: Record<string, unknown> }}
 */
export function buildMeisterStarterRecipeDoc(recipe, tenantId, meta = {}) {
  const id = String(recipe.id || '').trim();
  const chargeKg = Number(recipe.targetBatchKg) || 0;
  const meat = Array.isArray(recipe.meat) ? recipe.meat : [];
  const waterIceKg = Number(recipe.waterIceKg) || 0;
  const waterIceLabel = String(recipe.waterIceLabel || 'Eisschüttung').trim() || 'Eisschüttung';
  const haccp = recipe.haccp && typeof recipe.haccp === 'object' ? recipe.haccp : {};

  /** @type {Array<{ name: string, kg: number, typ: string }>} */
  const materials = meat.map((row) => ({
    name: String(row.cut || '').trim(),
    kg: Number(row.kg) || 0,
    typ: 'base',
  }));
  if (waterIceKg > 0) {
    materials.push({ name: waterIceLabel, kg: waterIceKg, typ: 'spice' });
  }

  const ingredients = materials.map((row) => ({
    name: row.name,
    kg: row.kg,
    pct: chargeKg > 0 ? Number(((row.kg / chargeKg) * 100).toFixed(2)) : 0,
    typ: row.typ,
    allergen: false,
    hinweis: '',
  }));

  const categoryKey = String(recipe.category || '').trim();
  const kat = RECIPE_CATEGORY_LABELS[categoryKey] || categoryKey || 'Rezept';
  const beffeSoll = recipe.beffeTargetPct != null ? Number(recipe.beffeTargetPct) : null;
  const beffeIst = recipe.beffeActualPct != null ? Number(recipe.beffeActualPct) : null;
  const fatMaxPct = recipe.fatMaxPct != null ? Number(recipe.fatMaxPct) : null;

  /** @type {Record<string, unknown>} */
  const kpis = {
    ...(beffeSoll != null ? { beffeSoll, beffe: beffeIst ?? beffeSoll } : {}),
    ...(beffeIst != null ? { beffeIst } : {}),
    ...(beffeSoll != null && beffeIst != null
      ? { beffeLabel: `≥ ${beffeSoll.toFixed(1).replace('.', ',')} % BEFFE (Ist ${beffeIst.toFixed(1).replace('.', ',')} %)` }
      : {}),
    ...(fatMaxPct != null ? { fatMaxPct, fatMaxLabel: `max. ${fatMaxPct.toFixed(0)} % Fett` } : {}),
    ...haccp,
  };

  /** @type {Record<string, unknown>} */
  const data = {
    id,
    firestoreId: id,
    name: String(recipe.name || id).trim(),
    kat,
    category: categoryKey,
    produktgattung: kat,
    basis_g: chargeKg > 0 ? `${chargeKg.toFixed(3).replace('.', ',')}0` : '',
    standardChargeKg: chargeKg,
    chargeKg,
    targetBatchKg: chargeKg,
    chargePresetsKg: chargeKg >= 30 ? [10, 20, 30] : chargeKg >= 20 ? [10, 15, chargeKg] : [5, 10, chargeKg],
    ingredients,
    material: materials,
    meat: meat.map((row) => ({ cut: String(row.cut || '').trim(), kg: Number(row.kg) || 0 })),
    waterIceKg,
    waterIceLabel: waterIceKg > 0 ? waterIceLabel : '',
    ...(beffeSoll != null ? { beffeTargetPct: beffeSoll } : {}),
    ...(beffeIst != null ? { beffeActualPct: beffeIst } : {}),
    ...(fatMaxPct != null ? { fatMaxPct } : {}),
    haccp: { ...haccp },
    kpis,
    ...(haccp.cutterEndTempMax != null ? { kutterEndTempMax: Number(haccp.cutterEndTempMax) } : {}),
    ...(haccp.coreTempTarget != null ? { kernTempTarget: Number(haccp.coreTempTarget) } : {}),
    tipp: String(haccp.note || '').trim()
      || (beffeSoll != null
        ? `Starterrezept DLS · BEFFE ≥ ${String(beffeSoll).replace('.', ',')} %.`
        : 'Meister-Starterrezept mit neutralen Fleischsortierungen.'),
    hinweis: 'Neutrale Sortierungen (S I–S VII / R I–R V) · Mandanten-Grundbestand.',
    auditStatus: 'verified',
    starterPack: true,
    tenantId: String(tenantId || '').trim(),
    source: String(meta.seedTag || 'meister-starter-recipes'),
    seedTag: String(meta.seedTag || 'meister-starter-recipes'),
    seedVersion: meta.seedVersion != null ? meta.seedVersion : 1,
  };
  if (meta.createdAt !== undefined) data.createdAt = meta.createdAt;
  if (meta.updatedAt !== undefined) data.updatedAt = meta.updatedAt;

  return { id, data };
}

/**
 * @param {string} tenantId
 * @param {{ createdAt?: unknown, updatedAt?: unknown, seedTag?: string, seedVersion?: number|string }} [meta]
 * @returns {Array<{ id: string, data: Record<string, unknown> }>}
 */
export function buildMeisterStarterRecipeDocs(tenantId, meta = {}) {
  return MEISTER_STARTER_RECIPES.map((recipe) => buildMeisterStarterRecipeDoc(recipe, tenantId, meta));
}

/**
 * Doc-ID aus Gerätenamen (ASCII, wie functions/tenantPresets.presetDeviceDocId).
 * @param {string} name
 * @returns {string}
 */
export function presetDeviceDocId(name) {
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

/**
 * @param {string} tenantId
 * @param {unknown} [createdAt]
 * @returns {Array<{ id: string, data: Record<string, unknown> }>}
 */
export function buildStandardHaccpDeviceDocs(tenantId, createdAt) {
  const id = String(tenantId || '').trim();
  return STANDARD_HACCP_DEVICES.map((device) => {
    const docId = presetDeviceDocId(device.name);
    /** @type {Record<string, unknown>} */
    const data = {
      ...device,
      id: docId,
      tenantId: id,
    };
    if (createdAt !== undefined) {
      data.createdAt = createdAt;
    }
    return { id: docId, data };
  });
}

/**
 * @param {string} tenantId
 * @param {{ updatedBy?: string, updatedAt?: unknown, createdAt?: unknown }} [meta]
 * @returns {Record<string, unknown>}
 */
export function buildStandardPrinterSettings(tenantId, meta = {}) {
  /** @type {Record<string, unknown>} */
  const payload = {
    ...STANDARD_PRINTER_SETTINGS,
    tenantId: String(tenantId || '').trim(),
  };
  if (meta.updatedBy !== undefined) payload.updatedBy = meta.updatedBy;
  if (meta.updatedAt !== undefined) payload.updatedAt = meta.updatedAt;
  if (meta.createdAt !== undefined) payload.createdAt = meta.createdAt;
  return payload;
}

/**
 * Idempotent: nur schreiben wenn haccp_geraete / printer / Starter-Rezepte fehlen.
 * Schützt StevesHof und alle Mandanten mit bestehenden Geräten/Rezepten.
 *
 * @param {{
 *   db: FirebaseFirestore,
 *   tenantId: string,
 *   updatedBy?: string,
 *   seedDevices?: boolean,
 *   seedPrinter?: boolean,
 *   seedRecipes?: boolean,
 * }} options
 * @returns {Promise<{
 *   devicesSeeded: boolean,
 *   printerSeeded: boolean,
 *   recipesSeeded: boolean,
 *   skippedDevices: boolean,
 *   skippedPrinter: boolean,
 *   skippedRecipes: boolean,
 * }>}
 */
export async function ensureTenantBranchPresets({
  db,
  tenantId,
  updatedBy = 'tenant-presets',
  seedDevices = true,
  seedPrinter = true,
  seedRecipes = false,
}) {
  const id = String(tenantId || '').trim();
  if (!db || !id) {
    throw new Error('Mandant oder Datenbank fehlt.');
  }

  const stamp = typeof firebase !== 'undefined' && firebase.firestore?.FieldValue?.serverTimestamp
    ? firebase.firestore.FieldValue.serverTimestamp()
    : new Date().toISOString();

  let skippedDevices = !seedDevices;
  let skippedPrinter = !seedPrinter;
  let skippedRecipes = !seedRecipes;
  let devicesSeeded = false;
  let printerSeeded = false;
  let recipesSeeded = false;

  const batch = db.batch();
  let ops = 0;

  if (seedDevices) {
    const devicesSnap = await db.collection('tenants').doc(id)
      .collection('haccp_geraete').limit(1).get();
    if (!devicesSnap.empty) {
      skippedDevices = true;
    } else {
      buildStandardHaccpDeviceDocs(id, stamp).forEach(({ id: docId, data }) => {
        batch.set(db.collection('tenants').doc(id).collection('haccp_geraete').doc(docId), data);
        ops += 1;
      });
      devicesSeeded = true;
      skippedDevices = false;
    }
  }

  if (seedPrinter) {
    const printerRef = db.collection('tenants').doc(id).collection('settings').doc('printer');
    const printerSnap = await printerRef.get();
    if (printerSnap.exists) {
      skippedPrinter = true;
    } else {
      batch.set(printerRef, buildStandardPrinterSettings(id, {
        updatedBy,
        updatedAt: stamp,
        createdAt: stamp,
      }));
      ops += 1;
      printerSeeded = true;
      skippedPrinter = false;
    }
  }

  if (seedRecipes) {
    const recipesSnap = await db.collection('tenants').doc(id)
      .collection('rezepte').limit(1).get();
    if (!recipesSnap.empty) {
      skippedRecipes = true;
    } else {
      buildMeisterStarterRecipeDocs(id, {
        createdAt: stamp,
        updatedAt: stamp,
        seedTag: 'meister-starter-recipes',
        seedVersion: 1,
      }).forEach(({ id: docId, data }) => {
        batch.set(db.collection('tenants').doc(id).collection('rezepte').doc(docId), {
          ...data,
          updatedBy,
        });
        ops += 1;
      });
      recipesSeeded = true;
      skippedRecipes = false;
    }
  }

  if (ops > 0) {
    await batch.commit();
  }

  return {
    devicesSeeded,
    printerSeeded,
    recipesSeeded,
    skippedDevices,
    skippedPrinter,
    skippedRecipes,
  };
}
