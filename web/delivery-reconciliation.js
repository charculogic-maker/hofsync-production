/**
 * Soll-Ist-Abgleich: Gemini-Lieferschein gegen gebuchte Wareneingänge
 * (`mhd_liste` / laufende Lieferung) und Stammdaten.
 */

const QTY_EPSILON = 0.011;
const NAME_MATCH_RATIO = 0.82;
const MIN_SUBSTRING = 4;

const STATUS = {
  PERFECT_MATCH: 'PERFECT_MATCH',
  QTY_MISMATCH: 'QTY_MISMATCH',
  NOT_RECORDED: 'NOT_RECORDED',
  UNMAPPED: 'UNMAPPED',
};

const reconciliationState = {
  tenantId: '',
  getFirebase: () => null,
  writeOrQueueFirestore: null,
  getCurrentDeliveryItems: () => [],
  getMhdProducts: () => [],
  getAuthor: () => 'Team',
  showHUD: () => {},
  note: null,
  positions: [],
  sessionReceipts: [],
  sessionMasters: [],
  quantityOverrides: new Map(),
  busy: false,
  ocrInFlight: false,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function normalizeArticleKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  const left = String(a || '');
  const right = String(b || '');
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  if (left.length > 80 || right.length > 80) return Math.max(left.length, right.length);
  const prev = new Array(right.length + 1);
  const cur = new Array(right.length + 1);
  for (let j = 0; j <= right.length; j += 1) prev[j] = j;
  for (let i = 1; i <= left.length; i += 1) {
    cur[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= right.length; j += 1) prev[j] = cur[j];
  }
  return prev[right.length];
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function eanKey(value) {
  const digits = digitsOnly(value);
  return digits.length >= 8 ? digits : '';
}

function readNumber(...values) {
  for (const value of values) {
    if (value == null || value === '') continue;
    const parsed = Number(String(value).replace(',', '.'));
    if (Number.isFinite(parsed)) return parsed;
  }
  return NaN;
}

function readText(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

function nameScore(left, right) {
  const a = normalizeArticleKey(left);
  const b = normalizeArticleKey(right);
  if (!a || !b) return 0;
  if (a === b) return 800;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length >= MIN_SUBSTRING && longer.includes(shorter)) return 600;
  const distance = levenshtein(a, b);
  const ratio = 1 - distance / Math.max(a.length, b.length);
  if (ratio >= NAME_MATCH_RATIO) return 400 + Math.round(ratio * 100);
  return 0;
}

function toParsedItem(entry, index) {
  const quantity = readNumber(entry?.quantity, entry?.menge, entry?.qty);
  return {
    rawName: readText(entry?.rawName, entry?.name, entry?.artikel, entry?.produkt, entry?.product),
    ean: eanKey(entry?.ean || entry?.barcode || entry?.artnr),
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 0,
    unit: readText(entry?.unit, entry?.einheit, entry?.mengeEinheit) || 'Stk',
    unitPrice: readNumber(entry?.unitPrice, entry?.preis, entry?.ekEinzel),
    index,
  };
}

function toRecordedEntry(entry, index, rank) {
  const quantity = readNumber(entry?.quantity, entry?.menge, entry?.qty, entry?.qtyValue, entry?.qtyKg);
  return {
    id: readText(entry?.id, entry?.postenId, entry?.docId) || `recorded-${index}`,
    name: readText(entry?.name, entry?.produkt, entry?.product, entry?.artikel, entry?.rawName),
    ean: eanKey(entry?.ean || entry?.barcode || entry?.scanBarcode),
    quantity: Number.isFinite(quantity) && quantity >= 0 ? quantity : 0,
    unit: readText(entry?.unit, entry?.einheit, entry?.qtyUnit, entry?.mengeEinheit),
    rank,
  };
}

function toMasterEntry(entry, index) {
  if (!entry || typeof entry !== 'object') return null;
  const name = readText(entry?.name, entry?.produkt, entry?.artikel, entry?.product, entry?.bezeichnung);
  const ean = eanKey(entry?.ean || entry?.barcode || entry?.articleNumber || entry?.id);
  const id = readText(entry?.id, entry?.ean, entry?.barcode, name) || `master-${index}`;
  if (!name && !ean) return null;
  return { id, name, ean };
}

function flattenMasterData(masterData) {
  if (!masterData) return [];
  if (Array.isArray(masterData)) {
    return masterData.map(toMasterEntry).filter(Boolean);
  }
  return Object.entries(masterData).map(([key, entry]) => {
    if (!entry || typeof entry !== 'object') return toMasterEntry({ id: key, name: key, ean: key }, 0);
    return toMasterEntry({ ...entry, id: entry.id || key, ean: entry.ean || entry.barcode || key }, 0);
  }).filter(Boolean);
}

function bestRecordedMatch(item, recorded, used) {
  let best = null;
  recorded.forEach((entry, index) => {
    if (used.has(index) || !entry.name && !entry.ean) return;
    let score = 0;
    if (item.ean && entry.ean && item.ean === entry.ean) score = 1000;
    else score = nameScore(item.rawName, entry.name);
    if (!score) return;
    score += Number(entry.rank) || 0;
    if (!best || score > best.score) best = { index, entry, score };
  });
  return best;
}

function bestMasterMatch(item, masters) {
  let best = null;
  masters.forEach((entry) => {
    let score = 0;
    if (item.ean && entry.ean && item.ean === entry.ean) score = 1000;
    else score = nameScore(item.rawName, entry.name);
    if (!score) return;
    if (!best || score > best.score) best = { entry, score };
  });
  return best?.entry || null;
}

/**
 * @param {Array} parsedItems Lieferschein-Positionen
 * @param {Array} recordedEntries gebuchte Wareneingänge / MHD-Liste
 * @param {Array|Object} masterData Stammdaten
 * @returns {Array<{ sourceItem: object, matchedMasterId: string|null, matchedEntryId: string|null, status: string, deltaQuantity: number, recordedQuantity: number, unit: string }>}
 */
export function reconcileDelivery(parsedItems, recordedEntries, masterData) {
  const parsed = (Array.isArray(parsedItems) ? parsedItems : [])
    .map(toParsedItem)
    .filter((item) => item.rawName);
  const recorded = (Array.isArray(recordedEntries) ? recordedEntries : [])
    .map((entry, index) => toRecordedEntry(entry, index, entry?._rank || 0))
    .filter((entry) => entry.name || entry.ean);
  const masters = flattenMasterData(masterData);
  const used = new Set();

  return parsed.map((item) => {
    const hit = bestRecordedMatch(item, recorded, used);
    const master = bestMasterMatch(item, masters);
    if (!hit) {
      const missing = !master;
      return {
        sourceItem: item,
        matchedMasterId: master?.id || null,
        matchedEntryId: null,
        status: missing ? STATUS.UNMAPPED : STATUS.NOT_RECORDED,
        deltaQuantity: item.quantity,
        recordedQuantity: 0,
        unit: item.unit,
      };
    }
    used.add(hit.index);
    const deltaQuantity = Math.round((item.quantity - hit.entry.quantity) * 1000) / 1000;
    const perfect = Math.abs(deltaQuantity) < QTY_EPSILON;
    return {
      sourceItem: item,
      matchedMasterId: master?.id || null,
      matchedEntryId: hit.entry.id,
      status: perfect ? STATUS.PERFECT_MATCH : STATUS.QTY_MISMATCH,
      deltaQuantity: perfect ? 0 : deltaQuantity,
      recordedQuantity: hit.entry.quantity,
      unit: item.unit || hit.entry.unit || 'Stk',
    };
  });
}

function formatAmount(quantity, unit) {
  const value = Number(quantity);
  const label = Number.isFinite(value) ? String(value).replace('.', ',') : '–';
  return `${label} ${unit || 'Stk'}`;
}

function readLocalMasterMap(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalMasterMap(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value || {}));
  } catch (err) {
    console.warn('[DeliveryReconciliation] Stammdaten lokal nicht gespeichert:', err);
  }
}

function collectRecordedEntries() {
  const draft = reconciliationState.getCurrentDeliveryItems() || [];
  const shelf = reconciliationState.getMhdProducts() || [];
  const withRank = (rows, rank) => rows.map((row) => ({ ...row, _rank: rank }));
  const merged = [
    ...withRank(reconciliationState.sessionReceipts, 50),
    ...withRank(draft, 30),
    ...withRank(shelf, 0),
  ];
  return merged.map((row) => {
    const id = readText(row?.id, row?.postenId);
    if (id && reconciliationState.quantityOverrides.has(id)) {
      const quantity = reconciliationState.quantityOverrides.get(id);
      return { ...row, menge: quantity, qty: quantity, qtyValue: quantity, quantity };
    }
    return row;
  });
}

function collectMasterData() {
  return [
    ...reconciliationState.sessionMasters,
    ...flattenMasterData(readLocalMasterMap('charculogic.productMaster.v1')),
    ...flattenMasterData(readLocalMasterMap('charculogic.vpeMaster.v1')),
  ];
}

function supplierFromForm() {
  const select = document.getElementById('we-supplier');
  const custom = document.getElementById('we-supplier-custom');
  const value = String(select?.value || '').trim();
  if (value === '__sonstige__') return String(custom?.value || '').trim();
  return value;
}

function normalizeNote(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const items = Array.isArray(source.items)
    ? source.items
    : (Array.isArray(source) ? source : []);
  const today = new Date().toLocaleDateString('de-DE');
  return {
    supplier: readText(source.supplier, source.lieferant, supplierFromForm()) || 'Lieferant offen',
    invoiceNumber: readText(source.invoiceNumber, source.belegnummer, source.auftragsnr),
    date: readText(source.date, source.datum, source.lieferdatum) || today,
    items,
  };
}

function renderPositionCard(position, index) {
  const name = position.sourceItem.rawName;
  const ean = position.sourceItem.ean ? `EAN ${position.sourceItem.ean}` : 'ohne EAN';
  const unit = position.unit || position.sourceItem.unit || 'Stk';
  let badge = '';
  let tone = 'unmapped';
  let action = '';

  if (position.status === STATUS.PERFECT_MATCH) {
    tone = 'perfect';
    badge = 'Menge und Artikel stimmen';
  } else if (position.status === STATUS.QTY_MISMATCH) {
    tone = 'mismatch';
    badge = `Abweichung: Beleg ${formatAmount(position.sourceItem.quantity, unit)} vs. Gebucht ${formatAmount(position.recordedQuantity, unit)}`;
    action = `
      <label class="delivery-reconciliation-qty-label">
        <span>Menge laut Beleg</span>
        <input type="number" class="gastro-input delivery-reconciliation-qty" data-reconcile-index="${index}" inputmode="decimal" min="0.01" step="any" value="${escapeHtml(position.sourceItem.quantity)}">
      </label>
      <button type="button" class="btn btn-primary delivery-reconciliation-action" data-reconcile-action="correct" data-reconcile-index="${index}">Menge korrigieren</button>
    `;
  } else if (position.status === STATUS.NOT_RECORDED) {
    tone = 'missing';
    badge = 'Fehlt im Laden';
    action = `<button type="button" class="btn btn-primary delivery-reconciliation-action" data-reconcile-action="book" data-reconcile-index="${index}">Als Wareneingang buchen</button>`;
  } else {
    tone = 'unmapped';
    badge = 'Neu';
    action = `<button type="button" class="btn btn-primary delivery-reconciliation-action" data-reconcile-action="book" data-reconcile-index="${index}">In Stammdaten anlegen &amp; buchen</button>`;
  }

  return `
    <article class="delivery-reconciliation-item delivery-reconciliation-item--${tone}">
      <div class="delivery-reconciliation-item-head">
        <strong>${escapeHtml(name)}</strong>
        <span class="delivery-reconciliation-badge">${escapeHtml(badge)}</span>
      </div>
      <p class="delivery-reconciliation-meta-line">${escapeHtml(ean)} · ${escapeHtml(formatAmount(position.sourceItem.quantity, unit))}</p>
      ${action}
    </article>
  `;
}

function missingPositions() {
  return reconciliationState.positions.filter((position) => (
    position.status === STATUS.NOT_RECORDED || position.status === STATUS.UNMAPPED
  ));
}

export function removeReconciliationBoard() {
  document.getElementById('delivery-reconciliation-overlay')?.remove();
}

function renderBoard() {
  const note = reconciliationState.note;
  if (!note) return;
  const host = document.getElementById('delivery-reconciliation-overlay');
  const missing = missingPositions();
  const body = `
    <div class="learn-mode-card delivery-reconciliation-card" role="dialog" aria-modal="true" aria-labelledby="delivery-reconciliation-title">
      <div class="learn-mode-title" id="delivery-reconciliation-title">Soll-Ist Abgleich Board</div>
      <p class="delivery-reconciliation-header">
        <span>${escapeHtml(note.supplier)}</span>
        <span>${escapeHtml(note.date)}</span>
        <span>${note.items.length} Positionen</span>
        ${note.invoiceNumber ? `<span>Beleg ${escapeHtml(note.invoiceNumber)}</span>` : ''}
      </p>
      <div class="delivery-reconciliation-scroll">
        ${reconciliationState.positions.map(renderPositionCard).join('')}
      </div>
      <div class="learn-mode-actions delivery-reconciliation-actions">
        ${missing.length
          ? `<button type="button" class="btn btn-primary delivery-reconciliation-action" data-reconcile-action="book-all">Alle fehlenden Positionen übernehmen</button>`
          : ''}
        <button type="button" class="btn btn-secondary delivery-reconciliation-action" data-reconcile-action="close">Schließen</button>
      </div>
    </div>
  `;
  if (host) {
    host.innerHTML = body;
    return;
  }
  const overlay = document.createElement('div');
  overlay.id = 'delivery-reconciliation-overlay';
  overlay.className = 'learn-mode-overlay';
  overlay.innerHTML = body;
  overlay.addEventListener('click', onBoardClick);
  document.querySelector('.app-container')?.appendChild(overlay);
}

function refreshBoard() {
  if (!reconciliationState.note) return;
  reconciliationState.positions = reconcileDelivery(
    reconciliationState.note.items,
    collectRecordedEntries(),
    collectMasterData(),
  );
  renderBoard();
}

function articleSlug(name) {
  const slug = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || `artikel-${Date.now()}`;
}

async function writeDoc(collectionPath, docId, data, op = 'set') {
  const writeFn = reconciliationState.writeOrQueueFirestore;
  if (typeof writeFn !== 'function') {
    throw new Error('Speichern ist nicht initialisiert.');
  }
  return writeFn({
    collectionPath,
    docId,
    op,
    onlineData: data,
    queueData: data,
    offlineMessage: 'Lieferschein-Abgleich wird synchronisiert, sobald WLAN verfügbar ist.',
  });
}

async function bookPosition(position, index) {
  const item = position.sourceItem;
  const docId = `ls_${articleSlug(item.rawName)}_${Date.now().toString(36)}_${index}`;
  const nowIso = new Date().toISOString();
  const author = reconciliationState.getAuthor() || 'Team';
  const tenantId = reconciliationState.tenantId;
  const note = reconciliationState.note || {};
  await writeDoc('mhd_liste', docId, {
    id: docId,
    postenId: docId,
    ean: item.ean || '',
    barcode: item.ean || '',
    produkt: item.rawName,
    name: item.rawName,
    menge: item.quantity,
    qty: item.quantity,
    eingangMenge: item.quantity,
    mengeEinheit: item.unit,
    einheit: item.unit,
    status: 'aktiv',
    soldOut: false,
    source: 'delivery-reconciliation',
    postentyp: 'wareneingang',
    lieferant: note.supplier || '',
    tenantId,
    wareneingangAt: nowIso,
    erfassungsDatum: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso,
    scannedBy: author,
    kategorie: 'Wareneingang',
  });

  if (position.status === STATUS.UNMAPPED) {
    const masterId = item.ean || articleSlug(item.rawName);
    const masterPayload = {
      id: masterId,
      artikel: item.rawName,
      name: item.rawName,
      ean: item.ean || '',
      barcode: item.ean || '',
      einheit: item.unit,
      unitPrice: Number.isFinite(item.unitPrice) ? item.unitPrice : '',
      lieferant: note.supplier || '',
      updatedAt: nowIso,
    };
    await writeDoc('stammdaten', masterId, masterPayload);
    const local = readLocalMasterMap('charculogic.productMaster.v1');
    local[masterId] = { ...masterPayload, source: 'delivery-reconciliation' };
    writeLocalMasterMap('charculogic.productMaster.v1', local);
    reconciliationState.sessionMasters.push({ id: masterId, name: item.rawName, ean: item.ean });
  }

  reconciliationState.sessionReceipts.push({
    id: docId,
    name: item.rawName,
    produkt: item.rawName,
    ean: item.ean,
    menge: item.quantity,
    qty: item.quantity,
    einheit: item.unit,
  });
}

async function correctPosition(position, index) {
  const input = document.querySelector(`.delivery-reconciliation-qty[data-reconcile-index="${index}"]`);
  const raw = String(input?.value || position.sourceItem.quantity).replace(',', '.');
  const quantity = Number(raw);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    window.showToast?.('Bitte eine Menge größer 0 eintragen.', 'warning');
    return;
  }
  const entryId = position.matchedEntryId;
  const draftAdjusted = typeof reconciliationState.adjustDraftQuantity === 'function'
    && reconciliationState.adjustDraftQuantity(entryId, quantity);
  if (!draftAdjusted && entryId) {
    const nowIso = new Date().toISOString();
    await writeDoc('mhd_liste', entryId, {
      id: entryId,
      menge: quantity,
      qty: quantity,
      eingangMenge: quantity,
      updatedAt: nowIso,
    }, 'update');
  }
  if (entryId) reconciliationState.quantityOverrides.set(entryId, quantity);
  position.sourceItem.quantity = quantity;
}

async function onBoardClick(event) {
  const button = event.target.closest('[data-reconcile-action]');
  if (!button || reconciliationState.busy) return;
  const action = button.dataset.reconcileAction;
  if (action === 'close') {
    removeReconciliationBoard();
    return;
  }
  reconciliationState.busy = true;
  button.disabled = true;
  try {
    if (action === 'book-all') {
      const pending = missingPositions();
      for (let i = 0; i < pending.length; i += 1) {
        await bookPosition(pending[i], i);
      }
      window.showToast?.(`${pending.length} fehlende Positionen übernommen.`, 'success');
    } else {
      const index = Number(button.dataset.reconcileIndex);
      const position = reconciliationState.positions[index];
      if (!position) return;
      if (action === 'correct') {
        await correctPosition(position, index);
        window.showToast?.('Menge auf den Belegwert gesetzt.', 'success');
      } else if (action === 'book') {
        await bookPosition(position, index);
        const label = position.status === STATUS.UNMAPPED
          ? 'Stammdaten angelegt und Wareneingang gebucht.'
          : 'Als Wareneingang gebucht.';
        window.showToast?.(label, 'success');
      }
    }
    refreshBoard();
  } catch (err) {
    console.error('[DeliveryReconciliation] Aktion fehlgeschlagen:', err);
    reconciliationState.showHUD('Abgleich', err?.message || 'Speichern fehlgeschlagen.', '!');
    window.showToast?.(err?.message || 'Speichern fehlgeschlagen.', 'error');
    button.disabled = false;
  } finally {
    reconciliationState.busy = false;
  }
}

export function openParsedDeliveryBoard(payload) {
  reconciliationState.note = normalizeNote(payload);
  reconciliationState.positions = reconcileDelivery(
    reconciliationState.note.items,
    collectRecordedEntries(),
    collectMasterData(),
  );
  renderBoard();
  return reconciliationState.positions;
}

async function handleReconcileFile(file) {
  if (!file || reconciliationState.ocrInFlight) return;
  const upload = await import('./delivery-upload.js');
  if (!upload.isAllowedDeliveryFile(file)) {
    window.showToast?.(upload.mapDeliveryUploadError(new upload.DeliveryUploadError('unsupported-type', 'Unsupported')), 'warning');
    return;
  }
  window.showToast?.('Lieferschein wird analysiert…', 'warning');
  try {
    reconciliationState.ocrInFlight = true;
    const result = await upload.analyzeDeliveryNoteFile({
      file,
      tenantId: reconciliationState.tenantId,
      getFirebase: reconciliationState.getFirebase,
    });
    const raw = result?.raw || {};
    const items = Array.isArray(raw.items) && raw.items.length ? raw.items : (result?.items || []);
    if (!items.length) {
      window.showToast?.('Keine Artikel erkannt.', 'warning');
      return;
    }
    openParsedDeliveryBoard({
      supplier: raw.supplier || raw.lieferant,
      invoiceNumber: raw.invoiceNumber || raw.belegnummer,
      date: raw.date || raw.datum,
      items,
    });
  } catch (err) {
    console.error('[DeliveryReconciliation] OCR fehlgeschlagen:', err);
    const upload = await import('./delivery-upload.js');
    const toast = err instanceof upload.DeliveryUploadError
      ? upload.mapDeliveryUploadError(err)
      : (err?.message || 'Lieferschein konnte nicht gelesen werden.');
    window.showToast?.(toast, 'error');
  } finally {
    reconciliationState.ocrInFlight = false;
  }
}

function bindReconcileScan() {
  const button = document.getElementById('btn-delivery-reconcile-scan');
  const input = document.getElementById('delivery-reconcile-file-input');
  if (!button || !input || button.dataset.reconcileScanBound === '1') return;
  button.dataset.reconcileScanBound = '1';
  button.addEventListener('click', () => {
    input.value = '';
    input.click();
  });
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) handleReconcileFile(file);
  });
}

export function initDeliveryReconciliation(options = {}) {
  reconciliationState.tenantId = options.tenantId || reconciliationState.tenantId;
  reconciliationState.getFirebase = typeof options.getFirebase === 'function' ? options.getFirebase : reconciliationState.getFirebase;
  reconciliationState.writeOrQueueFirestore = options.writeOrQueueFirestore || reconciliationState.writeOrQueueFirestore;
  reconciliationState.getCurrentDeliveryItems = typeof options.getCurrentDeliveryItems === 'function'
    ? options.getCurrentDeliveryItems
    : reconciliationState.getCurrentDeliveryItems;
  reconciliationState.getMhdProducts = typeof options.getMhdProducts === 'function'
    ? options.getMhdProducts
    : reconciliationState.getMhdProducts;
  reconciliationState.adjustDraftQuantity = typeof options.adjustDraftQuantity === 'function'
    ? options.adjustDraftQuantity
    : reconciliationState.adjustDraftQuantity;
  reconciliationState.getAuthor = typeof options.getAuthor === 'function' ? options.getAuthor : reconciliationState.getAuthor;
  reconciliationState.showHUD = typeof options.showHUD === 'function' ? options.showHUD : reconciliationState.showHUD;
  bindReconcileScan();
}
