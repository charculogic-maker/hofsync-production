/**
 * Headless verify for Avery print / trimmings chips / reset.
 * Requires: node tools/avery-print-debug-server.mjs (port 4173)
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.AVERY_SMOKE_BASE || 'http://127.0.0.1:4173';
const artifactDir = '/opt/cursor/artifacts';
fs.mkdirSync(artifactDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 1100 } });

await page.goto(`${BASE}/avery-labels-smoke.html`, { waitUntil: 'networkidle' });
await page.waitForSelector('#avery-sheet-preview');

// --- Trimming chips (not number inputs) ---
const trimChip = page.locator('[data-avery-add="tr-r1-spiesse"]');
await trimChip.click();
await page.waitForTimeout(80);
const trimUi = await page.evaluate(() => {
  const chip = document.querySelector('[data-avery-add="tr-r1-spiesse"]');
  const input = document.querySelector('#avery-trim-tr-r1-spiesse');
  return {
    chipExists: Boolean(chip),
    chipActive: chip?.classList.contains('is-active'),
    chipText: chip?.textContent?.replace(/\s+/g, ' ').trim() || '',
    legacyInputGone: !input,
  };
});
if (!trimUi.chipExists || !trimUi.chipActive || !trimUi.legacyInputGone) {
  throw new Error(`Trim chips broken: ${JSON.stringify(trimUi)}`);
}

// --- Failure path: cuts, NO Ohrmarke → toast ---
await page.click('[data-avery-tab="schultern"]');
await page.click('[data-avery-add="sch-falsches-filet"]');
await page.waitForTimeout(100);

await page.evaluate(() => { window.__printed = false; window.__toast = null; window.__printWindow = null; });
await page.click('#btn-avery-print-sheet');
await page.waitForTimeout(80);
const afterNoOhr = await page.evaluate(() => ({
  printed: Boolean(window.__printed),
  toast: window.__toast || null,
}));
if (afterNoOhr.printed || !/Ohrmarke/i.test(afterNoOhr.toast?.msg || '')) {
  throw new Error(`Expected Ohrmarke toast, got ${JSON.stringify(afterNoOhr)}`);
}

// --- Happy path desktop: Ohrmarke + cuts → window.print ---
await page.fill('#avery-ohrmarke', 'DE123456');
await page.waitForTimeout(100);
await page.evaluate(() => { window.__printed = false; window.__toast = null; });
await page.click('#btn-avery-print-sheet');
await page.waitForTimeout(100);
const afterPrint = await page.evaluate(() => ({
  printed: Boolean(window.__printed),
  bodyClass: Boolean(window.__printBodyClass),
  labels: window.__printLabelCount || 0,
  filled: window.__printFilled || 0,
}));
if (!afterPrint.printed || afterPrint.labels !== 24 || afterPrint.filled < 1) {
  throw new Error(`Desktop print failed: ${JSON.stringify(afterPrint)}`);
}

// --- iOS path: mock UA + window.open ---
await page.evaluate(() => {
  window.__iosOpen = null;
  const fakeDoc = {
    _html: '',
    open() {},
    write(html) { this._html = String(html || ''); },
    close() {},
  };
  const fakeWin = {
    document: fakeDoc,
    focus() {},
    print() { window.__printed = true; window.__iosOpenedPrint = true; },
    close() {},
  };
  window.open = () => {
    window.__iosOpen = fakeWin;
    return fakeWin;
  };
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
  });
});
await page.evaluate(() => { window.__printed = false; window.__iosOpenedPrint = false; window.__toast = null; });
await page.click('#btn-avery-print-sheet');
await page.waitForTimeout(120);
const iosPrint = await page.evaluate(() => ({
  printed: Boolean(window.__printed),
  iosOpenedPrint: Boolean(window.__iosOpenedPrint),
  opened: Boolean(window.__iosOpen),
  htmlHasLabels: /avery-label/.test(window.__iosOpen?.document?._html || ''),
  htmlHasSheet: /avery-sheet/.test(window.__iosOpen?.document?._html || ''),
  toast: window.__toast || null,
}));
if (!iosPrint.opened || !iosPrint.htmlHasLabels || !iosPrint.htmlHasSheet) {
  throw new Error(`iOS print window path failed: ${JSON.stringify(iosPrint)}`);
}

// --- Reset button ---
await page.click('#btn-avery-reset-sheet');
await page.waitForTimeout(100);
const afterReset = await page.evaluate(() => {
  const area = document.getElementById('avery-print-area');
  return {
    queueEmpty: !document.querySelector('#avery-queue-body [data-queue-key]'),
    filled: area ? area.querySelectorAll('.avery-label:not(.empty)').length : -1,
    toast: window.__toast || null,
    spiesseActive: document.querySelector('[data-avery-add="tr-r1-spiesse"]')?.classList.contains('is-active') || false,
  };
});
if (!afterReset.queueEmpty || afterReset.filled !== 0 || afterReset.spiesseActive) {
  throw new Error(`Reset failed: ${JSON.stringify(afterReset)}`);
}
if (!/zurückgesetzt/i.test(afterReset.toast?.msg || '')) {
  throw new Error(`Reset toast missing: ${JSON.stringify(afterReset.toast)}`);
}

await page.screenshot({ path: `${artifactDir}/avery-trimmings-reset-print.png`, fullPage: true });
console.log(JSON.stringify({
  ok: true,
  trimUi,
  afterNoOhr,
  afterPrint,
  iosPrint,
  afterReset,
}, null, 2));
await browser.close();
