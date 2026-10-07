/**
 * Soll-Ist-Abgleich: Gemini-Lieferschein gegen gebuchte Wareneingänge
 * (`mhd_liste` / laufende Lieferung) und Stammdaten.
 */
import { createHttpsCallable } from './firebase-functions.js';
import {
  formatIsoToGerman,
  initGermanDateInputs,
  parseGermanDateToIso,
  setGermanDateField,
} from './date-input.js';

const QTY_EPSILON = 0.011;
const NAME_MATCH_RATIO = 0.82;
const MIN_SUBSTRING = 4;

const STATUS = {
  PERFECT_MATCH: 'PERFECT_MATCH',
  QTY_MISMATCH: 'QTY_MISMATCH',
  NOT_RECORDED: 'NOT_RECORDED',
  UNMAPPED: 'UNMAPPED',
  EXCLUDED: 'EXCLUDED',
};

const EXCLUDED_ARTICLE_NUMBERS = new Set(['99166', '99050', '99270', '99100', '99500', '987003']);
const EXCLUDED_NAME_KEYS = [
  'ifco',
  'pfand',
  'rollwagen',
  'logistikpauschale',
  'buttercroissant',
  'rosinenbroetchen',
  'mueslibroetchen',
];

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
  boardFilter: 'all',
  hideExcluded: true,
  draftId: '',
  storagePath: '',
  reparseInFlight: false,
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

function readPrice(...values) {
  for (const value of values) {
    if (value == null || value === '') continue;
    const cleaned = String(value).replace(/[€\s]/g, '').replace(',', '.');
    const parsed = Number(cleaned);
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

const STATED_PIECE_RE = /(\d{1,4})\s*[x×]\s*\d+(?:[.,]\d+)?\s*(?:g|ml|l)\b/i;

function statedPieceTotal(text) {
  const match = String(text || '').match(STATED_PIECE_RE);
  if (!match) return 0;
  const count = Number(match[1]);
  if (!Number.isFinite(count) || count < 1 || count > 9999) return 0;
  return count;
}

function catchWeightKg(text) {
  const source = String(text || '');
  if (statedPieceTotal(source)) return null;
  const match = source.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i);
  if (!match) return null;
  const kg = Number(String(match[1]).replace(',', '.'));
  return Number.isFinite(kg) && kg > 0 ? kg : null;
}

/**
 * Weiling-Spalte "Gesamt Stück / Gewicht": "3 x 175 g" ist schon 3 Stück.
 * Die Gebindezahl wird damit nicht multipliziert. kg bleibt kg.
 */
export function expandRetailQuantity(entry) {
  const name = readText(entry?.rawName, entry?.n, entry?.name, entry?.artikel, entry?.produkt, entry?.product, entry?.bezeichnung);
  const inhalt = readText(entry?.inhalt, entry?.gebinde, entry?.pack, entry?.beschreibung, entry?.gesamt);
  const text = `${name} ${inhalt}`;
  const unitRaw = readText(entry?.u, entry?.unit, entry?.einheit, entry?.mengeEinheit);
  const unitKey = unitRaw.toLowerCase();
  const declared = readNumber(entry?.totalQuantity, entry?.gesamtStueck);
  const fromText = statedPieceTotal(text);
  const stated = fromText || (Number.isFinite(declared) && declared > 0 ? declared : 0);
  const billedRaw = readNumber(entry?.q, entry?.quantity, entry?.menge, entry?.qty);
  const billedPacks = Number.isFinite(billedRaw) && billedRaw > 0 ? billedRaw : 1;
  const namedKg = catchWeightKg(text);
  const resolvedUnit = (unitKey === 'kg' || namedKg) ? 'kg' : 'Stk';
  const unitPrice = readPrice(entry?.p, entry?.unitPrice, entry?.einzelpreis, entry?.preis, entry?.ekEinzel);
  const totalPrice = readPrice(entry?.t, entry?.totalPrice, entry?.gesamtpreis, entry?.summe, entry?.zeilensumme);
  if (unitPrice > 0 && totalPrice > 0) {
    const calculatedQty = totalPrice / unitPrice;
    const quantity = resolvedUnit === 'kg'
      ? Math.round(calculatedQty * 100) / 100
      : Math.round(calculatedQty);
    if (quantity > 0) {
      return { quantity, unit: resolvedUnit, billedPacks, packMultiplier: 1 };
    }
  }

  if (stated && unitKey !== 'kg') {
    return { quantity: stated, unit: 'Stk', billedPacks, packMultiplier: 1 };
  }

  if (unitKey === 'kg' || namedKg) {
    const kg = unitKey === 'kg' ? billedPacks : namedKg;
    return { quantity: kg, unit: 'kg', billedPacks, packMultiplier: 1 };
  }

  return {
    quantity: billedPacks,
    unit: unitRaw || 'Stk',
    billedPacks,
    packMultiplier: 1,
  };
}

export function isExcludedInventoryItem(entry) {
  if (entry?.excluded === true || entry?.sourceItem?.excluded === true) return true;
  const numbers = [
    entry?.artikelnummer,
    entry?.artnr,
    entry?.artikelNr,
    entry?.articleNumber,
    entry?.sku,
    entry?.itemNumber,
    entry?.nummer,
    entry?.sourceItem?.articleNumber,
  ].map((value) => String(value || '').replace(/\D/g, '')).filter(Boolean);
  const blob = [
    entry?.rawName,
    entry?.name,
    entry?.artikel,
    entry?.produkt,
    entry?.inhalt,
    entry?.sourceItem?.rawName,
  ].filter(Boolean).join(' ');
  for (const match of blob.matchAll(/\b(\d{5,6})\b/g)) numbers.push(match[1]);
  if (numbers.some((value) => EXCLUDED_ARTICLE_NUMBERS.has(value))) return true;
  const key = normalizeArticleKey(blob);
  return EXCLUDED_NAME_KEYS.some((word) => key.includes(word));
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
  const retail = expandRetailQuantity(entry);
  return {
    rawName: readText(entry?.rawName, entry?.n, entry?.name, entry?.artikel, entry?.produkt, entry?.product),
    ean: eanKey(entry?.ean || entry?.barcode || entry?.artnr),
    quantity: retail.quantity,
    unit: retail.unit,
    billedPacks: retail.billedPacks,
    packMultiplier: retail.packMultiplier,
    articleNumber: digitsOnly(readText(entry?.artikelnummer, entry?.artnr, entry?.artikelNr, entry?.sku, entry?.itemNumber)),
    excluded: isExcludedInventoryItem(entry),
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
    if (item.excluded || isExcludedInventoryItem(item)) {
      return {
        sourceItem: item,
        matchedMasterId: null,
        matchedEntryId: null,
        status: STATUS.EXCLUDED,
        deltaQuantity: 0,
        recordedQuantity: 0,
        unit: item.unit,
      };
    }
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
  const packMultiplier = Number(position.sourceItem.packMultiplier) || 1;
  const billedPacks = position.sourceItem.billedPacks;
  const pieceUnit = String(unit).toLowerCase() !== 'kg';
  const qtyAttrs = pieceUnit
    ? 'inputmode="numeric" min="1" step="1"'
    : 'inputmode="decimal" min="0.01" step="0.01"';
  const showsPackMath = packMultiplier > 1
    && Math.abs((Number(billedPacks) * packMultiplier) - Number(position.sourceItem.quantity)) < QTY_EPSILON;
  const packLine = showsPackMath
    ? ` · ${formatAmount(billedPacks, 'VPE')} × ${packMultiplier} = ${formatAmount(position.sourceItem.quantity, 'Stk')}`
    : '';
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
        <input type="number" class="gastro-input delivery-reconciliation-qty" data-reconcile-index="${index}" ${qtyAttrs} value="${escapeHtml(position.sourceItem.quantity)}">
      </label>
      <button type="button" class="btn btn-primary delivery-reconciliation-action" data-reconcile-action="correct" data-reconcile-index="${index}">Menge korrigieren</button>
    `;
  } else if (position.status === STATUS.EXCLUDED) {
    tone = 'excluded';
    badge = 'Pfand / Durchlauf - Nicht verbucht';
    action = '';
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
      <p class="delivery-reconciliation-meta-line">${escapeHtml(ean)} · ${escapeHtml(formatAmount(position.sourceItem.quantity, unit))}${escapeHtml(packLine)}</p>
      ${action}
    </article>
  `;
}

function missingPositions() {
  return reconciliationState.positions.filter((position) => (
    position.status !== STATUS.EXCLUDED
    && (position.status === STATUS.NOT_RECORDED || position.status === STATUS.UNMAPPED)
  ));
}

function boardFilterCounts(positions) {
  const counts = { all: positions.length, issues: 0, match: 0, neu: 0, excluded: 0 };
  positions.forEach((position) => {
    if (position.status === STATUS.EXCLUDED) {
      counts.excluded += 1;
      return;
    }
    if (position.status === STATUS.PERFECT_MATCH) counts.match += 1;
    else if (position.status === STATUS.UNMAPPED) counts.neu += 1;
    else counts.issues += 1;
  });
  counts.all = positions.length - counts.excluded;
  return counts;
}

function matchesBoardFilter(position) {
  const filter = reconciliationState.boardFilter || 'all';
  if (position.status === STATUS.EXCLUDED) {
    if (filter === 'excluded') return true;
    return !reconciliationState.hideExcluded && filter === 'all';
  }
  if (filter === 'excluded') return false;
  if (filter === 'match') return position.status === STATUS.PERFECT_MATCH;
  if (filter === 'neu') return position.status === STATUS.UNMAPPED;
  if (filter === 'issues') {
    return position.status === STATUS.QTY_MISMATCH || position.status === STATUS.NOT_RECORDED;
  }
  return true;
}

function renderFilterButton(id, label, count, active) {
  return `<button type="button" class="delivery-reconciliation-filter${active ? ' is-active' : ''}" data-reconcile-filter="${id}" aria-pressed="${active ? 'true' : 'false'}">${label} (${count})</button>`;
}

export function removeReconciliationBoard() {
  reconciliationState.reparseInFlight = false;
  document.getElementById('delivery-reconciliation-overlay')?.remove();
}

function renderEmptyBoardHint(excludedCount) {
  const total = reconciliationState.positions.length;
  const filter = reconciliationState.boardFilter || 'all';
  const hiddenByCheckbox = reconciliationState.hideExcluded
    && filter === 'all'
    && total > 0
    && excludedCount > 0
    && excludedCount === total;
  if (hiddenByCheckbox) {
    return `<p class="delivery-reconciliation-empty">${excludedCount} Pfand- / Durchlauf-Positionen ausgeblendet. Deaktiviere die Checkbox oben, um sie anzuzeigen.</p>`;
  }
  return '<p class="delivery-reconciliation-empty">Keine Positionen in dieser Ansicht.</p>';
}

function renderBoard() {
  const note = reconciliationState.note;
  if (!note) return;
  const host = document.getElementById('delivery-reconciliation-overlay');
  const missing = missingPositions();
  const counts = boardFilterCounts(reconciliationState.positions);
  const excludedCount = reconciliationState.positions.filter((position) => position.status === STATUS.EXCLUDED).length;
  const activeFilter = reconciliationState.boardFilter || 'all';
  const cards = reconciliationState.positions
    .map((position, index) => ({ position, index }))
    .filter(({ position }) => matchesBoardFilter(position))
    .map(({ position, index }) => renderPositionCard(position, index))
    .join('');
  const body = `
    <div class="learn-mode-card delivery-reconciliation-card" role="dialog" aria-modal="true" aria-labelledby="delivery-reconciliation-title">
      <div class="delivery-reconciliation-head">
        <div class="delivery-reconciliation-title-row">
          <div class="learn-mode-title" id="delivery-reconciliation-title">Soll-Ist Abgleich Board</div>
          ${reconciliationState.draftId ? `<button type="button" class="btn btn-secondary delivery-reconciliation-reparse" data-reconcile-action="reparse" ${reconciliationState.reparseInFlight ? 'disabled' : ''}>🔄 Beleg neu analysieren</button>` : ''}
        </div>
        <p class="delivery-reconciliation-header">
          <span>${escapeHtml(note.supplier)}</span>
          <span>${escapeHtml(note.date)}</span>
          <span>${note.items.length} Positionen</span>
          ${note.invoiceNumber ? `<span>Beleg ${escapeHtml(note.invoiceNumber)}</span>` : ''}
        </p>
        <div class="delivery-reconciliation-filters" role="tablist" aria-label="Statusfilter">
          ${renderFilterButton('all', 'Alle', counts.all, activeFilter === 'all')}
          ${renderFilterButton('issues', '🔴 Abweichung / Fehlt', counts.issues, activeFilter === 'issues')}
          ${renderFilterButton('match', '🟢 Match', counts.match, activeFilter === 'match')}
          ${renderFilterButton('neu', '⚪ Neu', counts.neu, activeFilter === 'neu')}
          ${renderFilterButton('excluded', 'Pfand / Durchlauf', counts.excluded, activeFilter === 'excluded')}
        </div>
        <label class="delivery-reconciliation-exclude" data-reconcile-toggle="hide-excluded">
          <input type="checkbox" ${reconciliationState.hideExcluded ? 'checked' : ''} tabindex="-1">
          Pfand &amp; Durchlauf-Artikel ausblenden${excludedCount ? ` (${excludedCount})` : ''}
        </label>
      </div>
      <div class="delivery-reconciliation-scroll">
        ${cards || renderEmptyBoardHint(excludedCount)}
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

async function callSaveReconciledItems(items) {
  const upload = await import('./delivery-upload.js');
  const firebase = typeof reconciliationState.getFirebase === 'function'
    ? reconciliationState.getFirebase()
    : null;
  const user = await upload.ensureDeliveryNoteAuth(firebase);
  if (!user) {
    throw new Error('Bitte zuerst in HofSync anmelden.');
  }
  const callable = createHttpsCallable('saveReconciledItems', { timeout: 60000 }, firebase);
  const result = await callable({
    items,
    deliveryMeta: {
      supplier: reconciliationState.note?.supplier || '',
      invoiceNumber: reconciliationState.note?.invoiceNumber || '',
      date: reconciliationState.note?.date || '',
    },
  });
  return result?.data || { success: true, count: items.length };
}

function planClientBook(position, index) {
  if (!position || position.status === STATUS.EXCLUDED || position.sourceItem?.excluded) return null;
  const item = position.sourceItem;
  const docId = `ls_${articleSlug(item.rawName)}_${Date.now().toString(36)}_${index}`;
  const nowIso = new Date().toISOString();
  const author = reconciliationState.getAuthor() || 'Team';
  const note = reconciliationState.note || {};
  const createMaster = position.status === STATUS.UNMAPPED;
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
  const requestItem = {
    createMasterData: createMaster,
    mhdData: {
      id: docId,
      ean: item.ean || '',
      produkt: item.rawName,
      name: item.rawName,
      menge: item.quantity,
      qty: item.quantity,
      einheit: item.unit,
      mengeEinheit: item.unit,
      lieferant: note.supplier || '',
      scannedBy: author,
      wareneingangAt: nowIso,
      erfassungsDatum: nowIso,
    },
  };
  if (createMaster) requestItem.masterData = masterPayload;
  return { docId, masterId, masterPayload, item, createMaster, requestItem };
}

function rememberBooked(plan) {
  if (plan.createMaster) {
    const local = readLocalMasterMap('charculogic.productMaster.v1');
    local[plan.masterId] = { ...plan.masterPayload, source: 'delivery-reconciliation' };
    writeLocalMasterMap('charculogic.productMaster.v1', local);
    reconciliationState.sessionMasters.push({ id: plan.masterId, name: plan.item.rawName, ean: plan.item.ean });
  }
  reconciliationState.sessionReceipts.push({
    id: plan.docId,
    name: plan.item.rawName,
    produkt: plan.item.rawName,
    ean: plan.item.ean,
    menge: plan.item.quantity,
    qty: plan.item.quantity,
    einheit: plan.item.unit,
  });
}

async function bookPositions(positions) {
  const plans = positions
    .map((position, index) => planClientBook(position, position.sourceItem?.index ?? index))
    .filter(Boolean);
  if (!plans.length) return 0;
  await callSaveReconciledItems(plans.map((plan) => plan.requestItem));
  plans.forEach(rememberBooked);
  return plans.length;
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
    await callSaveReconciledItems([{
      mhdId: entryId,
      mhdUpdate: { menge: quantity, qty: quantity },
    }]);
  }
  if (entryId) reconciliationState.quantityOverrides.set(entryId, quantity);
  position.sourceItem.quantity = quantity;
}

async function onBoardClick(event) {
  const excludeToggle = event.target.closest('[data-reconcile-toggle="hide-excluded"]');
  if (excludeToggle) {
    event.preventDefault();
    reconciliationState.hideExcluded = !reconciliationState.hideExcluded;
    renderBoard();
    return;
  }
  const filterBtn = event.target.closest('[data-reconcile-filter]');
  if (filterBtn) {
    reconciliationState.boardFilter = filterBtn.dataset.reconcileFilter || 'all';
    renderBoard();
    return;
  }
  const button = event.target.closest('[data-reconcile-action]');
  if (!button || reconciliationState.busy) return;
  const action = button.dataset.reconcileAction;
  if (action === 'close') {
    removeReconciliationBoard();
    return;
  }
  if (action === 'reparse') {
    try {
      await reparseCurrentDraft();
    } catch (err) {
      console.error('[DeliveryReconciliation] Neuanalyse fehlgeschlagen:', err);
      reconciliationState.reparseInFlight = false;
      if (document.getElementById('delivery-reconciliation-overlay')) renderBoard();
      window.showToast?.(err?.message || 'Beleg konnte nicht neu analysiert werden.', 'error');
    }
    return;
  }
  reconciliationState.busy = true;
  button.disabled = true;
  try {
    if (action === 'book-all') {
      const pending = missingPositions().filter((position) => position.status !== STATUS.EXCLUDED);
      await bookPositions(pending);
      window.showToast?.('Positionen & Stammdaten erfolgreich im Laden gebucht!', 'success');
    } else {
      const index = Number(button.dataset.reconcileIndex);
      const position = reconciliationState.positions[index];
      if (!position) return;
      if (action === 'correct') {
        await correctPosition(position, index);
        window.showToast?.('Menge auf den Belegwert gesetzt.', 'success');
      } else if (action === 'book') {
        await bookPositions([position]);
        window.showToast?.('Positionen & Stammdaten erfolgreich im Laden gebucht!', 'success');
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

export function renderReconciliationModal(data) {
  const payload = data && typeof data === 'object' ? data : {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  return openParsedDeliveryBoard({
    draftId: payload.draftId || '',
    storagePath: payload.storagePath || '',
    supplier: payload.supplier || payload.lieferant,
    invoiceNumber: payload.invoiceNumber || payload.belegnummer,
    date: payload.date || payload.datum,
    items,
  });
}

export function openParsedDeliveryBoard(payload) {
  reconciliationState.draftId = payload?.draftId || '';
  reconciliationState.storagePath = payload?.storagePath || '';
  reconciliationState.boardFilter = 'all';
  reconciliationState.hideExcluded = true;
  reconciliationState.note = normalizeNote(payload);
  reconciliationState.positions = reconcileDelivery(
    reconciliationState.note.items,
    collectRecordedEntries(),
    collectMasterData(),
  );
  renderBoard();
  return reconciliationState.positions;
}

export async function reconcileDeliveryNoteFromFile(file) {
  if (!file || reconciliationState.ocrInFlight) return;
  const upload = await import('./delivery-upload.js');
  if (!upload.isAllowedDeliveryFile(file)) {
    window.showToast?.(upload.mapDeliveryUploadError(new upload.DeliveryUploadError('unsupported-type', 'Unsupported')), 'warning');
    return;
  }
  const firebase = typeof reconciliationState.getFirebase === 'function'
    ? reconciliationState.getFirebase()
    : null;
  const user = await upload.ensureDeliveryNoteAuth(firebase);
  if (!user) return;

  try {
    reconciliationState.ocrInFlight = true;
    await upload.enqueueDeliveryNoteAnalysis({
      file,
      tenantId: reconciliationState.tenantId,
      getFirebase: reconciliationState.getFirebase,
    });
    watchDeliveryNoteDrafts();
  } catch (err) {
    console.error('[DeliveryReconciliation] Failed:', err);
    const details = typeof err?.details === 'string' ? err.details.trim() : '';
    const message = String(err?.message || '').trim();
    const internalCode = /^(KI timeout|Network error|Storage upload failed|Unsupported)$/i.test(message);
    const detail = details || (message && !internalCode ? message : '') || upload.mapDeliveryUploadError(err) || 'Unbekannter Fehler';
    upload.showOperatorToast(`Speichern abgebrochen: ${detail}`);
  } finally {
    reconciliationState.ocrInFlight = false;
    upload.hideDeliveryParseProgress();
  }
}

let deliveryDraftUnsubscribe = null;
const deliveryDraftsById = new Map();

function todayIsoDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function selectedDraftDateIso() {
  const el = document.getElementById('delivery-note-draft-date');
  if (!el) return todayIsoDate();
  return el.dataset.isoValue || parseGermanDateToIso(el.value) || todayIsoDate();
}

function draftStatusLabel(draft) {
  if (draft.status === 'processing') return 'Analyse läuft';
  if (draft.status === 'failed') return draft.error || 'Analyse fehlgeschlagen';
  const count = Number(draft.itemCount) || (Array.isArray(draft.items) ? draft.items.length : 0);
  return `${count} Positionen`;
}

function renderDeliveryNoteDraftList(drafts) {
  const list = document.getElementById('delivery-note-draft-list');
  if (!list) return;
  deliveryDraftsById.clear();
  if (!drafts.length) {
    list.innerHTML = '<div class="open-drafts-empty">Keine Lieferschein-Entwürfe an diesem Tag.</div>';
    return;
  }
  list.innerHTML = drafts.map((draft) => {
    deliveryDraftsById.set(draft.id, draft);
    const dateLabel = formatIsoToGerman(draft.deliveryDate) || draft.deliveryDate || '';
    return `
      <button type="button" class="open-draft-card delivery-note-draft-card" data-delivery-draft-id="${escapeHtml(draft.id)}">
        <div class="open-draft-card-title">${escapeHtml(draft.fileName || 'Lieferschein')}</div>
        <div class="open-draft-card-meta">${escapeHtml(dateLabel)} · ${escapeHtml(draftStatusLabel(draft))}</div>
      </button>
    `;
  }).join('');
}

export function openDeliveryNoteDraft(draft) {
  if (!draft) return;
  if (draft.status === 'processing') {
    window.showToast?.('Analyse läuft noch im Hintergrund.', 'info');
    return;
  }
  if (draft.status === 'failed') {
    window.showToast?.(draft.error || 'Analyse fehlgeschlagen.', 'error');
    return;
  }
  const items = Array.isArray(draft.items) ? draft.items : [];
  if (!items.length) {
    window.showToast?.('Keine Artikel im Entwurf.', 'warning');
    return;
  }
  renderReconciliationModal({
    draftId: draft.id,
    storagePath: draft.storagePath || '',
    supplier: draft.supplier || draft.lieferant,
    date: formatIsoToGerman(draft.deliveryDate) || draft.deliveryDate,
    items,
  });
}

async function reparseCurrentDraft() {
  const draftId = String(reconciliationState.draftId || '').trim();
  const firebase = typeof reconciliationState.getFirebase === 'function'
    ? reconciliationState.getFirebase()
    : null;
  if (!draftId || !firebase) {
    window.showToast?.('Dieser Beleg hat keine gespeicherte Datei.', 'warning');
    return;
  }
  const upload = await import('./delivery-upload.js');
  const user = await upload.ensureDeliveryNoteAuth(firebase);
  if (!user) return;
  reconciliationState.reparseInFlight = true;
  renderBoard();
  window.showToast?.('Beleg wird neu analysiert. Das kann eine Minute dauern.', 'info');
  const reprocess = createHttpsCallable('reprocessDeliveryNoteDraft', { timeout: 120000 }, firebase);
  const result = await reprocess({ draftId });
  const data = result?.data || {};
  const items = Array.isArray(data.items) ? data.items : [];
  reconciliationState.reparseInFlight = false;
  if (!document.getElementById('delivery-reconciliation-overlay')) return;
  reconciliationState.note = normalizeNote({
    supplier: reconciliationState.note?.supplier,
    date: formatIsoToGerman(data.deliveryDate) || data.deliveryDate || reconciliationState.note?.date,
    items,
  });
  reconciliationState.boardFilter = 'all';
  refreshBoard();
  window.showToast?.(`${items.length} Positionen aus allen Seiten übernommen.`, 'success');
}

function watchDeliveryNoteDrafts() {
  const list = document.getElementById('delivery-note-draft-list');
  const firebase = typeof reconciliationState.getFirebase === 'function'
    ? reconciliationState.getFirebase()
    : null;
  const tenantId = String(reconciliationState.tenantId || '').trim();
  const deliveryDate = selectedDraftDateIso();
  if (deliveryDraftUnsubscribe) {
    deliveryDraftUnsubscribe();
    deliveryDraftUnsubscribe = null;
  }
  if (!list || !firebase?.firestore || !tenantId || !deliveryDate) {
    if (list) list.innerHTML = '<div class="open-drafts-empty">Belegdatum wählen, sobald der Laden verbunden ist.</div>';
    return;
  }
  deliveryDraftUnsubscribe = firebase.firestore()
    .collection('tenants')
    .doc(tenantId)
    .collection('delivery_note_drafts')
    .where('deliveryDate', '==', deliveryDate)
    .onSnapshot((snapshot) => {
      const drafts = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => String(b.createdAt?.seconds || '').localeCompare(String(a.createdAt?.seconds || '')));
      renderDeliveryNoteDraftList(drafts);
    }, (err) => {
      console.error('[DeliveryReconciliation] Entwürfe konnten nicht geladen werden:', err);
      list.innerHTML = '<div class="open-drafts-empty">Entwürfe sind gerade nicht lesbar.</div>';
    });
}

function bindDeliveryNoteDraftBrowser() {
  const input = document.getElementById('delivery-note-draft-date');
  const list = document.getElementById('delivery-note-draft-list');
  if (!input || !list || input.dataset.draftBrowserBound === '1') return;
  input.dataset.draftBrowserBound = '1';
  initGermanDateInputs(input.parentElement || document);
  setGermanDateField(input, todayIsoDate());
  input.addEventListener('change', () => watchDeliveryNoteDrafts());
  input.addEventListener('blur', () => watchDeliveryNoteDrafts());
  list.addEventListener('click', (event) => {
    const button = event.target.closest('[data-delivery-draft-id]');
    if (!button) return;
    openDeliveryNoteDraft(deliveryDraftsById.get(button.dataset.deliveryDraftId));
  });
  window.addEventListener('hofsync:delivery-draft-queued', (event) => {
    const queuedDate = event.detail?.deliveryDate;
    if (queuedDate) setGermanDateField(input, queuedDate);
    watchDeliveryNoteDrafts();
  });
  watchDeliveryNoteDrafts();
}

export function bindDeliveryReconcileMain() {
  const button = document.getElementById('btn-delivery-reconcile-main');
  const input = document.getElementById('delivery-reconcile-file-input');
  if (!button || !input || button.dataset.reconcileScanBound === '1') return;
  button.dataset.reconcileScanBound = '1';
  button.addEventListener('click', () => {
    input.value = '';
    input.click();
  });
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) reconcileDeliveryNoteFromFile(file);
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
  bindDeliveryReconcileMain();
  bindDeliveryNoteDraftBrowser();
}
