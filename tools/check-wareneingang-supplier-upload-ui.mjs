/**
 * UI smoke: Wareneingang Lieferant-Kopf + Modal + Upload-Accept (ohne Firebase-Login).
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

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
    document.getElementById('pin-auth-modal')?.remove();
    document.querySelector('.app-container')?.classList.add('is-ready');
    const app = document.querySelector('.app-container');
    if (app) app.style.display = 'block';
    document.body.classList.remove('auth-locked');
  });

  await page.waitForSelector('#we-supplier', { timeout: 10000 });
  const supplierOptions = await page.$$eval('#we-supplier option', (opts) =>
    opts.map((o) => ({ value: o.value, label: o.textContent.trim() })),
  );
  const acceptParser = await page.getAttribute('#delivery-parser-file-input', 'accept');
  const acceptNote = await page.getAttribute('#delivery-note-file-input', 'accept');
  const acceptPhoto = await page.getAttribute('#we-photo-input', 'accept');
  const captureParser = await page.getAttribute('#delivery-parser-file-input', 'capture');
  const capturePhoto = await page.getAttribute('#we-photo-input', 'capture');

  await page.locator('#we-supplier').scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(OUT, 'wareneingang_supplier_dropdown_mobile.png'),
    fullPage: false,
  });

  await page.evaluate(() => {
    const modal = document.getElementById('supplier-pick-modal');
    if (!modal) return;
    modal.hidden = false;
    modal.classList.add('is-open');
  });
  await page.waitForSelector('#supplier-pick-modal.is-open', { timeout: 5000 });
  await page.screenshot({
    path: path.join(OUT, 'wareneingang_supplier_pick_modal.png'),
    fullPage: false,
  });

  const report = {
    supplierOptions,
    acceptParser,
    acceptNote,
    acceptPhoto,
    captureParser,
    capturePhoto,
    modalVisible: await page.isVisible('#supplier-pick-modal.is-open'),
    eigenproduktionVisible: await page.isVisible('#we-eigenproduktion-btn'),
    uploadStatusExists: await page.locator('#we-photo-upload-status').count(),
  };
  await fs.writeFile(path.join(OUT, 'wareneingang_ui_smoke.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  const ok =
    supplierOptions.some((o) => o.value === 'Weiling')
    && supplierOptions.some((o) => o.value === 'Naturverbund')
    && supplierOptions.some((o) => o.value === 'Stautenhof')
    && supplierOptions.some((o) => o.value === '__sonstige__')
    && acceptParser === 'application/pdf,image/*'
    && acceptNote === 'application/pdf,image/*'
    && acceptPhoto === 'application/pdf,image/*'
    && !captureParser
    && !capturePhoto
    && report.modalVisible;

  await browser.close();
  if (!ok) {
    console.error('UI smoke checks failed');
    process.exit(1);
  }
  console.log('UI smoke OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
