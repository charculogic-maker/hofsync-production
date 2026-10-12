/**
 * Smoke-Test: MHD Mengen-Stepper / Keyboard-Inset Logik (ohne Browser).
 * Prüft die Kernformeln und CSS-Variablen-Verträge aus dem MHD-Refactor.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mhdSrc = readFileSync(path.join(root, 'web/mhd.js'), 'utf8');
const cssSrc = readFileSync(path.join(root, 'web/style.css'), 'utf8');
const appSrc = readFileSync(path.join(root, 'web/app.js'), 'utf8');

function assertIncludes(haystack, needle, label) {
  assert.ok(haystack.includes(needle), `${label}: erwartet "${needle}"`);
}

// 1) Lokales Qty-Patch ohne Full-Render
assertIncludes(mhdSrc, 'localQtyPatch', 'stageMhdChange Option');
assertIncludes(mhdSrc, 'patchMhdCardQtyDom', 'DOM-Patch Helper');
assertIncludes(mhdSrc, 'startMhdStepperRepeat', 'Long-Press Repeat');
assertIncludes(mhdSrc, 'MHD_STEPPER_REPEAT_DELAY_MS', 'Repeat Delay Konstante');
assertIncludes(mhdSrc, 'pointerdown', 'Sofortiges Tippen via pointerdown');
assertIncludes(mhdSrc, 'selectMhdQtyInputValue', 'Select-all Helper');
assertIncludes(mhdSrc, 'input.select()', 'input.select Aufruf');
assertIncludes(mhdSrc, 'syncMhdSaveBarKeyboardOffset', 'visualViewport Sync');
assertIncludes(mhdSrc, 'visualViewport', 'visualViewport Nutzung');

// 2) App verdrahtet Viewport-Sync
assertIncludes(appSrc, 'bindMhdSaveBarViewportSync', 'app.js bindet Viewport-Sync');
assertIncludes(appSrc, 'syncMhdSaveBarKeyboardOffset', 'app.js sync bei resize');

// 3) CSS Safe-Area / Keyboard-Bottom Variable
assertIncludes(cssSrc, '--mhd-save-bar-bottom', 'CSS Variable für Balken-Bottom');
assertIncludes(cssSrc, 'touch-action: manipulation', 'Stepper touch-action');
assert.ok(
  /bottom:\s*var\(--mhd-save-bar-bottom/.test(cssSrc),
  'Sticky-Bar bottom nutzt --mhd-save-bar-bottom',
);

// 4) Keyboard-Inset-Formel (gespiegelt aus syncMhdSaveBarKeyboardOffset)
function computeSaveBarBottom({ innerHeight, vvHeight, vvOffsetTop }) {
  const coveredByChrome = Math.max(0, innerHeight - (vvHeight + vvOffsetTop));
  const keyboardOpen = coveredByChrome > 48;
  if (keyboardOpen) return { keyboardOpen, bottomPx: Math.round(coveredByChrome + 10) };
  return { keyboardOpen, bottomPx: null };
}

assert.deepEqual(
  computeSaveBarBottom({ innerHeight: 800, vvHeight: 800, vvOffsetTop: 0 }),
  { keyboardOpen: false, bottomPx: null },
  'ohne Tastatur: CSS-Default',
);
assert.deepEqual(
  computeSaveBarBottom({ innerHeight: 800, vvHeight: 420, vvOffsetTop: 0 }),
  { keyboardOpen: true, bottomPx: 390 },
  'mit Tastatur: Balken über Keyboard',
);
assert.deepEqual(
  computeSaveBarBottom({ innerHeight: 800, vvHeight: 780, vvOffsetTop: 0 }),
  { keyboardOpen: false, bottomPx: null },
  'kleine Chrome-Leiste zählt nicht als Keyboard',
);

// 5) Zero-Crossing Erkennung
function crossesZero(prevQty, nextQty) {
  return (Number(prevQty) <= 0) !== (Number(nextQty) <= 0);
}
assert.equal(crossesZero(1, 0), true);
assert.equal(crossesZero(0, 1), true);
assert.equal(crossesZero(5, 4), false);
assert.equal(crossesZero(1, 2), false);

console.log('OK smoke-mhd-qty-stepper: Stepper, Select-all, Keyboard-Inset Verträge erfüllt.');
