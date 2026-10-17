/**
 * Avery 3475 Zerlege- & Reife-Etikettierung (Modul averyLabels).
 * WG 0460 · Live-A4-Vorschau · Druckliste · Start-Slot für angefangene Bögen.
 */

export const AVERY_LABELS_PER_SHEET = 24;
export const AVERY_MODULE_KEY = 'averyLabels';
const PRINT_BODY_CLASS = 'print-avery-labels';
const STORAGE_KEY = 'charculogic.averyLabels.draft.v1';

/** @typedef {{ id: string, name: string, days: number, tab: 'vv'|'hv'|'frisch'|'innereien', trim?: boolean }} AveryCut */

/** Katalog WG 0460 – Reifetage je Teilstück */
export const AVERY_CUT_CATALOG = Object.freeze([
  // VV · 2 Wochen
  { id: 'vv-entrecote', name: 'Entrecôte', days: 14, tab: 'vv' },
  { id: 'vv-flat-iron', name: 'Flat Iron', days: 14, tab: 'vv' },
  { id: 'vv-denver', name: 'Denver Cut', days: 14, tab: 'vv' },
  { id: 'vv-hochrippe', name: 'Hochrippe / Rostbraten', days: 14, tab: 'vv' },
  { id: 'vv-fehlrippe', name: 'Fehlrippe', days: 14, tab: 'vv' },
  { id: 'vv-brust', name: 'Brust', days: 14, tab: 'vv' },
  { id: 'vv-bug', name: 'Bug / Schulter', days: 14, tab: 'vv' },
  { id: 'vv-nacken', name: 'Nacken', days: 14, tab: 'vv' },
  { id: 'vv-baeckchen', name: 'Bäckchen', days: 14, tab: 'vv' },
  { id: 'vv-vorderhesse', name: 'Vorderhesse', days: 14, tab: 'vv' },
  // HV · 4 Wochen
  { id: 'hv-rumpsteak', name: 'Rumpsteak / Roastbeef', days: 28, tab: 'hv' },
  { id: 'hv-filet', name: 'Filet', days: 28, tab: 'hv' },
  { id: 'hv-tafelspitz', name: 'Tafelspitz', days: 28, tab: 'hv' },
  { id: 'hv-hueftsteak', name: 'Hüftsteak', days: 28, tab: 'hv' },
  { id: 'hv-buergermeister', name: 'Bürgermeisterstück', days: 28, tab: 'hv' },
  { id: 'hv-falsches-filet', name: 'Falsches Filet', days: 28, tab: 'hv' },
  { id: 'hv-flank', name: 'Flanksteak', days: 28, tab: 'hv' },
  { id: 'hv-keule', name: 'Keule Braten', days: 28, tab: 'hv' },
  { id: 'hv-schmorbraten', name: 'Schmorbraten', days: 28, tab: 'hv' },
  { id: 'hv-oberschale', name: 'Oberschale', days: 28, tab: 'hv' },
  { id: 'hv-unterschale', name: 'Unterschale', days: 28, tab: 'hv' },
  // Frisch / Sonder · Tag 0
  { id: 'fr-gulasch', name: 'Gulasch (frisch)', days: 0, tab: 'frisch' },
  { id: 'fr-rouladen', name: 'Rouladen', days: 0, tab: 'frisch' },
  { id: 'fr-beinscheibe', name: 'Beinscheibe', days: 0, tab: 'frisch' },
  { id: 'fr-suppenfleisch', name: 'Suppenfleisch', days: 0, tab: 'frisch' },
  { id: 'fr-sonder', name: 'Sonderzuschnitt', days: 0, tab: 'frisch' },
  // Innereien & BARF
  { id: 'in-leber', name: 'Leber', days: 0, tab: 'innereien' },
  { id: 'in-herz', name: 'Herz', days: 0, tab: 'innereien' },
  { id: 'in-niere', name: 'Niere', days: 0, tab: 'innereien' },
  { id: 'in-zunge', name: 'Zunge', days: 0, tab: 'innereien' },
  { id: 'in-knochen', name: 'Markknochen / BARF', days: 0, tab: 'innereien' },
  // Trimmings R I–R V
  { id: 'tr-r1', name: 'R I Gulasch', days: 0, tab: 'frisch', trim: true },
  { id: 'tr-r2', name: 'R II Hackfleisch', days: 0, tab: 'frisch', trim: true },
  { id: 'tr-r3', name: 'R III Bratwurst', days: 0, tab: 'frisch', trim: true },
  { id: 'tr-r4', name: 'R IV Fett', days: 0, tab: 'frisch', trim: true },
  { id: 'tr-r5', name: 'R V Kernfett', days: 0, tab: 'frisch', trim: true },
]);

export const AVERY_PRESETS = Object.freeze({
  vv: Object.freeze([
    'vv-entrecote', 'vv-flat-iron', 'vv-denver', 'vv-hochrippe', 'vv-fehlrippe',
    'vv-brust', 'vv-bug', 'vv-nacken', 'vv-baeckchen', 'vv-vorderhesse',
  ]),
  hv: Object.freeze([
    'hv-rumpsteak', 'hv-filet', 'hv-tafelspitz', 'hv-hueftsteak', 'hv-buergermeister',
    'hv-falsches-filet', 'hv-flank', 'hv-keule', 'hv-schmorbraten', 'hv-oberschale', 'hv-unterschale',
  ]),
});

const TAB_META = Object.freeze({
  vv: { label: 'VV (2 Wochen)', hint: 'Vorderviertel · Standardreife 14 Tage' },
  hv: { label: 'HV (4 Wochen)', hint: 'Hinterviertel · Standardreife 28 Tage' },
  frisch: { label: 'Frisch / Sonder', hint: 'Tag 0 · ohne Reifebeutel' },
  innereien: { label: 'Innereien & BARF', hint: 'Innereien und BARF-Zuschnitte' },
});

const DEFAULT_HEADER = Object.freeze({
  betrieb: 'StevesHof Hofladen',
  oeko: 'DE-ÖKO-006',
  schlachthof: 'Bio-Schlachthof Stautenhof Willich',
  ohrmarke: '',
  schlachtDatum: '',
  zerlegeDatum: '',
  reifehinweis: 'Trockenreifung im Reifebeutel',
  brand: 'SH',
});

/** @type {{ header: Record<string, string>, queue: Array<{cutId: string, qty: number}>, startSlot: number, activeTab: string, initialized: boolean }} */
const state = {
  header: { ...DEFAULT_HEADER },
  queue: [],
  startSlot: 1,
  activeTab: 'vv',
  initialized: false,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function todayIsoLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** @param {string} iso */
export function formatDateDe(iso) {
  const raw = String(iso || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return raw;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

/** @param {string} iso */
export function formatLotDateStamp(iso) {
  const raw = String(iso || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return todayIsoLocal().replace(/-/g, '');
  return `${m[1]}${m[2]}${m[3]}`;
}

/**
 * LOT = [BRAND]-[OHR]-[YYYYMMDD]
 * @param {{ brand?: string, ohrmarke?: string, schlachtDatum?: string }} header
 */
export function buildAveryLot(header = {}) {
  const brand = String(header.brand || 'SH').trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'SH';
  const ohr = String(header.ohrmarke || '').trim().toUpperCase().replace(/\s+/g, '') || 'OHR';
  const stamp = formatLotDateStamp(header.schlachtDatum || todayIsoLocal());
  return `${brand}-${ohr}-${stamp}`;
}

export function getCutById(cutId) {
  return AVERY_CUT_CATALOG.find((cut) => cut.id === cutId) || null;
}

export function expandQueueToLabels(queue = []) {
  /** @type {AveryCut[]} */
  const labels = [];
  queue.forEach((entry) => {
    const cut = getCutById(entry.cutId);
    if (!cut) return;
    const qty = Math.max(0, Number.parseInt(String(entry.qty), 10) || 0);
    for (let i = 0; i < qty; i += 1) labels.push(cut);
  });
  return labels;
}

/**
 * Plant Offset + Labels für den aktiven Bogen (max. 24 Nutzen).
 * @param {{ queue?: Array<{cutId: string, qty: number}>, startSlot?: number }} input
 */
export function planAverySheet(input = {}) {
  const startSlot = Math.min(AVERY_LABELS_PER_SHEET, Math.max(1, Number.parseInt(String(input.startSlot ?? 1), 10) || 1));
  const allLabels = expandQueueToLabels(input.queue || []);
  const capacity = AVERY_LABELS_PER_SHEET - startSlot + 1;
  const onSheet = allLabels.slice(0, capacity);
  const overflow = Math.max(0, allLabels.length - capacity);
  return {
    startSlot,
    emptyCount: startSlot - 1,
    filledCount: onSheet.length,
    labelsOnSheet: onSheet,
    totalQueued: allLabels.length,
    capacity,
    overflow,
    usage: startSlot - 1 + onSheet.length,
    full: startSlot - 1 + onSheet.length >= AVERY_LABELS_PER_SHEET,
  };
}

function persistDraft() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      header: state.header,
      queue: state.queue,
      startSlot: state.startSlot,
      activeTab: state.activeTab,
    }));
  } catch (_) { /* private mode */ }
}

function restoreDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    if (parsed.header && typeof parsed.header === 'object') {
      state.header = { ...DEFAULT_HEADER, ...parsed.header };
    }
    if (Array.isArray(parsed.queue)) {
      state.queue = parsed.queue
        .map((row) => ({
          cutId: String(row.cutId || ''),
          qty: Math.max(0, Number.parseInt(String(row.qty), 10) || 0),
        }))
        .filter((row) => row.cutId && getCutById(row.cutId) && row.qty > 0);
    }
    if (parsed.startSlot != null) {
      state.startSlot = Math.min(24, Math.max(1, Number.parseInt(String(parsed.startSlot), 10) || 1));
    }
    if (parsed.activeTab && TAB_META[parsed.activeTab]) state.activeTab = parsed.activeTab;
  } catch (_) { /* ignore */ }
}

function ensureHeaderDefaults() {
  if (!state.header.schlachtDatum) state.header.schlachtDatum = todayIsoLocal();
  if (!state.header.zerlegeDatum) state.header.zerlegeDatum = todayIsoLocal();
  const brandFromName = String(window.BRANDING?.betriebsName || state.header.betrieb || 'SH')
    .split(/\s+/)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 4);
  if (!state.header.brand || state.header.brand === 'SH') {
    state.header.brand = brandFromName || 'SH';
  }
  if (window.BRANDING?.betriebsName && state.header.betrieb === DEFAULT_HEADER.betrieb) {
    state.header.betrieb = window.BRANDING.betriebsName;
  }
}

function queueTotalQty() {
  return state.queue.reduce((sum, row) => sum + (Number(row.qty) || 0), 0);
}

function setQueueQty(cutId, qty) {
  const nextQty = Math.max(0, Math.min(999, Number.parseInt(String(qty), 10) || 0));
  const idx = state.queue.findIndex((row) => row.cutId === cutId);
  if (nextQty <= 0) {
    if (idx >= 0) state.queue.splice(idx, 1);
  } else if (idx >= 0) {
    state.queue[idx].qty = nextQty;
  } else {
    state.queue.push({ cutId, qty: nextQty });
  }
  persistDraft();
  renderAll();
}

function addPreset(presetKey) {
  const ids = AVERY_PRESETS[presetKey] || [];
  ids.forEach((cutId) => {
    const existing = state.queue.find((row) => row.cutId === cutId);
    if (existing) existing.qty += 1;
    else state.queue.push({ cutId, qty: 1 });
  });
  persistDraft();
  renderAll();
  window.showToast?.(
    presetKey === 'vv'
      ? 'Komplettes VV (10 Teilstücke) zur Druckliste.'
      : 'Komplettes HV (11 Teilstücke) zur Druckliste.',
    'success',
  );
}

function fillRestWithHack() {
  const plan = planAverySheet({ queue: state.queue, startSlot: state.startSlot });
  const free = AVERY_LABELS_PER_SHEET - plan.usage;
  if (free <= 0) {
    window.showToast?.('Dieser Bogen ist schon voll.', 'info');
    return;
  }
  const existing = state.queue.find((row) => row.cutId === 'tr-r2');
  if (existing) existing.qty += free;
  else state.queue.push({ cutId: 'tr-r2', qty: free });
  persistDraft();
  renderAll();
  window.showToast?.(`Rest mit R II Hack aufgefüllt (+${free}).`, 'success');
}

function buildLabelHtml(cut, header, lot) {
  const reife = cut.days > 0
    ? `Reife ${cut.days} Tage`
    : (header.reifehinweis || 'Frisch');
  return `
    <div class="avery-label-cell">
      <div class="avery-label-farm">${escapeHtml(header.betrieb || '')}</div>
      <div class="avery-label-cut">${escapeHtml(cut.name)}</div>
      <div class="avery-label-lot">LOT ${escapeHtml(lot)}</div>
      <div class="avery-label-meta">Ohr ${escapeHtml(header.ohrmarke || '–')} · Schlacht ${escapeHtml(formatDateDe(header.schlachtDatum))}</div>
      <div class="avery-label-meta">Zerlegt ${escapeHtml(formatDateDe(header.zerlegeDatum))} · ${escapeHtml(reife)}</div>
      <div class="avery-label-footer">${escapeHtml(header.oeko || '')} · ${escapeHtml(header.schlachthof || '')}</div>
    </div>
  `;
}

function renderSheetPreview() {
  const sheet = document.getElementById('avery-sheet-preview');
  const printSheet = document.getElementById('avery-sheet-print');
  const gaugeFill = document.getElementById('avery-gauge-fill');
  const gaugeText = document.getElementById('avery-gauge-text');
  const overflowEl = document.getElementById('avery-overflow-warn');
  if (!sheet) return;

  const lot = buildAveryLot(state.header);
  const plan = planAverySheet({ queue: state.queue, startSlot: state.startSlot });
  const cells = [];
  for (let i = 1; i <= AVERY_LABELS_PER_SHEET; i += 1) {
    const isEmptyOffset = i < state.startSlot;
    const labelIndex = i - state.startSlot;
    const cut = !isEmptyOffset && labelIndex < plan.labelsOnSheet.length
      ? plan.labelsOnSheet[labelIndex]
      : null;
    const used = Boolean(cut);
    const free = !isEmptyOffset && !used;
    let cls = 'avery-slot';
    if (isEmptyOffset) cls += ' is-offset';
    else if (used) cls += ' is-filled';
    else cls += ' is-free';
    if (i === state.startSlot) cls += ' is-start';
    const inner = cut
      ? buildLabelHtml(cut, state.header, lot)
      : `<span class="avery-slot-num">${i}</span>`;
    cells.push(`<button type="button" class="${cls}" data-avery-slot="${i}" aria-label="Start-Slot ${i}">${inner}</button>`);
  }
  sheet.innerHTML = cells.join('');

  if (printSheet) {
    const printCells = [];
    for (let i = 0; i < plan.emptyCount; i += 1) {
      printCells.push('<div class="avery-label empty" aria-hidden="true"></div>');
    }
    plan.labelsOnSheet.forEach((cut) => {
      printCells.push(`<div class="avery-label">${buildLabelHtml(cut, state.header, lot)}</div>`);
    });
    printSheet.innerHTML = printCells.join('');
  }

  const usagePct = Math.round((plan.usage / AVERY_LABELS_PER_SHEET) * 100);
  if (gaugeFill) gaugeFill.style.width = `${Math.min(100, usagePct)}%`;
  if (gaugeText) {
    gaugeText.textContent = `${plan.usage} / ${AVERY_LABELS_PER_SHEET} Nutzen · Start ${state.startSlot}`;
  }
  if (overflowEl) {
    if (plan.overflow > 0) {
      overflowEl.hidden = false;
      overflowEl.textContent = `Überlauf: ${plan.overflow} Etikett${plan.overflow === 1 ? '' : 'en'} passen nicht mehr auf diesen Bogen.`;
    } else {
      overflowEl.hidden = true;
      overflowEl.textContent = '';
    }
  }
}

function renderQueue() {
  const tbody = document.getElementById('avery-queue-body');
  const totalEl = document.getElementById('avery-queue-total');
  if (!tbody) return;
  if (!state.queue.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="avery-queue-empty">Noch keine Teilstücke in der Druckliste.</td></tr>';
  } else {
    tbody.innerHTML = state.queue.map((row) => {
      const cut = getCutById(row.cutId);
      const name = cut?.name || row.cutId;
      const days = cut ? (cut.days > 0 ? `${cut.days} T` : 'frisch') : '';
      return `
        <tr data-queue-cut="${escapeHtml(row.cutId)}">
          <td>
            <strong>${escapeHtml(name)}</strong>
            <span class="avery-queue-days">${escapeHtml(days)}</span>
          </td>
          <td class="avery-queue-stepper">
            <button type="button" class="btn btn-secondary btn-compact" data-avery-qty="-1" aria-label="Weniger">−</button>
            <span class="avery-queue-qty">${row.qty}</span>
            <button type="button" class="btn btn-secondary btn-compact" data-avery-qty="1" aria-label="Mehr">+</button>
          </td>
          <td>
            <button type="button" class="btn btn-secondary btn-compact" data-avery-remove aria-label="Entfernen">✕</button>
          </td>
        </tr>
      `;
    }).join('');
  }
  if (totalEl) totalEl.textContent = `${queueTotalQty()} Etiketten`;
}

function renderCatalog() {
  const host = document.getElementById('avery-catalog');
  if (!host) return;
  const cuts = AVERY_CUT_CATALOG.filter((cut) => cut.tab === state.activeTab && !cut.trim);
  const trims = AVERY_CUT_CATALOG.filter((cut) => cut.trim);
  host.innerHTML = `
    <div class="avery-catalog-grid">
      ${cuts.map((cut) => {
        const qty = state.queue.find((row) => row.cutId === cut.id)?.qty || 0;
        return `
          <button type="button" class="avery-cut-chip${qty ? ' is-active' : ''}" data-avery-add="${escapeHtml(cut.id)}">
            <strong>${escapeHtml(cut.name)}</strong>
            <span>${cut.days > 0 ? `${cut.days} Tage Reife` : 'frisch'}${qty ? ` · ${qty}×` : ''}</span>
          </button>
        `;
      }).join('')}
    </div>
    <div class="avery-trim-box">
      <h3>Trimmings R I–R V</h3>
      <div class="avery-catalog-grid avery-catalog-grid--trim">
        ${trims.map((cut) => {
          const qty = state.queue.find((row) => row.cutId === cut.id)?.qty || 0;
          return `
            <button type="button" class="avery-cut-chip avery-cut-chip--trim${qty ? ' is-active' : ''}" data-avery-add="${escapeHtml(cut.id)}">
              <strong>${escapeHtml(cut.name)}</strong>
              <span>${qty ? `${qty}×` : 'hinzufügen'}</span>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function syncHeaderInputs() {
  const map = {
    'avery-betrieb': 'betrieb',
    'avery-oeko': 'oeko',
    'avery-schlachthof': 'schlachthof',
    'avery-ohrmarke': 'ohrmarke',
    'avery-schlacht-datum': 'schlachtDatum',
    'avery-zerlege-datum': 'zerlegeDatum',
    'avery-reifehinweis': 'reifehinweis',
    'avery-brand': 'brand',
  };
  Object.entries(map).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el && el.value !== state.header[key]) el.value = state.header[key] || '';
  });
  const lotEl = document.getElementById('avery-lot-preview');
  if (lotEl) lotEl.textContent = buildAveryLot(state.header);
}

function renderTabs() {
  document.querySelectorAll('[data-avery-tab]').forEach((btn) => {
    const active = btn.getAttribute('data-avery-tab') === state.activeTab;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  const hint = document.getElementById('avery-tab-hint');
  if (hint) hint.textContent = TAB_META[state.activeTab]?.hint || '';
}

function renderAll() {
  syncHeaderInputs();
  renderTabs();
  renderCatalog();
  renderQueue();
  renderSheetPreview();
}

function readHeaderFromDom() {
  state.header.betrieb = String(document.getElementById('avery-betrieb')?.value || '').trim();
  state.header.oeko = String(document.getElementById('avery-oeko')?.value || '').trim();
  state.header.schlachthof = String(document.getElementById('avery-schlachthof')?.value || '').trim();
  state.header.ohrmarke = String(document.getElementById('avery-ohrmarke')?.value || '').trim();
  state.header.schlachtDatum = String(document.getElementById('avery-schlacht-datum')?.value || '').trim();
  state.header.zerlegeDatum = String(document.getElementById('avery-zerlege-datum')?.value || '').trim();
  state.header.reifehinweis = String(document.getElementById('avery-reifehinweis')?.value || '').trim();
  state.header.brand = String(document.getElementById('avery-brand')?.value || 'SH').trim().toUpperCase();
}

export function printAveryLabelsSheet() {
  readHeaderFromDom();
  const plan = planAverySheet({ queue: state.queue, startSlot: state.startSlot });
  if (!plan.filledCount) {
    window.showToast?.('Bitte zuerst Teilstücke zur Druckliste hinzufügen.', 'warning');
    return false;
  }
  if (!state.header.ohrmarke) {
    window.showToast?.('Bitte die Ohrmarke eintragen.', 'warning');
    return false;
  }
  renderSheetPreview();
  document.body.classList.add(PRINT_BODY_CLASS);
  const cleanup = () => {
    document.body.classList.remove(PRINT_BODY_CLASS);
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
  setTimeout(cleanup, 1500);
  return true;
}

function bindEvents(root) {
  if (!root || root.dataset.averyBound === '1') return;
  root.dataset.averyBound = '1';

  root.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
    if (!target.id?.startsWith('avery-')) return;
    readHeaderFromDom();
    persistDraft();
    const lotEl = document.getElementById('avery-lot-preview');
    if (lotEl) lotEl.textContent = buildAveryLot(state.header);
    renderSheetPreview();
  });

  root.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const tabBtn = target.closest('[data-avery-tab]');
    if (tabBtn) {
      state.activeTab = tabBtn.getAttribute('data-avery-tab') || 'vv';
      persistDraft();
      renderAll();
      return;
    }

    const presetBtn = target.closest('[data-avery-preset]');
    if (presetBtn) {
      addPreset(presetBtn.getAttribute('data-avery-preset'));
      return;
    }

    const addBtn = target.closest('[data-avery-add]');
    if (addBtn) {
      const cutId = addBtn.getAttribute('data-avery-add');
      const current = state.queue.find((row) => row.cutId === cutId)?.qty || 0;
      setQueueQty(cutId, current + 1);
      return;
    }

    const slotBtn = target.closest('[data-avery-slot]');
    if (slotBtn) {
      const slot = Number.parseInt(slotBtn.getAttribute('data-avery-slot') || '1', 10);
      state.startSlot = Math.min(24, Math.max(1, slot || 1));
      persistDraft();
      renderSheetPreview();
      window.showToast?.(`Start-Slot ${state.startSlot} gesetzt.`, 'info');
      return;
    }

    const row = target.closest('[data-queue-cut]');
    if (row) {
      const cutId = row.getAttribute('data-queue-cut');
      const current = state.queue.find((entry) => entry.cutId === cutId)?.qty || 0;
      if (target.closest('[data-avery-remove]')) {
        setQueueQty(cutId, 0);
        return;
      }
      const stepBtn = target.closest('[data-avery-qty]');
      if (stepBtn) {
        const delta = Number.parseInt(stepBtn.getAttribute('data-avery-qty') || '0', 10) || 0;
        setQueueQty(cutId, current + delta);
      }
    }
  });

  document.getElementById('btn-avery-fill-hack')?.addEventListener('click', () => fillRestWithHack());
  document.getElementById('btn-avery-print-sheet')?.addEventListener('click', () => printAveryLabelsSheet());
  document.getElementById('btn-avery-clear-queue')?.addEventListener('click', () => {
    state.queue = [];
    persistDraft();
    renderAll();
  });
}

function buildShellHtml() {
  return `
    <section class="avery-suite" aria-label="Avery 3475 Zerlege- und Reife-Etikettierung">
      <header class="avery-suite-header">
        <div>
          <p class="avery-kicker">WG 0460 · Avery 3475</p>
          <h2 class="avery-suite-title">🏷️ Zerlege- &amp; Reife-Etiketten</h2>
          <p class="avery-suite-lead">Betriebsdaten, Teilstücke und Live-Bogenvorschau – inkl. Start-Slot für angefangene Bögen.</p>
        </div>
      </header>

      <section class="avery-card" aria-labelledby="avery-header-title">
        <h3 id="avery-header-title" class="avery-card-title">Betriebs- &amp; Tier-Kopfdaten</h3>
        <div class="avery-header-grid">
          <label class="form-label" for="avery-betrieb">Betriebsname
            <input id="avery-betrieb" class="input-text-touch" type="text" autocomplete="organization">
          </label>
          <label class="form-label" for="avery-brand">LOT-Kürzel
            <input id="avery-brand" class="input-text-touch" type="text" maxlength="6" autocomplete="off">
          </label>
          <label class="form-label" for="avery-oeko">Öko-Code
            <input id="avery-oeko" class="input-text-touch" type="text" autocomplete="off">
          </label>
          <label class="form-label" for="avery-schlachthof">Schlachthof
            <input id="avery-schlachthof" class="input-text-touch" type="text" autocomplete="off">
          </label>
          <label class="form-label" for="avery-ohrmarke">Ohrmarke
            <input id="avery-ohrmarke" class="input-text-touch" type="text" autocomplete="off" placeholder="z. B. DE123456789">
          </label>
          <label class="form-label" for="avery-schlacht-datum">Schlachtdatum
            <input id="avery-schlacht-datum" class="input-text-touch" type="date">
          </label>
          <label class="form-label" for="avery-zerlege-datum">Zerlegedatum
            <input id="avery-zerlege-datum" class="input-text-touch" type="date">
          </label>
          <label class="form-label" for="avery-reifehinweis">Reifehinweis
            <input id="avery-reifehinweis" class="input-text-touch" type="text" autocomplete="off">
          </label>
        </div>
        <p class="avery-lot-line">LOT: <strong id="avery-lot-preview">–</strong></p>
      </section>

      <section class="avery-card" aria-labelledby="avery-catalog-title">
        <div class="avery-card-head">
          <h3 id="avery-catalog-title" class="avery-card-title">Teilstücke &amp; Presets</h3>
          <div class="avery-preset-row">
            <button type="button" class="btn btn-secondary btn-compact" data-avery-preset="vv">Komplettes VV (10)</button>
            <button type="button" class="btn btn-secondary btn-compact" data-avery-preset="hv">Komplettes HV (11)</button>
          </div>
        </div>
        <div class="avery-tab-row" role="tablist" aria-label="Teilstück-Gruppen">
          ${Object.entries(TAB_META).map(([key, meta]) => `
            <button type="button" class="avery-tab-btn" data-avery-tab="${key}" role="tab">${escapeHtml(meta.label)}</button>
          `).join('')}
        </div>
        <p class="avery-tab-hint" id="avery-tab-hint"></p>
        <div id="avery-catalog"></div>
      </section>

      <section class="avery-card" aria-labelledby="avery-queue-title">
        <div class="avery-card-head">
          <h3 id="avery-queue-title" class="avery-card-title">Druckliste</h3>
          <div class="avery-queue-actions">
            <span id="avery-queue-total" class="avery-queue-total">0 Etiketten</span>
            <button type="button" class="btn btn-secondary btn-compact" id="btn-avery-clear-queue">Liste leeren</button>
          </div>
        </div>
        <div class="avery-queue-wrap">
          <table class="avery-queue-table">
            <thead>
              <tr><th>Teilstück</th><th>Menge</th><th></th></tr>
            </thead>
            <tbody id="avery-queue-body"></tbody>
          </table>
        </div>
      </section>

      <section class="avery-card" aria-labelledby="avery-preview-title">
        <div class="avery-card-head">
          <h3 id="avery-preview-title" class="avery-card-title">Live-A4-Vorschau (24 Nutzen)</h3>
          <button type="button" class="btn btn-secondary btn-compact" id="btn-avery-fill-hack">⚡ Rest mit R II Hack füllen</button>
        </div>
        <div class="avery-gauge" aria-label="Bogen-Auslastung">
          <div class="avery-gauge-track"><div class="avery-gauge-fill" id="avery-gauge-fill"></div></div>
          <p class="avery-gauge-text" id="avery-gauge-text">0 / 24 Nutzen</p>
        </div>
        <p class="avery-overflow-warn" id="avery-overflow-warn" hidden></p>
        <p class="avery-slot-hint">Tipp: Freien oder verbrauchten Slot antippen = Start-Position für angefangene Bögen.</p>
        <div class="avery-sheet-preview" id="avery-sheet-preview"></div>
        <button type="button" class="btn btn-primary btn-avery-print" id="btn-avery-print-sheet">🖨️ Etikettenbogen drucken</button>
      </section>
    </section>

    <div id="avery-print-root" class="avery-print-root" aria-hidden="true">
      <div class="avery-sheet" id="avery-sheet-print"></div>
    </div>
  `;
}

export function initAveryLabelsModule() {
  const page = document.getElementById('page-avery');
  if (!page) return;
  if (!state.initialized) {
    restoreDraft();
    ensureHeaderDefaults();
    page.innerHTML = buildShellHtml();
    bindEvents(page);
    state.initialized = true;
  } else {
    ensureHeaderDefaults();
  }
  renderAll();
}

export function activateAveryLabelsTab() {
  initAveryLabelsModule();
  renderAll();
}

export function disableAveryLabelsModule() {
  /* no live subscriptions yet */
}
