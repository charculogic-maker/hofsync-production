#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  getMhdActionShortLabel,
  isFrischmilchProduct,
  mapMhdActionKeyToStatus,
  resolveMhdActionKey,
} from '../web/mhd-rabatt.js';

const MOPRO = '🥛MoPro';
const KUEHL = '🥗 Kühlware';
const FRISCHE = '🍎 Frische';
const TK = '🧊 TK';
const TROCKEN = '📦 Trockenware';

function key(category, tage, name) {
  return resolveMhdActionKey(category, tage, { name, produkt: name, kategorie: category });
}

function label(category, tage, name) {
  return getMhdActionShortLabel(key(category, tage, name), category);
}

const frischmilchCases = [
  ['b*Vollmilch Demeter 3,8% Flasche', true],
  ['b*Milch Demeter 1,5% Flasche', true],
  ['Frischmilch Hof 3,8%', true],
  ['frische Milch 1,5%', true],
  ['Alpenmilch laktosefrei 1,5%', true],
  ['H-Milch 3,5%', false],
  ['ESL Milch länger haltbar', false],
  ['Pasteurisierte Milch 1,5%', false],
  ['b*Joghurt mild 1,8% Demeter Glas', false],
  ['Weidemilchjoghurt ABC 3,8%', false],
  ['b*Schlagsahne 0,5 l Flasche', false],
  ['Hafermilch Natur', false],
];

for (const [name, expected] of frischmilchCases) {
  const actual = isFrischmilchProduct({ name, kategorie: MOPRO }, MOPRO);
  assert.equal(actual, expected, `Frischmilch-Erkennung für "${name}" sollte ${expected} sein`);
}

const discountCases = [
  { name: 'Frischmilch Hof 3,8%', category: MOPRO, days: 3, expected: 'ok', short: 'OK' },
  { name: 'Frischmilch Hof 3,8%', category: MOPRO, days: 2, expected: 'ok', short: 'OK' },
  { name: 'Frischmilch Hof 3,8%', category: MOPRO, days: 1, expected: 'rabatt10', short: '10%' },
  { name: 'Frischmilch Hof 3,8%', category: MOPRO, days: 0, expected: 'rabatt20', short: '20%' },
  { name: 'Frischmilch Hof 3,8%', category: MOPRO, days: -1, expected: 'tonne', short: 'Abschreiben' },
  { name: 'b*Vollmilch Demeter 3,8% Flasche', category: MOPRO, days: 1, expected: 'rabatt10', short: '10%' },
  { name: 'H-Milch 3,5%', category: MOPRO, days: 3, expected: 'ok', short: 'OK' },
  { name: 'H-Milch 3,5%', category: MOPRO, days: 2, expected: 'rabatt10', short: '10%' },
  { name: 'H-Milch 3,5%', category: MOPRO, days: 1, expected: 'rabatt20', short: '20%' },
  { name: 'H-Milch 3,5%', category: MOPRO, days: 0, expected: 'rabatt50', short: '50%' },
  { name: 'Pasteurisierte Milch 1,5%', category: MOPRO, days: 2, expected: 'rabatt10', short: '10%' },
  { name: 'b*Joghurt mild 1,8%', category: MOPRO, days: 2, expected: 'rabatt10', short: '10%' },
  { name: 'b*Joghurt mild 1,8%', category: MOPRO, days: 1, expected: 'rabatt20', short: '20%' },
  { name: 'b*Joghurt mild 1,8%', category: MOPRO, days: 0, expected: 'rabatt50', short: '50%' },
  { name: 'Ital. Mortadella', category: KUEHL, days: 7, expected: 'ok', short: 'OK' },
  { name: 'Ital. Mortadella', category: KUEHL, days: 2, expected: 'rabatt10', short: '10%' },
  { name: 'Ital. Mortadella', category: KUEHL, days: 1, expected: 'rabatt20', short: '20%' },
  { name: 'Ital. Mortadella', category: KUEHL, days: 0, expected: 'rabatt50', short: '50%' },
  { name: 'Salat Mix', category: FRISCHE, days: 2, expected: 'pruefen', short: 'Prüfen' },
  { name: 'Salat Mix', category: FRISCHE, days: 1, expected: 'rabatt30', short: '30%' },
  { name: 'Salat Mix', category: FRISCHE, days: 0, expected: 'rabatt50', short: '50%' },
  { name: 'TK Beeren', category: TK, days: 14, expected: 'pruefen', short: 'Prüfen' },
  { name: 'TK Beeren', category: TK, days: 7, expected: 'rabatt30', short: '30%' },
  { name: 'Dinkel Spätzle', category: TROCKEN, days: 15, expected: 'pruefen', short: '20%' },
  { name: 'Dinkel Spätzle', category: TROCKEN, days: 2, expected: 'rabatt30', short: '30%' },
  { name: 'Dinkel Spätzle', category: TROCKEN, days: 1, expected: 'rabatt50', short: '50%' },
];

for (const item of discountCases) {
  const actualKey = key(item.category, item.days, item.name);
  const actualLabel = label(item.category, item.days, item.name);
  assert.equal(actualKey, item.expected, `${item.name} @ ${item.days}d: key ${actualKey} != ${item.expected}`);
  assert.equal(actualLabel, item.short, `${item.name} @ ${item.days}d: label ${actualLabel} != ${item.short}`);
}

assert.equal(mapMhdActionKeyToStatus('rabatt10'), 'critical');
assert.equal(mapMhdActionKeyToStatus('rabatt20'), 'critical');
assert.equal(mapMhdActionKeyToStatus('rabatt50'), 'critical');
assert.equal(mapMhdActionKeyToStatus('ok'), 'ok');
assert.equal(mapMhdActionKeyToStatus('tonne'), 'expired');

console.log(`MHD-Rabattcheck: ${frischmilchCases.length + discountCases.length} Fälle bestanden.`);
