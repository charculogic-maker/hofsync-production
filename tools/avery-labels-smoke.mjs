/**
 * Headless smoke for Avery white 3-zone WYSIWYG labels.
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
<style>
  /* Simulate dark app shell to prove labels stay white */
  body { background: #0f172a; color: #e2e8f0; }
</style>
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
}));
if (defaults.printBetrieb !== false || defaults.printSchlachthof !== false) {
  throw new Error(`Print toggles must default off: ${JSON.stringify(defaults)}`);
}
if (defaults.hasReifeField) throw new Error('Reifehinweis field must be removed');

await page.fill('#avery-ohrmarke', 'DE123456');
await page.click('[data-avery-tab="schultern"]');
await page.click('[data-avery-add="sch-brust"]');
await page.fill('#avery-trim-tr-r1-spiesse', '2');
await page.fill('#avery-trim-tr-r2-hack', '1');
await page.click('[data-avery-slot="1"]');
await page.waitForTimeout(150);

const stats = await page.evaluate(() => {
  const card = document.querySelector('.avery-slot.is-filled .label-card');
  const title = card?.querySelector('.lbl-title-text');
  const slot = document.querySelector('.avery-slot.is-filled');
  const rect = slot?.getBoundingClientRect();
  const ratio = rect && rect.height ? rect.width / rect.height : 0;
  const cs = card ? getComputedStyle(card) : null;
  const titleCs = title ? getComputedStyle(title) : null;
  const titleBox = title?.getBoundingClientRect();
  const titlePad = titleCs
    ? Number.parseFloat(titleCs.paddingTop) + Number.parseFloat(titleCs.paddingBottom)
    : 0;
  return {
    bg: cs?.backgroundColor || '',
    color: cs?.color || '',
    border: cs?.borderTopColor || '',
    titleText: title?.textContent?.trim() || '',
    hasHeader: Boolean(card?.querySelector('.lbl-header')),
    hasFooter: Boolean(card?.querySelector('.lbl-footer')),
    storageInHeader: card?.querySelector('.lbl-storage')?.textContent?.trim() || '',
    emptyOhrPlaceholder: /OHR\s*[–-]/.test(card?.innerHTML || ''),
    ohrPresent: /OHR\s+DE123456/.test(card?.textContent || ''),
    aspectApprox: Number(ratio.toFixed(2)),
    titleFont: titleCs?.fontSize || '',
    titleLineHeight: titleCs?.lineHeight || '',
    titleOverflow: titleCs?.overflow || '',
    titleHeight: titleBox?.height || 0,
    titlePad,
    toast: window.__toast || null,
  };
});

if (!/^rgb\(255,\s*255,\s*255\)$/.test(stats.bg) && stats.bg !== '#ffffff') {
  throw new Error(`Label must be white, got bg=${stats.bg}`);
}
if (!stats.hasHeader || !stats.hasFooter) throw new Error('3-zone structure missing');
if (!/R I\s*·\s*SPIESSE/i.test(stats.titleText) && !/R I\s*·\s*Spieße/i.test(stats.titleText)) {
  // CSS uppercase may transform visually; textContent stays as HTML
  if (!/R I · Spieße/.test(stats.titleText)) {
    throw new Error(`Expected R I · Spieße title, got "${stats.titleText}"`);
  }
}
if (stats.storageInHeader !== '0–2 °C') {
  throw new Error(`Storage should be in header, got "${stats.storageInHeader}"`);
}
if (stats.emptyOhrPlaceholder) throw new Error('Empty OHR placeholder still shown');
if (!stats.ohrPresent) throw new Error('OHR with ear tag missing');
if (stats.aspectApprox < 1.7 || stats.aspectApprox > 2.2) {
  throw new Error(`Expected landscape ~1.94 ratio, got ${stats.aspectApprox}`);
}

await page.locator('.avery-sheet-scroll').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${artifactDir}/avery-hero-preview.png`, fullPage: false });
const box = await page.locator('.avery-slot.is-filled').first().boundingBox();
if (box) {
  await page.screenshot({
    path: `${artifactDir}/avery-hero-label-closeup.png`,
    clip: { x: Math.max(0, box.x - 6), y: Math.max(0, box.y - 6), width: box.width + 12, height: box.height + 12 },
  });
}

const printed = await page.evaluate(() => {
  window.__printed = false;
  window.__print();
  return window.__printed;
});
if (!printed) throw new Error('printAveryLabelsSheet did not call window.print');

console.log(JSON.stringify({ ok: true, stats, printed }, null, 2));
await browser.close();
