/**
 * Headless repro/verify for Avery print button fix.
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

function appendLog(entry) {
  fs.appendFileSync(LOG, `${JSON.stringify({ ...entry, timestamp: Date.now() })}\n`);
}

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

// --- Failure path: cuts, NO Ohrmarke → toast, no print ---
await page.fill('#avery-trim-tr-r1-spiesse', '1');
await page.click('[data-avery-tab="schultern"]');
await page.click('[data-avery-add="sch-falsches-filet"]');
await page.waitForTimeout(150);

const noOhr = await page.evaluate(() => {
  const btn = document.getElementById('btn-avery-print-sheet');
  const hint = document.getElementById('avery-print-hint');
  return {
    disabled: btn?.disabled ?? null,
    title: btn?.title || '',
    hint: hint?.textContent || '',
    opacity: btn ? getComputedStyle(btn).opacity : null,
    bodyClass: document.body.classList.contains('print-avery-labels'),
  };
});
appendLog({ hypothesisId: 'VERIFY', location: 'avery-print-repro.mjs:noOhr', message: 'no-ohrmarke state', data: noOhr });

await page.evaluate(() => { window.__printed = false; window.__toast = null; });
await page.click('#btn-avery-print-sheet');
await page.waitForTimeout(100);
const afterNoOhr = await page.evaluate(() => ({
  printed: Boolean(window.__printed),
  toast: window.__toast || null,
  dbgTail: (window.__AVERY_DBG || []).slice(-6),
}));
appendLog({
  hypothesisId: 'VERIFY',
  location: 'avery-print-repro.mjs:afterNoOhrClick',
  message: 'no-ohrmarke click result',
  data: { printed: afterNoOhr.printed, toast: afterNoOhr.toast },
});
await page.screenshot({ path: `${artifactDir}/avery-print-no-ohr-toast.png`, fullPage: true });

// --- Happy path: Ohrmarke + cuts → print ---
await page.fill('#avery-ohrmarke', 'DE123456');
await page.waitForTimeout(150);

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
  };
});
appendLog({ hypothesisId: 'VERIFY', location: 'avery-print-repro.mjs:beforeClick', message: 'ready state', data: beforeClick });

await page.evaluate(() => { window.__printed = false; window.__toast = null; });
await page.click('#btn-avery-print-sheet');
await page.waitForTimeout(150);

const afterClick = await page.evaluate(() => ({
  printed: Boolean(window.__printed),
  bodyClassAtPrint: Boolean(window.__printBodyClass),
  areaParent: window.__printAreaParent || null,
  labelCount: window.__printLabelCount || 0,
  filled: window.__printFilled || 0,
  toast: window.__toast || null,
  dbgTail: (window.__AVERY_DBG || []).slice(-8),
}));
for (const entry of afterClick.dbgTail || []) {
  fs.appendFileSync(LOG, `${JSON.stringify(entry)}\n`);
}
appendLog({
  hypothesisId: 'VERIFY',
  location: 'avery-print-repro.mjs:afterClick',
  message: 'happy-path print result',
  data: { ...afterClick, dbgTail: undefined },
});

await page.screenshot({ path: `${artifactDir}/avery-print-repro.png`, fullPage: true });
console.log(JSON.stringify({ noOhr, afterNoOhr: { printed: afterNoOhr.printed, toast: afterNoOhr.toast }, beforeClick, afterClick: { ...afterClick, dbgTail: undefined } }, null, 2));
await browser.close();

let failed = false;
if (noOhr.disabled === true) {
  console.error('FAIL: button still disabled without Ohrmarke');
  failed = true;
}
if (afterNoOhr.printed) {
  console.error('FAIL: printed without Ohrmarke');
  failed = true;
}
if (!afterNoOhr.toast?.msg || !/Ohrmarke/i.test(afterNoOhr.toast.msg)) {
  console.error('FAIL: expected Ohrmarke toast, got', afterNoOhr.toast);
  failed = true;
}
if (!afterClick.printed) {
  console.error('FAIL: window.print was not called on happy path');
  failed = true;
}
if (!afterClick.bodyClassAtPrint) {
  console.error('FAIL: print-avery-labels missing at print time');
  failed = true;
}
if (afterClick.labelCount !== 24) {
  console.error('FAIL: expected 24 labels, got', afterClick.labelCount);
  failed = true;
}

if (failed) process.exitCode = 1;
else console.log('VERIFY OK — inspect /opt/cursor/logs/debug.log');
