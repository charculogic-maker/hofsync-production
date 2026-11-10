/**
 * Standard-Branchen-Presets für neue Mandanten (HACCP + Avery 3475).
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
 * Idempotent: nur schreiben wenn haccp_geraete leer und/oder settings/printer fehlt.
 * Schützt StevesHof und alle Mandanten mit bestehenden Geräten.
 *
 * @param {{
 *   db: FirebaseFirestore,
 *   tenantId: string,
 *   updatedBy?: string,
 *   seedDevices?: boolean,
 *   seedPrinter?: boolean,
 * }} options
 * @returns {Promise<{ devicesSeeded: boolean, printerSeeded: boolean, skippedDevices: boolean, skippedPrinter: boolean }>}
 */
export async function ensureTenantBranchPresets({
  db,
  tenantId,
  updatedBy = 'tenant-presets',
  seedDevices = true,
  seedPrinter = true,
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
  let devicesSeeded = false;
  let printerSeeded = false;

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

  if (ops > 0) {
    await batch.commit();
  }

  return {
    devicesSeeded,
    printerSeeded,
    skippedDevices,
    skippedPrinter,
  };
}
