/**
 * Smoke-Test: MHD Direkttaste „Ausverkauft“ + Undo-Toast
 * sowie Wareneingang Galloway / Weidehuhn / Bio-Schwein Zukauf.
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
const tenantSettingsSrc = readFileSync(path.join(root, 'web/tenant-settings.js'), 'utf8');

function assertIncludes(haystack, needle, label) {
  assert.ok(haystack.includes(needle), `${label}: erwartet "${needle}"`);
}

function assertNotIncludes(haystack, needle, label) {
  assert.ok(!haystack.includes(needle), `${label}: unerwartet "${needle}"`);
}

// 1) Direkttaste Ausverkauft
assertIncludes(mhdSrc, 'data-action="sold-out"', 'Sold-Out data-action');
assertIncludes(mhdSrc, 'bookMhdSoldOutDirect', '1-Tap Buchungsfunktion');
assertIncludes(mhdSrc, 'RÜCKGÄNGIG', 'Undo-Button');
assertIncludes(cssSrc, '.btn-mhd-action.btn-mhd-soldout', 'Sold-Out Styles');

// 2) Warengruppen + Lieferanten
assertIncludes(htmlSrc, 'Lohnschlachtung Rind (Galloway / Eigenbestand)', 'HTML Rind');
assertIncludes(htmlSrc, 'Lohnschlachtung Geflügel (Hühner / Eigenbestand)', 'HTML Geflügel');
assertIncludes(htmlSrc, 'Bio-Schwein Zukauf (Hälften / Ganze / Teilstücke)', 'HTML Bio-Schwein');
assertIncludes(htmlSrc, 'Zukauffleisch Rind/Kalb (Fremdbezug)', 'HTML Zukauf Rind/Kalb');
assertIncludes(htmlSrc, 'option value="Stautenhof"', 'Lieferant Stautenhof');
assertIncludes(htmlSrc, 'option value="Naturverbund"', 'Lieferant Naturverbund');
assertIncludes(htmlSrc, 'option value="Bio Hof Frohnenbruch"', 'Lieferant Frohnenbruch');
assertIncludes(tenantSettingsSrc, 'Naturverbund', 'tenant-settings Naturverbund');
assertIncludes(mhdSrc, 'Bio Hof Frohnenbruch', 'mhd Default-Lieferanten');
assertNotIncludes(htmlSrc, 'Lohnschlachtung Schwein', 'kein Eigenbestand-Schwein');
assertIncludes(htmlSrc, 'falls am Viertel vermerkt', 'Ohrmarke optional Placeholder');
assertIncludes(htmlSrc, 'id="we-lieferschein-nr"', 'Lieferschein-Nr Feld');
assertIncludes(htmlSrc, 'name="we-pork-delivery-type"', 'Schwein Lieferart');
assertIncludes(htmlSrc, 'id="we-gesamtgewicht"', 'Gesamtgewicht Feld');
assertIncludes(htmlSrc, 'id="we-lot-preview"', 'LOT-Vorschau');

// 3) Laufzeit-Helfer
const receiving = await import(pathToFileURL(path.join(root, 'web/receiving.js')).href);
const {
  METZ_DEFAULT_CATEGORY,
  METZ_RECEIVING_CATEGORIES,
  METZ_DEFAULT_SUPPLIERS,
  isLohnschlachtungRindCategory,
  isLohnschlachtungGefluegelCategory,
  isBioSchweinZukaufCategory,
  getHaccpTempLimitForCategory,
  formatHaccpMeatTempWarning,
  normalizeMetzReceivingCategory,
  buildGallowayFallbackLot,
  resolveMetzTraceLot,
  HACCP_MEAT_TEMP_LIMIT_C,
  HACCP_POULTRY_TEMP_LIMIT_C,
} = receiving;

assert.equal(METZ_DEFAULT_CATEGORY, 'Lohnschlachtung Rind');
assert.equal(HACCP_MEAT_TEMP_LIMIT_C, 7.0);
assert.equal(HACCP_POULTRY_TEMP_LIMIT_C, 4.0);
assert.ok(METZ_RECEIVING_CATEGORIES.some((e) => e.value === 'Bio-Schwein Zukauf'));
assert.ok(METZ_RECEIVING_CATEGORIES.some((e) => e.value === 'Lohnschlachtung Geflügel'));
assert.ok(METZ_RECEIVING_CATEGORIES.some((e) => e.value === 'Zukauffleisch Rind/Kalb (Fremdbezug)'));
assert.ok(!METZ_RECEIVING_CATEGORIES.some((e) => /lohnschlachtung\s*schwein/i.test(e.value)));
assert.ok(METZ_DEFAULT_SUPPLIERS.includes('Naturverbund'));
assert.ok(METZ_DEFAULT_SUPPLIERS.includes('Stautenhof'));
assert.ok(METZ_DEFAULT_SUPPLIERS.includes('Bio Hof Frohnenbruch'));

assert.equal(isBioSchweinZukaufCategory('Bio-Schwein Zukauf'), true);
assert.equal(isLohnschlachtungGefluegelCategory('Lohnschlachtung Geflügel'), true);
assert.equal(getHaccpTempLimitForCategory('Bio-Schwein Zukauf'), 7.0);
assert.equal(getHaccpTempLimitForCategory('Lohnschlachtung Geflügel'), 4.0);
assert.equal(
  formatHaccpMeatTempWarning(4.1, 'Lohnschlachtung Geflügel'),
  '⚠️ Grenzwert Geflügel überschritten (> 4,0 °C)! Kühlung sofort prüfen.',
);
assert.equal(formatHaccpMeatTempWarning(7.0, 'Bio-Schwein Zukauf'), '');
assert.ok(formatHaccpMeatTempWarning(7.1, 'Bio-Schwein Zukauf').includes('> 7,0'));

// 4) Rind ohne Ohrmarke → Fallback-LOT
assert.equal(
  buildGallowayFallbackLot({
    klassifizierung: 'Ochse',
    schlachtDatumIso: '2026-10-14',
    ohrmarke: '',
  }),
  'GAL-OCHSE-20261014',
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

assert.equal(normalizeMetzReceivingCategory('Zukauffleisch (Fremdbezug)'), 'Zukauffleisch Rind/Kalb (Fremdbezug)');
assert.equal(normalizeMetzReceivingCategory('Lohnschlachtung Schwein'), 'Bio-Schwein Zukauf');
assert.equal(isLohnschlachtungRindCategory('Lohnschlachtung Rind'), true);

assertIncludes(mhdSrc, 'isBioSchweinZukaufCategory', 'Schwein-UI verdrahtet');
assertIncludes(mhdSrc, 'lieferungsArt', 'Lieferart Persistenz');
assertIncludes(mhdSrc, 'gesamtgewichtKg', 'Gesamtgewicht Persistenz');
assertIncludes(mhdSrc, 'resolveMetzTraceLot', 'LOT-Auflösung');

// 5) SW / App Cache v2
assertIncludes(
  swSrc,
  "CACHE_NAME = 'charculogic-v20261014-livestock-realism-v2'",
  'SW Cache-Version',
);
assertIncludes(appSrc, 'livestock-realism-v2', 'App SW Register Query');

console.log('OK smoke-soldout-and-slaughter: Ausverkauft + Galloway/Geflügel/Bio-Schwein Verträge erfüllt.');
