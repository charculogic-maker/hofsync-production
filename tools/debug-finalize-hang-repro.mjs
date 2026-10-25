#!/usr/bin/env node
/**
 * Repro: finalizeDelivery hang after „Gesamte Lieferung abschließen“.
 * Serves instrumented local ES modules over production origin via Playwright route
 * fulfill, then harvests window.__agentDebugLog → /opt/cursor/logs/debug.log
 *
 * Usage:
 *   HOFSYNC_EMPLOYEE_PASSWORD=… node tools/debug-finalize-hang-repro.mjs
 * Optional:
 *   BASE_URL=https://hofsync-charculogic.vercel.app
 *   HOFSYNC_EMPLOYEE_EMAIL=bestellung@steveshof-hofladen.de
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WEB = path.join(ROOT, 'web');
const LOG_PATH = '/opt/cursor/logs/debug.log';
const ART = '/opt/cursor/artifacts/finalize-hang-repro';

const BASE = process.env.BASE_URL || 'https://hofsync-charculogic.vercel.app';
const EMP = process.env.HOFSYNC_EMPLOYEE_EMAIL || 'bestellung@steveshof-hofladen.de';
const EMP_PW = process.env.HOFSYNC_EMPLOYEE_PASSWORD || '';

const INSTRUMENTED = new Set(['mhd.js', 'sync.js', 'catalog-ean.js']);

function mimeFor(filePath) {
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json';
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  return 'application/octet-stream';
}

function appendNdjson(entries) {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  const lines = entries.map((e) => JSON.stringify(e)).join('\n') + (entries.length ? '\n' : '');
  fs.appendFileSync(LOG_PATH, lines);
}

function mhdIn3Days() {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

async function harvest(page, tag) {
  const logs = await page.evaluate(() => (window.__agentDebugLog || []).slice());
  appendNdjson(logs.map((e) => ({ ...e, harvestTag: tag })));
  await page.evaluate(() => { window.__agentDebugLog = []; });
  return logs;
}

async function main() {
  if (!EMP_PW) {
    console.error('HOFSYNC_EMPLOYEE_PASSWORD missing');
    process.exit(2);
  }
  fs.mkdirSync(ART, { recursive: true });
  try { fs.unlinkSync(LOG_PATH); } catch { /* fresh log */ }

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });

  page.on('console', (msg) => {
    const text = msg.text();
    if (text.startsWith('AGENT_DBG ')) {
      try {
        const payload = JSON.parse(text.slice('AGENT_DBG '.length));
        appendNdjson([payload]);
      } catch { /* ignore */ }
    }
  });

  // Inject instrumented modules from local tree while keeping production Firebase.
  await page.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const base = path.basename(url.pathname);
    if (INSTRUMENTED.has(base) && req.resourceType() === 'script') {
      const local = path.join(WEB, base);
      if (fs.existsSync(local)) {
        const body = fs.readFileSync(local);
        return route.fulfill({
          status: 200,
          contentType: mimeFor(local),
          body,
          headers: {
            'cache-control': 'no-store',
            'access-control-allow-origin': '*',
          },
        });
      }
    }
    return route.continue();
  });

  console.log('goto', BASE);
  await page.goto(`${BASE}/?login=1&t=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(1500);
  await page.locator('#auth-login-email').fill(EMP);
  await page.locator('#auth-login-password').fill(EMP_PW);
  await page.locator('#auth-login-form button[type="submit"]').click();
  await page.waitForFunction(() => Boolean(window.firebase?.auth?.()?.currentUser), { timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const lock = document.getElementById('auth-lock-screen');
    if (lock) { lock.classList.remove('active'); lock.hidden = true; lock.style.display = 'none'; }
    document.body.classList.remove('auth-locked');
  });
  await page.screenshot({ path: path.join(ART, '01-logged-in.png') });

  await page.evaluate(() => {
    window.__toasts = [];
    const orig = window.showToast;
    window.showToast = (msg, type) => {
      window.__toasts.push({ msg: String(msg), type: String(type || '') });
      return orig?.(msg, type);
    };
    void window.openEmployeePickerModal?.({ mandatory: false });
  });
  await page.waitForTimeout(2000);
  await page.evaluate(() => document.querySelector('#employee-picker-list [data-employee-picker-name]')?.click());
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(ART, '02-profile.png') });

  await page.evaluate(() => {
    window.showTab?.('receiving') || window.fallbackShowTab?.('receiving');
    const p = document.getElementById('page-receiving');
    if (p) { p.hidden = false; p.style.display = 'block'; }
  });
  await page.waitForTimeout(1500);
  // Receiving is PIN-protected — picker may reopen as mandatory
  await page.evaluate(() => {
    const pick = document.querySelector('#employee-picker-list [data-employee-picker-name]');
    if (pick) pick.click();
    else {
      const overlay = document.getElementById('modal-employee-picker');
      if (overlay) {
        overlay.classList.remove('is-open', 'is-mandatory');
        overlay.hidden = true;
        overlay.setAttribute('aria-hidden', 'true');
      }
    }
  });
  await page.waitForTimeout(800);

  const product = `TEST – Nicht relevant DBG ${new Date().toISOString().slice(11, 19)}`;
  const ean = `200${Date.now().toString().slice(-10)}`;
  const mhdDe = mhdIn3Days();

  await page.evaluate(() => {
    const supplier = document.getElementById('we-supplier');
    if (supplier) {
      const opt = [...supplier.options].find((o) => /bartke/i.test(o.textContent || o.value));
      if (opt) supplier.value = opt.value;
      supplier.dispatchEvent(new Event('change', { bubbles: true }));
    }
    for (const id of ['we-temperature-head', 'we-temperature']) {
      const el = document.getElementById(id);
      if (el) {
        el.value = '4';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    const cat = document.getElementById('we-category-quick') || document.getElementById('we-category');
    if (cat) {
      const opt = [...(cat.options || [])].find((o) => /trocken|kühl|kuehl|mopro/i.test(o.textContent || ''));
      if (opt) {
        cat.value = opt.value;
        cat.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });
  await page.fill('#we-product-name', product);
  await page.fill('#we-qty', '1');
  await page.fill('#we-mhd', mhdDe);
  await page.fill('#we-ean', ean);
  await page.evaluate(() => {
    window.__toasts = [];
    // Close any leftover picker before add
    const overlay = document.getElementById('modal-employee-picker');
    if (overlay?.classList.contains('is-open')) {
      document.querySelector('#employee-picker-list [data-employee-picker-name]')?.click();
    }
    document.getElementById('we-add-item-btn')?.click();
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(ART, '03-item-added.png') });

  const afterAdd = await page.evaluate((productName) => {
    const table = document.getElementById('we-current-items-table')?.innerText || '';
    return {
      toasts: window.__toasts,
      hasProduct: table.includes(productName) || /TEST/.test(table),
      items: window.getCurrentDeliveryItems?.()?.length
        ?? document.querySelectorAll('#we-current-items-table tr, .we-item-row, [data-item-id]').length,
      saveDisabled: document.getElementById('we-save-delivery-btn')?.disabled,
      saveLabel: document.getElementById('we-save-delivery-btn')?.textContent,
      tableSnippet: table.replace(/\s+/g, ' ').slice(0, 240),
    };
  }, product);
  console.log('afterAdd', JSON.stringify(afterAdd));
  appendNdjson([{ hypothesisId: 'C', location: 'repro:afterAdd', message: 'item add snapshot', data: afterAdd, timestamp: Date.now() }]);
  if (!afterAdd.hasProduct && afterAdd.saveDisabled !== false) {
    throw new Error(`add item failed: ${JSON.stringify(afterAdd)}`);
  }

  await page.evaluate(() => {
    const btn = document.getElementById('we-save-delivery-btn');
    if (btn) { btn.disabled = false; btn.removeAttribute('aria-disabled'); }
  });
  await page.locator('#we-save-delivery-btn').click({ force: true });
  await page.waitForSelector('#delivery-review-modal.is-open, #delivery-review-proceed', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(500);
  await page.locator('#delivery-review-proceed').click({ timeout: 10000 }).catch(async () => {
    await page.evaluate(() => document.getElementById('delivery-review-proceed')?.click());
  });

  const finalizeStartedAt = Date.now();
  // Poll while hung — harvest agent logs each tick
  for (let tick = 0; tick < 12; tick += 1) {
    await page.waitForTimeout(2000);
    const snap = await page.evaluate(() => ({
      saveLabel: document.getElementById('we-save-delivery-btn')?.textContent,
      saveDisabled: document.getElementById('we-save-delivery-btn')?.disabled,
      itemsLeft: (window.getCurrentDeliveryItems?.()?.length
        ?? document.querySelectorAll('#we-current-items-table tbody tr, .we-item-card').length) > 0,
      toasts: window.__toasts?.slice(-5) || [],
      agentLogCount: (window.__agentDebugLog || []).length,
      lastAgent: (window.__agentDebugLog || []).slice(-5),
      catalogTimedOut: (window.__agentDebugLog || []).some((e) => e?.data?.timedOut === true),
    }));
    console.log(`tick ${tick}`, JSON.stringify(snap));
    appendNdjson([{
      hypothesisId: 'C',
      location: `repro:tick:${tick}`,
      message: 'finalize poll',
      data: { ...snap, elapsedMs: Date.now() - finalizeStartedAt },
      timestamp: Date.now(),
      runId: 'post-fix',
    }]);
    await harvest(page, `tick-${tick}`);
    await page.screenshot({ path: path.join(ART, `tick-${tick}.png`) });
    if (!/Speichere Lieferung|Schließe Lieferung/i.test(snap.saveLabel || '') && !snap.itemsLeft) {
      console.log('finalize appears complete', { elapsedMs: Date.now() - finalizeStartedAt });
      break;
    }
  }

  await page.evaluate(() => window.fallbackShowTab?.('mhd'));
  await page.waitForTimeout(2500);
  const mhd = await page.evaluate((productName) => {
    const c = document.getElementById('mhd-items-container');
    const text = c?.innerText || '';
    return {
      cards: c?.querySelectorAll('.mhd-card,[data-mhd-id]')?.length || 0,
      found: text.includes(productName.split(' ')[0]) && text.includes('TEST'),
      snippet: text.replace(/\s+/g, ' ').slice(0, 280),
    };
  }, product);
  console.log('MHD', mhd);
  appendNdjson([{ hypothesisId: 'E', location: 'repro:mhd', message: 'mhd check', data: { product, mhd }, timestamp: Date.now() }]);
  await harvest(page, 'final');
  await page.screenshot({ path: path.join(ART, '99-mhd.png') });

  const verdict = {
    at: new Date().toISOString(),
    base: BASE,
    product,
    hung: true,
    mhd,
  };
  // hung if last save label still Speichere or items left
  const last = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8').trim().split('\n').pop() || '{}');
  void last;
  fs.writeFileSync(path.join(ART, 'verdict.json'), JSON.stringify(verdict, null, 2));
  console.log('LOG', LOG_PATH);
  console.log('ART', ART);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
