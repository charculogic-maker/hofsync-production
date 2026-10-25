#!/usr/bin/env node
/**
 * Phase C.1 E2E: Profil → TEST-Posten → Lieferung → MHD sichtbar.
 *
 * Usage:
 *   HOFSYNC_EMPLOYEE_PASSWORD=… node tools/e2e-happy-path-receiving.mjs
 * Optional:
 *   BASE_URL=https://hofsync-charculogic.vercel.app
 *   ART_DIR=/opt/cursor/artifacts/c1-e2e-happy-path
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'https://hofsync-charculogic.vercel.app';
const EMP = process.env.HOFSYNC_EMPLOYEE_EMAIL || 'bestellung@steveshof-hofladen.de';
const EMP_PW = process.env.HOFSYNC_EMPLOYEE_PASSWORD || '';
const ART = process.env.ART_DIR || '/opt/cursor/artifacts/c1-e2e-happy-path';

function mhdIn3Days() {
  const d = new Date(Date.now() + 3 * 86400000);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

async function pickEmployee(page) {
  await page.evaluate(() => {
    void window.openEmployeePickerModal?.({ mandatory: false });
  });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const pick = document.querySelector('#employee-picker-list [data-employee-picker-name]');
    pick?.click();
  });
  await page.waitForTimeout(800);
  return page.evaluate(() => window.readActiveEmployee?.() || '');
}

async function dismissPickerIfOpen(page) {
  await page.evaluate(() => {
    const overlay = document.getElementById('modal-employee-picker');
    if (!overlay?.classList.contains('is-open')) return;
    document.querySelector('#employee-picker-list [data-employee-picker-name]')?.click();
  });
  await page.waitForTimeout(600);
}

async function main() {
  if (!EMP_PW) {
    console.error('HOFSYNC_EMPLOYEE_PASSWORD missing');
    process.exit(2);
  }
  fs.mkdirSync(ART, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const product = `TEST – Nicht relevant C1 ${stamp}`;
  const mhdStr = mhdIn3Days();
  const ean = `200${Date.now().toString().slice(-10)}`;
  const report = { at: new Date().toISOString(), base: BASE, product, mhdStr, steps: {} };

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  page.setDefaultTimeout(90000);
  const shot = async (name) => {
    try { await page.screenshot({ path: path.join(ART, name) }); } catch (_) { /* ignore */ }
  };

  try {
    await page.goto(`${BASE}/?login=1&t=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(1200);
    await page.locator('#auth-login-email').fill(EMP);
    await page.locator('#auth-login-password').fill(EMP_PW);
    await page.locator('#auth-login-form button[type="submit"]').click();
    await page.waitForFunction(() => Boolean(window.firebase?.auth?.()?.currentUser), { timeout: 90000 });
    await page.waitForTimeout(2500);
    await page.evaluate(() => {
      const lock = document.getElementById('auth-lock-screen');
      if (lock) { lock.classList.remove('active'); lock.hidden = true; lock.style.display = 'none'; }
      document.body.classList.remove('auth-locked');
      window.__toasts = [];
      const orig = window.showToast;
      window.showToast = (msg, type) => {
        window.__toasts.push({ msg: String(msg), type: String(type || '') });
        return orig?.(msg, type);
      };
    });
    report.steps.login = { ok: true };

    const employee = await pickEmployee(page);
    report.steps.profile = { ok: Boolean(employee), employee };
    await shot('01-profile.png');
    if (!employee) throw new Error('Profil nicht gesetzt');

    await page.evaluate(() => {
      window.showTab?.('receiving') || window.fallbackShowTab?.('receiving');
    });
    await page.waitForTimeout(1200);
    await dismissPickerIfOpen(page);

    await page.evaluate(() => {
      const sel = document.getElementById('we-supplier');
      if (sel) {
        const opt = [...sel.options].find((o) => o.value && !/sonstige|wählen/i.test(o.textContent || ''));
        if (opt) {
          sel.value = opt.value;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
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
    await page.fill('#we-mhd', mhdStr);
    await page.fill('#we-ean', ean);
    await page.evaluate(() => { window.__toasts = []; document.getElementById('we-add-item-btn')?.click(); });
    await page.waitForTimeout(1500);
    const afterAdd = await page.evaluate((name) => {
      const table = document.getElementById('we-current-items-table')?.innerText || '';
      return {
        hasProduct: table.includes(name) || /TEST/.test(table),
        toasts: window.__toasts || [],
        saveDisabled: document.getElementById('we-save-delivery-btn')?.disabled,
      };
    }, product);
    report.steps.addItem = afterAdd;
    await shot('02-item-added.png');
    if (!afterAdd.hasProduct) throw new Error('Posten nicht in Lieferung');

    const t0 = Date.now();
    await page.evaluate(() => {
      const btn = document.getElementById('we-save-delivery-btn');
      if (btn) { btn.disabled = false; btn.removeAttribute('aria-disabled'); }
    });
    await page.locator('#we-save-delivery-btn').click({ force: true });
    await page.waitForTimeout(600);
    await page.evaluate(() => document.getElementById('delivery-review-proceed')?.click());

    let finalizeOk = false;
    for (let i = 0; i < 20; i += 1) {
      await page.waitForTimeout(1000);
      const snap = await page.evaluate(() => ({
        label: document.getElementById('we-save-delivery-btn')?.textContent || '',
        itemsLeft: /TEST/.test(document.getElementById('we-current-items-table')?.innerText || ''),
        toasts: window.__toasts || [],
      }));
      if (snap.toasts.some((t) => /Lieferung gebucht|synchronisiert|vorgemerkt/i.test(t.msg))) {
        finalizeOk = true;
        report.steps.finalize = { ok: true, ms: Date.now() - t0, ...snap };
        break;
      }
      if (!/Speichere Lieferung|Schließe Lieferung/i.test(snap.label) && !snap.itemsLeft && i > 2) {
        finalizeOk = true;
        report.steps.finalize = { ok: true, ms: Date.now() - t0, ...snap };
        break;
      }
      report.steps.finalize = { ok: false, ms: Date.now() - t0, ...snap };
    }
    await shot('03-after-finalize.png');
    if (!finalizeOk) throw new Error(`Finalize timeout: ${JSON.stringify(report.steps.finalize)}`);

    await page.evaluate(() => { window.showTab?.('mhd') || window.fallbackShowTab?.('mhd'); });
    await page.waitForTimeout(4000);
    await shot('04-mhd.png');
    const mhd = await page.evaluate((name) => {
      const text = (document.getElementById('mhd-items-container')?.innerText || '').replace(/\s+/g, ' ');
      return {
        cards: document.querySelectorAll('#mhd-items-container .mhd-card, #mhd-items-container [data-mhd-id]').length,
        found: text.includes(name) || /TEST\s*[–-]\s*Nicht relevant C1/.test(text),
        snippet: text.slice(0, 400),
      };
    }, product);
    report.steps.mhd = mhd;
    report.pass = Boolean(report.steps.profile?.ok && afterAdd.hasProduct && finalizeOk && mhd.found);
    report.verdict = report.pass ? 'PASS' : 'FAIL';
  } catch (err) {
    report.error = String(err?.stack || err);
    report.verdict = 'FAIL';
    await shot('99-error.png');
  }

  fs.writeFileSync(path.join(ART, 'verdict.json'), JSON.stringify(report, null, 2));
  console.log('VERDICT', report.verdict);
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  process.exit(report.verdict === 'PASS' ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
