#!/usr/bin/env node
/**
 * Erzeugt Übersichts- und Detail-Screenshots für docs/modulanleitungen/
 * Voraussetzung: python -m http.server 5173 --bind 127.0.0.1 im Ordner web/
 * Aufruf: node tools/capture-module-screenshots.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'docs', 'modulanleitungen', 'screenshots');
const baseUrl = process.env.APP_URL || 'http://127.0.0.1:5173/index.html';

/** @typedef {{ file: string, fullPage?: boolean, prepare: (page: import('playwright').Page) => Promise<void> }} Shot */

function injectTeamboardDemo() {
  const status = document.getElementById('team-login-status');
  if (status) status.textContent = 'Angemeldet als: Stephie';
  const employee = document.getElementById('team-login-employee');
  if (employee) employee.value = 'Stephie';
  const card = document.getElementById('bulletin-card');
  if (card) {
    card.classList.remove('hidden');
    card.innerHTML = `
      <div class="bulletin-card-header">
        <span class="bulletin-card-kicker">Nachricht des Tages</span>
        <span class="bulletin-card-meta">Heute · Meister</span>
      </div>
      <p class="bulletin-card-message">Schlachtplan: Gallo-Patties zuerst. TK-Lager nach Wareneingang prüfen.</p>`;
  }
  const empty = document.getElementById('task-token-empty');
  const list = document.getElementById('task-token-list');
  if (list) {
    list.innerHTML = `
      <article class="task-token task-token--rot">
        <div class="task-token-body">
          <div class="task-token-prio" aria-hidden="true">🔴</div>
          <div class="task-token-text">
            <strong class="task-token-title">MHD-Alarm Frische durchgehen</strong>
            <span class="task-token-route">Frühschicht · bis 09:00</span>
          </div>
        </div>
        <button type="button" class="task-token-done" aria-label="Aufgabe erledigt">✓</button>
      </article>
      <article class="task-token task-token--gelb">
        <div class="task-token-body">
          <div class="task-token-prio" aria-hidden="true">🟡</div>
          <div class="task-token-text">
            <strong class="task-token-title">Lieferschein Metzgerei fotografieren</strong>
            <span class="task-token-route">Alle · heute</span>
          </div>
        </div>
        <button type="button" class="task-token-done" aria-label="Aufgabe erledigt">✓</button>
      </article>`;
    if (empty) empty.classList.add('hidden');
  }
}

/** @type {Shot[]} */
const overviewShots = [
  {
    file: '00-start.png',
    async prepare(page) {
      await page.locator('#tab-teamboard').click({ force: true });
      await page.evaluate(injectTeamboardDemo);
    },
  },
  {
    file: '07-team.png',
    async prepare(page) {
      await page.locator('#tab-team').click({ force: true });
      await page.evaluate(injectTeamboardDemo);
      await page.evaluate(() => {
        const reminder = document.getElementById('team-login-reminder');
        if (reminder) reminder.classList.add('hidden');
        document.getElementById('team-subnav-messages')?.click();
      });
    },
  },
  { file: '01-mhd-monitor.png', async prepare(page) { await page.locator('#tab-mhd').click({ force: true }); } },
  { file: '02-wareneingang-schnell.png', async prepare(page) { await page.locator('#tab-receiving').click({ force: true }); await page.locator('#receiving-mode-schnell').click({ force: true }); } },
  { file: '03-wareneingang-metzgerei.png', async prepare(page) { await page.locator('#tab-receiving').click({ force: true }); await page.locator('#receiving-mode-metzgerei').click({ force: true }); } },
  {
    file: '04-wurstkueche.png',
    async prepare(page) {
      await page.locator('#tab-kitchen').click({ force: true });
      await page.evaluate(() => {
        const recipes = document.getElementById('kitchen-recipes-panel');
        const wrs = document.getElementById('kitchen-wrs-panel');
        if (recipes) recipes.open = true;
        if (wrs) wrs.open = false;
      });
    },
  },
  { file: '05-haccp.png', async prepare(page) { await page.locator('#tab-haccp').click({ force: true }); } },
  { file: '06-chargen.png', async prepare(page) { await page.locator('#tab-batches').click({ force: true }); } },
];

/** @type {Shot[]} */
const detailShots = [
  {
    file: '01b-mhd-karte.png',
    async prepare(page) {
      await page.locator('#tab-mhd').click({ force: true });
      await page.evaluate(() => {
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
          </div>`;
        const toolbar = document.querySelector('.mhd-monitor-toolbar');
        if (toolbar) toolbar.scrollIntoView({ block: 'start' });
      });
    },
  },
  {
    file: '01c-mhd-suche-offen.png',
    async prepare(page) {
      await page.locator('#tab-mhd').click({ force: true });
      await page.evaluate(() => {
        const searchDetails = document.getElementById('mhd-search-details');
        if (searchDetails) searchDetails.open = true;
        const input = document.getElementById('mhd-search-input');
        if (input) input.value = 'milch';
      });
    },
  },
  {
    file: '02b-barcode-scanner.png',
    fullPage: false,
    async prepare(page) {
      await page.locator('#tab-receiving').click({ force: true });
      await page.evaluate(() => {
        const overlay = document.getElementById('scanner-overlay');
        if (!overlay) return;
        overlay.style.display = 'block';
        const video = document.getElementById('preview-video');
        if (video) {
          video.style.background = 'linear-gradient(180deg, #1a1a1a 0%, #2d4a32 100%)';
        }
        const status = document.getElementById('scanner-status-text');
        if (status) status.textContent = 'Barcode ins grüne Feld richten';
      });
    },
  },
  {
    file: '02c-posten-erkannt.png',
    async prepare(page) {
      await page.locator('#tab-receiving').click({ force: true });
      await page.locator('#receiving-mode-schnell').click({ force: true });
      await page.evaluate(() => {
        const ean = document.getElementById('we-ean');
        if (ean) ean.value = '4001234567890';
        const name = document.getElementById('we-product-resolved-name');
        const box = document.getElementById('we-product-resolved');
        if (name) name.textContent = 'Vollmilch 3,5% 1l';
        if (box) box.classList.remove('hidden');
        const wrap = document.getElementById('we-product-manual-wrap');
        if (wrap) wrap.classList.add('hidden');
        const table = document.getElementById('we-current-items-table');
        if (table) {
          table.innerHTML = `
            <div class="we-item-row">
              <div class="we-item-row-main">
                <div class="we-item-row-name">Butter 250g</div>
                <div class="we-item-row-meta">2 kg · MHD 15.06.2026 · EAN 4001122334455</div>
              </div>
              <button type="button" class="we-item-row-remove" aria-label="Posten entfernen">×</button>
            </div>`;
        }
        const count = document.getElementById('receiving-item-count');
        if (count) count.textContent = '1';
      });
    },
  },
  {
    file: '03b-lieferschein-fotos.png',
    async prepare(page) {
      await page.locator('#tab-receiving').click({ force: true });
      await page.locator('#receiving-mode-metzgerei').click({ force: true });
      await page.evaluate(() => {
        const previews = document.getElementById('we-photo-previews');
        if (!previews) return;
        const svg = encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160"><rect fill="#e8e8e8" width="120" height="160"/><text x="8" y="80" font-size="12" fill="#666">Lieferschein</text></svg>',
        );
        previews.innerHTML = `
          <div class="we-photo-thumb">
            <img src="data:image/svg+xml,${svg}" alt="Lieferschein Vorschau">
            <button type="button" class="we-photo-thumb-remove" aria-label="Foto entfernen">×</button>
          </div>
          <div class="we-photo-thumb">
            <img src="data:image/svg+xml,${svg}" alt="Lieferschein Vorschau 2">
            <button type="button" class="we-photo-thumb-remove" aria-label="Foto entfernen">×</button>
          </div>`;
      });
    },
  },
  {
    file: '04b-rezept-detail.png',
    async prepare(page) {
      await page.locator('#tab-kitchen').click({ force: true });
      await page.waitForTimeout(1200);
      const card = page.locator('.recipe-card').first();
      if (await card.count()) {
        await card.click({ force: true });
        await page.waitForTimeout(600);
      } else {
        await page.evaluate(() => {
          const panel = document.getElementById('recipe-detail-panel');
          if (panel) {
            panel.classList.add('active');
            panel.style.display = 'flex';
          }
        });
      }
    },
  },
  {
    file: '05b-haccp-temperaturen.png',
    async prepare(page) {
      await page.locator('#tab-haccp').click({ force: true });
      await page.locator('[data-haccp-mode="temperatur"]').click({ force: true });
      await page.evaluate(() => {
        const container = document.getElementById('haccp-daily-container');
        if (!container || container.children.length > 0) return;
        container.innerHTML = `
          <div class="haccp-task-list">
            <div class="haccp-task-card">
              <div class="haccp-task-title">TK-Lager -18°C</div>
              <div class="haccp-task-meta">Lager · Soll: -22 bis -18 °C</div>
              <div class="haccp-task-actions">
                <input type="number" class="input-text-touch" value="-19" step="0.1" readonly>
                <button type="button" class="btn btn-primary">OK</button>
              </div>
            </div>
            <div class="haccp-task-card">
              <div class="haccp-task-title">Kühlhaus 2°C</div>
              <div class="haccp-task-meta">Produktion · Soll: 0 bis 4 °C</div>
              <div class="haccp-task-actions">
                <input type="number" class="input-text-touch" value="3.5" step="0.1" readonly>
                <button type="button" class="btn btn-primary">OK</button>
              </div>
            </div>
          </div>`;
      });
      await page.locator('#haccp-daily-container').scrollIntoViewIfNeeded();
    },
  },
  {
    file: '05c-haccp-reinigung.png',
    async prepare(page) {
      await page.locator('#tab-haccp').click({ force: true });
      await page.locator('[data-haccp-mode="reinigung"]').click({ force: true });
      await page.evaluate(() => {
        const container = document.getElementById('haccp-daily-container');
        if (!container || container.children.length > 0) return;
        container.innerHTML = `
          <div class="haccp-task-list">
            <div class="haccp-task-card">
              <div class="haccp-task-title">Arbeitsfläche Wurstküche</div>
              <div class="haccp-task-meta">Produktion · Intervall: täglich</div>
              <button type="button" class="btn btn-primary" style="width:100%;margin-top:8px;min-height:48px;">Reinigung erledigt</button>
            </div>
            <div class="haccp-task-card">
              <div class="haccp-task-title">Slicer</div>
              <div class="haccp-task-meta">Verkauf · Intervall: nach Benutzung</div>
              <button type="button" class="btn btn-secondary" style="width:100%;margin-top:8px;min-height:48px;">Reinigung erledigt</button>
            </div>
          </div>`;
      });
      await page.locator('#haccp-daily-container').scrollIntoViewIfNeeded();
    },
  },
  {
    file: '06b-chargen-liste.png',
    async prepare(page) {
      await page.locator('#tab-batches').click({ force: true });
      await page.evaluate(() => {
        const list = document.getElementById('batch-list-container');
        if (!list || list.children.length > 1) return;
        list.innerHTML = `
          <article class="batch-card">
            <div class="batch-card-title">Schwartemagen wolfen</div>
            <div class="recipe-subinfo">CH-2026-0523-A · 27.05.2026</div>
            <div class="batch-card-meta">
              <div><span class="batch-card-label">Menge</span><span class="batch-card-value">12,5 kg</span></div>
              <div><span class="batch-card-label">Macher</span><span class="batch-card-value">Stefan</span></div>
            </div>
          </article>
          <article class="batch-card">
            <div class="batch-card-title">Gallo-Rizo-Patties</div>
            <div class="recipe-subinfo">CH-2026-0520-B · 24.05.2026</div>
            <div class="batch-card-meta">
              <div><span class="batch-card-label">Menge</span><span class="batch-card-value">8,0 kg</span></div>
              <div><span class="batch-card-label">Macher</span><span class="batch-card-value">Anna</span></div>
            </div>
          </article>`;
        document.getElementById('audit-master-count') &&
          (document.getElementById('audit-master-count').textContent = '142');
        const cloud = document.getElementById('audit-cloud-count');
        if (cloud) cloud.textContent = '142';
        const status = document.getElementById('audit-cloud-status');
        if (status) status.textContent = 'Synchron';
      });
    },
  },
];

async function dismissOverlays(page) {
  await page.evaluate(() => {
    const lock = document.getElementById('auth-lock-screen');
    if (lock) {
      lock.style.display = 'none';
      lock.setAttribute('aria-hidden', 'true');
    }
    document
      .querySelectorAll('[class*="update"], .sw-update-banner, #sw-update-banner')
      .forEach((el) => el.remove());
    const qa = document.getElementById('qa-test-panel');
    if (qa) qa.style.display = 'none';
    const scanner = document.getElementById('scanner-overlay');
    if (scanner) scanner.style.display = 'none';
    const recipePanel = document.getElementById('recipe-detail-panel');
    if (recipePanel) {
      recipePanel.classList.remove('active');
      recipePanel.style.display = '';
    }
  });
}

async function captureShot(page, shot) {
  await dismissOverlays(page);
  await shot.prepare(page);
  await page.waitForTimeout(450);
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
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1000);

  for (const shot of overviewShots) {
    await captureShot(page, shot);
  }
  for (const shot of detailShots) {
    await captureShot(page, shot);
  }

  await browser.close();
  console.log(`Screenshots in ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
