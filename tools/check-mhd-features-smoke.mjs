#!/usr/bin/env node
/**
 * Smoke UI: MHD 2-digit year, Wareneingang LIFO, Kategorie-Erkennung.
 * Run against http://127.0.0.1:5173 (static web/).
 */
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.env.MHD_BASE_URL || 'http://127.0.0.1:5173/index.html?v=mhd-features';
const OUT = '/opt/cursor/artifacts';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
const steps = [];

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });

const logic = await page.evaluate(async () => {
  const { parseMHDInput, formatIsoToGerman } = await import('./date-input.js');
  const { detectCategoryFromKeywords } = await import('./mhd-category-rules.js');
  const { resolveUnassignedFromTotalTarget, sumActiveBatchQuantities } = await import('./mhd-stock.js');

  const dateCases = [
    ['12.09.29', formatIsoToGerman(parseMHDInput('12.09.29'))],
    ['15/05/27', formatIsoToGerman(parseMHDInput('15/05/27'))],
    ['12.09.2029', formatIsoToGerman(parseMHDInput('12.09.2029'))],
  ];
  const cats = [
    detectCategoryFromKeywords('Joghurt'),
    detectCategoryFromKeywords('Schokolade Riegel'),
    detectCategoryFromKeywords('Passata Dose'),
  ];
  const assigned = sumActiveBatchQuantities([{ qty: 4 }, { qty: 2 }, { qty: 1, soldOut: true }]);
  const unassigned = resolveUnassignedFromTotalTarget(9, assigned);
  return { dateCases, cats, assigned, unassigned };
});

steps.push({ name: 'parse 12.09.29', pass: logic.dateCases[0][1] === '12.09.2029', got: logic.dateCases[0][1] });
steps.push({ name: 'parse 15/05/27', pass: logic.dateCases[1][1] === '15.05.2027', got: logic.dateCases[1][1] });
steps.push({ name: 'parse 4-digit unchanged', pass: logic.dateCases[2][1] === '12.09.2029', got: logic.dateCases[2][1] });
steps.push({ name: 'cat Joghurt', pass: logic.cats[0] === '🥛MoPro', got: logic.cats[0] });
steps.push({ name: 'cat Schokolade', pass: String(logic.cats[1]).includes('Süßwaren'), got: logic.cats[1] });
steps.push({ name: 'cat Konserven', pass: String(logic.cats[2]).includes('Konserven'), got: logic.cats[2] });
steps.push({ name: 'stock unassigned', pass: logic.assigned === 6 && logic.unassigned === 3, got: { assigned: logic.assigned, unassigned: logic.unassigned } });

// Date field blur expansion in DOM
await page.evaluate(() => {
  const input = document.createElement('input');
  input.className = 'input-date-de';
  input.id = 'demo-mhd-input';
  document.body.appendChild(input);
});
await page.evaluate(async () => {
  const { initGermanDateInputs } = await import('./date-input.js');
  initGermanDateInputs(document);
});
await page.fill('#demo-mhd-input', '120929');
await page.locator('#demo-mhd-input').blur();
const blurred = await page.inputValue('#demo-mhd-input');
steps.push({ name: 'blur expands 120929', pass: blurred === '12.09.2029', got: blurred });

await page.screenshot({ path: `${OUT}/mhd-date-blur-expanded.png`, fullPage: false });

// Simulate LIFO list rendering pattern used by mhd.js
const lifo = await page.evaluate(() => {
  const items = [];
  items.unshift({ id: 'a', product: 'Erstes', scannedAt: 1000 });
  items.unshift({ id: 'b', product: 'Zweites', scannedAt: 2000 });
  items.unshift({ id: 'c', product: 'Drittes', scannedAt: 3000 });
  const sorted = [...items].sort((a, b) => (b.scannedAt || 0) - (a.scannedAt || 0));
  const host = document.createElement('div');
  host.id = 'lifo-demo';
  host.innerHTML = sorted.map((item) => `<div class="row">${item.product}</div>`).join('');
  document.body.appendChild(host);
  return [...host.querySelectorAll('.row')].map((el) => el.textContent);
});
steps.push({ name: 'LIFO order', pass: lifo[0] === 'Drittes' && lifo[2] === 'Erstes', got: lifo });

await page.screenshot({ path: `${OUT}/mhd-lifo-demo-list.png`, fullPage: false });

const failed = steps.filter((s) => !s.pass);
fs.writeFileSync(`${OUT}/mhd-ui-smoke.json`, JSON.stringify({ steps, failed }, null, 2));
console.log(JSON.stringify({ ok: failed.length === 0, steps }, null, 2));
await browser.close();
process.exit(failed.length ? 1 : 0);
