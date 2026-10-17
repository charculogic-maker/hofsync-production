#!/usr/bin/env node
/**
 * UI-Smoke: Theken-Auskunft im Wissen-Tab (ohne Firebase-Login).
 */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = process.env.APP_URL || 'http://127.0.0.1:5173/index.html?v=counter-recipes-ui';
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

const unlockKnowledge = () => page.evaluate(() => {
  document.body.classList.add('app-ready');
  document.querySelectorAll(
    '#login-overlay, #auth-gate, #auth-lock-screen, .login-overlay, .auth-overlay, #login-screen, .modal-backdrop, .sheet-backdrop, .auth-lock-card',
  ).forEach((el) => el.remove());
  document.body.classList.remove('login-open', 'auth-required');
  document.querySelectorAll('.page').forEach((el) => {
    el.classList.remove('active');
    el.style.display = 'none';
  });
  const knowledge = document.getElementById('page-knowledge');
  if (knowledge) {
    knowledge.hidden = false;
    knowledge.classList.add('active');
    knowledge.style.display = 'block';
  }
});

await unlockKnowledge();

const boot = await page.evaluate(async () => {
  try {
    const mod = await import('/recipes-counter.js');
    window.__counterMod = mod;
    const search = document.getElementById('counter-recipes-search');
    const clear = document.getElementById('counter-recipes-clear');
    const filters = document.getElementById('counter-recipes-filters');
    if (search) delete search.dataset.eventsBound;
    if (clear) delete clear.dataset.eventsBound;
    if (filters) delete filters.dataset.eventsBound;
    mod.initCounterRecipesModule();
    const count = document.querySelectorAll('#counter-recipes-list .counter-recipe-card').length;
    return { ok: count > 0, count, error: null };
  } catch (error) {
    return { ok: false, count: 0, error: String(error?.stack || error) };
  }
});

assert.equal(boot.error, null, `Counter boot failed: ${boot.error}`);
assert.ok(boot.ok, 'Artikelkarten gerendert');
assert.ok(boot.count >= 5, `Mindestens 5 Fallback-Artikel erwartet (war ${boot.count})`);

await page.waitForSelector('#counter-recipes-search', { state: 'visible' });
await page.waitForSelector('.counter-recipe-card', { state: 'visible' });

const placeholder = await page.getAttribute('#counter-recipes-search', 'placeholder');
assert.match(placeholder || '', /Artikel oder Zutat suchen/);

const chips = await page.locator('.counter-quick-chip').count();
assert.equal(chips, 6, 'Sechs Schnellfilter-Chips erwartet');

await unlockKnowledge();
await page.locator('#page-knowledge').screenshot({ path: path.join(OUT, 'counter-recipes-overview.png') });

const afterSearch = await page.evaluate(() => {
  document.querySelectorAll('#auth-lock-screen, .auth-lock-card').forEach((el) => el.remove());
  const input = document.getElementById('counter-recipes-search');
  input.value = 'Senf';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return document.querySelectorAll('.counter-recipe-card').length;
});
assert.ok(afterSearch > 0, 'Suche nach Senf liefert Treffer');
await unlockKnowledge();
await page.locator('#page-knowledge').screenshot({ path: path.join(OUT, 'counter-recipes-search-senf.png') });

const glutenCards = await page.evaluate(() => {
  document.querySelectorAll('#auth-lock-screen, .auth-lock-card').forEach((el) => el.remove());
  document.getElementById('counter-recipes-clear')?.click();
  document.querySelector('.counter-quick-chip[data-counter-filter="glutenfrei"]')?.click();
  return document.querySelectorAll('.counter-recipe-card').length;
});
assert.ok(glutenCards > 0, 'Glutenfrei-Chip liefert Karten');
await unlockKnowledge();
await page.locator('#page-knowledge').screenshot({ path: path.join(OUT, 'counter-recipes-glutenfrei.png') });

const detailText = await page.evaluate(() => {
  document.querySelectorAll('#auth-lock-screen, .auth-lock-card').forEach((el) => el.remove());
  document.querySelector('.counter-recipe-card')?.click();
  return document.getElementById('counter-recipe-detail')?.innerText || '';
});
assert.ok(/Zutatenliste|Enthält|Frei von den 14/i.test(detailText), 'Detail zeigt Allergene/Zutaten');
await page.evaluate(() => {
  document.querySelectorAll('#auth-lock-screen, .auth-lock-card').forEach((el) => el.remove());
  const sheet = document.getElementById('counter-recipe-detail-sheet');
  if (sheet) {
    sheet.hidden = false;
    sheet.classList.remove('hidden', 'closed');
  }
});
await page.locator('#counter-recipe-detail-sheet').screenshot({ path: path.join(OUT, 'counter-recipes-detail.png') });

console.log(JSON.stringify({
  ok: true,
  boot,
  afterSearch,
  glutenCards,
  screenshots: [
    'counter-recipes-overview.png',
    'counter-recipes-search-senf.png',
    'counter-recipes-glutenfrei.png',
    'counter-recipes-detail.png',
  ],
}, null, 2));

await browser.close();
console.log('OK smoke-recipes-counter-ui: Theken-Auskunft UI geprüft.');
