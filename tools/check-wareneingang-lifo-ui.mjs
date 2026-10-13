/**
 * UI smoke: Wareneingang LIFO-Karten + Mengen-Numpad + MHD-Schnelltasten (ohne Login).
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const OUT = '/opt/cursor/artifacts';
const BASE = 'http://127.0.0.1:4173/index.html';

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });

  await page.evaluate(() => {
    document.querySelectorAll('.page').forEach((el) => el.classList.remove('active'));
    const receiving = document.getElementById('page-receiving');
    if (receiving) {
      receiving.classList.add('active');
      receiving.style.display = 'block';
    }
    document.getElementById('login-overlay')?.remove();
    document.getElementById('auth-login-overlay')?.remove();
    document.getElementById('auth-lock-screen')?.remove();
    document.getElementById('pin-auth-modal')?.remove();
    document.getElementById('receiving-profile-gate-overlay')?.remove();
    document.querySelector('.app-container')?.classList.add('is-ready');
    const app = document.querySelector('.app-container');
    if (app) app.style.display = 'block';
    document.body.classList.remove('auth-locked');
  });

  await page.waitForSelector('#we-current-items-table', { timeout: 10000 });
  await page.evaluate(() => {
    ['auth-lock-screen', 'login-overlay', 'auth-login-overlay', 'pin-auth-modal', 'receiving-profile-gate-overlay']
      .forEach((id) => document.getElementById(id)?.remove());
    document.body.classList.remove('auth-locked');
    document.querySelectorAll('.page').forEach((el) => {
      el.classList.remove('active');
      el.style.display = 'none';
    });
    const receiving = document.getElementById('page-receiving');
    if (receiving) {
      receiving.classList.add('active');
      receiving.style.display = 'block';
      receiving.style.visibility = 'visible';
      receiving.style.opacity = '1';
      receiving.style.position = 'relative';
      receiving.style.zIndex = '50';
    }
    const app = document.querySelector('.app-container');
    if (app) {
      app.style.display = 'block';
      app.style.visibility = 'visible';
      app.classList.add('is-ready');
    }
    // Auth-Reste optisch ausblenden, falls App sie neu einhängt.
    const style = document.createElement('style');
    style.textContent = `
      #auth-lock-screen, #login-overlay, #auth-login-overlay, .auth-lock-screen {
        display: none !important; visibility: hidden !important; pointer-events: none !important;
      }
      #page-receiving { display: block !important; }
    `;
    document.head.appendChild(style);
  });

  // Render two LIFO cards via receiving.js helpers (newest first).
  const cardHtml = await page.evaluate(async () => {
    const mod = await import(new URL('./receiving.js', location.href).href);
    const older = {
      id: 'item-old',
      product: 'Bio Joghurt',
      barcode: '4001112223334',
      qtyValue: 1,
      qtyUnit: 'Stk',
      mhdDate: '2026-10-20',
      brand: '',
      addedAt: 1000,
    };
    const newer = {
      id: 'item-new',
      product: 'Frische Gurke',
      barcode: '4005556667778',
      qtyValue: 1,
      qtyUnit: 'Stk',
      mhdDate: '2026-10-16',
      brand: 'Hofgarten',
      addedAt: 2000,
    };
    const ordered = mod.sortDeliveryItemsLifo([older, newer]);
    const table = document.getElementById('we-current-items-table');
    table.innerHTML = ordered.map((item) => mod.buildReceivingItemCardHtml(item)).join('');
    table.querySelector('.we-item-card')?.classList.add('we-item-card--newest');
    return {
      firstName: table.querySelector('.we-item-card .we-item-row-name')?.textContent || '',
      cardCount: table.querySelectorAll('.we-item-card').length,
      hasQty: Boolean(table.querySelector('[data-item-qty-edit]')),
      hasMhdQuick: table.querySelectorAll('[data-item-mhd-add]').length,
      hasRemove: Boolean(table.querySelector('[data-item-remove]')),
    };
  });

  await page.locator('#we-current-items-table').scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(OUT, 'wareneingang-lifo-cards.png'),
    fullPage: false,
  });

  // Open qty numpad / MHD editor via receiving.js (same UI as card taps)
  await page.evaluate(async () => {
    const mod = await import(new URL('./receiving.js', location.href).href);
    mod.openReceivingQtyNumpad({
      id: 'item-new',
      product: 'Frische Gurke',
      qtyValue: 1,
      qtyUnit: 'Stk',
    }, { onConfirm: () => {} });
  });
  await page.waitForSelector('#receiving-qty-numpad-overlay', { timeout: 5000 });
  await page.screenshot({
    path: path.join(OUT, 'wareneingang-qty-numpad.png'),
    fullPage: false,
  });
  await page.evaluate(async () => {
    const mod = await import(new URL('./receiving.js', location.href).href);
    mod.closeReceivingQtyNumpad();
  });
  await page.waitForSelector('#receiving-qty-numpad-overlay', { state: 'detached', timeout: 5000 });

  await page.evaluate(async () => {
    const mod = await import(new URL('./receiving.js', location.href).href);
    mod.openReceivingItemMhdEditor({
      id: 'item-new',
      product: 'Frische Gurke',
      mhdDate: '2026-10-16',
    }, { onConfirm: () => {} });
  });
  await page.waitForSelector('#receiving-mhd-editor-overlay', { timeout: 5000 });
  await page.screenshot({
    path: path.join(OUT, 'wareneingang-mhd-editor.png'),
    fullPage: false,
  });
  await page.evaluate(async () => {
    const mod = await import(new URL('./receiving.js', location.href).href);
    mod.closeReceivingMhdEditor();
  });

  const report = {
    ...cardHtml,
    swCache: await page.evaluate(async () => {
      const text = await fetch('/sw.js').then((r) => r.text());
      const match = text.match(/CACHE_NAME = '([^']+)'/);
      return match?.[1] || null;
    }),
  };
  await fs.writeFile(path.join(OUT, 'wareneingang-lifo-ui-smoke.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  const ok = report.firstName === 'Frische Gurke'
    && report.cardCount === 2
    && report.hasQty
    && report.hasMhdQuick === 6
    && report.hasRemove
    && report.swCache === 'charculogic-v20261013-wareneingang-lifo-v1';

  await browser.close();
  if (!ok) {
    console.error('UI smoke FAILED', report);
    process.exit(1);
  }
  console.log('OK check-wareneingang-lifo-ui');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
