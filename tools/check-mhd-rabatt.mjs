#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  getDiscountForProduct,
  getMhdActionShortLabel,
  isFrischmilchProduct,
  mapMhdActionKeyToStatus,
  resolveMhdActionKey,
  resolveMhdRabattRuleGroup,
  shouldShowMhdPercentBadge,
} from '../web/mhd-rabatt.js';
import {
  calculateDiscount,
  getDefaultDiscountMatrix,
  normalizeDiscountMatrix,
} from '../web/discount-matrix.js';

const MOPRO = '🥛MoPro';
const KUEHL = '🥗 Kühlware';
const FRISCHE = '🍎 Frische';
const TK = '🧊 TK';
const TROCKEN = '📦 Trockenware';
const GEWUERZE = '🌿 Gewürze';
const GETRAENKE = '🍺 Getränke';

function key(category, tage, name, extra = {}) {
  return resolveMhdActionKey(category, tage, { name, produkt: name, kategorie: category, ...extra });
}

function label(category, tage, name, extra = {}) {
  return getMhdActionShortLabel(key(category, tage, name, extra), category);
}

const milchCases = [
  ['b*Vollmilch Demeter 3,8% Flasche', true],
  ['b*Milch Demeter 1,5% Flasche', true],
  ['Frischmilch Hof 3,8%', true],
  ['frische Milch 1,5%', true],
  ['Vollmilch frisch 3,8%', true],
  ['Alpenmilch laktosefrei 1,5%', true],
  ['H-Milch 3,5%', true],
  ['ESL Milch länger haltbar', true],
  ['Pasteurisierte Milch 1,5%', true],
  ['b*Joghurt mild 1,8% Demeter Glas', false],
  ['Weidemilchjoghurt ABC 3,8%', false],
  ['b*Schlagsahne 0,5 l Flasche', false],
  ['Hafermilch Natur', false],
  ['Vollmilchschokolade', false],
];

for (const [name, expected] of milchCases) {
  const actual = isFrischmilchProduct({ name, kategorie: MOPRO }, MOPRO);
  assert.equal(actual, expected, `Milch-Erkennung für "${name}" sollte ${expected} sein`);
}

assert.equal(
  isFrischmilchProduct({ ean: '4035626114608', name: 'Unbekannt', kategorie: MOPRO }, MOPRO),
  true,
  'Bekannte Milch-EAN muss treffen',
);

const discountCases = [
  // Milch Flasche / Tetrapack
  { name: 'Frischmilch Hof 3,8%', category: MOPRO, days: 3, expected: 'ok', short: 'Regulär', percent: 0 },
  { name: 'Frischmilch Hof 3,8%', category: MOPRO, days: 2, expected: 'ok', short: 'Regulär', percent: 0 },
  { name: 'Frischmilch Hof 3,8%', category: MOPRO, days: 1, expected: 'rabatt10', short: '10%', percent: 10 },
  { name: 'Frischmilch Hof 3,8%', category: MOPRO, days: 0, expected: 'rabatt20', short: '20%', percent: 20 },
  { name: 'Frischmilch Hof 3,8%', category: MOPRO, days: -1, expected: 'tonne', short: 'Abschreiben', percent: 0 },
  { name: 'b*Vollmilch Demeter 3,8% Flasche', category: MOPRO, days: 1, expected: 'rabatt10', short: '10%', percent: 10 },
  { name: 'H-Milch 3,5% Tetrapack', category: MOPRO, days: 0, expected: 'rabatt20', short: '20%', percent: 20 },
  { name: 'H-Milch 3,5% Tetrapack', category: MOPRO, days: 1, expected: 'rabatt10', short: '10%', percent: 10 },

  // Kühlware / MoPro / Käse
  { name: 'b*Joghurt mild 1,8%', category: MOPRO, days: 3, expected: 'ok', short: 'Regulär', percent: 0 },
  { name: 'b*Joghurt mild 1,8%', category: MOPRO, days: 2, expected: 'rabatt10', short: '10%', percent: 10 },
  { name: 'b*Joghurt mild 1,8%', category: MOPRO, days: 1, expected: 'rabatt20', short: '20%', percent: 20 },
  { name: 'b*Joghurt mild 1,8%', category: MOPRO, days: 0, expected: 'rabatt50', short: '50%', percent: 50 },
  { name: 'Bergkäse Stück', category: KUEHL, days: 2, expected: 'rabatt10', short: '10%', percent: 10 },
  { name: 'Bergkäse Stück', category: KUEHL, days: 1, expected: 'rabatt20', short: '20%', percent: 20 },
  { name: 'Bergkäse Stück', category: KUEHL, days: 0, expected: 'rabatt50', short: '50%', percent: 50 },

  // Frische / Fleisch / Wurst → Kühlware-Staffel
  { name: 'Salat Mix', category: FRISCHE, days: 3, expected: 'ok', short: 'Regulär', percent: 0 },
  { name: 'Salat Mix', category: FRISCHE, days: 2, expected: 'rabatt10', short: '10%', percent: 10 },
  { name: 'Salat Mix', category: FRISCHE, days: 1, expected: 'rabatt20', short: '20%', percent: 20 },
  { name: 'Salat Mix', category: FRISCHE, days: 0, expected: 'rabatt50', short: '50%', percent: 50 },
  { name: 'Ital. Mortadella', category: KUEHL, days: 3, expected: 'ok', short: 'Regulär', percent: 0 },
  { name: 'Ital. Mortadella', category: KUEHL, days: 2, expected: 'rabatt10', short: '10%', percent: 10 },
  { name: 'Ital. Mortadella', category: KUEHL, days: 1, expected: 'rabatt20', short: '20%', percent: 20 },
  { name: 'Bratwurst frisch', category: KUEHL, days: 0, expected: 'rabatt50', short: '50%', percent: 50 },

  // Trockenware / Konserven
  { name: 'Dinkel Spätzle', category: TROCKEN, days: 31, expected: 'ok', short: 'Regulär', percent: 0 },
  { name: 'Dinkel Spätzle', category: TROCKEN, days: 30, expected: 'rabatt10', short: '10%', percent: 10 },
  { name: 'Dinkel Spätzle', category: TROCKEN, days: 16, expected: 'rabatt10', short: '10%', percent: 10 },
  { name: 'Dinkel Spätzle', category: TROCKEN, days: 15, expected: 'rabatt20', short: '20%', percent: 20 },
  { name: 'Dinkel Spätzle', category: TROCKEN, days: 8, expected: 'rabatt20', short: '20%', percent: 20 },
  { name: 'Dinkel Spätzle', category: TROCKEN, days: 7, expected: 'rabatt50', short: '50%', percent: 50 },
  { name: 'Dinkel Spätzle', category: TROCKEN, days: 1, expected: 'rabatt50', short: '50%', percent: 50 },
  { name: 'Dinkel Spätzle', category: TROCKEN, days: 0, expected: 'rabatt50', short: '50%', percent: 50 },

  // TK / Gewürze / Getränke → same matrix as Trockenware
  { name: 'TK Beeren', category: TK, days: 31, expected: 'ok', short: 'Regulär', percent: 0 },
  { name: 'TK Beeren', category: TK, days: 20, expected: 'rabatt10', short: '10%', percent: 10 },
  { name: 'TK Beeren', category: TK, days: 10, expected: 'rabatt20', short: '20%', percent: 20 },
  { name: 'TK Beeren', category: TK, days: 5, expected: 'rabatt50', short: '50%', percent: 50 },
  { name: 'Pfeffer ganz', category: GEWUERZE, days: 15, expected: 'rabatt20', short: '20%', percent: 20 },
  { name: 'Pfeffer ganz', category: GEWUERZE, days: 7, expected: 'rabatt50', short: '50%', percent: 50 },
  { name: 'Apfelsaft 1l', category: GETRAENKE, days: 30, expected: 'rabatt10', short: '10%', percent: 10 },
  { name: 'Apfelsaft 1l', category: GETRAENKE, days: 1, expected: 'rabatt50', short: '50%', percent: 50 },
];

for (const item of discountCases) {
  const actualKey = key(item.category, item.days, item.name);
  const actualLabel = label(item.category, item.days, item.name);
  const discount = getDiscountForProduct(
    { name: item.name, produkt: item.name, kategorie: item.category },
    item.days,
  );
  assert.equal(actualKey, item.expected, `${item.name} @ ${item.days}d: key ${actualKey} != ${item.expected}`);
  assert.equal(actualLabel, item.short, `${item.name} @ ${item.days}d: label ${actualLabel} != ${item.short}`);
  assert.equal(discount.percent, item.percent, `${item.name} @ ${item.days}d: percent ${discount.percent} != ${item.percent}`);
  if (item.percent === 0 && item.expected === 'ok') {
    assert.equal(shouldShowMhdPercentBadge(actualKey), false, `${item.name}: Regulär darf keinen %-Badge zeigen`);
  }
  if (item.percent > 0) {
    assert.equal(shouldShowMhdPercentBadge(actualKey), true, `${item.name}: ${item.percent}% muss Badge zeigen`);
  }

  // discount-matrix.js must agree on percent for non-expired days
  if (item.days >= 0) {
    const matrixDiscount = calculateDiscount(10, item.days, item.category, '', item.name);
    assert.equal(
      matrixDiscount.discountPercent,
      item.percent,
      `Matrix ${item.name} @ ${item.days}d: ${matrixDiscount.discountPercent} != ${item.percent}`,
    );
  }
}

assert.equal(resolveMhdRabattRuleGroup({ name: 'Frischmilch Hof', kategorie: MOPRO }, MOPRO), 'frischmilch');
assert.equal(resolveMhdRabattRuleGroup({ name: 'Bergkäse', kategorie: KUEHL }, KUEHL), 'kuehlware');
assert.equal(resolveMhdRabattRuleGroup({ name: 'Mortadella', kategorie: KUEHL }, KUEHL), 'kuehlware');
assert.equal(resolveMhdRabattRuleGroup({ name: 'TK Beeren', kategorie: TK }, TK), 'trockenware');
assert.equal(resolveMhdRabattRuleGroup({ name: 'Pfeffer ganz', kategorie: GEWUERZE }, GEWUERZE), 'trockenware');
assert.equal(resolveMhdRabattRuleGroup({ name: 'Apfelsaft 1l', kategorie: GETRAENKE }, GETRAENKE), 'trockenware');
assert.equal(mapMhdActionKeyToStatus('rabatt10'), 'critical');
assert.equal(mapMhdActionKeyToStatus('rabatt20'), 'critical');
assert.equal(mapMhdActionKeyToStatus('rabatt50'), 'critical');
assert.equal(mapMhdActionKeyToStatus('ok'), 'ok');
assert.equal(mapMhdActionKeyToStatus('tonne'), 'expired');

const defaults = getDefaultDiscountMatrix();
assert.deepEqual(
  defaults.defaultRules.map((r) => [r.daysRemainingMax, r.discountPercent]),
  [[0, 50], [1, 20], [2, 10]],
);
assert.deepEqual(
  defaults.categoryOverrides.Milch.map((r) => [r.daysRemainingMax, r.discountPercent]),
  [[0, 20], [1, 10]],
);
assert.deepEqual(
  defaults.categoryOverrides.Trockenware.map((r) => [r.daysRemainingMax, r.discountPercent]),
  [[7, 50], [15, 20], [30, 10]],
);

const seeded = normalizeDiscountMatrix({ enabled: true, defaultRules: [], categoryOverrides: {} });
assert.equal(seeded.categoryOverrides.Milch.length, 2);
assert.equal(seeded.categoryOverrides.Trockenware.length, 3);
assert.equal(seeded.categoryOverrides['MoPro & Kühlware'].length, 3);

console.log(`MHD-Rabattcheck: ${milchCases.length + discountCases.length} Fälle bestanden.`);
