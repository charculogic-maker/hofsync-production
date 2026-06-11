#!/usr/bin/env node
/**
 * Screenshots für StevesHof Hofladen (reduzierte Module, kein PIN-Login).
 * Ausgabe im iPhone-Geräterahmen für Anleitungen.
 *
 * Voraussetzung:
 *   cd web && python -m http.server 5173 --bind 127.0.0.1
 *
 * Aufruf:
 *   node tools/capture-steveshof-screenshots.mjs
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureViewportScreenshot, wrapInIphoneFrame } from './screenshot-iphone-frame.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'docs', 'modulanleitungen', 'screenshots');
const baseUrl = process.env.APP_URL || 'http://127.0.0.1:5173/index.html?tenant=StevesHof_Hauptbetrieb';

/** @typedef {{ file: string, fullPage?: boolean, label?: string, prepare: (page: import('playwright').Page) => Promise<void> }} Shot */

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

    const enabledTabs = new Set(['mhd', 'receiving', 'kitchen', 'haccp', 'knowledge']);
    document.querySelectorAll('.nav-item[data-tab]').forEach((tab) => {
      const tabId = tab.getAttribute('data-tab');
      const enabled = enabledTabs.has(tabId);
      tab.hidden = !enabled;
      tab.style.display = enabled ? '' : 'none';
      tab.classList.toggle('active', tabId === 'mhd');
    });

    ['page-teamboard', 'page-team', 'page-batches'].forEach((id) => {
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

  const categorySelect = document.getElementById('mhd-category-select');
  if (categorySelect && categorySelect.options.length <= 1) {
    categorySelect.innerHTML = `
      <option value="all" selected>Alle Kategorien</option>
      <option value="frische">🍎 Frische</option>
      <option value="mopro">🥛 MoPro</option>
      <option value="kuehlware">❄️ Kühlware</option>
      <option value="tk">🧊 TK</option>
      <option value="getraenke">🍺 Getränke</option>
      <option value="trockenware">📦 Trockenware</option>
      <option value="gewuerze">🌿 Gewürze</option>`;
  }

  container.innerHTML = `
    <div class="mhd-card status-critical" id="mhd-card-demo">
      <div class="mhd-action-badge" style="color:#C62828;background:rgba(198,40,40,0.14);border:2px solid #C62828;font-weight:800;font-size:13px;text-align:center;padding:10px 12px;border-radius:10px;margin-bottom:4px;">
        🏷️ 30% RABATT
      </div>
      <div class="mhd-card-header">
        <div class="mhd-product-info">
          <span class="mhd-product-name">Reibekäse Quattro formaggi</span>
          <span class="mhd-product-meta">Bauer Meier · MHD 03.06.2026 · 3 aktive Posten</span>
        </div>
        <div class="mhd-badge" style="color:#C62828;background:rgba(198,40,40,0.14);">1 Tage</div>
      </div>
      <div class="mhd-controls-row">
        <div class="qty-stepper">
          <button class="btn-stepper" type="button">−</button>
          <div class="qty-value-container">
            <input type="number" class="mhd-qty-input" value="1" min="0" step="1" inputmode="numeric" aria-label="Menge">
          </div>
          <button class="btn-stepper" type="button">+</button>
        </div>
        <button class="btn btn-soldout" type="button" aria-label="Als ausverkauft markieren"><span aria-hidden="true">🗑️</span> Ausverkauft</button>
      </div>
      <div class="mhd-action-row">
        <button class="btn-mhd-action" type="button">↩️ Raus</button>
        <button class="btn-mhd-action btn-mhd-action--primary" type="button">✓ OK</button>
        <button class="btn-mhd-action" type="button">🥣 Küche</button>
        <button class="btn-mhd-action" type="button">Box</button>
      </div>
    </div>
    <div class="mhd-card status-warning">
      <div class="mhd-card-header">
        <div class="mhd-product-info">
          <span class="mhd-product-name">Butter 250g</span>
          <span class="mhd-product-meta">Hofeigen · MHD 05.06.2026</span>
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
          <div class="utility-row-meta">Barcode: 4001234567890 · MHD: 15.06.2026 · Menge: 6 · Bauer Meier</div>
          <label class="utility-row-meta" for="recent-receipt-category-demo">Kategorie</label>
          <select class="input-text-touch" id="recent-receipt-category-demo">
            <option>🍎 Frische</option>
            <option selected>🥛 MoPro</option>
            <option>❄️ Kühlware</option>
            <option>🧊 TK</option>
            <option>🍺 Getränke</option>
            <option>📦 Trockenware</option>
            <option>🌿 Gewürze</option>
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
    label: 'MHD · StevesHof',
    async prepare(page) {
      await injectSteveshofTerminalDemo(page);
      await page.locator('#tab-mhd').click({ force: true });
      await page.evaluate(injectMhdDemoCard);
    },
  },
  {
    file: 'steveshof-02-neu-wareneingang.png',
    label: 'Neu · StevesHof',
    async prepare(page) {
      await injectSteveshofTerminalDemo(page);
      await page.locator('#tab-receiving').click({ force: true });
      await page.locator('#receiving-mode-schnell').click({ force: true });
      await page.evaluate(() => {
        const select = document.getElementById('we-category-quick');
        if (select) {
          select.innerHTML = `
            <option value="">-- Kategorie wählen --</option>
            <option value="🍎 Frische">🍎 Frische</option>
            <option value="🥛MoPro" selected>🥛 MoPro</option>
            <option value="🥗 Kühlware">❄️ Kühlware</option>
            <option value="🧊 TK">🧊 TK</option>
            <option value="🍺 Getränke">🍺 Getränke</option>
            <option value="📦 Trockenware">📦 Trockenware</option>
            <option value="🌿 Gewürze">🌿 Gewürze</option>`;
        }
        document.getElementById('header-title').textContent = 'Wareneingang';
        document.getElementById('header-subtitle').textContent = 'Laden · Barcode erfassen';
        const ean = document.getElementById('we-ean');
        if (ean) ean.value = '4001234567890';
        const resolved = document.getElementById('we-product-resolved');
        const resolvedName = document.getElementById('we-product-resolved-name');
        if (resolved) resolved.classList.remove('hidden');
        if (resolvedName) resolvedName.textContent = 'Vollmilch 3,5% 1l';
        const productName = document.getElementById('we-product-name');
        if (productName) productName.value = 'Vollmilch 3,5% 1l';
        const brand = document.getElementById('we-hersteller-zusatz');
        if (brand) brand.value = 'Bauer Meier';
        const qty = document.getElementById('we-qty');
        if (qty) qty.value = '6';
        const mhd = document.getElementById('we-mhd');
        if (mhd) mhd.value = '2026-06-15';
        const deliveryParserBtn = document.getElementById('btn-delivery-parser');
        if (deliveryParserBtn) deliveryParserBtn.hidden = true;
        document.getElementById('we-hersteller-zusatz')?.scrollIntoView({ block: 'center' });
      });
      await page.waitForTimeout(200);
    },
  },
  {
    file: '02b-barcode-scanner.png',
    fullPage: false,
    label: 'Scanner',
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
    label: 'Letzte Eingänge',
    async prepare(page) {
      await injectSteveshofTerminalDemo(page);
      await page.locator('#tab-receiving').click({ force: true });
      await page.evaluate(injectRecentReceiptsDialog);
    },
  },
  {
    file: 'steveshof-04-prod.png',
    label: 'Prod. · StevesHof',
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
  {
    file: 'steveshof-05-haccp.png',
    label: 'HACCP · StevesHof',
    async prepare(page) {
      await injectSteveshofTerminalDemo(page);
      await page.locator('#tab-haccp').click({ force: true });
      await page.evaluate(() => {
        document.getElementById('header-title').textContent = 'HACCP-Protokoll';
        document.getElementById('header-subtitle').textContent = 'StevesHof Hofladen';
        const container = document.getElementById('haccp-daily-container');
        if (!container) return;
        container.innerHTML = `
          <article class="haccp-daily-station-card">
            <h3 class="haccp-daily-station-title">Kühlauslage Hofladen</h3>
            <p class="haccp-daily-station-hint">Alles gut bis 7 °C.</p>
            <div class="haccp-daily-input-row">
              <input type="text" class="gastro-input haccp-daily-temp-input" value="3,5" inputmode="decimal" aria-label="Temperatur in Grad Celsius">
              <span class="haccp-daily-unit">°C</span>
              <button type="button" class="btn btn-primary">Speichern</button>
            </div>
            <p class="haccp-daily-last">Heute, 08:30 – 3,5 °C (in Ordnung)</p>
          </article>
          <article class="haccp-daily-station-card">
            <h3 class="haccp-daily-station-title">MoPro-Kühlung</h3>
            <p class="haccp-daily-station-hint">Alles gut bis 7 °C.</p>
            <div class="haccp-daily-input-row">
              <input type="text" class="gastro-input haccp-daily-temp-input" placeholder="____" inputmode="decimal" aria-label="Temperatur in Grad Celsius">
              <span class="haccp-daily-unit">°C</span>
              <button type="button" class="btn btn-primary">Speichern</button>
            </div>
          </article>`;
        const exportCard = document.querySelector('.haccp-export-card');
        if (exportCard) exportCard.style.display = 'none';
        const legacyCard = document.querySelector('.haccp-legacy-production-card');
        if (legacyCard) legacyCard.style.display = 'none';
      });
      await page.waitForTimeout(300);
    },
  },
  {
    file: 'steveshof-06-wissen.png',
    label: 'Wissen · StevesHof',
    async prepare(page) {
      await injectSteveshofTerminalDemo(page);
      await page.locator('#tab-knowledge').click({ force: true });
      await page.evaluate(() => {
        document.getElementById('header-title').textContent = 'Wissen';
        document.getElementById('header-subtitle').textContent = 'StevesHof Hofladen';
        const pageEl = document.getElementById('page-knowledge');
        if (pageEl) {
          pageEl.classList.add('active');
          pageEl.style.display = 'block';
          pageEl.hidden = false;
        }
        document.querySelectorAll('.knowledge-accordion').forEach((details, index) => {
          details.open = index === 0;
        });
        const list = document.getElementById('cut-glossary-list');
        const empty = document.getElementById('cut-glossary-empty');
        if (list && !list.children.length) {
          list.innerHTML = `
            <article class="cut-card">
              <h3 class="cut-card-title">Oberschale (Rind)</h3>
              <p class="cut-card-meta">Kurzbraten · Schulter · mager</p>
            </article>
            <article class="cut-card">
              <h3 class="cut-card-title">Schweinenacken</h3>
              <p class="cut-card-meta">Grillen · Schmorbraten · durchwachsen</p>
            </article>`;
        }
        if (empty) empty.hidden = true;
        const count = document.getElementById('cut-glossary-count');
        if (count) count.textContent = '2 Zuschnitte';
      });
      await page.waitForTimeout(400);
    },
  },
];

async function captureShot(page, context, shot) {
  await page.evaluate(() => {
    document.querySelector('.learn-mode-overlay')?.remove();
    const scanner = document.getElementById('scanner-overlay');
    if (scanner) scanner.style.display = 'none';
  });
  await shot.prepare(page);
  await page.waitForTimeout(500);

  const raw = await captureViewportScreenshot(page, { fullPage: shot.fullPage === true });
  const framed = await wrapInIphoneFrame(context, raw, { label: shot.label });
  await writeFile(path.join(outDir, shot.file), framed);
  console.log(`OK ${shot.file}`);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 60000 }).catch(() =>
    page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }),
  );
  await page.waitForTimeout(1500);

  for (const shot of shots) {
    await captureShot(page, context, shot);
  }

  await browser.close();
  console.log(`\nStevesHof-Screenshots (iPhone-Rahmen) gespeichert in:\n${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
