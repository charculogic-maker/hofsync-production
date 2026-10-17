#!/usr/bin/env node
/**
 * Smoke: Theken-Auskunft (Allergene & Zutaten) im Wissen-Tab.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COUNTER_CACHE_KEY_BASE,
  COUNTER_QUICK_FILTERS,
  STEVESHOF_COUNTER_FALLBACK,
  filterCounterRecipes,
  getStevesHofFallbackCatalog,
  highlightAllergensInDeclaration,
  isCounterAllergenFree,
  matchesCounterRecipe,
  normalizeCounterQuery,
  readCachedCounterRecipes,
  renderCounterDetailHtml,
  renderCounterResultCardHtml,
  writeCachedCounterRecipes,
} from '../web/recipes-counter.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

const indexHtml = read('web/index.html');
const styleCss = read('web/style.css');
const appSrc = read('web/app.js');
const swSrc = read('web/sw.js');
const moduleSrc = read('web/recipes-counter.js');

assert.match(indexHtml, /id="counter-recipes-shell"/, 'Theken-Auskunft Shell im Wissen-Tab');
assert.match(indexHtml, /Artikel oder Zutat suchen/, 'Suchfeld-Placeholder');
assert.match(indexHtml, /data-counter-filter="glutenfrei"/, 'Chip Glutenfrei');
assert.match(indexHtml, /data-counter-filter="laktosefrei"/, 'Chip Laktosefrei');
assert.match(indexHtml, /data-counter-filter="rind"/, 'Chip Rind');
assert.match(indexHtml, /data-counter-filter="schwein"/, 'Chip Schwein');
assert.match(indexHtml, /data-counter-filter="feinkost"/, 'Chip Feinkost');
assert.match(indexHtml, /id="counter-recipe-detail-sheet"/, 'Detail-Slide-Over');

assert.match(appSrc, /from '\.\/recipes-counter\.js'/, 'app.js importiert recipes-counter');
assert.match(appSrc, /initCounterRecipesModule/, 'Init verdrahtet');
assert.match(appSrc, /activateCounterRecipesTab/, 'Activate verdrahtet');

assert.match(moduleSrc, /charculogic\.cachedCounterRecipes/, 'localStorage Cache-Key');
assert.match(moduleSrc, /STEVESHOF_COUNTER_FALLBACK/, 'StevesHof Fallback');
assert.match(moduleSrc, /Frei von den 14 Hauptallergenen/, 'Allergenfrei-Hinweis');

assert.match(styleCss, /\.counter-recipe-card/, 'Listen-Karten Styles');
assert.match(styleCss, /\.counter-allergen-box/, 'Allergen-Box Styles');
assert.match(styleCss, /\.counter-allergen-mark/, 'LMIV Hervorhebung');

assert.match(swSrc, /CACHE_NAME = 'charculogic-v20261016-counter-recipes-v1'/);
assert.match(swSrc, /'\/recipes-counter\.js'/, 'recipes-counter.js im SW-Cache');

assert.equal(COUNTER_QUICK_FILTERS.length, 6, 'Sechs Schnellfilter inkl. Alle');
assert.equal(COUNTER_CACHE_KEY_BASE, 'charculogic.cachedCounterRecipes');
assert.ok(STEVESHOF_COUNTER_FALLBACK.length >= 5, 'Mindestens 5 Fallback-Artikel');

const catalog = getStevesHofFallbackCatalog();
assert.ok(catalog.some((item) => /Leberwurst/i.test(item.name)));
assert.ok(catalog.some((item) => /Blutwurst/i.test(item.name)));
assert.ok(catalog.some((item) => /Fleischsalat/i.test(item.name)));
assert.ok(catalog.some((item) => /Bratwurst/i.test(item.name)));
assert.ok(catalog.some((item) => /Salami/i.test(item.name)));

const leberwurst = catalog.find((item) => /Leberwurst/i.test(item.name));
assert.ok(leberwurst);
assert.equal(isCounterAllergenFree(leberwurst), false);
assert.ok(matchesCounterRecipe(leberwurst, 'senf'));
assert.ok(matchesCounterRecipe(leberwurst, '', 'rind'));

const bratwurst = catalog.find((item) => /Galloway-Bratwurst/i.test(item.name));
assert.ok(isCounterAllergenFree(bratwurst));
assert.ok(matchesCounterRecipe(bratwurst, '', 'glutenfrei'));
assert.ok(matchesCounterRecipe(bratwurst, '', 'laktosefrei'));

const feinkost = filterCounterRecipes(catalog, '', 'feinkost');
assert.ok(feinkost.length >= 1);
assert.ok(feinkost.every((item) => item.tags.includes('feinkost')));

const cardHtml = renderCounterResultCardHtml(leberwurst);
assert.match(cardHtml, /Hausmacher Leberwurst/);
assert.match(cardHtml, /SENF|SELLERIE/);

const detailHtml = renderCounterDetailHtml(bratwurst);
assert.match(detailHtml, /Frei von den 14 Hauptallergenen/);
assert.match(detailHtml, /Frische Bratwurst vom Galloway/);

const highlighted = highlightAllergensInDeclaration(
  'Schweinefleisch, Senf, Sellerie, Salz',
  ['SENF', 'SELLERIE'],
);
assert.match(highlighted, /<strong class="counter-allergen-mark"><u>Senf<\/u><\/strong>/i);
assert.match(highlighted, /<strong class="counter-allergen-mark"><u>Sellerie<\/u><\/strong>/i);

const memory = new Map();
const fakeStorage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => { memory.set(key, String(value)); },
};
assert.equal(writeCachedCounterRecipes('StevesHof_Hauptbetrieb', catalog, 'fallback', fakeStorage), true);
const cached = readCachedCounterRecipes('StevesHof_Hauptbetrieb', fakeStorage);
assert.ok(cached?.items?.length >= 5);
assert.ok(memory.has('charculogic.cachedCounterRecipes.steveshof_hauptbetrieb'));

assert.equal(normalizeCounterQuery('Sénf'), 'senf');

const many = Array.from({ length: 80 }, (_, index) => ({
  ...catalog[index % catalog.length],
  id: `C-${index}`,
  name: `${catalog[index % catalog.length].name} ${index}`,
}));
const started = performance.now();
const filtered = filterCounterRecipes(many, 'senf', 'all');
const elapsed = performance.now() - started;
assert.ok(filtered.length > 0);
assert.ok(elapsed < 50, `Filter unter 50ms (war ${elapsed.toFixed(2)}ms)`);

console.log('OK smoke-recipes-counter: Theken-Auskunft Verträge erfüllt.');
