/**
 * Headless smoke for Avery labels suite (no Firebase).
 * Serves dist/ and mounts page-avery shell + avery-labels.js.
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
const page = await browser.newPage({ viewport: { width: 430, height: 980 } });
await page.goto(`${BASE}/avery-labels-smoke.html`, { waitUntil: 'networkidle' });
await page.waitForSelector('#avery-sheet-preview');

await page.fill('#avery-ohrmarke', 'DE123456');
await page.click('[data-avery-preset="vv"]');
await page.click('[data-avery-slot="5"]');
await page.waitForTimeout(200);

const stats = await page.evaluate(() => {
  const slots = [...document.querySelectorAll('#avery-sheet-preview .avery-slot')];
  return {
    lot: document.getElementById('avery-lot-preview')?.textContent || '',
    filled: slots.filter((el) => el.classList.contains('is-filled')).length,
    offset: slots.filter((el) => el.classList.contains('is-offset')).length,
    queueTotal: document.getElementById('avery-queue-total')?.textContent || '',
    gauge: document.getElementById('avery-gauge-text')?.textContent || '',
  };
});

if (!stats.lot.includes('DE123456')) throw new Error(`LOT missing ear tag: ${stats.lot}`);
if (stats.filled !== 10) throw new Error(`Expected 10 filled from VV preset, got ${stats.filled}`);
if (stats.offset !== 4) throw new Error(`Expected 4 offset cells for start=5, got ${stats.offset}`);

await page.screenshot({ path: `${artifactDir}/avery-module-suite.png`, fullPage: true });

const printed = await page.evaluate(() => {
  window.__printed = false;
  window.__print();
  return window.__printed;
});
if (!printed) throw new Error('printAveryLabelsSheet did not call window.print');

console.log(JSON.stringify({ ok: true, stats, printed }, null, 2));
await browser.close();
