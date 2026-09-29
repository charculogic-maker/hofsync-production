import { formatIsoToGerman } from './date-input.js';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;
const DELIVERY_BOOKING_SOURCE = 'wareneingang-lieferschein';

function startOfDayIso(date = new Date()) {
  const probe = new Date(date);
  if (Number.isNaN(probe.getTime())) return '';
  probe.setHours(0, 0, 0, 0);
  const year = probe.getFullYear();
  const month = String(probe.getMonth() + 1).padStart(2, '0');
  const day = String(probe.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function diffInDays(fromIso, toIso) {
  if (!fromIso || !toIso) return null;
  const from = new Date(`${fromIso}T00:00:00`);
  const to = new Date(`${toIso}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

export function articleDocId(name) {
  const slug = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
  return slug || 'artikel';
}

export function toMhdKategorie(kategorie, artikel) {
  const text = `${kategorie || ''} ${artikel || ''}`.toLowerCase();
  if (/gem(ü|ue)se|salat|kr(ä|ae)uter|obst|frucht|beere|frische/.test(text)) return '🍎 Frische';
  if (/molkerei|milch|joghurt|jogurt|k(ä|ae)se|quark|sahne|butter|mopro|frischk/.test(text)) return '🥛MoPro';
  if (/tk|tiefk(ü|ue)hl|gefrier/.test(text)) return '🧊 TK';
  if (/getr(ä|ae)nk/.test(text)) return '🍺 Getränke';
  if (/gew(ü|ue)rz/.test(text)) return '🌿 Gewürze';
  if (/aufschnitt|salami|schinken|wurst|mettwurst|leberwurst/.test(text)) return '🥓 Aufschnitt';
  if (/k(ü|ue)hl/.test(text)) return '🥗 Kühlware';
  return '📦 Trockenware';
}

function safeBatchId(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function quantityValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function buildMhdData(row, {
  tenantId,
  author,
  nowIso,
  lieferungId,
  docId,
}) {
  const mhdIso = ISO_DATE_RE.test(String(row.mhdIso || '')) ? String(row.mhdIso).slice(0, 10) : '';
  const tage = mhdIso ? diffInDays(startOfDayIso(), mhdIso) : null;
  const kategorie = toMhdKategorie(row.kategorie, row.artikel);
  const menge = quantityValue(row.menge);

  return {
    id: docId,
    postenId: docId,
    produkt: row.artikel,
    name: row.artikel,
    marke: '',
    brand: '',
    mhd: mhdIso,
    mhdDate: mhdIso,
    mhdText: Number.isFinite(tage) ? `${tage} Resttage` : 'Wareneingang',
    date: mhdIso ? formatIsoToGerman(mhdIso) : new Date(nowIso).toLocaleDateString('de-DE'),
    tage,
    resttage: tage,
    status: 'aktiv',
    qty: menge,
    menge,
    eingangMenge: menge,
    kategorie,
    soldOut: false,
    source: DELIVERY_BOOKING_SOURCE,
    postentyp: 'wareneingang',
    wareneingangAt: nowIso,
    erfassungsDatum: nowIso,
    scannedBy: author,
    tenantId,
    lieferungId,
    updatedAt: nowIso,
    createdAt: nowIso,
  };
}

function buildInventoryData(row, {
  tenantId,
  author,
  nowIso,
  lieferungId,
}) {
  return {
    artikel: row.artikel,
    menge: quantityValue(row.menge),
    kategorie: toMhdKategorie(row.kategorie, row.artikel),
    tenantId,
    source: DELIVERY_BOOKING_SOURCE,
    batchId: lieferungId,
    createdBy: author,
    createdAt: nowIso,
  };
}

export function buildDeliveryBookingWrites(rows, {
  tenantId,
  author = 'Team',
  nowIso = new Date().toISOString(),
  lieferungId = '',
} = {}) {
  const cleanTenant = String(tenantId || '').trim();
  if (!cleanTenant) {
    throw new Error('Mandant fehlt: Lieferschein-Buchung ist gesperrt.');
  }

  const validRows = (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      artikel: String(row?.artikel || '').trim(),
      menge: quantityValue(row?.menge),
      kategorie: String(row?.kategorie || '').trim(),
      mhdIso: String(row?.mhdIso || '').trim(),
    }))
    .filter((row) => row.artikel);

  const cleanBatchId = safeBatchId(lieferungId)
    || `ls-${safeBatchId(nowIso) || Date.now()}`;

  return validRows.flatMap((row, index) => {
    const rowNo = String(index + 1).padStart(3, '0');
    const rowSlug = articleDocId(row.artikel);
    const baseId = `${cleanBatchId}-${rowNo}-${rowSlug}`.slice(0, 150);
    const mhdDocId = `${baseId}-mhd`;
    const inventoryDocId = `${baseId}-inventory`;
    const context = {
      tenantId: cleanTenant,
      author,
      nowIso,
      lieferungId: cleanBatchId,
    };

    return [
      {
        collectionPath: 'mhd_liste',
        docId: mhdDocId,
        op: 'set',
        onlineData: buildMhdData(row, { ...context, docId: mhdDocId }),
        queueData: buildMhdData(row, { ...context, docId: mhdDocId }),
      },
      {
        collectionPath: 'inventory',
        docId: inventoryDocId,
        op: 'set',
        onlineData: buildInventoryData(row, context),
        queueData: buildInventoryData(row, context),
      },
    ];
  });
}
