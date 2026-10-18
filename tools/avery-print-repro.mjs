/**
 * Headless verify: multi-sheet planning UI + iOS print overlay (no window.open).
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
  // add several each
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
  };
});

if (multiUi.tabCount < 2 || multiUi.printSheetCount < 2 || !multiUi.statusMulti) {
  throw new Error(`Multi-sheet UI failed: ${JSON.stringify(multiUi)}`);
}
if (!/Bögen drucken/i.test(multiUi.printBtn)) {
  throw new Error(`Print button should mention Bögen: ${multiUi.printBtn}`);
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

// Desktop print still uses window.print
await page.evaluate(() => { window.__printed = false; window.__toast = null; });
await page.click('#btn-avery-print-sheet');
await page.waitForTimeout(80);
const desktopPrint = await page.evaluate(() => ({
  printed: Boolean(window.__printed),
  overlayHidden: document.getElementById('avery-ios-print-overlay')?.hidden !== false,
}));
if (!desktopPrint.printed || !desktopPrint.overlayHidden) {
  throw new Error(`Desktop print failed: ${JSON.stringify(desktopPrint)}`);
}

// iOS: overlay instead of window.open
await page.evaluate(() => {
  window.__openCalled = false;
  window.open = () => { window.__openCalled = true; return null; };
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
  });
});
await page.evaluate(() => { window.__printed = false; });
await page.click('#btn-avery-print-sheet');
await page.waitForTimeout(100);
const iosOverlay = await page.evaluate(() => {
  const overlay = document.getElementById('avery-ios-print-overlay');
  return {
    openCalled: Boolean(window.__openCalled),
    overlayVisible: overlay ? !overlay.hidden : false,
    summary: document.getElementById('avery-ios-print-summary')?.textContent || '',
    printed: Boolean(window.__printed),
  };
});
if (iosOverlay.openCalled || !iosOverlay.overlayVisible || iosOverlay.printed) {
  throw new Error(`iOS overlay open failed: ${JSON.stringify(iosOverlay)}`);
}

await page.click('#btn-avery-ios-print-now');
await page.waitForTimeout(80);
const afterIosPrint = await page.evaluate(() => ({ printed: Boolean(window.__printed) }));
if (!afterIosPrint.printed) throw new Error('iOS overlay Drucken did not call window.print');

await page.click('#btn-avery-ios-print-done');
await page.waitForTimeout(80);
const afterDone = await page.evaluate(() => ({
  overlayHidden: document.getElementById('avery-ios-print-overlay')?.hidden === true,
  bodyClass: document.body.classList.contains('avery-ios-print-open'),
}));
if (!afterDone.overlayHidden || afterDone.bodyClass) {
  throw new Error(`iOS Fertig failed: ${JSON.stringify(afterDone)}`);
}

await page.screenshot({ path: `${artifactDir}/avery-multi-sheet-ios-overlay.png`, fullPage: true });
console.log(JSON.stringify({ ok: true, multiUi, onSheet2, desktopPrint, iosOverlay, afterIosPrint, afterDone }, null, 2));
await browser.close();
