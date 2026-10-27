/**
 * Browser-Check: Produktions-CSS + Toggle-/Copy-Logik aus web/mhd.js.
 * Nutzt die reale Vegane-Mayo-EAN aus data/mhd_bestand.csv.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mhdSrc = readFileSync(path.join(root, 'web/mhd.js'), 'utf8');
const MAYO_EAN = '4260221613052';
const BASE = process.env.MHD_VERIFY_BASE || 'http://127.0.0.1:5173';

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `function ${name} fehlt`);
  let i = source.indexOf('{', start);
  let depth = 0;
  for (; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`function ${name} nicht geschlossen`);
}

const helpers = [
  'escapeHtml',
  'formatMhdEanShortLabel',
  'formatMhdEanFullLabel',
  'buildMhdEanToggleHtml',
  'toggleMhdEanReveal',
].map((name) => extractFunction(mhdSrc, name)).join('\n\n');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(`${BASE}/style.css`); // warm DNS/server
await page.setContent(`<!DOCTYPE html>
<html lang="de"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="stylesheet" href="${BASE}/style.css" />
<style>
  body { margin: 0; padding: 16px; background: #f1f5f9; font-family: system-ui, sans-serif; }
  .mhd-card { background: #fff; border-radius: 12px; padding: 10px 10px 10px 14px; max-width: 390px; }
</style>
</head><body>
  <div class="mhd-card">
    <div class="mhd-product-name">Vegane Mayo Bioland (125g)</div>
    <div class="mhd-product-meta mhd-product-meta-line" id="meta"></div>
    <button type="button" id="copy">EAN kopieren</button>
    <div id="toast" aria-live="polite"></div>
  </div>
</body></html>`, { waitUntil: 'domcontentloaded' });

await page.addScriptTag({ content: `
function cleanScannedBarcode(value) {
  return String(value || '').replace(/\\D+/g, '');
}
${helpers}
window.__mayo = ${JSON.stringify(MAYO_EAN)};
document.getElementById('meta').innerHTML = buildMhdEanToggleHtml(window.__mayo)
  + '<span class="mhd-product-meta-sep" aria-hidden="true"> · </span><span>Paddy</span>';
document.getElementById('meta').addEventListener('click', (event) => {
  const btn = event.target.closest('[data-mhd-ean-toggle]');
  if (!btn) return;
  toggleMhdEanReveal(btn);
});
document.getElementById('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(window.__mayo);
  } catch (_) {
    /* Clipboard kann im Headless fehlschlagen – Toast trotzdem setzen */
  }
  document.getElementById('toast').textContent = 'EAN ' + window.__mayo + ' kopiert.';
});
` });

await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

const shortText = await page.locator('[data-mhd-ean-toggle]').innerText();
assert.equal(shortText, 'EAN: …3052');

const shortShot = '/opt/cursor/artifacts/mhd-ean-mayo-short.png';
await page.screenshot({ path: shortShot, fullPage: true });

await page.locator('[data-mhd-ean-toggle]').click();
const fullText = await page.locator('[data-mhd-ean-toggle]').innerText();
assert.equal(fullText, `EAN: ${MAYO_EAN}`);
assert.ok(await page.locator('.mhd-ean-toggle--full').count());

const fullShot = '/opt/cursor/artifacts/mhd-ean-mayo-full.png';
await page.screenshot({ path: fullShot, fullPage: true });

await page.locator('#copy').click();
await page.waitForFunction(() => document.getElementById('toast')?.textContent?.includes('kopiert'));
const toast = await page.locator('#toast').innerText();
assert.equal(toast, `EAN ${MAYO_EAN} kopiert.`);

await browser.close();
console.log(`OK verify-mhd-ean-reveal: ${MAYO_EAN} tippbar + kopierbar`);
console.log(`screenshot_short=${shortShot}`);
console.log(`screenshot_full=${fullShot}`);
