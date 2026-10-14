/**
 * Smoke-Test: MHD Direkttaste „Ausverkauft“ + Undo-Toast
 * sowie Wareneingang „Lohnschlachtung Rind“ inkl. HACCP-Hinweis.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mhdSrc = readFileSync(path.join(root, 'web/mhd.js'), 'utf8');
const receivingSrc = readFileSync(path.join(root, 'web/receiving.js'), 'utf8');
const cssSrc = readFileSync(path.join(root, 'web/style.css'), 'utf8');
const htmlSrc = readFileSync(path.join(root, 'web/index.html'), 'utf8');
const swSrc = readFileSync(path.join(root, 'web/sw.js'), 'utf8');
const appSrc = readFileSync(path.join(root, 'web/app.js'), 'utf8');

function assertIncludes(haystack, needle, label) {
  assert.ok(haystack.includes(needle), `${label}: erwartet "${needle}"`);
}

// 1) Direkttaste Ausverkauft auf MHD-Karte
assertIncludes(mhdSrc, 'class="btn-mhd-action btn-mhd-soldout"', 'Sold-Out Button Markup');
assertIncludes(mhdSrc, 'data-action="sold-out"', 'Sold-Out data-action');
assertIncludes(mhdSrc, 'bookMhdSoldOutDirect', '1-Tap Buchungsfunktion');
assertIncludes(mhdSrc, 'als ausverkauft gebucht', 'Undo-Toast Text');
assertIncludes(mhdSrc, 'RÜCKGÄNGIG', 'Undo-Button Beschriftung');
assertIncludes(mhdSrc, '}, 4000);', 'Undo-Toast 4 Sekunden');
assertIncludes(cssSrc, '.btn-mhd-action.btn-mhd-soldout', 'Sold-Out Styles');
assertIncludes(cssSrc, '#fee2e2', 'Sold-Out Hintergrund');
assertIncludes(cssSrc, '#fca5a5', 'Sold-Out Border');
assertIncludes(cssSrc, '#b91c1c', 'Sold-Out Textfarbe');

// 2) Warengruppen Metzgerei / Lohnschlachtung
assertIncludes(htmlSrc, 'Lohnschlachtung Rind (Eigenbestand / Galloway)', 'HTML Kategorie Rind');
assertIncludes(htmlSrc, 'Lohnschlachtung Schwein (Eigenbestand)', 'HTML Kategorie Schwein');
assertIncludes(htmlSrc, 'Zukauffleisch (Fremdbezug)', 'HTML Zukauffleisch');
assertIncludes(htmlSrc, 'Gewürze &amp; Hilfsstoffe', 'HTML Gewürze & Hilfsstoffe');
assertIncludes(htmlSrc, 'id="we-ohrmarke"', 'Ohrmarke Feld');
assertIncludes(htmlSrc, 'id="we-schlachtgewicht"', 'Schlachtgewicht Feld');
assertIncludes(htmlSrc, 'id="we-temperature-metz-warn"', 'Temperatur-Warnung Markup');
assertIncludes(htmlSrc, 'Grenzwert überschritten', 'Warntext im HTML');
assertNotIncludesFremdfleischLabel();

function assertNotIncludesFremdfleischLabel() {
  // Option-Label „Fremdfleisch“ darf nicht mehr als Dropdown-Text stehen.
  assert.ok(
    !htmlSrc.includes('>Fremdfleisch</option>'),
    'Fremdfleisch-Label entfernt',
  );
}

assertIncludes(receivingSrc, 'METZ_RECEIVING_CATEGORIES', 'Metz-Kategorien Export');
assertIncludes(receivingSrc, 'Lohnschlachtung Rind', 'Kategorie Rind in receiving.js');
assertIncludes(receivingSrc, 'formatHaccpMeatTempWarning', 'HACCP Warn-Helfer');
assertIncludes(mhdSrc, 'updateMetzSlaughterExtraFieldsUi', 'Zusatzfelder UI');
assertIncludes(mhdSrc, 'updateMetzTemperatureWarnUi', 'Temp-Warn UI');
assertIncludes(mhdSrc, 'ohrmarke', 'Ohrmarke Persistenz');
assertIncludes(mhdSrc, 'schlachtgewichtKg', 'Schlachtgewicht Persistenz');

// 3) Laufzeit-Helfer aus receiving.js
const receiving = await import(pathToFileURL(path.join(root, 'web/receiving.js')).href);
const {
  METZ_DEFAULT_CATEGORY,
  METZ_RECEIVING_CATEGORIES,
  isLohnschlachtungRindCategory,
  isMetzMeatTemperatureCategory,
  formatHaccpMeatTempWarning,
  normalizeMetzReceivingCategory,
  HACCP_MEAT_TEMP_LIMIT_C,
} = receiving;

assert.equal(METZ_DEFAULT_CATEGORY, 'Lohnschlachtung Rind');
assert.equal(HACCP_MEAT_TEMP_LIMIT_C, 7.0);
assert.ok(
  METZ_RECEIVING_CATEGORIES.some((entry) => entry.value === 'Lohnschlachtung Rind'),
  'Lohnschlachtung Rind in Kategorie-Liste',
);
assert.ok(
  METZ_RECEIVING_CATEGORIES.some((entry) => entry.value === 'Zukauffleisch (Fremdbezug)'),
  'Zukauffleisch in Kategorie-Liste',
);
assert.equal(isLohnschlachtungRindCategory('Lohnschlachtung Rind'), true);
assert.equal(isLohnschlachtungRindCategory('Wurst Zukauf'), false);
assert.equal(isMetzMeatTemperatureCategory('Lohnschlachtung Rind'), true);
assert.equal(isMetzMeatTemperatureCategory('Gewürze & Hilfsstoffe'), false);
assert.equal(
  formatHaccpMeatTempWarning(7.1),
  '⚠️ Grenzwert überschritten (> 7,0 °C). Kühlung und Begleitpapiere prüfen!',
);
assert.equal(formatHaccpMeatTempWarning(7.0), '');
assert.equal(formatHaccpMeatTempWarning(6.9), '');
assert.equal(normalizeMetzReceivingCategory('Fremdfleisch'), 'Zukauffleisch (Fremdbezug)');
assert.equal(normalizeMetzReceivingCategory('Gewürze Metzgerei'), 'Gewürze & Hilfsstoffe');

// 4) SW / App Cache-Invalidierung
assertIncludes(
  swSrc,
  "CACHE_NAME = 'charculogic-v20261014-soldout-and-slaughter-v1'",
  'SW Cache-Version',
);
assertIncludes(appSrc, 'soldout-and-slaughter-v1', 'App SW Register Query');

console.log('OK smoke-soldout-and-slaughter: Ausverkauft-Direktaste & Lohnschlachtung Rind Verträge erfüllt.');
