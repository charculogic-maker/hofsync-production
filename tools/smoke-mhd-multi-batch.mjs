/**
 * Smoke-Test: Multi-MHD-Akkordeon & Folge-Chargen-Aktionen (ohne Browser).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mhdSrc = readFileSync(path.join(root, 'web/mhd.js'), 'utf8');
const cssSrc = readFileSync(path.join(root, 'web/style.css'), 'utf8');
const swSrc = readFileSync(path.join(root, 'web/sw.js'), 'utf8');

function assertIncludes(haystack, needle, label) {
  assert.ok(haystack.includes(needle), `${label}: erwartet "${needle}"`);
}

// 1) Interaktives Badge + Chevron + iOS Touch-Handler
assertIncludes(mhdSrc, 'type="button"', 'Button type');
assertIncludes(mhdSrc, 'mhd-multi-batch-badge${expanded ? \' is-expanded\' : \'\'}', 'Badge Button Klasse');
assertIncludes(mhdSrc, 'data-mhd-command="toggle-multi-batch"', 'Toggle-Command');
assertIncludes(mhdSrc, 'handleMultiMhdAccordionToggleEvent', 'iOS Toggle Handler');
assertIncludes(mhdSrc, "addEventListener('pointerdown'", 'pointerdown Binding');
assertIncludes(mhdSrc, 'fromPointer: true', 'pointerdown Pfad');
assertIncludes(mhdSrc, 'fromPointer: false', 'click Pfad');
assertIncludes(mhdSrc, 'mhd-multi-batch-chevron', 'Chevron Markup');
assertIncludes(mhdSrc, 'expandedMultiMhdIds', 'Expand-State');

// 2) Akkordeon mit voller Aktionsfähigkeit + Leerhinweis
assertIncludes(mhdSrc, 'buildLaterMhdAccordionHtml', 'Akkordeon Builder');
assertIncludes(mhdSrc, 'mhd-accordion-list', 'mhd-accordion-list Klasse');
assertIncludes(mhdSrc, 'mhd-accordion-empty', 'Leerhinweis');
assertIncludes(mhdSrc, 'Keine weiteren MHDs im Bestand gefunden.', 'Leertext');
assertIncludes(mhdSrc, 'data-mhd-command="qty-edit"', 'Mengen-Tap öffnet Numpad');
assertIncludes(mhdSrc, 'data-mhd-action-status="geprueft"', 'OK-Aktion');
assertIncludes(mhdSrc, 'data-mhd-action-status="rausgenommen"', 'Raus-Aktion');
assertIncludes(mhdSrc, 'data-mhd-command="soldout"', 'Ausverkauft-Aktion');

// 3) CSS Touch + Feedback
assertIncludes(cssSrc, 'cursor: pointer', 'cursor pointer');
assertIncludes(cssSrc, '-webkit-tap-highlight-color: rgba(0, 0, 0, 0.1)', 'iOS Tap Highlight');
assertIncludes(cssSrc, 'touch-action: manipulation', 'touch-action');
assertIncludes(cssSrc, '.mhd-multi-batch-badge:active', 'Active Feedback');
assertIncludes(cssSrc, '.mhd-accordion-list', 'Accordion List Styles');
assertIncludes(cssSrc, '.mhd-accordion-empty', 'Empty Styles');
assertIncludes(cssSrc, 'order: 5', 'Badge Wrap Order');
assertIncludes(cssSrc, 'order: 6', 'Accordion Order');

// 4) SW Cache-Invalidierung
assert.match(
  swSrc,
  /CACHE_NAME = 'charculogic-v20261013-mhd-sync-status-v1'/,
  'SW Cache-Version',
);

// 5) Kein statisches Div-Badge
assert.ok(
  !mhdSrc.includes('<div class="mhd-multi-batch-badge" role="status">'),
  'statisches Badge-Div entfernt',
);

console.log('OK smoke-mhd-multi-batch: Multi-MHD-Akkordeon iOS Touch Verträge erfüllt.');
