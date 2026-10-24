/**
 * Reine Aggregations- und Preis-Logik für Sammel-Zuschnittliste & Packtisch.
 * Kein DOM – testbar ohne Firebase.
 */

export const ORDER_STATUS_LABELS = Object.freeze({
  open: 'Eingegangen',
  pending: 'Eingegangen',
  eingegangen: 'Eingegangen',
  in_progress: 'In Bearbeitung',
  ready: 'Abholbereit',
  picked_up: 'Abgeholt',
  cancelled: 'Storniert',
});

/** Status, die noch in Zuschnitt / Packtisch aktiv sind */
export const ACTIVE_ORDER_STATUSES = Object.freeze(
  new Set(['open', 'pending', 'eingegangen', 'in_progress', 'ready']),
);

/** Status für Zuschnittliste (noch nicht abholbereit / abgeholt) */
export const CUTLIST_ORDER_STATUSES = Object.freeze(
  new Set(['open', 'pending', 'eingegangen', 'in_progress']),
);

export const STATUS_PIPELINE = Object.freeze([
  'open',
  'in_progress',
  'ready',
  'picked_up',
]);

const HACKFLEISCH_PACK_CUTS = new Set(['beutel-500', 'beutel-1000']);
const HACKFLEISCH_LOSE_CUTS = new Set(['gross', 'lose', 'vb']);

function parseQuantityValue(value) {
  const normalized = String(value ?? '')
    .trim()
    .replace(',', '.')
    .match(/-?\d+(?:\.\d+)?/);
  if (!normalized) return 0;
  const parsed = Number(normalized[0]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseMoneyValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? '')
    .trim()
    .replace(/\./g, '')
    .replace(',', '.')
    .match(/-?\d+(?:\.\d+)?/);
  if (!normalized) return 0;
  const parsed = Number(normalized[0]);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toEpochMs(value) {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date ? date.getTime() : 0;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  return 0;
}

export function isoDayFromValue(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const ts = toEpochMs(value);
  if (!ts) return '';
  const date = new Date(ts);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayIsoLocal(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** ISO-Tag um N Tage verschieben (lokal, mittags gegen DST-Drift). */
export function addDaysIso(isoDay, deltaDays = 0) {
  const base = String(isoDay || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) return '';
  const [y, m, d] = base.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  date.setDate(date.getDate() + Number(deltaDays || 0));
  return todayIsoLocal(date);
}

export function startOfMonthIso(isoDay) {
  const base = String(isoDay || todayIsoLocal()).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) return '';
  return `${base.slice(0, 8)}01`;
}

export function endOfMonthIso(isoDay) {
  const start = startOfMonthIso(isoDay);
  if (!start) return '';
  const [y, m] = start.split('-').map(Number);
  const last = new Date(y, m, 0, 12, 0, 0, 0);
  return todayIsoLocal(last);
}

/**
 * Abholfenster für Packtisch/Mail: „ab“ statt „um“.
 * @param {string|Date|object} readyAt
 * @returns {string}
 */
export function formatPickupReadyLabel(readyAt) {
  if (!readyAt) return '–';
  let date = null;
  if (typeof readyAt?.toDate === 'function') {
    date = readyAt.toDate();
  } else if (readyAt instanceof Date) {
    date = readyAt;
  } else {
    const parsed = Date.parse(readyAt);
    if (Number.isFinite(parsed)) date = new Date(parsed);
  }
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return String(readyAt);
  }
  const weekday = date.toLocaleDateString('de-DE', { weekday: 'short' });
  const dayMonth = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  const time = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${weekday}, ${dayMonth} ab ${time} Uhr`;
}

/**
 * Zählt aktive Bestellungen je Abholtag (für Packtisch-Kalender).
 * @param {object[]} orders
 * @param {{ statuses?: Set<string> }} [opts]
 * @returns {Map<string, number>}
 */
export function countOrdersByPickupDay(orders = [], opts = {}) {
  const statuses = opts.statuses || ACTIVE_ORDER_STATUSES;
  const counts = new Map();
  (Array.isArray(orders) ? orders : []).forEach((order) => {
    if (!statuses.has(orderStatus(order))) return;
    const day = orderPickupDayIso(order);
    if (!day) return;
    counts.set(day, (counts.get(day) || 0) + 1);
  });
  return counts;
}

/**
 * Kalenderzellen für Zwei-Wochen- oder Monatsübersicht.
 * @param {'2weeks'|'month'} mode
 * @param {string} [anchorIso] – Starttag (2 Wochen) bzw. beliebiger Tag im Monat
 * @param {Date} [now]
 * @returns {{ iso: string, inMonth: boolean, isToday: boolean }[]}
 */
export function buildPacktischCalendarDays(mode = '2weeks', anchorIso = '', now = new Date()) {
  const today = todayIsoLocal(now);
  const anchor = String(anchorIso || today).slice(0, 10);

  if (mode === 'month') {
    const monthStart = startOfMonthIso(anchor);
    const monthEnd = endOfMonthIso(anchor);
    const [y, m, d] = monthStart.split('-').map(Number);
    const first = new Date(y, m - 1, d, 12, 0, 0, 0);
    // Montag als Wochenstart (DE)
    const weekdayMon0 = (first.getDay() + 6) % 7;
    const gridStart = addDaysIso(monthStart, -weekdayMon0);
    const cells = [];
    for (let i = 0; i < 42; i += 1) {
      const iso = addDaysIso(gridStart, i);
      cells.push({
        iso,
        inMonth: iso >= monthStart && iso <= monthEnd,
        isToday: iso === today,
      });
      if (iso >= monthEnd && (i + 1) % 7 === 0 && i >= 27) break;
    }
    return cells;
  }

  const start = /^\d{4}-\d{2}-\d{2}$/.test(anchor) ? anchor : today;
  return Array.from({ length: 14 }, (_, i) => {
    const iso = addDaysIso(start, i);
    return { iso, inMonth: true, isToday: iso === today };
  });
}

/** Nächster Wochentag (0=So … 6=Sa). Wenn heute der Tag ist → heute. */
export function nextWeekdayIso(weekday, now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const current = d.getDay();
  let delta = (weekday - current + 7) % 7;
  d.setDate(d.getDate() + delta);
  return todayIsoLocal(d);
}

export function orderPickupDayIso(order) {
  return isoDayFromValue(order?.pickupDate)
    || isoDayFromValue(order?.readyAt)
    || '';
}

export function orderStatus(order) {
  return String(order?.status || 'open').trim() || 'open';
}

export function orderRefLabel(order) {
  const raw = String(order?.ref || order?.orderNumber || order?.orderRef || '').trim();
  if (raw) return raw.startsWith('#') ? raw : `#${raw}`;
  const id = String(order?.id || '').trim();
  if (!id) return '#SH-––––';
  const short = id.replace(/-/g, '').slice(0, 4).toUpperCase();
  return `#SH-${short}`;
}

export function orderPickupChannel(order) {
  const channel = String(order?.channel || order?.pickupChannel || '').toLowerCase();
  if (channel === 'sb' || channel === 'sb-kuehlschrank' || channel === 'kühlschrank') {
    return 'sb';
  }
  if (channel === 'counter' || channel === 'theke' || channel === 'bedientheke') {
    return 'counter';
  }
  const slot = String(order?.pickupSlot?.label || order?.pickupSlot?.id || order?.pickupPlace || '').toLowerCase();
  if (/(sb|kühlschrank|kuehlschrank)/.test(slot)) return 'sb';
  if (/(theke|bedien)/.test(slot)) return 'counter';
  return channel || 'counter';
}

export function orderPickupChannelLabel(order) {
  return orderPickupChannel(order) === 'sb' ? 'SB-Kühlschrank' : 'Theke';
}

export function orderPickupSlotLabel(order) {
  const slot = order?.pickupSlot;
  if (slot && typeof slot === 'object') {
    return String(slot.label || slot.id || '').trim();
  }
  if (typeof slot === 'string' && slot.trim()) return slot.trim();
  const ready = String(order?.readyAt || '');
  const timeMatch = ready.match(/T(\d{2}:\d{2})/);
  return timeMatch ? timeMatch[1] : '';
}

/**
 * Normalisiert Portal- und manuelle Bestellpositionen auf ein gemeinsames Schema.
 * @param {object} item
 * @returns {NormalizedOrderItem}
 */
export function normalizeOrderItem(item = {}) {
  const product = String(item.product || item.name || item.produkt || '').trim();
  const productId = String(item.productId || item.artikelId || item.artNr || '').trim();
  const cutId = String(item.cutId || '').trim();
  const cutLabel = String(
    item.cutLabel
    || item.width
    || (cutId ? cutId : '')
    || ''
  ).trim();
  const stateId = String(item.stateId || item.productState || '').trim().toLowerCase()
    || (/\btk\b|tiefkühl|tiefgekühlt/i.test([item.stateLabel, item.lineNotes, item.note, item.summary].filter(Boolean).join(' '))
      ? 'tk'
      : 'frisch');
  const vacuumId = String(item.vacuumId || '').trim();
  const vacuumLabel = String(item.vacuumLabel || '').trim();
  const note = String(item.lineNotes || item.note || item.notes || '').trim();
  const summary = String(item.summary || '').trim();
  const unitRaw = String(item.unit || '').trim();
  const pricePerKg = parseMoneyValue(
    item.pricePerKg ?? item.kgPrice ?? item.kiloPrice ?? item.unitPrice ?? 0,
  );

  let weightKg = Number(item.weightKg);
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    const fromWeightField = parseQuantityValue(item.weight);
    if (fromWeightField > 0 && /kg/i.test(String(item.weight || ''))) {
      weightKg = fromWeightField;
    } else if (fromWeightField > 0 && /g\b/i.test(String(item.weight || '')) && !/kg/i.test(String(item.weight || ''))) {
      weightKg = fromWeightField / 1000;
    } else {
      weightKg = 0;
    }
  }

  let pieces = Number(item.pieces);
  if (!Number.isFinite(pieces) || pieces < 0) pieces = 0;

  const qty = parseQuantityValue(item.quantity);
  let unit = unitRaw;
  if (!unit) {
    if (weightKg > 0 && pieces <= 0) unit = 'kg';
    else if (pieces > 0) unit = 'Stück';
    else if (qty > 0) unit = 'Stück';
    else unit = '';
  }

  if (pieces <= 0 && /stück|stk|piece/i.test(unit) && qty > 0) {
    pieces = qty;
  }
  if (weightKg <= 0 && /kg/i.test(unit) && qty > 0) {
    weightKg = qty;
  }

  const packGrams = Number(item.packGrams) > 0 ? Number(item.packGrams) : 0;
  const actualWeightGrams = Number(item.actualWeightGrams);
  const hasActualWeight = Number.isFinite(actualWeightGrams) && actualWeightGrams > 0;

  return {
    product,
    productId,
    cutId,
    cutLabel: cutLabel || cutId || 'Standard',
    stateId: stateId === 'tk' ? 'tk' : 'frisch',
    isTk: stateId === 'tk',
    vacuumId,
    vacuumLabel,
    note,
    summary,
    unit,
    pieces,
    weightKg,
    packGrams,
    quantity: qty,
    pricePerKg,
    actualWeightGrams: hasActualWeight ? actualWeightGrams : null,
    estimatedPrice: parseMoneyValue(item.estimatedPrice || item.lineTotal || 0),
    raw: item,
  };
}

export function isHackfleischItem(item) {
  const n = normalizeOrderItem(item);
  if (/^gal-hack$/i.test(n.productId) || n.productId === '503' || n.productId === '5031' || n.productId === '5033') {
    return true;
  }
  return /hackfleisch/i.test(n.product);
}

export function isRouladenItem(item) {
  const n = normalizeOrderItem(item);
  if (/roulade/i.test(n.productId) || /roulade/i.test(n.product)) return true;
  return false;
}

export function isSteakOrPieceCutItem(item) {
  const n = normalizeOrderItem(item);
  if (isHackfleischItem(n) || isRouladenItem(n)) return false;
  if (n.pieces > 0) return true;
  if (/stück|stk|piece/i.test(n.unit)) return true;
  if (/(steak|tournedo|kotelett|schnitzel|filet-steak)/i.test(n.product)) return true;
  return Boolean(n.cutId && !/beutel|gross|am-stueck|ganz|halb/i.test(n.cutId));
}

export function hackfleischPackKind(item) {
  const n = normalizeOrderItem(item);
  const cut = n.cutId.toLowerCase();
  if (HACKFLEISCH_PACK_CUTS.has(cut) || n.packGrams > 0 || /beutel|packung|frischpack/i.test(`${n.cutLabel} ${n.summary}`)) {
    return 'frischpackung';
  }
  if (HACKFLEISCH_LOSE_CUTS.has(cut) || /lose|vb|vakuumbeutel|groß|gross/i.test(`${n.cutLabel} ${n.summary}`)) {
    return 'lose';
  }
  // Default: ab 1,5 kg eher lose/VB, darunter Frischpackung
  return n.weightKg >= 1.5 ? 'lose' : 'frischpackung';
}

export function cutDisplayLabel(item) {
  const n = normalizeOrderItem(item);
  if (n.cutLabel && n.cutLabel !== n.cutId) return n.cutLabel;
  const id = n.cutId;
  const known = {
    'stufe-45': 'Stufe 4,5',
    dicker: 'Dicker geschnitten',
    klassisch: 'Klassisch',
    '4cm': 'Extra dick ca. 4 cm',
    'extra-dick': 'Extra dick ca. 4 cm',
    'am-stueck': 'Am Stück',
    'beutel-500': '500 g Beutel',
    'beutel-1000': '1 kg Beutel',
    gross: 'Groß / lose (VB)',
  };
  if (known[id]) return known[id];
  return n.cutLabel || 'Standard';
}

/**
 * Aggregiert alle Positionen aktiver Bestellungen eines Abholtages.
 * @param {object[]} orders
 * @param {string} dayIso YYYY-MM-DD
 */
export function generateZuschnittAggregation(orders = [], dayIso = '') {
  const day = dayIso || todayIsoLocal();
  const included = [];
  const hackfleisch = {
    frischpackungKg: 0,
    loseKg: 0,
    tkPortions: 0,
    lines: 0,
  };
  /** @type {Map<string, { label: string, pieces: number, tkPieces: number, orderCount: number }>} */
  const steaksByCut = new Map();
  /** @type {Map<string, { label: string, pieces: number, tkPieces: number, orderCount: number }>} */
  const rouladenByCut = new Map();
  /** @type {Map<string, { product: string, label: string, pieces: number, kg: number, tkPieces: number, orderCount: number }>} */
  const otherByKey = new Map();
  let tkPortionTotal = 0;
  let orderCount = 0;

  (Array.isArray(orders) ? orders : []).forEach((order) => {
    const status = orderStatus(order);
    if (!CUTLIST_ORDER_STATUSES.has(status)) return;
    if (orderPickupDayIso(order) !== day) return;
    orderCount += 1;
    included.push(order.id);

    (Array.isArray(order.items) ? order.items : []).forEach((raw) => {
      const item = normalizeOrderItem(raw);
      if (!item.product || item.product === 'Siehe Bestellzettel (Scan)') return;
      if (item.isTk) tkPortionTotal += 1;

      if (isHackfleischItem(item)) {
        const kg = item.weightKg > 0 ? item.weightKg : (item.quantity > 0 ? item.quantity : 0);
        const kind = hackfleischPackKind(item);
        if (kind === 'lose') hackfleisch.loseKg += kg;
        else hackfleisch.frischpackungKg += kg;
        if (item.isTk) hackfleisch.tkPortions += 1;
        hackfleisch.lines += 1;
        return;
      }

      if (isRouladenItem(item)) {
        const label = cutDisplayLabel(item);
        const key = label.toLowerCase();
        const entry = rouladenByCut.get(key) || {
          label,
          pieces: 0,
          tkPieces: 0,
          orderCount: 0,
        };
        entry.pieces += item.pieces > 0 ? item.pieces : (item.quantity || 1);
        if (item.isTk) entry.tkPieces += item.pieces > 0 ? item.pieces : 1;
        entry.orderCount += 1;
        rouladenByCut.set(key, entry);
        return;
      }

      if (isSteakOrPieceCutItem(item) || item.pieces > 0) {
        const label = cutDisplayLabel(item);
        const key = `${item.product.toLowerCase()}|${label.toLowerCase()}`;
        const entry = steaksByCut.get(key) || {
          product: item.product,
          label,
          pieces: 0,
          tkPieces: 0,
          orderCount: 0,
        };
        entry.pieces += item.pieces > 0 ? item.pieces : (item.quantity || 1);
        if (item.isTk) entry.tkPieces += item.pieces > 0 ? item.pieces : 1;
        entry.orderCount += 1;
        steaksByCut.set(key, entry);
        return;
      }

      const label = cutDisplayLabel(item);
      const key = `${item.product.toLowerCase()}|${label.toLowerCase()}|${item.unit}`;
      const entry = otherByKey.get(key) || {
        product: item.product,
        label,
        pieces: 0,
        kg: 0,
        tkPieces: 0,
        orderCount: 0,
        unit: item.unit,
      };
      if (/kg/i.test(item.unit) || item.weightKg > 0) {
        entry.kg += item.weightKg > 0 ? item.weightKg : item.quantity;
      } else {
        entry.pieces += item.pieces > 0 ? item.pieces : (item.quantity || 1);
      }
      if (item.isTk) entry.tkPieces += 1;
      entry.orderCount += 1;
      otherByKey.set(key, entry);
    });
  });

  const round3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

  return {
    dayIso: day,
    orderCount,
    includedOrderIds: included,
    hackfleisch: {
      frischpackungKg: round3(hackfleisch.frischpackungKg),
      loseKg: round3(hackfleisch.loseKg),
      totalKg: round3(hackfleisch.frischpackungKg + hackfleisch.loseKg),
      tkPortions: hackfleisch.tkPortions,
      lines: hackfleisch.lines,
    },
    steaks: Array.from(steaksByCut.values()).sort((a, b) => (
      a.product.localeCompare(b.product, 'de') || a.label.localeCompare(b.label, 'de')
    )),
    rouladen: Array.from(rouladenByCut.values()).sort((a, b) => a.label.localeCompare(b.label, 'de')),
    other: Array.from(otherByKey.values()).sort((a, b) => a.product.localeCompare(b.product, 'de')),
    tkPortionTotal,
  };
}

/**
 * Endpreis einer Position aus Waagengewicht (Gramm) und Kilopreis.
 * @param {object} item
 * @param {number|null} [actualWeightGrams]
 */
export function calculateLinePriceFromWeight(item, actualWeightGrams = null) {
  const n = normalizeOrderItem(item);
  const grams = actualWeightGrams != null && Number.isFinite(Number(actualWeightGrams))
    ? Number(actualWeightGrams)
    : n.actualWeightGrams;
  const kg = Number.isFinite(grams) && grams > 0
    ? grams / 1000
    : (n.weightKg > 0 ? n.weightKg : n.quantity);
  const pricePerKg = n.pricePerKg;
  const lineTotal = Math.round((kg * pricePerKg) * 100) / 100;
  return {
    weightKg: Math.round(kg * 1000) / 1000,
    weightGrams: Math.round(kg * 1000),
    pricePerKg,
    lineTotal,
    hasActualWeight: Number.isFinite(grams) && grams > 0,
  };
}

/**
 * Sortiert Packtisch-Aufträge: Abholtag → Kanal (Theke vor SB) → Zeitfenster.
 */
export function sortOrdersForPacktisch(orders = []) {
  const channelRank = (order) => (orderPickupChannel(order) === 'counter' ? 0 : 1);
  return [...orders].sort((a, b) => {
    const dayA = orderPickupDayIso(a) || '9999-99-99';
    const dayB = orderPickupDayIso(b) || '9999-99-99';
    if (dayA !== dayB) return dayA.localeCompare(dayB);
    const ch = channelRank(a) - channelRank(b);
    if (ch !== 0) return ch;
    const slotA = orderPickupSlotLabel(a) || String(a.readyAt || '');
    const slotB = orderPickupSlotLabel(b) || String(b.readyAt || '');
    if (slotA !== slotB) return slotA.localeCompare(slotB, 'de');
    return String(a.customerName || a.customer?.name || '')
      .localeCompare(String(b.customerName || b.customer?.name || ''), 'de');
  });
}

export function nextStatusInPipeline(current) {
  const status = orderStatus({ status: current });
  const idx = STATUS_PIPELINE.indexOf(status === 'pending' || status === 'eingegangen' ? 'open' : status);
  if (idx < 0 || idx >= STATUS_PIPELINE.length - 1) return null;
  return STATUS_PIPELINE[idx + 1];
}

export function customerDisplayName(order) {
  return String(
    order?.customerName
    || order?.customer?.name
    || order?.name
    || 'Kunde'
  ).trim() || 'Kunde';
}

export function customerPhone(order) {
  return String(
    order?.callbackPhone
    || order?.customer?.phone
    || order?.phone
    || ''
  ).trim();
}

export function butcherNotes(order) {
  const parts = [
    order?.additionalWishes,
    order?.butcherNotes,
    order?.notes,
    order?.customerNote,
  ].map((v) => String(v || '').trim()).filter(Boolean);
  const fromItems = (Array.isArray(order?.items) ? order.items : [])
    .map((item) => {
      const n = normalizeOrderItem(item);
      return [n.note, n.vacuumLabel || (n.vacuumId && n.vacuumId !== 'ohne' ? n.vacuumId : '')]
        .filter(Boolean)
        .join(' · ');
    })
    .filter(Boolean);
  return [...parts, ...fromItems].filter(Boolean).join(' · ');
}

export function vacuumWishesSummary(order) {
  const labels = (Array.isArray(order?.items) ? order.items : [])
    .map((item) => {
      const n = normalizeOrderItem(item);
      if (!n.vacuumId || n.vacuumId === 'ohne') return '';
      if (n.vacuumLabel) return `${n.product}: ${n.vacuumLabel}`;
      const map = {
        einzeln: 'Einzeln vakuumiert',
        zusammen: 'Zusammen vakuumiert',
        vakuum: 'Vakuumiert',
        beutel: 'Im Beutel gekühlt',
      };
      return `${n.product}: ${map[n.vacuumId] || n.vacuumId}`;
    })
    .filter(Boolean);
  return labels;
}

/** Packtisch-Dashboard-Buckets für offene Arbeit */
export const PACKTISCH_DASHBOARD_BUCKETS = Object.freeze([
  'due',
  'open',
  'in_progress',
  'ready',
]);

export const PACKTISCH_DASHBOARD_LABELS = Object.freeze({
  due: 'Fällig / heute',
  open: 'Offen (später)',
  in_progress: 'In Bearbeitung',
  ready: 'Abholbereit',
});

export const PAST_ORDER_STATUSES = Object.freeze(new Set(['picked_up', 'cancelled']));

/**
 * Ordnet eine aktive Bestellung einem Dashboard-Bucket zu.
 * @returns {'due'|'open'|'in_progress'|'ready'|null}
 */
export function classifyPacktischBucket(order, todayIso = todayIsoLocal()) {
  const status = orderStatus(order);
  if (status === 'ready') return 'ready';
  if (status === 'in_progress') return 'in_progress';
  if (status === 'open' || status === 'pending' || status === 'eingegangen') {
    const day = orderPickupDayIso(order);
    if (day && day <= todayIso) return 'due';
    return 'open';
  }
  return null;
}

/**
 * Zählt Packtisch-Dashboard-Buckets.
 * @returns {{ due: number, open: number, in_progress: number, ready: number, total: number }}
 */
export function summarizePacktischDashboard(orders = [], todayIso = todayIsoLocal()) {
  const counts = {
    due: 0,
    open: 0,
    in_progress: 0,
    ready: 0,
    total: 0,
  };
  (Array.isArray(orders) ? orders : []).forEach((order) => {
    const bucket = classifyPacktischBucket(order, todayIso);
    if (!bucket) return;
    counts[bucket] += 1;
    counts.total += 1;
  });
  return counts;
}

/**
 * Normalisiert Wunsch-Kanäle für die Kunden-Bestätigung (E-Mail / SMS / WhatsApp).
 * Ohne gesetztes Objekt: Legacy-Default E-Mail + SMS an (wie bisheriger Auto-Versand).
 * @param {object|null|undefined} raw
 * @returns {{ email: boolean, sms: boolean, whatsapp: boolean }}
 */
export function normalizeNotifyChannels(raw) {
  if (!raw || typeof raw !== 'object') {
    return { email: true, sms: true, whatsapp: false };
  }
  const hasKey = ('email' in raw) || ('sms' in raw) || ('whatsapp' in raw);
  if (!hasKey) {
    return { email: true, sms: true, whatsapp: false };
  }
  return {
    email: raw.email !== false && raw.email !== 0 && raw.email !== '0',
    sms: raw.sms === true || raw.sms === 1 || raw.sms === '1',
    whatsapp: raw.whatsapp === true || raw.whatsapp === 1 || raw.whatsapp === '1',
  };
}

/**
 * Ob für diesen Auftrag überhaupt eine Ready-Benachrichtigung gewünscht ist.
 */
export function wantsAnyReadyNotify(order = {}) {
  if (order.skipNotify === true || order.notifySkipped === true) return false;
  const channels = normalizeNotifyChannels(order.notifyChannels);
  return Boolean(channels.email || channels.sms || channels.whatsapp);
}

/**
 * Ob ein einzelner Kanal für diesen Auftrag aktiv ist.
 * @param {object} order
 * @param {'email'|'sms'|'whatsapp'} channel
 */
export function wantsNotifyChannel(order = {}, channel = 'email') {
  if (!wantsAnyReadyNotify(order)) return false;
  const channels = normalizeNotifyChannels(order.notifyChannels);
  if (channel === 'email') return channels.email;
  if (channel === 'sms') return channels.sms;
  if (channel === 'whatsapp') return channels.whatsapp;
  return false;
}

function weekdayFromIsoDay(isoDay) {
  const parsed = Date.parse(`${String(isoDay || '').slice(0, 10)}T12:00:00`);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).getDay(); // 0=So … 6=Sa
}

/**
 * Vergangene Bestellungen im Zeitraum (Abholtag bzw. Abhol-/Abschlusszeit).
 * @param {object[]} orders
 * @param {{ rangeDays?: number, weekday?: number|null, now?: Date, statuses?: Set<string> }} [opts]
 *   weekday: 0=So … 6=Sa; null = alle
 */
export function filterPastOrders(orders = [], opts = {}) {
  const now = opts.now instanceof Date ? opts.now : new Date();
  const today = todayIsoLocal(now);
  const rangeDays = Number.isFinite(Number(opts.rangeDays)) ? Math.max(1, Number(opts.rangeDays)) : 30;
  const fromIso = addDaysIso(today, -(rangeDays - 1));
  const statuses = opts.statuses || PAST_ORDER_STATUSES;
  const weekday = opts.weekday == null || opts.weekday === '' ? null : Number(opts.weekday);

  return (Array.isArray(orders) ? orders : []).filter((order) => {
    if (!statuses.has(orderStatus(order))) return false;
    const day = orderPickupDayIso(order)
      || isoDayFromValue(order.pickedUpAt)
      || isoDayFromValue(order.readyMarkedAt)
      || isoDayFromValue(order.acceptedAt)
      || isoDayFromValue(order.createdAt);
    if (!day || day < fromIso || day > today) return false;
    if (weekday != null && Number.isFinite(weekday)) {
      const orderWeekday = weekdayFromIsoDay(day);
      if (orderWeekday !== weekday) return false;
    }
    return true;
  });
}

/**
 * Produkt-Häufigkeit aus vergangenen Bestellungen (für Packtisch-Auswertung).
 * @returns {{ product: string, orderCount: number, lineCount: number, quantitySum: number }[]}
 */
export function aggregatePastOrderProducts(orders = [], opts = {}) {
  const past = filterPastOrders(orders, opts);
  const byProduct = new Map();

  past.forEach((order) => {
    const seenInOrder = new Set();
    (Array.isArray(order.items) ? order.items : []).forEach((raw) => {
      const n = normalizeOrderItem(raw);
      const product = n.product || 'Unbekannt';
      const key = product.toLocaleLowerCase('de');
      let entry = byProduct.get(key);
      if (!entry) {
        entry = {
          product,
          orderCount: 0,
          lineCount: 0,
          quantitySum: 0,
        };
        byProduct.set(key, entry);
      }
      entry.lineCount += 1;
      const qty = n.pieces > 0
        ? n.pieces
        : (n.weightKg > 0 ? n.weightKg : (n.quantity > 0 ? n.quantity : 1));
      entry.quantitySum += qty;
      if (!seenInOrder.has(key)) {
        seenInOrder.add(key);
        entry.orderCount += 1;
      }
    });
  });

  return Array.from(byProduct.values())
    .map((entry) => ({
      ...entry,
      quantitySum: Math.round(entry.quantitySum * 1000) / 1000,
    }))
    .sort((a, b) => (
      b.orderCount - a.orderCount
      || b.lineCount - a.lineCount
      || a.product.localeCompare(b.product, 'de')
    ));
}
