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
assertIncludes(receivingSrc, 'data-item-mhd-add', 'MHD Schnelltasten');
assertIncludes(receivingSrc, 'data-item-mhd-edit', 'MHD Direktauswahl');
assertIncludes(receivingSrc, 'data-item-remove', 'Löschen-Button');
assertIncludes(receivingSrc, 'openReceivingQtyNumpad', 'Touch-Nummernpad');
assertIncludes(receivingSrc, 'MHD_QUICK_DAYS = [3, 7, 14]', 'MHD Schnell-Tage');
assertIncludes(receivingSrc, 'SCANNER_MHD_QUICK_DAYS = [7, 14, 30]', 'Scanner MHD-Tage');
assertIncludes(receivingSrc, 'shouldMergeDuplicateReceivingScan', 'Duplicate-Scan Helper');
assertIncludes(receivingSrc, 'RECEIVING_DUPLICATE_SCAN_MS = 3000', '3s Duplicate-Fenster');
assertIncludes(receivingSrc, '+${days} Tage', 'MHD Schnelltasten Labels');
assertIncludes(receivingSrc, '✕', 'Entfernen ✕');

// 3) Flüssiger Scan-Flow
assertIncludes(scannerSrc, 'resumeScannerListening', 'Scanner Resume');
assertIncludes(scannerSrc, 'isScannerOverlayOpen', 'Overlay-Check');
assertIncludes(mhdSrc, 'resumeScannerListening', 'mhd nutzt Resume');
assertIncludes(appSrc, 'resumeScannerListening', 'app verdrahtet Resume');
assertIncludes(mhdSrc, 'showScannerQuickAdjust', 'Quick-Adjust am Scanner');
assertIncludes(mhdSrc, 'navigator.vibrate', 'Vibrations-Feedback');
assertIncludes(mhdSrc, 'bumpCurrentDeliveryItemQuantity', 'Mengen-Delta');

// 4) CSS
assertIncludes(cssSrc, '.we-item-card', 'Karten Styles');
assertIncludes(cssSrc, '.we-item-qty-btn', 'Mengen-Button Styles');
assertIncludes(cssSrc, '.we-item-qty-step', 'Mengen +/- Styles');
assertIncludes(cssSrc, '.we-item-mhd-quick-btn', 'MHD Schnelltasten Styles');
assertIncludes(cssSrc, '.we-item-card--newest', 'Newest Highlight');
assertIncludes(cssSrc, '.scanner-quick-adjust', 'Scanner Quick-Adjust Styles');

// 5) SW Cache-Invalidierung
assert.match(
  swSrc,
  /CACHE_NAME = 'charculogic-v20261016-wareneingang-speed-v2'/,
  'SW Cache-Version Wareneingang-Speed',
);
assertIncludes(swSrc, "/receiving.js", 'receiving.js im SW-Cache');

// 6) Hilfslogik (gespiegelt)
function shiftIsoDateByDays(iso, days) {
  const base = new Date(`${iso}T00:00:00`);
  base.setDate(base.getDate() + days);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function sortLifo(items) {
  return items.slice().sort((a, b) => Number(b.addedAt) - Number(a.addedAt));
}

assert.equal(shiftIsoDateByDays('2026-10-13', 3), '2026-10-16');
assert.equal(shiftIsoDateByDays('2026-10-13', 7), '2026-10-20');
assert.equal(shiftIsoDateByDays('2026-10-13', 14), '2026-10-27');

const ordered = sortLifo([
  { id: 'a', addedAt: 100 },
  { id: 'b', addedAt: 300 },
  { id: 'c', addedAt: 200 },
]);
assert.deepEqual(ordered.map((row) => row.id), ['b', 'c', 'a']);

const {
  shouldMergeDuplicateReceivingScan,
  parseReceivingQuickMhdInput,
} = await import(pathToFileURL(path.join(root, 'web/receiving.js')).href);

assert.equal(
  shouldMergeDuplicateReceivingScan({ barcode: '123', itemId: 'a', at: 1000 }, '123', 2500, 3000),
  true,
);
assert.equal(
  shouldMergeDuplicateReceivingScan({ barcode: '123', itemId: 'a', at: 1000 }, '123', 4500, 3000),
  false,
);
assert.equal(
  shouldMergeDuplicateReceivingScan({ barcode: '123', itemId: 'a', at: 1000 }, '999', 1500, 3000),
  false,
);
assert.equal(parseReceivingQuickMhdInput('20.10', '2026-10-16'), '2026-10-20');
assert.equal(parseReceivingQuickMhdInput('20.10.2027'), '2027-10-20');

console.log('OK smoke-wareneingang-lifo: LIFO + Schnellkorrektur + Scan-Resume Verträge erfüllt.');
