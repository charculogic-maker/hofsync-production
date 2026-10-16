/**
 * Smoke-Test: Wareneingang LIFO + Schnellkorrektur-Karten + Scan-Resume.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mhdSrc = readFileSync(path.join(root, 'web/mhd.js'), 'utf8');
const receivingSrc = readFileSync(path.join(root, 'web/receiving.js'), 'utf8');
const scannerSrc = readFileSync(path.join(root, 'web/scanner.js'), 'utf8');
const cssSrc = readFileSync(path.join(root, 'web/style.css'), 'utf8');
const appSrc = readFileSync(path.join(root, 'web/app.js'), 'utf8');
const indexSrc = readFileSync(path.join(root, 'web/index.html'), 'utf8');
const swSrc = readFileSync(path.join(root, 'web/sw.js'), 'utf8');

function assertIncludes(haystack, needle, label) {
  assert.ok(haystack.includes(needle), `${label}: erwartet "${needle}"`);
}

// 1) LIFO: unshift statt push am Ende
assertIncludes(mhdSrc, 'currentDeliveryItems.unshift(', 'LIFO unshift');
assertIncludes(mhdSrc, 'addedAt: Date.now()', 'addedAt Zeitstempel');
assertIncludes(mhdSrc, 'sortDeliveryItemsLifo', 'LIFO Sortierung');
assertIncludes(mhdSrc, 'tryAutoAddScannedDeliveryItem', 'Auto-Add nach Scan');

// 2) Karten-Schnellaktionen
assertIncludes(receivingSrc, 'buildReceivingItemCardHtml', 'Karten-HTML');
assertIncludes(receivingSrc, 'data-item-qty-edit', 'Mengen-Tap');
assertIncludes(receivingSrc, 'data-item-qty-delta', 'Mengen +/- Inline');
assertIncludes(receivingSrc, 'data-item-mhd-edit', 'MHD Direktauswahl');
assertIncludes(receivingSrc, 'we-item-mhd-date--missing', 'MHD fehlt Markierung');
assertIncludes(receivingSrc, 'data-item-remove', 'Löschen-Button');
assertIncludes(receivingSrc, 'openReceivingQtyNumpad', 'Touch-Nummernpad');
assertIncludes(receivingSrc, 'shouldMergeDuplicateReceivingScan', 'Duplicate-Scan Helper');
assertIncludes(receivingSrc, 'RECEIVING_DUPLICATE_SCAN_MS = 3000', '3s Duplicate-Fenster');
assertIncludes(receivingSrc, 'RECEIVING_SCAN_MHD_EMPTY', 'Scan-MHD leer');
assertIncludes(receivingSrc, 'RECEIVING_VPE_QTY_DELTAS', 'VPE-Deltas 3/5/9');
assertIncludes(receivingSrc, '✕', 'Entfernen ✕');
assert.equal(receivingSrc.includes('data-item-mhd-add'), false, 'keine MHD-Schnelltasten auf Karte');
assert.equal(receivingSrc.includes('SCANNER_MHD_QUICK_DAYS'), false, 'keine Scanner-MHD-Schnelltasten');
assert.equal(indexSrc.includes('data-scanner-qa="mhd-add"'), false, 'keine +7/+14/+30 am Scanner');
assertIncludes(indexSrc, 'data-scanner-qa="qty-plus3"', 'Scanner +3');
assertIncludes(indexSrc, 'data-scanner-qa="qty-plus5"', 'Scanner +5');
assertIncludes(indexSrc, 'data-scanner-qa="qty-plus9"', 'Scanner +9');
assert.equal(indexSrc.includes('qty-plus10'), false, 'kein +10 mehr am Scanner');
assertIncludes(mhdSrc, "qty-plus3", 'Handler +3');
assertIncludes(mhdSrc, "qty-plus9", 'Handler +9');
assert.equal(mhdSrc.includes('qty-plus10'), false, 'kein Handler +10');

// 3) Flüssiger Scan-Flow
assertIncludes(scannerSrc, 'resumeScannerListening', 'Scanner Resume');
assertIncludes(scannerSrc, 'isScannerOverlayOpen', 'Overlay-Check');
assertIncludes(mhdSrc, 'resumeScannerListening', 'mhd nutzt Resume');
assertIncludes(appSrc, 'resumeScannerListening', 'app verdrahtet Resume');
assertIncludes(mhdSrc, 'showScannerQuickAdjust', 'Quick-Adjust am Scanner');
assertIncludes(mhdSrc, 'navigator.vibrate', 'Vibrations-Feedback');
assertIncludes(mhdSrc, 'bumpCurrentDeliveryItemQuantity', 'Mengen-Delta');
assertIncludes(mhdSrc, 'RECEIVING_SCAN_MHD_EMPTY', 'Auto-Add ohne MHD-Vorschlag');
assertIncludes(mhdSrc, 'mhdQuelle: \'manual-packaging\'', 'MHD von Verpackung');

// 4) CSS
assertIncludes(cssSrc, '.we-item-card', 'Karten Styles');
assertIncludes(cssSrc, '.we-item-qty-btn', 'Mengen-Button Styles');
assertIncludes(cssSrc, '.we-item-qty-step', 'Mengen +/- Styles');
assertIncludes(cssSrc, '.we-item-mhd-date--missing', 'MHD fehlt Styles');
assertIncludes(cssSrc, '.we-item-card--newest', 'Newest Highlight');
assertIncludes(cssSrc, '.scanner-quick-adjust', 'Scanner Quick-Adjust Styles');

// 5) SW Cache-Invalidierung
assert.match(
  swSrc,
  /CACHE_NAME = 'charculogic-v20261016-vpe-buttons-v2'/,
  'SW Cache-Version VPE-Buttons',
);
assertIncludes(mhdSrc, 'confirmScannerQuickAdjust', 'Fertig-Bestätigung am Scanner');
assertIncludes(mhdSrc, 'Bitte zuerst „Fertig“ tippen', 'Anderer Artikel erst nach Fertig');
assert.equal(mhdSrc.includes('SCANNER_QUICK_ADJUST_IDLE_MS'), false, 'kein Auto-Idle-Hide');
assertIncludes(swSrc, '/receiving.js', 'receiving.js im SW-Cache');

// 6) Hilfslogik
function sortLifo(items) {
  return items.slice().sort((a, b) => Number(b.addedAt) - Number(a.addedAt));
}

const ordered = sortLifo([
  { id: 'a', addedAt: 100 },
  { id: 'b', addedAt: 300 },
  { id: 'c', addedAt: 200 },
]);
assert.deepEqual(ordered.map((row) => row.id), ['b', 'c', 'a']);

const {
  shouldMergeDuplicateReceivingScan,
  parseReceivingQuickMhdInput,
  hasReceivingItemMhd,
  RECEIVING_SCAN_MHD_EMPTY,
  buildReceivingItemCardHtml,
} = await import(pathToFileURL(path.join(root, 'web/receiving.js')).href);

assert.equal(RECEIVING_SCAN_MHD_EMPTY, '');
assert.equal(hasReceivingItemMhd({ mhdDate: '' }), false);
assert.equal(hasReceivingItemMhd({ mhdDate: '2026-10-20' }), true);
assert.ok(buildReceivingItemCardHtml({
  id: 'x',
  product: 'Test',
  qtyValue: 1,
  qtyUnit: 'Stk',
  mhdDate: '',
}).includes('we-item-mhd-date--missing'));

assert.equal(
  shouldMergeDuplicateReceivingScan({ barcode: '123', itemId: 'a', at: 1000 }, '123', 2500, 3000),
  true,
);
assert.equal(
  shouldMergeDuplicateReceivingScan({ barcode: '123', itemId: 'a', at: 1000 }, '123', 4500, 3000),
  false,
);
assert.equal(parseReceivingQuickMhdInput('20.10', '2026-10-16'), '2026-10-20');
assert.equal(parseReceivingQuickMhdInput('20.10.2027'), '2027-10-20');

console.log('OK smoke-wareneingang-lifo: LIFO + leeres MHD + Scan-Resume Verträge erfüllt.');
