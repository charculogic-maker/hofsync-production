/**
 * Avery 3475 Zerlege- & Reife-Etikettierung (Modul averyLabels).
 * Hof-Praxis: Schulter (+Hals/Brust), Rücken, Keule, Lappen, Innereien + Freifeld.
 * Gemeinsamer Draft: tenants/{tenantId}/averyDrafts/current (Phone ↔ Laden-PC).
 */

import { writeFirestoreDocOrQueue } from './sync.js';
import { hasModule } from './tenant-modules.js';
import {
  getGlobalTenantId,
  getTenantCollection,
  normalizeTenantId,
} from './tenant-db.js';
import {
  ACTIVE_EMPLOYEE_STORAGE_KEY,
  readScopedLocalStorageValue,
} from './teamboard-storage.js';

/** Firestore-Collection für LMIV-Herkunft / Thekenbuch */
const CHARGEN_DOKU_COLLECTION = 'chargendoku';
const HERKUNFT_OPTIONS_LIMIT = 40;

export const AVERY_LABELS_PER_SHEET = 24;
export const AVERY_MODULE_KEY = 'averyLabels';
export const AVERY_DRAFT_COLLECTION = 'averyDrafts';
export const AVERY_DRAFT_DOC_ID = 'current';
const PRINT_BODY_CLASS = 'print-avery-labels';
const STORAGE_KEY_BASE = 'charculogic.averyLabels.draft.v3';
const DEVICE_ID_KEY = 'charculogic.averyLabels.deviceId';
const CLOUD_WRITE_DEBOUNCE_MS = 400;

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   days: number,
 *   tab: 'schulter'|'ruecken'|'keule'|'lappen'|'innereien'|null,
 *   trim?: boolean,
 *   artNr?: string,
 *   aliases?: string[],
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
 * Praxis-Katalog nach Zerlege-Baugruppen mit Kassen-PLU (StevesHof / BioOffice).
 * Hals/Brust am Schultertisch; Brust nicht unter Lappen.
 */
export const GALLOWAY_CATALOG = Object.freeze({
  schultern: Object.freeze([
    { id: 'sch-506', name: 'Schmorbraten Schulter', days: 14, tab: 'schulter', artNr: '506', aliases: ['Schmorbraten', 'Bug', 'Schulterbraten'] },
    { id: 'sch-510', name: 'Falsches Filet', days: 14, tab: 'schulter', artNr: '510' },
    { id: 'sch-516', name: 'Flat Iron Steak', days: 14, tab: 'schulter', artNr: '516', aliases: ['Flat Iron'] },
    { id: 'sch-518', name: 'Bäckchen', days: 14, tab: 'schulter', artNr: '518', aliases: ['Baeckchen', 'Backen'] },
    { id: 'sch-538', name: 'Metzgerstück', days: 14, tab: 'schulter', artNr: '538', aliases: ['Metzgerstueck'] },
    { id: 'sch-539', name: 'Blattsteak / Vegas Cut', days: 14, tab: 'schulter', artNr: '539', aliases: ['Blattsteak', 'Vegas Cut', 'Schaufelstück', 'Schaufelstueck'] },
    { id: 'sch-542', name: 'Schildstück', days: 14, tab: 'schulter', artNr: '542', aliases: ['Schildstueck'] },
    { id: 'sch-541', name: 'Brust o. K. / Brisket', days: 14, tab: 'schulter', artNr: '541', aliases: ['Brust', 'Brisket', 'Brust ohne Knochen'] },
    { id: 'sch-511', name: 'Brust mit Knochen', days: 14, tab: 'schulter', artNr: '511' },
    { id: 'sch-5091', name: 'Fondue/Raclette Schulter', days: 0, tab: 'schulter', artNr: '5091', aliases: ['Fondue Schulter', 'Raclette Schulter'] },
  ]),
  ruecken: Object.freeze([
    { id: 'rue-501', name: 'Filet ganz', days: 28, tab: 'ruecken', artNr: '501', aliases: ['Filet', 'Rinderfilet'] },
    { id: 'rue-499', name: 'Filet, Spitze / Kopf', days: 28, tab: 'ruecken', artNr: '499', aliases: ['Filet Spitze', 'Filet Kopf', 'Filetspitze'] },
    { id: 'rue-500', name: 'Filet Tournedos', days: 28, tab: 'ruecken', artNr: '500', aliases: ['Tournedos'] },
    { id: 'rue-502', name: 'Rumpsteak', days: 28, tab: 'ruecken', artNr: '502', aliases: ['Roastbeef'] },
    { id: 'rue-514', name: 'Entrecôte / Rib Eye o. K.', days: 21, tab: 'ruecken', artNr: '514', aliases: ['Entrecôte', 'Entrecote', 'Rib Eye', 'Ribeye'] },
    { id: 'rue-531', name: 'Entrecôte m. Knochen', days: 21, tab: 'ruecken', artNr: '531', aliases: ['Entrecote mit Knochen'] },
    { id: 'rue-515', name: 'Schmorbraten Hohe Rippe', days: 21, tab: 'ruecken', artNr: '515', aliases: ['Hohe Rippe', 'Dicke Rippe'] },
    { id: 'rue-520', name: 'Hohe Rippe m. K.', days: 21, tab: 'ruecken', artNr: '520', aliases: ['Hohe Rippe mit Knochen'] },
    { id: 'rue-534', name: 'Tomahawk-Steak', days: 21, tab: 'ruecken', artNr: '534', aliases: ['Tomahawk'] },
    { id: 'rue-547', name: 'T-Bone Steak', days: 21, tab: 'ruecken', artNr: '547', aliases: ['T-Bone', 'T Bone'] },
    { id: 'rue-548', name: 'Porterhouse Steak', days: 21, tab: 'ruecken', artNr: '548', aliases: ['Porterhouse'] },
    { id: 'rue-549', name: 'Club Steak', days: 21, tab: 'ruecken', artNr: '549' },
    { id: 'rue-5092', name: 'Fondue/Raclette Rücken', days: 0, tab: 'ruecken', artNr: '5092', aliases: ['Fondue Rücken', 'Fondue Ruecken', 'Raclette Rücken'] },
  ]),
  keule: Object.freeze([
    { id: 'keu-508', name: 'Tafelspitz', days: 28, tab: 'keule', artNr: '508' },
    { id: 'keu-509', name: 'Bürgermeisterstück', days: 28, tab: 'keule', artNr: '509', aliases: ['Buergermeisterstueck', 'Bürgermeister'] },
    { id: 'keu-507', name: 'Braten a.d. Keule', days: 28, tab: 'keule', artNr: '507', aliases: ['Braten aus der Keule', 'Keulenbraten', 'Oberschale', 'Unterschale'] },
    { id: 'keu-505', name: 'Roulade', days: 28, tab: 'keule', artNr: '505', aliases: ['Rouladen'] },
    { id: 'keu-5052', name: 'Oberschalendeckel', days: 28, tab: 'keule', artNr: '5052' },
    { id: 'keu-513', name: 'Hüftsteak', days: 28, tab: 'keule', artNr: '513', aliases: ['Hueftsteak', 'Hüfte', 'Huefte'] },
    { id: 'keu-521', name: 'Wade', days: 21, tab: 'keule', artNr: '521' },
    { id: 'keu-540', name: 'Spidersteak', days: 28, tab: 'keule', artNr: '540', aliases: ['Spider', 'Nuss'] },
    { id: 'keu-523', name: 'Beinscheibe', days: 21, tab: 'keule', artNr: '523' },
    { id: 'keu-403', name: 'Beef Hammer', days: 21, tab: 'keule', artNr: '403' },
    { id: 'keu-5041', name: 'Gulasch aus der Wade', days: 0, tab: 'keule', artNr: '5041', aliases: ['Gulasch'] },
  ]),
  lappen: Object.freeze([
    { id: 'lap-517', name: 'Flanksteak / Bavette', days: 14, tab: 'lappen', artNr: '517', aliases: ['Flanksteak', 'Flank', 'Bavette', 'Dünnung', 'Duenning'] },
    { id: 'lap-522', name: 'Skirt Steak / Zwerchfell', days: 14, tab: 'lappen', artNr: '522', aliases: ['Skirt', 'Skirt Steak', 'Zwerchfell'] },
    { id: 'lap-401', name: 'Querrippe / Short Ribs', days: 14, tab: 'lappen', artNr: '401', aliases: ['Querrippe', 'Short Ribs', 'Spannrippe'] },
    { id: 'lap-512', name: 'Suppenfleisch Rippe', days: 0, tab: 'lappen', artNr: '512', aliases: ['Suppenfleisch'] },
  ]),
  innereien: Object.freeze([
    { id: 'inn-400', name: 'Niere', days: 0, tab: 'innereien', artNr: '400' },
    { id: 'inn-519', name: 'Nierenzapfen / Onglet', days: 0, tab: 'innereien', artNr: '519', aliases: ['Nierenzapfen', 'Onglet'] },
    { id: 'inn-524', name: 'Ochsenschwanz', days: 0, tab: 'innereien', artNr: '524' },
    { id: 'inn-525', name: 'Zunge', days: 0, tab: 'innereien', artNr: '525' },
    { id: 'inn-526', name: 'Leber', days: 0, tab: 'innereien', artNr: '526' },
    { id: 'inn-527', name: 'Herz', days: 0, tab: 'innereien', artNr: '527' },
    { id: 'inn-528', name: 'Fleischknochen', days: 0, tab: 'innereien', artNr: '528', aliases: ['Suppenknochen'] },
    { id: 'inn-529', name: 'Markknochen', days: 0, tab: 'innereien', artNr: '529' },
  ]),
});

/** Abschnitte / Trimmings – Kassen-PLU wie Zerlege-HTML */
export const AVERY_TRIMMINGS = Object.freeze([
  { id: 'tr-r1-mager', name: 'R I Mager', days: 0, tab: null, trim: true, artNr: '504', aliases: ['RI Mager', 'R1 Mager'] },
  { id: 'tr-r1-spiesse', name: 'R I Spieße', days: 0, tab: null, trim: true, artNr: '535', aliases: ['R I Spiesse', 'RI Spieße', 'Spieße', 'Spiesse'] },
  { id: 'tr-r2-hack', name: 'R II Hack', days: 0, tab: null, trim: true, artNr: '503', aliases: ['R II Hackfleisch', 'Hackfleisch', 'Hack', 'R2 Hack'] },
  { id: 'tr-r3-wurst', name: 'R III Wurst', days: 0, tab: null, trim: true, artNr: '460', aliases: ['R3 Wurst', 'Wurstfleisch'] },
  { id: 'tr-fett', name: 'Fett', days: 0, tab: null, trim: true, artNr: '449' },
]);

/** Alte Draft-/Test-IDs → aktueller PLU-Katalog */
export const AVERY_LEGACY_CUT_IDS = Object.freeze({
  'sch-bug': 'sch-506',
  'sch-falsches-filet': 'sch-510',
  'sch-schaufel': 'sch-539',
  'sch-dicke-rippe': 'rue-515',
  'sch-nacken': 'sch-506',
  'sch-brust': 'sch-541',
  'rue-entrecote': 'rue-514',
  'rue-roastbeef': 'rue-502',
  'rue-filet': 'rue-501',
  'keu-oberschale': 'keu-507',
  'keu-unterschale': 'keu-507',
  'keu-nuss': 'keu-540',
  'keu-huefte': 'keu-513',
  'keu-tafelspitz': 'keu-508',
  'keu-buergermeister': 'keu-509',
  'keu-wade': 'keu-521',
  'lap-duennung': 'lap-517',
  'lap-flank': 'lap-517',
  'lap-skirt': 'lap-522',
  'lap-spannrippe': 'lap-401',
  'inn-leber': 'inn-526',
  'inn-herz': 'inn-527',
  'inn-zunge': 'inn-525',
  'inn-ochsenschwanz': 'inn-524',
  'inn-backen': 'sch-518',
  'inn-markknochen': 'inn-529',
  'inn-suppenknochen': 'inn-528',
});

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
  schultern: { label: 'Schulter', hint: 'Schmorbraten, Flat Iron, Brust/Brisket – PLU am Schultertisch' },
  ruecken: { label: 'Rücken', hint: 'Filet, Entrecôte, Tomahawk, T-Bone – ohne Schulter' },
  keule: { label: 'Keule', hint: 'Tafelspitz bis Wade, Roulade, Beef Hammer' },
  lappen: { label: 'Lappen', hint: 'Flank, Skirt, Querrippe – ohne Brust' },
  innereien: { label: 'Innereien & Knochen', hint: 'Leber, Herz, Zunge, Niere, Knochen' },
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
  /** @type {boolean} Kassen-PLU auf Etikett (Default an, wie Zerlege-HTML) */
  printPlu: true,
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

/** @type {{ header: Record<string, string|boolean>, queue: AveryQueueRow[], startSlot: number, previewSheetIndex: number, activeTab: string, initialized: boolean, herkunftOptions: Array<Record<string, unknown>>, herkunftStatus: string, packlistStatus: string, packlistCount: number }} */
const state = {
  header: { ...DEFAULT_HEADER },
  queue: [],
  startSlot: 1,
  previewSheetIndex: 0,
  activeTab: 'schultern',
  initialized: false,
  /** @type {Array<{ id: string, lotNumber: string, label: string, record: Record<string, unknown> }>} */
  herkunftOptions: [],
  herkunftStatus: 'idle',
  packlistStatus: 'idle',
  packlistCount: 0,
};

/** @type {{
 *   unsubscribe: null|(() => void),
 *   debounceTimer: ReturnType<typeof setTimeout>|null,
 *   applyingRemote: boolean,
 *   writing: boolean,
 *   lastAppliedMs: number,
 *   lastLocalWriteMs: number,
 *   deviceId: string,
 *   status: 'local'|'connecting'|'live'|'syncing'|'offline'|'error',
 *   updatedBy: string,
 * }} */
const cloud = {
  unsubscribe: null,
  debounceTimer: null,
  applyingRemote: false,
  writing: false,
  lastAppliedMs: 0,
  lastLocalWriteMs: 0,
  deviceId: '',
  status: 'local',
  updatedBy: '',
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

/**
 * Zerlegt ein Herkunfts-LOT (Avery-Stil oder Ohrmarke) für die Etiketten-Kopfdaten.
 * @param {string} lotNumber
 * @returns {{ brand?: string, ohrmarke: string, schlachtDatum?: string }}
 */
export function parseHerkunftLotForAvery(lotNumber) {
  const raw = String(lotNumber || '').trim();
  if (!raw) return { ohrmarke: '' };

  const compact = raw.replace(/\s+/g, '');
  const averyLot = /^([A-Za-z0-9]{1,6})-([A-Za-z0-9]+)-(\d{8})$/.exec(compact);
  if (averyLot) {
    const stamp = averyLot[3];
    return {
      brand: averyLot[1].toUpperCase(),
      ohrmarke: averyLot[2].toUpperCase(),
      schlachtDatum: `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`,
    };
  }

  const deEar = /^(DE)[\s-]*(\d[\d\s-]*)$/i.exec(raw);
  if (deEar) {
    return { ohrmarke: `DE${deEar[2].replace(/[\s-]+/g, '')}` };
  }

  return { ohrmarke: compact.toUpperCase() };
}

/**
 * Mappt einen Chargen-Doku-/Herkunftseintrag auf Avery-Kopfdaten.
 * @param {Record<string, unknown>|null|undefined} record
 */
export function mapHerkunftRecordToAveryHeader(record) {
  if (!record || typeof record !== 'object') {
    return { ohrmarke: '', schlachthof: '', oeko: '', brand: '', schlachtDatum: '', herkunftLot: '', herkunftId: '' };
  }
  const lotNumber = String(record.lotNumber || '').trim();
  const parsed = parseHerkunftLotForAvery(lotNumber);
  const healthMark = String(record.healthMark || '').trim();
  const oeko = String(record.organicControlBody || '').trim();
  const cuttingPlant = String(record?.origin?.cuttingPlantNo || '').trim();
  return {
    ohrmarke: parsed.ohrmarke || '',
    schlachtDatum: parsed.schlachtDatum || '',
    brand: parsed.brand || '',
    schlachthof: healthMark || cuttingPlant || '',
    oeko: oeko || '',
    herkunftLot: lotNumber,
    herkunftId: String(record.id || '').trim(),
  };
}

/**
 * Etiketten-Menge aus einer Metzgerei-Packlisten-Zeile.
 * Stück/Pack → gerundete Menge; kg oft 1 Etikett (außer kleine Ganzzahlen = Packzahl).
 * @param {{ quantity?: number, unit?: string }} item
 */
export function labelQtyFromButcheryTask(item = {}) {
  const qty = Number(item.quantity);
  const safeQty = Number.isFinite(qty) ? qty : 0;
  const unit = String(item.unit || '').toLowerCase();

  if (/stück|stueck|stk\.?|pack|beutel|portion|etikett/.test(unit)) {
    return Math.max(1, Math.min(999, Math.round(safeQty) || 1));
  }
  if (/\bkg\b|gramm|\bg\b/.test(unit)) {
    if (Number.isInteger(safeQty) && safeQty >= 1 && safeQty <= 48) return safeQty;
    return 1;
  }
  if (Number.isInteger(safeQty) && safeQty >= 1 && safeQty <= 48) return safeQty;
  if (safeQty > 0) return Math.max(1, Math.min(999, Math.round(safeQty)));
  return 1;
}

/**
 * Metzgerei-Packliste → Katalog-/Freifeld-Zeilen für den Avery-Bogen.
 * @param {Array<{ product?: string, productId?: string, quantity?: number, unit?: string }>} tasks
 */
export function mapButcheryTasksToAveryImportItems(tasks = []) {
  /** @type {{ product: string, productId: string, qty: number, cut: AveryCut|null, name: string }[]} */
  const items = [];
  (Array.isArray(tasks) ? tasks : []).forEach((task) => {
    const product = String(task?.product || '').trim();
    if (!product) return;
    const productId = String(task?.productId || '').trim();
    const qty = labelQtyFromButcheryTask(task);
    const cut = (productId && getCutByArtNr(productId))
      || matchAveryCatalogEntry(productId)
      || matchAveryCatalogEntry(product);
    items.push({
      product,
      productId,
      qty,
      cut,
      name: cut?.name || product,
    });
  });
  return {
    items,
    matchedCount: items.filter((item) => item.cut).length,
    customCount: items.filter((item) => !item.cut).length,
    totalLabels: items.reduce((sum, item) => sum + item.qty, 0),
  };
}

export function resolveAveryCutId(cutId) {
  const raw = String(cutId || '').trim();
  if (!raw) return '';
  if (AVERY_CUT_CATALOG.some((cut) => cut.id === raw)) return raw;
  const mapped = AVERY_LEGACY_CUT_IDS[raw];
  return mapped || raw;
}

export function getCutById(cutId) {
  const id = resolveAveryCutId(cutId);
  return AVERY_CUT_CATALOG.find((cut) => cut.id === id) || null;
}

/** @param {string} artNr */
export function getCutByArtNr(artNr) {
  const plu = String(artNr || '').trim();
  if (!plu) return null;
  return AVERY_CUT_CATALOG.find((cut) => String(cut.artNr || '') === plu) || null;
}

/** @param {string} value */
export function normalizeAveryMatchKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Findet Katalog-Eintrag zu Name/Alias/PLU (für Notiz-Import).
 * @param {string} nameOrPlu
 * @returns {AveryCut|null}
 */
export function matchAveryCatalogEntry(nameOrPlu) {
  const raw = String(nameOrPlu || '').trim();
  if (!raw) return null;

  const pluOnly = /^(?:plu[:\s]*)?(\d{3,5})$/i.exec(raw);
  if (pluOnly) return getCutByArtNr(pluOnly[1]);

  const key = normalizeAveryMatchKey(raw);
  if (!key) return null;

  let best = null;
  let bestScore = 0;
  for (const cut of AVERY_CUT_CATALOG) {
    const candidates = [cut.name, cut.artNr, ...(cut.aliases || [])];
    for (const candidate of candidates) {
      const candKey = normalizeAveryMatchKey(candidate);
      if (!candKey) continue;
      if (candKey === key) return cut;
      if (key.length >= 4 && (candKey.includes(key) || key.includes(candKey))) {
        const score = Math.min(key.length, candKey.length);
        if (score > bestScore) {
          best = cut;
          bestScore = score;
        }
      }
    }
  }
  return best;
}

/**
 * Eine Notiz-Zeile → Name/PLU + Menge.
 * @param {string} line
 * @returns {{ name: string, plu: string, qty: number }|null}
 */
export function parseAveryPlainTextLine(line) {
  const raw = String(line || '').trim().replace(/^[-*•]\s*/, '');
  if (!raw || raw.startsWith('#')) return null;

  const pluFirst = /^(?:plu[:\s]*)?(\d{3,5})\s*(?:[x×*]\s*)?(\d{1,3})?$/i.exec(raw);
  if (pluFirst) {
    return {
      name: '',
      plu: pluFirst[1],
      qty: Math.max(1, Number.parseInt(pluFirst[2] || '1', 10) || 1),
    };
  }

  const namePluQty = /^(.+?)\s+(?:plu[:\s]*)?(\d{3,5})\s*(?:[x×*]\s*)?(\d{1,3})?$/i.exec(raw);
  if (namePluQty && getCutByArtNr(namePluQty[2])) {
    return {
      name: namePluQty[1].trim(),
      plu: namePluQty[2],
      qty: Math.max(1, Number.parseInt(namePluQty[3] || '1', 10) || 1),
    };
  }

  const nameQty = /^(.+?)\s+(?:[x×*]\s*)(\d{1,3})$/i.exec(raw)
    || /^(.+?)\s+(\d{1,3})$/i.exec(raw);
  if (nameQty) {
    const maybePlu = nameQty[2];
    // Trailing 3–5-digit token that is a known PLU → PLU, not quantity
    if (/^\d{3,5}$/.test(maybePlu) && getCutByArtNr(maybePlu) && !/[x×*]/i.test(raw)) {
      return { name: nameQty[1].trim(), plu: maybePlu, qty: 1 };
    }
    return {
      name: nameQty[1].trim(),
      plu: '',
      qty: Math.max(1, Number.parseInt(maybePlu, 10) || 1),
    };
  }

  return { name: raw, plu: '', qty: 1 };
}

/**
 * Mehrzeilige Notiz → erkannte Zeilen + Freifeld-Kandidaten.
 * @param {string} text
 */
export function parseAveryPlainTextList(text) {
  const lines = String(text || '').split(/\r?\n/);
  /** @type {{ line: string, qty: number, cut: AveryCut|null, name: string, plu: string }[]} */
  const items = [];
  /** @type {string[]} */
  const skipped = [];

  lines.forEach((line) => {
    const parsed = parseAveryPlainTextLine(line);
    if (!parsed) {
      if (String(line || '').trim()) skipped.push(String(line).trim());
      return;
    }
    const cut = parsed.plu
      ? (getCutByArtNr(parsed.plu) || matchAveryCatalogEntry(parsed.name || parsed.plu))
      : matchAveryCatalogEntry(parsed.name);
    items.push({
      line: String(line).trim(),
      qty: parsed.qty,
      cut,
      name: parsed.name || cut?.name || parsed.plu,
      plu: parsed.plu || cut?.artNr || '',
    });
  });

  return {
    items,
    matchedCount: items.filter((item) => item.cut).length,
    customCount: items.filter((item) => !item.cut).length,
    totalLabels: items.reduce((sum, item) => sum + item.qty, 0),
    skipped,
  };
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

function draftStorageKey() {
  const tid = normalizeTenantId(getGlobalTenantId());
  return tid ? `${tid}.${STORAGE_KEY_BASE}` : STORAGE_KEY_BASE;
}

/** @returns {string} */
export function getAveryDeviceId() {
  if (cloud.deviceId) return cloud.deviceId;
  try {
    let id = String(localStorage.getItem(DEVICE_ID_KEY) || '').trim();
    if (!id) {
      id = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    cloud.deviceId = id;
    return id;
  } catch (_) {
    cloud.deviceId = `dev-ephemeral-${Math.random().toString(36).slice(2, 8)}`;
    return cloud.deviceId;
  }
}

function resolveAveryUpdatedBy() {
  const tenantId = getGlobalTenantId();
  const employee = readScopedLocalStorageValue(ACTIVE_EMPLOYEE_STORAGE_KEY, tenantId);
  if (employee) return employee;
  return 'Laden';
}

/**
 * Serialisiert den aktuellen Draft für localStorage / Firestore.
 * @param {{ updatedAtMs?: number, updatedBy?: string, deviceId?: string, revision?: number }} [meta]
 */
export function serializeAveryDraft(meta = {}) {
  const updatedAtMs = Number(meta.updatedAtMs) || Date.now();
  return {
    tenantId: getGlobalTenantId() || '',
    header: { ...state.header },
    queue: state.queue.map((row) => ({ ...row })),
    startSlot: state.startSlot,
    activeTab: state.activeTab,
    updatedAtMs,
    updatedAt: new Date(updatedAtMs).toISOString(),
    updatedBy: String(meta.updatedBy || resolveAveryUpdatedBy()).trim() || 'Laden',
    deviceId: String(meta.deviceId || getAveryDeviceId()),
    revision: Number.isFinite(Number(meta.revision)) ? Number(meta.revision) : updatedAtMs,
  };
}

/** @param {unknown} value */
export function averyDraftUpdatedAtMs(value) {
  if (value == null) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value?.toMillis === 'function') {
    try { return Number(value.toMillis()) || 0; } catch (_) { return 0; }
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * @param {Record<string, unknown>|null|undefined} raw
 * @returns {boolean} true wenn State geändert wurde
 */
export function applyAveryDraftPayload(raw) {
  if (!raw || typeof raw !== 'object') return false;
  let changed = false;

  if (raw.header && typeof raw.header === 'object') {
    const { reifehinweis: _drop, ...restHeader } = raw.header;
    state.header = {
      ...DEFAULT_HEADER,
      ...restHeader,
      printBetrieb: coercePrintFlag(restHeader.printBetrieb, false),
      printSchlachthof: coercePrintFlag(restHeader.printSchlachthof, false),
      printPlu: coercePrintFlag(restHeader.printPlu, true),
    };
    delete state.header.reifehinweis;
    changed = true;
  }

  if (Array.isArray(raw.queue)) {
    state.queue = raw.queue.map(normalizeQueueRow).filter(Boolean);
    changed = true;
  }

  if (raw.startSlot != null) {
    state.startSlot = Math.min(24, Math.max(1, Number.parseInt(String(raw.startSlot), 10) || 1));
    changed = true;
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
  const mapped = legacyTabMap[raw.activeTab] || raw.activeTab;
  if (mapped && TAB_META[mapped]) {
    state.activeTab = mapped;
    changed = true;
  }

  return changed;
}

function persistDraftLocal() {
  try {
    localStorage.setItem(draftStorageKey(), JSON.stringify(serializeAveryDraft({
      updatedAtMs: cloud.lastLocalWriteMs || Date.now(),
      updatedBy: cloud.updatedBy || resolveAveryUpdatedBy(),
      deviceId: getAveryDeviceId(),
    })));
  } catch (_) { /* private mode */ }
}

function setCloudStatus(status, updatedBy = cloud.updatedBy) {
  cloud.status = status;
  cloud.updatedBy = updatedBy || cloud.updatedBy;
  renderCloudStatus();
}

function renderCloudStatus() {
  const el = document.getElementById('avery-cloud-status');
  if (!el) return;
  const who = cloud.updatedBy ? ` · zuletzt ${cloud.updatedBy}` : '';
  const map = {
    local: 'Gemeinsame Liste: nur auf diesem Gerät',
    connecting: 'Gemeinsame Liste: verbinden…',
    live: `Gemeinsame Liste: live zwischen Laden-iPhone und PC${who}`,
    syncing: 'Gemeinsame Liste: wird geteilt…',
    offline: 'Gemeinsame Liste: offline – wir teilen nach, sobald WLAN da ist',
    error: 'Gemeinsame Liste: Teilen gerade nicht möglich',
  };
  el.textContent = map[cloud.status] || map.local;
  el.dataset.status = cloud.status;
}

function averyDraftRef() {
  try {
    if (!getGlobalTenantId()) return null;
    return getTenantCollection(AVERY_DRAFT_COLLECTION).doc(AVERY_DRAFT_DOC_ID);
  } catch (_) {
    return null;
  }
}

async function flushAveryDraftToCloud() {
  if (cloud.applyingRemote) return;
  const tenantId = getGlobalTenantId();
  if (!tenantId) {
    setCloudStatus('local');
    return;
  }

  const updatedAtMs = Date.now();
  cloud.lastLocalWriteMs = updatedAtMs;
  const payload = serializeAveryDraft({
    updatedAtMs,
    updatedBy: resolveAveryUpdatedBy(),
    deviceId: getAveryDeviceId(),
    revision: updatedAtMs,
  });
  cloud.updatedBy = payload.updatedBy;
  persistDraftLocal();
  setCloudStatus(navigator.onLine ? 'syncing' : 'offline', payload.updatedBy);

  cloud.writing = true;
  try {
    let updatedAt = payload.updatedAt;
    try {
      const serverTs = window.firebase?.firestore?.FieldValue?.serverTimestamp;
      if (typeof serverTs === 'function') updatedAt = serverTs();
    } catch (_) { /* ISO-Fallback */ }
    const onlineData = { ...payload, updatedAt };
    // Merge-Update (kein op:'set'): sync.js injiziert bei set automatisch createdAt,
    // was die averyDrafts-Rules-Allowlist (hasOnly) sprengt → silent permission-denied.
    const result = await writeFirestoreDocOrQueue({
      collectionPath: AVERY_DRAFT_COLLECTION,
      docId: AVERY_DRAFT_DOC_ID,
      op: 'update',
      onlineData,
      queueData: payload,
      offlineMessage: 'Etikettenliste wird geteilt, sobald WLAN verfügbar ist.',
      silentPermissionDenied: false,
    });
    if (result === 'queued') setCloudStatus('offline', payload.updatedBy);
    else setCloudStatus('live', payload.updatedBy);
  } catch (err) {
    console.error('[avery] draft cloud write failed', err);
    setCloudStatus(navigator.onLine ? 'error' : 'offline', payload.updatedBy);
    const code = String(err?.code || err?.message || '').toLowerCase();
    if (code.includes('permission-denied')) {
      window.showToast?.(
        'Etikettenliste konnte nicht geteilt werden (keine Berechtigung). Bitte neu anmelden.',
        'error',
      );
    }
  } finally {
    cloud.writing = false;
  }
}

function scheduleAveryDraftCloudWrite() {
  if (cloud.applyingRemote) return;
  if (cloud.debounceTimer) clearTimeout(cloud.debounceTimer);
  cloud.debounceTimer = setTimeout(() => {
    cloud.debounceTimer = null;
    flushAveryDraftToCloud().catch((err) => {
      console.error('[avery] draft flush', err);
    });
  }, CLOUD_WRITE_DEBOUNCE_MS);
}

function persistDraft() {
  cloud.lastLocalWriteMs = Date.now();
  persistDraftLocal();
  scheduleAveryDraftCloudWrite();
}

function handleAveryDraftSnapshot(snap) {
  if (!snap) return;
  if (!snap.exists) {
    // Noch kein Cloud-Draft: lokale Liste (z. B. iPhone) einmal hochladen.
    setCloudStatus(navigator.onLine ? 'syncing' : 'offline');
    if (navigator.onLine && (state.queue.length > 0 || cloud.lastLocalWriteMs)) {
      flushAveryDraftToCloud().catch((err) => {
        console.error('[avery] seed draft after empty snapshot', err);
      });
    } else {
      setCloudStatus(navigator.onLine ? 'live' : 'offline');
    }
    return;
  }
  const data = snap.data() || {};
  const remoteMs = averyDraftUpdatedAtMs(data.updatedAtMs) || averyDraftUpdatedAtMs(data.updatedAt);
  const remoteDevice = String(data.deviceId || '');
  const ourDevice = getAveryDeviceId();

  // Echo der eigenen Schreiboperation überspringen
  if (remoteDevice && remoteDevice === ourDevice && remoteMs <= cloud.lastLocalWriteMs + 1500) {
    cloud.lastAppliedMs = Math.max(cloud.lastAppliedMs, remoteMs);
    setCloudStatus('live', String(data.updatedBy || cloud.updatedBy || ''));
    return;
  }

  if (remoteMs && remoteMs <= cloud.lastAppliedMs) {
    setCloudStatus('live', String(data.updatedBy || cloud.updatedBy || ''));
    return;
  }

  // Ältere Cloud-Version nicht über neuere lokale Tipps legen
  if (remoteMs && cloud.lastLocalWriteMs && remoteMs < cloud.lastLocalWriteMs) {
    setCloudStatus('live', String(data.updatedBy || cloud.updatedBy || ''));
    return;
  }

  cloud.applyingRemote = true;
  try {
    const changed = applyAveryDraftPayload(data);
    cloud.lastAppliedMs = Math.max(remoteMs, cloud.lastAppliedMs);
    cloud.updatedBy = String(data.updatedBy || '');
    persistDraftLocal();
    if (changed && state.initialized) {
      renderAll();
      if (remoteDevice && remoteDevice !== ourDevice) {
        window.showToast?.(
          cloud.updatedBy
            ? `Etikettenliste von ${cloud.updatedBy} übernommen.`
            : 'Etikettenliste vom anderen Gerät übernommen.',
          'info',
        );
      }
    }
    setCloudStatus('live', cloud.updatedBy);
  } finally {
    cloud.applyingRemote = false;
  }
}

export function startAveryDraftSync() {
  cloud.unsubscribe?.();
  cloud.unsubscribe = null;
  const ref = averyDraftRef();
  if (!ref) {
    setCloudStatus('local');
    return;
  }
  setCloudStatus('connecting');
  cloud.unsubscribe = ref.onSnapshot(
    (snap) => {
      try {
        handleAveryDraftSnapshot(snap);
      } catch (err) {
        console.error('[avery] draft snapshot', err);
        setCloudStatus('error');
      }
    },
    (err) => {
      console.error('[avery] draft subscribe', err);
      setCloudStatus(navigator.onLine ? 'error' : 'offline');
    },
  );
}

export function stopAveryDraftSync() {
  if (cloud.debounceTimer) {
    clearTimeout(cloud.debounceTimer);
    cloud.debounceTimer = null;
  }
  cloud.unsubscribe?.();
  cloud.unsubscribe = null;
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
  const cutId = resolveAveryCutId(row.cutId);
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
    const key = draftStorageKey();
    const raw = localStorage.getItem(key)
      || localStorage.getItem(STORAGE_KEY_BASE)
      || localStorage.getItem('charculogic.averyLabels.draft.v2')
      || localStorage.getItem('charculogic.averyLabels.draft.v1');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    applyAveryDraftPayload(parsed);
    const ms = averyDraftUpdatedAtMs(parsed.updatedAtMs) || averyDraftUpdatedAtMs(parsed.updatedAt);
    if (ms) {
      cloud.lastAppliedMs = ms;
      cloud.lastLocalWriteMs = ms;
    }
    if (parsed.updatedBy) cloud.updatedBy = String(parsed.updatedBy);
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
 * Notiz/Plain-Text in die Druckliste übernehmen (Katalog-Treffer + Freifeld).
 * @param {string} text
 * @param {{ defaultDays?: number }} [options]
 */
export function importAveryPlainTextToQueue(text, options = {}) {
  const parsed = parseAveryPlainTextList(text);
  if (!parsed.items.length) {
    window.showToast?.('Keine Zeilen gefunden. Bitte eine Notiz mit Teilstücken einfügen.', 'warning');
    return parsed;
  }

  const defaultDays = Number.parseInt(String(options.defaultDays ?? 0), 10);
  const safeDays = CUSTOM_AGING_OPTIONS.some((opt) => opt.days === defaultDays) ? defaultDays : 0;
  let addedLabels = 0;

  parsed.items.forEach((item) => {
    const qty = Math.max(1, Math.min(999, item.qty || 1));
    if (item.cut) {
      const existing = state.queue.find((row) => !row.isCustom && row.cutId === item.cut.id);
      if (existing) existing.qty += qty;
      else state.queue.push({ cutId: item.cut.id, qty });
      addedLabels += qty;
      return;
    }
    const name = String(item.name || '').trim();
    if (!name) return;
    const existingCustom = state.queue.find(
      (row) => row.isCustom && String(row.name || '').trim().toLowerCase() === name.toLowerCase()
        && Number(row.days || 0) === safeDays,
    );
    if (existingCustom) existingCustom.qty += qty;
    else {
      state.queue.push({
        cutId: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        qty,
        isCustom: true,
        name,
        days: safeDays,
      });
    }
    addedLabels += qty;
  });

  persistDraft();
  renderAll();

  const matched = parsed.matchedCount;
  const custom = parsed.customCount;
  if (matched && custom) {
    window.showToast?.(
      `${addedLabels} Etiketten übernommen · ${matched} aus dem Katalog, ${custom} als Freifeld.`,
      'success',
    );
  } else if (matched) {
    window.showToast?.(`${addedLabels} Etiketten aus dem Katalog übernommen.`, 'success');
  } else {
    window.showToast?.(`${addedLabels} Etiketten als Freifeld übernommen.`, 'success');
  }
  return { ...parsed, addedLabels };
}

/**
 * Übernimmt „Heute zu zerlegen/packen“ (Metzgerei) in die Druckliste.
 * @param {Array<{ product?: string, productId?: string, quantity?: number, unit?: string }>} tasks
 * @param {{ defaultDays?: number }} [options]
 */
export function importButcheryPacklistToQueue(tasks, options = {}) {
  const mapped = mapButcheryTasksToAveryImportItems(tasks);
  if (!mapped.items.length) {
    window.showToast?.('In der Metzgerei ist heute nichts Offenes zum Übernehmen.', 'info');
    return mapped;
  }

  const defaultDays = Number.parseInt(String(options.defaultDays ?? 0), 10);
  const safeDays = CUSTOM_AGING_OPTIONS.some((opt) => opt.days === defaultDays) ? defaultDays : 0;
  let addedLabels = 0;

  mapped.items.forEach((item) => {
    const qty = Math.max(1, Math.min(999, item.qty || 1));
    if (item.cut) {
      const existing = state.queue.find((row) => !row.isCustom && row.cutId === item.cut.id);
      if (existing) existing.qty += qty;
      else state.queue.push({ cutId: item.cut.id, qty });
      addedLabels += qty;
      return;
    }
    const name = String(item.name || item.product || '').trim();
    if (!name) return;
    const existingCustom = state.queue.find(
      (row) => row.isCustom && String(row.name || '').trim().toLowerCase() === name.toLowerCase()
        && Number(row.days || 0) === safeDays,
    );
    if (existingCustom) existingCustom.qty += qty;
    else {
      state.queue.push({
        cutId: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        qty,
        isCustom: true,
        name,
        days: safeDays,
      });
    }
    addedLabels += qty;
  });

  persistDraft();
  renderAll();

  const matched = mapped.matchedCount;
  const custom = mapped.customCount;
  if (matched && custom) {
    window.showToast?.(
      `${addedLabels} Etiketten aus der Packliste · ${matched} Katalog, ${custom} Freifeld.`,
      'success',
    );
  } else if (matched) {
    window.showToast?.(`${addedLabels} Etiketten aus der Packliste übernommen.`, 'success');
  } else {
    window.showToast?.(`${addedLabels} Etiketten aus der Packliste als Freifeld übernommen.`, 'success');
  }
  return { ...mapped, addedLabels };
}

/**
 * Wendet einen Herkunftseintrag auf die Avery-Kopfdaten an (Ohrmarke/LOT/Öko).
 * @param {Record<string, unknown>|null|undefined} record
 */
export function applyHerkunftRecordToAveryHeader(record) {
  const mapped = mapHerkunftRecordToAveryHeader(record);
  if (!mapped.ohrmarke && !mapped.herkunftLot) {
    window.showToast?.('Dieser Herkunftseintrag hat keine LOT/Ohrmarke.', 'warning');
    return mapped;
  }
  if (mapped.ohrmarke) state.header.ohrmarke = mapped.ohrmarke;
  if (mapped.schlachtDatum) state.header.schlachtDatum = mapped.schlachtDatum;
  if (mapped.brand) state.header.brand = mapped.brand;
  if (mapped.schlachthof) state.header.schlachthof = mapped.schlachthof;
  if (mapped.oeko) state.header.oeko = mapped.oeko;
  persistDraft();
  syncHeaderInputs();
  renderSheetPreview();
  window.showToast?.(
    `Herkunft übernommen · LOT ${buildAveryLot(state.header)}`,
    'success',
  );
  return mapped;
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
 * PLU optional über header.printPlu (Default an).
 * @param {AveryCut} cut
 * @param {Record<string, string|boolean>} header
 * @param {string} lot
 */
export function buildLabelHtml(cut, header, lot) {
  const oeko = String(header.oeko || '').trim();
  const showBetrieb = Boolean(header.printBetrieb) && String(header.betrieb || '').trim();
  const showSchlachthof = Boolean(header.printSchlachthof) && String(header.schlachthof || '').trim();
  const showPlu = header.printPlu !== false && String(cut.artNr || '').trim();
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
  const pluHtml = showPlu
    ? `<span class="lbl-plu">PLU: ${escapeHtml(String(cut.artNr).trim())}</span>`
    : '';
  return `
    <div class="label-card">
      ${showBetrieb ? `<div class="lbl-farm">${escapeHtml(String(header.betrieb).trim())}</div>` : ''}
      <div class="lbl-hero">
        <span class="lbl-title">${escapeHtml(title)}</span>
        ${pluHtml}
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

/**
 * Synchron: Druckfläche aus aktuellem State füllen und an body hängen.
 * Kein async — muss im selben Klick-Thread vor window.print() laufen.
 * @returns {HTMLElement}
 */
function syncAveryPrintAreaFromState() {
  readHeaderFromDom();
  const multi = planAverySheets({ queue: state.queue, startSlot: state.startSlot });
  const lot = buildAveryLot(state.header);
  const printArea = ensureAveryPrintArea();
  printArea.innerHTML = multi.sheets.map((sheetPlan, idx) => {
    const cellsHtml = buildSheetPrintCellsHtml(sheetPlan, state.header, lot);
    const cont = idx > 0 ? ' avery-sheet-continued' : '';
    const idAttr = idx === 0 ? ' id="avery-sheet-print"' : '';
    return `<div class="avery-sheet${cont}"${idAttr}>${cellsHtml}</div>`;
  }).join('');
  document.body.classList.add(PRINT_BODY_CLASS);
  printArea.setAttribute('aria-hidden', 'false');
  return printArea;
}

/**
 * Druck anfordern: fehlende Vorbereitung → Toast.
 * Sonst synchron DOM aktualisieren und sofort window.print() (iOS Safari User-Gesture).
 * @returns {boolean}
 */
function requestAveryPrintFromClick() {
  const { ready, hasLabels, hasOhr } = getAveryPrintReadiness();
  if (!ready) {
    if (!hasLabels) {
      window.showToast?.('Bitte zuerst Teilstücke zur Druckliste hinzufügen.', 'warning');
    } else if (!hasOhr) {
      window.showToast?.('Bitte die Ohrmarke eintragen – sonst können wir den Bogen nicht drucken.', 'warning');
      document.getElementById('avery-ohrmarke')?.focus?.();
    }
    return false;
  }

  const area = syncAveryPrintAreaFromState();
  if (!(area instanceof HTMLElement) || !area.querySelector('.avery-label:not(.empty)')) {
    window.showToast?.('Druckbogen ist noch nicht bereit. Bitte kurz warten und noch einmal tippen.', 'warning');
    return false;
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
        const plu = cut.artNr ? `PLU ${escapeHtml(cut.artNr)} · ` : '';
        return `
          <button type="button" class="avery-cut-chip${qty ? ' is-active' : ''}" data-avery-add="${escapeHtml(cut.id)}">
            <strong>${escapeHtml(cut.name)}</strong>
            <span>${plu}${cut.days > 0 ? `${cut.days} Tage Reife` : 'frisch'}${qty ? ` · ${qty}×` : ''}</span>
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
              <span>PLU ${escapeHtml(trim.artNr || '–')}${qty ? ` · ${qty}×` : ''}</span>
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

function formatHerkunftOptionLabel(record) {
  const lot = String(record?.lotNumber || 'ohne LOT').trim() || 'ohne LOT';
  const animal = String(record?.animalType || '').trim();
  const animalLabel = {
    rind: 'Rind',
    schwein: 'Schwein',
    gefluegel: 'Geflügel',
    schaf: 'Schaf',
    ziege: 'Ziege',
  }[animal] || animal;
  let when = '';
  try {
    const created = record?.createdAt;
    const ms = typeof created?.toMillis === 'function'
      ? created.toMillis()
      : (typeof created === 'string' ? Date.parse(created) : 0);
    if (ms) {
      when = new Date(ms).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    }
  } catch (_) { /* ignore */ }
  return [lot, animalLabel, when].filter(Boolean).join(' · ');
}

async function loadActiveHerkunftOptions() {
  const select = document.getElementById('avery-herkunft-select');
  const statusEl = document.getElementById('avery-herkunft-status');
  if (!hasModule('chargenDoku')) {
    state.herkunftOptions = [];
    state.herkunftStatus = 'hidden';
    const box = document.getElementById('avery-herkunft-box');
    if (box) box.hidden = true;
    return;
  }
  const box = document.getElementById('avery-herkunft-box');
  if (box) box.hidden = false;
  state.herkunftStatus = 'loading';
  if (statusEl) statusEl.textContent = 'Aktive Herkunftseinträge werden geladen…';
  if (select instanceof HTMLSelectElement) {
    select.disabled = true;
  }
  try {
    const col = getTenantCollection(CHARGEN_DOKU_COLLECTION);
    const snap = await col.where('status', '==', 'active').limit(HERKUNFT_OPTIONS_LIMIT).get();
    const options = [];
    snap.forEach((doc) => {
      const data = doc.data() || {};
      const record = { id: doc.id, ...data };
      if (String(record.status || 'active') !== 'active') return;
      options.push({
        id: doc.id,
        lotNumber: String(record.lotNumber || '').trim(),
        label: formatHerkunftOptionLabel(record),
        record,
      });
    });
    options.sort((a, b) => a.label.localeCompare(b.label, 'de'));
    state.herkunftOptions = options;
    state.herkunftStatus = options.length ? 'ready' : 'empty';
    if (select instanceof HTMLSelectElement) {
      const current = select.value;
      select.innerHTML = [
        '<option value="">Herkunft / LOT wählen…</option>',
        ...options.map((opt) => (
          `<option value="${escapeHtml(opt.id)}">${escapeHtml(opt.label)}</option>`
        )),
      ].join('');
      if (current && options.some((opt) => opt.id === current)) select.value = current;
      select.disabled = false;
    }
    if (statusEl) {
      statusEl.textContent = options.length
        ? `${options.length} aktive Einträge im Thekenbuch`
        : 'Noch kein aktiver Herkunftseintrag – zuerst im Tab Herkunft speichern.';
    }
  } catch (err) {
    console.error('[Avery] Herkunftsliste konnte nicht geladen werden:', err);
    state.herkunftStatus = 'error';
    if (statusEl) {
      statusEl.textContent = 'Herkunftsliste gerade nicht erreichbar. Bitte WLAN prüfen und erneut laden.';
    }
    if (select instanceof HTMLSelectElement) select.disabled = false;
  }
}

async function refreshPacklistPreview() {
  const statusEl = document.getElementById('avery-packlist-status');
  const btn = document.getElementById('btn-avery-packlist-import');
  const box = document.getElementById('avery-packlist-box');
  if (!hasModule('orders')) {
    state.packlistCount = 0;
    state.packlistStatus = 'hidden';
    if (box) box.hidden = true;
    return;
  }
  if (box) box.hidden = false;
  state.packlistStatus = 'loading';
  if (statusEl) statusEl.textContent = 'Packliste wird geprüft…';
  if (btn instanceof HTMLButtonElement) btn.disabled = true;
  try {
    const { getProductionTasksByStation } = await import('./customer-orders.js');
    const tasks = getProductionTasksByStation()?.butchery || [];
    const mapped = mapButcheryTasksToAveryImportItems(tasks);
    state.packlistCount = mapped.totalLabels;
    state.packlistStatus = mapped.items.length ? 'ready' : 'empty';
    if (statusEl) {
      if (!mapped.items.length) {
        statusEl.textContent = 'Heute nichts Offenes unter „Zerlegen/packen“.';
      } else {
        statusEl.textContent = `${mapped.items.length} Positionen · ca. ${mapped.totalLabels} Etiketten`
          + (mapped.customCount ? ` · ${mapped.customCount} als Freifeld` : '');
      }
    }
    if (btn instanceof HTMLButtonElement) {
      btn.disabled = !mapped.items.length;
      btn.dataset.packlistReady = mapped.items.length ? '1' : '0';
    }
  } catch (err) {
    console.error('[Avery] Packliste konnte nicht gelesen werden:', err);
    state.packlistStatus = 'error';
    if (statusEl) statusEl.textContent = 'Packliste gerade nicht lesbar. Bitte später erneut versuchen.';
    if (btn instanceof HTMLButtonElement) btn.disabled = true;
  }
}

function applySelectedHerkunftFromDom() {
  const select = document.getElementById('avery-herkunft-select');
  const id = String(select?.value || '').trim();
  if (!id) {
    window.showToast?.('Bitte zuerst einen Herkunftseintrag wählen.', 'warning');
    return;
  }
  const opt = state.herkunftOptions.find((row) => row.id === id);
  if (!opt?.record) {
    window.showToast?.('Eintrag nicht gefunden. Bitte Liste neu laden.', 'warning');
    return;
  }
  applyHerkunftRecordToAveryHeader(opt.record);
}

async function importPacklistFromOrders() {
  const days = document.getElementById('avery-custom-aging')?.value || '0';
  try {
    const { getProductionTasksByStation } = await import('./customer-orders.js');
    const tasks = getProductionTasksByStation()?.butchery || [];
    importButcheryPacklistToQueue(tasks, { defaultDays: days });
    await refreshPacklistPreview();
  } catch (err) {
    console.error('[Avery] Packlisten-Import fehlgeschlagen:', err);
    window.showToast?.('Packliste konnte nicht übernommen werden. Bitte erneut versuchen.', 'error');
  }
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
  const printPlu = document.getElementById('avery-print-plu');
  if (printPlu instanceof HTMLInputElement) {
    printPlu.checked = state.header.printPlu !== false;
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
  renderCloudStatus();
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
  const printPlu = document.getElementById('avery-print-plu');
  state.header.printPlu = printPlu instanceof HTMLInputElement ? printPlu.checked : true;
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
 * Drucktrigger: synchrones window.print() im Haupt-DOM (iOS Safari User-Gesture).
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

  // Print-Button: synchron DOM + window.print() im selben Klick (iOS Safari)
  const printBtn = document.getElementById('btn-avery-print-sheet');
  if (printBtn instanceof HTMLButtonElement && printBtn.dataset.averyPrintBound !== '1') {
    printBtn.dataset.averyPrintBound = '1';
    printBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      requestAveryPrintFromClick();
    });
  }

  root.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
      return;
    }
    if (!target.id?.startsWith('avery-')) return;
    if (
      target.id === 'avery-custom-name'
      || target.id === 'avery-custom-aging'
      || target.id === 'avery-plain-import'
    ) return;
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

    if (target.closest('#btn-avery-plain-import')) {
      const area = document.getElementById('avery-plain-import');
      const days = document.getElementById('avery-custom-aging')?.value || '0';
      const result = importAveryPlainTextToQueue(area?.value || '', { defaultDays: days });
      if (result?.items?.length && area instanceof HTMLTextAreaElement) {
        area.value = '';
      }
      return;
    }

    if (target.closest('#btn-avery-herkunft-apply')) {
      applySelectedHerkunftFromDom();
      return;
    }

    if (target.closest('#btn-avery-herkunft-reload')) {
      void loadActiveHerkunftOptions();
      return;
    }

    if (target.closest('#btn-avery-packlist-import')) {
      void importPacklistFromOrders();
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
          <p class="avery-cloud-status" id="avery-cloud-status" data-status="local" role="status">
            Gemeinsame Liste: nur auf diesem Gerät
          </p>
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
          <label class="avery-toggle" for="avery-print-plu">
            <input id="avery-print-plu" type="checkbox" checked>
            <span>PLU auf Etikett drucken</span>
          </label>
        </div>
        <p class="avery-lot-line">LOT: <strong id="avery-lot-preview">–</strong></p>
        <div class="avery-herkunft-box" id="avery-herkunft-box" hidden>
          <h3>Ohrmarke / LOT aus Herkunft</h3>
          <p class="avery-herkunft-hint">
            Aktiven Eintrag aus dem Thekenbuch wählen – Ohrmarke, Schlachtdatum und Öko-Code werden vorausgefüllt.
          </p>
          <label class="form-label" for="avery-herkunft-select">Aktive Herkunft
            <select id="avery-herkunft-select" class="input-text-touch">
              <option value="">Herkunft / LOT wählen…</option>
            </select>
          </label>
          <div class="avery-herkunft-actions">
            <button type="button" class="btn btn-primary btn-compact" id="btn-avery-herkunft-apply">
              In Kopfdaten übernehmen
            </button>
            <button type="button" class="btn btn-secondary btn-compact" id="btn-avery-herkunft-reload">
              Neu laden
            </button>
          </div>
          <p class="avery-herkunft-status" id="avery-herkunft-status" role="status"></p>
        </div>
        <p class="avery-desktop-hint">Am Laden-PC mit Laserdrucker: A4, Ränder auf 0, keine Seitenverkleinerung.</p>
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
        <div class="avery-packlist-box" id="avery-packlist-box" hidden>
          <h3>Heute zu zerlegen/packen</h3>
          <p class="avery-packlist-hint">
            Offene Metzgerei-Mengen aus den Kundenbestellungen direkt auf den Avery-Bogen schieben.
          </p>
          <p class="avery-packlist-status" id="avery-packlist-status" role="status">Packliste wird geprüft…</p>
          <button type="button" class="btn btn-primary btn-compact" id="btn-avery-packlist-import" disabled>
            Packliste auf den Bogen
          </button>
        </div>
        <div class="avery-plain-import-box">
          <h3>Notiz vom iPhone einfügen</h3>
          <p class="avery-plain-import-hint">
            Beim Verpacken notieren wir die Teilstücke (z.&nbsp;B. per Mail an den Laden-PC) und fügen die Liste hier ein – eine Zeile pro Position.
          </p>
          <label class="form-label" for="avery-plain-import">Liste
            <textarea
              id="avery-plain-import"
              class="input-text-touch avery-plain-import"
              rows="5"
              placeholder="Entrecôte 4&#10;Filet 2&#10;514 x3&#10;R II Hack 6&#10;Picanha"
              autocomplete="off"
            ></textarea>
          </label>
          <button type="button" class="btn btn-primary btn-compact" id="btn-avery-plain-import">
            Auf den Bogen übernehmen
          </button>
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
  getAveryDeviceId();
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
  startAveryDraftSync();
  renderAll();
  void loadActiveHerkunftOptions();
  void refreshPacklistPreview();
}

export function activateAveryLabelsTab() {
  initAveryLabelsModule();
  renderAll();
  void loadActiveHerkunftOptions();
  void refreshPacklistPreview();
}

export function disableAveryLabelsModule() {
  stopAveryDraftSync();
}

/** Alias für ältere Imports / Tests */
export const AVERY_CUT_CATALOG_FLAT = AVERY_CUT_CATALOG;
