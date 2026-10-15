/**
 * Smoke-Test: Wareneingang Batch-Kategoriespeicherung + smarte Auto-Kategorisierung.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mhdSrc = readFileSync(path.join(root, 'web/mhd.js'), 'utf8');
const receivingSrc = readFileSync(path.join(root, 'web/receiving.js'), 'utf8');
const cssSrc = readFileSync(path.join(root, 'web/style.css'), 'utf8');
const swSrc = readFileSync(path.join(root, 'web/sw.js'), 'utf8');
const appSrc = readFileSync(path.join(root, 'web/app.js'), 'utf8');

function assertIncludes(haystack, needle, label) {
  assert.ok(haystack.includes(needle), `${label}: erwartet "${needle}"`);
}

function assertNotIncludes(haystack, needle, label) {
  assert.ok(!haystack.includes(needle), `${label}: unerwartet "${needle}"`);
}

// 1) Heuristik + Resolver in receiving.js
assertIncludes(receivingSrc, 'export function inferReceivingCategoryFromProductName', 'Keyword-Heuristik');
assertIncludes(receivingSrc, 'export function resolveReceivingScanCategory', 'Scan-Resolver');
assertIncludes(receivingSrc, 'export function inferReceivingCategoryKeywordHit', 'Keyword-Hit');
assertIncludes(receivingSrc, 'RECEIVING_SMART_CATEGORIES', 'Smart-Kategorien');

const receiving = await import(pathToFileURL(path.join(root, 'web/receiving.js')).href);
const {
  inferReceivingCategoryFromProductName,
  inferReceivingCategoryKeywordHit,
  resolveReceivingScanCategory,
  RECEIVING_SMART_CATEGORIES,
} = receiving;

assert.equal(
  inferReceivingCategoryKeywordHit('Tomate Basilikum Burger gf'),
  RECEIVING_SMART_CATEGORIES.kuehlware,
  'Fleischlose Patties → Kühlware',
);
assert.equal(
  inferReceivingCategoryKeywordHit('Trockenhefe aus Getreide'),
  RECEIVING_SMART_CATEGORIES.trockenware,
  'Trockenhefe → Trockenware',
);
assert.equal(
  inferReceivingCategoryKeywordHit('Bio Joghurt Natur'),
  RECEIVING_SMART_CATEGORIES.mopro,
  'Joghurt → MoPro',
);
assert.equal(
  inferReceivingCategoryKeywordHit('Galloway Bratwurst'),
  RECEIVING_SMART_CATEGORIES.aufschnitt,
  'Bratwurst → Aufschnitt',
);
assert.equal(
  inferReceivingCategoryFromProductName('Unbekanntes Produkt XYZ', RECEIVING_SMART_CATEGORIES.mopro),
  RECEIVING_SMART_CATEGORIES.trockenware,
  'Fallback nie MoPro',
);

assert.deepEqual(
  resolveReceivingScanCategory({
    productName: 'Trockenhefe aus Getreide',
    eanCategory: '',
    stickyCategory: RECEIVING_SMART_CATEGORIES.mopro,
  }),
  { category: RECEIVING_SMART_CATEGORIES.trockenware, source: 'keyword' },
  'Keywords schlagen Sticky-MoPro',
);

assert.deepEqual(
  resolveReceivingScanCategory({
    productName: 'Irgendwas',
    eanCategory: RECEIVING_SMART_CATEGORIES.aufschnitt,
    stickyCategory: RECEIVING_SMART_CATEGORIES.mopro,
  }),
  { category: RECEIVING_SMART_CATEGORIES.aufschnitt, source: 'ean' },
  'EAN-Gedächtnis hat Vorrang',
);

assert.deepEqual(
  resolveReceivingScanCategory({
    productName: '',
    eanCategory: '',
    stickyCategory: '',
  }),
  { category: RECEIVING_SMART_CATEGORIES.trockenware, source: 'default' },
  'Default Trockenware',
);

// 2) mhd.js verdrahtet Resolver + Batch-Save
assertIncludes(mhdSrc, 'resolveReceivingScanCategory', 'mhd importiert Resolver');
assertIncludes(mhdSrc, 'resolveCategoryForReceivingScan', 'Scan-Kategorie-Helfer');
assertIncludes(mhdSrc, 'saveRecentReceiptCategoryDraftsBatch', 'Batch-Save');
assertIncludes(mhdSrc, 'recent-receipts-batch-save', 'Batch-Button Markup');
assertIncludes(mhdSrc, 'utility-row--category-dirty', 'Dirty-Markierung');
assertIncludes(mhdSrc, 'rememberCategoryForBarcode', 'EAN-Stammdaten bei Batch');
assertIncludes(mhdSrc, 'warenKategorie: category', 'Per-Item Kategorie beim Scan');
assertNotIncludes(
  mhdSrc,
  'recent-receipt-action--save" data-mhd-utility-command="category-save"',
  'Einzel-Button Kategorie speichern entfernt',
);
assertIncludes(mhdSrc, "if (!kat) return '';", 'normalizeMhdCategory ohne MoPro-Default');

// 3) CSS
assertIncludes(cssSrc, '.utility-row--category-dirty', 'Dirty-Row Styles');
assertIncludes(cssSrc, '.recent-receipts-batch-bar', 'Batch-Bar Styles');
assertIncludes(cssSrc, '.learn-mode-card--wide', 'Breitere Dialog-Karte');

// 4) SW / App Cache-Invalidierung (Version wird pro Feature angehoben)
assert.match(swSrc, /CACHE_NAME = 'charculogic-v\d{8}-[^']+'/, 'SW Cache-Version gesetzt');
assert.match(appSrc, /sw\.js\?v=\d{8}-[^']+'/, 'App SW Register Query');

console.log('OK smoke-receiving-batch-category: Heuristik + Batch-Save Verträge erfüllt.');
