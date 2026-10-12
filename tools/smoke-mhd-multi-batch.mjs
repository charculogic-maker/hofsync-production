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

// 1) Interaktives Badge + Chevron + Toggle
assertIncludes(mhdSrc, 'data-mhd-command="toggle-multi-batch"', 'Toggle-Command');
assertIncludes(mhdSrc, 'toggleMultiMhdAccordion', 'Toggle Helper');
assertIncludes(mhdSrc, 'mhd-multi-batch-chevron', 'Chevron Markup');
assertIncludes(mhdSrc, 'expandedMultiMhdIds', 'Expand-State');
assertIncludes(mhdSrc, 'resolveMhdArticleExpandKey', 'Artikel-Key für Nachrücken');

// 2) Akkordeon mit voller Aktionsfähigkeit
assertIncludes(mhdSrc, 'buildLaterMhdAccordionHtml', 'Akkordeon Builder');
assertIncludes(mhdSrc, 'buildLaterMhdAccordionRowHtml', 'Akkordeon-Zeile');
assertIncludes(mhdSrc, 'mhd-multi-batch-accordion', 'Akkordeon Klasse');
assertIncludes(mhdSrc, 'mhd-multi-batch-row', 'Zeilen Klasse');
assertIncludes(mhdSrc, 'data-mhd-command="qty-edit"', 'Mengen-Tap öffnet Numpad');
assertIncludes(mhdSrc, 'data-mhd-action-status="geprueft"', 'OK-Aktion');
assertIncludes(mhdSrc, 'data-mhd-action-status="rausgenommen"', 'Raus-Aktion');
assertIncludes(mhdSrc, 'data-mhd-command="soldout"', 'Ausverkauft-Aktion');

// 3) CSS
assertIncludes(cssSrc, '.mhd-multi-batch-wrap', 'Wrap Styles');
assertIncludes(cssSrc, '.mhd-multi-batch-badge.is-expanded', 'Expanded Badge');
assertIncludes(cssSrc, '.mhd-multi-batch-accordion', 'Accordion Styles');
assertIncludes(cssSrc, '.mhd-multi-batch-row-actions', 'Aktions-Grid');
assertIncludes(cssSrc, '.mhd-multi-batch-chevron', 'Chevron Styles');

// 4) SW Cache-Invalidierung
assert.match(
  swSrc,
  /CACHE_NAME = 'charculogic-v20261012-multi-mhd-accordion-v1'/,
  'SW Cache-Version',
);

// 5) Badge ist Button (nicht nur status-div)
assert.match(
  mhdSrc,
  /class="mhd-multi-batch-badge\$\{expanded \? ' is-expanded' : ''\}"/,
  'Badge als Button mit Expand-Klasse',
);
assert.ok(
  !mhdSrc.includes('<div class="mhd-multi-batch-badge" role="status">'),
  'statisches Badge-Div entfernt',
);

console.log('OK smoke-mhd-multi-batch: Multi-MHD-Akkordeon Verträge erfüllt.');
