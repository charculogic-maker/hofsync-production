/**
 * Headless smoke: Avery 3475 DOM generation + offset via local static server.
 * Expects `python3 -m http.server 4173 --directory dist` (or AVERY_SMOKE_BASE).
 * Copies tools/avery-3475-demo.html into dist/ for the run.
 */
import { chromium } from 'playwright';
import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const BASE = process.env.AVERY_SMOKE_BASE || 'http://127.0.0.1:4173';
const artifactDir = '/opt/cursor/artifacts';
await mkdir(artifactDir, { recursive: true });
await copyFile(
  path.join(root, 'tools/avery-3475-demo.html'),
  path.join(root, 'dist/avery-3475-demo.html'),
);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 980 } });

let printCalled = 0;
await page.exposeFunction('__averyPrintHook', () => {
  printCalled += 1;
});

await page.goto(`${BASE}/avery-3475-demo.html`, { waitUntil: 'networkidle' });
await page.waitForSelector('#avery-print-card');

// Demo auto-prints once; capture UI + sheet preview
await page.waitForFunction(() => {
  const root = document.getElementById('print-avery-container');
  return root && root.querySelectorAll('.avery-label').length > 0;
});

const autoStats = await page.evaluate(() => {
  const root = document.getElementById('print-avery-container');
  const labels = [...root.querySelectorAll('.avery-label')];
  return {
    total: labels.length,
    empty: labels.filter((el) => el.classList.contains('empty')).length,
    filled: labels.filter((el) => !el.classList.contains('empty')).length,
    text: labels.find((el) => !el.classList.contains('empty'))?.innerText || '',
    status: document.getElementById('demo-status')?.textContent || '',
  };
});

if (autoStats.empty !== 4 || autoStats.filled !== 3) {
  throw new Error(`Auto preview plan wrong: ${JSON.stringify(autoStats)}`);
}

await page.screenshot({ path: `${artifactDir}/avery-demo-form-and-sheet.png`, fullPage: true });

// Re-bind print hook and exercise API path via button
await page.evaluate(() => {
  window.print = () => { window.__averyPrintHook(); };
});
await page.fill('#avery-label-count', '2');
await page.fill('#avery-start-position', '1');
await page.click('#btn-avery-print');
await page.waitForTimeout(200);

const buttonStats = await page.evaluate(() => {
  const root = document.getElementById('print-avery-container');
  const labels = [...root.querySelectorAll('.avery-label')];
  return {
    total: labels.length,
    empty: labels.filter((el) => el.classList.contains('empty')).length,
    filled: labels.filter((el) => !el.classList.contains('empty')).length,
  };
});
if (buttonStats.empty !== 0 || buttonStats.filled !== 2 || printCalled < 1) {
  throw new Error(`Button path failed: ${JSON.stringify({ buttonStats, printCalled })}`);
}

await page.fill('#avery-start-position', '22');
await page.fill('#avery-label-count', '5');
await page.click('#btn-avery-print');
const toast = await page.evaluate(() => document.getElementById('demo-status')?.textContent || '');
if (!toast.includes('passen nur noch')) {
  throw new Error(`Expected overflow toast, got: ${toast}`);
}

console.log(JSON.stringify({ ok: true, autoStats, buttonStats, printCalled, toast }, null, 2));
await browser.close();
