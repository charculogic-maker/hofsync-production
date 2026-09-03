/**
 * Warenbewegungs- und MHD-Report (Verwaltung → Protokoll).
 * Reine Aufbereitung — keine Firestore-Pfade hier.
 */

export const MHD_AUDIT_COLLECTION = 'mhd_audit';
export const AUDIT_LOGS_COLLECTION = 'audit_logs';

export const MOVEMENT_ACTION_TYPES = {
  neu: 'neu',
  menge: 'menge',
  abschreiben: 'abschreiben',
  raus: 'raus',
  ok: 'ok',
};

export const MOVEMENT_ACTION_LABELS = {
  neu: 'NEU',
  menge: 'MENGE GEÄNDERT',
  abschreiben: 'ABSCHREIBEN',
  raus: 'RAUS',
  ok: 'OK',
};

export const MOVEMENT_FILTER_OPTIONS = [
  { value: '', label: 'Alle' },
  { value: 'neu', label: 'Neuaufnahme' },
  { value: 'menge', label: 'Mengenänderung' },
  { value: 'abschreiben', label: 'Abschreibung' },
  { value: 'raus', label: 'Ausverkauft' },
];

export const STEVESHOF_SHOP_NAMES = ['Paddy', 'Stephie', 'Bettina', 'Nicole', 'Heiko'];

export function berlinTodayIso(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function berlinAddDaysIso(isoDate, days = 0) {
  const start = berlinDayStartMs(isoDate || berlinTodayIso());
  if (!Number.isFinite(start)) return berlinTodayIso();
  return berlinTodayIso(new Date(start + Number(days) * 24 * 60 * 60 * 1000));
}

export function defaultReportFromIso(now = new Date()) {
  return berlinAddDaysIso(berlinTodayIso(now), -2);
}

export function berlinDayStartMs(isoDate) {
  const iso = String(isoDate || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return NaN;
  let guess = Date.parse(`${iso}T00:00:00Z`);
  for (let i = 0; i < 10; i += 1) {
    const local = new Date(guess).toLocaleString('sv-SE', { timeZone: 'Europe/Berlin' });
    const [day, time] = local.split(' ');
    if (day === iso && String(time || '').startsWith('00:00')) return guess;
    const [hours, minutes] = String(time || '00:00').split(':').map((part) => Number(part) || 0);
    guess -= ((hours * 60 + minutes) * 60 * 1000);
  }
  return Date.parse(`${iso}T00:00:00Z`);
}

export function berlinDayEndMs(isoDate) {
  const start = berlinDayStartMs(isoDate);
  if (!Number.isFinite(start)) return NaN;
  return start + 24 * 60 * 60 * 1000 - 1;
}

export function formatBerlinDay(isoDate) {
  const ms = berlinDayStartMs(isoDate);
  if (!Number.isFinite(ms)) return String(isoDate || '');
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(ms));
}

export function timestampToMs(value) {
  if (value == null || value === '') return NaN;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return berlinDayStartMs(raw);
  const german = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[,\s]+(\d{1,2}):(\d{2}))?/);
  if (german) {
    const iso = `${german[3]}-${german[2].padStart(2, '0')}-${german[1].padStart(2, '0')}`;
    const dayStart = berlinDayStartMs(iso);
    if (!Number.isFinite(dayStart)) return NaN;
    if (german[4] != null) {
      return dayStart + (Number(german[4]) * 60 + Number(german[5] || 0)) * 60 * 1000;
    }
    return dayStart;
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function formatMovementTime(ms) {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '—';
  const day = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
  const time = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `${day}, ${time} Uhr`;
}

export function formatQtyDelta(qtyFrom, qtyTo) {
  const from = Number(qtyFrom);
  const to = Number(qtyTo);
  const a = Number.isFinite(from) ? from : 0;
  const b = Number.isFinite(to) ? to : 0;
  const delta = b - a;
  const signed = delta > 0 ? `+${delta}` : String(delta);
  return `${a} → ${b} (${signed})`;
}

export function movementActionLabel(actionType) {
  return MOVEMENT_ACTION_LABELS[actionType] || String(actionType || '—').toUpperCase();
}

export function inferMovementAction({ mhdActionStatus, soldOut, qtyFrom, qtyTo, isCreate } = {}) {
  if (isCreate) return MOVEMENT_ACTION_TYPES.neu;
  const status = String(mhdActionStatus || '').trim().toLowerCase();
  if (status === 'rausgenommen' || status === 'ausverkauft') return MOVEMENT_ACTION_TYPES.raus;
  if (status === 'tonne' || status === 'abgeschrieben' || status === 'abschreiben') {
    return MOVEMENT_ACTION_TYPES.abschreiben;
  }
  if (status === 'geprueft' || status === 'ok') return MOVEMENT_ACTION_TYPES.ok;
  if (soldOut === true) return MOVEMENT_ACTION_TYPES.raus;
  const from = Number(qtyFrom);
  const to = Number(qtyTo);
  if (Number.isFinite(from) && Number.isFinite(to) && to === 0 && from > 0 && soldOut !== false) {
    return MOVEMENT_ACTION_TYPES.abschreiben;
  }
  if (Number.isFinite(from) && Number.isFinite(to) && from !== to) return MOVEMENT_ACTION_TYPES.menge;
  return MOVEMENT_ACTION_TYPES.menge;
}

export function normalizeActorName(value) {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  const emailLocal = raw.includes('@') ? raw.slice(0, raw.indexOf('@')) : raw;
  const cleaned = emailLocal.replace(/[._]+/g, ' ').trim();
  if (!cleaned) return '—';
  return cleaned.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function buildShopNameOptions(extraNames = []) {
  const names = [...STEVESHOF_SHOP_NAMES];
  extraNames.forEach((name) => {
    const cleaned = String(name || '').trim();
    if (cleaned && !names.some((entry) => entry.toLowerCase() === cleaned.toLowerCase())) {
      names.push(cleaned);
    }
  });
  return names;
}

export function matchesActorFilter(actorName, filterName) {
  const filter = String(filterName || '').trim().toLowerCase();
  if (!filter) return true;
  return String(actorName || '').trim().toLowerCase() === filter;
}

export function filterMovements(rows, { actorName = '', actionType = '' } = {}) {
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (!matchesActorFilter(row.actorName, actorName)) return false;
    if (actionType && row.actionType !== actionType) return false;
    return true;
  });
}

export function csvEscape(value) {
  const raw = String(value ?? '');
  if (/[;"\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

export function movementsToCsv(rows) {
  const header = [
    'Zeitstempel',
    'Mitarbeiter',
    'Artikel',
    'EAN',
    'Aktion',
    'Menge von',
    'Menge nach',
    'Delta',
  ];
  const lines = [header.map(csvEscape).join(';')];
  (rows || []).forEach((row) => {
    const from = Number(row.qtyFrom);
    const to = Number(row.qtyTo);
    const delta = (Number.isFinite(to) ? to : 0) - (Number.isFinite(from) ? from : 0);
    lines.push([
      formatMovementTime(row.atMs),
      row.actorName || '',
      row.articleName || '',
      row.ean || '',
      movementActionLabel(row.actionType),
      Number.isFinite(from) ? from : '',
      Number.isFinite(to) ? to : '',
      delta,
    ].map(csvEscape).join(';'));
  });
  return `\uFEFF${lines.join('\r\n')}`;
}

export function csvFilename(isoDate = berlinTodayIso()) {
  const day = String(isoDate || berlinTodayIso()).slice(0, 10) || berlinTodayIso();
  return `HofSync_Warenbericht_${day}.csv`;
}

export function movementFromAuditDoc(id, data = {}) {
  const atMs = timestampToMs(data.atMs ?? data.createdAt ?? data.updatedAt);
  if (!Number.isFinite(atMs)) return null;
  const actionType = MOVEMENT_ACTION_LABELS[data.actionType]
    ? data.actionType
    : inferMovementAction(data);
  return {
    id: String(id || ''),
    atMs,
    actorName: normalizeActorName(data.actorName || data.scannedBy || data.actor || ''),
    articleName: String(data.articleName || data.name || data.produkt || '').trim() || 'Artikel',
    ean: String(data.ean || data.barcode || '').trim(),
    actionType,
    qtyFrom: data.qtyFrom,
    qtyTo: data.qtyTo ?? data.qty,
    source: String(data.source || 'mhd_audit'),
  };
}

export function movementFromMhdListeDoc(id, data = {}) {
  const atMs = timestampToMs(
    data.lastMhdCheckAt
    || data.wareneingangAt
    || data.updatedAt
    || data.lastCheckedDate
    || data.lastMhdCheckDate
    || data.createdAt,
  );
  if (!Number.isFinite(atMs)) return null;
  const qty = data.qty ?? data.menge;
  const isCreate = Boolean(data.wareneingangAt || data.source === 'wareneingang-app' || data.postentyp === 'wareneingang');
  const actionType = inferMovementAction({
    mhdActionStatus: data.mhdActionStatus,
    soldOut: data.soldOut,
    qtyFrom: isCreate ? 0 : qty,
    qtyTo: qty,
    isCreate: isCreate && !data.soldOut && !data.mhdActionStatus,
  });
  return {
    id: `liste:${id}`,
    atMs,
    actorName: normalizeActorName(data.scannedBy || data.lastCheckedBy || ''),
    articleName: String(data.name || data.produkt || '').trim() || 'Artikel',
    ean: String(data.ean || data.barcode || '').trim(),
    actionType,
    qtyFrom: isCreate ? 0 : qty,
    qtyTo: qty,
    source: 'mhd_liste',
  };
}

function sameMovement(left, right) {
  if (!left || !right) return false;
  if (left.actionType !== right.actionType) return false;
  if (Math.abs(left.atMs - right.atMs) > 2 * 60 * 1000) return false;
  const leftEan = String(left.ean || '').trim();
  const rightEan = String(right.ean || '').trim();
  if (leftEan && rightEan) return leftEan === rightEan;
  return String(left.articleName || '').trim().toLowerCase()
    === String(right.articleName || '').trim().toLowerCase();
}

export function mergeMovementRows(groups) {
  const rows = (groups || []).flat().filter((row) => row && Number.isFinite(row.atMs));
  const auditRows = [];
  const listeRows = [];
  rows.forEach((row) => {
    if (row.source === 'mhd_liste') listeRows.push(row);
    else auditRows.push(row);
  });
  const byId = new Map();
  auditRows.forEach((row) => {
    byId.set(row.id || `audit:${row.ean}|${row.atMs}|${row.actionType}`, row);
  });
  listeRows.forEach((row) => {
    const covered = [...byId.values()].some((existing) => (
      existing.source !== 'mhd_liste' && sameMovement(existing, row)
    ));
    if (!covered) byId.set(row.id || `liste:${row.ean}|${row.atMs}|${row.actionType}`, row);
  });
  return [...byId.values()].sort((left, right) => right.atMs - left.atMs);
}

export function buildMovementRecord({
  tenantId,
  product = {},
  qtyFrom,
  qtyTo,
  actionType,
  actorName,
  atMs = Date.now(),
} = {}) {
  const from = Number.isFinite(Number(qtyFrom)) ? Number(qtyFrom) : 0;
  const to = Number.isFinite(Number(qtyTo)) ? Number(qtyTo) : from;
  const type = actionType || inferMovementAction({
    mhdActionStatus: product.mhdActionStatus,
    soldOut: product.soldOut,
    qtyFrom: from,
    qtyTo: to,
  });
  return {
    tenantId: String(tenantId || '').trim(),
    atMs,
    createdAt: new Date(atMs).toISOString(),
    actorName: normalizeActorName(actorName || product.scannedBy || ''),
    articleName: String(product.name || product.produkt || '').trim() || 'Artikel',
    ean: String(product.ean || product.barcode || '').trim(),
    actionType: type,
    qtyFrom: from,
    qtyTo: to,
    source: 'mhd',
  };
}
