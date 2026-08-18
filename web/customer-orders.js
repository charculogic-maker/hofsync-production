/**
 * Kundenbestellungen – Annahme durch alle Mitarbeiter, Übersicht im Büro
 */

import { getTenantCollection } from './tenant-db.js';
import { writeFirestoreDocOrQueue } from './sync.js';
import { getActiveEmployeeName, postTeamboardBulletin } from './teamboard.js';
import { initGermanDateInputs, readGermanDateField, setGermanDateField } from './date-input.js';

const ORDER_STATUS_LABELS = {
  open: 'Offen',
  pending: 'Offen',
  eingegangen: 'Offen',
  ready: 'Bereit',
  picked_up: 'Abgeholt',
  cancelled: 'Storniert',
};

const OPEN_ORDER_STATUSES = new Set(['open', 'pending', 'eingegangen']);
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
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function todayIsoLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
  if (!readyAt) return '–';
  const parsed = Date.parse(readyAt);
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toLocaleString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return String(readyAt);
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
    const qty = [item.quantity, item.unit].filter(Boolean).join(' ');
    const extras = [item.weight, item.width, item.lineNotes].filter(Boolean).join(' · ');
    return `<li><strong>${escapeHtml(item.product)}</strong> – ${escapeHtml(qty)}${extras ? ` <span class="customer-order-item-meta">(${escapeHtml(extras)})</span>` : ''}</li>`;
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

function productLabelForStock(item) {
  return String(item?.product || item?.produkt || item?.name || 'Artikel').trim() || 'Artikel';
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

function uniqueStockRefsFromSnapshots(...snapshots) {
  const refsByPath = new Map();
  snapshots.forEach((snapshot) => {
    if (!snapshot || snapshot.empty) return;
    snapshot.docs.forEach((docSnap) => {
      const key = docSnap.ref.path || docSnap.id;
      if (key) refsByPath.set(key, docSnap.ref);
    });
  });
  return [...refsByPath.values()];
}

async function findStockDocForOrderItem(item) {
  const col = stockCollectionRef();
  if (!col) return null;

  const directId = stockItemIdFromOrderItem(item);
  if (directId) {
    const snap = await col.doc(directId).get();
    if (snap.exists) return snap.ref;
    throw new Error(`Bestand für ${productLabelForStock(item)} wurde nicht gefunden.`);
  }

  const product = productLabelForStock(item);
  if (!product) return null;

  const [byProdukt, byName] = await Promise.all([
    col.where('produkt', '==', product).limit(2).get(),
    col.where('name', '==', product).limit(2).get(),
  ]);
  const matches = uniqueStockRefsFromSnapshots(byProdukt, byName);
  if (matches.length > 1) {
    throw new Error(`Mehrere Bestände für ${product} gefunden. Bitte im Büro klären.`);
  }
  if (matches.length === 1) return matches[0];

  return null;
}

export async function buildStockDeductionsForItems(items, resolveStockRef) {
  const deductionsByRef = new Map();
  for (const item of items) {
    const amount = quantityForStock(item);
    if (!amount) continue;
    const product = productLabelForStock(item);
    const ref = await resolveStockRef(item);
    if (!ref) {
      throw new Error(`Bestand für ${product} wurde nicht gefunden.`);
    }
    const key = ref.path || ref.id || product;
    const existing = deductionsByRef.get(key);
    if (existing) {
      existing.amount = Math.round((existing.amount + amount) * 1000) / 1000;
      existing.products.add(product);
      continue;
    }
    deductionsByRef.set(key, {
      ref,
      amount,
      products: new Set([product]),
    });
  }
  return [...deductionsByRef.values()].map((deduction) => ({
    ref: deduction.ref,
    amount: deduction.amount,
    product: [...deduction.products].join(', '),
  }));
}

async function prepareStockDeductionsForOrder(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  return buildStockDeductionsForItems(items, findStockDocForOrderItem);
}

async function markOrderPickedUpWithStock(order, employee) {
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
      if (!snap.exists) {
        throw new Error(`Bestand für ${deduction.product} wurde nicht gefunden.`);
      }
      const currentStock = parseQuantityValue(snap.data()?.currentStock);
      if (currentStock < deduction.amount) {
        throw new Error(`Bestand reicht für ${deduction.product} nicht aus.`);
      }
      const nextStock = Math.max(0, Math.round((currentStock - deduction.amount) * 1000) / 1000);
      transaction.update(deduction.ref, {
        currentStock: nextStock,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });

    transaction.update(orderRef, {
      status: 'picked_up',
      pickedUpBy: employee,
      pickedUpAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
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
        const entry = stationItems[station].get(key) || {
          key,
          product,
          unit,
          quantity: 0,
          orderIds: new Set(),
          notes: new Set(),
          refs: [],
        };
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
    const orderedQuantity = parseQuantityValue(item?.quantity);
    const actualQuantity = item?.actualQuantity ? parseQuantityValue(item.actualQuantity) : orderedQuantity;
    const unit = item?.actualQuantityUnit || item?.unit || '';
    const unitPrice = getItemUnitPrice(item, orderedQuantity);
    const lineTotal = Math.round((actualQuantity * unitPrice) * 100) / 100;
    const orderedLabel = [item?.quantity, item?.unit].filter(Boolean).join(' ');
    const actualLabel = [formatQuantityValue(actualQuantity), unit].filter(Boolean).join(' ');
    return {
      product: item?.product || 'Artikel',
      orderedQuantity,
      actualQuantity,
      unit,
      orderedLabel,
      actualLabel,
      unitPrice,
      lineTotal,
      hasActualQuantity: Boolean(item?.actualQuantity),
      notes: [item?.weight, item?.width, item?.lineNotes].filter(Boolean).join(' · '),
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
        <p>Kisten-Zettel</p>
        <h1>${escapeHtml(order.customerName || 'Kunde')}</h1>
        <div>Abholung: ${escapeHtml(formatReadyAt(order.readyAt))}</div>
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
      const onlineUpdate = {
        status: 'ready',
        readyMarkedBy: employee,
        readyMarkedAt: firebase.firestore.FieldValue.serverTimestamp(),
        pickupPlace: 'Laden-Kühlschrank',
      };
      const queuedUpdate = {
        status: 'ready',
        readyMarkedBy: employee,
        readyMarkedAt: new Date().toISOString(),
        pickupPlace: 'Laden-Kühlschrank',
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

function renderOrderCard(order, { adminView = false } = {}) {
  const status = order.status || 'open';
  const statusLabel = ORDER_STATUS_LABELS[status] || status;
  const acceptedAt = formatDateTimeDe(order.acceptedAt);
  const readyLabel = formatReadyAt(order.readyAt);
  const contact = [order.callbackPhone, order.customerEmail].filter(Boolean).join(' · ');
  const isUpdatingThisOrder = orderState.statusUpdateOrderIds.has(order.id);

  let actions = '';
  if (status === 'open') {
    actions = `
      <button type="button" class="btn btn-primary btn-compact" data-order-action="ready" data-order-id="${escapeHtml(order.id)}">Bereit</button>
      <button type="button" class="btn btn-secondary btn-compact" data-order-action="cancel" data-order-id="${escapeHtml(order.id)}">Stornieren</button>
    `;
  } else if (status === 'ready') {
    actions = `
      <button type="button" class="btn btn-primary btn-compact" data-order-action="picked_up" data-order-id="${escapeHtml(order.id)}"${isUpdatingThisOrder ? ' disabled aria-busy="true"' : ''}>${isUpdatingThisOrder ? 'Wird abgeholt...' : 'Als abgeholt markieren'}</button>
      <button type="button" class="btn btn-secondary btn-compact" data-order-action="delivery_note" data-order-id="${escapeHtml(order.id)}">Lieferschein drucken</button>
    `;
  }

  const metaExtra = adminView && status !== 'open'
    ? `<span class="customer-order-meta">${escapeHtml(statusLabel)}</span>`
    : '';

  return `
    <article class="customer-order-card customer-order-card--${escapeHtml(status)}" data-order-id="${escapeHtml(order.id)}">
      <header class="customer-order-card-head">
        <strong>${escapeHtml(order.customerName)}</strong>
        <span class="customer-order-badge">${escapeHtml(statusLabel)}</span>
      </header>
      <p class="customer-order-meta">Angenommen: ${escapeHtml(acceptedAt)} · ${escapeHtml(order.acceptedBy || '–')}</p>
      <p class="customer-order-meta">Bereit: <strong>${escapeHtml(readyLabel)}</strong></p>
      <p class="customer-order-meta">Kontakt: ${escapeHtml(contact || '–')}</p>
      <ul class="customer-order-items">${renderOrderItemsList(order.items)}</ul>
      ${order.orderSlipAttachments?.length ? `<div class="customer-order-slips">${renderOrderSlipAttachments(order.orderSlipAttachments)}</div>` : ''}
      ${order.additionalWishes ? `<p class="customer-order-wishes">${escapeHtml(order.additionalWishes)}</p>` : ''}
      ${metaExtra}
      ${actions ? `<div class="customer-order-actions">${actions}</div>` : ''}
    </article>
  `;
}

function renderOpenOrders() {
  const list = document.getElementById('customer-order-list');
  const empty = document.getElementById('customer-order-empty');
  if (!list) return;

  const open = orderState.allOrders
    .filter((o) => OPEN_ORDER_STATUSES.has(o.status || 'open') || o.status === 'ready')
    .sort((a, b) => toEpochMs(a.readyAt) - toEpochMs(b.readyAt));

  if (open.length === 0) {
    list.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');
  list.innerHTML = open.map((o) => renderOrderCard(o)).join('');
}

function renderAdminOrders() {
  const list = document.getElementById('admin-customer-order-list');
  if (!list) return;

  const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const visible = orderState.allOrders
    .filter((o) => {
      if (OPEN_ORDER_STATUSES.has(o.status || 'open') || o.status === 'ready') return true;
      const ts = toEpochMs(o.pickedUpAt || o.readyMarkedAt || o.acceptedAt);
      return ts >= cutoff;
    })
    .sort((a, b) => toEpochMs(b.acceptedAt) - toEpochMs(a.acceptedAt));

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

  let orderSlipAttachments = [];
  if (hasSlips) {
    try {
      for (const slip of orderState.pendingSlips) {
        if (!slip.file) continue;
        orderSlipAttachments.push(await uploadOrderSlipFile(slip.file, orderId));
      }
    } catch (err) {
      console.error('[CustomerOrders] Zettel-Upload fehlgeschlagen:', err);
      window.showToast?.('Bestellzettel konnte nicht hochgeladen werden.', 'error');
      return;
    }
  }

  const payload = {
    customerName,
    readyAt,
    items,
    inputMode,
    acceptedBy: employee,
    acceptedAt: firebase.firestore.FieldValue.serverTimestamp(),
    status: 'open',
    tenantId: orderState.tenantId,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  if (callbackPhone) payload.callbackPhone = callbackPhone;
  if (customerEmail) payload.customerEmail = customerEmail;
  if (additionalWishes) payload.additionalWishes = additionalWishes;
  if (orderSlipAttachments.length) payload.orderSlipAttachments = orderSlipAttachments;

  try {
    orderState.createInFlight = true;
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
    window.showToast?.(
      result === 'queued'
        ? 'Bestellung wird automatisch synchronisiert, sobald WLAN verfügbar ist.'
        : 'Kundenbestellung gespeichert.',
      result === 'queued' ? 'warning' : 'success'
    );
  } catch (err) {
    console.error('[CustomerOrders] Speichern fehlgeschlagen:', err);
    window.showToast?.('Bestellung konnte nicht gespeichert werden.', 'error');
  } finally {
    orderState.createInFlight = false;
  }
}

async function updateOrderStatus(orderId, nextStatus) {
  if (orderState.statusUpdateInFlight) return;
  const employee = getActiveEmployeeName();
  if (!employee) {
    window.showToast?.('Bitte zuerst als Mitarbeiter anmelden.', 'warning');
    return;
  }

  const firebase = orderState.getFirebase();
  const payload = { status: nextStatus };

  if (nextStatus === 'ready') {
    payload.readyMarkedBy = employee;
    payload.readyMarkedAt = firebase.firestore.FieldValue.serverTimestamp();
  } else if (nextStatus === 'picked_up') {
    const order = orderState.allOrders.find((entry) => entry.id === orderId);
    if (!order) {
      window.showToast?.('Bestellung wurde nicht gefunden.', 'error');
      return;
    }
    try {
      orderState.statusUpdateInFlight = true;
      orderState.statusUpdateOrderIds.add(orderId);
      renderOpenOrders();
      renderAdminOrders();
      await markOrderPickedUpWithStock(order, employee);
      orderState.allOrders = orderState.allOrders.map((entry) => (
        entry.id === orderId
          ? { ...entry, status: 'picked_up', pickedUpBy: employee, pickedUpAt: new Date().toISOString() }
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
    const result = await writeFirestoreDocOrQueue({
      collectionPath: 'customerOrders',
      docId: orderId,
      op: 'update',
      onlineData: payload,
      queueData: (() => {
        const q = { status: nextStatus };
        if (nextStatus === 'ready') {
          q.readyMarkedBy = employee;
          q.readyMarkedAt = new Date().toISOString();
        }
        if (nextStatus === 'picked_up') {
          q.pickedUpBy = employee;
          q.pickedUpAt = new Date().toISOString();
        }
        return q;
      })(),
      offlineMessage: 'Status wird synchronisiert.',
    });
    const labels = { ready: 'als bereit markiert', picked_up: 'als abgeholt markiert', cancelled: 'storniert' };
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
    orderState.statusUpdateInFlight = false;
  }
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
    const btn = event.target.closest('[data-order-action]');
    if (!btn) return;
    const orderId = btn.dataset.orderId;
    const action = btn.dataset.orderAction;
    if (!orderId || !action) return;
    if (action === 'cancel') {
      if (!window.confirm('Bestellung wirklich stornieren?')) return;
      updateOrderStatus(orderId, 'cancelled');
      return;
    }
    if (action === 'ready') updateOrderStatus(orderId, 'ready');
    if (action === 'picked_up') updateOrderStatus(orderId, 'picked_up');
    if (action === 'delivery_note') openDeliveryNote(orderId);
  };

  document.getElementById('customer-order-list')?.addEventListener('click', handler);
  document.getElementById('admin-customer-order-list')?.addEventListener('click', handler);
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
      renderOpenOrders();
      renderAdminOrders();
      renderProductionTasks();
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

  bindOrderForm();
  bindOrderListActions();
  bindProductionTaskActions();
  bindDeliveryNoteActions();
  bindSammelPicklisteActions();
  subscribeOrders();
  initGermanDateInputs(document);
}

export function activateCustomerOrdersTab() {
  ensureDefaultOrderLine();
  renderOpenOrders();
  renderAdminOrders();
  renderProductionTasks();
  if (!orderState.ordersUnsubscribe) subscribeOrders();
}
