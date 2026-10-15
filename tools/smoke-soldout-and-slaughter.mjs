/**
 * Smoke-Test: MHD Direkttaste „Ausverkauft“ + Undo-Toast
 * sowie Wareneingang Lohnschlachtung Galloway/Geflügel (ohne Schwein).
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

function assertNotIncludes(haystack, needle, label) {
  assert.ok(!haystack.includes(needle), `${label}: unerwartet "${needle}"`);
}

// 1) Direkttaste Ausverkauft auf MHD-Karte
assertIncludes(mhdSrc, 'class="btn-mhd-action btn-mhd-soldout"', 'Sold-Out Button Markup');
assertIncludes(mhdSrc, 'data-action="sold-out"', 'Sold-Out data-action');
assertIncludes(mhdSrc, 'bookMhdSoldOutDirect', '1-Tap Buchungsfunktion');
assertIncludes(mhdSrc, 'als ausverkauft gebucht', 'Undo-Toast Text');
assertIncludes(mhdSrc, 'RÜCKGÄNGIG', 'Undo-Button Beschriftung');
assertIncludes(mhdSrc, '}, 4000);', 'Undo-Toast 4 Sekunden');
assertIncludes(cssSrc, '.btn-mhd-action.btn-mhd-soldout', 'Sold-Out Styles');

// 2) Warengruppen: Galloway + Hühner + Bio-Schwein Zukauf (keine Lohnschlachtung Schwein)
assertIncludes(htmlSrc, 'Lohnschlachtung Rind (Galloway / Eigenbestand)', 'HTML Kategorie Rind');
assertIncludes(htmlSrc, 'Lohnschlachtung Geflügel (Hühner / Eigenbestand)', 'HTML Kategorie Geflügel');
assertIncludes(htmlSrc, 'Geflügel Zukauf (Fremdbezug)', 'HTML Geflügel Zukauf');
assertIncludes(htmlSrc, 'Zukauffleisch (Fremdbezug)', 'HTML Zukauffleisch');
assertIncludes(htmlSrc, 'Bio-Schwein Zukauf', 'HTML Bio-Schwein Zukauf');
assertIncludes(htmlSrc, 'we-temperature-head', 'HTML optionale Liefertemperatur');
assertIncludes(htmlSrc, 'Liefertemperatur °C (Optional)', 'HTML Liefertemperatur-Label');
assertIncludes(htmlSrc, 'data-temp-preset="3"', 'HTML Temp-Preset 3');
assertNotIncludes(htmlSrc, 'Lohnschlachtung Schwein', 'kein Schwein im HTML');
assertNotIncludes(receivingSrc, 'Lohnschlachtung Schwein', 'kein Schwein in receiving.js');
assertIncludes(htmlSrc, 'id="we-klassifizierung"', 'Klassifizierung Feld');
assertIncludes(htmlSrc, 'id="we-schlachtdatum-rind"', 'Schlachtdatum Rind');
assertIncludes(htmlSrc, 'id="we-schlachtdatum-poultry"', 'Schlachtdatum Geflügel');
assertIncludes(htmlSrc, 'id="we-stueck-kisten"', 'Stück/Kisten Feld');
assertIncludes(htmlSrc, '(Optional)', 'Optional-Hinweise');
assertIncludes(htmlSrc, 'falls bekannt', 'Ohrmarke optional Placeholder');
assertIncludes(htmlSrc, 'kg (optional)', 'Schlachtgewicht optional Placeholder');
assertIncludes(htmlSrc, 'id="we-lot-preview"', 'LOT-Vorschau');
assertIncludes(mhdSrc, 'resolveMetzTraceLot', 'LOT-Auflösung verdrahtet');
assertIncludes(mhdSrc, 'chargenNummer', 'Chargennummer Persistenz');
assertIncludes(receivingSrc, 'buildGallowayFallbackLot', 'Fallback-LOT Helfer');
assertIncludes(receivingSrc, 'HACCP_POULTRY_TEMP_LIMIT_C', 'Geflügel-Grenzwert Konstante');
assertIncludes(receivingSrc, 'Grenzwert Geflügel überschritten', 'Geflügel-Warntext');

// 3) Laufzeit-Helfer
const receiving = await import(pathToFileURL(path.join(root, 'web/receiving.js')).href);
const {
  METZ_DEFAULT_CATEGORY,
  METZ_RECEIVING_CATEGORIES,
  isLohnschlachtungRindCategory,
  isLohnschlachtungGefluegelCategory,
  isMetzMeatTemperatureCategory,
  formatHaccpMeatTempWarning,
  normalizeMetzReceivingCategory,
  getHaccpTempLimitForCategory,
  buildGallowayFallbackLot,
  resolveMetzTraceLot,
  HACCP_MEAT_TEMP_LIMIT_C,
  HACCP_POULTRY_TEMP_LIMIT_C,
} = receiving;

assert.equal(METZ_DEFAULT_CATEGORY, 'Lohnschlachtung Rind');
assert.equal(HACCP_MEAT_TEMP_LIMIT_C, 7.0);
assert.equal(HACCP_POULTRY_TEMP_LIMIT_C, 4.0);
assert.ok(
  METZ_RECEIVING_CATEGORIES.some((entry) => entry.value === 'Lohnschlachtung Rind'),
  'Rind vorhanden',
);
assert.ok(
  METZ_RECEIVING_CATEGORIES.some((entry) => entry.value === 'Lohnschlachtung Geflügel'),
  'Geflügel vorhanden',
);
assert.ok(
  METZ_RECEIVING_CATEGORIES.some((entry) => entry.value === 'Bio-Schwein Zukauf'),
  'Bio-Schwein Zukauf vorhanden',
);

assert.equal(isLohnschlachtungRindCategory('Lohnschlachtung Rind'), true);
assert.equal(isLohnschlachtungGefluegelCategory('Lohnschlachtung Geflügel'), true);
assert.equal(isLohnschlachtungGefluegelCategory('Lohnschlachtung Rind'), false);
assert.equal(getHaccpTempLimitForCategory('Lohnschlachtung Rind'), 7.0);
assert.equal(getHaccpTempLimitForCategory('Lohnschlachtung Geflügel'), 4.0);
assert.equal(getHaccpTempLimitForCategory('Bio-Schwein Zukauf'), 7.0);
assert.equal(
  formatHaccpMeatTempWarning(4.1, 'Lohnschlachtung Geflügel'),
  '⚠️ Grenzwert Geflügel überschritten (> 4,0 °C)! Kühlung sofort prüfen.',
);
assert.equal(formatHaccpMeatTempWarning(4.0, 'Lohnschlachtung Geflügel'), '');
assert.equal(
  formatHaccpMeatTempWarning(7.1, 'Lohnschlachtung Rind'),
  '⚠️ Grenzwert überschritten (> 7,0 °C). Kühlung und Begleitpapiere prüfen!',
);

// 4) Fallback-LOT ohne Ohrmarke
assert.equal(
  buildGallowayFallbackLot({
    klassifizierung: 'Ochse',
    schlachtDatumIso: '2026-10-14',
    ohrmarke: '',
  }),
  'GAL-OCHSE-20261014',
);
assert.equal(
  buildGallowayFallbackLot({
    klassifizierung: '',
    schlachtDatumIso: '2026-10-14',
    ohrmarke: '',
  }),
  'GAL-OCHSE-20261014',
);
assert.equal(
  buildGallowayFallbackLot({
    klassifizierung: 'Färse R3',
    schlachtDatumIso: '2026-10-14',
    ohrmarke: '',
  }),
  'GAL-FARSER3-20261014',
);
assert.equal(
  buildGallowayFallbackLot({
    klassifizierung: 'Ochse',
    schlachtDatumIso: '2026-10-14',
    ohrmarke: 'DE 05 123',
  }),
  '',
  'Mit Ohrmarke kein Fallback-LOT',
);
assert.equal(
  resolveMetzTraceLot({
    category: 'Lohnschlachtung Rind',
    ohrmarke: '',
    klassifizierung: 'U3',
    schlachtDatumIso: '2026-10-14',
  }),
  'GAL-U3-20261014',
);
assert.equal(
  resolveMetzTraceLot({
    category: 'Lohnschlachtung Rind',
    ohrmarke: 'DE051234',
    klassifizierung: 'Ochse',
    schlachtDatumIso: '2026-10-14',
  }),
  'DE051234',
);

assert.equal(normalizeMetzReceivingCategory('Lohnschlachtung Schwein'), 'Lohnschlachtung Rind');
assert.equal(normalizeMetzReceivingCategory('Geflügel Zukauf'), 'Geflügel Zukauf (Fremdbezug)');
assert.equal(normalizeMetzReceivingCategory('Bio Schwein Zukauf'), 'Bio-Schwein Zukauf');
assert.equal(isMetzMeatTemperatureCategory('Gewürze & Hilfsstoffe'), false);
assert.equal(isMetzMeatTemperatureCategory('Zukauffleisch (Fremdbezug)'), false);
assert.equal(isMetzMeatTemperatureCategory('Wurst Zukauf'), false);
assert.equal(isMetzMeatTemperatureCategory('🥛MoPro'), false);
assert.equal(isMetzMeatTemperatureCategory('Lohnschlachtung Rind'), true);
assert.equal(isMetzMeatTemperatureCategory('Lohnschlachtung Geflügel'), true);
assert.equal(isMetzMeatTemperatureCategory('Bio-Schwein Zukauf'), true);
assert.equal(
  receiving.isStrictHaccpTemperatureRequired({
    mode: 'schnell',
    warenKategorie: '🥛MoPro',
    warenKategorieMetzgerei: 'Lohnschlachtung Rind',
  }),
  false,
  'Laden/MoPro: keine Temperaturpflicht trotz Phantom-Metz-Kategorie',
);
assert.equal(
  receiving.isStrictHaccpTemperatureRequired({
    mode: 'metzgerei',
    warenKategorieMetzgerei: 'Lohnschlachtung Rind',
  }),
  true,
  'Metzgerei Lohnschlachtung Rind: Temperaturpflicht',
);

// 5) SW / App Cache
assertIncludes(
  swSrc,
  "CACHE_NAME = 'charculogic-v20261015-laden-temp-optional-v2'",
  'SW Cache-Version',
);
assertIncludes(appSrc, 'laden-temp-optional-v2', 'App SW Register Query');

console.log('OK smoke-soldout-and-slaughter: Ausverkauft + Galloway/Geflügel-Realismus Verträge erfüllt.');
