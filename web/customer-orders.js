/**
 * Kundenbestellungen – Annahme durch alle Mitarbeiter, Übersicht im Büro
 */

import { getTenantCollection } from './tenant-db.js';
import { writeFirestoreDocOrQueue } from './sync.js';
import { getActiveEmployeeName } from './teamboard.js';
import { initGermanDateInputs, readGermanDateField, setGermanDateField } from './date-input.js';

const ORDER_STATUS_LABELS = {
  open: 'Offen',
  ready: 'Bereit',
  picked_up: 'Abgeholt',
  cancelled: 'Storniert',
};

const orderState = {
  db: null,
  tenantId: '',
  getFirebase: () => null,
  ordersUnsubscribe: null,
  allOrders: [],
  lineCounter: 0,
  pendingSlips: [],
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

function renderOrderCard(order, { adminView = false } = {}) {
  const status = order.status || 'open';
  const statusLabel = ORDER_STATUS_LABELS[status] || status;
  const acceptedAt = formatDateTimeDe(order.acceptedAt);
  const readyLabel = formatReadyAt(order.readyAt);
  const contact = [order.callbackPhone, order.customerEmail].filter(Boolean).join(' · ');

  let actions = '';
  if (status === 'open') {
    actions = `
      <button type="button" class="btn btn-primary btn-compact" data-order-action="ready" data-order-id="${escapeHtml(order.id)}">Bereit</button>
      <button type="button" class="btn btn-secondary btn-compact" data-order-action="cancel" data-order-id="${escapeHtml(order.id)}">Stornieren</button>
    `;
  } else if (status === 'ready') {
    actions = `
      <button type="button" class="btn btn-primary btn-compact" data-order-action="picked_up" data-order-id="${escapeHtml(order.id)}">Abgeholt</button>
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
    .filter((o) => o.status === 'open' || o.status === 'ready')
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
      if (o.status === 'open' || o.status === 'ready') return true;
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
    await writeFirestoreDocOrQueue({
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
    window.showToast?.('Kundenbestellung gespeichert.', 'success');
  } catch (err) {
    console.error('[CustomerOrders] Speichern fehlgeschlagen:', err);
    window.showToast?.('Bestellung konnte nicht gespeichert werden.', 'error');
  }
}

async function updateOrderStatus(orderId, nextStatus) {
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
    payload.pickedUpBy = employee;
    payload.pickedUpAt = firebase.firestore.FieldValue.serverTimestamp();
  }

  try {
    await writeFirestoreDocOrQueue({
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
    window.showToast?.(`Bestellung ${labels[nextStatus] || 'aktualisiert'}.`, 'success');
  } catch (err) {
    console.error('[CustomerOrders] Status-Update fehlgeschlagen:', err);
    window.showToast?.('Status konnte nicht gespeichert werden.', 'error');
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
  };

  document.getElementById('customer-order-list')?.addEventListener('click', handler);
  document.getElementById('admin-customer-order-list')?.addEventListener('click', handler);
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
  subscribeOrders();
  initGermanDateInputs(document);
}

export function activateCustomerOrdersTab() {
  ensureDefaultOrderLine();
  renderOpenOrders();
  renderAdminOrders();
  if (!orderState.ordersUnsubscribe) subscribeOrders();
}
