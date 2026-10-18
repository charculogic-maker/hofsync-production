/**
 * Headless repro for Avery print button (posts instrumentation to debug.log).
 * Requires: node tools/avery-print-debug-server.mjs (port 4173)
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.AVERY_SMOKE_BASE || 'http://127.0.0.1:4173';
const LOG = '/opt/cursor/logs/debug.log';
const artifactDir = '/opt/cursor/artifacts';
fs.mkdirSync(artifactDir, { recursive: true });
fs.mkdirSync(path.dirname(LOG), { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 1100 } });

page.on('console', (msg) => {
  const text = msg.text();
  if (text.includes('[AVERY-DEBUG]')) {
    try {
      const json = text.replace(/^\[AVERY-DEBUG\]\s*/, '');
      fs.appendFileSync(LOG, `${json}\n`);
    } catch (_) { /* ignore */ }
  }
});

await page.goto(`${BASE}/avery-labels-smoke.html`, { waitUntil: 'networkidle' });
await page.waitForSelector('#avery-sheet-preview');

// Ready path: Ohrmarke + cuts
await page.fill('#avery-ohrmarke', 'DE123456');
await page.fill('#avery-trim-tr-r1-spiesse', '1');
await page.click('[data-avery-tab="schultern"]');
await page.click('[data-avery-add="sch-falsches-filet"]');
await page.waitForTimeout(200);

const beforeClick = await page.evaluate(() => {
  const btn = document.getElementById('btn-avery-print-sheet');
  const area = document.getElementById('avery-print-area');
  return {
    btnDisabled: btn?.disabled ?? null,
    btnTitle: btn?.title || '',
    bodyClass: document.body.classList.contains('print-avery-labels'),
    areaParent: area?.parentElement?.tagName || null,
    filled: area ? area.querySelectorAll('.avery-label:not(.empty)').length : 0,
    printBound: btn?.dataset?.averyPrintBound === '1',
    dbgCount: (window.__AVERY_DBG || []).length,
  };
});
fs.appendFileSync(LOG, `${JSON.stringify({
  hypothesisId: 'REPRO',
  location: 'avery-print-repro.mjs:beforeClick',
  message: 'DOM state before print click',
  data: beforeClick,
  timestamp: Date.now(),
})}\n`);

await page.evaluate(() => { window.__printed = false; });
await page.click('#btn-avery-print-sheet', { force: true });
await page.waitForTimeout(150);

const afterClick = await page.evaluate(() => ({
  printed: Boolean(window.__printed),
  bodyClassAtPrint: Boolean(window.__printBodyClass),
  areaParent: window.__printAreaParent || null,
  labelCount: window.__printLabelCount || 0,
  filled: window.__printFilled || 0,
  areaDisplay: window.__printAreaDisplay || null,
  toast: window.__toast || null,
  dbgTail: (window.__AVERY_DBG || []).slice(-8),
}));

// Flush remaining dbg entries to log file
for (const entry of afterClick.dbgTail || []) {
  fs.appendFileSync(LOG, `${JSON.stringify(entry)}\n`);
}
fs.appendFileSync(LOG, `${JSON.stringify({
  hypothesisId: 'REPRO',
  location: 'avery-print-repro.mjs:afterClick',
  message: 'print click result',
  data: { ...afterClick, dbgTail: undefined },
  timestamp: Date.now(),
})}\n`);

await page.screenshot({ path: `${artifactDir}/avery-print-repro.png`, fullPage: true });

console.log(JSON.stringify({ beforeClick, afterClick }, null, 2));
await browser.close();

if (!afterClick.printed && beforeClick.btnDisabled) {
  console.error('FAIL: button stayed disabled — click may not fire without force');
  process.exitCode = 2;
} else if (!afterClick.printed) {
  console.error('FAIL: window.print was not called');
  process.exitCode = 3;
} else if (!afterClick.bodyClassAtPrint) {
  console.error('FAIL: print-avery-labels missing at print time (blank/useless print)');
  process.exitCode = 4;
} else {
  console.log('REPRO finished — inspect /opt/cursor/logs/debug.log');
}
