import { formatIsoToGerman } from './date-input.js';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

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
    .slice(0, 120);
  return slug || `artikel-${Date.now()}`;
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

export function createDeliveryParserBatchId(now = Date.now()) {
  const randomPart = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `ls_${Number(now || Date.now()).toString(36)}_${randomPart}`;
}

function normalizeIsoDateOnly(value) {
  const raw = String(value || '').trim();
  return ISO_DATE_RE.test(raw) ? raw.slice(0, 10) : '';
}

export function buildDeliveryParserWriteOps(row, {
  tenantId,
  author = 'Team',
  nowIso = new Date().toISOString(),
  batchId = createDeliveryParserBatchId(),
  index = 0,
  todayIso = startOfDayIso(),
} = {}) {
  const cleanTenant = String(tenantId || '').trim();
  if (!cleanTenant) {
    throw new Error('Mandant fehlt: Lieferschein kann nicht verbucht werden.');
  }
  const artikel = String(row?.artikel || '').trim();
  if (!artikel) {
    throw new Error('Artikel fehlt: Lieferschein-Posten kann nicht verbucht werden.');
  }

  const menge = Number(row?.menge);
  const quantity = Number.isFinite(menge) && menge > 0 ? menge : 1;
  const mhdIso = normalizeIsoDateOnly(row?.mhdIso);
  const mhdKategorie = toMhdKategorie(row?.kategorie, artikel);
  const safeIndex = Number.isInteger(index) && index >= 0 ? index : 0;
  const docSuffix = `${safeIndex}_${articleDocId(artikel)}`;
  const inventoryDocId = `${batchId}_${docSuffix}`;
  const postenId = `${batchId}_mhd_${docSuffix}`;
  const tage = mhdIso ? diffInDays(todayIso, mhdIso) : null;

  const inventoryData = {
    artikel,
    menge: quantity,
    kategorie: mhdKategorie,
    tenantId: cleanTenant,
    source: 'wareneingang-lieferschein',
    batchId,
    createdBy: author,
    createdAt: nowIso,
  };

  const mhdData = {
    id: postenId,
    postenId,
    produkt: artikel,
    name: artikel,
    marke: '',
    brand: '',
    mhd: mhdIso,
    mhdDate: mhdIso,
    mhdText: Number.isFinite(tage) ? `${tage} Resttage` : 'Wareneingang',
    date: mhdIso ? formatIsoToGerman(mhdIso) : new Date(nowIso).toLocaleDateString('de-DE'),
    tage,
    resttage: tage,
    status: 'aktiv',
    qty: quantity,
    menge: quantity,
    eingangMenge: quantity,
    kategorie: mhdKategorie,
    soldOut: false,
    source: 'wareneingang-lieferschein',
    postentyp: 'wareneingang',
    wareneingangAt: nowIso,
    erfassungsDatum: nowIso,
    scannedBy: author,
    tenantId: cleanTenant,
    lieferungId: batchId,
    updatedAt: nowIso,
    createdAt: nowIso,
  };

  return [
    {
      collectionPath: 'inventory',
      docId: inventoryDocId,
      op: 'set',
      onlineData: inventoryData,
      queueData: inventoryData,
    },
    {
      collectionPath: 'mhd_liste',
      docId: postenId,
      op: 'set',
      onlineData: mhdData,
      queueData: mhdData,
    },
  ];
}
