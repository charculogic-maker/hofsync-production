#!/usr/bin/env node
/**
 * Screenshots für StevesHof Hofladen (reduzierte Module, kein PIN-Login).
 *
 * Voraussetzung:
 *   cd web && python -m http.server 5173 --bind 127.0.0.1
 *
 * Aufruf:
 *   node tools/capture-steveshof-screenshots.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'docs', 'modulanleitungen', 'screenshots');
const baseUrl = process.env.APP_URL || 'http://127.0.0.1:5173/index.html?tenant=StevesHof_Hauptbetrieb';

/** @typedef {{ file: string, fullPage?: boolean, prepare: (page: import('playwright').Page) => Promise<void> }} Shot */

async function injectSteveshofTerminalDemo(page) {
  await page.evaluate(() => {
    const lock = document.getElementById('auth-lock-screen');
    if (lock) {
      lock.classList.remove('active');
      lock.style.display = 'none';
      lock.style.visibility = 'hidden';
      lock.style.pointerEvents = 'none';
      lock.setAttribute('aria-hidden', 'true');
    }
    document
      .querySelectorAll('[class*="update"], .sw-update-banner, #sw-update-banner')
      .forEach((el) => el.remove());
    const qa = document.getElementById('qa-test-panel');
    if (qa) qa.style.display = 'none';

    document.documentElement.dataset.fixedTerminal = 'steveshof';
    document.documentElement.dataset.authenticatedTenant = 'StevesHof_Hauptbetrieb';

    if (typeof window.applyResolvedBranding === 'function') {
      window.applyResolvedBranding('StevesHof_Hauptbetrieb');
    } else if (typeof window.applyBranding === 'function') {
      window.applyBranding();
    }

    const enabledTabs = new Set(['mhd', 'receiving', 'kitchen']);
    document.querySelectorAll('.nav-item[data-tab]').forEach((tab) => {
      const tabId = tab.getAttribute('data-tab');
      const enabled = enabledTabs.has(tabId);
      tab.hidden = !enabled;
      tab.style.display = enabled ? '' : 'none';
      tab.classList.toggle('active', tabId === 'mhd');
    });

    ['page-teamboard', 'page-team', 'page-haccp', 'page-batches'].forEach((id) => {
      const pageEl = document.getElementById(id);
      if (pageEl) {
        pageEl.classList.remove('active');
        pageEl.style.display = 'none';
        pageEl.hidden = true;
      }
    });

    const showPage = (id) => {
      document.querySelectorAll('.page').forEach((pageEl) => {
        const on = pageEl.id === id;
        pageEl.classList.toggle('active', on);
        pageEl.style.display = on ? 'block' : 'none';
        pageEl.hidden = !on;
      });
    };
    showPage('page-mhd');

    const teamLoginCard = document.getElementById('team-login-card');
    if (teamLoginCard) teamLoginCard.hidden = true;

    const headerLogout = document.getElementById('header-logout-btn');
    if (headerLogout) headerLogout.style.display = 'none';

    const employeeBadge = document.getElementById('employee-session-badge');
    if (employeeBadge) employeeBadge.style.display = 'none';

    const metzgereiTab = document.getElementById('receiving-mode-metzgerei');
    const metzgereiPanel = document.getElementById('receiving-panel-metzgerei');
    if (metzgereiTab) metzgereiTab.hidden = true;
    if (metzgereiPanel) metzgereiPanel.hidden = true;

    const headerTitle = document.getElementById('header-title');
    const headerSubtitle = document.getElementById('header-subtitle');
    if (headerTitle) headerTitle.textContent = 'MHD-Monitor';
    if (headerSubtitle) headerSubtitle.textContent = 'Qualitätssicherung';

    const appContent = document.getElementById('app-content');
    if (appContent) appContent.style.display = '';
  });
}

function injectMhdDemoCard() {
  const container = document.getElementById('mhd-items-container');
  if (!container) return;
  container.innerHTML = `
    <div class="mhd-card status-critical" id="mhd-card-demo">
      <div class="mhd-action-badge" style="color:#C62828;background:rgba(198,40,40,0.14);border:2px solid #C62828;font-weight:800;font-size:13px;text-align:center;padding:10px 12px;border-radius:10px;margin-bottom:4px;">
        🏷️ 30% RABATT
      </div>
      <div class="mhd-card-header">
        <div class="mhd-product-info">
          <span class="mhd-product-name">Vollmilch 3,5% 1l</span>
          <span class="mhd-product-meta">Bauer Meier · MHD 28.05.2026 · 2 aktive Posten</span>
        </div>
        <div class="mhd-badge" style="color:#C62828;background:rgba(198,40,40,0.14);">1 Tage</div>
      </div>
      <div class="mhd-controls-row">
        <div class="qty-stepper">
          <button class="btn-stepper" type="button">−</button>
          <div class="qty-value-container"><span>4</span></div>
          <button class="btn-stepper" type="button">+</button>
        </div>
        <button class="btn btn-soldout" type="button">🗑️ Ausverkauft</button>
      </div>
      <div class="mhd-action-row">
        <button class="btn-mhd-action" type="button">↩️ Raus</button>
        <button class="btn-mhd-action btn-mhd-action--primary" type="button">✓ OK</button>
        <button class="btn-mhd-action" type="button">🥣 Küche</button>
      </div>
    </div>
    <div class="mhd-card status-warning">
      <div class="mhd-card-header">
        <div class="mhd-product-info">
          <span class="mhd-product-name">Butter 250g</span>
          <span class="mhd-product-meta">Hofeigen · MHD 02.06.2026</span>
        </div>
        <div class="mhd-badge" style="color:#EA580C;background:rgba(234,88,12,0.12);">3 Tage</div>
      </div>
      <div class="mhd-action-row">
        <button class="btn-mhd-action" type="button">↩️ Raus</button>
        <button class="btn-mhd-action btn-mhd-action--primary" type="button">✓ OK</button>
        <button class="btn-mhd-action" type="button">🥣 Küche</button>
      </div>
    </div>`;
}

function injectRecentReceiptsDialog() {
  document.querySelector('.learn-mode-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'learn-mode-overlay';
  overlay.innerHTML = `
    <div class="learn-mode-card" role="dialog" aria-modal="true">
      <div class="learn-mode-title">Letzte Eingänge</div>
      <p class="learn-mode-desc">Zum Korrigieren oder Löschen von Test- und Fehleinträgen.</p>
      <div class="utility-list">
        <div class="utility-row recent-receipt-row">
          <div class="utility-row-title">Gouda Scheiben 200g</div>
          <div class="utility-row-meta">Barcode: 4001234567890 · MHD: 15.06.2026 · Menge: 6</div>
          <label class="utility-row-meta" for="recent-receipt-category-demo">Kategorie</label>
          <select class="input-text-touch" id="recent-receipt-category-demo">
            <option>📦 Trockenware</option>
            <option selected>🥛 MoPro</option>
            <option>🍎 Frische</option>
            <option>🧊 TK</option>
          </select>
          <div class="utility-row-actions recent-receipt-actions">
            <button type="button" class="btn btn-secondary recent-receipt-action recent-receipt-action--save">Kategorie speichern</button>
            <button type="button" class="btn-danger-small recent-receipt-action">Löschen</button>
          </div>
        </div>
      </div>
      <div class="learn-mode-actions">
        <button type="button" class="btn" style="width:100%;min-height:52px;margin-top:8px;background:#E5E5EA;color:#1C1C1E;">Schließen</button>
      </div>
    </div>`;
  document.querySelector('.app-container')?.appendChild(overlay);
}

/** @type {Shot[]} */
const shots = [
  {
    file: 'steveshof-01-mhd-start.png',
    async prepare(page) {
      await injectSteveshofTerminalDemo(page);
      await page.locator('#tab-mhd').click({ force: true });
      await page.evaluate(injectMhdDemoCard);
      await page.evaluate(() => {
        document.getElementById('header-title').textContent = 'MHD-Monitor';
        document.getElementById('header-subtitle').textContent = 'Qualitätssicherung';
      });
    },
  },
  {
    file: 'steveshof-02-neu-wareneingang.png',
    async prepare(page) {
      await injectSteveshofTerminalDemo(page);
      await page.locator('#tab-receiving').click({ force: true });
      await page.locator('#receiving-mode-schnell').click({ force: true });
      await page.evaluate(() => {
        document.getElementById('header-title').textContent = 'Wareneingang';
        document.getElementById('header-subtitle').textContent = 'Laden · Barcode erfassen';
        const category = document.getElementById('we-category');
        if (category) category.value = '🥛MoPro';
        const ean = document.getElementById('we-ean');
        if (ean) ean.placeholder = 'EAN scannen oder eingeben';
      });
    },
  },
  {
    file: '02b-barcode-scanner.png',
    fullPage: false,
    async prepare(page) {
      await injectSteveshofTerminalDemo(page);
      await page.locator('#tab-receiving').click({ force: true });
      await page.evaluate(() => {
        const overlay = document.getElementById('scanner-overlay');
        if (!overlay) return;
        overlay.style.display = 'block';
        const video = document.getElementById('preview-video');
        if (video) video.style.background = 'linear-gradient(180deg, #3E2723 0%, #5D4037 100%)';
        const status = document.getElementById('scanner-status-text');
        if (status) status.textContent = 'Barcode ins grüne Feld richten';
      });
    },
  },
  {
    file: 'steveshof-04-letzte-eingaenge-korrigieren.png',
    async prepare(page) {
      await injectSteveshofTerminalDemo(page);
      await page.locator('#tab-receiving').click({ force: true });
      await page.evaluate(injectRecentReceiptsDialog);
    },
  },
  {
    file: 'steveshof-04-prod.png',
    async prepare(page) {
      await injectSteveshofTerminalDemo(page);
      await page.locator('#tab-kitchen').click({ force: true });
      await page.evaluate(() => {
        document.getElementById('header-title').textContent = 'Wurstküche';
        document.getElementById('header-subtitle').textContent = 'Rezepte & Produktion';
        const recipes = document.getElementById('kitchen-recipes-panel');
        const wrs = document.getElementById('kitchen-wrs-panel');
        if (recipes) recipes.open = true;
        if (wrs) wrs.open = false;
        const list = document.getElementById('recipe-list-container');
        if (list && !list.children.length) {
          list.innerHTML = `
            <article class="recipe-card" data-recipe-id="demo-1">
              <div class="recipe-card-title">Gallo-Rizo-Patties</div>
              <div class="recipe-card-meta">Wurst · 12,5 kg Basis</div>
            </article>
            <article class="recipe-card" data-recipe-id="demo-2">
              <div class="recipe-card-title">Schwartemagen wolfen</div>
              <div class="recipe-card-meta">Wurst · 10 kg Basis</div>
            </article>`;
        }
      });
      await page.waitForTimeout(600);
    },
  },
];

async function captureShot(page, shot) {
  await page.evaluate(() => {
    document.querySelector('.learn-mode-overlay')?.remove();
    const scanner = document.getElementById('scanner-overlay');
    if (scanner) scanner.style.display = 'none';
  });
  await shot.prepare(page);
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(outDir, shot.file),
    fullPage: shot.fullPage !== false,
  });
  console.log(`OK ${shot.file}`);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 60000 }).catch(() =>
    page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }),
  );
  await page.waitForTimeout(1500);

  for (const shot of shots) {
    await captureShot(page, shot);
  }

  await browser.close();
  console.log(`\nStevesHof-Screenshots gespeichert in:\n${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
