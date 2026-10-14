#!/usr/bin/env node
/**
 * Isolierte Demo-Screenshots für Theken-Rezeptkarten (ohne Auth/App-Shell).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import {
  matchesThekeRecipe,
  renderThekeRecipeCardHtml,
  THEKE_QUICK_FILTERS,
} from '../web/rezepte.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = '/opt/cursor/artifacts';
mkdirSync(OUT, { recursive: true });

// Minimale Stichprobe aus der Masterliste (Namen/Allergene/Zutaten wie in production.js)
const demoRecipes = [
  {
    id: 'Gallo-Rizo-Patties',
    name: 'Burgerpatties Gallo-Rizo',
    kat: 'Patties',
    allergene: ['SULFITE'],
    haltbar: 'Gekühlt bei max. 4 °C halten',
    ingredients: [
      { name: 'RII (Rindfleisch mager)', typ: 'base' },
      { name: 'RIV (Rindfleisch fett/Abschnitte)', typ: 'base' },
      { name: 'Rotwein', typ: 'spice', allergen: true, hinweis: 'SULFITE' },
      { name: 'Meersalz fein', typ: 'spice' },
      { name: 'Paprika edelsüß', typ: 'spice' },
      { name: 'Pfeffer weiß gemahlen', typ: 'spice' },
      { name: 'Koriander', typ: 'spice' },
    ],
  },
  {
    id: 'G-BW',
    name: 'Frische Bratwurst vom Galloway',
    kat: 'Brühwurst fein',
    allergene: [],
    haltbar: 'Gebrüht vakuumiert bei max. 4 °C: 10–14 Tage',
    ingredients: [
      { name: 'RII (Rindfleisch mager)', typ: 'base' },
      { name: 'Schweinespeck', typ: 'base' },
      { name: 'Meersalz', typ: 'spice' },
      { name: 'Pfeffer weiß', typ: 'spice' },
      { name: 'Muskat', typ: 'spice' },
      { name: 'Koriander', typ: 'spice' },
    ],
  },
  {
    id: 'LW',
    name: 'Leberwurst',
    kat: 'Kochwurst',
    allergene: ['SENF', 'SELLERIE'],
    haltbar: 'Gekühlt bei max. 4 °C haltbar',
    ingredients: [
      { name: 'Schweineleber', typ: 'base' },
      { name: 'Speck', typ: 'base' },
      { name: 'Senfkörner', typ: 'spice', allergen: true },
      { name: 'Sellerie', typ: 'spice', allergen: true },
      { name: 'Marjoran', typ: 'spice' },
    ],
  },
  {
    id: 'Schinken',
    name: 'Galloway Nuss-Schinken',
    kat: 'Schinken',
    allergene: ['SENF'],
    haltbar: 'Lagerung im Kühlraum bei max. +4°C',
    ingredients: [
      { name: 'Nuss vom Galloway', typ: 'base' },
      { name: 'Nitritpökelsalz', typ: 'spice' },
      { name: 'Senfmehl', typ: 'spice', allergen: true },
      { name: 'Pfeffer', typ: 'spice' },
    ],
  },
];

function renderPage(query = '', quickId = '') {
  const quick = THEKE_QUICK_FILTERS.find((entry) => entry.id === quickId) || null;
  const visible = demoRecipes.filter((recipe) => matchesThekeRecipe(recipe, query, quick));
  const chips = THEKE_QUICK_FILTERS.map((entry) => `
    <button type="button" class="recipe-quick-chip${entry.id === quickId ? ' active-category' : ''}">${entry.label}</button>
  `).join('');
  return `<!doctype html>
<html lang="de"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/style.css?v=20261014-soldout-and-slaughter-v1">
<style>
  body { margin: 0; background: #1c130e; color: #f5f1ea; }
  .demo-shell { padding: 16px 14px 28px; max-width: 430px; margin: 0 auto; }
</style>
</head><body data-theme="dark">
  <div class="demo-shell page active kitchen-theke-mode" id="page-kitchen">
    <section class="theke-recipes-intro">
      <p class="theke-recipes-kicker">Theken-Auskunft</p>
      <h2 class="theke-recipes-title">Rezepturen nachschlagen</h2>
      <p class="theke-recipes-lead">Zutaten, Gewürze, Allergene und Haltbarkeit blitzschnell für Kundenfragen finden.</p>
    </section>
    <div class="recipe-toolbar theke-recipe-toolbar">
      <div class="recipe-search-panel">
        <input class="input-text-touch recipe-search-input" value="${query}" placeholder="Rezept oder Zutat suchen..." readonly>
        ${query || quickId ? '<button class="recipe-search-clear" style="display:inline-flex">×</button>' : ''}
      </div>
      <div class="recipe-quick-filter">${chips}</div>
    </div>
    <div class="recipe-list">${visible.map((recipe) => renderThekeRecipeCardHtml(recipe)).join('')}</div>
    <div class="kitchen-production-mode-bar" style="display:block">
      <button class="btn btn-secondary kitchen-production-mode-toggle">Produktions-Modus einblenden</button>
    </div>
  </div>
</body></html>`;
}

const fixturePath = path.join(OUT, 'recipes-theke-demo.html');
writeFileSync(fixturePath, renderPage(), 'utf8');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();

async function capture(name, query, quickId) {
  const html = renderPage(query, quickId);
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  // style.css vom lokalen Server nachladen
  await page.addStyleTag({ url: 'http://127.0.0.1:5173/style.css?v=20261014-soldout-and-slaughter-v1' });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, name), fullPage: true });
}

await capture('recipes-theke-mobile-overview.png', '', '');
await capture('recipes-theke-mobile-search-koriander.png', 'Koriander', '');
await capture('recipes-theke-mobile-allergenfrei.png', '', 'allergenfrei');
await capture('recipes-theke-mobile-production-mode.png', '', '');

await browser.close();
console.log('OK capture-recipes-theke-demo: Demo-Screenshots geschrieben.');
