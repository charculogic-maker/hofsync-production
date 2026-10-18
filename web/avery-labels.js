/**
 * Avery 3475 Zerlege- & Reife-Etikettierung (Modul averyLabels).
 * Hof-Praxis: Schulter (+Hals/Brust), Rücken, Keule, Lappen, Innereien + Freifeld.
 */

export const AVERY_LABELS_PER_SHEET = 24;
export const AVERY_MODULE_KEY = 'averyLabels';
const PRINT_BODY_CLASS = 'print-avery-labels';
const STORAGE_KEY = 'charculogic.averyLabels.draft.v3';

/** Vorbereitetes Mehrseiten-HTML für iOS (window.open im User-Gesture) */
let cachedIosPrintHtml = '';

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   days: number,
 *   tab: 'schulter'|'ruecken'|'keule'|'lappen'|'innereien'|null,
 *   trim?: boolean,
 *   artNr?: string,
 * }} AveryCut
 */

/**
 * @typedef {{
 *   sheetIndex: number,
 *   startSlot: number,
 *   emptyCount: number,
 *   labelsOnSheet: AveryCut[],
 *   filledCount: number,
 *   usage: number,
 *   full: boolean,
 *   capacity: number,
 * }} AverySheetPlan
 */

/**
 * Praxis-Katalog nach Zerlege-Baugruppen (kein VV/HV).
 * Hals/Brust laufen mit der Schulter am selben Tisch; Brust nicht unter Lappen.
 */
export const GALLOWAY_CATALOG = Object.freeze({
  schultern: Object.freeze([
    { id: 'sch-bug', name: 'Bug', days: 14, tab: 'schulter' },
    { id: 'sch-falsches-filet', name: 'Falsches Filet', days: 14, tab: 'schulter' },
    { id: 'sch-schaufel', name: 'Schaufelstück', days: 14, tab: 'schulter' },
    { id: 'sch-dicke-rippe', name: 'Dicke Rippe', days: 14, tab: 'schulter' },
    { id: 'sch-nacken', name: 'Nacken / Hals / Zungenstück', days: 14, tab: 'schulter' },
    { id: 'sch-brust', name: 'Brust / Brisket', days: 14, tab: 'schulter' },
  ]),
  ruecken: Object.freeze([
    { id: 'rue-entrecote', name: 'Entrecôte', days: 21, tab: 'ruecken' },
    { id: 'rue-roastbeef', name: 'Roastbeef', days: 28, tab: 'ruecken' },
    { id: 'rue-filet', name: 'Filet', days: 28, tab: 'ruecken' },
  ]),
  keule: Object.freeze([
    { id: 'keu-oberschale', name: 'Oberschale', days: 28, tab: 'keule' },
    { id: 'keu-unterschale', name: 'Unterschale', days: 28, tab: 'keule' },
    { id: 'keu-nuss', name: 'Nuss', days: 28, tab: 'keule' },
    { id: 'keu-huefte', name: 'Hüfte', days: 28, tab: 'keule' },
    { id: 'keu-tafelspitz', name: 'Tafelspitz', days: 28, tab: 'keule' },
    { id: 'keu-buergermeister', name: 'Bürgermeisterstück', days: 28, tab: 'keule' },
    { id: 'keu-wade', name: 'Wade', days: 21, tab: 'keule' },
  ]),
  lappen: Object.freeze([
    { id: 'lap-duennung', name: 'Dünnung', days: 14, tab: 'lappen' },
    { id: 'lap-flank', name: 'Flank', days: 14, tab: 'lappen' },
    { id: 'lap-skirt', name: 'Skirt', days: 14, tab: 'lappen' },
    { id: 'lap-spannrippe', name: 'Spannrippe', days: 14, tab: 'lappen' },
  ]),
  innereien: Object.freeze([
    { id: 'inn-leber', name: 'Leber', days: 0, tab: 'innereien' },
    { id: 'inn-herz', name: 'Herz', days: 0, tab: 'innereien' },
    { id: 'inn-zunge', name: 'Zunge', days: 0, tab: 'innereien' },
    { id: 'inn-ochsenschwanz', name: 'Ochsenschwanz', days: 0, tab: 'innereien' },
    { id: 'inn-backen', name: 'Backen', days: 0, tab: 'innereien' },
    { id: 'inn-markknochen', name: 'Markknochen', days: 0, tab: 'innereien' },
    { id: 'inn-suppenknochen', name: 'Suppenknochen', days: 0, tab: 'innereien' },
  ]),
});

/** Abschnitte / Trimmings – betriebsnahe Rezepturen */
export const AVERY_TRIMMINGS = Object.freeze([
  { id: 'tr-r1-mager', name: 'R I Mager', days: 0, tab: null, trim: true, artNr: '504' },
  { id: 'tr-r1-spiesse', name: 'R I Spieße', days: 0, tab: null, trim: true, artNr: '543' },
  { id: 'tr-r2-hack', name: 'R II Hack', days: 0, tab: null, trim: true, artNr: '503' },
  { id: 'tr-r3-wurst', name: 'R III Wurst', days: 0, tab: null, trim: true, artNr: '530' },
  { id: 'tr-fett', name: 'Fett', days: 0, tab: null, trim: true, artNr: '449' },
]);

export const AVERY_CUT_CATALOG = Object.freeze([
  ...GALLOWAY_CATALOG.schultern,
  ...GALLOWAY_CATALOG.ruecken,
  ...GALLOWAY_CATALOG.keule,
  ...GALLOWAY_CATALOG.lappen,
  ...GALLOWAY_CATALOG.innereien,
  ...AVERY_TRIMMINGS,
]);

/** Reife-Optionen für Freifeld / Spezial-Teilstück */
export const CUSTOM_AGING_OPTIONS = Object.freeze([
  { days: 0, label: 'Tag 0 (Frisch)' },
  { days: 14, label: '14 Tage (Wet-Aging)' },
  { days: 21, label: '21 Tage' },
  { days: 28, label: '28 Tage (Dry-Aging)' },
]);

const TAB_META = Object.freeze({
  schultern: { label: 'Schulter', hint: 'Bug, Schaufel, dicke Rippe – inkl. Nacken/Hals und Brust am Schultertisch' },
  ruecken: { label: 'Rücken', hint: 'Entrecôte, Roastbeef, Filet – ohne Nacken' },
  keule: { label: 'Keule', hint: 'Oberschale bis Wade' },
  lappen: { label: 'Lappen', hint: 'Dünnung, Flank, Skirt, Spannrippe – ohne Brust' },
  innereien: { label: 'Innereien & Knochen', hint: 'Leber, Herz, Zunge, Knochen' },
});

/** Map UI tab key → GALLOWAY_CATALOG key */
const TAB_TO_CATALOG_KEY = Object.freeze({
  schultern: 'schultern',
  ruecken: 'ruecken',
  keule: 'keule',
  lappen: 'lappen',
  innereien: 'innereien',
});

const DEFAULT_HEADER = Object.freeze({
  betrieb: 'StevesHof Hofladen',
  oeko: 'DE-ÖKO-006',
  schlachthof: 'Bio-Schlachthof Stautenhof Willich',
  ohrmarke: '',
  schlachtDatum: '',
  zerlegeDatum: '',
  brand: 'SH',
  /** @type {boolean} Betriebsname auf Etikett (Default aus) */
  printBetrieb: false,
  /** @type {boolean} Schlachthof auf Etikett (Default aus) */
  printSchlachthof: false,
});

/**
 * @typedef {{
 *   cutId: string,
 *   qty: number,
 *   isCustom?: boolean,
 *   name?: string,
 *   days?: number,
 * }} AveryQueueRow
 */

/** @type {{ header: Record<string, string|boolean>, queue: AveryQueueRow[], startSlot: number, previewSheetIndex: number, activeTab: string, initialized: boolean }} */
const state = {
  header: { ...DEFAULT_HEADER },
  queue: [],
  startSlot: 1,
  previewSheetIndex: 0,
  activeTab: 'schultern',
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

/** @param {string} iso @param {number} days */
export function addDaysIso(iso, days) {
  const raw = String(iso || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + (Number(days) || 0));
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
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

/**
 * Löst Queue-Zeile zu einem Etiketten-Cut auf (Katalog oder Freifeld).
 * @param {AveryQueueRow} row
 * @returns {AveryCut|null}
 */
export function resolveQueueCut(row) {
  if (!row) return null;
  if (row.isCustom) {
    const name = String(row.name || '').trim();
    if (!name) return null;
    return {
      id: row.cutId || `custom-${name}`,
      name,
      days: Number.isFinite(Number(row.days)) ? Number(row.days) : 0,
      tab: null,
      isCustom: true,
    };
  }
  return getCutById(row.cutId);
}

export function expandQueueToLabels(queue = []) {
  /** @type {AveryCut[]} */
  const labels = [];
  queue.forEach((entry) => {
    const cut = resolveQueueCut(entry);
    if (!cut) return;
    const qty = Math.max(0, Number.parseInt(String(entry.qty), 10) || 0);
    for (let i = 0; i < qty; i += 1) labels.push(cut);
  });
  return labels;
}

/**
 * Zerlegt die Druckliste in einen oder mehrere Avery-Bögen (je 24 Nutzen).
 * Bogen 1 respektiert startSlot (angefangener Bogen); Folge-Bögen starten bei 1.
 * @param {{ queue?: AveryQueueRow[], startSlot?: number }} input
 */
export function planAverySheets(input = {}) {
  const startSlot = Math.min(
    AVERY_LABELS_PER_SHEET,
    Math.max(1, Number.parseInt(String(input.startSlot ?? 1), 10) || 1),
  );
  const allLabels = expandQueueToLabels(input.queue || []);
  /** @type {AverySheetPlan[]} */
  const sheets = [];
  let offset = 0;

  const firstCapacity = AVERY_LABELS_PER_SHEET - startSlot + 1;
  const firstLabels = allLabels.slice(offset, offset + firstCapacity);
  offset += firstLabels.length;
  sheets.push({
    sheetIndex: 0,
    startSlot,
    emptyCount: startSlot - 1,
    labelsOnSheet: firstLabels,
    filledCount: firstLabels.length,
    usage: startSlot - 1 + firstLabels.length,
    full: startSlot - 1 + firstLabels.length >= AVERY_LABELS_PER_SHEET,
    capacity: firstCapacity,
  });

  while (offset < allLabels.length) {
    const labelsOnSheet = allLabels.slice(offset, offset + AVERY_LABELS_PER_SHEET);
    offset += labelsOnSheet.length;
    sheets.push({
      sheetIndex: sheets.length,
      startSlot: 1,
      emptyCount: 0,
      labelsOnSheet,
      filledCount: labelsOnSheet.length,
      usage: labelsOnSheet.length,
      full: labelsOnSheet.length >= AVERY_LABELS_PER_SHEET,
      capacity: AVERY_LABELS_PER_SHEET,
    });
  }

  return {
    sheets,
    sheetCount: sheets.length,
    totalQueued: allLabels.length,
    startSlot,
  };
}

/**
 * Plant den ersten Bogen (+ overflow = Etiketten auf Folge-Bögen).
 * @param {{ queue?: AveryQueueRow[], startSlot?: number }} input
 */
export function planAverySheet(input = {}) {
  const multi = planAverySheets(input);
  const first = multi.sheets[0];
  const overflow = Math.max(0, multi.totalQueued - first.filledCount);
  return {
    startSlot: first.startSlot,
    emptyCount: first.emptyCount,
    filledCount: first.filledCount,
    labelsOnSheet: first.labelsOnSheet,
    totalQueued: multi.totalQueued,
    capacity: first.capacity,
    overflow,
    usage: first.usage,
    full: first.full,
    sheetCount: multi.sheetCount,
    sheets: multi.sheets,
  };
}

/**
 * @param {AverySheetPlan} sheetPlan
 * @param {Record<string, string|boolean>} header
 * @param {string} lot
 */
function buildSheetPrintCellsHtml(sheetPlan, header, lot) {
  const printCells = [];
  for (let i = 0; i < sheetPlan.emptyCount; i += 1) {
    printCells.push('<div class="avery-label empty" aria-hidden="true"></div>');
  }
  sheetPlan.labelsOnSheet.forEach((cut) => {
    printCells.push(`<div class="avery-label">${buildLabelHtml(cut, header, lot)}</div>`);
  });
  while (printCells.length < AVERY_LABELS_PER_SHEET) {
    printCells.push('<div class="avery-label empty" aria-hidden="true"></div>');
  }
  return printCells.join('');
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

function normalizeQueueRow(row) {
  if (!row || typeof row !== 'object') return null;
  const qty = Math.max(0, Number.parseInt(String(row.qty), 10) || 0);
  if (qty <= 0) return null;
  if (row.isCustom) {
    const name = String(row.name || '').trim();
    if (!name) return null;
    return {
      cutId: String(row.cutId || `custom-${Date.now()}`),
      qty,
      isCustom: true,
      name,
      days: Number.isFinite(Number(row.days)) ? Number(row.days) : 0,
    };
  }
  const cutId = String(row.cutId || '');
  if (!cutId || !getCutById(cutId)) return null;
  return { cutId, qty };
}

function coercePrintFlag(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return fallback;
}

function restoreDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
      || localStorage.getItem('charculogic.averyLabels.draft.v2')
      || localStorage.getItem('charculogic.averyLabels.draft.v1');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    if (parsed.header && typeof parsed.header === 'object') {
      const { reifehinweis: _drop, ...restHeader } = parsed.header;
      state.header = {
        ...DEFAULT_HEADER,
        ...restHeader,
        printBetrieb: coercePrintFlag(restHeader.printBetrieb, false),
        printSchlachthof: coercePrintFlag(restHeader.printSchlachthof, false),
      };
      delete state.header.reifehinweis;
    }
    if (Array.isArray(parsed.queue)) {
      state.queue = parsed.queue.map(normalizeQueueRow).filter(Boolean);
    }
    if (parsed.startSlot != null) {
      state.startSlot = Math.min(24, Math.max(1, Number.parseInt(String(parsed.startSlot), 10) || 1));
    }
    const legacyTabMap = {
      vv: 'schultern',
      hv: 'keule',
      frisch: 'lappen',
      schultern: 'schultern',
      ruecken: 'ruecken',
      keule: 'keule',
      lappen: 'lappen',
      innereien: 'innereien',
    };
    const mapped = legacyTabMap[parsed.activeTab] || parsed.activeTab;
    if (mapped && TAB_META[mapped]) state.activeTab = mapped;
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

function queueRowKey(row) {
  if (row.isCustom) return `custom:${row.cutId}`;
  return `cut:${row.cutId}`;
}

function setQueueQty(cutId, qty) {
  const nextQty = Math.max(0, Math.min(999, Number.parseInt(String(qty), 10) || 0));
  const idx = state.queue.findIndex((row) => !row.isCustom && row.cutId === cutId);
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

/**
 * Trimmings-Menge setzen (API/Tests). UI nutzt jetzt Chip-Buttons wie Teilstücke.
 */
export function updateTrimCount(trimId, qty) {
  const nextQty = Math.max(0, Math.min(999, Number.parseInt(String(qty), 10) || 0));
  const idx = state.queue.findIndex((row) => !row.isCustom && row.cutId === trimId);
  if (nextQty <= 0) {
    if (idx >= 0) state.queue.splice(idx, 1);
  } else if (idx >= 0) {
    state.queue[idx].qty = nextQty;
  } else if (getCutById(trimId)) {
    state.queue.push({ cutId: trimId, qty: nextQty });
  }
  persistDraft();
  renderQueue();
  renderSheetPreview();
}

/** @deprecated Trimmings sind Chip-Buttons – kein Zahlenfeld mehr. */
export function syncTrimInputs() {
  /* no-op: Abschnitte/Trimmings sind anklickbare Chips */
}

/**
 * Etikettenbogen zurücksetzen: Druckliste leeren, Start-Slot 1, Vorschau neu.
 * Kopfdaten (Ohrmarke, Daten) bleiben erhalten.
 */
export function resetAverySheet() {
  state.queue = [];
  state.startSlot = 1;
  state.previewSheetIndex = 0;
  persistDraft();
  renderAll();
  window.showToast?.('Etikettenbogen zurückgesetzt.', 'success');
}

function fillRestWithHack() {
  const multi = planAverySheets({ queue: state.queue, startSlot: state.startSlot });
  let sheet = multi.sheets[Math.min(state.previewSheetIndex, multi.sheets.length - 1)] || multi.sheets[0];
  // Voller Vorschau-Bogen → letzten (angebrochenen) Bogen füllen
  if (sheet.full) {
    sheet = multi.sheets[multi.sheets.length - 1];
  }
  const free = AVERY_LABELS_PER_SHEET - sheet.usage;
  if (free <= 0) {
    window.showToast?.('Dieser Bogen ist schon voll.', 'info');
    return;
  }
  const hackId = 'tr-r2-hack';
  const existing = state.queue.find((row) => !row.isCustom && row.cutId === hackId);
  if (existing) existing.qty += free;
  else state.queue.push({ cutId: hackId, qty: free });
  persistDraft();
  renderAll();
  window.showToast?.(`Rest mit R II Hack aufgefüllt (+${free}).`, 'success');
}

/**
 * Freifeld → Queue
 * @param {string} name
 * @param {number} days
 */
export function addCustomCutToQueue(name, days) {
  const cleanName = String(name || '').trim();
  if (!cleanName) {
    window.showToast?.('Bitte eine Bezeichnung für das Spezial-Teilstück eintragen.', 'warning');
    return false;
  }
  const agingDays = Number.parseInt(String(days), 10);
  const safeDays = CUSTOM_AGING_OPTIONS.some((opt) => opt.days === agingDays) ? agingDays : 0;
  const cutId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  state.queue.push({
    cutId,
    qty: 1,
    isCustom: true,
    name: cleanName,
    days: safeDays,
  });
  persistDraft();
  renderAll();
  const ripeIso = addDaysIso(state.header.zerlegeDatum || todayIsoLocal(), safeDays);
  window.showToast?.(
    safeDays > 0
      ? `${cleanName} auf den Bogen · Reife bis ${formatDateDe(ripeIso)}.`
      : `${cleanName} (frisch) auf den Bogen.`,
    'success',
  );
  return true;
}

/**
 * Lagerhinweis je Teilstück (Innereien kühler).
 * @param {AveryCut|null|undefined} cut
 */
export function storageHintForCut(cut) {
  if (!cut) return '0–2 °C';
  if (cut.tab === 'innereien' || String(cut.id || '').startsWith('inn-')) {
    return '≤ 3 °C';
  }
  return '0–2 °C';
}

/**
 * Titel für Etikett: R-Abschnitte mit Mittelpunkt („R I · Spieße“).
 * @param {string} name
 */
export function formatLabelTitle(name) {
  const raw = String(name || '').trim();
  if (!raw) return '';
  const m = /^(R\s+(?:I{1,3}|IV|V))\s+(.+)$/i.exec(raw);
  if (m) return `${m[1].toUpperCase().replace(/\s+/g, ' ')} · ${m[2].trim()}`;
  return raw;
}

/**
 * Pflicht-Fußzeile: Öko + Lagerhinweis.
 * @param {AveryCut} cut
 * @param {string} oeko
 */
export function storageFootLine(cut, oeko) {
  const code = String(oeko || '').trim() || 'DE-ÖKO-006';
  const temp = storageHintForCut(cut);
  return `${code} · Gekühlt bei ${temp} lagern`;
}

/**
 * Inhalts-zuerst: Hero (~55%) / Meta (~35%) / Pflicht-Fuß.
 * Keine Art.-Nr. im Druckbild.
 * @param {AveryCut} cut
 * @param {Record<string, string|boolean>} header
 * @param {string} lot
 */
export function buildLabelHtml(cut, header, lot) {
  const oeko = String(header.oeko || '').trim();
  const showBetrieb = Boolean(header.printBetrieb) && String(header.betrieb || '').trim();
  const showSchlachthof = Boolean(header.printSchlachthof) && String(header.schlachthof || '').trim();
  const ohr = String(header.ohrmarke || '').trim();
  const schl = formatDateDe(header.schlachtDatum) || '';
  const zerl = formatDateDe(header.zerlegeDatum) || '';
  const title = formatLabelTitle(cut.name);
  const foot = storageFootLine(cut, oeko);
  const ohrRow = ohr
    ? `<div class="lbl-meta-sub">OHR ${escapeHtml(ohr)}</div>`
    : '';
  const schlRow = schl
    ? `<div class="lbl-meta-sub">Schl. ${escapeHtml(schl)}</div>`
    : '';
  return `
    <div class="label-card">
      ${showBetrieb ? `<div class="lbl-farm">${escapeHtml(String(header.betrieb).trim())}</div>` : ''}
      <div class="lbl-hero">
        <span class="lbl-title">${escapeHtml(title)}</span>
      </div>
      <div class="lbl-meta">
        <div class="lbl-meta-col lbl-meta-left">
          <div class="lbl-meta-main">LOT ${escapeHtml(lot)}</div>
          ${ohrRow}
        </div>
        <div class="lbl-meta-col lbl-meta-right">
          <div class="lbl-meta-main">${zerl ? `Zerl. ${escapeHtml(zerl)}` : ''}</div>
          ${schlRow}
          ${showSchlachthof ? `<div class="lbl-meta-sub lbl-slaughter">${escapeHtml(String(header.schlachthof).trim())}</div>` : ''}
        </div>
      </div>
      <div class="lbl-foot">${escapeHtml(foot)}</div>
    </div>
  `;
}

function renderSheetPreview() {
  const sheet = document.getElementById('avery-sheet-preview');
  const gaugeFill = document.getElementById('avery-gauge-fill');
  const gaugeText = document.getElementById('avery-gauge-text');
  const statusEl = document.getElementById('avery-overflow-warn');
  const sheetTabs = document.getElementById('avery-sheet-tabs');
  if (!sheet) return;

  const lot = buildAveryLot(state.header);
  const multi = planAverySheets({ queue: state.queue, startSlot: state.startSlot });
  if (state.previewSheetIndex >= multi.sheetCount) {
    state.previewSheetIndex = Math.max(0, multi.sheetCount - 1);
  }
  const previewIdx = state.previewSheetIndex;
  const plan = multi.sheets[previewIdx] || multi.sheets[0];
  const isFirstSheet = plan.sheetIndex === 0;

  if (sheetTabs) {
    if (multi.sheetCount <= 1) {
      sheetTabs.hidden = true;
      sheetTabs.innerHTML = '';
    } else {
      sheetTabs.hidden = false;
      sheetTabs.innerHTML = multi.sheets.map((s) => `
        <button
          type="button"
          class="avery-sheet-tab${s.sheetIndex === previewIdx ? ' is-active' : ''}"
          data-avery-sheet-tab="${s.sheetIndex}"
          aria-pressed="${s.sheetIndex === previewIdx ? 'true' : 'false'}"
        >Bogen ${s.sheetIndex + 1} · ${s.filledCount}/${AVERY_LABELS_PER_SHEET}</button>
      `).join('');
    }
  }

  const cells = [];
  for (let i = 1; i <= AVERY_LABELS_PER_SHEET; i += 1) {
    const slotStart = plan.startSlot;
    const isEmptyOffset = i < slotStart;
    const labelIndex = i - slotStart;
    const cut = !isEmptyOffset && labelIndex < plan.labelsOnSheet.length
      ? plan.labelsOnSheet[labelIndex]
      : null;
    const used = Boolean(cut);
    let cls = 'avery-slot';
    if (isEmptyOffset) cls += ' is-offset';
    else if (used) cls += ' is-filled';
    else cls += ' is-free';
    if (isFirstSheet && i === state.startSlot) cls += ' is-start';
    const inner = cut
      ? buildLabelHtml(cut, state.header, lot)
      : `<span class="avery-slot-num">${i}</span>`;
    // Start-Slot nur auf Bogen 1 setzen
    if (isFirstSheet) {
      cells.push(`<button type="button" class="${cls}" data-avery-slot="${i}" aria-label="Start-Slot ${i}">${inner}</button>`);
    } else {
      cells.push(`<div class="${cls}" aria-hidden="true">${inner}</div>`);
    }
  }
  sheet.innerHTML = cells.join('');

  const printArea = ensureAveryPrintArea();
  printArea.innerHTML = multi.sheets.map((sheetPlan, idx) => {
    const cellsHtml = buildSheetPrintCellsHtml(sheetPlan, state.header, lot);
    const cont = idx > 0 ? ' avery-sheet-continued' : '';
    const idAttr = idx === 0 ? ' id="avery-sheet-print"' : '';
    return `<div class="avery-sheet${cont}"${idAttr}>${cellsHtml}</div>`;
  }).join('');
  cachedIosPrintHtml = buildIosPrintDocumentHtml(printArea.innerHTML);

  const usagePct = Math.round((plan.usage / AVERY_LABELS_PER_SHEET) * 100);
  if (gaugeFill) gaugeFill.style.width = `${Math.min(100, usagePct)}%`;
  if (gaugeText) {
    const sheetLabel = multi.sheetCount > 1
      ? `Bogen ${previewIdx + 1}/${multi.sheetCount}`
      : 'Bogen';
    gaugeText.textContent = `${sheetLabel}: ${plan.usage} / ${AVERY_LABELS_PER_SHEET} Nutzen`
      + (isFirstSheet ? ` · Start ${state.startSlot}` : '');
  }
  if (statusEl) {
    if (multi.sheetCount > 1) {
      statusEl.hidden = false;
      statusEl.classList.add('is-multi');
      statusEl.textContent = `${multi.sheetCount} Bögen · ${multi.totalQueued} Etiketten — wir drucken alle Bögen nacheinander.`;
    } else {
      statusEl.hidden = true;
      statusEl.classList.remove('is-multi');
      statusEl.textContent = '';
    }
  }

  const printBtn = document.getElementById('btn-avery-print-sheet');
  if (printBtn) {
    printBtn.textContent = multi.sheetCount > 1
      ? `🖨️ ${multi.sheetCount} Bögen drucken`
      : '🖨️ Etikettenbogen drucken';
  }

  syncPrintReadyState(plan);
}

/**
 * DOM-Ohrmarke ist Quelle der Wahrheit (verhindert state/DOM-Drift).
 * @param {AverySheetPlan|null} [plan]
 */
function getAveryPrintReadiness(plan = null) {
  const ohrDom = String(document.getElementById('avery-ohrmarke')?.value || '').trim();
  state.header.ohrmarke = ohrDom;
  const multi = planAverySheets({ queue: state.queue, startSlot: state.startSlot });
  const sheetPlan = plan || multi.sheets[0];
  const hasLabels = multi.totalQueued > 0;
  const hasOhr = Boolean(ohrDom);
  return {
    ready: hasLabels && hasOhr,
    hasLabels,
    hasOhr,
    sheetPlan,
    ohrDom,
    multi,
  };
}

/**
 * Hält #avery-print-area und print-avery-labels synchron zur Auswahl.
 * Button bleibt klickbar (Toast bei fehlender Vorbereitung) – iOS: bei ready nur window.print().
 * @param {ReturnType<typeof planAverySheet>|null} [plan]
 */
function syncPrintReadyState(plan = null) {
  const { ready, hasLabels, hasOhr } = getAveryPrintReadiness(plan);

  const btn = document.getElementById('btn-avery-print-sheet');
  if (btn instanceof HTMLButtonElement) {
    // Nie stumm disabled – sonst wirkt der Drucken-Button „kaputt“ (H1).
    btn.disabled = false;
    if (!hasLabels) {
      btn.title = 'Bitte zuerst Teilstücke zur Druckliste hinzufügen.';
    } else if (!hasOhr) {
      btn.title = 'Bitte die Ohrmarke eintragen – sonst können wir den Bogen nicht drucken.';
    } else {
      btn.removeAttribute('title');
    }
  }

  const hint = document.getElementById('avery-print-hint');
  if (hint) {
    if (!hasLabels) {
      hint.hidden = false;
      hint.textContent = 'Bitte zuerst Teilstücke zur Druckliste hinzufügen.';
    } else if (!hasOhr) {
      hint.hidden = false;
      hint.textContent = 'Bitte die Ohrmarke eintragen – sonst können wir den Bogen nicht drucken.';
    } else {
      hint.hidden = true;
      hint.textContent = '';
    }
  }

  const area = document.getElementById('avery-print-area');
  if (ready) {
    document.body.classList.add(PRINT_BODY_CLASS);
    area?.setAttribute('aria-hidden', 'false');
  } else {
    document.body.classList.remove(PRINT_BODY_CLASS);
    area?.setAttribute('aria-hidden', 'true');
  }
}

function isIosOrStandalonePwa() {
  try {
    const ua = String(navigator.userAgent || '');
    const iOS = /iPad|iPhone|iPod/i.test(ua)
      || (navigator.platform === 'MacIntel' && Number(navigator.maxTouchPoints || 0) > 1);
    const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches
      || window.navigator.standalone === true;
    return Boolean(iOS || standalone);
  } catch (_) {
    return false;
  }
}

/**
 * Eigenständiges Druckdokument für iOS/Safari (Mehrseiten + Schließen-Leiste).
 * @param {string} sheetsInnerHtml
 */
function buildIosPrintDocumentHtml(sheetsInnerHtml) {
  return `<!DOCTYPE html>
<html lang="de"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Avery 3475 Etikettenbogen</title>
<style>
  @page { size: A4 portrait; margin: 4.5mm 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .ios-print-bar {
    position: sticky; top: 0; z-index: 10;
    display: flex; flex-direction: column; gap: 8px;
    padding: 12px 14px; background: #0f172a; color: #f8fafc;
    font-family: -apple-system, Helvetica, Arial, sans-serif;
  }
  .ios-print-bar p { margin: 0; font-size: 14px; line-height: 1.35; }
  .ios-print-bar .ios-print-actions {
    display: flex; flex-direction: column; gap: 8px;
  }
  .ios-print-bar button {
    min-height: 48px; border: 0; border-radius: 10px;
    font-weight: 800; font-size: 16px; width: 100%;
  }
  .ios-print-bar .ios-print-go {
    background: #f59e0b; color: #0f172a;
  }
  .ios-print-bar .ios-print-close {
    background: #f8fafc; color: #0f172a;
  }
  .ios-print-scroll {
    overflow-x: auto; -webkit-overflow-scrolling: touch;
  }
  .avery-sheet {
    display: grid;
    grid-template-columns: repeat(3, 70mm);
    grid-auto-rows: 36mm;
    width: 210mm;
    margin: 4.5mm auto;
    gap: 0;
  }
  .avery-sheet-continued { page-break-before: always; break-before: page; }
  .avery-label {
    box-sizing: border-box; width: 70mm; height: 36mm;
    overflow: hidden; page-break-inside: avoid;
  }
  .avery-label.empty { visibility: hidden; }
  .label-card {
    width: 70mm; height: 36mm; padding: 1.8mm 2.6mm 1.4mm;
    box-sizing: border-box; display: flex; flex-direction: column;
    font-family: Helvetica, Arial, sans-serif; color: #000; background: #fff;
  }
  .lbl-farm {
    font-size: 5pt; font-weight: 700; margin-bottom: 0.4mm;
    text-align: center; text-transform: uppercase;
  }
  .lbl-hero {
    flex: 1 1 55%;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    min-height: 0;
    padding: 0.4mm 0.5mm;
  }
  .lbl-title {
    display: block;
    max-width: 100%;
    font-size: 12pt;
    font-weight: 900;
    line-height: 1.15;
    text-align: center;
    text-transform: uppercase;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
  .lbl-meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.4mm 2mm;
    margin-top: 0.4mm;
    padding-top: 1mm;
    border-top: 0.6pt solid #000;
  }
  .lbl-meta-right { text-align: right; }
  .lbl-meta-main, .lbl-meta-sub {
    font-size: 5.5pt; font-weight: 700; line-height: 1.25; white-space: nowrap;
  }
  .lbl-foot {
    margin-top: 0.5mm; padding-top: 0.5mm;
    border-top: 0.3pt dashed #64748b;
    font-size: 4.8pt; font-weight: 600; color: #1e293b;
    text-align: center;
  }
  @media print {
    .ios-print-bar { display: none !important; }
    .ios-print-scroll { overflow: visible !important; }
    body { padding: 4.5mm 0; }
  }
</style>
</head><body>
<div class="ios-print-bar">
  <p>Tippe auf <strong>Jetzt drucken</strong>. Danach dieses Fenster schließen und in der App auf Fertig tippen.</p>
  <div class="ios-print-actions">
    <button type="button" class="ios-print-go" id="ios-print-go">Jetzt drucken</button>
    <button type="button" class="ios-print-close" id="ios-print-close">Fenster schließen</button>
  </div>
</div>
<div class="ios-print-scroll">
${sheetsInnerHtml}
</div>
<script>
  function runPrint() {
    try { window.focus(); window.print(); } catch (e) {}
  }
  document.getElementById('ios-print-go')?.addEventListener('click', function (ev) {
    ev.preventDefault();
    runPrint();
  });
  document.getElementById('ios-print-close')?.addEventListener('click', function () {
    try { window.close(); } catch (e) {}
  });
  // Auto-Versuch; Fallback bleibt der sichtbare Button „Jetzt drucken“
  window.addEventListener('load', function () {
    setTimeout(runPrint, 350);
  });
<\/script>
</body></html>`;
}

function ensureIosPrintOverlay() {
  let overlay = document.getElementById('avery-ios-print-overlay');
  if (overlay instanceof HTMLElement) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'avery-ios-print-overlay';
  overlay.className = 'avery-ios-print-overlay';
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'avery-ios-print-title');
  overlay.innerHTML = `
    <div class="avery-ios-print-card">
      <h3 id="avery-ios-print-title" class="avery-ios-print-title">Etiketten bereit</h3>
      <p class="avery-ios-print-summary" id="avery-ios-print-summary"></p>
      <p class="avery-ios-print-help" id="avery-ios-print-help">Tippe auf Drucken — der Druck öffnet sich in Safari. Danach hier auf Fertig.</p>
      <button type="button" class="btn btn-primary btn-avery-ios-print" id="btn-avery-ios-print-now" data-avery-ios-print>
        Drucken
      </button>
      <button type="button" class="btn btn-secondary btn-avery-ios-done" id="btn-avery-ios-print-done" data-avery-ios-done>
        Fertig
      </button>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

function openIosPrintOverlay(multi) {
  const overlay = ensureIosPrintOverlay();
  const summary = document.getElementById('avery-ios-print-summary');
  const help = document.getElementById('avery-ios-print-help');
  if (summary) {
    const n = multi?.sheetCount || 1;
    const labels = multi?.totalQueued || 0;
    summary.textContent = n > 1
      ? `${n} Bögen · ${labels} Etiketten sind vorbereitet.`
      : `1 Bogen · ${labels} Etiketten sind vorbereitet.`;
  }
  if (help) {
    help.textContent = 'Tippe auf Drucken — der Druck öffnet sich in Safari. Danach hier auf Fertig.';
  }
  overlay.hidden = false;
  document.body.classList.add('avery-ios-print-open');
}

function closeIosPrintOverlay() {
  const overlay = document.getElementById('avery-ios-print-overlay');
  if (overlay) overlay.hidden = true;
  document.body.classList.remove('avery-ios-print-open');
}

/**
 * iOS: window.print() im PWA-Kontext oft wirkungslos.
 * Deshalb synchron window.open mit vorbereitetem HTML (User-Gesture).
 * @returns {boolean}
 */
function triggerIosPrintNow() {
  const areaHtml = document.getElementById('avery-print-area')?.innerHTML || '';
  const html = cachedIosPrintHtml || buildIosPrintDocumentHtml(areaHtml);
  if (!html || !/avery-label/.test(html)) {
    window.showToast?.('Druckbogen ist noch nicht bereit. Bitte kurz warten und noch einmal tippen.', 'warning');
    return false;
  }

  // Muss synchron im Klick bleiben — sonst blockiert iOS das Fenster.
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.showToast?.('Bitte Pop-ups erlauben, damit wir den Druck öffnen können.', 'warning');
    try { window.print(); } catch (_) { /* ignore */ }
    return false;
  }
  try {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  } catch (err) {
    console.error('[Avery Print] iOS Druckfenster:', err);
    try { printWindow.close(); } catch (_) { /* ignore */ }
    window.showToast?.('Druckfenster konnte nicht geöffnet werden. Bitte noch einmal tippen.', 'warning');
    return false;
  }

  const help = document.getElementById('avery-ios-print-help');
  if (help) {
    help.textContent = 'Druckvorschau ist offen. Fenster schließen, dann hier auf Fertig tippen.';
  }
  window.showToast?.('Druckvorschau geöffnet.', 'success');
  return true;
}

/**
 * Druck anfordern: fehlende Vorbereitung → Toast.
 * iOS/PWA → Overlay; Drucken öffnet Safari-Druckfenster. Desktop → window.print().
 * @returns {boolean}
 */
function requestAveryPrintFromClick() {
  const { ready, hasLabels, hasOhr, multi } = getAveryPrintReadiness();
  if (!ready) {
    if (!hasLabels) {
      window.showToast?.('Bitte zuerst Teilstücke zur Druckliste hinzufügen.', 'warning');
    } else if (!hasOhr) {
      window.showToast?.('Bitte die Ohrmarke eintragen – sonst können wir den Bogen nicht drucken.', 'warning');
      document.getElementById('avery-ohrmarke')?.focus?.();
    }
    return false;
  }

  const area = document.getElementById('avery-print-area');
  if (!(area instanceof HTMLElement) || !area.querySelector('.avery-label:not(.empty)')) {
    window.showToast?.('Druckbogen ist noch nicht bereit. Bitte kurz warten und noch einmal tippen.', 'warning');
    return false;
  }

  // iOS / PWA: Overlay bleibt als Rückweg; eigentlicher Druck erst bei „Drucken“.
  if (isIosOrStandalonePwa()) {
    openIosPrintOverlay(multi);
    return true;
  }

  window.print();
  return true;
}

function renderQueue() {
  const tbody = document.getElementById('avery-queue-body');
  const totalEl = document.getElementById('avery-queue-total');
  if (!tbody) return;
  if (!state.queue.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="avery-queue-empty">Noch keine Teilstücke in der Druckliste.</td></tr>';
  } else {
    tbody.innerHTML = state.queue.map((row) => {
      const cut = resolveQueueCut(row);
      const name = cut?.name || row.name || row.cutId;
      const days = cut ? (cut.days > 0 ? `${cut.days} T` : 'frisch') : '';
      const key = queueRowKey(row);
      const badge = row.isCustom ? '<span class="avery-queue-custom">Freifeld</span>' : '';
      return `
        <tr data-queue-key="${escapeHtml(key)}">
          <td>
            <strong>${escapeHtml(name)}</strong>
            ${badge}
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
  const catalogKey = TAB_TO_CATALOG_KEY[state.activeTab] || 'schultern';
  const cuts = GALLOWAY_CATALOG[catalogKey] || [];
  host.innerHTML = `
    <div class="avery-catalog-grid">
      ${cuts.map((cut) => {
        const qty = state.queue.find((row) => !row.isCustom && row.cutId === cut.id)?.qty || 0;
        return `
          <button type="button" class="avery-cut-chip${qty ? ' is-active' : ''}" data-avery-add="${escapeHtml(cut.id)}">
            <strong>${escapeHtml(cut.name)}</strong>
            <span>${cut.days > 0 ? `${cut.days} Tage Reife` : 'frisch'}${qty ? ` · ${qty}×` : ''}</span>
          </button>
        `;
      }).join('')}
    </div>

    <div class="avery-trim-box">
      <h3>Abschnitte / Trimmings</h3>
      <p class="avery-trim-hint">Antippen = +1 auf den Bogen (wie bei den Teilstücken).</p>
      <div class="avery-trim-grid avery-catalog-grid">
        ${AVERY_TRIMMINGS.map((trim) => {
          const qty = state.queue.find((row) => !row.isCustom && row.cutId === trim.id)?.qty || 0;
          return `
            <button type="button" class="avery-cut-chip avery-trim-chip${qty ? ' is-active' : ''}" data-avery-add="${escapeHtml(trim.id)}">
              <strong>${escapeHtml(trim.name)}</strong>
              <span>Art. ${escapeHtml(trim.artNr || '–')}${qty ? ` · ${qty}×` : ''}</span>
            </button>
          `;
        }).join('')}
      </div>
    </div>

    <div class="avery-custom-box">
      <h3>Spezial-Teilstück (Freifeld)</h3>
      <div class="avery-custom-row">
        <label class="form-label" for="avery-custom-name">Bezeichnung
          <input id="avery-custom-name" class="input-text-touch" type="text" placeholder="z. B. Tomahawk-Steak, Picanha am Stück" autocomplete="off">
        </label>
        <label class="form-label" for="avery-custom-aging">Reifung
          <select id="avery-custom-aging" class="input-text-touch">
            ${CUSTOM_AGING_OPTIONS.map((opt) => `
              <option value="${opt.days}">${escapeHtml(opt.label)}</option>
            `).join('')}
          </select>
        </label>
        <button type="button" class="btn btn-primary btn-compact" id="btn-avery-custom-add">[+] Bogen</button>
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
    'avery-brand': 'brand',
  };
  Object.entries(map).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el && el.value !== state.header[key]) el.value = state.header[key] || '';
  });
  const printBetrieb = document.getElementById('avery-print-betrieb');
  if (printBetrieb instanceof HTMLInputElement) {
    printBetrieb.checked = Boolean(state.header.printBetrieb);
  }
  const printSchlachthof = document.getElementById('avery-print-schlachthof');
  if (printSchlachthof instanceof HTMLInputElement) {
    printSchlachthof.checked = Boolean(state.header.printSchlachthof);
  }
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
  state.header.brand = String(document.getElementById('avery-brand')?.value || 'SH').trim().toUpperCase();
  const printBetrieb = document.getElementById('avery-print-betrieb');
  state.header.printBetrieb = printBetrieb instanceof HTMLInputElement ? printBetrieb.checked : false;
  const printSchlachthof = document.getElementById('avery-print-schlachthof');
  state.header.printSchlachthof = printSchlachthof instanceof HTMLInputElement ? printSchlachthof.checked : false;
  delete state.header.reifehinweis;
}

/**
 * Druckfläche als direktes body-Kind (überlebt style.css
 * `body > *:not(.preview-container) { display:none }` im Print).
 */
export function ensureAveryPrintArea() {
  let area = document.getElementById('avery-print-area');
  if (!(area instanceof HTMLElement)) {
    area = document.createElement('div');
    area.id = 'avery-print-area';
    area.className = 'avery-print-root';
    area.setAttribute('aria-hidden', 'true');
  }
  if (area.parentElement !== document.body) {
    document.body.appendChild(area);
  }
  return area;
}

/**
 * iOS-sicherer Drucktrigger.
 * Nicht ready → Toast (Laden-iPhone-Wording). Ready → nur synchrones window.print().
 * Druckbogen (#avery-print-area) und body.print-avery-labels werden
 * bereits bei Auswahländerungen in renderSheetPreview/syncPrintReadyState vorbereitet.
 */
export function printAveryLabelsSheet() {
  return requestAveryPrintFromClick();
}

function adjustQueueByKey(key, deltaOrRemove) {
  const idx = state.queue.findIndex((row) => queueRowKey(row) === key);
  if (idx < 0) return;
  if (deltaOrRemove === 'remove') {
    state.queue.splice(idx, 1);
  } else {
    const next = (state.queue[idx].qty || 0) + deltaOrRemove;
    if (next <= 0) state.queue.splice(idx, 1);
    else state.queue[idx].qty = next;
  }
  persistDraft();
  renderAll();
}

function bindEvents(root) {
  if (!root || root.dataset.averyBound === '1') return;
  root.dataset.averyBound = '1';

  ensureIosPrintOverlay();

  // Print-Button: iOS → Overlay, Desktop → window.print(); stopPropagation gegen Doppel-Fire
  const printBtn = document.getElementById('btn-avery-print-sheet');
  if (printBtn instanceof HTMLButtonElement && printBtn.dataset.averyPrintBound !== '1') {
    printBtn.dataset.averyPrintBound = '1';
    printBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      requestAveryPrintFromClick();
    });
  }

  const iosPrintNow = document.getElementById('btn-avery-ios-print-now');
  if (iosPrintNow instanceof HTMLButtonElement && iosPrintNow.dataset.averyPrintBound !== '1') {
    iosPrintNow.dataset.averyPrintBound = '1';
    iosPrintNow.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      triggerIosPrintNow();
    });
  }
  const iosPrintDone = document.getElementById('btn-avery-ios-print-done');
  if (iosPrintDone instanceof HTMLButtonElement && iosPrintDone.dataset.averyDoneBound !== '1') {
    iosPrintDone.dataset.averyDoneBound = '1';
    iosPrintDone.addEventListener('click', (event) => {
      event.stopPropagation();
      closeIosPrintOverlay();
    });
  }

  root.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
      return;
    }
    if (!target.id?.startsWith('avery-')) return;
    if (target.id === 'avery-custom-name' || target.id === 'avery-custom-aging') return;
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
      state.activeTab = tabBtn.getAttribute('data-avery-tab') || 'schultern';
      persistDraft();
      renderAll();
      return;
    }

    const addBtn = target.closest('[data-avery-add]');
    if (addBtn) {
      const cutId = addBtn.getAttribute('data-avery-add');
      const current = state.queue.find((row) => !row.isCustom && row.cutId === cutId)?.qty || 0;
      setQueueQty(cutId, current + 1);
      return;
    }

    if (target.closest('#btn-avery-custom-add')) {
      const name = document.getElementById('avery-custom-name')?.value || '';
      const days = document.getElementById('avery-custom-aging')?.value || '0';
      if (addCustomCutToQueue(name, days)) {
        const nameInput = document.getElementById('avery-custom-name');
        if (nameInput) nameInput.value = '';
      }
      return;
    }

    const sheetTab = target.closest('[data-avery-sheet-tab]');
    if (sheetTab) {
      const idx = Number.parseInt(sheetTab.getAttribute('data-avery-sheet-tab') || '0', 10) || 0;
      state.previewSheetIndex = Math.max(0, idx);
      renderSheetPreview();
      return;
    }

    const slotBtn = target.closest('[data-avery-slot]');
    if (slotBtn) {
      const slot = Number.parseInt(slotBtn.getAttribute('data-avery-slot') || '1', 10);
      state.startSlot = Math.min(24, Math.max(1, slot || 1));
      state.previewSheetIndex = 0;
      persistDraft();
      renderSheetPreview();
      window.showToast?.(`Start-Slot ${state.startSlot} gesetzt.`, 'info');
      return;
    }

    // Backup-Delegation (falls Direkt-Listener fehlt)
    if (target.closest('#btn-avery-print-sheet') || target.closest('[data-avery-print]')) {
      requestAveryPrintFromClick();
      return;
    }

    if (target.closest('#btn-avery-ios-print-now') || target.closest('[data-avery-ios-print]')) {
      triggerIosPrintNow();
      return;
    }

    if (target.closest('#btn-avery-ios-print-done') || target.closest('[data-avery-ios-done]')) {
      closeIosPrintOverlay();
      return;
    }

    if (target.closest('#btn-avery-fill-hack')) {
      fillRestWithHack();
      return;
    }

    if (target.closest('#btn-avery-reset-sheet') || target.closest('[data-avery-reset]')) {
      resetAverySheet();
      return;
    }

    if (target.closest('#btn-avery-clear-queue')) {
      resetAverySheet();
      return;
    }

    const row = target.closest('[data-queue-key]');
    if (row) {
      const key = row.getAttribute('data-queue-key');
      if (target.closest('[data-avery-remove]')) {
        adjustQueueByKey(key, 'remove');
        return;
      }
      const stepBtn = target.closest('[data-avery-qty]');
      if (stepBtn) {
        const delta = Number.parseInt(stepBtn.getAttribute('data-avery-qty') || '0', 10) || 0;
        adjustQueueByKey(key, delta);
      }
    }
  });
}

function buildShellHtml() {
  return `
    <section class="avery-suite" aria-label="Avery 3475 Zerlege- und Reife-Etikettierung">
      <header class="avery-suite-header">
        <div>
          <p class="avery-kicker">WG 0460 · Avery 3475</p>
          <h2 class="avery-suite-title">🏷️ Zerlege- &amp; Reife-Etiketten</h2>
          <p class="avery-suite-lead">Klare Inhalts-Deklaration auf Avery 3475 (70×36&nbsp;mm Querformat) – nach Baugruppe und Freifeld.</p>
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
        </div>
        <div class="avery-print-toggles" role="group" aria-label="Was auf dem Etikett erscheint">
          <label class="avery-toggle" for="avery-print-betrieb">
            <input id="avery-print-betrieb" type="checkbox">
            <span>Betriebsname auf Etikett drucken</span>
          </label>
          <label class="avery-toggle" for="avery-print-schlachthof">
            <input id="avery-print-schlachthof" type="checkbox">
            <span>Schlachthof auf Etikett drucken</span>
          </label>
        </div>
        <p class="avery-lot-line">LOT: <strong id="avery-lot-preview">–</strong></p>
      </section>

      <section class="avery-card" aria-labelledby="avery-catalog-title">
        <div class="avery-card-head">
          <h3 id="avery-catalog-title" class="avery-card-title">Teilstücke nach Baugruppe</h3>
        </div>
        <div class="avery-tab-row" role="tablist" aria-label="Zerlege-Baugruppen">
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
        <div class="avery-sheet-tabs" id="avery-sheet-tabs" hidden role="tablist" aria-label="Etikettenbögen"></div>
        <div class="avery-gauge" aria-label="Bogen-Auslastung">
          <div class="avery-gauge-track"><div class="avery-gauge-fill" id="avery-gauge-fill"></div></div>
          <p class="avery-gauge-text" id="avery-gauge-text">0 / 24 Nutzen</p>
        </div>
        <p class="avery-overflow-warn" id="avery-overflow-warn" hidden></p>
        <p class="avery-slot-hint">Tipp: Auf Bogen 1 freien Slot antippen = Start-Position für angefangene Bögen. Folge-Bögen starten automatisch bei Nutzen 1.</p>
        <div class="sheet-scroll-wrapper avery-sheet-scroll">
          <div class="avery-sheet-preview" id="avery-sheet-preview"></div>
        </div>
        <p class="avery-print-hint" id="avery-print-hint" hidden></p>
        <div class="avery-print-actions">
          <button type="button" class="btn btn-secondary btn-avery-reset" id="btn-avery-reset-sheet" data-avery-reset>
            Bogen zurücksetzen
          </button>
          <button type="button" class="btn btn-primary btn-avery-print" id="btn-avery-print-sheet" data-avery-print>
            🖨️ Etikettenbogen drucken
          </button>
        </div>
      </section>
    </section>
  `;
}

export function initAveryLabelsModule() {
  const page = document.getElementById('page-avery');
  if (!page) return;
  if (!state.initialized) {
    restoreDraft();
    ensureHeaderDefaults();
    page.innerHTML = buildShellHtml();
    ensureAveryPrintArea();
    bindEvents(page);
    state.initialized = true;
  } else {
    ensureHeaderDefaults();
    ensureAveryPrintArea();
    // Falls DOM neu gemountet wurde: Binding wiederherstellen
    if (page.dataset.averyBound !== '1') bindEvents(page);
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

/** Alias für ältere Imports / Tests */
export const AVERY_CUT_CATALOG_FLAT = AVERY_CUT_CATALOG;
