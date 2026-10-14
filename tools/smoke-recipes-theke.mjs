#!/usr/bin/env node
/**
 * Smoke: Theken-Rezeptur-Nachschlagewerk (Prod. Tab mobil).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  THEKE_QUICK_FILTERS,
  matchesThekeRecipe,
  normalizeThekeQuery,
  recipeSearchHaystack,
  renderThekeRecipeCardHtml,
  isAllergenFreeRecipe,
} from '../web/rezepte.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

const indexHtml = read('web/index.html');
const styleCss = read('web/style.css');
const productionSrc = read('web/production.js');
const rezepteSrc = read('web/rezepte.js');
const swSrc = read('web/sw.js');
const appSrc = read('web/app.js');

assert.match(indexHtml, /Rezept oder Zutat suchen/, 'Suchfeld-Placeholder Theken-Auskunft');
assert.match(indexHtml, /id="recipe-search-clear"/, 'Suche-Löschen-Button vorhanden');
assert.match(indexHtml, /id="recipe-quick-filter"/, 'Schnellfilter-Leiste vorhanden');
assert.match(indexHtml, /data-recipe-quick="galloway"/, 'Chip Galloway Rind');
assert.match(indexHtml, /data-recipe-quick="bratwurst"/, 'Chip Bratwurst');
assert.match(indexHtml, /data-recipe-quick="schinken"/, 'Chip Schinken');
assert.match(indexHtml, /data-recipe-quick="allergenfrei"/, 'Chip Allergenfrei');
assert.match(indexHtml, /id="btn-kitchen-production-mode"/, 'Produktions-Modus-Toggle');
assert.match(indexHtml, /Produktions-Modus einblenden/, 'Toggle-Wording Laden-tauglich');
assert.match(indexHtml, /style\.css\?v=20261014-recipe-audit-v1/, 'style.css Cache-Buster recipe-audit');

assert.match(productionSrc, /from '\.\/rezepte\.js'/, 'production.js nutzt rezepte.js');
assert.match(productionSrc, /renderThekeRecipeCardHtml/, 'Theken-Karten-Renderer verdrahtet');
assert.match(productionSrc, /clearRecipeSearch/, 'Sofort-Reset der Suche');
assert.match(productionSrc, /syncKitchenProductionModeUi/, 'Produktions-Modus Sync');
assert.match(productionSrc, /kitchen-theke-mode/, 'Theken-Modus CSS-Klasse');

assert.match(rezepteSrc, /THEKE_QUICK_FILTERS/, 'Schnellfilter-Konstante');
assert.match(rezepteSrc, /matchesThekeRecipe/, 'Volltext-Match-Helfer');
assert.match(rezepteSrc, /Frei von Allergenen/, 'Allergenfrei-Badge Text');

assert.match(
  styleCss,
  /@media \(max-width:\s*768px\)[\s\S]*?\.kitchen-production-zone[\s\S]*?display:\s*none\s*!important/,
  'CSS blendet Produktions-Zone unter 768px aus',
);
assert.match(styleCss, /\.recipe-card--theke/, 'Theken-Karten-Styles');
assert.match(styleCss, /\.recipe-allergen-badge/, 'Allergen-Badge-Styles');
assert.match(styleCss, /\.recipe-haltbar-hint/, 'Haltbarkeits-Hinweis-Styles');

assert.match(
  swSrc,
  /CACHE_NAME = 'charculogic-v20261014-recipe-audit-v1'/,
  'SW Cache-Version recipe-audit-v1',
);
assert.match(swSrc, /'\/rezepte\.js'/, 'rezepte.js im SW-Cache');
assert.match(appSrc, /APP_RELEASE_AT = '2026-10-14T05:10:00\+02:00'/, 'App Release-Zeitstempel');
assert.doesNotMatch(styleCss, /â–[¾¸¼]/, 'Keine Encoding-Hieroglyphen in CSS-Chevrons');
assert.match(styleCss, /\.kitchen-collapsible > summary::after[\s\S]*?border-right:\s*2px solid/, 'CSS-Chevron für Rezepte-Collapsible');
assert.match(indexHtml, /recipe-filter-button-icon chevron-down/, 'Filter-Icon nutzt CSS-Chevron');
assert.match(productionSrc, /bratwurstRecipes/, 'production.js importiert zentrale Rezeptliste');
assert.match(rezepteSrc, /"id": "G-LW"[\s\S]*?"basis_g": "20\.000,00"/, 'G-LW Charge-Basis 20 kg');
assert.match(rezepteSrc, /"id": "G-LW"[\s\S]*?Warmemulsion Fertigbraettemperatur 42/, 'G-LW Warmemulsion SOP');
assert.match(rezepteSrc, /"id": "G-LW"[\s\S]*?Leitsatz 2\.232/, 'G-LW Leitsatz 2.232');
assert.match(rezepteSrc, /"id": "G-LW"[\s\S]*?"auditStatus": "verified"/, 'G-LW auditStatus verified');
assert.match(rezepteSrc, /export const bratwurstRecipes/, 'Zentrale bratwurstRecipes in rezepte.js');

const sampleRecipes = [
  {
    id: 'G-BW',
    name: 'Frische Bratwurst vom Galloway',
    kat: 'Brühwurst fein',
    allergene: [],
    haltbar: 'Gekühlt bei max. 4 °C haltbar',
    ingredients: [
      { name: 'RII (Rindfleisch mager)', typ: 'base', allergen: false },
      { name: 'Koriander', typ: 'spice', allergen: false },
      { name: 'Pfeffer weiß', typ: 'spice', allergen: false },
    ],
  },
  {
    id: 'LW',
    name: 'Leberwurst',
    kat: 'Kochwurst',
    allergene: ['SENF', 'SELLERIE'],
    haltbar: 'Gekühlt lagern',
    ingredients: [
      { name: 'Leber', typ: 'base', allergen: false },
      { name: 'Senfkörner', typ: 'spice', allergen: true, hinweis: 'SENF' },
    ],
  },
];

assert.equal(THEKE_QUICK_FILTERS.length, 4, 'Vier Schnellfilter');
assert.ok(recipeSearchHaystack(sampleRecipes[0]).includes('koriander'), 'Suche findet Gewürz');
assert.ok(matchesThekeRecipe(sampleRecipes[0], 'koriander'), 'Volltext Koriander');
assert.ok(matchesThekeRecipe(sampleRecipes[1], 'senf'), 'Volltext Senf/Allergen');
assert.ok(isAllergenFreeRecipe(sampleRecipes[0]), 'Galloway ohne Allergene');
assert.equal(isAllergenFreeRecipe(sampleRecipes[1]), false, 'Leberwurst hat Allergene');
assert.ok(
  matchesThekeRecipe(sampleRecipes[0], '', { id: 'allergenfrei', allergenFree: true }),
  'Allergenfrei-Filter lässt freie Rezepte durch',
);
assert.equal(
  matchesThekeRecipe(sampleRecipes[1], '', { id: 'allergenfrei', allergenFree: true }),
  false,
  'Allergenfrei-Filter blockiert Allergene',
);

const cardHtml = renderThekeRecipeCardHtml(sampleRecipes[0]);
assert.match(cardHtml, /Frische Bratwurst vom Galloway/);
assert.match(cardHtml, /Frei von Allergenen/);
assert.match(cardHtml, /Koriander/);
assert.match(cardHtml, /Gekühlt bei max\. 4 °C haltbar/);

const many = Array.from({ length: 40 }, (_, index) => ({
  ...sampleRecipes[index % 2],
  id: `R-${index}`,
  name: `${sampleRecipes[index % 2].name} ${index}`,
}));
const started = performance.now();
const filtered = many.filter((recipe) => matchesThekeRecipe(recipe, 'koriander'));
const elapsed = performance.now() - started;
assert.ok(filtered.length > 0, 'Filter liefert Treffer');
assert.ok(elapsed < 50, `Volltextfilter unter 50ms (war ${elapsed.toFixed(2)}ms)`);
assert.equal(normalizeThekeQuery('KoriAnder'), 'koriander');

console.log('OK smoke-recipes-theke: Theken-Auskunft Verträge und <50ms Filter erfüllt.');
