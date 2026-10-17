/**
 * Headless smoke for Avery practice catalog + Freifeld.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const BASE = process.env.AVERY_SMOKE_BASE || 'http://127.0.0.1:4173';
const artifactDir = '/opt/cursor/artifacts';
await mkdir(artifactDir, { recursive: true });

const demoHtml = `<!DOCTYPE html>
<html lang="de"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/style.css">
<link rel="stylesheet" href="/avery-labels.css">
<title>Avery Labels Smoke</title>
</head><body>
<div id="page-avery" class="page active"></div>
<script type="module">
  import { initAveryLabelsModule, printAveryLabelsSheet } from '/avery-labels.js';
  window.print = () => { window.__printed = true; };
  window.showToast = (msg, type) => { window.__toast = { msg, type }; };
  window.BRANDING = { betriebsName: 'StevesHof Hofladen' };
  initAveryLabelsModule();
  window.__print = printAveryLabelsSheet;
</script>
</body></html>`;

await writeFile(path.join(root, 'dist/avery-labels-smoke.html'), demoHtml);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 1100 } });
await page.goto(`${BASE}/avery-labels-smoke.html`, { waitUntil: 'networkidle' });
await page.waitForSelector('#avery-sheet-preview');

await page.fill('#avery-ohrmarke', 'DE123456');
await page.click('[data-avery-tab="schultern"]');
await page.click('[data-avery-add="sch-brust"]');
await page.click('[data-avery-add="sch-nacken"]');
await page.click('[data-avery-tab="ruecken"]');
await page.click('[data-avery-add="rue-entrecote"]');
await page.fill('#avery-trim-tr-r2-hack', '2');
await page.fill('#avery-custom-name', 'Tomahawk-Steak');
await page.selectOption('#avery-custom-aging', '21');
await page.click('#btn-avery-custom-add');
await page.click('[data-avery-slot="3"]');
await page.waitForTimeout(200);

const stats = await page.evaluate(() => {
  const tabs = [...document.querySelectorAll('[data-avery-tab]')].map((el) => el.textContent.trim());
  const slots = [...document.querySelectorAll('#avery-sheet-preview .avery-slot')];
  return {
    tabs,
    lot: document.getElementById('avery-lot-preview')?.textContent || '',
    filled: slots.filter((el) => el.classList.contains('is-filled')).length,
    offset: slots.filter((el) => el.classList.contains('is-offset')).length,
    queueTotal: document.getElementById('avery-queue-total')?.textContent || '',
    hasFreifeld: Boolean(document.querySelector('.avery-queue-custom')),
    toast: window.__toast || null,
  };
});

if (!stats.tabs.includes('Schulter') || !stats.tabs.includes('Rücken')) {
  throw new Error(`Unexpected tabs: ${JSON.stringify(stats.tabs)}`);
}
if (stats.tabs.some((t) => /VV|HV/.test(t))) {
  throw new Error('Legacy VV/HV tabs still present');
}
if (!stats.lot.includes('DE123456')) throw new Error(`LOT missing ear tag: ${stats.lot}`);
if (stats.filled < 5) throw new Error(`Expected filled labels, got ${stats.filled}`);
if (stats.offset !== 2) throw new Error(`Expected 2 offset cells for start=3, got ${stats.offset}`);
if (!stats.hasFreifeld) throw new Error('Custom Freifeld row missing in queue');

await page.screenshot({ path: `${artifactDir}/avery-custom-cuts-suite.png`, fullPage: true });

const printed = await page.evaluate(() => {
  window.__printed = false;
  window.__print();
  return window.__printed;
});
if (!printed) throw new Error('printAveryLabelsSheet did not call window.print');

console.log(JSON.stringify({ ok: true, stats, printed }, null, 2));
await browser.close();
