/**
 * Kundenbestellungen – Annahme, Sammel-Zuschnittliste & Packtisch
 */

import { getTenantCollection } from './tenant-db.js';
import { writeFirestoreDocOrQueue } from './sync.js';
import { getActiveEmployeeName, postTeamboardBulletin } from './teamboard.js';
import { initGermanDateInputs, readGermanDateField, setGermanDateField } from './date-input.js';
import {
  ACTIVE_ORDER_STATUSES,
  CUTLIST_ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  addDaysIso,
  buildPacktischCalendarDays,
  butcherNotes,
  calculateLinePriceFromWeight,
  countOrdersByPickupDay,
  customerDisplayName,
  customerPhone,
  formatPickupReadyLabel,
  generateZuschnittAggregation,
  nextStatusInPipeline,
  nextWeekdayIso,
  normalizeOrderItem,
  orderPickupChannelLabel,
  orderPickupDayIso,
  orderPickupSlotLabel,
  orderRefLabel,
  orderStatus,
  sortOrdersForPacktisch,
  startOfMonthIso,
  todayIsoLocal as packlistTodayIso,
  vacuumWishesSummary,
} from './order-packlist.js';

const OPEN_ORDER_STATUSES = CUTLIST_ORDER_STATUSES;
const PICKLIST_CATEGORY_ORDER = ['Wurstküche', 'Molkereiprodukte', 'Hofladen-Spezialitäten', 'Sonstiges'];
const PRODUCTION_STATIONS = {
  kitchen: {
    category: 'Küche / Gastro',
    title: 'Heute zu kochen (Küche)',
    empty: 'In der Küche ist heute nichts aus offenen Bestellungen zu tun.',
  },
  butchery: {
    category: 'Metzgerei / Produktion',
    title: 'Heute zu zerlegen/packen (Metzgerei)',
    empty: 'In der Metzgerei ist heute nichts aus offenen Bestellungen zu tun.',
  },
};

const orderState = {
  db: null,
  tenantId: '',
  getFirebase: () => null,
  ordersUnsubscribe: null,
  allOrders: [],
  lineCounter: 0,
  pendingSlips: [],
  createInFlight: false,
  statusUpdateInFlight: false,
  statusUpdateOrderIds: new Set(),
  picklistReadyInFlight: false,
  picklistChecked: new Set(),
  productionChecked: new Set(),
  actualQuantityByKey: new Map(),
  /** @type {'aufnahme'|'zuschnitt'|'packtisch'} */
  ordersView: 'packtisch',
  zuschnittDayIso: '',
  expandedPackOrderId: '',
  weighDraftByKey: new Map(),
  weighSaveInFlight: false,
  /** @type {'2weeks'|'month'} */
  calendarMode: '2weeks',
  /** Anker für Zwei-Wochen-Start bzw. Monat */
  calendarAnchorIso: '',
  /** Gewählter Abholtag (ISO) – leer = alle offenen */
  selectedPickupDayIso: '',
  notifyReadyInFlight: false,
  /** @type {{ mode: 'ready'|'notify_again', orderId: string }|null} */
  pendingNotifyAction: null,
  editInFlight: false,
  editingOrderId: '',
};

/** Abgeholt / storniert – Bearbeitung setzt wieder auf in_progress */
const PAST_ORDER_STATUSES = Object.freeze(new Set(['picked_up', 'cancelled']));

const ORDER_ACTION_LOG_LABELS = Object.freeze({
  in_progress: 'In Bearbeitung gesetzt',
  reopen: 'Wieder in Bearbeitung',
  ready: 'Als Abholbereit markiert',
  ready_notify: 'Als Abholbereit markiert · Kunde benachrichtigt',
  ready_no_notify: 'Als Abholbereit markiert · ohne Kunden-Nachricht',
  notify_again: 'Kunde erneut benachrichtigt',
  notify_again_skip: 'Erneute Benachrichtigung übersprungen',
  picked_up: 'Als abgeholt markiert',
  cancelled: 'Storniert',
  edited: 'Bestellung bearbeitet',
  edited_reopen: 'Bestellung bearbeitet · wieder in Bearbeitung',
});

const ACTION_LOG_MAX = 40;

function normalizeNotifyChannels(raw) {
  if (!raw || typeof raw !== 'object') {
    return { email: true, sms: false, whatsapp: false };
  }
  const hasKey = ('email' in raw) || ('sms' in raw) || ('whatsapp' in raw);
  if (!hasKey) {
    return { email: true, sms: false, whatsapp: false };
  }
  return {
    email: raw.email !== false && raw.email !== 0 && raw.email !== '0',
    sms: raw.sms === true || raw.sms === 1 || raw.sms === '1',
    whatsapp: raw.whatsapp === true || raw.whatsapp === 1 || raw.whatsapp === '1',
  };
}

function wantsAnyReadyNotify(order = {}) {
  if (order.skipNotify === true || order.notifySkipped === true) return false;
  const channels = normalizeNotifyChannels(order.notifyChannels);
  return Boolean(channels.email || channels.sms || channels.whatsapp);
}

function buildOrderActionLogEntry(action, employee, detail = '') {
  return {
    action: String(action || '').trim(),
    by: String(employee || '').trim() || 'Unbekannt',
    at: new Date().toISOString(),
    detail: String(detail || '').trim(),
  };
}

function mergeOrderActionLog(existing, entry) {
  const prev = Array.isArray(existing) ? existing.filter((row) => row && typeof row === 'object') : [];
  if (!entry?.action) return prev.slice(-ACTION_LOG_MAX);
  return [...prev, entry].slice(-ACTION_LOG_MAX);
}

function legacyActionLogFromOrder(order) {
  const legacy = [];
  if (!order || typeof order !== 'object') return legacy;
  if (order.inProgressBy || order.inProgressAt) {
    legacy.push({
      action: 'in_progress',
      by: order.inProgressBy || '–',
      at: order.inProgressAt,
    });
  }
  if (order.readyMarkedBy || order.readyMarkedAt) {
    legacy.push({
      action: order.skipNotify || order.notifySkipped ? 'ready_no_notify' : 'ready',
      by: order.readyMarkedBy || '–',
      at: order.readyMarkedAt,
    });
  }
  if (order.readyNotifyBy || order.readyNotifyAt) {
    legacy.push({
      action: 'notify_again',
      by: order.readyNotifyBy || order.readyMarkedBy || '–',
      at: order.readyNotifyAt,
    });
  }
  if (order.pickedUpBy || order.pickedUpAt) {
    legacy.push({
      action: 'picked_up',
      by: order.pickedUpBy || '–',
      at: order.pickedUpAt,
    });
  }
  return legacy;
}

/** Vorhandenes actionLog oder Legacy-Stempel – damit erste Schreibvorgänge nichts verlieren */
function orderActionLogBase(order) {
  const log = Array.isArray(order?.actionLog)
    ? order.actionLog.filter((row) => row && row.action)
    : [];
  return log.length ? log : legacyActionLogFromOrder(order);
}

function formatOrderActionLogLabel(entry = {}) {
  const base = ORDER_ACTION_LOG_LABELS[entry.action] || entry.action || 'Aktion';
  return entry.detail ? `${base} (${entry.detail})` : base;
}

function renderOrderActionLog(order) {
  const rows = orderActionLogBase(order).slice().reverse();
  if (!rows.length) return '';
  return `
    <details class="customer-order-action-log">
      <summary>Protokoll · ${rows.length} Aktion${rows.length === 1 ? '' : 'en'}</summary>
      <ul class="customer-order-action-log-list">
        ${rows.map((row) => {
    const when = formatDateTimeDe(row.at) || '–';
    const who = row.by || '–';
    const what = formatOrderActionLogLabel(row);
    return `<li><strong>${escapeHtml(who)}</strong> · ${escapeHtml(when)} · ${escapeHtml(what)}</li>`;
  }).join('')}
      </ul>
    </details>
  `;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function todayIsoLocal() {
  return packlistTodayIso();
}

function ensureZuschnittDay() {
  if (!orderState.zuschnittDayIso) {
    orderState.zuschnittDayIso = nextWeekdayIso(5); // Freitag als Metzgerei-Default
  }
  return orderState.zuschnittDayIso;
}

function defaultReadyTimeLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 60 - (d.getMinutes() % 15));
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function toEpochMs(value) {
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

function formatDateTimeDe(value) {
  const ts = toEpochMs(value);
  if (!ts) return String(value || '–');
  return new Date(ts).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatReadyAt(readyAt) {
  return formatPickupReadyLabel(readyAt);
}

function ensureCalendarAnchor() {
  if (!orderState.calendarAnchorIso) {
    orderState.calendarAnchorIso = todayIsoLocal();
  }
  return orderState.calendarAnchorIso;
}

function formatCalendarDayHeading(isoDay) {
  const parsed = Date.parse(`${isoDay}T12:00:00`);
  if (!Number.isFinite(parsed)) return isoDay || 'Alle Tage';
  return new Date(parsed).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatCalendarCellLabel(isoDay) {
  const parsed = Date.parse(`${isoDay}T12:00:00`);
  if (!Number.isFinite(parsed)) return isoDay.slice(8, 10);
  return String(new Date(parsed).getDate());
}

function ordersForPacktischList() {
  let open = orderState.allOrders.filter((o) => ACTIVE_ORDER_STATUSES.has(orderStatus(o)));
  if (orderState.selectedPickupDayIso) {
    open = open.filter((o) => orderPickupDayIso(o) === orderState.selectedPickupDayIso);
  }
  return sortOrdersForPacktisch(open);
}

function ordersCollectionRef() {
  if (!orderState.db || !orderState.tenantId) return null;
  try {
    return getTenantCollection('customerOrders');
  } catch {
    return null;
  }
}

function stockCollectionRef() {
  if (!orderState.db || !orderState.tenantId) return null;
  try {
    return getTenantCollection('stammdaten');
  } catch {
    return null;
  }
}

function buildOrderLineRow(lineId) {
  return `
    <div class="order-line-card" data-order-line="${lineId}">
      <div class="order-line-grid">
        <label class="form-label">Artikel</label>
        <input type="text" class="input-text-touch" data-line-product required placeholder="z. B. Rindersteak">
        <label class="form-label">Menge</label>
        <input type="text" class="input-text-touch" data-line-quantity required placeholder="z. B. 2" inputmode="decimal">
        <label class="form-label">Einheit</label>
        <select class="input-text-touch" data-line-unit>
          <option value="kg">kg</option>
          <option value="Stück">Stück</option>
          <option value="Packung">Packung</option>
          <option value="g">g</option>
        </select>
        <label class="form-label">Gewicht (optional)</label>
        <input type="text" class="input-text-touch" data-line-weight placeholder="z. B. 300 g / 1,2 kg">
        <label class="form-label">Breite/Dicke (optional)</label>
        <input type="text" class="input-text-touch" data-line-width placeholder="z. B. 2 cm dünn">
        <label class="form-label">Hinweis Position</label>
        <input type="text" class="input-text-touch" data-line-notes placeholder="z. B. ohne Fett">
      </div>
      <button type="button" class="btn btn-secondary btn-compact order-line-remove" data-remove-line="${lineId}">Position entfernen</button>
    </div>
  `;
}

function ensureDefaultOrderLine() {
  const container = document.getElementById('order-lines-container');
  if (!container || container.children.length > 0) return;
  addOrderLine();
}

function addOrderLine() {
  const container = document.getElementById('order-lines-container');
  if (!container) return;
  orderState.lineCounter += 1;
  const lineId = `line_${orderState.lineCounter}`;
  container.insertAdjacentHTML('beforeend', buildOrderLineRow(lineId));
}

function readOrderLinesFromDom() {
  const cards = document.querySelectorAll('#order-lines-container .order-line-card');
  const items = [];
  cards.forEach((card) => {
    const product = card.querySelector('[data-line-product]')?.value?.trim() || '';
    const quantity = card.querySelector('[data-line-quantity]')?.value?.trim() || '';
    const unit = card.querySelector('[data-line-unit]')?.value?.trim() || '';
    const weight = card.querySelector('[data-line-weight]')?.value?.trim() || '';
    const width = card.querySelector('[data-line-width]')?.value?.trim() || '';
    const lineNotes = card.querySelector('[data-line-notes]')?.value?.trim() || '';
    if (!product && !quantity) return;
    items.push({
      product,
      quantity,
      unit: unit || null,
      weight: weight || null,
      width: width || null,
      lineNotes: lineNotes || null,
    });
  });
  return items;
}

function resetOrderForm() {
  const form = document.getElementById('customer-order-form');
  form?.reset();
  const container = document.getElementById('order-lines-container');
  if (container) container.innerHTML = '';
  orderState.lineCounter = 0;
  orderState.pendingSlips = [];
  renderPendingSlipPreview();
  ensureDefaultOrderLine();
  const readyDate = document.getElementById('order-ready-date');
  const readyTime = document.getElementById('order-ready-time');
  if (readyDate) setGermanDateField(readyDate, todayIsoLocal());
  if (readyTime) readyTime.value = defaultReadyTimeLocal();
}

function setOrderSaveStatus(message = '') {
  const status = document.getElementById('order-save-status');
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('is-busy', Boolean(message));
}

function setOrderSaveBusy(busy, labelWhenBusy = 'Wird gespeichert…') {
  const btn = document.getElementById('order-save-btn')
    || document.querySelector('#customer-order-form button[type="submit"]');
  if (!btn) return;
  if (!btn.dataset.defaultLabel) {
    btn.dataset.defaultLabel = btn.textContent.trim() || 'Bestellung speichern';
  }
  btn.disabled = Boolean(busy);
  btn.setAttribute('aria-busy', busy ? 'true' : 'false');
  btn.textContent = busy ? labelWhenBusy : btn.dataset.defaultLabel;
}

function collectWishTags() {
  return Array.from(document.querySelectorAll('input[name="order-wish-tag"]:checked'))
    .map((el) => el.value)
    .filter(Boolean);
}

function buildAdditionalWishesText() {
  const tags = collectWishTags();
  const freeText = document.getElementById('order-additional-wishes')?.value?.trim() || '';
  const tagPart = tags.length ? tags.join(', ') : '';
  if (tagPart && freeText) return `${tagPart}; ${freeText}`;
  return tagPart || freeText || null;
}

function renderOrderSlipAttachments(attachments = []) {
  if (!Array.isArray(attachments) || attachments.length === 0) return '';
  return attachments.map((item, index) => {
    const url = item?.url || '';
    if (!url) return '';
    if (String(item?.type || '').toLowerCase() === 'pdf') {
      return `<a class="customer-order-slip-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">📄 Bestellzettel ${index + 1} (PDF)</a>`;
    }
    return `<a class="customer-order-slip-thumb" href="${escapeHtml(url)}" target="_blank" rel="noopener"><img src="${escapeHtml(url)}" alt="Bestellzettel ${index + 1}" loading="lazy"></a>`;
  }).join('');
}

function renderOrderItemsList(items) {
  if (!Array.isArray(items) || items.length === 0) return '<span>–</span>';
  return items.map((item) => {
    const n = normalizeOrderItem(item);
    const qtyParts = [];
    if (n.pieces > 0) qtyParts.push(`${formatQuantityValue(n.pieces)} Stück`);
    if (n.weightKg > 0) qtyParts.push(`ca. ${formatQuantityValue(n.weightKg)} kg`);
    if (!qtyParts.length && (n.quantity || n.unit)) {
      qtyParts.push([item.quantity ?? n.quantity, item.unit || n.unit].filter(Boolean).join(' '));
    }
    const extras = [
      n.cutLabel && n.cutLabel !== 'Standard' ? n.cutLabel : '',
      n.isTk ? 'TK' : '',
      n.vacuumLabel || '',
      n.note,
      item.weight,
      item.width,
      item.lineNotes,
    ].filter(Boolean);
    const uniqueExtras = [...new Set(extras.map((e) => String(e)))];
    return `<li><strong>${escapeHtml(n.product || item.product || 'Artikel')}</strong> – ${escapeHtml(qtyParts.join(' · ') || '–')}${uniqueExtras.length ? ` <span class="customer-order-item-meta">(${escapeHtml(uniqueExtras.join(' · '))})</span>` : ''}</li>`;
  }).join('');
}

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

function formatQuantityValue(value) {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3 }).format(value);
}

function formatMoneyValue(value) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number.isFinite(value) ? value : 0);
}

function normalizeQuantityText(value) {
  return String(value ?? '').trim().replace(',', '.');
}

function actualQuantityValue(key, fallback) {
  const stored = orderState.actualQuantityByKey.get(key);
  return stored === undefined ? fallback : stored;
}

function actualQuantityChanged(key, fallback) {
  return normalizeQuantityText(actualQuantityValue(key, fallback)) !== normalizeQuantityText(fallback);
}

function quantityForStock(item) {
  const actual = parseQuantityValue(item?.actualQuantity);
  if (actual > 0) return actual;
  return parseQuantityValue(item?.quantity);
}

function stockItemIdFromOrderItem(item) {
  return String(
    item?.stockItemId
    || item?.stammdatenId
    || item?.artikelId
    || item?.articleId
    || item?.productId
    || item?.ean
    || item?.barcode
    || item?.sku
    || ''
  ).trim();
}

async function findStockDocForOrderItem(item) {
  const col = stockCollectionRef();
  if (!col) return null;

  const directId = stockItemIdFromOrderItem(item);
  if (directId) {
    const snap = await col.doc(directId).get();
    if (snap.exists) return snap.ref;
  }

  const product = String(item?.product || item?.produkt || item?.name || '').trim();
  if (!product) return null;

  const byProdukt = await col.where('produkt', '==', product).limit(1).get();
  if (!byProdukt.empty) return byProdukt.docs[0].ref;

  const byName = await col.where('name', '==', product).limit(1).get();
  if (!byName.empty) return byName.docs[0].ref;

  return null;
}

async function prepareStockDeductionsForOrder(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const deductions = [];
  for (const item of items) {
    const amount = quantityForStock(item);
    if (!amount) continue;
    const ref = await findStockDocForOrderItem(item);
    if (!ref) continue;
    deductions.push({
      ref,
      amount,
      product: item?.product || item?.produkt || item?.name || 'Artikel',
    });
  }
  return deductions;
}

async function markOrderPickedUpWithStock(order, employee, { actionLog } = {}) {
  const firebase = orderState.getFirebase();
  const orderRef = ordersCollectionRef()?.doc(order.id);
  if (!firebase?.firestore?.FieldValue || !orderRef) {
    throw new Error('Bestellung ist noch nicht bereit.');
  }
  if (!navigator.onLine) {
    throw new Error('Bitte bei WLAN erneut versuchen.');
  }

  const deductions = await prepareStockDeductionsForOrder(order);
  await orderState.db.runTransaction(async (transaction) => {
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists) throw new Error('Bestellung nicht gefunden.');
    const currentOrder = orderSnap.data();
    if (currentOrder.status === 'picked_up') {
      throw new Error('Bestellung ist bereits abgeholt.');
    }
    if (currentOrder.status !== 'ready') {
      throw new Error('Bestellung ist noch nicht abholbereit.');
    }

    const stockSnaps = [];
    for (const deduction of deductions) {
      stockSnaps.push({ deduction, snap: await transaction.get(deduction.ref) });
    }

    stockSnaps.forEach(({ deduction, snap }) => {
      if (!snap.exists) return;
      const currentStock = parseQuantityValue(snap.data()?.currentStock);
      const nextStock = Math.max(0, Math.round((currentStock - deduction.amount) * 1000) / 1000);
      transaction.update(deduction.ref, {
        currentStock: nextStock,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });

    const orderUpdate = {
      status: 'picked_up',
      pickedUpBy: employee,
      pickedUpAt: firebase.firestore.FieldValue.serverTimestamp(),
      employeeName: employee,
    };
    if (Array.isArray(actionLog)) orderUpdate.actionLog = actionLog;
    transaction.update(orderRef, orderUpdate);
  });

  return deductions.length;
}

function normalizePicklistKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function getPicklistCategory(item) {
  const text = [
    item?.category,
    item?.product,
    item?.lineNotes,
  ].filter(Boolean).join(' ').toLowerCase();

  if (/(joghurt|milch|käse|kaese|quark|butter|sahne|molkerei|mopro|ei\b|eier)/.test(text)) {
    return 'Molkereiprodukte';
  }
  if (/(salami|mettwurst|bratwurst|leberwurst|fleischsalat|aufschnitt|wurst|schinken|speck)/.test(text)) {
    return 'Wurstküche';
  }
  if (/(honig|marmelade|nudel|eingelegt|senf|saft|sirup|hofladen|spezial)/.test(text)) {
    return 'Hofladen-Spezialitäten';
  }
  return item?.category || 'Sonstiges';
}

function getProductionStation(item) {
  const text = [
    item?.category,
    item?.station,
    item?.area,
    item?.product,
    item?.lineNotes,
  ].filter(Boolean).join(' ').toLowerCase();

  if (text.includes('küche') || text.includes('kueche') || text.includes('gastro')) return 'kitchen';
  if (text.includes('metzgerei') || text.includes('produktion')) return 'butchery';
  return null;
}

function isTodayReadyOrder(order) {
  const ts = toEpochMs(order?.readyAt);
  if (!ts) return true;
  const date = new Date(ts);
  const readyDay = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return readyDay === todayIsoLocal();
}

export function generateSammelPickliste() {
  const grouped = new Map();
  const openOrders = orderState.allOrders.filter((order) => {
    const status = order.status || 'open';
    return OPEN_ORDER_STATUSES.has(status) && isTodayReadyOrder(order);
  });
  const includedOrderIds = new Set();

  openOrders.forEach((order) => {
    (Array.isArray(order.items) ? order.items : []).forEach((item) => {
      const product = String(item?.product || '').trim();
      if (!product || product === 'Siehe Bestellzettel (Scan)') return;
      const unit = String(item?.unit || '').trim();
      const category = getPicklistCategory(item);
      const key = [
        normalizePicklistKey(category),
        normalizePicklistKey(product),
        normalizePicklistKey(unit),
      ].join('|');
      const quantity = parseQuantityValue(item?.quantity);
      const entry = grouped.get(key) || {
        key,
        product,
        unit,
        category,
        quantity: 0,
        orders: new Set(),
        notes: new Set(),
        refs: [],
      };
      entry.quantity += quantity;
      entry.orders.add(order.id);
      entry.refs.push({ orderId: order.id, lineIndex: order.items.indexOf(item), quantity });
      includedOrderIds.add(order.id);
      [item?.weight, item?.width, item?.lineNotes].filter(Boolean).forEach((note) => entry.notes.add(String(note)));
      grouped.set(key, entry);
    });
  });

  const categories = new Map();
  Array.from(grouped.values())
    .sort((a, b) => a.product.localeCompare(b.product, 'de'))
    .forEach((entry) => {
      const list = categories.get(entry.category) || [];
      list.push({
        ...entry,
        quantityLabel: formatQuantityValue(entry.quantity),
        orderCount: entry.orders.size,
        notes: Array.from(entry.notes),
        refs: entry.refs,
      });
      categories.set(entry.category, list);
    });

  return {
    generatedAt: new Date(),
    orderCount: openOrders.length,
    includedOrderIds: Array.from(includedOrderIds),
    categories: Array.from(categories.entries())
      .sort(([a], [b]) => {
        const ai = PICKLIST_CATEGORY_ORDER.indexOf(a);
        const bi = PICKLIST_CATEGORY_ORDER.indexOf(b);
        if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        return a.localeCompare(b, 'de');
      })
      .map(([category, items]) => ({ category, items })),
  };
}

export function getProductionTasksByStation() {
  const stationItems = {
    kitchen: new Map(),
    butchery: new Map(),
  };

  orderState.allOrders
    .filter((order) => OPEN_ORDER_STATUSES.has(order.status || 'open') && isTodayReadyOrder(order))
    .forEach((order) => {
      (Array.isArray(order.items) ? order.items : []).forEach((item) => {
        const station = getProductionStation(item);
        if (!station) return;
        const product = String(item?.product || '').trim();
        if (!product || product === 'Siehe Bestellzettel (Scan)') return;
        const unit = String(item?.unit || '').trim();
        const key = [
          station,
          normalizePicklistKey(product),
          normalizePicklistKey(unit),
        ].join('|');
        const productId = String(item?.productId || item?.artikelId || item?.artNr || '').trim();
        const entry = stationItems[station].get(key) || {
          key,
          product,
          productId: '',
          unit,
          quantity: 0,
          orderIds: new Set(),
          notes: new Set(),
          refs: [],
        };
        if (!entry.productId && productId) entry.productId = productId;
        entry.quantity += parseQuantityValue(item?.quantity);
        entry.orderIds.add(order.id);
        entry.refs.push({ orderId: order.id, lineIndex: order.items.indexOf(item), quantity: parseQuantityValue(item?.quantity) });
        [item?.weight, item?.width, item?.lineNotes].filter(Boolean).forEach((note) => entry.notes.add(String(note)));
        stationItems[station].set(key, entry);
      });
    });

  const toList = (station) => Array.from(stationItems[station].values())
    .sort((a, b) => a.product.localeCompare(b.product, 'de'))
    .map((entry) => ({
      ...entry,
      quantityLabel: formatQuantityValue(entry.quantity),
      orderCount: entry.orderIds.size,
      orderIds: Array.from(entry.orderIds),
      notes: Array.from(entry.notes),
      refs: entry.refs,
    }));

  return {
    kitchen: toList('kitchen'),
    butchery: toList('butchery'),
  };
}

function renderProductionStationList(station, items) {
  const config = PRODUCTION_STATIONS[station];
  if (!items.length) {
    return `<p class="production-station-empty">${escapeHtml(config.empty)}</p>`;
  }
  return `
    <div class="production-station-list">
      ${items.map((item) => {
        const checked = orderState.productionChecked.has(item.key) ? ' checked' : '';
        const unit = item.unit ? ` ${escapeHtml(item.unit)}` : '';
        const actualValue = actualQuantityValue(item.key, item.quantityLabel);
        const actualAdjusted = actualQuantityChanged(item.key, item.quantityLabel) ? ' is-adjusted' : '';
        const notes = item.notes.length ? `<span class="production-station-note">${escapeHtml(item.notes.join(' · '))}</span>` : '';
        return `
          <label class="production-station-item">
            <input type="checkbox" data-production-key="${escapeHtml(item.key)}"${checked}>
            <span class="production-station-line"><strong>${escapeHtml(item.quantityLabel)}${unit}</strong> ${escapeHtml(item.product)}</span>
            <span class="production-station-meta">${checked ? 'Fertig für den Laden' : 'Produktions-Auftrag'}</span>
            <span class="actual-quantity-field${actualAdjusted}">
              <span>Waagen-Wert</span>
              <input type="text" inputmode="decimal" data-actual-quantity-key="${escapeHtml(item.key)}" data-actual-quantity-default="${escapeHtml(item.quantityLabel)}" value="${escapeHtml(actualValue)}" aria-label="Tatsächliches Gewicht für ${escapeHtml(item.product)}">
              <span>${escapeHtml(item.unit || '')}</span>
            </span>
            ${notes}
          </label>
        `;
      }).join('')}
    </div>
  `;
}

function renderProductionTasks() {
  const kitchenBodies = [
    document.getElementById('production-tasks-kitchen'),
    document.getElementById('production-tasks-kitchen-admin'),
  ].filter(Boolean);
  const butcheryBodies = [
    document.getElementById('production-tasks-butchery'),
    document.getElementById('production-tasks-butchery-admin'),
  ].filter(Boolean);
  if (!kitchenBodies.length && !butcheryBodies.length) return;

  const tasks = getProductionTasksByStation();
  kitchenBodies.forEach((body) => { body.innerHTML = renderProductionStationList('kitchen', tasks.kitchen); });
  butcheryBodies.forEach((body) => { body.innerHTML = renderProductionStationList('butchery', tasks.butchery); });
}

function renderSammelPickliste() {
  const body = document.getElementById('sammel-pickliste-body');
  const summary = document.getElementById('sammel-pickliste-summary');
  const readyBtn = document.getElementById('sammel-pickliste-ready-btn');
  const confirmPanel = document.getElementById('sammel-pickliste-confirm');
  if (!body) return;
  const picklist = generateSammelPickliste();
  if (readyBtn) {
    readyBtn.disabled = orderState.picklistReadyInFlight || picklist.includedOrderIds.length === 0;
    readyBtn.textContent = orderState.picklistReadyInFlight
      ? 'Bestellungen werden aktualisiert...'
      : "Alle enthaltenen Bestellungen als 'Abholbereit' markieren";
  }
  confirmPanel?.classList.add('hidden');
  if (summary) {
    summary.textContent = picklist.includedOrderIds.length === 1
      ? '1 offene Bestellung zum Zusammenstellen.'
      : `${picklist.includedOrderIds.length} offene Bestellungen zum Zusammenstellen.`;
  }
  if (!picklist.categories.length) {
    body.innerHTML = '<p class="sammel-pickliste-empty">Heute ist nichts mehr zu holen.</p>';
    return;
  }
  body.innerHTML = picklist.categories.map(({ category, items }) => `
    <section class="sammel-pickliste-category">
      <h3>${escapeHtml(category)}</h3>
      <div class="sammel-pickliste-items">
        ${items.map((item) => {
          const isChecked = orderState.picklistChecked.has(item.key);
          const checked = isChecked ? ' checked' : '';
          const pickupLabel = isChecked ? 'Eingepackt' : 'Noch zu holen';
          const unit = item.unit ? ` ${escapeHtml(item.unit)}` : '';
          const actualValue = actualQuantityValue(item.key, item.quantityLabel);
          const actualAdjusted = actualQuantityChanged(item.key, item.quantityLabel) ? ' is-adjusted' : '';
          const notes = item.notes.length ? `<span class="sammel-pickliste-note">${escapeHtml(item.notes.join(' · '))}</span>` : '';
          return `
            <label class="sammel-pickliste-item">
              <input type="checkbox" data-picklist-key="${escapeHtml(item.key)}"${checked}>
              <span class="sammel-pickliste-line"><strong>${escapeHtml(item.quantityLabel)}${unit}</strong> ${escapeHtml(item.product)}</span>
              <span class="sammel-pickliste-meta">${item.orderCount} ${item.orderCount === 1 ? 'Bestellung' : 'Bestellungen'} · ${pickupLabel}</span>
              <span class="actual-quantity-field${actualAdjusted}">
                <span>Waagen-Wert</span>
                <input type="text" inputmode="decimal" data-actual-quantity-key="${escapeHtml(item.key)}" data-actual-quantity-default="${escapeHtml(item.quantityLabel)}" value="${escapeHtml(actualValue)}" aria-label="Tatsächliches Gewicht für ${escapeHtml(item.product)}">
                <span>${escapeHtml(item.unit || '')}</span>
              </span>
              ${notes}
            </label>
          `;
        }).join('')}
      </div>
    </section>
  `).join('');
}

function openSammelPickliste() {
  const modal = document.getElementById('sammel-pickliste-modal');
  if (!modal) return;
  renderSammelPickliste();
  modal.classList.add('is-open');
  modal.removeAttribute('hidden');
  document.body.classList.add('modal-open');
}

function closeSammelPickliste() {
  const modal = document.getElementById('sammel-pickliste-modal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('hidden', '');
  document.body.classList.remove('modal-open');
}

function resetSammelPickliste() {
  orderState.picklistChecked.clear();
  renderSammelPickliste();
  window.showToast?.('Sammel-Pickliste zurückgesetzt.', 'success');
}

function showSammelPicklisteConfirm() {
  const picklist = generateSammelPickliste();
  if (!picklist.includedOrderIds.length) {
    window.showToast?.('Heute ist nichts mehr zu holen.', 'success');
    renderSammelPickliste();
    return;
  }
  document.getElementById('sammel-pickliste-confirm')?.classList.remove('hidden');
}

function hideSammelPicklisteConfirm() {
  document.getElementById('sammel-pickliste-confirm')?.classList.add('hidden');
}

function collectActualQuantityUpdates(picklist) {
  const updatesByOrder = new Map();
  const addItems = (items) => {
    items.forEach((item) => {
      if (!actualQuantityChanged(item.key, item.quantityLabel)) return;
      const actualTotal = parseQuantityValue(actualQuantityValue(item.key, item.quantityLabel));
      if (!Number.isFinite(actualTotal)) return;
      const totalOrdered = Number.isFinite(item.quantity) ? item.quantity : 0;
      item.refs.forEach((ref) => {
        if (!ref?.orderId || !Number.isInteger(ref.lineIndex)) return;
        const share = totalOrdered > 0 ? (actualTotal * ref.quantity) / totalOrdered : actualTotal;
        const list = updatesByOrder.get(ref.orderId) || [];
        list.push({
          lineIndex: ref.lineIndex,
          actualQuantity: formatQuantityValue(share),
          actualQuantityUnit: item.unit || null,
        });
        updatesByOrder.set(ref.orderId, list);
      });
    });
  };

  picklist.categories.forEach(({ items }) => {
    addItems(items);
  });
  const productionTasks = getProductionTasksByStation();
  addItems(productionTasks.kitchen);
  addItems(productionTasks.butchery);
  return updatesByOrder;
}

function applyActualQuantityUpdatesToItems(order, updates = []) {
  if (!updates.length || !Array.isArray(order?.items)) return order?.items;
  const byLine = new Map(updates.map((entry) => [entry.lineIndex, entry]));
  return order.items.map((item, index) => {
    const update = byLine.get(index);
    if (!update) return item;
    return {
      ...item,
      actualQuantity: update.actualQuantity,
      actualQuantityUnit: update.actualQuantityUnit,
      actualQuantityRecordedAt: new Date().toISOString(),
    };
  });
}

function getItemUnitPrice(item, orderedQuantity) {
  const direct = [
    item?.pricePerKg,
    item?.kgPrice,
    item?.kiloPrice,
    item?.unitPrice,
    item?.pricePerUnit,
    item?.singlePrice,
  ].map(parseMoneyValue).find((price) => price > 0);
  if (direct) return direct;

  const lineTotal = [item?.lineTotal, item?.totalPrice, item?.price]
    .map(parseMoneyValue)
    .find((price) => price > 0);
  if (lineTotal && orderedQuantity > 0) return lineTotal / orderedQuantity;
  return 0;
}

export function calculateFinalOrderPrice(order) {
  const lines = (Array.isArray(order?.items) ? order.items : []).map((item) => {
    const n = normalizeOrderItem(item);
    const orderedQuantity = n.weightKg > 0 ? n.weightKg : (n.pieces || parseQuantityValue(item?.quantity));
    const weigh = calculateLinePriceFromWeight(item);
    const unitPrice = weigh.pricePerKg || getItemUnitPrice(item, orderedQuantity);
    const actualQuantity = weigh.hasActualWeight
      ? weigh.weightKg
      : (item?.actualQuantity ? parseQuantityValue(item.actualQuantity) : orderedQuantity);
    const unit = weigh.hasActualWeight ? 'kg' : (item?.actualQuantityUnit || n.unit || '');
    const lineTotal = weigh.hasActualWeight
      ? weigh.lineTotal
      : Math.round((actualQuantity * unitPrice) * 100) / 100;
    const orderedLabel = [
      n.pieces > 0 ? `${formatQuantityValue(n.pieces)} Stück` : '',
      n.weightKg > 0 ? `ca. ${formatQuantityValue(n.weightKg)} kg` : '',
      !n.pieces && !n.weightKg ? [item?.quantity, item?.unit].filter(Boolean).join(' ') : '',
    ].filter(Boolean).join(' · ');
    const actualLabel = weigh.hasActualWeight
      ? `${formatQuantityValue(weigh.weightGrams)} g`
      : [formatQuantityValue(actualQuantity), unit].filter(Boolean).join(' ');
    return {
      product: n.product || item?.product || 'Artikel',
      orderedQuantity,
      actualQuantity,
      unit,
      orderedLabel,
      actualLabel,
      unitPrice,
      lineTotal,
      hasActualQuantity: Boolean(item?.actualQuantity) || weigh.hasActualWeight,
      notes: [n.cutLabel, n.isTk ? 'TK' : '', item?.weight, item?.width, item?.lineNotes, n.note].filter(Boolean).join(' · '),
    };
  });
  const total = Math.round(lines.reduce((sum, line) => sum + line.lineTotal, 0) * 100) / 100;
  return { lines, total };
}

function renderDeliveryNoteRows(order) {
  const price = calculateFinalOrderPrice(order);
  if (!price.lines.length) {
    return '<tr><td colspan="5">Keine Artikel eingetragen.</td></tr>';
  }
  return price.lines.map((line) => `
    <tr>
      <td>
        <strong>${escapeHtml(line.product)}</strong>
        ${line.notes ? `<span class="delivery-note-item-note">${escapeHtml(line.notes)}</span>` : ''}
      </td>
      <td>${escapeHtml(line.orderedLabel || '–')}</td>
      <td>${escapeHtml(line.actualLabel || line.orderedLabel || '–')}${line.hasActualQuantity ? '<span class="delivery-note-weighed">Abgewogen</span>' : ''}</td>
      <td>${escapeHtml(formatMoneyValue(line.unitPrice))}</td>
      <td>${escapeHtml(formatMoneyValue(line.lineTotal))}</td>
    </tr>
  `).join('');
}

function openDeliveryNote(orderId) {
  const order = orderState.allOrders.find((entry) => entry.id === orderId);
  const modal = document.getElementById('delivery-note-modal');
  const body = document.getElementById('delivery-note-print-area');
  if (!order || !modal || !body) {
    window.showToast?.('Lieferschein konnte nicht geöffnet werden.', 'error');
    return;
  }
  const price = calculateFinalOrderPrice(order);
  body.innerHTML = `
    <section class="delivery-note-sheet">
      <header class="delivery-note-sheet-head">
        <p>Kisten-Zettel · ${escapeHtml(orderRefLabel(order))}</p>
        <h1>${escapeHtml(customerDisplayName(order))}</h1>
        <div>Abholung: ${escapeHtml(formatReadyAt(order.readyAt || order.pickupDate))} · ${escapeHtml(orderPickupChannelLabel(order))}</div>
      </header>
      <table class="delivery-note-table">
        <thead>
          <tr>
            <th>Artikel</th>
            <th>Bestellte Menge</th>
            <th>Tatsächliche Menge</th>
            <th>Einzelpreis</th>
            <th>Abholpreis</th>
          </tr>
        </thead>
        <tbody>${renderDeliveryNoteRows(order)}</tbody>
      </table>
      <footer class="delivery-note-total">
        <span>Endpreis</span>
        <strong>${escapeHtml(formatMoneyValue(price.total))}</strong>
      </footer>
    </section>
  `;
  modal.classList.add('is-open');
  modal.removeAttribute('hidden');
  document.body.classList.add('modal-open');
}

function closeDeliveryNote() {
  const modal = document.getElementById('delivery-note-modal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('hidden', '');
  document.body.classList.remove('modal-open');
}

async function markSammelPicklisteReady() {
  if (orderState.picklistReadyInFlight) return;
  const employee = getActiveEmployeeName();
  if (!employee) {
    window.showToast?.('Bitte zuerst als Mitarbeiter anmelden.', 'warning');
    return;
  }

  const picklist = generateSammelPickliste();
  const orderIds = picklist.includedOrderIds;
  if (!orderIds.length) {
    window.showToast?.('Heute ist nichts mehr zu holen.', 'success');
    renderSammelPickliste();
    return;
  }

  const firebase = orderState.getFirebase();
  if (!firebase?.firestore?.FieldValue) {
    window.showToast?.('Bitte kurz warten und erneut versuchen.', 'warning');
    return;
  }

  try {
    orderState.picklistReadyInFlight = true;
    renderSammelPickliste();
    const actualUpdates = collectActualQuantityUpdates(picklist);

    const results = await Promise.all(orderIds.map((orderId) => {
      const order = orderState.allOrders.find((entry) => entry.id === orderId);
      const updates = actualUpdates.get(orderId) || [];
      const updatedItems = applyActualQuantityUpdatesToItems(order, updates);
      const logEntry = buildOrderActionLogEntry(
        'ready_no_notify',
        employee,
        'Sammel-Pickliste / Laden-Kühlschrank',
      );
      const nextLog = mergeOrderActionLog(orderActionLogBase(order), logEntry);
      const onlineUpdate = {
        status: 'ready',
        readyMarkedBy: employee,
        employeeName: employee,
        readyMarkedAt: firebase.firestore.FieldValue.serverTimestamp(),
        pickupPlace: 'Laden-Kühlschrank',
        // Sammel-Kühlschrank: Team-Bulletin statt Einzel-Mail an alle Kunden.
        skipNotify: true,
        notifySkipped: true,
        actionLog: nextLog,
      };
      const queuedUpdate = {
        status: 'ready',
        readyMarkedBy: employee,
        employeeName: employee,
        readyMarkedAt: new Date().toISOString(),
        pickupPlace: 'Laden-Kühlschrank',
        skipNotify: true,
        notifySkipped: true,
        actionLog: nextLog,
      };
      if (updates.length && updatedItems) {
        onlineUpdate.items = updatedItems;
        queuedUpdate.items = updatedItems;
      }
      return writeFirestoreDocOrQueue({
        collectionPath: 'customerOrders',
        docId: orderId,
        op: 'update',
        onlineData: onlineUpdate,
        queueData: queuedUpdate,
        offlineMessage: 'Bestellungen werden automatisch synchronisiert, sobald WLAN verfügbar ist.',
      });
    }));

    await postTeamboardBulletin(
      '🎉 Die Kundenbestellungen für heute wurden frisch zusammengestellt und stehen abholbereit im Laden-Kühlschrank!',
      { author: employee },
    );

    orderState.allOrders = orderState.allOrders.map((order) => (
      orderIds.includes(order.id)
        ? {
          ...order,
          status: 'ready',
          readyMarkedBy: employee,
          readyMarkedAt: new Date().toISOString(),
          pickupPlace: 'Laden-Kühlschrank',
          items: applyActualQuantityUpdatesToItems(order, actualUpdates.get(order.id) || []) || order.items,
        }
        : order
    ));
    orderState.picklistChecked.clear();
    orderState.actualQuantityByKey.clear();
    hideSammelPicklisteConfirm();
    renderOpenOrders();
    renderAdminOrders();
    renderProductionTasks();
    renderSammelPickliste();
    const queued = results.includes('queued');
    window.showToast?.(
      queued
        ? 'Abholbereit vorgemerkt. Wir sehen die Änderung, sobald WLAN verfügbar ist.'
        : 'Bestellungen aktualisiert und Abhol-Signale automatisch an die Kunden versendet!',
      queued ? 'warning' : 'success',
    );
  } catch (err) {
    console.error('[CustomerOrders] Pickliste abschließen fehlgeschlagen:', err);
    window.showToast?.('Bestellungen konnten nicht aktualisiert werden. Bitte erneut versuchen.', 'error');
  } finally {
    orderState.picklistReadyInFlight = false;
    renderSammelPickliste();
  }
}

function weighDraftKey(orderId, lineIndex) {
  return `${orderId}:${lineIndex}`;
}

function formatGramsInput(grams) {
  if (!Number.isFinite(grams) || grams <= 0) return '';
  return String(Math.round(grams));
}

function renderPacktischWeighFields(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  if (!items.length) return '<p class="customer-order-hint">Keine Positionen hinterlegt.</p>';
  return items.map((raw, index) => {
    const item = normalizeOrderItem(raw);
    const key = weighDraftKey(order.id, index);
    const draft = orderState.weighDraftByKey.get(key);
    const grams = draft !== undefined
      ? parseQuantityValue(draft)
      : (item.actualWeightGrams || (item.weightKg > 0 ? Math.round(item.weightKg * 1000) : 0));
    const priced = calculateLinePriceFromWeight(item, grams > 0 ? grams : null);
    const isWeighable = item.pricePerKg > 0 || item.weightKg > 0 || /kg/i.test(item.unit);
    if (!isWeighable) {
      return `
        <div class="packtisch-weigh-row">
          <div>
            <strong>${escapeHtml(item.product)}</strong>
            <div class="customer-order-meta">${escapeHtml([item.pieces > 0 ? `${item.pieces} Stück` : '', item.cutLabel, item.isTk ? 'TK' : ''].filter(Boolean).join(' · '))}</div>
          </div>
          <div class="packtisch-line-price">${escapeHtml(formatMoneyValue(item.estimatedPrice || priced.lineTotal))}</div>
        </div>
      `;
    }
    return `
      <div class="packtisch-weigh-row" data-weigh-order="${escapeHtml(order.id)}" data-weigh-line="${index}">
        <div>
          <label for="weigh-${escapeHtml(order.id)}-${index}">${escapeHtml(item.product)} – Waage (g)</label>
          <input type="text" inputmode="decimal" id="weigh-${escapeHtml(order.id)}-${index}"
            data-actual-weight-order="${escapeHtml(order.id)}" data-actual-weight-line="${index}"
            data-price-per-kg="${escapeHtml(String(item.pricePerKg || 0))}"
            value="${escapeHtml(formatGramsInput(grams))}"
            placeholder="z. B. 485" aria-label="Waagengewicht in Gramm für ${escapeHtml(item.product)}">
          <div class="customer-order-meta">${escapeHtml([item.cutLabel, item.isTk ? 'TK' : '', item.pricePerKg ? `${formatMoneyValue(item.pricePerKg)}/kg` : ''].filter(Boolean).join(' · '))}</div>
        </div>
        <div class="packtisch-line-price" data-weigh-price="${escapeHtml(order.id)}-${index}">${escapeHtml(formatMoneyValue(priced.lineTotal))}</div>
      </div>
    `;
  }).join('');
}

function renderPacktischDetail(order) {
  const phone = customerPhone(order);
  const notes = butcherNotes(order);
  const vacuum = vacuumWishesSummary(order);
  const ref = orderRefLabel(order);
  return `
    <div class="packtisch-detail">
      <p class="customer-order-meta"><strong>${escapeHtml(ref)}</strong> · ${escapeHtml(phone || 'Keine Telefonnummer')}</p>
      ${notes ? `<p class="customer-order-wishes"><strong>Notiz für die Metzgerei:</strong> ${escapeHtml(notes)}</p>` : ''}
      ${vacuum.length ? `<p class="customer-order-meta"><strong>Vakuum:</strong> ${escapeHtml(vacuum.join(' · '))}</p>` : ''}
      ${renderPacktischWeighFields(order)}
      <div class="packtisch-actions">
        <button type="button" class="btn btn-secondary btn-compact" data-order-action="save_weights" data-order-id="${escapeHtml(order.id)}">Waagengewichte speichern</button>
        <button type="button" class="btn btn-secondary btn-compact" data-order-action="avery" data-order-id="${escapeHtml(order.id)}">Avery-Etikett / Kistenbon drucken</button>
        <button type="button" class="btn btn-secondary btn-compact" data-order-action="delivery_note" data-order-id="${escapeHtml(order.id)}">Lieferschein</button>
      </div>
    </div>
  `;
}

function renderOrderCard(order, { adminView = false } = {}) {
  const status = orderStatus(order);
  const statusLabel = ORDER_STATUS_LABELS[status] || status;
  const acceptedAt = formatDateTimeDe(order.acceptedAt || order.createdAt);
  const readyLabel = formatReadyAt(order.readyAt || order.pickupDate);
  const name = customerDisplayName(order);
  const contact = [customerPhone(order), order.customerEmail || order.customer?.email].filter(Boolean).join(' · ');
  const isUpdatingThisOrder = orderState.statusUpdateOrderIds.has(order.id);
  const channel = orderPickupChannelLabel(order);
  const slot = orderPickupSlotLabel(order);
  const ref = orderRefLabel(order);
  const expanded = orderState.expandedPackOrderId === order.id;

  const canEditContent = status === 'open'
    || status === 'pending'
    || status === 'eingegangen'
    || status === 'in_progress'
    || status === 'ready';
  const editBtn = canEditContent
    ? `<button type="button" class="btn btn-secondary btn-compact" data-order-action="edit" data-order-id="${escapeHtml(order.id)}"${isUpdatingThisOrder ? ' disabled' : ''}>Bearbeiten</button>`
    : '';

  let actions = '';
  if (status === 'open' || status === 'pending' || status === 'eingegangen') {
    actions = `
      ${editBtn}
      <button type="button" class="btn btn-primary btn-compact" data-order-action="in_progress" data-order-id="${escapeHtml(order.id)}">In Bearbeitung</button>
      <button type="button" class="btn btn-secondary btn-compact" data-order-action="ready" data-order-id="${escapeHtml(order.id)}">Als Abholbereit markieren</button>
      <button type="button" class="btn btn-secondary btn-compact" data-order-action="cancel" data-order-id="${escapeHtml(order.id)}">Stornieren</button>
    `;
  } else if (status === 'in_progress') {
    actions = `
      ${editBtn}
      <button type="button" class="btn btn-primary btn-compact" data-order-action="ready" data-order-id="${escapeHtml(order.id)}">Als Abholbereit markieren</button>
      <button type="button" class="btn btn-secondary btn-compact" data-order-action="cancel" data-order-id="${escapeHtml(order.id)}">Stornieren</button>
    `;
  } else if (status === 'ready') {
    actions = `
      ${editBtn}
      <button type="button" class="btn btn-secondary btn-compact" data-order-action="reopen" data-order-id="${escapeHtml(order.id)}"${isUpdatingThisOrder ? ' disabled' : ''}>Weiter bearbeiten</button>
      <button type="button" class="btn btn-secondary btn-compact" data-order-action="notify_ready" data-order-id="${escapeHtml(order.id)}"${isUpdatingThisOrder ? ' disabled' : ''}>Kunde erneut benachrichtigen</button>
      <button type="button" class="btn btn-primary btn-compact" data-order-action="picked_up" data-order-id="${escapeHtml(order.id)}"${isUpdatingThisOrder ? ' disabled aria-busy="true"' : ''}>${isUpdatingThisOrder ? 'Wird abgeholt…' : 'Als abgeholt markieren'}</button>
    `;
  }

  return `
    <article class="customer-order-card packtisch-card packtisch-card--${escapeHtml(status)} customer-order-card--${escapeHtml(status)}" data-order-id="${escapeHtml(order.id)}">
      <header class="customer-order-card-head packtisch-card-head">
        <div>
          <strong>${escapeHtml(name)}</strong>
          <div class="customer-order-meta">${escapeHtml(ref)} · ${escapeHtml(channel)}${slot ? ` · ${escapeHtml(slot)}` : ''}</div>
        </div>
        <span class="customer-order-badge packtisch-badge">${escapeHtml(statusLabel)}</span>
      </header>
      <p class="customer-order-meta">Angenommen: ${escapeHtml(acceptedAt)} · ${escapeHtml(order.acceptedBy || 'Portal')}</p>
      <p class="customer-order-meta">Abholung: <strong>${escapeHtml(readyLabel)}</strong></p>
      <p class="customer-order-meta">Kontakt: ${escapeHtml(contact || '–')}</p>
      <ul class="customer-order-items">${renderOrderItemsList(order.items)}</ul>
      ${order.orderSlipAttachments?.length ? `<div class="customer-order-slips">${renderOrderSlipAttachments(order.orderSlipAttachments)}</div>` : ''}
      ${renderOrderActionLog(order)}
      <div class="packtisch-actions">
        <button type="button" class="btn btn-secondary btn-compact" data-order-action="toggle_detail" data-order-id="${escapeHtml(order.id)}">${expanded ? 'Details schließen' : 'Details / Nachwiegen'}</button>
        ${actions}
      </div>
      ${expanded ? renderPacktischDetail(order) : ''}
      ${adminView && status !== 'open' ? `<span class="customer-order-meta">${escapeHtml(statusLabel)}</span>` : ''}
    </article>
  `;
}

function renderPacktischCalendar() {
  const root = document.getElementById('packtisch-calendar');
  if (!root) return;

  const anchor = ensureCalendarAnchor();
  const mode = orderState.calendarMode === 'month' ? 'month' : '2weeks';
  const cells = buildPacktischCalendarDays(mode, anchor);
  const counts = countOrdersByPickupDay(orderState.allOrders);
  const selected = orderState.selectedPickupDayIso;

  const rangeLabel = mode === 'month'
    ? (() => {
      const parsed = Date.parse(`${startOfMonthIso(anchor)}T12:00:00`);
      return Number.isFinite(parsed)
        ? new Date(parsed).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
        : 'Monat';
    })()
    : (() => {
      const end = addDaysIso(anchor, 13);
      const a = Date.parse(`${anchor}T12:00:00`);
      const b = Date.parse(`${end}T12:00:00`);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return 'Zwei Wochen';
      const fmt = (ts) => new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
      return `${fmt(a)} – ${fmt(b)}`;
    })();

  root.innerHTML = `
    <div class="packtisch-calendar-toolbar">
      <div class="packtisch-calendar-mode" role="group" aria-label="Kalenderzeitraum">
        <button type="button" class="btn btn-secondary btn-compact${mode === '2weeks' ? ' is-active' : ''}" data-calendar-mode="2weeks">2 Wochen</button>
        <button type="button" class="btn btn-secondary btn-compact${mode === 'month' ? ' is-active' : ''}" data-calendar-mode="month">Monat</button>
      </div>
      <div class="packtisch-calendar-nav">
        <button type="button" class="btn btn-secondary btn-compact" data-calendar-nav="prev" aria-label="Zurück">‹</button>
        <strong class="packtisch-calendar-range">${escapeHtml(rangeLabel)}</strong>
        <button type="button" class="btn btn-secondary btn-compact" data-calendar-nav="next" aria-label="Weiter">›</button>
      </div>
    </div>
    <div class="packtisch-calendar-weekdays" aria-hidden="true">
      <span>Mo</span><span>Di</span><span>Mi</span><span>Do</span><span>Fr</span><span>Sa</span><span>So</span>
    </div>
    <div class="packtisch-calendar-grid" role="list">
      ${cells.map((cell) => {
        const count = counts.get(cell.iso) || 0;
        const classes = [
          'packtisch-calendar-day',
          cell.inMonth ? '' : 'is-outside',
          cell.isToday ? 'is-today' : '',
          selected === cell.iso ? 'is-selected' : '',
          count > 0 ? 'has-orders' : '',
        ].filter(Boolean).join(' ');
        const aria = `${formatCalendarDayHeading(cell.iso)}: ${count} Bestellung${count === 1 ? '' : 'en'}`;
        return `
          <button type="button" class="${classes}" data-calendar-day="${escapeHtml(cell.iso)}" role="listitem" aria-label="${escapeHtml(aria)}" aria-pressed="${selected === cell.iso ? 'true' : 'false'}">
            <span class="packtisch-calendar-day-num">${escapeHtml(formatCalendarCellLabel(cell.iso))}</span>
            <span class="packtisch-calendar-day-count">${count > 0 ? escapeHtml(String(count)) : '·'}</span>
          </button>
        `;
      }).join('')}
    </div>
    <div class="packtisch-calendar-legend">
      <p class="customer-order-hint">${selected
    ? `Abholtag: <strong>${escapeHtml(formatCalendarDayHeading(selected))}</strong> · ${(counts.get(selected) || 0)} Bestellung${(counts.get(selected) || 0) === 1 ? '' : 'en'}`
    : 'Tippe auf einen Tag, um die Bestellungen zu sehen.'}</p>
      ${selected
    ? '<button type="button" class="btn btn-secondary btn-compact" data-calendar-clear>Alle Tage zeigen</button>'
    : ''}
    </div>
  `;
}

function renderOpenOrders() {
  const list = document.getElementById('customer-order-list');
  const empty = document.getElementById('customer-order-empty');
  if (!list) return;

  renderPacktischCalendar();
  const open = ordersForPacktischList();

  if (open.length === 0) {
    list.innerHTML = '';
    if (empty) {
      empty.classList.remove('hidden');
      empty.textContent = orderState.selectedPickupDayIso
        ? `Keine Bestellungen für ${formatCalendarDayHeading(orderState.selectedPickupDayIso)}.`
        : 'Keine offenen Kundenbestellungen.';
    }
    return;
  }
  empty?.classList.add('hidden');
  list.innerHTML = open.map((o) => renderOrderCard(o)).join('');
}

function renderAdminOrders() {
  const list = document.getElementById('admin-customer-order-list');
  if (!list) return;

  const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const visible = sortOrdersForPacktisch(
    orderState.allOrders.filter((o) => {
      if (ACTIVE_ORDER_STATUSES.has(orderStatus(o))) return true;
      const ts = toEpochMs(o.pickedUpAt || o.readyMarkedAt || o.acceptedAt || o.createdAt);
      return ts >= cutoff;
    }),
  );

  if (visible.length === 0) {
    list.innerHTML = '<p class="admin-leitstand-hint">Keine Bestellungen im Zeitraum.</p>';
    return;
  }
  list.innerHTML = visible.map((o) => renderOrderCard(o, { adminView: true })).join('');
}

async function uploadOrderSlipFile(file, orderId) {
  const firebase = orderState.getFirebase();
  if (!firebase?.storage) throw new Error('Firebase Storage ist nicht geladen.');
  const tenantId = orderState.tenantId;
  if (!tenantId) throw new Error('Mandant fehlt.');

  const safeName = String(file.name || 'zettel').replace(/[^\w.\-]+/g, '_');
  const path = `tenants/${tenantId}/order_slips/${orderId}_${Date.now()}_${safeName}`;
  const ref = firebase.storage().ref(path);
  const snapshot = await ref.put(file);
  const url = await snapshot.ref.getDownloadURL();
  const mime = String(file.type || '').toLowerCase();
  const type = mime.includes('pdf') || safeName.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image';
  return { type, url };
}

function renderPendingSlipPreview() {
  const preview = document.getElementById('order-slip-preview');
  if (!preview) return;
  if (orderState.pendingSlips.length === 0) {
    preview.innerHTML = '';
    preview.classList.add('hidden');
    return;
  }
  preview.classList.remove('hidden');
  preview.innerHTML = orderState.pendingSlips.map((item, index) => `
    <div class="bulletin-upload-chip">
      <span>${item.type === 'pdf' ? '📄' : '🖼️'} ${escapeHtml(item.name)}</span>
      <button type="button" data-remove-slip="${index}" aria-label="Zettel entfernen">×</button>
    </div>
  `).join('');
}

async function handleOrderSlipFiles(fileList) {
  const files = Array.from(fileList || []).filter((f) => f && f.size > 0);
  for (const file of files) {
    const mime = String(file.type || '').toLowerCase();
    const isPdf = mime.includes('pdf') || file.name.toLowerCase().endsWith('.pdf');
    const isImage = mime.startsWith('image/');
    if (!isPdf && !isImage) {
      window.showToast?.('Nur Bilder und PDFs für Bestellzettel.', 'warning');
      continue;
    }
    orderState.pendingSlips.push({
      name: file.name,
      file,
      type: isPdf ? 'pdf' : 'image',
    });
  }
  renderPendingSlipPreview();
}

async function createOrderFromForm() {
  if (orderState.createInFlight) return;
  const employee = getActiveEmployeeName();
  if (!employee) {
    window.showToast?.('Bitte zuerst als Mitarbeiter anmelden (Name + PIN).', 'warning');
    return;
  }

  let customerName = document.getElementById('order-customer-name')?.value?.trim() || '';
  const callbackPhone = document.getElementById('order-callback-phone')?.value?.trim() || '';
  const customerEmail = document.getElementById('order-customer-email')?.value?.trim() || '';
  const readyDate = readGermanDateField(document.getElementById('order-ready-date')) || '';
  const readyTime = document.getElementById('order-ready-time')?.value?.trim() || '';
  const hasSlips = orderState.pendingSlips.length > 0;

  if (!readyDate || !readyTime) {
    window.showToast?.('Bitte Datum und Uhrzeit für „Bereit“ angeben.', 'warning');
    return;
  }

  let items = readOrderLinesFromDom();
  if (items.length === 0 && hasSlips) {
    items = [{ product: 'Siehe Bestellzettel (Scan)', quantity: '1', unit: 'Aufnahme', weight: null, width: null, lineNotes: null }];
  }
  if (items.length === 0) {
    window.showToast?.('Positionen eintragen oder Bestellzettel fotografieren.', 'warning');
    return;
  }

  if (!customerName) {
    customerName = hasSlips ? 'Bestellzettel (Scan)' : '';
  }
  if (!customerName) {
    window.showToast?.('Bitte Kundennamen eingeben.', 'warning');
    return;
  }
  if (!callbackPhone && !customerEmail && !hasSlips) {
    window.showToast?.('Bitte Rückrufnummer, E-Mail oder Bestellzettel.', 'warning');
    return;
  }

  const readyAt = `${readyDate}T${readyTime}`;
  const orderId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const firebase = orderState.getFirebase();
  const additionalWishes = buildAdditionalWishesText();
  const inputMode = hasSlips ? 'slip_scan' : 'manual';
  const serverTimestamp = firebase?.firestore?.FieldValue?.serverTimestamp
    ? firebase.firestore.FieldValue.serverTimestamp()
    : new Date().toISOString();

  orderState.createInFlight = true;
  setOrderSaveBusy(true, hasSlips ? 'Zettel wird hochgeladen…' : 'Wird gespeichert…');
  setOrderSaveStatus(hasSlips
    ? 'Bestellzettel wird hochgeladen – bitte kurz warten…'
    : 'Bestellung wird gespeichert…');

  try {
    let orderSlipAttachments = [];
    if (hasSlips) {
      window.showToast?.(
        'Bestellzettel wird hochgeladen – bitte kurz warten…',
        'warning',
        5000,
      );
      for (const slip of orderState.pendingSlips) {
        if (!slip.file) continue;
        orderSlipAttachments.push(await uploadOrderSlipFile(slip.file, orderId));
      }
      if (!orderSlipAttachments.length) {
        throw new Error('Bestellzettel fehlt nach dem Upload.');
      }
      setOrderSaveBusy(true, 'Wird gespeichert…');
      setOrderSaveStatus('Zettel ist hochgeladen – Bestellung wird gespeichert…');
    }

    const payload = {
      customerName,
      readyAt,
      items,
      inputMode,
      acceptedBy: employee,
      employeeName: employee,
      acceptedAt: serverTimestamp,
      status: 'open',
      tenantId: orderState.tenantId,
      createdAt: serverTimestamp,
    };
    if (callbackPhone) payload.callbackPhone = callbackPhone;
    if (customerEmail) payload.customerEmail = customerEmail;
    if (additionalWishes) payload.additionalWishes = additionalWishes;
    if (orderSlipAttachments.length) payload.orderSlipAttachments = orderSlipAttachments;

    const result = await writeFirestoreDocOrQueue({
      collectionPath: 'customerOrders',
      docId: orderId,
      op: 'set',
      onlineData: payload,
      queueData: {
        ...payload,
        acceptedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      offlineMessage: 'Bestellung wird synchronisiert, sobald WLAN verfügbar ist.',
    });
    resetOrderForm();
    const successMessage = result === 'queued'
      ? 'Bestellung wird automatisch synchronisiert, sobald WLAN verfügbar ist.'
      : (hasSlips
        ? 'Kundenbestellung mit Bestellzettel gespeichert.'
        : 'Kundenbestellung gespeichert.');
    setOrderSaveStatus(successMessage);
    window.showToast?.(
      successMessage,
      result === 'queued' ? 'warning' : 'success',
      hasSlips ? 5200 : 3000,
    );
  } catch (err) {
    console.error('[CustomerOrders] Speichern fehlgeschlagen:', err);
    const uploadFailed = /Bestellzettel|Zettel|Storage|upload/i.test(String(err?.message || ''));
    const errorMessage = uploadFailed
      ? 'Bestellzettel konnte nicht hochgeladen werden. Bitte erneut versuchen.'
      : 'Bestellung konnte nicht gespeichert werden.';
    setOrderSaveStatus(errorMessage);
    window.showToast?.(errorMessage, 'error', 4500);
  } finally {
    orderState.createInFlight = false;
    setOrderSaveBusy(false);
  }
}

function readNotifyChannelsFromModal() {
  return {
    email: Boolean(document.getElementById('order-notify-email')?.checked),
    sms: Boolean(document.getElementById('order-notify-sms')?.checked),
    whatsapp: Boolean(document.getElementById('order-notify-whatsapp')?.checked),
  };
}

function defaultNotifyChannelsForOrder(order) {
  const existing = normalizeNotifyChannels(order?.notifyChannels);
  const hasEmail = Boolean(order?.customerEmail || order?.customer?.email);
  return {
    email: hasEmail ? existing.email !== false : false,
    sms: false,
    whatsapp: false,
  };
}

function closeOrderNotifyModal() {
  const modal = document.getElementById('order-notify-modal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('hidden', '');
  document.body.classList.remove('modal-open');
  orderState.pendingNotifyAction = null;
}

function openOrderNotifyModal(orderId, mode = 'ready') {
  const order = orderState.allOrders.find((entry) => entry.id === orderId);
  const modal = document.getElementById('order-notify-modal');
  if (!order || !modal) {
    window.showToast?.('Bestellung wurde nicht gefunden.', 'error');
    return;
  }
  if (!getActiveEmployeeName()) {
    window.showToast?.('Bitte zuerst als Mitarbeiter anmelden.', 'warning');
    return;
  }
  orderState.pendingNotifyAction = { mode, orderId };
  const channels = defaultNotifyChannelsForOrder(order);
  const emailEl = document.getElementById('order-notify-email');
  if (emailEl) {
    emailEl.checked = channels.email;
    emailEl.disabled = !Boolean(order.customerEmail || order.customer?.email);
  }
  const title = document.getElementById('order-notify-title');
  if (title) {
    title.textContent = mode === 'notify_again'
      ? 'Kunde erneut benachrichtigen?'
      : 'Bestellung wirklich abholbereit?';
  }
  const summary = document.getElementById('order-notify-summary');
  if (summary) {
    summary.textContent = mode === 'notify_again'
      ? `${customerDisplayName(order)} erneut über die Abholung informieren?`
      : `${customerDisplayName(order)} wirklich als abholbereit markieren? Danach kann eine Nachricht an die Kundin gehen.`;
  }
  const hint = document.getElementById('order-notify-hint');
  if (hint) {
    const parts = [];
    if (!(order.customerEmail || order.customer?.email)) parts.push('Keine E-Mail hinterlegt');
    if (!customerPhone(order)) parts.push('Keine Telefonnummer hinterlegt');
    hint.textContent = parts.length
      ? `${parts.join(' · ')}. SMS/WhatsApp folgen später.`
      : 'Ohne Haken bei „Per E-Mail“ wird niemand benachrichtigt.';
  }
  const skipBtn = document.getElementById('order-notify-skip-btn');
  if (skipBtn) {
    skipBtn.textContent = mode === 'notify_again'
      ? 'Ohne Nachricht schließen'
      : 'Abholbereit ohne Nachricht';
    skipBtn.hidden = mode === 'notify_again';
  }
  const sendBtn = document.getElementById('order-notify-send-btn');
  if (sendBtn) {
    sendBtn.textContent = mode === 'notify_again'
      ? 'Erneut benachrichtigen'
      : 'Abholbereit & benachrichtigen';
  }
  modal.classList.add('is-open');
  modal.removeAttribute('hidden');
  document.body.classList.add('modal-open');
}

async function applyReadyNotifyChannels(orderId, channels, { sendNow = true, markReady = false } = {}) {
  const employee = getActiveEmployeeName();
  if (!employee) {
    window.showToast?.('Bitte zuerst als Mitarbeiter anmelden.', 'warning');
    return;
  }
  const firebase = orderState.getFirebase();
  if (!firebase?.firestore?.FieldValue) {
    window.showToast?.('Bitte kurz warten und erneut versuchen.', 'warning');
    return;
  }
  const order = orderState.allOrders.find((entry) => entry.id === orderId);
  const normalized = normalizeNotifyChannels(channels);
  const skipNotify = !wantsAnyReadyNotify({ notifyChannels: normalized });
  const stamp = firebase.firestore.FieldValue.serverTimestamp();
  let action = 'ready';
  if (markReady && skipNotify) action = 'ready_no_notify';
  else if (markReady && !skipNotify) action = 'ready_notify';
  else if (!markReady && skipNotify) action = 'notify_again_skip';
  else action = 'notify_again';
  const logEntry = buildOrderActionLogEntry(
    action,
    employee,
    skipNotify ? '' : 'E-Mail',
  );
  const nextLog = mergeOrderActionLog(orderActionLogBase(order), logEntry);

  const onlineData = {
    notifyChannels: normalized,
    skipNotify,
    notifySkipped: skipNotify,
    employeeName: employee,
    actionLog: nextLog,
  };
  const queueData = {
    notifyChannels: normalized,
    skipNotify,
    notifySkipped: skipNotify,
    employeeName: employee,
    actionLog: nextLog,
  };

  if (markReady) {
    onlineData.status = 'ready';
    onlineData.readyMarkedBy = employee;
    onlineData.readyMarkedAt = stamp;
    queueData.status = 'ready';
    queueData.readyMarkedBy = employee;
    queueData.readyMarkedAt = new Date().toISOString();
  }

  if (sendNow && !skipNotify) {
    onlineData.readyNotifyAt = stamp;
    onlineData.readyNotifyBy = employee;
    onlineData.readyMarkedBy = employee;
    queueData.readyNotifyAt = new Date().toISOString();
    queueData.readyNotifyBy = employee;
    queueData.readyMarkedBy = employee;
  }

  try {
    orderState.notifyReadyInFlight = true;
    orderState.statusUpdateInFlight = Boolean(markReady);
    orderState.statusUpdateOrderIds.add(orderId);
    renderOpenOrders();
    renderAdminOrders();
    const result = await writeFirestoreDocOrQueue({
      collectionPath: 'customerOrders',
      docId: orderId,
      op: 'update',
      onlineData,
      queueData,
      offlineMessage: 'Wird synchronisiert, sobald WLAN verfügbar ist.',
    });
    orderState.allOrders = orderState.allOrders.map((entry) => {
      if (entry.id !== orderId) return entry;
      const next = {
        ...entry,
        notifyChannels: normalized,
        skipNotify,
        notifySkipped: skipNotify,
        actionLog: nextLog,
        employeeName: employee,
      };
      if (markReady) {
        next.status = 'ready';
        next.readyMarkedBy = employee;
        next.readyMarkedAt = new Date().toISOString();
      }
      if (sendNow && !skipNotify) {
        next.readyNotifyAt = new Date().toISOString();
        next.readyNotifyBy = employee;
        next.readyMarkedBy = employee;
      }
      return next;
    });
    let toast = 'Gespeichert.';
    if (markReady && skipNotify) toast = 'Als Abholbereit markiert – ohne Kunden-Nachricht.';
    else if (markReady) toast = 'Als Abholbereit markiert – Bestätigung geht raus.';
    else if (skipNotify) toast = 'Ohne Kunden-Nachricht geschlossen.';
    else toast = 'Kunde wird über die Abholung informiert.';
    window.showToast?.(
      result === 'queued' ? 'Wird synchronisiert, sobald WLAN verfügbar ist.' : toast,
      result === 'queued' ? 'warning' : 'success',
    );
  } catch (err) {
    console.error('[CustomerOrders] Ready/Notify fehlgeschlagen:', err);
    window.showToast?.('Aktion konnte nicht gespeichert werden. Bitte erneut versuchen.', 'error');
  } finally {
    orderState.statusUpdateOrderIds.delete(orderId);
    orderState.notifyReadyInFlight = false;
    orderState.statusUpdateInFlight = false;
    closeOrderNotifyModal();
    renderOpenOrders();
    renderAdminOrders();
    renderZuschnittliste();
    renderProductionTasks();
  }
}

async function confirmOrderNotifyModal({ skip = false } = {}) {
  const pending = orderState.pendingNotifyAction;
  if (!pending?.orderId) return;
  if (orderState.notifyReadyInFlight || orderState.statusUpdateInFlight) return;
  const channels = skip
    ? { email: false, sms: false, whatsapp: false }
    : readNotifyChannelsFromModal();
  if (pending.mode === 'notify_again') {
    if (skip) {
      closeOrderNotifyModal();
      return;
    }
    await applyReadyNotifyChannels(pending.orderId, channels, { sendNow: true, markReady: false });
    return;
  }
  await applyReadyNotifyChannels(pending.orderId, channels, { sendNow: !skip, markReady: true });
}

function requestMarkOrderReady(orderId) {
  openOrderNotifyModal(orderId, 'ready');
}

function requestNotifyCustomerReadyAgain(orderId) {
  const order = orderState.allOrders.find((entry) => entry.id === orderId);
  if (!order || orderStatus(order) !== 'ready') {
    window.showToast?.('Nur abholbereite Bestellungen können erneut gemeldet werden.', 'warning');
    return;
  }
  openOrderNotifyModal(orderId, 'notify_again');
}

function bindOrderNotifyModal() {
  const modal = document.getElementById('order-notify-modal');
  if (!modal || modal.dataset.notifyBound === '1') return;
  modal.dataset.notifyBound = '1';
  document.getElementById('order-notify-close-btn')?.addEventListener('click', () => {
    closeOrderNotifyModal();
  });
  document.getElementById('order-notify-skip-btn')?.addEventListener('click', () => {
    void confirmOrderNotifyModal({ skip: true });
  });
  document.getElementById('order-notify-send-btn')?.addEventListener('click', () => {
    void confirmOrderNotifyModal({ skip: false });
  });
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeOrderNotifyModal();
  });
}

async function updateOrderStatus(orderId, nextStatus, { action = '' } = {}) {
  if (orderState.statusUpdateInFlight) return;
  const employee = getActiveEmployeeName();
  if (!employee) {
    window.showToast?.('Bitte zuerst als Mitarbeiter anmelden.', 'warning');
    return;
  }

  // Ready läuft immer über das Bestätigungs-/Notify-Modal (Sicherheitsnetz).
  if (nextStatus === 'ready') {
    requestMarkOrderReady(orderId);
    return;
  }

  const firebase = orderState.getFirebase();
  const current = orderState.allOrders.find((entry) => entry.id === orderId);
  const logAction = action
    || (nextStatus === 'in_progress' && orderStatus(current) === 'ready' ? 'reopen' : nextStatus);
  const logEntry = buildOrderActionLogEntry(logAction, employee);
  const nextLog = mergeOrderActionLog(orderActionLogBase(current), logEntry);
  const payload = {
    status: nextStatus,
    employeeName: employee,
    actionLog: nextLog,
  };

  if (nextStatus === 'in_progress') {
    payload.inProgressBy = employee;
    payload.inProgressAt = firebase?.firestore?.FieldValue
      ? firebase.firestore.FieldValue.serverTimestamp()
      : new Date().toISOString();
  } else if (nextStatus === 'picked_up') {
    const order = current;
    if (!order) {
      window.showToast?.('Bestellung wurde nicht gefunden.', 'error');
      return;
    }
    try {
      orderState.statusUpdateInFlight = true;
      orderState.statusUpdateOrderIds.add(orderId);
      renderOpenOrders();
      renderAdminOrders();
      await markOrderPickedUpWithStock(order, employee, { actionLog: nextLog });
      orderState.allOrders = orderState.allOrders.map((entry) => (
        entry.id === orderId
          ? {
            ...entry,
            status: 'picked_up',
            pickedUpBy: employee,
            pickedUpAt: new Date().toISOString(),
            actionLog: nextLog,
          }
          : entry
      ));
      renderOpenOrders();
      renderAdminOrders();
      renderProductionTasks();
      window.showToast?.('Bestellung erfolgreich als abgeholt markiert. Lagerbestand aktualisiert.', 'success');
    } catch (err) {
      console.error('[CustomerOrders] Abholung mit Bestand fehlgeschlagen:', err);
      const message = String(err?.message || '');
      window.showToast?.(
        message.includes('WLAN')
          ? 'Bitte bei WLAN erneut versuchen, damit wir den Bestand aktualisieren können.'
          : 'Bestellung konnte nicht als abgeholt markiert werden. Bitte erneut versuchen.',
        'error',
      );
    } finally {
      orderState.statusUpdateOrderIds.delete(orderId);
      orderState.statusUpdateInFlight = false;
      renderOpenOrders();
      renderAdminOrders();
    }
    return;
  }

  try {
    orderState.statusUpdateInFlight = true;
    orderState.statusUpdateOrderIds.add(orderId);
    const result = await writeFirestoreDocOrQueue({
      collectionPath: 'customerOrders',
      docId: orderId,
      op: 'update',
      onlineData: payload,
      queueData: (() => {
        const q = { status: nextStatus, actionLog: nextLog, employeeName: employee };
        if (nextStatus === 'in_progress') {
          q.inProgressBy = employee;
          q.inProgressAt = new Date().toISOString();
        }
        if (nextStatus === 'picked_up') {
          q.pickedUpBy = employee;
          q.pickedUpAt = new Date().toISOString();
        }
        return q;
      })(),
      offlineMessage: 'Status wird synchronisiert, sobald WLAN verfügbar ist.',
    });
    orderState.allOrders = orderState.allOrders.map((entry) => {
      if (entry.id !== orderId) return entry;
      const next = { ...entry, status: nextStatus, actionLog: nextLog, employeeName: employee };
      if (nextStatus === 'in_progress') {
        next.inProgressBy = employee;
        next.inProgressAt = new Date().toISOString();
      }
      return next;
    });
    renderOpenOrders();
    renderAdminOrders();
    renderZuschnittliste();
    const labels = {
      in_progress: 'auf „In Bearbeitung“ gesetzt',
      picked_up: 'als abgeholt markiert',
      cancelled: 'storniert',
    };
    window.showToast?.(
      result === 'queued'
        ? 'Status wird automatisch synchronisiert, sobald WLAN verfügbar ist.'
        : `Bestellung ${labels[nextStatus] || 'aktualisiert'}.`,
      result === 'queued' ? 'warning' : 'success'
    );
  } catch (err) {
    console.error('[CustomerOrders] Status-Update fehlgeschlagen:', err);
    window.showToast?.('Status konnte nicht gespeichert werden.', 'error');
  } finally {
    orderState.statusUpdateOrderIds.delete(orderId);
    orderState.statusUpdateInFlight = false;
    renderOpenOrders();
    renderAdminOrders();
  }
}

function fillEditLineCard(card, item = {}) {
  if (!card) return;
  const product = card.querySelector('[data-line-product]');
  const quantity = card.querySelector('[data-line-quantity]');
  const unit = card.querySelector('[data-line-unit]');
  const weight = card.querySelector('[data-line-weight]');
  const width = card.querySelector('[data-line-width]');
  const notes = card.querySelector('[data-line-notes]');
  if (product) product.value = item.product || item.name || '';
  if (quantity) {
    quantity.value = item.quantity != null
      ? String(item.quantity)
      : (item.pieces != null ? String(item.pieces) : '');
  }
  if (unit) {
    const unitValue = item.unit || (item.pieces ? 'Stück' : (item.weightKg ? 'kg' : 'Stück'));
    if (![...unit.options].some((opt) => opt.value === unitValue)) {
      const opt = document.createElement('option');
      opt.value = unitValue;
      opt.textContent = unitValue;
      unit.appendChild(opt);
    }
    unit.value = unitValue;
  }
  if (weight) weight.value = item.weight || (item.weightKg ? `${item.weightKg} kg` : '');
  if (width) width.value = item.width || item.cutLabel || '';
  if (notes) notes.value = item.lineNotes || item.note || '';
}

function addEditOrderLine(item = null) {
  const container = document.getElementById('order-edit-lines-container');
  if (!container) return;
  orderState.lineCounter += 1;
  const lineId = `edit_line_${orderState.lineCounter}`;
  container.insertAdjacentHTML('beforeend', buildOrderLineRow(lineId));
  const card = container.querySelector(`[data-order-line="${lineId}"]`);
  if (item) fillEditLineCard(card, item);
}

function readEditOrderLinesFromDom() {
  const cards = document.querySelectorAll('#order-edit-lines-container .order-line-card');
  const items = [];
  cards.forEach((card) => {
    const product = card.querySelector('[data-line-product]')?.value?.trim() || '';
    const quantity = card.querySelector('[data-line-quantity]')?.value?.trim() || '';
    const unit = card.querySelector('[data-line-unit]')?.value?.trim() || '';
    const weight = card.querySelector('[data-line-weight]')?.value?.trim() || '';
    const width = card.querySelector('[data-line-width]')?.value?.trim() || '';
    const lineNotes = card.querySelector('[data-line-notes]')?.value?.trim() || '';
    if (!product && !quantity) return;
    items.push({
      product,
      quantity,
      unit: unit || null,
      weight: weight || null,
      width: width || null,
      lineNotes: lineNotes || null,
    });
  });
  return items;
}

function closeOrderEditModal() {
  const modal = document.getElementById('order-edit-modal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('hidden', '');
  document.body.classList.remove('modal-open');
  orderState.editingOrderId = '';
  const status = document.getElementById('order-edit-status');
  if (status) status.textContent = '';
}

function openOrderEditModal(orderId) {
  const order = orderState.allOrders.find((entry) => entry.id === orderId);
  const modal = document.getElementById('order-edit-modal');
  if (!order || !modal) {
    window.showToast?.('Bestellung wurde nicht gefunden.', 'error');
    return;
  }
  orderState.editingOrderId = orderId;
  document.getElementById('order-edit-id').value = orderId;
  document.getElementById('order-edit-customer-name').value = customerDisplayName(order);
  document.getElementById('order-edit-callback-phone').value = customerPhone(order);
  document.getElementById('order-edit-customer-email').value = order.customerEmail || order.customer?.email || '';
  document.getElementById('order-edit-additional-wishes').value = order.additionalWishes || order.butcherNotes || '';

  const readyIso = orderPickupDayIso(order) || todayIsoLocal();
  const readyTimeMatch = String(order.readyAt || '').match(/T(\d{2}:\d{2})/);
  setGermanDateField(document.getElementById('order-edit-ready-date'), readyIso);
  document.getElementById('order-edit-ready-time').value = readyTimeMatch?.[1] || defaultReadyTimeLocal();

  const container = document.getElementById('order-edit-lines-container');
  if (container) container.innerHTML = '';
  const items = Array.isArray(order.items) ? order.items : [];
  if (items.length) items.forEach((item) => addEditOrderLine(item));
  else addEditOrderLine();

  const title = document.getElementById('order-edit-title');
  if (title) title.textContent = `Bestellung ${orderRefLabel(order)} bearbeiten`;
  const kicker = document.getElementById('order-edit-kicker');
  if (kicker) {
    kicker.textContent = orderStatus(order) === 'ready' || PAST_ORDER_STATUSES.has(orderStatus(order))
      ? 'Wird beim Speichern wieder in Bearbeitung gesetzt'
      : 'Positionen ändern oder ergänzen';
  }

  modal.classList.add('is-open');
  modal.removeAttribute('hidden');
  document.body.classList.add('modal-open');
  initGermanDateInputs(modal);
}

async function saveOrderEditFromModal() {
  if (orderState.editInFlight) return;
  const orderId = orderState.editingOrderId || document.getElementById('order-edit-id')?.value;
  const existing = orderState.allOrders.find((entry) => entry.id === orderId);
  if (!existing) {
    window.showToast?.('Bestellung wurde nicht gefunden.', 'error');
    return;
  }
  const employee = getActiveEmployeeName();
  if (!employee) {
    window.showToast?.('Bitte zuerst als Mitarbeiter anmelden.', 'warning');
    return;
  }

  const customerName = document.getElementById('order-edit-customer-name')?.value?.trim() || '';
  const callbackPhone = document.getElementById('order-edit-callback-phone')?.value?.trim() || '';
  const customerEmail = document.getElementById('order-edit-customer-email')?.value?.trim() || '';
  const readyDate = readGermanDateField(document.getElementById('order-edit-ready-date')) || '';
  const readyTime = document.getElementById('order-edit-ready-time')?.value?.trim() || '';
  const additionalWishes = document.getElementById('order-edit-additional-wishes')?.value?.trim() || '';
  const items = readEditOrderLinesFromDom();

  if (!customerName) {
    window.showToast?.('Bitte Kundennamen eingeben.', 'warning');
    return;
  }
  if (!readyDate || !readyTime) {
    window.showToast?.('Bitte Datum und Uhrzeit für „Bereit“ angeben.', 'warning');
    return;
  }
  if (!items.length) {
    window.showToast?.('Mindestens eine Position eintragen.', 'warning');
    return;
  }
  if (!callbackPhone && !customerEmail) {
    window.showToast?.('Bitte Rückrufnummer oder E-Mail angeben.', 'warning');
    return;
  }

  const prevStatus = orderStatus(existing);
  const shouldReopen = prevStatus === 'ready' || PAST_ORDER_STATUSES.has(prevStatus);
  const logAction = shouldReopen ? 'edited_reopen' : 'edited';
  const logEntry = buildOrderActionLogEntry(logAction, employee);
  const nextLog = mergeOrderActionLog(orderActionLogBase(existing), logEntry);

  const firebase = orderState.getFirebase();
  const serverTimestamp = firebase?.firestore?.FieldValue?.serverTimestamp
    ? firebase.firestore.FieldValue.serverTimestamp()
    : new Date().toISOString();

  const onlineData = {
    customerName,
    readyAt: `${readyDate}T${readyTime}`,
    items,
    employeeName: employee,
    updatedBy: employee,
    updatedAt: serverTimestamp,
    actionLog: nextLog,
  };
  if (callbackPhone) onlineData.callbackPhone = callbackPhone;
  else onlineData.callbackPhone = null;
  if (customerEmail) onlineData.customerEmail = customerEmail;
  else onlineData.customerEmail = null;
  if (additionalWishes) onlineData.additionalWishes = additionalWishes;
  else onlineData.additionalWishes = null;

  if (shouldReopen) {
    onlineData.status = 'in_progress';
    onlineData.inProgressBy = employee;
    onlineData.inProgressAt = serverTimestamp;
  }

  const queueData = {
    ...onlineData,
    updatedAt: new Date().toISOString(),
    actionLog: nextLog,
  };
  if (shouldReopen) {
    queueData.inProgressAt = new Date().toISOString();
  }

  const statusEl = document.getElementById('order-edit-status');
  const saveBtn = document.getElementById('order-edit-save-btn');
  orderState.editInFlight = true;
  if (statusEl) statusEl.textContent = 'Änderungen werden gespeichert…';
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.setAttribute('aria-busy', 'true');
  }

  try {
    const result = await writeFirestoreDocOrQueue({
      collectionPath: 'customerOrders',
      docId: orderId,
      op: 'update',
      onlineData,
      queueData,
      offlineMessage: 'Änderungen werden synchronisiert, sobald WLAN verfügbar ist.',
    });
    orderState.allOrders = orderState.allOrders.map((entry) => {
      if (entry.id !== orderId) return entry;
      const next = {
        ...entry,
        customerName,
        readyAt: `${readyDate}T${readyTime}`,
        items,
        callbackPhone: callbackPhone || null,
        customerEmail: customerEmail || null,
        additionalWishes: additionalWishes || null,
        updatedBy: employee,
        updatedAt: new Date().toISOString(),
        actionLog: nextLog,
      };
      if (shouldReopen) {
        next.status = 'in_progress';
        next.inProgressBy = employee;
        next.inProgressAt = new Date().toISOString();
      }
      return next;
    });
    closeOrderEditModal();
    orderState.expandedPackOrderId = orderId;
    renderOpenOrders();
    renderAdminOrders();
    renderZuschnittliste();
    renderProductionTasks();
    window.showToast?.(
      result === 'queued'
        ? 'Änderungen werden synchronisiert, sobald WLAN verfügbar ist.'
        : (shouldReopen
          ? 'Bestellung aktualisiert und wieder in Bearbeitung.'
          : 'Bestellung aktualisiert.'),
      result === 'queued' ? 'warning' : 'success',
    );
  } catch (err) {
    console.error('[CustomerOrders] Bestellung bearbeiten fehlgeschlagen:', err);
    if (statusEl) statusEl.textContent = 'Speichern fehlgeschlagen – bitte erneut versuchen.';
    window.showToast?.('Änderungen konnten nicht gespeichert werden.', 'error');
  } finally {
    orderState.editInFlight = false;
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.setAttribute('aria-busy', 'false');
    }
  }
}

function formatKgLabel(kg) {
  return `${formatQuantityValue(kg)} kg`;
}

function renderZuschnittlisteBody(agg) {
  const sections = [];
  sections.push(`
    <section class="zuschnittliste-section">
      <h3>Hackfleisch (Wolf)</h3>
      ${agg.hackfleisch.lines === 0
    ? '<p class="zuschnittliste-empty">Kein Hackfleisch für diesen Tag.</p>'
    : `<div class="zuschnittliste-grid">
          <div class="zuschnittliste-row"><span>Frischpackung (Beutel)</span><strong>${escapeHtml(formatKgLabel(agg.hackfleisch.frischpackungKg))}</strong></div>
          <div class="zuschnittliste-row"><span>Lose / VB</span><strong>${escapeHtml(formatKgLabel(agg.hackfleisch.loseKg))}</strong></div>
          <div class="zuschnittliste-row"><span>Gesamt</span><strong>${escapeHtml(formatKgLabel(agg.hackfleisch.totalKg))}</strong></div>
          ${agg.hackfleisch.tkPortions
    ? `<div class="zuschnittliste-row"><span>davon TK-Portionen</span><strong><span class="zuschnittliste-tk">TK</span> ${agg.hackfleisch.tkPortions}</strong></div>`
    : ''}
        </div>`}
    </section>
  `);

  sections.push(`
    <section class="zuschnittliste-section">
      <h3>Stückware / Steaks (nach Schnittstärke)</h3>
      ${!agg.steaks.length
    ? '<p class="zuschnittliste-empty">Keine Steaks/Stückware für diesen Tag.</p>'
    : `<div class="zuschnittliste-grid">${agg.steaks.map((row) => `
          <div class="zuschnittliste-row">
            <span>${escapeHtml(row.product)} · ${escapeHtml(row.label)}${row.tkPieces ? ' <span class="zuschnittliste-tk">TK</span>' : ''}</span>
            <strong>${escapeHtml(formatQuantityValue(row.pieces))} Stück${row.tkPieces ? ` (davon ${row.tkPieces} TK)` : ''}</strong>
          </div>`).join('')}</div>`}
    </section>
  `);

  sections.push(`
    <section class="zuschnittliste-section">
      <h3>Rouladen</h3>
      ${!agg.rouladen.length
    ? '<p class="zuschnittliste-empty">Keine Rouladen für diesen Tag.</p>'
    : `<div class="zuschnittliste-grid">${agg.rouladen.map((row) => `
          <div class="zuschnittliste-row">
            <span>${escapeHtml(row.label)}${row.tkPieces ? ' <span class="zuschnittliste-tk">TK</span>' : ''}</span>
            <strong>${escapeHtml(formatQuantityValue(row.pieces))} Stück${row.tkPieces ? ` (davon ${row.tkPieces} TK)` : ''}</strong>
          </div>`).join('')}</div>`}
    </section>
  `);

  if (agg.other.length) {
    sections.push(`
      <section class="zuschnittliste-section">
        <h3>Weitere Positionen</h3>
        <div class="zuschnittliste-grid">${agg.other.map((row) => `
          <div class="zuschnittliste-row">
            <span>${escapeHtml(row.product)} · ${escapeHtml(row.label)}${row.tkPieces ? ' <span class="zuschnittliste-tk">TK</span>' : ''}</span>
            <strong>${row.kg > 0 ? escapeHtml(formatKgLabel(row.kg)) : `${escapeHtml(formatQuantityValue(row.pieces))} Stück`}</strong>
          </div>`).join('')}</div>
      </section>
    `);
  }

  if (agg.tkPortionTotal > 0) {
    sections.push(`
      <section class="zuschnittliste-section">
        <h3>TK-Kennzeichnung</h3>
        <div class="zuschnittliste-row">
          <span>Positionen mit TK-Wunsch</span>
          <strong><span class="zuschnittliste-tk">TK</span> ${agg.tkPortionTotal}</strong>
        </div>
      </section>
    `);
  }

  return sections.join('');
}

function buildZuschnittPrintHtml(agg) {
  const dayLabel = (() => {
    const parsed = Date.parse(`${agg.dayIso}T12:00:00`);
    if (!Number.isFinite(parsed)) return agg.dayIso;
    return new Date(parsed).toLocaleDateString('de-DE', {
      weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
    });
  })();
  return `
    <article class="zuschnittliste-print-sheet">
      <h1>Sammel-Zuschnittliste</h1>
      <p>Abholtag: <strong>${escapeHtml(dayLabel)}</strong> · ${agg.orderCount} Bestellung${agg.orderCount === 1 ? '' : 'en'}</p>
      <h2>Hackfleisch</h2>
      <table>
        <thead><tr><th>Art</th><th>Menge</th></tr></thead>
        <tbody>
          <tr><td>Frischpackung (Beutel)</td><td>${escapeHtml(formatKgLabel(agg.hackfleisch.frischpackungKg))}</td></tr>
          <tr><td>Lose / VB</td><td>${escapeHtml(formatKgLabel(agg.hackfleisch.loseKg))}</td></tr>
          <tr><td><strong>Gesamt</strong></td><td><strong>${escapeHtml(formatKgLabel(agg.hackfleisch.totalKg))}</strong></td></tr>
          ${agg.hackfleisch.tkPortions ? `<tr><td>davon TK</td><td class="tk-mark">${agg.hackfleisch.tkPortions} Portionen</td></tr>` : ''}
        </tbody>
      </table>
      <h2>Stückware / Steaks</h2>
      <table>
        <thead><tr><th>Artikel / Schnitt</th><th>Stück</th></tr></thead>
        <tbody>
          ${agg.steaks.length
    ? agg.steaks.map((row) => `<tr><td>${escapeHtml(row.product)} – ${escapeHtml(row.label)}${row.tkPieces ? ' <span class="tk-mark">TK</span>' : ''}</td><td>${escapeHtml(formatQuantityValue(row.pieces))}${row.tkPieces ? ` (TK ${row.tkPieces})` : ''}</td></tr>`).join('')
    : '<tr><td colspan="2">–</td></tr>'}
        </tbody>
      </table>
      <h2>Rouladen</h2>
      <table>
        <thead><tr><th>Schnitt</th><th>Stück</th></tr></thead>
        <tbody>
          ${agg.rouladen.length
    ? agg.rouladen.map((row) => `<tr><td>${escapeHtml(row.label)}${row.tkPieces ? ' <span class="tk-mark">TK</span>' : ''}</td><td>${escapeHtml(formatQuantityValue(row.pieces))}</td></tr>`).join('')
    : '<tr><td colspan="2">–</td></tr>'}
        </tbody>
      </table>
      ${agg.other.length ? `
        <h2>Weitere</h2>
        <table>
          <thead><tr><th>Artikel</th><th>Menge</th></tr></thead>
          <tbody>
            ${agg.other.map((row) => `<tr><td>${escapeHtml(row.product)} – ${escapeHtml(row.label)}</td><td>${row.kg > 0 ? escapeHtml(formatKgLabel(row.kg)) : `${escapeHtml(formatQuantityValue(row.pieces))} Stück`}</td></tr>`).join('')}
          </tbody>
        </table>` : ''}
      <p><strong>TK gesamt:</strong> ${agg.tkPortionTotal} Position${agg.tkPortionTotal === 1 ? '' : 'en'}</p>
    </article>
  `;
}

function renderZuschnittliste() {
  const body = document.getElementById('zuschnittliste-body');
  const summary = document.getElementById('zuschnittliste-summary');
  if (!body) return;
  const day = ensureZuschnittDay();
  const agg = generateZuschnittAggregation(orderState.allOrders, day);
  document.querySelectorAll('[data-zuschnitt-day]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.zuschnittDay === day
      || (btn.dataset.zuschnittDay === 'custom' && !['fri', 'sat'].includes(btn.dataset.zuschnittPreset || '')));
  });
  document.querySelectorAll('[data-zuschnitt-preset]').forEach((btn) => {
    const preset = btn.dataset.zuschnittPreset;
    let target = day;
    if (preset === 'fri') target = nextWeekdayIso(5);
    if (preset === 'sat') target = nextWeekdayIso(6);
    btn.classList.toggle('is-active', target === day && preset !== 'date');
  });
  const dateInput = document.getElementById('zuschnittliste-date');
  if (dateInput && readGermanDateField(dateInput) !== day) {
    setGermanDateField(dateInput, day);
  }
  if (summary) {
    summary.textContent = agg.orderCount === 0
      ? 'Für diesen Abholtag liegen keine offenen Zuschnitte vor.'
      : `${agg.orderCount} Bestellung${agg.orderCount === 1 ? '' : 'en'} · ${formatKgLabel(agg.hackfleisch.totalKg)} Hack · ${agg.tkPortionTotal}× TK`;
  }
  body.innerHTML = renderZuschnittlisteBody(agg);
  const printRoot = document.getElementById('zuschnittliste-print-root');
  if (printRoot) printRoot.innerHTML = buildZuschnittPrintHtml(agg);
}

function printZuschnittliste() {
  renderZuschnittliste();
  document.body.classList.add('print-zuschnittliste');
  document.body.classList.remove('print-avery');
  const cleanup = () => {
    document.body.classList.remove('print-zuschnittliste');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
  setTimeout(cleanup, 1000);
}

function setZuschnittDayFromPreset(preset) {
  if (preset === 'fri') orderState.zuschnittDayIso = nextWeekdayIso(5);
  else if (preset === 'sat') orderState.zuschnittDayIso = nextWeekdayIso(6);
  else if (preset === 'today') orderState.zuschnittDayIso = todayIsoLocal();
  renderZuschnittliste();
}

function setOrdersView(view) {
  orderState.ordersView = view;
  const views = {
    aufnahme: document.getElementById('orders-view-aufnahme'),
    zuschnitt: document.getElementById('orders-view-zuschnitt'),
    packtisch: document.getElementById('orders-view-packtisch'),
  };
  Object.entries(views).forEach(([key, el]) => {
    if (!el) return;
    const active = key === view;
    el.classList.toggle('hidden', !active);
    el.hidden = !active;
  });
  document.querySelectorAll('[data-orders-view]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.ordersView === view);
    btn.setAttribute('aria-selected', btn.dataset.ordersView === view ? 'true' : 'false');
  });
  if (view === 'zuschnitt') renderZuschnittliste();
  if (view === 'packtisch') {
    ensureCalendarAnchor();
    renderOpenOrders();
  }
}

function openAveryLabel(orderId) {
  const order = orderState.allOrders.find((entry) => entry.id === orderId);
  const modal = document.getElementById('avery-label-modal');
  const body = document.getElementById('avery-label-print-area');
  if (!order || !modal || !body) {
    window.showToast?.('Etikett konnte nicht geöffnet werden.', 'error');
    return;
  }
  const price = calculateFinalOrderPrice(order);
  const itemsHtml = price.lines.map((line) => `
    <li>${escapeHtml(line.product)} · ${escapeHtml(line.actualLabel || line.orderedLabel || '–')}</li>
  `).join('');
  body.innerHTML = `
    <div class="avery-label-sheet">
      <div class="avery-label-ref">${escapeHtml(orderRefLabel(order))}</div>
      <div class="avery-label-name">${escapeHtml(customerDisplayName(order))}</div>
      <div class="avery-label-meta">${escapeHtml(orderPickupChannelLabel(order))} · ${escapeHtml(formatReadyAt(order.readyAt || order.pickupDate))}</div>
      <ul class="avery-label-items">${itemsHtml || '<li>–</li>'}</ul>
      <div class="avery-label-total">Waage / Endpreis: ${escapeHtml(formatMoneyValue(price.total))}</div>
    </div>
  `;
  modal.classList.add('is-open');
  modal.removeAttribute('hidden');
  document.body.classList.add('modal-open');
}

function closeAveryLabel() {
  const modal = document.getElementById('avery-label-modal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('hidden', '');
  document.body.classList.remove('modal-open');
  document.body.classList.remove('print-avery');
}

function printAveryLabel() {
  document.body.classList.add('print-avery');
  document.body.classList.remove('print-zuschnittliste');
  const cleanup = () => {
    document.body.classList.remove('print-avery');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
  setTimeout(cleanup, 1000);
}

async function saveOrderWeights(orderId) {
  if (orderState.weighSaveInFlight) return;
  const order = orderState.allOrders.find((entry) => entry.id === orderId);
  if (!order) {
    window.showToast?.('Bestellung wurde nicht gefunden.', 'error');
    return;
  }
  const items = (Array.isArray(order.items) ? order.items : []).map((raw, index) => {
    const key = weighDraftKey(orderId, index);
    const draft = orderState.weighDraftByKey.get(key);
    const inputEl = document.querySelector(`[data-actual-weight-order="${CSS.escape(orderId)}"][data-actual-weight-line="${index}"]`);
    const rawVal = draft !== undefined ? draft : (inputEl?.value ?? '');
    const grams = parseQuantityValue(rawVal);
    if (!(grams > 0)) return raw;
    const priced = calculateLinePriceFromWeight(raw, grams);
    return {
      ...raw,
      actualWeightGrams: Math.round(grams),
      actualQuantity: formatQuantityValue(priced.weightKg),
      actualQuantityUnit: 'kg',
      actualQuantityRecordedAt: new Date().toISOString(),
    };
  });

  try {
    orderState.weighSaveInFlight = true;
    const result = await writeFirestoreDocOrQueue({
      collectionPath: 'customerOrders',
      docId: orderId,
      op: 'update',
      onlineData: { items },
      queueData: { items },
      offlineMessage: 'Waagengewichte werden synchronisiert, sobald WLAN verfügbar ist.',
    });
    orderState.allOrders = orderState.allOrders.map((entry) => (
      entry.id === orderId ? { ...entry, items } : entry
    ));
    renderOpenOrders();
    renderAdminOrders();
    window.showToast?.(
      result === 'queued'
        ? 'Gewichte vorgemerkt – wir synchronisieren, sobald WLAN da ist.'
        : 'Waagengewichte gespeichert. Endpreis ist aktualisiert.',
      result === 'queued' ? 'warning' : 'success',
    );
  } catch (err) {
    console.error('[CustomerOrders] Waagengewicht speichern fehlgeschlagen:', err);
    window.showToast?.('Gewichte konnten nicht gespeichert werden. Bitte erneut versuchen.', 'error');
  } finally {
    orderState.weighSaveInFlight = false;
  }
}

function handleWeighInput(event) {
  const input = event.target.closest('[data-actual-weight-order]');
  if (!input) return;
  const orderId = input.dataset.actualWeightOrder;
  const line = Number(input.dataset.actualWeightLine);
  if (!orderId || !Number.isInteger(line)) return;
  orderState.weighDraftByKey.set(weighDraftKey(orderId, line), input.value.trim());
  const grams = parseQuantityValue(input.value);
  const order = orderState.allOrders.find((entry) => entry.id === orderId);
  const item = order?.items?.[line];
  if (!item) return;
  const priced = calculateLinePriceFromWeight(item, grams > 0 ? grams : null);
  const priceEl = document.querySelector(`[data-weigh-price="${CSS.escape(orderId)}-${line}"]`);
  if (priceEl) priceEl.textContent = formatMoneyValue(priced.lineTotal);
}

function bindOrderForm() {
  const form = document.getElementById('customer-order-form');
  if (!form || form.dataset.customerOrdersBound === '1') return;
  form.dataset.customerOrdersBound = '1';

  ensureDefaultOrderLine();
  const readyDate = document.getElementById('order-ready-date');
  const readyTime = document.getElementById('order-ready-time');
  if (readyDate && !readGermanDateField(readyDate)) setGermanDateField(readyDate, todayIsoLocal());
  if (readyTime && !readyTime.value) readyTime.value = defaultReadyTimeLocal();

  document.getElementById('order-add-line-btn')?.addEventListener('click', () => addOrderLine());

  document.getElementById('order-lines-container')?.addEventListener('click', (e) => {
    const lineId = e.target.closest('[data-remove-line]')?.dataset.removeLine;
    if (!lineId) return;
    const card = document.querySelector(`[data-order-line="${lineId}"]`);
    const container = document.getElementById('order-lines-container');
    if (card && container && container.children.length > 1) {
      card.remove();
    } else {
      window.showToast?.('Mindestens eine Position behalten.', 'warning');
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    createOrderFromForm();
  });

  const dropzone = document.getElementById('order-slip-dropzone');
  const fileInput = document.getElementById('order-slip-file-input');
  const preview = document.getElementById('order-slip-preview');

  if (dropzone && fileInput && dropzone.dataset.orderSlipBound !== '1') {
    dropzone.dataset.orderSlipBound = '1';
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('is-dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('is-dragover');
      handleOrderSlipFiles(e.dataTransfer?.files);
    });
    fileInput.addEventListener('change', () => {
      handleOrderSlipFiles(fileInput.files);
      fileInput.value = '';
    });
  }

  preview?.addEventListener('click', (e) => {
    const index = e.target.closest('[data-remove-slip]')?.dataset.removeSlip;
    if (index === undefined) return;
    orderState.pendingSlips.splice(Number(index), 1);
    renderPendingSlipPreview();
  });
}

function bindOrderListActions() {
  const handler = (event) => {
    if (event.target.closest('[data-actual-weight-order]')) return;
    const btn = event.target.closest('[data-order-action]');
    if (!btn) return;
    const orderId = btn.dataset.orderId;
    const action = btn.dataset.orderAction;
    if (!orderId || !action) return;
    if (action === 'toggle_detail') {
      orderState.expandedPackOrderId = orderState.expandedPackOrderId === orderId ? '' : orderId;
      renderOpenOrders();
      renderAdminOrders();
      return;
    }
    if (action === 'cancel') {
      if (!window.confirm('Bestellung wirklich stornieren?')) return;
      updateOrderStatus(orderId, 'cancelled');
      return;
    }
    if (action === 'reopen') {
      orderState.expandedPackOrderId = orderId;
      updateOrderStatus(orderId, 'in_progress', { action: 'reopen' });
      return;
    }
    if (action === 'edit') {
      openOrderEditModal(orderId);
      return;
    }
    if (action === 'notify_ready') {
      requestNotifyCustomerReadyAgain(orderId);
      return;
    }
    if (action === 'in_progress') updateOrderStatus(orderId, 'in_progress');
    if (action === 'ready') requestMarkOrderReady(orderId);
    if (action === 'picked_up') updateOrderStatus(orderId, 'picked_up');
    if (action === 'delivery_note') openDeliveryNote(orderId);
    if (action === 'avery') openAveryLabel(orderId);
    if (action === 'save_weights') saveOrderWeights(orderId);
  };

  const inputHandler = (event) => handleWeighInput(event);

  document.getElementById('customer-order-list')?.addEventListener('click', handler);
  document.getElementById('admin-customer-order-list')?.addEventListener('click', handler);
  document.getElementById('customer-order-list')?.addEventListener('input', inputHandler);
  document.getElementById('admin-customer-order-list')?.addEventListener('input', inputHandler);
}

function bindDeliveryNoteActions() {
  const modal = document.getElementById('delivery-note-modal');
  if (!modal || modal.dataset.deliveryNoteBound === '1') return;
  modal.dataset.deliveryNoteBound = '1';
  document.getElementById('delivery-note-close-btn')?.addEventListener('click', closeDeliveryNote);
  document.getElementById('delivery-note-print-btn')?.addEventListener('click', () => window.print());
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeDeliveryNote();
  });
}

function bindAveryLabelActions() {
  const modal = document.getElementById('avery-label-modal');
  if (!modal || modal.dataset.averyBound === '1') return;
  modal.dataset.averyBound = '1';
  document.getElementById('avery-label-close-btn')?.addEventListener('click', closeAveryLabel);
  document.getElementById('avery-label-print-btn')?.addEventListener('click', printAveryLabel);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeAveryLabel();
  });
}

function bindOrderEditModal() {
  const modal = document.getElementById('order-edit-modal');
  if (!modal || modal.dataset.orderEditBound === '1') return;
  modal.dataset.orderEditBound = '1';
  document.getElementById('order-edit-close-btn')?.addEventListener('click', closeOrderEditModal);
  document.getElementById('order-edit-cancel-btn')?.addEventListener('click', closeOrderEditModal);
  document.getElementById('order-edit-add-line-btn')?.addEventListener('click', () => addEditOrderLine());
  document.getElementById('order-edit-lines-container')?.addEventListener('click', (e) => {
    const lineId = e.target.closest('[data-remove-line]')?.dataset.removeLine;
    if (!lineId) return;
    const card = document.querySelector(`#order-edit-lines-container [data-order-line="${lineId}"]`);
    const container = document.getElementById('order-edit-lines-container');
    if (card && container && container.children.length > 1) card.remove();
    else window.showToast?.('Mindestens eine Position behalten.', 'warning');
  });
  document.getElementById('order-edit-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveOrderEditFromModal();
  });
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeOrderEditModal();
  });
}

function shiftCalendarAnchor(direction) {
  const anchor = ensureCalendarAnchor();
  if (orderState.calendarMode === 'month') {
    const start = startOfMonthIso(anchor);
    const [y, m] = start.split('-').map(Number);
    const next = new Date(y, m - 1 + direction, 1, 12, 0, 0, 0);
    orderState.calendarAnchorIso = todayIsoLocal(next);
  } else {
    orderState.calendarAnchorIso = addDaysIso(anchor, direction * 14);
  }
  renderPacktischCalendar();
}

function bindOrdersViewSwitch() {
  const root = document.getElementById('view-orders')
    || document.getElementById('page-orders')
    || document.getElementById('team-panel-orders');
  if (!root || root.dataset.ordersViewBound === '1') return;
  root.dataset.ordersViewBound = '1';

  root.addEventListener('click', (event) => {
    const viewBtn = event.target.closest('[data-orders-view]');
    if (viewBtn?.dataset.ordersView) {
      setOrdersView(viewBtn.dataset.ordersView);
      return;
    }
    const modeBtn = event.target.closest('[data-calendar-mode]');
    if (modeBtn?.dataset.calendarMode) {
      orderState.calendarMode = modeBtn.dataset.calendarMode === 'month' ? 'month' : '2weeks';
      if (orderState.calendarMode === '2weeks' && !orderState.calendarAnchorIso) {
        orderState.calendarAnchorIso = todayIsoLocal();
      }
      renderPacktischCalendar();
      return;
    }
    const navBtn = event.target.closest('[data-calendar-nav]');
    if (navBtn?.dataset.calendarNav) {
      shiftCalendarAnchor(navBtn.dataset.calendarNav === 'prev' ? -1 : 1);
      return;
    }
    if (event.target.closest('[data-calendar-clear]')) {
      orderState.selectedPickupDayIso = '';
      renderOpenOrders();
      return;
    }
    const dayBtn = event.target.closest('[data-calendar-day]');
    if (dayBtn?.dataset.calendarDay) {
      const day = dayBtn.dataset.calendarDay;
      orderState.selectedPickupDayIso = orderState.selectedPickupDayIso === day ? '' : day;
      renderOpenOrders();
      document.getElementById('customer-order-list')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      return;
    }
    const presetBtn = event.target.closest('[data-zuschnitt-preset]');
    if (presetBtn?.dataset.zuschnittPreset) {
      setZuschnittDayFromPreset(presetBtn.dataset.zuschnittPreset);
      return;
    }
    if (event.target.closest('#zuschnittliste-print-btn')) {
      printZuschnittliste();
    }
  });

  const dateInput = document.getElementById('zuschnittliste-date');
  dateInput?.addEventListener('change', () => {
    const iso = readGermanDateField(dateInput);
    if (iso) {
      orderState.zuschnittDayIso = iso;
      renderZuschnittliste();
    }
  });
}

function bindSammelPicklisteActions() {
  const modal = document.getElementById('sammel-pickliste-modal');
  if (!modal || modal.dataset.sammelPicklisteBound === '1') return;
  modal.dataset.sammelPicklisteBound = '1';

  document.getElementById('sammel-pickliste-open-btn')?.addEventListener('click', openSammelPickliste);
  document.getElementById('sammel-pickliste-close-btn')?.addEventListener('click', closeSammelPickliste);
  document.getElementById('sammel-pickliste-reset-btn')?.addEventListener('click', resetSammelPickliste);
  document.getElementById('sammel-pickliste-ready-btn')?.addEventListener('click', showSammelPicklisteConfirm);
  document.getElementById('sammel-pickliste-confirm-cancel')?.addEventListener('click', hideSammelPicklisteConfirm);
  document.getElementById('sammel-pickliste-confirm-ready')?.addEventListener('click', markSammelPicklisteReady);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeSammelPickliste();
  });
  document.getElementById('sammel-pickliste-body')?.addEventListener('change', (event) => {
    const input = event.target.closest('input[type="checkbox"][data-picklist-key]');
    if (!input) return;
    if (input.checked) {
      orderState.picklistChecked.add(input.dataset.picklistKey);
    } else {
      orderState.picklistChecked.delete(input.dataset.picklistKey);
    }
    renderSammelPickliste();
  });
  document.getElementById('sammel-pickliste-body')?.addEventListener('input', handleActualQuantityInput);
}

function bindProductionTaskActions() {
  const roots = [
    document.getElementById('production-tasks-section'),
    document.getElementById('admin-leitstand-panel'),
  ].filter(Boolean);
  roots.forEach((section) => {
    if (section.dataset.productionTasksBound === '1') return;
    section.dataset.productionTasksBound = '1';
    section.addEventListener('change', (event) => {
      const input = event.target.closest('input[type="checkbox"][data-production-key]');
      if (!input) return;
      if (input.checked) {
        orderState.productionChecked.add(input.dataset.productionKey);
      } else {
        orderState.productionChecked.delete(input.dataset.productionKey);
      }
      renderProductionTasks();
    });
    section.addEventListener('input', handleActualQuantityInput);
  });
}

function handleActualQuantityInput(event) {
  const input = event.target.closest('input[data-actual-quantity-key]');
  if (!input) return;
  const key = input.dataset.actualQuantityKey;
  if (!key) return;
  const fallback = input.dataset.actualQuantityDefault || '';
  orderState.actualQuantityByKey.set(key, input.value.trim());
  input.closest('.actual-quantity-field')?.classList.toggle('is-adjusted', actualQuantityChanged(key, fallback));
}

function subscribeOrders() {
  orderState.ordersUnsubscribe?.();
  const col = ordersCollectionRef();
  if (!col) return;

  orderState.ordersUnsubscribe = col.orderBy('acceptedAt', 'desc').limit(120).onSnapshot(
    (snap) => {
      orderState.allOrders = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      ensureCalendarAnchor();
      renderOpenOrders();
      renderAdminOrders();
      renderProductionTasks();
      renderZuschnittliste();
      if (document.getElementById('sammel-pickliste-modal')?.classList.contains('is-open')) {
        renderSammelPickliste();
      }
    },
    (err) => console.warn('[CustomerOrders] Stream:', err),
  );
}

export function initCustomerOrdersModule(databaseInstance, options = {}) {
  orderState.db = databaseInstance;
  orderState.tenantId = options.tenantId || '';
  orderState.getFirebase = typeof options.getFirebase === 'function' ? options.getFirebase : orderState.getFirebase;

  ensureZuschnittDay();
  bindOrderForm();
  bindOrderListActions();
  bindProductionTaskActions();
  bindDeliveryNoteActions();
  bindAveryLabelActions();
  bindOrderNotifyModal();
  bindOrderEditModal();
  bindOrdersViewSwitch();
  bindSammelPicklisteActions();
  setOrdersView(orderState.ordersView || 'packtisch');
  subscribeOrders();
  initGermanDateInputs(document);
}

export function activateCustomerOrdersTab() {
  ensureDefaultOrderLine();
  ensureZuschnittDay();
  setOrdersView(orderState.ordersView || 'packtisch');
  renderOpenOrders();
  renderAdminOrders();
  renderProductionTasks();
  renderZuschnittliste();
  if (!orderState.ordersUnsubscribe) subscribeOrders();
}

export {
  generateZuschnittAggregation,
  normalizeOrderItem,
  calculateLinePriceFromWeight,
  ORDER_STATUS_LABELS,
  nextStatusInPipeline,
  formatPickupReadyLabel,
  countOrdersByPickupDay,
  buildPacktischCalendarDays,
  formatOrderActionLogLabel,
  mergeOrderActionLog,
  buildOrderActionLogEntry,
  normalizeNotifyChannels,
  wantsAnyReadyNotify,
};
