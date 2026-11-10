/**
 * CSV-Importer für Artikelstammdaten → tenants/{tenantId}/product_master/{ean}.
 * Clientseitig: Trennzeichen-Erkennung, Header-Mapping, Batch-Writes (max. 400).
 */

import { sanitizeProductName } from './utils.js';
import { RECEIVING_SMART_CATEGORIES } from './receiving.js';
import { writeLocalProductMasterEntry } from './product-master.js';

export const CSV_IMPORT_BATCH_SIZE = 400;
export const CSV_IMPORT_DEFAULT_DAYS_FRESH = 7;

const EAN_HEADERS = Object.freeze(['ean', 'gtin', 'barcode', 'artikelnr_ean', 'artikel_ean']);
const NAME_HEADERS = Object.freeze(['name', 'artikel', 'bezeichnung', 'artikelname', 'produkt', 'produktname']);
const CATEGORY_HEADERS = Object.freeze(['kategorie', 'warengruppe', 'katalog', 'category', 'wg']);
const DAYS_HEADERS = Object.freeze(['mhd', 'tage', 'daysfresh', 'haltbarkeit', 'restlaufzeit', 'mhd_tage']);
const SUPPLIER_HEADERS = Object.freeze(['lieferant', 'hersteller', 'vendor', 'marke', 'brand']);
const ARTNR_HEADERS = Object.freeze(['artnr', 'art_nr', 'artikelnummer', 'articlenumber', 'sku', 'nr']);

function normalizeHeaderKey(raw = '') {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function stripQuotes(value = '') {
  let text = String(value ?? '').trim();
  if (
    (text.startsWith('"') && text.endsWith('"'))
    || (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1);
  }
  return text.replace(/""/g, '"').trim();
}

/** Semikolon vs. Komma anhand der ersten nicht-leeren Zeile. */
export function detectCsvDelimiter(text = '') {
  const sample = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || '';
  const semicolons = (sample.match(/;/g) || []).length;
  const commas = (sample.match(/,/g) || []).length;
  if (semicolons === 0 && commas === 0) return ';';
  return semicolons >= commas ? ';' : ',';
}

/**
 * Einfacher CSV-Zeilen-Parser mit Anführungszeichen-Unterstützung.
 * @param {string} text
 * @param {string} [delimiter]
 * @returns {string[][]}
 */
export function parseCsvText(text = '', delimiter = '') {
  const delim = delimiter || detectCsvDelimiter(text);
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  const source = String(text || '').replace(/^\uFEFF/, '');

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === delim) {
      row.push(stripQuotes(cell));
      cell = '';
      continue;
    }
    if (ch === '\n') {
      row.push(stripQuotes(cell));
      cell = '';
      if (row.some((value) => String(value || '').trim())) rows.push(row);
      row = [];
      continue;
    }
    if (ch === '\r') continue;
    cell += ch;
  }
  row.push(stripQuotes(cell));
  if (row.some((value) => String(value || '').trim())) rows.push(row);
  return rows;
}

function findColumnIndex(headers, aliases) {
  const normalized = headers.map((h) => normalizeHeaderKey(h));
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias);
    if (idx >= 0) return idx;
  }
  // Teiltreffer: Header enthält Alias
  for (let i = 0; i < normalized.length; i += 1) {
    const key = normalized[i];
    if (!key) continue;
    if (aliases.some((alias) => key.includes(alias) || alias.includes(key))) return i;
  }
  return -1;
}

export function cleanProductEan(raw = '') {
  return String(raw || '').replace(/\D/g, '');
}

function hashSeed(value = '') {
  const input = String(value || '');
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Kategorie-Heuristik für Kassen-/Lieferanten-CSVs.
 * @param {string} rawCategory
 * @param {string} [productName]
 */
export function mapImportCategory(rawCategory = '', productName = '') {
  const haystack = `${rawCategory} ${productName}`.toLowerCase();
  if (/milch|k[aä]se|joghurt|jogurt|quark|butter|sahne|mopro|molkerei/.test(haystack)) {
    return RECEIVING_SMART_CATEGORIES.mopro;
  }
  if (/fleisch|wurst|schwein|rind|gefl[uü]gel|metzgerei|aufschnitt|schinken/.test(haystack)) {
    return RECEIVING_SMART_CATEGORIES.aufschnitt;
  }
  if (/obst|gem[uü]se|frisch|salat|kr[aä]uter/.test(haystack)) {
    return RECEIVING_SMART_CATEGORIES.frische;
  }
  if (/tk|tiefk[uü]hl|frozen/.test(haystack)) {
    return RECEIVING_SMART_CATEGORIES.tk;
  }
  if (/gew[uü]rz|spice/.test(haystack)) {
    return RECEIVING_SMART_CATEGORIES.gewuerze;
  }
  if (/getr[aä]nk|saft|wasser|bier|wein/.test(haystack)) {
    return RECEIVING_SMART_CATEGORIES.getraenke;
  }
  if (/k[uü]hl|feinkost/.test(haystack)) {
    return RECEIVING_SMART_CATEGORIES.kuehlware;
  }
  return RECEIVING_SMART_CATEGORIES.trockenware;
}

function cellAt(row, index) {
  if (index < 0) return '';
  return stripQuotes(row[index] ?? '');
}

/**
 * @param {string} csvText
 * @returns {{
 *   delimiter: string,
 *   headers: string[],
 *   mapping: Record<string, number>,
 *   rows: Array<Record<string, unknown>>,
 *   skipped: number,
 * }}
 */
export function parseProductMasterCsv(csvText = '') {
  const delimiter = detectCsvDelimiter(csvText);
  const matrix = parseCsvText(csvText, delimiter);
  if (!matrix.length) {
    return { delimiter, headers: [], mapping: {}, rows: [], skipped: 0 };
  }

  const headers = matrix[0].map((h) => String(h || '').trim());
  const mapping = {
    ean: findColumnIndex(headers, EAN_HEADERS),
    name: findColumnIndex(headers, NAME_HEADERS),
    category: findColumnIndex(headers, CATEGORY_HEADERS),
    daysFresh: findColumnIndex(headers, DAYS_HEADERS),
    supplier: findColumnIndex(headers, SUPPLIER_HEADERS),
    artNr: findColumnIndex(headers, ARTNR_HEADERS),
  };

  if (mapping.name < 0) {
    throw new Error('CSV ohne Artikelnamen-Spalte (name/artikel/bezeichnung/…).');
  }

  const rows = [];
  let skipped = 0;
  for (let i = 1; i < matrix.length; i += 1) {
    const raw = matrix[i];
    const name = sanitizeProductName(cellAt(raw, mapping.name));
    if (!name) {
      skipped += 1;
      continue;
    }
    const artNr = cellAt(raw, mapping.artNr);
    let ean = cleanProductEan(cellAt(raw, mapping.ean));
    if (!ean && artNr) {
      const digits = cleanProductEan(artNr);
      ean = digits || `gen_${hashSeed(artNr)}`;
    }
    if (!ean) {
      ean = `gen_${hashSeed(`${name}|${i}`)}`;
    }
    const rawCategory = cellAt(raw, mapping.category);
    const category = mapImportCategory(rawCategory, name);
    const daysRaw = cellAt(raw, mapping.daysFresh).replace(',', '.');
    const daysParsed = Number.parseFloat(daysRaw);
    const daysFresh = Number.isFinite(daysParsed) && daysParsed >= 0
      ? Math.round(daysParsed)
      : CSV_IMPORT_DEFAULT_DAYS_FRESH;
    const supplier = sanitizeProductName(cellAt(raw, mapping.supplier));

    rows.push({
      id: ean,
      ean,
      name,
      articleName: name,
      category,
      kategorie: category,
      daysFresh,
      supplier,
      artNr: artNr || '',
      active: true,
    });
  }

  return { delimiter, headers, mapping, rows, skipped };
}

/**
 * Firestore-Payload (Rules-konform inkl. articleName/tenantId/supplier).
 */
export function buildProductMasterImportDoc(tenantId, row = {}, editorLabel = '') {
  const id = String(tenantId || '').trim();
  const ean = cleanProductEan(row.ean || row.id) || String(row.id || '').trim();
  const articleName = sanitizeProductName(row.articleName || row.name || '');
  if (!id || !ean || !articleName) return null;
  const nowIso = new Date().toISOString();
  const category = String(row.category || row.kategorie || RECEIVING_SMART_CATEGORIES.trockenware).trim()
    || RECEIVING_SMART_CATEGORIES.trockenware;
  const daysFresh = Number.isFinite(Number(row.daysFresh))
    ? Math.max(0, Math.round(Number(row.daysFresh)))
    : CSV_IMPORT_DEFAULT_DAYS_FRESH;
  return {
    tenantId: id,
    id: ean,
    ean,
    articleName,
    name: articleName,
    brand: sanitizeProductName(row.brand || ''),
    category,
    kategorie: category,
    daysFresh,
    supplier: sanitizeProductName(row.supplier || ''),
    active: row.active !== false,
    createdAt: row.createdAt || nowIso,
    updatedAt: nowIso,
    updatedBy: String(editorLabel || row.updatedBy || 'csv-import').trim() || 'csv-import',
  };
}

function chunkArray(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * Schreibt Artikel in product_master (merge) in Chunks à max. 400.
 * @param {{
 *   db: FirebaseFirestore,
 *   tenantId: string,
 *   rows: Array<Record<string, unknown>>,
 *   editorLabel?: string,
 *   onProgress?: (done: number, total: number) => void,
 * }} options
 */
export async function importProductMasterRows({
  db,
  tenantId,
  rows = [],
  editorLabel = 'csv-import',
  onProgress = null,
} = {}) {
  const id = String(tenantId || '').trim();
  if (!db || !id) throw new Error('Mandant oder Datenbank fehlt.');
  const docs = [];
  const seen = new Set();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const doc = buildProductMasterImportDoc(id, row, editorLabel);
    if (!doc) return;
    if (seen.has(doc.ean)) return;
    seen.add(doc.ean);
    docs.push(doc);
  });
  if (!docs.length) {
    return { imported: 0, skipped: (rows?.length || 0) };
  }

  const chunks = chunkArray(docs, CSV_IMPORT_BATCH_SIZE);
  let done = 0;
  try {
    for (const chunk of chunks) {
      const batch = db.batch();
      chunk.forEach((doc) => {
        const ref = db.collection('tenants').doc(id).collection('product_master').doc(doc.ean);
        batch.set(ref, doc, { merge: true });
        writeLocalProductMasterEntry(doc);
      });
      await batch.commit();
      done += chunk.length;
      if (typeof onProgress === 'function') onProgress(done, docs.length);
    }
  } catch (error) {
    console.error('[CSV-Import] Detailfehler beim Schreiben:', error);
    throw error;
  }

  return { imported: docs.length, skipped: Math.max(0, (rows?.length || 0) - docs.length) };
}
