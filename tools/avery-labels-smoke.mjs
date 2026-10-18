/**
 * Headless smoke for Avery decluttered landscape labels + Freifeld.
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
const page = await browser.newPage({ viewport: { width: 390, height: 1100 } });
await page.goto(`${BASE}/avery-labels-smoke.html`, { waitUntil: 'networkidle' });
await page.waitForSelector('#avery-sheet-preview');

const defaults = await page.evaluate(() => ({
  printBetrieb: document.getElementById('avery-print-betrieb')?.checked,
  printSchlachthof: document.getElementById('avery-print-schlachthof')?.checked,
  hasReifeField: Boolean(document.getElementById('avery-reifehinweis')),
  bodyText: document.body.innerText,
}));
if (defaults.printBetrieb !== false || defaults.printSchlachthof !== false) {
  throw new Error(`Print toggles must default off: ${JSON.stringify(defaults)}`);
}
if (defaults.hasReifeField) throw new Error('Reifehinweis field must be removed');
if (/Trockenreifung|Reifebeutel/.test(defaults.bodyText)) {
  throw new Error('Trockenreifung/Reifebeutel text still present in UI');
}

await page.fill('#avery-ohrmarke', 'DE123456');
await page.click('[data-avery-tab="schultern"]');
await page.click('[data-avery-add="sch-brust"]');
await page.click('[data-avery-tab="ruecken"]');
await page.click('[data-avery-add="rue-entrecote"]');
await page.fill('#avery-trim-tr-r1-spiesse', '1');
await page.fill('#avery-trim-tr-r2-hack', '2');
await page.fill('#avery-custom-name', 'Rumpsteak');
await page.selectOption('#avery-custom-aging', '21');
await page.click('#btn-avery-custom-add');
await page.click('[data-avery-slot="3"]');
await page.waitForTimeout(200);

const stats = await page.evaluate(() => {
  const card = document.querySelector('.avery-slot.is-filled .label-card');
  const slot = document.querySelector('.avery-slot.is-filled');
  const rect = slot?.getBoundingClientRect();
  const ratio = rect && rect.height ? rect.width / rect.height : 0;
  return {
    tabs: [...document.querySelectorAll('[data-avery-tab]')].map((el) => el.textContent.trim()),
    lot: document.getElementById('avery-lot-preview')?.textContent || '',
    filled: document.querySelectorAll('#avery-sheet-preview .avery-slot.is-filled').length,
    offset: document.querySelectorAll('#avery-sheet-preview .avery-slot.is-offset').length,
    hasHero: Boolean(card?.querySelector('.label-card-hero')),
    heroText: card?.querySelector('.label-card-hero')?.textContent?.trim() || '',
    hasFarmOnLabel: Boolean(card?.querySelector('.label-card-farm')?.textContent?.trim()),
    hasSlaughterLine: Boolean(card?.querySelector('.label-card-slaughter')),
    storage: card?.querySelector('.label-card-storage')?.textContent?.trim() || '',
    aspectApprox: Number(ratio.toFixed(2)),
    hasScrollWrap: Boolean(document.querySelector('.avery-sheet-scroll')),
    toast: window.__toast || null,
  };
});

if (!stats.tabs.includes('Schulter') || !stats.tabs.includes('Rücken')) {
  throw new Error(`Unexpected tabs: ${JSON.stringify(stats.tabs)}`);
}
if (!stats.hasHero) throw new Error('label-card hero missing');
if (stats.hasFarmOnLabel) throw new Error('Betriebsname must be off by default on label');
if (stats.hasSlaughterLine) throw new Error('Schlachthof line must be off by default');
if (stats.aspectApprox < 1.7 || stats.aspectApprox > 2.2) {
  throw new Error(`Expected landscape ~1.94 ratio, got ${stats.aspectApprox}`);
}
if (!stats.hasScrollWrap) throw new Error('Missing .avery-sheet-scroll for mobile');
if (stats.filled < 5) throw new Error(`Expected filled labels, got ${stats.filled}`);
if (stats.offset !== 2) throw new Error(`Expected 2 offset cells for start=3, got ${stats.offset}`);

await page.check('#avery-print-betrieb');
await page.waitForTimeout(100);
const farmOn = await page.evaluate(() => {
  const farm = document.querySelector('.avery-slot.is-filled .label-card-farm');
  return farm?.textContent?.trim() || '';
});
if (!/StevesHof/i.test(farmOn)) throw new Error(`Expected farm name after toggle, got "${farmOn}"`);

await page.locator('#avery-sheet-preview').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${artifactDir}/avery-declutter-preview.png`, fullPage: false });
await page.screenshot({ path: `${artifactDir}/avery-declutter-suite.png`, fullPage: true });

const printed = await page.evaluate(() => {
  window.__printed = false;
  window.__print();
  return window.__printed;
});
if (!printed) throw new Error('printAveryLabelsSheet did not call window.print');

console.log(JSON.stringify({ ok: true, stats, farmOn, printed }, null, 2));
await browser.close();
