/**
 * Headless smoke for Avery Inhalt-zuerst hero-v2 labels.
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
  body { background: #0f172a; color: #e2e8f0; }
  /* Simulate the conflicting global print rule from style.css */
  @media print {
    body > *:not(.preview-container) { display: none !important; }
  }
</style>
</head><body>
<div class="preview-container"><div id="page-avery" class="page active"></div></div>
<script type="module">
  import { initAveryLabelsModule, printAveryLabelsSheet } from '/avery-labels.js';
  window.print = () => {
    window.__printed = true;
    window.__printBodyClass = document.body.classList.contains('print-avery-labels');
    window.__printAreaParent = document.getElementById('avery-print-area')?.parentElement?.tagName || null;
    window.__printLabelCount = document.querySelectorAll('#avery-print-area .avery-label').length;
    window.__printFilled = document.querySelectorAll('#avery-print-area .avery-label:not(.empty)').length;
  };
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

await page.fill('#avery-ohrmarke', 'DE123456');
// Schnellster Weg: Paste-Event im Notizfeld übernimmt sofort
await page.focus('#avery-plain-import');
await page.evaluate(() => {
  const area = document.getElementById('avery-plain-import');
  const text = 'Entrecôte 2, 514 x1; Picanha\nR II Hack 1';
  const dt = new DataTransfer();
  dt.setData('text/plain', text);
  area.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
});
await page.waitForTimeout(120);
const pasteToast = await page.evaluate(() => window.__toast || null);
if (!pasteToast || !/Etiketten/i.test(pasteToast.msg || '')) {
  throw new Error(`Plain-text paste did not import: ${JSON.stringify(pasteToast)}`);
}
await page.click('[data-avery-add="tr-r1-spiesse"]');
await page.click('[data-avery-tab="schultern"]');
await page.click('[data-avery-add="sch-510"]');
await page.click('[data-avery-add="sch-539"]');
await page.click('[data-avery-slot="1"]');
await page.waitForTimeout(150);

const stats = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.avery-slot.is-filled .label-card')];
  const card = cards.find((c) => /Falsches Filet/i.test(c.querySelector('.lbl-title')?.textContent || ''))
    || cards[0];
  const title = card?.querySelector('.lbl-title');
  const slot = card?.closest('.avery-slot');
  const sheet = document.querySelector('.avery-sheet-preview');
  const wrap = document.querySelector('.sheet-scroll-wrapper');
  const rect = slot?.getBoundingClientRect();
  const titleBox = title?.getBoundingClientRect();
  const heroBox = card?.querySelector('.lbl-hero')?.getBoundingClientRect();
  const lotText = card?.querySelector('.lbl-meta-main')?.textContent?.trim() || '';
  const lotCs = card?.querySelector('.lbl-meta-main')
    ? getComputedStyle(card.querySelector('.lbl-meta-main'))
    : null;
  const cs = card ? getComputedStyle(card) : null;
  const titleClipped = title
    ? title.scrollHeight > title.clientHeight + 1
    : true;
  const anyTitleClipped = cards.some((c) => {
    const t = c.querySelector('.lbl-title');
    return t ? t.scrollHeight > t.clientHeight + 1 : false;
  });
  return {
    bg: cs?.backgroundColor || '',
    titles: cards.map((c) => c.querySelector('.lbl-title')?.textContent?.trim()),
    titleText: title?.textContent?.trim() || '',
    titleHeight: titleBox?.height || 0,
    heroHeight: heroBox?.height || 0,
    titleClipped,
    anyTitleClipped,
    slotRatio: rect && rect.height ? Number((rect.width / rect.height).toFixed(2)) : 0,
    slotWidth: rect?.width || 0,
    hasArt: /ART\./i.test(card?.textContent || ''),
    hasHeader: Boolean(card?.querySelector('.lbl-header')),
    hasHero: Boolean(card?.querySelector('.lbl-hero')),
    hasMeta: Boolean(card?.querySelector('.lbl-meta')),
    hasFoot: Boolean(card?.querySelector('.lbl-foot')),
    foot: card?.querySelector('.lbl-foot')?.textContent?.trim() || '',
    lotText,
    lotHasEllipsisChars: /\.\.\./.test(lotText),
    lotEllipsis: lotCs?.textOverflow === 'ellipsis',
    lotOverflow: lotCs?.overflow || '',
    sheetMinWidth: sheet ? getComputedStyle(sheet).minWidth : '',
    sheetWidth: sheet?.getBoundingClientRect().width || 0,
    hasScrollWrap: Boolean(wrap),
    noEmptyOhr: !cards.some((c) => /OHR\s*[–-]/.test(c.innerHTML || '')),
  };
});

if (!/^rgb\(255,\s*255,\s*255\)$/.test(stats.bg)) {
  throw new Error(`Label must be white, got ${stats.bg}`);
}
if (stats.hasArt || stats.hasHeader) throw new Error('Art./header must be removed from label');
if (!stats.hasHero || !stats.hasMeta || !stats.hasFoot) {
  throw new Error(`Inhalt-zuerst zones missing: ${JSON.stringify(stats)}`);
}
if (!/Falsches Filet/i.test(stats.titleText)) {
  throw new Error(`Expected Falsches Filet, got "${stats.titleText}"`);
}
if (stats.titleClipped || stats.anyTitleClipped) {
  throw new Error(`Title clipped (scrollHeight > clientHeight): ${JSON.stringify(stats.titles)}`);
}
if (!/Gekühlt bei 0–2 °C lagern/.test(stats.foot)) {
  throw new Error(`Foot line wrong: ${stats.foot}`);
}
if (stats.lotEllipsis || stats.lotHasEllipsisChars) {
  throw new Error(`LOT must not be ellipsized: "${stats.lotText}" overflow=${stats.lotOverflow}`);
}
if (stats.slotWidth < 180) {
  throw new Error(`Preview slot too narrow (mobile squash): ${stats.slotWidth}px`);
}
if (stats.sheetWidth < 640) {
  throw new Error(`Sheet must keep min ~640px width, got ${stats.sheetWidth}`);
}
if (!stats.hasScrollWrap) throw new Error('sheet-scroll-wrapper missing');
if (stats.slotRatio < 1.7 || stats.slotRatio > 2.2) {
  throw new Error(`Expected ~1.94 ratio, got ${stats.slotRatio}`);
}

await page.locator('.sheet-scroll-wrapper').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${artifactDir}/avery-hero-v2-preview.png`, fullPage: false });

async function shotLabel(locator, fileName) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  const box = await locator.boundingBox();
  if (!box || box.width < 2 || box.height < 2) return;
  const clip = {
    x: Math.max(0, box.x - 4),
    y: Math.max(0, box.y - 4),
    width: Math.max(2, box.width + 8),
    height: Math.max(2, box.height + 8),
  };
  await page.screenshot({ path: `${artifactDir}/${fileName}`, clip }).catch(() => {});
}

const falsches = page.locator('.avery-slot.is-filled').filter({ hasText: 'Falsches Filet' }).first();
await shotLabel(falsches, 'avery-hero-v2-falsches-filet.png');
const spiesse = page.locator('.avery-slot.is-filled').filter({ hasText: 'Spieße' }).first();
await shotLabel(spiesse, 'avery-hero-v2-spiesse.png');
const picanha = page.locator('.avery-queue-table').filter({ hasText: 'Picanha' }).first();
await picanha.scrollIntoViewIfNeeded().catch(() => {});
await page.screenshot({ path: `${artifactDir}/avery-plaintext-queue.png`, fullPage: false });

// Druck-Button per Delegation (nicht nur Direktaufruf)
await page.evaluate(() => { window.__printed = false; });
await page.click('#btn-avery-print-sheet');
await page.waitForTimeout(100);
const printStats = await page.evaluate(() => ({
  printed: Boolean(window.__printed),
  bodyClass: Boolean(window.__printBodyClass),
  areaParent: window.__printAreaParent || null,
  labelCount: window.__printLabelCount || 0,
  filled: window.__printFilled || 0,
  areaOnBody: document.getElementById('avery-print-area')?.parentElement === document.body,
  toast: window.__toast || null,
}));
if (!printStats.printed) throw new Error('Print button did not call window.print');
if (!printStats.bodyClass) throw new Error('print-avery-labels class missing at print time');
if (!printStats.areaOnBody || printStats.areaParent !== 'BODY') {
  throw new Error(`#avery-print-area must be body child, got parent=${printStats.areaParent}`);
}
if (printStats.labelCount !== 24) {
  throw new Error(`Expected 24 print cells (incl. empty), got ${printStats.labelCount}`);
}
if (printStats.filled < 1) throw new Error('No filled labels on print sheet');

await page.screenshot({ path: `${artifactDir}/avery-print-fix-suite.png`, fullPage: true });
console.log(JSON.stringify({ ok: true, stats, printStats }, null, 2));
await browser.close();
