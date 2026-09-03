#!/usr/bin/env node
/**
 * Smartphone-Screenshots aller Betriebs-Module (iPhone 15 Pro).
 *
 * Aufruf:
 *   npm run screenshots:all-modules
 *   node scripts/capture-all-modules.js
 *
 * Ausgabe: charculogic-web/public/landing/modules/*.png
 */
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const WEB_DIR = path.join(ROOT, 'web');
const OUT_DIR = path.join(ROOT, 'charculogic-web', 'public', 'landing', 'modules');

const IPHONE_15_PRO = {
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
};

const LOCAL_ORIGIN = process.env.APP_URL || 'http://127.0.0.1:5173';
const LIVE_FALLBACK = process.env.HOFSYNC_URL || 'https://hofsync-production.web.app/';
const SETTLE_MS = Number(process.env.SCREENSHOT_SETTLE_MS || 1100);

const BRANDING = {
  appName: 'CharcuLogicOS',
  betriebsName: 'CharcuLogic',
  primaryColor: '#2E7D32',
  primaryColorHover: '#1B5E20',
  darkHeaderBg: '#1B4332',
  accentAlert: '#C62828',
  textOnHeader: '#ffffff',
};

const ENABLED_TABS = ['teamboard', 'mhd', 'receiving', 'chargenDoku', 'kitchen', 'haccp', 'batches'];

const MODULES = [
  {
    file: '01_dashboard.png',
    tabId: 'teamboard',
    pageId: 'page-teamboard',
    title: 'Start',
    subtitle: 'Betriebs-Leitstand',
    prepare: prepareDashboard,
  },
  {
    file: '02_mhd_monitor.png',
    tabId: 'mhd',
    pageId: 'page-mhd',
    title: 'MHD-Monitor',
    subtitle: 'Ablaufkontrolle',
    prepare: prepareMhd,
  },
  {
    file: '03_wareneingang.png',
    tabId: 'receiving',
    pageId: 'page-receiving',
    title: 'Wareneingang',
    subtitle: 'Fleisch & Lieferschein',
    prepare: prepareReceiving,
  },
  {
    file: '04_haccp_ccp.png',
    tabId: 'haccp',
    pageId: 'page-haccp',
    title: 'HACCP-Protokoll',
    subtitle: 'Temperatur & CCP',
    prepare: prepareHaccp,
  },
  {
    file: '05_rezepte_wrs.png',
    tabId: 'kitchen',
    pageId: 'page-kitchen',
    title: 'Prod.',
    subtitle: 'WRS & BEFFE',
    prepare: prepareKitchenWrs,
  },
  {
    file: '06_chargen_archiv.png',
    tabId: 'batches',
    pageId: 'page-batches',
    title: 'Chargen-Archiv',
    subtitle: 'Rückverfolgbarkeit',
    prepare: prepareBatches,
  },
  {
    file: '07_thekenbuch.png',
    tabId: 'chargenDoku',
    pageId: 'page-chargen-doku',
    title: 'Thekenbuch',
    subtitle: 'LMIV-Herkunft',
    prepare: prepareThekenbuch,
  },
];

function log(message) {
  process.stdout.write(`${message}\n`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isHttpOk(url, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(Boolean(res.statusCode && res.statusCode < 500));
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

async function ensureLocalServer() {
  const probe = `${LOCAL_ORIGIN.replace(/\/$/, '')}/index.html`;
  if (await isHttpOk(probe)) {
    log(`Dev-Server bereits erreichbar: ${LOCAL_ORIGIN}`);
    return null;
  }

  log(`Starte lokalen Dev-Server in ${WEB_DIR} auf Port 5173 …`);
  const child = spawn(
    'python3',
    ['-m', 'http.server', '5173', '--bind', '127.0.0.1'],
    { cwd: WEB_DIR, stdio: 'ignore', detached: false },
  );

  for (let i = 0; i < 20; i += 1) {
    await wait(250);
    if (await isHttpOk(probe)) {
      log('Dev-Server bereit.');
      return child;
    }
  }

  child.kill('SIGTERM');
  throw new Error(`Lokaler Dev-Server unter ${probe} nicht erreichbar.`);
}

async function dismissOverlays(page) {
  await page.evaluate(() => {
    try {
      sessionStorage.setItem('charculogic_prefer_phone_shell', '1');
    } catch (_) { /* noop */ }

    const lock = document.getElementById('auth-lock-screen');
    if (lock) {
      lock.classList.remove('active');
      lock.style.display = 'none';
      lock.style.visibility = 'hidden';
      lock.style.pointerEvents = 'none';
      lock.setAttribute('aria-hidden', 'true');
    }
    document.body?.classList.remove('auth-lock-open', 'app-shell-sidebar', 'desktop-wide-layout');

    const boot = document.getElementById('dev-dashboard-boot-fallback');
    if (boot) boot.remove();

    document
      .querySelectorAll(
        '[class*="update"], .sw-update-banner, #sw-update-banner, .firebase-emulator-warning',
      )
      .forEach((el) => el.remove());

    document.querySelectorAll('body > div, body > iframe').forEach((el) => {
      const text = (el.textContent || '').toLowerCase();
      if (text.includes('emulator mode') || text.includes('production credentials')) {
        el.remove();
      }
    });

    const qa = document.getElementById('qa-test-panel');
    if (qa) qa.style.display = 'none';
    const scanner = document.getElementById('scanner-overlay');
    if (scanner) scanner.style.display = 'none';
    const toasts = document.getElementById('toast-container');
    if (toasts) toasts.remove();
    const hud = document.getElementById('hud-overlay');
    if (hud) {
      hud.classList.remove('active');
      hud.style.display = 'none';
    }
    const recipePanel = document.getElementById('recipe-detail-panel');
    if (recipePanel) {
      recipePanel.classList.remove('active');
      recipePanel.style.display = '';
    }
    const officeLock = document.getElementById('office-access-lock');
    if (officeLock) {
      officeLock.classList.add('hidden');
      officeLock.hidden = true;
      officeLock.style.display = 'none';
    }
    const officeContent = document.getElementById('office-access-content');
    if (officeContent) {
      officeContent.style.display = '';
      officeContent.hidden = false;
    }
  });
}

async function applyShotBranding(page) {
  await page.evaluate((next) => {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', next.primaryColor);
    root.style.setProperty('--primary-color-hover', next.primaryColorHover);
    root.style.setProperty('--dark-header-bg', next.darkHeaderBg);
    root.style.setProperty('--accent-alert', next.accentAlert);
    root.style.setProperty('--header-text', next.textOnHeader);

    window.BRANDING = { ...(window.BRANDING || {}), ...next };
    if (typeof window.applyBranding === 'function') window.applyBranding();

    document.querySelectorAll('.brand-app-name').forEach((el) => {
      el.textContent = next.appName;
    });
    document.querySelectorAll('.brand-betriebs-name').forEach((el) => {
      el.textContent = next.betriebsName;
    });

    const badge = document.getElementById('employee-session-badge');
    const badgeName = document.getElementById('employee-session-name');
    if (badge) badge.style.display = '';
    if (badgeName) badgeName.textContent = 'Stephie';
  }, BRANDING);
}

async function enableModuleTabs(page) {
  await page.evaluate((tabIds) => {
    const enabled = new Set(tabIds);
    document.querySelectorAll('.nav-item[data-tab]').forEach((tab) => {
      const tabId = tab.getAttribute('data-tab');
      const on = enabled.has(tabId);
      tab.hidden = !on;
      tab.style.display = on ? '' : 'none';
    });
  }, ENABLED_TABS);
}

async function showModule(page, mod) {
  await page.evaluate((cfg) => {
    if (typeof window.fallbackShowTab === 'function') {
      window.fallbackShowTab(cfg.tabId);
    }

    document.querySelectorAll('.nav-item[data-tab]').forEach((tab) => {
      tab.classList.toggle('active', tab.getAttribute('data-tab') === cfg.tabId);
    });

    document.querySelectorAll('.page').forEach((pageEl) => {
      const on = pageEl.id === cfg.pageId;
      pageEl.classList.toggle('active', on);
      pageEl.hidden = !on;
      pageEl.style.display = on ? 'block' : 'none';
    });

    const headerTitle = document.getElementById('header-title');
    const headerSubtitle = document.getElementById('header-subtitle');
    if (headerTitle) headerTitle.textContent = cfg.title;
    if (headerSubtitle) headerSubtitle.textContent = cfg.subtitle;

    const appContent = document.getElementById('app-content');
    if (appContent) {
      appContent.style.display = '';
      appContent.scrollTop = 0;
    }
  }, {
    tabId: mod.tabId,
    pageId: mod.pageId,
    title: mod.title,
    subtitle: mod.subtitle,
  });
}

async function prepareDashboard(page) {
  await page.evaluate(() => {
    const login = document.getElementById('team-login-card');
    if (login) login.style.display = 'none';
    const status = document.getElementById('team-login-status');
    if (status) status.textContent = 'Angemeldet als: Stephie';

    const card = document.getElementById('bulletin-card');
    if (card) {
      card.classList.remove('hidden');
      card.style.display = '';
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
        </article>
        <article class="task-token task-token--gruen">
          <div class="task-token-body">
            <div class="task-token-prio" aria-hidden="true">🟢</div>
            <div class="task-token-text">
              <strong class="task-token-title">Kühlhaus-Temperatur eintragen</strong>
              <span class="task-token-route">Produktion · HACCP</span>
            </div>
          </div>
          <button type="button" class="task-token-done" aria-label="Aufgabe erledigt">✓</button>
        </article>`;
      if (empty) empty.classList.add('hidden');
    }
  });
}

async function prepareMhd(page) {
  await page.evaluate(() => {
    const hint = document.getElementById('mhd-monitor-hint');
    if (hint) hint.textContent = 'MHD in den kommenden 21 Tagen';
    const container = document.getElementById('mhd-items-container');
    if (!container) return;
    container.innerHTML = `
      <div class="mhd-card status-critical">
        <div class="mhd-action-badge" style="color:#C62828;background:rgba(198,40,40,0.14);border:2px solid #C62828;font-weight:800;font-size:13px;text-align:center;padding:10px 12px;border-radius:10px;">
          🏷️ 30% RABATT
        </div>
        <div class="mhd-card-header">
          <div class="mhd-product-info">
            <span class="mhd-product-name">Bioland Rindersteak</span>
            <span class="mhd-product-meta">StevesHof · MHD 19.08.2026 · 2 aktive Posten</span>
          </div>
          <div class="mhd-badge" style="color:#C62828;background:rgba(198,40,40,0.14);">1 Tag</div>
        </div>
        <div class="mhd-controls-row">
          <div class="qty-stepper">
            <button class="btn-stepper" type="button">−</button>
            <div class="qty-value-container"><span>3</span></div>
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
            <span class="mhd-product-name">Hausmacher Leberwurst</span>
            <span class="mhd-product-meta">Eigenproduktion · MHD 20.08.2026</span>
          </div>
          <div class="mhd-badge" style="color:#EF6C00;background:rgba(239,108,0,0.14);">2 Tage</div>
        </div>
        <div class="mhd-controls-row">
          <div class="qty-stepper">
            <button class="btn-stepper" type="button">−</button>
            <div class="qty-value-container"><span>8</span></div>
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
      <div class="mhd-card status-ok">
        <div class="mhd-card-header">
          <div class="mhd-product-info">
            <span class="mhd-product-name">Frische Bratwurst</span>
            <span class="mhd-product-meta">Demeter · MHD 23.08.2026</span>
          </div>
          <div class="mhd-badge" style="color:#2E7D32;background:rgba(46,125,50,0.14);">5 Tage</div>
        </div>
        <div class="mhd-controls-row">
          <div class="qty-stepper">
            <button class="btn-stepper" type="button">−</button>
            <div class="qty-value-container"><span>12</span></div>
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
  });
}

async function prepareReceiving(page) {
  await page.evaluate(() => {
    const schnellTab = document.getElementById('receiving-mode-schnell');
    const metzTab = document.getElementById('receiving-mode-metzgerei');
    const schnellPanel = document.getElementById('receiving-panel-schnell');
    const metzPanel = document.getElementById('receiving-panel-metzgerei');
    if (schnellTab) {
      schnellTab.classList.remove('active');
      schnellTab.setAttribute('aria-selected', 'false');
    }
    if (metzTab) {
      metzTab.classList.add('active');
      metzTab.setAttribute('aria-selected', 'true');
      metzTab.hidden = false;
      metzTab.style.display = '';
    }
    if (schnellPanel) {
      schnellPanel.classList.add('hidden');
      schnellPanel.hidden = true;
      schnellPanel.style.display = 'none';
    }
    if (metzPanel) {
      metzPanel.classList.remove('hidden');
      metzPanel.hidden = false;
      metzPanel.style.display = '';
    }

    const supplier = document.getElementById('we-supplier');
    if (supplier) supplier.value = 'Bauer Meier';
    const temp = document.getElementById('we-temperature-metz');
    if (temp) temp.value = '2.1';
    const category = document.getElementById('we-category');
    if (category) category.value = 'Fremdfleisch';

    const svg = encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160"><rect fill="#e8e8e8" width="120" height="160"/><text x="8" y="80" font-size="12" fill="#666">Lieferschein</text></svg>',
    );
    const previews = document.getElementById('we-photo-previews');
    if (previews) {
      previews.innerHTML = `
        <div class="we-photo-thumb">
          <img src="data:image/svg+xml,${svg}" alt="Lieferschein Vorschau">
          <button type="button" class="we-photo-thumb-remove" aria-label="Foto entfernen">×</button>
        </div>
        <div class="we-photo-thumb">
          <img src="data:image/svg+xml,${svg}" alt="Lieferschein Vorschau 2">
          <button type="button" class="we-photo-thumb-remove" aria-label="Foto entfernen">×</button>
        </div>`;
    }

    const drafts = document.getElementById('open-drafts-list');
    if (drafts) {
      drafts.innerHTML = `
        <article class="open-draft-card">
          <div class="open-draft-title">Bauer Meier · Fremdfleisch</div>
          <div class="open-draft-meta">Heute · 2 Fotos · Temperatur 2,1 °C</div>
        </article>`;
    }
  });
}

async function prepareHaccp(page) {
  await page.evaluate(() => {
    document.querySelectorAll('[data-haccp-mode]').forEach((tab) => {
      tab.classList.toggle('active-haccp-mode', tab.getAttribute('data-haccp-mode') === 'temperatur');
    });
    const container = document.getElementById('haccp-daily-container');
    if (container) {
      container.innerHTML = `
        <div class="haccp-task-list">
          <div class="haccp-task-card">
            <div class="haccp-task-title">TK-Lager -18°C</div>
            <div class="haccp-task-meta">Lager · Soll: -22 bis -18 °C · CCP</div>
            <div class="haccp-task-actions">
              <input type="number" class="input-text-touch" value="-19" step="0.1" readonly>
              <button type="button" class="btn btn-primary">OK</button>
            </div>
          </div>
          <div class="haccp-task-card">
            <div class="haccp-task-title">Kühlhaus 2°C</div>
            <div class="haccp-task-meta">Produktion · Soll: 0 bis 4 °C · CCP</div>
            <div class="haccp-task-actions">
              <input type="number" class="input-text-touch" value="3.5" step="0.1" readonly>
              <button type="button" class="btn btn-primary">OK</button>
            </div>
          </div>
          <div class="haccp-task-card">
            <div class="haccp-task-title">Theken-Kühlung</div>
            <div class="haccp-task-meta">Verkauf · Soll: 0 bis 4 °C</div>
            <div class="haccp-task-actions">
              <input type="number" class="input-text-touch" value="2.8" step="0.1" readonly>
              <button type="button" class="btn btn-primary">OK</button>
            </div>
          </div>
        </div>`;
    }
    const batch = document.getElementById('haccp-batch');
    if (batch) batch.value = 'CH-2026-0819-A';
  });
}

async function prepareKitchenWrs(page) {
  await page.evaluate(() => {
    const recipes = document.getElementById('kitchen-recipes-panel');
    const wrs = document.getElementById('kitchen-wrs-panel');
    if (recipes) recipes.open = true;
    if (wrs) wrs.open = true;

    const list = document.getElementById('recipe-list-container');
    if (list) {
      list.innerHTML = `
        <div class="recipe-card active-recipe" data-recipe-id="gallo-rizo">
          <div class="recipe-meta-group">
            <span class="recipe-title">Gallo-Rizo-Patties</span>
            <span class="recipe-subinfo">Hauptgericht - 6 Zutaten</span>
          </div>
          <div class="recipe-arrow">&gt;</div>
        </div>
        <div class="recipe-card" data-recipe-id="leberwurst">
          <div class="recipe-meta-group">
            <span class="recipe-title">Hausmacher Leberwurst</span>
            <span class="recipe-subinfo">Wurst - 8 Zutaten</span>
          </div>
          <div class="recipe-arrow">&gt;</div>
        </div>`;
    }

    const select = document.getElementById('recipe-select');
    if (select) {
      select.innerHTML = `
        <option value="gallo-rizo" selected>Gallo-Rizo-Patties</option>
        <option value="leberwurst">Hausmacher Leberwurst</option>`;
    }
    const weight = document.getElementById('target-weight');
    if (weight) weight.value = '10';
    const pill = document.getElementById('wrs-status-pill');
    if (pill) pill.textContent = 'Berechnet';
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };
    setText('wrs-total-cost', '48,60 €');
    setText('wrs-cost-per-kg', '4,86 €');
    setText('wrs-beffe-percent', '18,2 %');
    setText('wrs-fat-percent', '22,4 %');
    setText('wrs-water-percent', '58,1 %');

    const body = document.getElementById('wrs-packlist-body');
    if (body) {
      body.innerHTML = `
        <tr><td>Rinderhack</td><td>6,00</td><td>6000</td><td>32,40</td></tr>
        <tr><td>Reis gegart</td><td>2,50</td><td>2500</td><td>4,80</td></tr>
        <tr><td>Gewürzmischung</td><td>0,40</td><td>400</td><td>6,20</td></tr>
        <tr><td>Ei</td><td>1,10</td><td>1100</td><td>5,20</td></tr>`;
    }
  });
}

async function prepareBatches(page) {
  await page.evaluate(() => {
    const lock = document.getElementById('office-access-lock');
    if (lock) {
      lock.classList.add('hidden');
      lock.hidden = true;
      lock.style.display = 'none';
    }
    const content = document.getElementById('office-access-content');
    if (content) {
      content.hidden = false;
      content.style.display = '';
    }
    const master = document.getElementById('audit-master-count');
    if (master) master.textContent = '142';
    const cloud = document.getElementById('audit-cloud-count');
    if (cloud) cloud.textContent = '142';
    const status = document.getElementById('audit-cloud-status');
    if (status) status.textContent = 'Synchron';
    const detail = document.getElementById('audit-cloud-detail');
    if (detail) detail.textContent = 'Rezeptdaten und Chargen sind abgeglichen.';

    const list = document.getElementById('batch-list-container');
    if (list) {
      list.innerHTML = `
        <article class="batch-card">
          <div class="batch-card-title">Schwartemagen wolfen</div>
          <div class="recipe-subinfo">CH-2026-0819-A · 19.08.2026</div>
          <div class="batch-card-meta">
            <div><span class="batch-card-label">Menge</span><span class="batch-card-value">12,5 kg</span></div>
            <div><span class="batch-card-label">Macher</span><span class="batch-card-value">Stefan</span></div>
          </div>
        </article>
        <article class="batch-card">
          <div class="batch-card-title">Gallo-Rizo-Patties</div>
          <div class="recipe-subinfo">CH-2026-0818-B · 18.08.2026</div>
          <div class="batch-card-meta">
            <div><span class="batch-card-label">Menge</span><span class="batch-card-value">8,0 kg</span></div>
            <div><span class="batch-card-label">Macher</span><span class="batch-card-value">Anna</span></div>
          </div>
        </article>
        <article class="batch-card">
          <div class="batch-card-title">Hausmacher Leberwurst</div>
          <div class="recipe-subinfo">CH-2026-0817-C · 17.08.2026</div>
          <div class="batch-card-meta">
            <div><span class="batch-card-label">Menge</span><span class="batch-card-value">15,0 kg</span></div>
            <div><span class="batch-card-label">Macher</span><span class="batch-card-value">Stephie</span></div>
          </div>
        </article>`;
    }
  });
}

async function prepareThekenbuch(page) {
  await page.evaluate(() => {
    document.querySelectorAll('[data-chargen-panel]').forEach((btn) => {
      const on = btn.getAttribute('data-chargen-panel') === 'book';
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    const capture = document.getElementById('chargen-doku-panel-capture');
    const book = document.getElementById('chargen-doku-panel-book');
    if (capture) {
      capture.hidden = true;
      capture.style.display = 'none';
    }
    if (book) {
      book.hidden = false;
      book.style.display = '';
    }

    const status = document.getElementById('chargen-book-status');
    if (status) status.textContent = '3 Einträge';
    const body = document.getElementById('chargen-book-body');
    if (body) {
      body.innerHTML = `
        <tr>
          <td>LOT-2026-0819-A</td>
          <td>Rind</td>
          <td>19.08.2026</td>
          <td>DE-NW-12345-EG</td>
          <td>DE-ÖKO-006</td>
          <td>Aktiv</td>
          <td>Öffnen</td>
        </tr>
        <tr>
          <td>LOT-2026-0818-B</td>
          <td>Schwein</td>
          <td>18.08.2026</td>
          <td>DE-NW-7788-EG</td>
          <td>Bioland</td>
          <td>Aktiv</td>
          <td>Öffnen</td>
        </tr>
        <tr>
          <td>LOT-2026-0817-C</td>
          <td>Geflügel</td>
          <td>17.08.2026</td>
          <td>DE-NW-3344-EG</td>
          <td>Demeter</td>
          <td>Aktiv</td>
          <td>Öffnen</td>
        </tr>`;
    }
    const detail = document.getElementById('chargen-book-detail');
    if (detail) {
      detail.innerHTML = `
        <p class="dev-dashboard-intro"><strong>LOT-2026-0819-A</strong> · Rind · Ursprung Deutschland · Theke aktiv.</p>`;
    }
  });
}

async function gotoApp(page) {
  const urls = [
    `${LOCAL_ORIGIN.replace(/\/$/, '')}/`,
    LIVE_FALLBACK,
  ];
  let lastError = null;
  for (const url of urls) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForSelector('#app-content, .app-nav-zone--ops, #auth-lock-screen', { timeout: 20000 });
      log(`App geladen: ${url}`);
      return url;
    } catch (err) {
      lastError = err;
      log(`Warnung: ${url} nicht vollständig geladen (${err.message}).`);
    }
  }
  throw lastError || new Error('Weder lokaler Server noch Live-URL erreichbar.');
}

async function captureModule(page, mod) {
  await dismissOverlays(page);
  await applyShotBranding(page);
  await enableModuleTabs(page);
  await showModule(page, mod);
  await wait(SETTLE_MS);
  await dismissOverlays(page);
  await applyShotBranding(page);
  await enableModuleTabs(page);
  await mod.prepare(page);
  await wait(120);
  await dismissOverlays(page);
  await mod.prepare(page);

  const outPath = path.join(OUT_DIR, mod.file);
  await page.screenshot({
    path: outPath,
    type: 'png',
    fullPage: false,
    animations: 'disabled',
  });
  const stat = await fs.stat(outPath);
  log(`OK ${mod.file}  (${Math.round(stat.size / 1024)} KB)`);
  return outPath;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const server = await ensureLocalServer();
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] });

  try {
    const context = await browser.newContext({
      ...IPHONE_15_PRO,
      colorScheme: 'light',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    await gotoApp(page);
    await dismissOverlays(page);
    await applyShotBranding(page);
    await enableModuleTabs(page);
    await wait(600);

    const saved = [];
    for (const mod of MODULES) {
      saved.push(await captureModule(page, mod));
    }
    await context.close();

    log('');
    log(`Alle ${saved.length} Modul-Screenshots unter ${OUT_DIR}:`);
    for (const filePath of saved) log(`  ${filePath}`);
  } finally {
    await browser.close();
    if (server && !process.env.KEEP_DEV_SERVER) server.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
