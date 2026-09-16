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

const frischmilchCases = [
  ['b*Vollmilch Demeter 3,8% Flasche', true],
  ['b*Milch Demeter 1,5% Flasche', true],
  ['Frischmilch Hof 3,8%', true],
  ['frische Milch 1,5%', true],
  ['Vollmilch frisch 3,8%', true],
  ['Alpenmilch laktosefrei 1,5%', true],
  ['H-Milch 3,5%', false],
  ['ESL Milch länger haltbar', false],
  ['Pasteurisierte Milch 1,5%', false],
  ['b*Joghurt mild 1,8% Demeter Glas', false],
  ['Weidemilchjoghurt ABC 3,8%', false],
  ['b*Schlagsahne 0,5 l Flasche', false],
  ['Hafermilch Natur', false],
  ['Vollmilchschokolade', false],
];

for (const [name, expected] of frischmilchCases) {
  const actual = isFrischmilchProduct({ name, kategorie: MOPRO }, MOPRO);
  assert.equal(actual, expected, `Frischmilch-Erkennung für "${name}" sollte ${expected} sein`);
}

assert.equal(
  isFrischmilchProduct({ ean: '4035626114608', name: 'Unbekannt', kategorie: MOPRO }, MOPRO),
  true,
  'Bekannte Frischmilch-EAN muss treffen',
);

const discountCases = [
  // Frischmilch special
  { name: 'Frischmilch Hof 3,8%', category: MOPRO, days: 3, expected: 'ok', short: 'Regulär', percent: 0 },
  { name: 'Frischmilch Hof 3,8%', category: MOPRO, days: 2, expected: 'ok', short: 'Regulär', percent: 0 },
  { name: 'Frischmilch Hof 3,8%', category: MOPRO, days: 1, expected: 'rabatt10', short: '10%', percent: 10 },
  { name: 'Frischmilch Hof 3,8%', category: MOPRO, days: 0, expected: 'rabatt20', short: '20%', percent: 20 },
  { name: 'Frischmilch Hof 3,8%', category: MOPRO, days: -1, expected: 'tonne', short: 'Abschreiben', percent: 0 },
  { name: 'b*Vollmilch Demeter 3,8% Flasche', category: MOPRO, days: 1, expected: 'rabatt10', short: '10%', percent: 10 },

  // MoPro / Käse fallback
  { name: 'H-Milch 3,5%', category: MOPRO, days: 5, expected: 'ok', short: 'Regulär', percent: 0 },
  { name: 'H-Milch 3,5%', category: MOPRO, days: 4, expected: 'rabatt20', short: '20%', percent: 20 },
  { name: 'H-Milch 3,5%', category: MOPRO, days: 2, expected: 'rabatt20', short: '20%', percent: 20 },
  { name: 'H-Milch 3,5%', category: MOPRO, days: 1, expected: 'rabatt50', short: '50%', percent: 50 },
  { name: 'H-Milch 3,5%', category: MOPRO, days: 0, expected: 'rabatt50', short: '50%', percent: 50 },
  { name: 'b*Joghurt mild 1,8%', category: MOPRO, days: 4, expected: 'rabatt20', short: '20%', percent: 20 },
  { name: 'b*Joghurt mild 1,8%', category: MOPRO, days: 1, expected: 'rabatt50', short: '50%', percent: 50 },
  { name: 'Bergkäse Stück', category: KUEHL, days: 3, expected: 'rabatt20', short: '20%', percent: 20 },
  { name: 'Bergkäse Stück', category: KUEHL, days: 1, expected: 'rabatt50', short: '50%', percent: 50 },

  // Frische / Fleisch / Wurst
  { name: 'Salat Mix', category: FRISCHE, days: 4, expected: 'ok', short: 'Regulär', percent: 0 },
  { name: 'Salat Mix', category: FRISCHE, days: 3, expected: 'rabatt20', short: '20%', percent: 20 },
  { name: 'Salat Mix', category: FRISCHE, days: 2, expected: 'rabatt20', short: '20%', percent: 20 },
  { name: 'Salat Mix', category: FRISCHE, days: 1, expected: 'rabatt50', short: '50%', percent: 50 },
  { name: 'Salat Mix', category: FRISCHE, days: 0, expected: 'rabatt50', short: '50%', percent: 50 },
  { name: 'Ital. Mortadella', category: KUEHL, days: 4, expected: 'ok', short: 'Regulär', percent: 0 },
  { name: 'Ital. Mortadella', category: KUEHL, days: 3, expected: 'rabatt20', short: '20%', percent: 20 },
  { name: 'Ital. Mortadella', category: KUEHL, days: 1, expected: 'rabatt50', short: '50%', percent: 50 },
  { name: 'Bratwurst frisch', category: KUEHL, days: 2, expected: 'rabatt20', short: '20%', percent: 20 },

  // Trockenware / Konserven
  { name: 'Dinkel Spätzle', category: TROCKEN, days: 6, expected: 'ok', short: 'Regulär', percent: 0 },
  { name: 'Dinkel Spätzle', category: TROCKEN, days: 5, expected: 'rabatt20', short: '20%', percent: 20 },
  { name: 'Dinkel Spätzle', category: TROCKEN, days: 3, expected: 'rabatt20', short: '20%', percent: 20 },
  { name: 'Dinkel Spätzle', category: TROCKEN, days: 2, expected: 'rabatt50', short: '50%', percent: 50 },
  { name: 'Dinkel Spätzle', category: TROCKEN, days: 1, expected: 'rabatt50', short: '50%', percent: 50 },
  { name: 'Dinkel Spätzle', category: TROCKEN, days: 0, expected: 'rabatt50', short: '50%', percent: 50 },

  // Legacy TK / Gewürze / Getränke unchanged thresholds
  { name: 'TK Beeren', category: TK, days: 14, expected: 'pruefen', short: 'Prüfen', percent: 0 },
  { name: 'TK Beeren', category: TK, days: 7, expected: 'rabatt30', short: '30%', percent: 30 },
  { name: 'TK Beeren', category: TK, days: 3, expected: 'rabatt50', short: '50%', percent: 50 },
  { name: 'Pfeffer ganz', category: GEWUERZE, days: 60, expected: 'pruefen', short: 'Prüfen', percent: 0 },
  { name: 'Pfeffer ganz', category: GEWUERZE, days: 30, expected: 'rabatt30', short: '30%', percent: 30 },
  { name: 'Pfeffer ganz', category: GEWUERZE, days: 14, expected: 'rabatt50', short: '50%', percent: 50 },
  { name: 'Apfelsaft 1l', category: GETRAENKE, days: 14, expected: 'pruefen', short: 'Prüfen', percent: 0 },
  { name: 'Apfelsaft 1l', category: GETRAENKE, days: 7, expected: 'rabatt30', short: '30%', percent: 30 },
  { name: 'Apfelsaft 1l', category: GETRAENKE, days: 3, expected: 'rabatt50', short: '50%', percent: 50 },

  // Edge: MoPro on MHD day (0) is 50% even though the prose only named „1 Tag“
  { name: 'b*Joghurt mild 1,8%', category: MOPRO, days: 0, expected: 'rabatt50', short: '50%', percent: 50 },
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
}

assert.equal(resolveMhdRabattRuleGroup({ name: 'Frischmilch Hof', kategorie: MOPRO }, MOPRO), 'frischmilch');
assert.equal(resolveMhdRabattRuleGroup({ name: 'Bergkäse', kategorie: KUEHL }, KUEHL), 'mopro');
assert.equal(resolveMhdRabattRuleGroup({ name: 'Mortadella', kategorie: KUEHL }, KUEHL), 'frische');
assert.equal(mapMhdActionKeyToStatus('rabatt10'), 'critical');
assert.equal(mapMhdActionKeyToStatus('rabatt20'), 'critical');
assert.equal(mapMhdActionKeyToStatus('rabatt50'), 'critical');
assert.equal(mapMhdActionKeyToStatus('ok'), 'ok');
assert.equal(mapMhdActionKeyToStatus('tonne'), 'expired');

console.log(`MHD-Rabattcheck: ${frischmilchCases.length + discountCases.length} Fälle bestanden.`);
