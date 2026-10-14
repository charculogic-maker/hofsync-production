/**
 * Smoke-Test: MHD-Karten Redesign (kompakt) + Multi-MHD-Akkordeon iOS-Touch.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mhdSrc = readFileSync(path.join(root, 'web/mhd.js'), 'utf8');
const cssSrc = readFileSync(path.join(root, 'web/style.css'), 'utf8');
const swSrc = readFileSync(path.join(root, 'web/sw.js'), 'utf8');
const appSrc = readFileSync(path.join(root, 'web/app.js'), 'utf8');

function assertIncludes(haystack, needle, label) {
  assert.ok(haystack.includes(needle), `${label}: erwartet "${needle}"`);
}

function assertNotIncludes(haystack, needle, label) {
  assert.ok(!haystack.includes(needle), `${label}: unerwartet "${needle}"`);
}

// 1) Kompakte 3-teilige Kartenstruktur
assertIncludes(mhdSrc, 'mhd-card-top', 'Kartenkopf Klasse');
assertIncludes(mhdSrc, 'mhd-card-category', 'Warengruppe Zeile');
assertIncludes(mhdSrc, 'mhd-ampel-badge', 'Ampel-Badge');
assertIncludes(mhdSrc, 'buildMhdAmpelBadgeHtml', 'Ampel Builder');
assertIncludes(mhdSrc, 'HEUTE FÄLLIG', 'Ampel Heute');
assertIncludes(mhdSrc, 'mhd-card-body', 'Kartenbody');
assertIncludes(mhdSrc, 'mhd-product-meta-line', 'Meta-Zeile Klasse');
assertIncludes(mhdSrc, 'buildMhdCompactMetaLine', 'Kompakte Meta-Zeile');
assertIncludes(mhdSrc, 'EAN: …', 'EAN letzte 4');
assertIncludes(mhdSrc, 'mhd-card-more', '⋯ Dropdown');
assertIncludes(mhdSrc, 'mhd-card-more-trigger', '⋯ Trigger');
assertIncludes(mhdSrc, 'data-mhd-command="abschreiben"', 'Abschreiben im Menü');
assertIncludes(mhdSrc, 'data-mhd-command="soldout"', 'Ausverkauft im Menü');
assertIncludes(mhdSrc, 'mhd-touch-action-row', 'Touch-Aktionsleiste');
assertIncludes(mhdSrc, '✓ OK', 'OK Button');
assertIncludes(mhdSrc, '🏷️ Rabatt', 'Rabatt Button');
assertIncludes(mhdSrc, '📦 Raus', 'Raus Button');
assertIncludes(mhdSrc, 'data-mhd-command="rabatt"', 'Rabatt Command');
assertIncludes(mhdSrc, 'openMhdRabattStickerDialog', 'Rabatt-Sticker Dialog');
assertIncludes(mhdSrc, 'confirmMhdSpecialAction', 'Sonderaktion Bestätigung');

// Kein Ausverkauft mehr direkt neben dem Mengenfeld
assertNotIncludes(
  mhdSrc,
  '<div class="mhd-controls-row">',
  'alte controls-row mit Ausverkauft entfernt',
);

// 2) Akkordeon: echtes Button + data-action + is-open
assertIncludes(mhdSrc, 'data-action="toggle-mhd-accordion"', 'data-action Toggle');
assertIncludes(mhdSrc, 'type="button"', 'Button type');
assertIncludes(mhdSrc, 'mhd-multi-batch-badge${expanded ? \' is-expanded\' : \'\'}', 'Badge expanded Klasse');
assertIncludes(mhdSrc, 'Folge-Chargen', 'Folge-Chargen Wording');
assertIncludes(mhdSrc, 'mhd-accordion-content${expanded ? \' is-open\' : \'\'}', 'is-open Klasse');
assertIncludes(mhdSrc, 'toggleMhdAccordion', 'toggleMhdAccordion Helper');
assertIncludes(mhdSrc, 'handleMultiMhdAccordionToggleEvent', 'iOS Toggle Handler');
assertIncludes(mhdSrc, "addEventListener('pointerdown'", 'pointerdown Binding');
assertIncludes(mhdSrc, "document.addEventListener('click'", 'Document Click Delegation');
assertIncludes(mhdSrc, 'fromPointer: true', 'pointerdown Pfad');
assertIncludes(mhdSrc, 'fromPointer: false', 'click Pfad');
assertIncludes(mhdSrc, 'mhd-multi-batch-chevron', 'Chevron Markup');
assertIncludes(mhdSrc, 'expandedMultiMhdIds', 'Expand-State');
assertIncludes(mhdSrc, 'data-mhd-command="qty-edit"', 'Mengen-Tap öffnet Numpad');
assertIncludes(mhdSrc, 'data-mhd-action-status="geprueft"', 'OK-Aktion Sub-Charge');
assertIncludes(mhdSrc, 'data-mhd-action-status="rausgenommen"', 'Raus-Aktion Sub-Charge');

assert.ok(
  !mhdSrc.includes('<div class="mhd-multi-batch-badge" role="status">'),
  'statisches Badge-Div entfernt',
);

// 3) CSS Kompakt + Touch + Akkordeon
assertIncludes(cssSrc, '.mhd-card-top', 'CSS Kartenkopf');
assertIncludes(cssSrc, '.mhd-ampel-badge', 'CSS Ampel');
assertIncludes(cssSrc, '.mhd-ampel--expired', 'CSS Ampel abgelaufen');
assertIncludes(cssSrc, '.mhd-ampel--due', 'CSS Ampel heute');
assertIncludes(cssSrc, '.mhd-ampel--future', 'CSS Ampel zukünftig');
assertIncludes(cssSrc, '#64748b', 'Meta-Farbe dezent grau');
assertIncludes(cssSrc, '-webkit-line-clamp: 2', 'Titel max 2 Zeilen');
assertIncludes(cssSrc, '.mhd-touch-action-row', 'CSS Action-Row');
assertIncludes(cssSrc, 'min-height: 48px', 'Touch Mindesthöhe');
assertIncludes(cssSrc, '.mhd-card-more-trigger', 'CSS ⋯ Trigger');
assertIncludes(cssSrc, 'touch-action: manipulation', 'touch-action');
assertIncludes(cssSrc, '-webkit-tap-highlight-color: rgba(0, 0, 0, 0.1)', 'iOS Tap Highlight');
assertIncludes(cssSrc, 'border: 1px solid #a7f3d0', 'Minz-Rand Badge');
assertIncludes(cssSrc, 'background: #ecfdf5', 'Minz-Hintergrund Badge');
assertIncludes(cssSrc, '.mhd-accordion-content', 'Accordion Content');
assertIncludes(cssSrc, '.mhd-accordion-content.is-open', 'Accordion is-open');
assertIncludes(cssSrc, 'display: flex !important', 'is-open visible');
assertIncludes(cssSrc, 'visibility: visible !important', 'is-open visibility');
assertIncludes(cssSrc, 'overflow-x: hidden', 'kein Horizontal-Scroll');
assertIncludes(cssSrc, 'border-radius: 12px', 'einheitlicher Radius');
assertIncludes(cssSrc, 'padding: 12px 12px 12px 16px', 'kompaktes Padding');
assertIncludes(cssSrc, 'background: #166534', 'OK Grün');

// 4) SW / App Cache
assert.match(
  swSrc,
  /CACHE_NAME = 'charculogic-v20261014-mhd-full-redesign-v1'/,
  'SW Cache-Version mhd-full-redesign-v1',
);
assertIncludes(appSrc, '20261014-mhd-full-redesign-v1', 'SW Register Cache-Buster');
assertIncludes(appSrc, "APP_RELEASE_AT = '2026-10-14T08:45:00+02:00'", 'APP_RELEASE_AT');

console.log('OK smoke-mhd-redesign-and-accordion: Kompakt-Layout & Akkordeon-Touch Verträge erfüllt.');
