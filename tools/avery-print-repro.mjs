/**
 * Headless verify: multi-sheet planning UI + in-page window.print (iOS & Desktop).
 * Requires: node tools/avery-print-debug-server.mjs (port 4173)
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.AVERY_SMOKE_BASE || 'http://127.0.0.1:4173';
const artifactDir = '/opt/cursor/artifacts';
fs.mkdirSync(artifactDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 1200 } });

await page.goto(`${BASE}/avery-labels-smoke.html`, { waitUntil: 'networkidle' });
await page.waitForSelector('#avery-sheet-preview');

await page.fill('#avery-ohrmarke', 'DE123456');

// Fill more than 24 labels via trim chips + cuts
for (let i = 0; i < 5; i += 1) {
  await page.click('[data-avery-add="tr-r2-hack"]');
}
await page.click('[data-avery-tab="keule"]');
for (const id of [
  'keu-oberschale', 'keu-unterschale', 'keu-nuss', 'keu-huefte',
  'keu-tafelspitz', 'keu-buergermeister', 'keu-wade',
]) {
  for (let n = 0; n < 3; n += 1) await page.click(`[data-avery-add="${id}"]`);
}
await page.waitForTimeout(200);

const multiUi = await page.evaluate(() => {
  const tabs = [...document.querySelectorAll('[data-avery-sheet-tab]')];
  const status = document.getElementById('avery-overflow-warn');
  const printArea = document.getElementById('avery-print-area');
  const sheets = printArea ? [...printArea.querySelectorAll('.avery-sheet')] : [];
  const btn = document.getElementById('btn-avery-print-sheet');
  return {
    tabCount: tabs.length,
    tabTexts: tabs.map((t) => t.textContent?.trim()),
    statusText: status?.hidden ? null : status?.textContent?.trim(),
    statusMulti: status?.classList.contains('is-multi') || false,
    printSheetCount: sheets.length,
    continued: sheets.filter((s) => s.classList.contains('avery-sheet-continued')).length,
    printBtn: btn?.textContent?.trim() || '',
    filledTotal: printArea
      ? printArea.querySelectorAll('.avery-label:not(.empty)').length
      : 0,
    printAreaParent: printArea?.parentElement?.tagName || null,
  };
});

if (multiUi.tabCount < 2 || multiUi.printSheetCount < 2 || !multiUi.statusMulti) {
  throw new Error(`Multi-sheet UI failed: ${JSON.stringify(multiUi)}`);
}
if (!/Bögen drucken/i.test(multiUi.printBtn)) {
  throw new Error(`Print button should mention Bögen: ${multiUi.printBtn}`);
}
if (multiUi.printAreaParent !== 'BODY') {
  throw new Error(`#avery-print-area must be body child: ${JSON.stringify(multiUi)}`);
}

// Switch to sheet 2 tab
await page.click('[data-avery-sheet-tab="1"]');
await page.waitForTimeout(80);
const onSheet2 = await page.evaluate(() => {
  const active = document.querySelector('[data-avery-sheet-tab].is-active');
  const gauge = document.getElementById('avery-gauge-text')?.textContent || '';
  return {
    activeTab: active?.getAttribute('data-avery-sheet-tab'),
    gauge,
  };
});
if (onSheet2.activeTab !== '1' || !/Bogen 2\//.test(onSheet2.gauge)) {
  throw new Error(`Sheet tab switch failed: ${JSON.stringify(onSheet2)}`);
}

// Desktop: primary button → in-page window.print, no overlay/blob
await page.evaluate(() => {
  window.__printed = false;
  window.__openCalled = false;
  window.__toast = null;
  window.open = () => {
    window.__openCalled = true;
    return null;
  };
});
await page.click('#btn-avery-print-sheet');
await page.waitForTimeout(80);
const desktopPrint = await page.evaluate(() => ({
  printed: Boolean(window.__printed),
  openCalled: Boolean(window.__openCalled),
  bodyClass: document.body.classList.contains('print-avery-labels'),
  overlayExists: Boolean(document.getElementById('avery-ios-print-overlay')),
  printAreaParent: document.getElementById('avery-print-area')?.parentElement?.tagName || null,
  filled: document.querySelectorAll('#avery-print-area .avery-label:not(.empty)').length,
}));
if (!desktopPrint.printed || desktopPrint.openCalled || desktopPrint.overlayExists) {
  throw new Error(`Desktop in-page print failed: ${JSON.stringify(desktopPrint)}`);
}
if (desktopPrint.printAreaParent !== 'BODY' || desktopPrint.filled < 2) {
  throw new Error(`Print area not ready: ${JSON.stringify(desktopPrint)}`);
}

// iOS UA: same path — immediate window.print(), no blob/overlay
await page.evaluate(() => {
  window.__printed = false;
  window.__openCalled = false;
  window.open = () => {
    window.__openCalled = true;
    return null;
  };
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
  });
});
await page.click('#btn-avery-print-sheet');
await page.waitForTimeout(80);
const iosPrint = await page.evaluate(() => ({
  printed: Boolean(window.__printed),
  openCalled: Boolean(window.__openCalled),
  overlayExists: Boolean(document.getElementById('avery-ios-print-overlay')),
  bodyClass: document.body.classList.contains('print-avery-labels'),
  sheets: document.querySelectorAll('#avery-print-area .avery-sheet').length,
}));
if (!iosPrint.printed || iosPrint.openCalled || iosPrint.overlayExists) {
  throw new Error(`iOS must use in-page window.print only: ${JSON.stringify(iosPrint)}`);
}
if (iosPrint.sheets < 2) {
  throw new Error(`iOS print area missing sheets: ${JSON.stringify(iosPrint)}`);
}

await page.screenshot({ path: `${artifactDir}/avery-inpage-print-repro.png`, fullPage: true });
console.log(JSON.stringify({ ok: true, multiUi, onSheet2, desktopPrint, iosPrint }, null, 2));
await browser.close();
