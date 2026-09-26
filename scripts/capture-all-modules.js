#!/usr/bin/env node
/**
 * iPhone-15-Pro-Screenshots aller Betriebs-Module.
 *
 * Viewport: 393 x 852 px, Device-Scale 3x, Mobile User-Agent.
 * Ausgabe:  public/landing/modules/
 *
 * Aufruf:
 *   node scripts/capture-all-modules.js
 *
 * Optional:
 *   APP_URL=http://localhost:5173/ node scripts/capture-all-modules.js
 */
const { chromium, devices } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const WEB_DIR = path.join(ROOT, 'web');
const OUT_DIR = path.join(ROOT, 'public', 'landing', 'modules');

const VIEWPORT = { width: 393, height: 852 };
const DEVICE_SCALE_FACTOR = 3;
const IPHONE_15_PRO = devices['iPhone 15 Pro'] || {};
const USER_AGENT =
  IPHONE_15_PRO.userAgent ||
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const LOCAL_URLS = [process.env.APP_URL, 'http://localhost:5173/', 'http://127.0.0.1:5173/'].filter(Boolean);
const LIVE_URL = 'https://hofsync-production.web.app/';
const NAV_TIMEOUT_MS = 45_000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.csv': 'text/csv; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

const MODULES = [
  {
    file: '01_dashboard.png',
    tab: 'teamboard',
    label: 'Betriebs-Leitstand',
    prepare: prepareDashboard,
  },
  {
    file: '02_mhd_monitor.png',
    tab: 'mhd',
    label: 'MHD-Monitor',
    prepare: prepareMhd,
  },
  {
    file: '03_wareneingang.png',
    tab: 'receiving',
    label: 'Fleisch-Wareneingang',
    prepare: prepareWareneingang,
  },
  {
    file: '04_haccp_ccp.png',
    tab: 'haccp',
    label: 'HACCP / CCP',
    prepare: prepareHaccp,
  },
  {
    file: '05_rezepte_wrs.png',
    tab: 'kitchen',
    label: 'WRS Rezept-Skalierer',
    prepare: prepareWrs,
  },
  {
    file: '06_chargen_archiv.png',
    tab: 'batches',
    label: 'Chargen-Archiv',
    prepare: prepareChargen,
  },
  {
    file: '07_thekenbuch.png',
    tab: 'chargenDoku',
    label: 'Thekenbuch / LMIV',
    prepare: prepareThekenbuch,
  },
];

async function firstReachable(urls) {
  for (const url of urls) {
    try {
      const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(8_000) });
      if (response.ok || (response.status >= 200 && response.status < 500)) {
        return url;
      }
      console.warn(`Skip ${url} (HTTP ${response.status})`);
    } catch (error) {
      console.warn(`Skip ${url}: ${error.message}`);
    }
  }
  return null;
}

function startStaticServer(dir, port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const rawPath = decodeURIComponent(new URL(req.url || '/', 'http://127.0.0.1').pathname);
      const safeRel = path.normalize(rawPath).replace(/^([.][.][/\\])+/, '');
      let filePath = path.join(dir, safeRel === path.sep ? 'index.html' : safeRel);
      if (filePath.endsWith(path.sep) || fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }
      if (!filePath.startsWith(dir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        const spa = path.join(dir, 'index.html');
        if (fs.existsSync(spa)) {
          res.writeHead(200, { 'Content-Type': MIME['.html'] });
          fs.createReadStream(spa).pipe(res);
          return;
        }
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

async function launchBrowser() {
  const attempts = [{ channel: 'chrome' }, { channel: 'msedge' }, {}];
  let lastError;
  for (const opts of attempts) {
    try {
      return await chromium.launch({ headless: true, ...opts });
    } catch (error) {
      lastError = error;
      console.warn(`Browser start failed (${JSON.stringify(opts)}): ${error.message}`);
    }
  }
  throw lastError || new Error('Chromium konnte nicht gestartet werden');
}

async function unlockApp(page) {
  await page.evaluate(() => {
    window.showToast = function showToastNoop() {};
    window.showHUD = function showHudNoop() {};
    document.body.classList.remove('auth-lock-open', 'auth-loop-lockdown');
    document.body.style.pointerEvents = '';

    const hide = (el) => {
      if (!el) return;
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
      el.setAttribute('aria-hidden', 'true');
      el.classList?.remove('active');
    };

    hide(document.getElementById('auth-lock-screen'));
    hide(document.getElementById('office-access-lock'));
    hide(document.getElementById('scanner-overlay'));
    hide(document.getElementById('qa-test-panel'));
    hide(document.getElementById('sw-update-banner'));
    hide(document.getElementById('hud-overlay'));
    hide(document.getElementById('admin-dev-hint'));
    document.getElementById('toast-container')?.remove();
    document.querySelectorAll('.toast, .hud-overlay').forEach((el) => el.remove());
    document.querySelectorAll('[class*="update"], .sw-update-banner, .learn-mode-overlay').forEach(hide);

    document.querySelectorAll('dialog, [role="dialog"], [class*="modal"], [class*="overlay"], [class*="backdrop"]').forEach((el) => {
      const text = el.textContent || '';
      if (
        text.includes('Betriebs-Login') ||
        text.includes('Geräte-Zugang') ||
        text.includes('ANMELDEN') ||
        text.includes('Bitte mit E-Mail') ||
        text.includes('PIN') ||
        text.includes('Mitarbeiter-Anmeldung') && el.id !== 'team-login-card'
      ) {
        hide(el);
      }
    });

    const appContent = document.getElementById('app-content');
    if (appContent) appContent.style.display = '';

    const officeLock = document.getElementById('office-access-lock');
    if (officeLock) {
      officeLock.hidden = true;
      officeLock.classList.add('hidden');
    }
    const officeContent = document.getElementById('office-access-content');
    if (officeContent) {
      officeContent.hidden = false;
      officeContent.removeAttribute('hidden');
      officeContent.style.removeProperty('display');
      officeContent.setAttribute('aria-hidden', 'false');
    }

    const neededTabs = ['teamboard', 'mhd', 'receiving', 'haccp', 'kitchen', 'batches', 'chargenDoku'];
    document.querySelectorAll('.nav-item[data-tab]').forEach((tab) => {
      const tabId = tab.getAttribute('data-tab');
      if (!neededTabs.includes(tabId)) return;
      tab.hidden = false;
      tab.removeAttribute('hidden');
      tab.style.display = '';
    });
  });
}

async function openTab(page, tabId) {
  await unlockApp(page);
  await page.evaluate((id) => {
    const tab = document.querySelector(`.nav-item[data-tab="${id}"]`);
    if (tab) {
      tab.hidden = false;
      tab.removeAttribute('hidden');
      tab.style.display = '';
    }
  }, tabId);

  const tab = page.locator(`.nav-item[data-tab="${tabId}"]`).first();
  if (await tab.count()) {
    await tab.click({ force: true }).catch(() => {});
  }

  await page.evaluate((id) => {
    const pageMap = {
      teamboard: { page: 'page-teamboard', title: 'Start', subtitle: 'Tagesinfo' },
      mhd: { page: 'page-mhd', title: 'MHD-Monitor', subtitle: 'Qualitätssicherung' },
      receiving: { page: 'page-receiving', title: 'Wareneingang', subtitle: 'Lieferung erfassen' },
      haccp: { page: 'page-haccp', title: 'HACCP-Protokoll', subtitle: 'Tageskontrollen' },
      kitchen: { page: 'page-kitchen', title: 'Wurstküche', subtitle: 'Produktion' },
      batches: { page: 'page-batches', title: 'Chargen-Archiv', subtitle: 'Büro & Rückverfolgung' },
      chargenDoku: { page: 'page-chargen-doku', title: 'Thekenbuch', subtitle: 'Chargen-Doku' },
    };
    const target = pageMap[id];
    if (!target) return;

    document.querySelectorAll('.page').forEach((el) => {
      const on = el.id === target.page;
      el.classList.toggle('active', on);
      el.hidden = !on;
      el.style.display = on ? 'block' : 'none';
    });
    document.querySelectorAll('.nav-item[data-tab]').forEach((nav) => {
      nav.classList.toggle('active', nav.getAttribute('data-tab') === id);
    });
    const headerTitle = document.getElementById('header-title');
    const headerSubtitle = document.getElementById('header-subtitle');
    if (headerTitle) headerTitle.textContent = target.title;
    if (headerSubtitle) headerSubtitle.textContent = target.subtitle;

    const officeLock = document.getElementById('office-access-lock');
    if (officeLock) {
      officeLock.classList.add('hidden');
      officeLock.hidden = true;
      officeLock.style.display = 'none';
    }
    const officeContent = document.getElementById('office-access-content');
    if (officeContent) officeContent.style.display = '';
  }, tabId);

  await page.waitForTimeout(400);
}

async function prepareDashboard(page) {
  await page.evaluate(() => {
    const status = document.getElementById('team-login-status');
    if (status) status.textContent = 'Angemeldet als: Stefan';
    const employee = document.getElementById('team-login-employee');
    if (employee) employee.value = 'Stefan';
    const pin = document.getElementById('team-login-pin');
    if (pin) pin.value = '';
    const loginCard = document.getElementById('team-login-card');
    if (loginCard) loginCard.hidden = true;
    const card = document.getElementById('bulletin-card');
    if (card) {
      card.classList.remove('hidden');
      card.hidden = false;
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
              <strong class="task-token-title">Kühlraum-Temperatur dokumentieren</strong>
              <span class="task-token-route">HACCP · bis 10:00</span>
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
    const container = document.getElementById('mhd-items-container');
    if (!container) return;
    container.innerHTML = `
      <div class="mhd-card status-critical">
        <div class="mhd-action-badge" style="color:#C62828;background:rgba(198,40,40,0.14);border:2px solid #C62828;font-weight:800;font-size:13px;text-align:center;padding:10px 12px;border-radius:10px;margin-bottom:4px;">
          🏷️ 30% RABATT
        </div>
        <div class="mhd-card-header">
          <div class="mhd-product-info">
            <span class="mhd-product-name">Vollmilch 3,5% 1l</span>
            <span class="mhd-product-meta">Bauer Meier · MHD 20.08.2026 · 2 aktive Posten</span>
          </div>
          <div class="mhd-badge" style="color:#C62828;background:rgba(198,40,40,0.14);">1 Tag</div>
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
            <span class="mhd-product-meta">Hofeigen · MHD 22.08.2026</span>
          </div>
          <div class="mhd-badge" style="color:#EA580C;background:rgba(234,88,12,0.12);">3 Tage</div>
        </div>
        <div class="mhd-action-row">
          <button class="btn-mhd-action" type="button">↩️ Raus</button>
          <button class="btn-mhd-action btn-mhd-action--primary" type="button">✓ OK</button>
          <button class="btn-mhd-action" type="button">🥣 Küche</button>
        </div>
      </div>`;
  });
}

async function prepareWareneingang(page) {
  const metzgerei = page.locator('#receiving-mode-metzgerei');
  if (await metzgerei.count()) {
    await metzgerei.click({ force: true }).catch(() => {});
  }
  await page.evaluate(() => {
    const schnell = document.getElementById('receiving-panel-schnell');
    const metz = document.getElementById('receiving-panel-metzgerei');
    const schnellTab = document.getElementById('receiving-mode-schnell');
    const metzTab = document.getElementById('receiving-mode-metzgerei');
    if (schnell) {
      schnell.classList.add('hidden');
      schnell.hidden = true;
      schnell.style.display = 'none';
    }
    if (metz) {
      metz.classList.remove('hidden');
      metz.hidden = false;
      metz.style.display = '';
    }
    schnellTab?.classList.remove('active');
    metzTab?.classList.add('active');
    if (schnellTab) schnellTab.setAttribute('aria-selected', 'false');
    if (metzTab) metzTab.setAttribute('aria-selected', 'true');

    const supplier = document.getElementById('we-supplier');
    if (supplier) supplier.value = 'Hofmetzgerei Meier';
    const temp = document.getElementById('we-temperature-metz');
    if (temp) temp.value = '2.4';
    const category = document.getElementById('we-category');
    if (category) category.value = 'Fremdfleisch';

    const previews = document.getElementById('we-photo-previews');
    if (previews) {
      const svg = encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160"><rect fill="#ece7dc" width="120" height="160"/><text x="10" y="78" font-size="11" fill="#5c5246">Lieferschein</text></svg>',
      );
      previews.innerHTML = `
        <div class="we-photo-thumb">
          <img src="data:image/svg+xml,${svg}" alt="Lieferschein Vorschau">
          <button type="button" class="we-photo-thumb-remove" aria-label="Foto entfernen">×</button>
        </div>`;
    }
  });
}

async function prepareHaccp(page) {
  const tempTab = page.locator('[data-haccp-mode="temperatur"]');
  if (await tempTab.count()) {
    await tempTab.click({ force: true }).catch(() => {});
  }
  await page.evaluate(() => {
    const container = document.getElementById('haccp-daily-container');
    if (!container) return;
    container.innerHTML = `
      <article class="haccp-daily-station-card">
        <h3 class="haccp-daily-station-title">Kühlhaus 2 °C (CCP)</h3>
        <p class="haccp-daily-station-hint">Soll: 0 bis 4 °C</p>
        <div class="haccp-daily-input-row">
          <input type="text" class="gastro-input haccp-daily-temp-input" value="2,1" inputmode="decimal" aria-label="Temperatur in Grad Celsius">
          <span class="haccp-daily-unit">°C</span>
          <button type="button" class="btn btn-primary">Speichern</button>
        </div>
        <p class="haccp-daily-last">Heute, 07:45 – 2,1 °C (in Ordnung)</p>
      </article>
      <article class="haccp-daily-station-card">
        <h3 class="haccp-daily-station-title">TK-Lager −18 °C (CCP)</h3>
        <p class="haccp-daily-station-hint">Soll: −22 bis −18 °C</p>
        <div class="haccp-daily-input-row">
          <input type="text" class="gastro-input haccp-daily-temp-input" value="-19,0" inputmode="decimal" aria-label="Temperatur in Grad Celsius">
          <span class="haccp-daily-unit">°C</span>
          <button type="button" class="btn btn-primary">Speichern</button>
        </div>
        <p class="haccp-daily-last">Heute, 07:48 – −19,0 °C (in Ordnung)</p>
      </article>`;
  });
}

async function prepareWrs(page) {
  await page.evaluate(() => {
    const recipes = document.getElementById('kitchen-recipes-panel');
    const wrs = document.getElementById('kitchen-wrs-panel');
    if (recipes) recipes.open = false;
    if (wrs) wrs.open = true;

    const select = document.getElementById('recipe-select');
    if (select) {
      select.innerHTML = `
        <option value="gallo">Gallo-Rizo-Patties</option>
        <option value="schwarte">Schwartemagen wolfen</option>`;
      select.value = 'gallo';
    }
    const weight = document.getElementById('target-weight');
    if (weight) weight.value = '12.5';
    const pill = document.getElementById('wrs-status-pill');
    if (pill) pill.textContent = 'Berechnet';
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };
    set('wrs-total-cost', '86,40 €');
    set('wrs-cost-per-kg', '6,91 €');
    set('wrs-beffe-percent', '14,8 %');
    set('wrs-fat-percent', '18,2 %');
    set('wrs-water-percent', '62,1 %');

    const body = document.getElementById('wrs-packlist-body');
    if (body) {
      body.innerHTML = `
        <tr><td>Rindfleisch II</td><td>7,50</td><td>7500</td><td>52,50</td></tr>
        <tr><td>Schweinebauch</td><td>3,20</td><td>3200</td><td>19,20</td></tr>
        <tr><td>Gewürzmix Patties</td><td>0,18</td><td>180</td><td>4,70</td></tr>
        <tr><td>Eis / Wasser</td><td>1,62</td><td>1620</td><td>0,00</td></tr>`;
    }
  });
}

async function prepareChargen(page) {
  await page.evaluate(() => {
    const lock = document.getElementById('office-access-lock');
    if (lock) {
      lock.classList.add('hidden');
      lock.hidden = true;
      lock.style.setProperty('display', 'none', 'important');
    }
    const content = document.getElementById('office-access-content');
    if (content) {
      content.hidden = false;
      content.removeAttribute('hidden');
      content.style.display = 'block';
      content.setAttribute('aria-hidden', 'false');
    }
    const admin = document.getElementById('admin-leitstand-panel');
    if (admin) {
      admin.classList.add('hidden');
      admin.style.display = 'none';
    }
    const list = document.getElementById('batch-list-container');
    if (list) {
      list.innerHTML = `
        <article class="batch-card">
          <div class="batch-card-title">Schwartemagen wolfen</div>
          <div class="recipe-subinfo">CH-2026-0818-A · 18.08.2026</div>
          <div class="batch-card-meta">
            <div><span class="batch-card-label">Menge</span><span class="batch-card-value">12,5 kg</span></div>
            <div><span class="batch-card-label">Macher</span><span class="batch-card-value">Stefan</span></div>
          </div>
        </article>
        <article class="batch-card">
          <div class="batch-card-title">Gallo-Rizo-Patties</div>
          <div class="recipe-subinfo">CH-2026-0817-B · 17.08.2026</div>
          <div class="batch-card-meta">
            <div><span class="batch-card-label">Menge</span><span class="batch-card-value">8,0 kg</span></div>
            <div><span class="batch-card-label">Macher</span><span class="batch-card-value">Anna</span></div>
          </div>
        </article>`;
    }
    const master = document.getElementById('audit-master-count');
    const cloud = document.getElementById('audit-cloud-count');
    const status = document.getElementById('audit-cloud-status');
    if (master) master.textContent = '142';
    if (cloud) cloud.textContent = '142';
    if (status) status.textContent = 'Synchron';
  });
}

async function prepareThekenbuch(page) {
  const bookTab = page.locator('[data-chargen-panel="book"]');
  if (await bookTab.count()) {
    await bookTab.click({ force: true }).catch(() => {});
  }
  await page.evaluate(() => {
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
    document.querySelectorAll('[data-chargen-panel]').forEach((btn) => {
      const active = btn.getAttribute('data-chargen-panel') === 'book';
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    const body = document.getElementById('chargen-book-body');
    if (body) {
      body.innerHTML = `
        <tr>
          <td>LOT-2026-0818-A</td>
          <td>Rind</td>
          <td>18.08.2026</td>
          <td>DE-NW-12345-EG</td>
          <td>DE-ÖKO-006</td>
          <td>aktiv</td>
          <td>Öffnen</td>
        </tr>
        <tr>
          <td>LOT-2026-0816-C</td>
          <td>Schwein</td>
          <td>16.08.2026</td>
          <td>DE-BY-77821-EG</td>
          <td>—</td>
          <td>aktiv</td>
          <td>Öffnen</td>
        </tr>`;
    }
    const footer = document.getElementById('chargen-book-footer');
    if (footer) footer.textContent = 'Zeige 2 von 2 Einträgen';
    const status = document.getElementById('chargen-book-status');
    if (status) status.textContent = '2 LMIV-Einträge';
    const detail = document.getElementById('chargen-book-detail');
    if (detail) {
      detail.innerHTML = `
        <p class="dev-dashboard-intro"><strong>LOT-2026-0818-A</strong> · Rind · Ursprung: Deutschland · Bioland</p>
        <p class="dev-dashboard-intro">Identitätskennzeichen DE-NW-12345-EG · Öko-Kontrollstelle DE-ÖKO-006</p>`;
    }
  });
}

async function captureModule(page, mod) {
  console.log(`→ ${mod.file} (${mod.label})`);
  await openTab(page, mod.tab);
  await page.waitForTimeout(700);
  await unlockApp(page);
  await mod.prepare(page);
  await page.waitForTimeout(350);
  await unlockApp(page);
  await mod.prepare(page);
  await page.evaluate(() => {
    document.getElementById('toast-container')?.remove();
    document.querySelectorAll('.toast').forEach((el) => el.remove());
    document.getElementById('app-content')?.scrollTo?.(0, 0);
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(150);
  const outFile = path.join(OUT_DIR, mod.file);
  await page.screenshot({
    path: outFile,
    type: 'png',
    fullPage: false,
    animations: 'disabled',
    caret: 'hide',
  });
  console.log(`  wrote ${outFile}`);
}

async function main() {
  await fsp.mkdir(OUT_DIR, { recursive: true });

  let baseUrl = await firstReachable(LOCAL_URLS);
  let localServer = null;

  if (!baseUrl) {
    try {
      localServer = await startStaticServer(WEB_DIR, 5173);
      baseUrl = 'http://127.0.0.1:5173/';
      console.log(`Lokaler Static-Server gestartet: ${baseUrl}`);
    } catch (error) {
      console.warn(`Lokaler Server auf 5173 nicht möglich: ${error.message}`);
      try {
        localServer = await startStaticServer(WEB_DIR, 4173);
        baseUrl = 'http://127.0.0.1:4173/';
        console.log(`Lokaler Static-Server gestartet: ${baseUrl}`);
      } catch (inner) {
        console.warn(`Fallback-Port 4173 fehlgeschlagen: ${inner.message}`);
      }
    }
  }

  if (!baseUrl) {
    baseUrl = await firstReachable([LIVE_URL]);
  }
  if (!baseUrl) {
    throw new Error('Keine erreichbare App-URL (localhost:5173 und Live-URL).');
  }
  console.log(`Base-URL: ${baseUrl}`);

  const browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    isMobile: true,
    hasTouch: true,
    userAgent: USER_AGENT,
    locale: 'de-DE',
    colorScheme: 'light',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT_MS);

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await unlockApp(page);

  for (const mod of MODULES) {
    await captureModule(page, mod);
  }

  await browser.close();
  if (localServer) {
    await new Promise((resolve) => localServer.close(resolve));
  }

  const files = await fsp.readdir(OUT_DIR);
  console.log('\nFertig. Modul-Screenshots:');
  for (const file of MODULES.map((m) => m.file)) {
    const full = path.join(OUT_DIR, file);
    const exists = files.includes(file);
    const size = exists ? (await fsp.stat(full)).size : 0;
    console.log(`  ${exists ? 'OK' : 'MISSING'}  ${file}  (${size} bytes)`);
  }
  console.log(`\nOrdner: ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
