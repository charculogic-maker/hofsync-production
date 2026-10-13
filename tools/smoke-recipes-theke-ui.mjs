#!/usr/bin/env node
/**
 * UI-Smoke: Theken-Rezeptkarten auf Smartphone-Viewport (ohne Firebase-Login).
 */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = process.env.APP_URL || 'http://127.0.0.1:5173/index.html?v=recipes-theke-ui';
const OUT = '/opt/cursor/artifacts';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
page.setDefaultTimeout(20000);

await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

await page.evaluate(() => {
  document.body.classList.add('app-ready');
  document.querySelectorAll(
    '#login-overlay, #auth-gate, .login-overlay, .auth-overlay, #login-screen, .modal-backdrop, .sheet-backdrop',
  ).forEach((el) => {
    el.remove();
  });
  document.body.classList.remove('login-open', 'auth-required');
  document.querySelectorAll('.page').forEach((el) => {
    el.classList.remove('active');
    el.style.display = 'none';
  });
  const kitchen = document.getElementById('page-kitchen');
  if (kitchen) {
    kitchen.hidden = false;
    kitchen.classList.add('active');
    kitchen.style.display = 'block';
  }
  const main = document.querySelector('main, .app-main, .content-area, #app-content');
  if (main) main.style.visibility = 'visible';
  document.getElementById('tab-kitchen')?.classList.add('active');
});

async function shotKitchen(filename) {
  // Login-Overlay kann asynchron wieder erscheinen — vor jedem Shot entfernen.
  await page.evaluate(() => {
    document.querySelectorAll('#login-overlay, #auth-gate, .login-overlay, .auth-overlay').forEach((el) => el.remove());
    const kitchen = document.getElementById('page-kitchen');
    if (kitchen) {
      kitchen.hidden = false;
      kitchen.classList.add('active');
      kitchen.style.display = 'block';
    }
  });
  const kitchen = page.locator('#page-kitchen');
  await kitchen.screenshot({ path: path.join(OUT, filename) });
}

const ensureThekeBranding = () => page.evaluate(() => {
  const modules = Object.assign({}, window.BRANDING?.modules || {}, {
    kitchen: true,
    bratwurstMasterlist: true,
  });
  const branding = Object.assign({}, window.BRANDING || {}, {
    tenantId: 'StevesHof_Hauptbetrieb',
  });
  Object.defineProperty(branding, 'modules', {
    configurable: true,
    enumerable: true,
    get() { return modules; },
    set(next) {
      Object.assign(modules, next || {});
      modules.kitchen = true;
      modules.bratwurstMasterlist = true;
    },
  });
  try {
    Object.defineProperty(window, 'BRANDING', {
      configurable: true,
      enumerable: true,
      get() { return branding; },
      set(next) {
        Object.assign(branding, next || {});
        Object.assign(modules, next?.modules || {});
        modules.kitchen = true;
        modules.bratwurstMasterlist = true;
      },
    });
  } catch (_) {
    window.BRANDING = branding;
  }
});

await ensureThekeBranding();

const boot = await page.evaluate(async () => {
  try {
    // Gleiche Modul-Instanz wie app.js — sonst hängen Input-Listener am falschen State.
    const mod = await import('/production.js');
    window.__productionMod = mod;
    // Events neu binden dürfen (falls App schon initialisiert hat)
    const searchInput = document.getElementById('recipe-search-input');
    const clearBtn = document.getElementById('recipe-search-clear');
    const quickFilter = document.getElementById('recipe-quick-filter');
    const toggle = document.getElementById('btn-kitchen-production-mode');
    if (searchInput) delete searchInput.dataset.eventsBound;
    if (clearBtn) delete clearBtn.dataset.eventsBound;
    if (quickFilter) delete quickFilter.dataset.eventsBound;
    if (toggle) delete toggle.dataset.eventsBound;
    mod.activateKitchenTab();
    mod.renderRecipes();
    const count = document.querySelectorAll(
      '#recipe-list-container .recipe-card, #recipe-list-container .recipe-card--theke',
    ).length;
    return {
      ok: count > 0,
      count,
      thekeMode: document.getElementById('page-kitchen')?.classList.contains('kitchen-theke-mode') === true,
      error: null,
    };
  } catch (error) {
    return { ok: false, count: 0, thekeMode: false, error: String(error?.stack || error) };
  }
});

assert.equal(boot.error, null, `Kitchen boot failed: ${boot.error}`);
assert.ok(boot.ok, 'Rezeptkarten gerendert');
assert.ok(boot.thekeMode, 'kitchen-theke-mode aktiv');
assert.equal(boot.count, 40, '40 Rezepte erwartet');

await page.waitForSelector('#recipe-search-input', { state: 'visible' });
await page.waitForSelector('.recipe-card--theke', { state: 'visible' });

const searchPlaceholder = await page.getAttribute('#recipe-search-input', 'placeholder');
assert.match(searchPlaceholder || '', /Rezept oder Zutat suchen/);

const chipsVisible = await page.locator('.recipe-quick-chip').count();
assert.equal(chipsVisible, 4, 'Vier Schnellfilter-Chips erwartet');

const wrsHidden = await page.evaluate(() => {
  const panel = document.getElementById('kitchen-wrs-panel');
  if (!panel) return true;
  return window.getComputedStyle(panel).display === 'none';
});
assert.ok(wrsHidden, 'WRS/Produktion standardmäßig ausgeblendet auf Mobile');

await shotKitchen('recipes-theke-mobile-overview.png');

await ensureThekeBranding();
const afterSearch = await page.evaluate(() => {
  const input = document.getElementById('recipe-search-input');
  input.value = 'Koriander';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return document.querySelectorAll('.recipe-card--theke').length;
});
assert.ok(afterSearch > 0, 'Suche nach Koriander liefert Treffer');
const searchHitText = await page.locator('.recipe-card--theke').first().innerText();
assert.match(searchHitText, /Koriander/i);

await shotKitchen('recipes-theke-mobile-search-koriander.png');

const afterClear = await page.evaluate(() => {
  document.getElementById('recipe-search-clear')?.click();
  return {
    count: document.querySelectorAll('.recipe-card--theke').length,
    value: document.getElementById('recipe-search-input')?.value || '',
  };
});
assert.equal(afterClear.count, 40, 'Nach ✕ wieder vollständige Übersicht');
assert.equal(afterClear.value, '', 'Suchfeld nach Clear leer');

const allergenResult = await page.evaluate(() => {
  document.querySelector('.recipe-quick-chip[data-recipe-quick="allergenfrei"]')?.click();
  return {
    cards: document.querySelectorAll('.recipe-card--theke').length,
    freeBadge: document.querySelectorAll('.recipe-allergen-badge--free').length,
  };
});
assert.ok(allergenResult.cards > 0, 'Allergenfrei-Chip liefert Karten');
assert.ok(allergenResult.freeBadge > 0, 'Frei-von-Allergenen-Badge sichtbar');
const allergenFreeCards = allergenResult.cards;
const freeBadge = allergenResult.freeBadge;

await shotKitchen('recipes-theke-mobile-allergenfrei.png');

await page.evaluate(() => document.getElementById('btn-kitchen-production-mode')?.click());
await page.waitForTimeout(80);
const modeLabel = await page.textContent('#btn-kitchen-production-mode');
assert.match(modeLabel || '', /ausblenden/i);
const wrsVisible = await page.evaluate(() => {
  const panel = document.getElementById('kitchen-wrs-panel');
  if (!panel) return false;
  return window.getComputedStyle(panel).display !== 'none';
});
assert.ok(wrsVisible, 'Produktions-Modus blendet WRS wieder ein');

await shotKitchen('recipes-theke-mobile-production-mode.png');

console.log(JSON.stringify({
  ok: true,
  boot,
  afterSearch,
  afterClear,
  allergenFreeCards,
  freeBadge,
  screenshots: [
    'recipes-theke-mobile-overview.png',
    'recipes-theke-mobile-search-koriander.png',
    'recipes-theke-mobile-allergenfrei.png',
    'recipes-theke-mobile-production-mode.png',
  ],
}, null, 2));

await browser.close();
console.log('OK smoke-recipes-theke-ui: Mobile Theken-Auskunft UI geprüft.');
