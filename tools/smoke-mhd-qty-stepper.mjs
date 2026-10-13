/**
 * Smoke-Test: MHD Mengen-Badge + Theken-Nummernpad (ohne Browser).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mhdSrc = readFileSync(path.join(root, 'web/mhd.js'), 'utf8');
const cssSrc = readFileSync(path.join(root, 'web/style.css'), 'utf8');
const appSrc = readFileSync(path.join(root, 'web/app.js'), 'utf8');
const swSrc = readFileSync(path.join(root, 'web/sw.js'), 'utf8');

function assertIncludes(haystack, needle, label) {
  assert.ok(haystack.includes(needle), `${label}: erwartet "${needle}"`);
}

function assertNotIncludes(haystack, needle, label) {
  assert.ok(!haystack.includes(needle), `${label}: unerwartet "${needle}"`);
}

// 1) Badge statt +/- Stepper auf MHD-Karten
assertIncludes(mhdSrc, 'mhd-qty-badge', 'Mengen-Badge Klasse');
assertIncludes(mhdSrc, 'data-mhd-command="qty-edit"', 'qty-edit Command');
assertIncludes(mhdSrc, 'openMhdQtyNumpad', 'Numpad öffnen');
assertIncludes(mhdSrc, 'closeMhdQtyNumpad', 'Numpad schließen');
assertIncludes(mhdSrc, 'commitMhdQtyFromNumpad', 'Numpad übernehmen');
assertIncludes(mhdSrc, 'mhd-qty-numpad-overlay', 'Numpad Overlay');
assertIncludes(mhdSrc, '0 · Ausverkauft', 'Schnelltaste Ausverkauft');
assertIncludes(mhdSrc, 'Übernehmen', 'Bestätigen-Button');
assertNotIncludes(
  mhdSrc,
  'data-mhd-command="adjust" data-mhd-id="${prod.id}"',
  'kein +/- Stepper mehr auf MHD-Karte',
);

// 2) App schließt Numpad beim Tab-Wechsel
assertIncludes(appSrc, 'closeMhdQtyNumpad', 'app.js import/close');

// 3) CSS
assertIncludes(cssSrc, '.mhd-qty-badge', 'Badge Styles');
assertIncludes(cssSrc, '.mhd-qty-numpad-sheet', 'Numpad Sheet');
assertIncludes(cssSrc, '.mhd-qty-numpad-grid', 'Numpad Grid');
assertIncludes(cssSrc, 'html.mhd-qty-numpad-open', 'Body-Lock bei offenem Numpad');

// 4) SW Cache-Invalidierung (Version wird pro Feature angehoben)
assert.match(swSrc, /CACHE_NAME = 'charculogic-v\d{8}-[^']+'/, 'SW Cache-Version gesetzt');

// 5) Numpad-Draft-Logik (gespiegelt)
function applyKey(draft, currentQty, key) {
  if (key === 'clear') return '';
  if (key === 'backspace') return draft.slice(0, -1);
  if (key === 'soldout') return '0';
  if (key === 'plus1' || key === 'plus5') {
    const add = key === 'plus5' ? 5 : 1;
    const base = draft === '' ? currentQty : Number.parseInt(draft, 10);
    return String(Math.min(9999, Math.max(0, (Number.isFinite(base) ? base : 0) + add)));
  }
  if (/^\d$/.test(key)) {
    if (draft.length >= 4) return draft;
    return draft === '0' ? key : draft + key;
  }
  return draft;
}

assert.equal(applyKey('', 12, 'plus5'), '17');
assert.equal(applyKey('3', 12, 'plus1'), '4');
assert.equal(applyKey('', 12, 'soldout'), '0');
assert.equal(applyKey('1', 12, '2'), '12');
assert.equal(applyKey('0', 12, '5'), '5');
assert.equal(applyKey('15', 12, 'backspace'), '1');
assert.equal(applyKey('15', 12, 'clear'), '');

console.log('OK smoke-mhd-qty-stepper: Badge + Theken-Nummernpad Verträge erfüllt.');
