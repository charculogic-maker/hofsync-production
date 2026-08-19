#!/usr/bin/env node
/**
 * Hochauflösende Smartphone-Screenshots (iPhone 15 Pro) für CharcuLogicOS und HofSync.
 *
 * Aufruf:
 *   npm run screenshots:mobile
 *   node scripts/capture-mobile-screenshots.js
 *
 * Ausgabe (Landing-Public):
 *   charculogic-web/public/landing/projects/charculogic-mobile.png
 *   charculogic-web/public/landing/projects/hofsync-mobile.png
 */
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const WEB_DIR = path.join(ROOT, 'web');
const OUT_DIR = path.join(ROOT, 'charculogic-web', 'public', 'landing', 'projects');

const IPHONE_15_PRO = {
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
};

const LOCAL_ORIGIN = process.env.APP_URL || 'http://127.0.0.1:5173';
const HOFSYNC_LIVE_URL = process.env.HOFSYNC_URL || 'https://hofsync-production.web.app/';
const SETTLE_MS = Number(process.env.SCREENSHOT_SETTLE_MS || 2000);

const CHARCULOGIC_SHOT = {
  file: 'charculogic-mobile.png',
  url: `${LOCAL_ORIGIN.replace(/\/$/, '')}/`,
  branding: {
    appName: 'CharcuLogicOS',
    betriebsName: 'CharcuLogic',
    primaryColor: '#2E7D32',
    primaryColorHover: '#1B5E20',
    darkHeaderBg: '#1B4332',
    accentAlert: '#C62828',
    textOnHeader: '#ffffff',
  },
};

const HOFSYNC_SHOT = {
  file: 'hofsync-mobile.png',
  url: HOFSYNC_LIVE_URL,
  fallbackUrl: `${LOCAL_ORIGIN.replace(/\/$/, '')}/`,
  branding: {
    appName: 'HofSync',
    betriebsName: 'HofSync Hofladen',
    primaryColor: '#28a745',
    primaryColorHover: '#218838',
    darkHeaderBg: '#14532d',
    accentAlert: '#dc3545',
    textOnHeader: '#ffffff',
  },
};

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
    document.body?.classList.remove('auth-lock-open');

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

    const teamLogin = document.getElementById('team-login-card');
    if (teamLogin) teamLogin.style.display = 'none';

    const toasts = document.getElementById('toast-container');
    if (toasts) toasts.remove();
  });
}

async function applyShotBranding(page, branding) {
  await page.evaluate((next) => {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', next.primaryColor);
    root.style.setProperty('--primary-color-hover', next.primaryColorHover);
    root.style.setProperty('--dark-header-bg', next.darkHeaderBg);
    root.style.setProperty('--accent-alert', next.accentAlert);
    root.style.setProperty('--header-text', next.textOnHeader);
    root.style.setProperty('--header-text-muted', 'rgba(255, 255, 255, 0.72)');
    root.style.setProperty('--nav-text', 'rgba(255, 255, 255, 0.65)');

    window.BRANDING = { ...(window.BRANDING || {}), ...next };
    if (typeof window.applyBranding === 'function') {
      window.applyBranding();
    } else {
      document.querySelectorAll('.brand-app-name').forEach((el) => {
        el.textContent = next.appName;
      });
      document.querySelectorAll('.brand-betriebs-name').forEach((el) => {
        el.textContent = next.betriebsName;
      });
    }

    const headerTitle = document.getElementById('header-title');
    const headerSubtitle = document.getElementById('header-subtitle');
    if (headerTitle) headerTitle.textContent = 'MHD-Monitor';
    if (headerSubtitle) headerSubtitle.textContent = next.betriebsName;

    const badge = document.getElementById('employee-session-badge');
    const badgeName = document.getElementById('employee-session-name');
    if (badge) badge.style.display = '';
    if (badgeName) badgeName.textContent = 'Stephie';

    const loginStatus = document.getElementById('team-login-status');
    if (loginStatus) loginStatus.textContent = 'Angemeldet als: Stephie';

    document.querySelectorAll('button, a, span, p, div').forEach((el) => {
      const text = (el.textContent || '').trim();
      if (text === 'Nicht angemeldet' && el.children.length === 0) {
        el.style.display = 'none';
      }
    });
  }, branding);
}

async function preparePhoneApp(page) {
  await page.evaluate(() => {
    document.body.classList.remove(
      'is-dev-dashboard',
      'dev-dashboard-view',
      'app-shell-sidebar',
      'desktop-wide-layout',
    );

    const navBrand = document.getElementById('app-nav-brand');
    if (navBrand) navBrand.setAttribute('aria-hidden', 'true');

    const adminZone = document.getElementById('app-nav-admin-zone');
    if (adminZone) {
      adminZone.hidden = true;
      adminZone.style.display = 'none';
    }

    const enabledTabs = new Set(['mhd', 'receiving', 'chargenDoku', 'kitchen']);
    document.querySelectorAll('.nav-item[data-tab]').forEach((tab) => {
      const tabId = tab.getAttribute('data-tab');
      const enabled = enabledTabs.has(tabId);
      tab.hidden = !enabled;
      tab.style.display = enabled ? '' : 'none';
      tab.classList.toggle('active', tabId === 'mhd');
    });

    document.querySelectorAll('.page').forEach((pageEl) => {
      const on = pageEl.id === 'page-mhd';
      pageEl.classList.toggle('active', on);
      pageEl.hidden = !on;
      pageEl.style.display = on ? 'flex' : 'none';
    });

    const appContent = document.getElementById('app-content');
    if (appContent) appContent.style.display = '';

    const categorySelect = document.getElementById('mhd-category-select');
    if (categorySelect) {
      categorySelect.innerHTML = `
        <option value="all" selected>Alle Kategorien</option>
        <option value="frische">🍎 Frische</option>
        <option value="mopro">🥛 MoPro</option>
        <option value="kuehlware">❄️ Kühlware</option>`;
    }

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

async function gotoWithFallback(page, shot) {
  const urls = [shot.url, shot.fallbackUrl].filter(Boolean);
  let lastError = null;
  for (const url of urls) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForSelector('#app-content, .app-nav-zone--ops, #auth-lock-screen', { timeout: 20000 });
      return url;
    } catch (err) {
      lastError = err;
      log(`Warnung: ${url} nicht vollständig geladen (${err.message}).`);
    }
  }
  throw lastError || new Error(`Keine URL für ${shot.file} erreichbar.`);
}

async function captureShot(browser, shot) {
  const context = await browser.newContext({
    ...IPHONE_15_PRO,
    colorScheme: 'light',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  const usedUrl = await gotoWithFallback(page, shot);
  await dismissOverlays(page);
  await applyShotBranding(page, shot.branding);
  await preparePhoneApp(page);
  await page.waitForSelector('.mhd-card', { timeout: 10000 });
  await wait(SETTLE_MS);
  await dismissOverlays(page);
  await applyShotBranding(page, shot.branding);
  await preparePhoneApp(page);
  await wait(350);
  await dismissOverlays(page);

  const outPath = path.join(OUT_DIR, shot.file);
  await page.screenshot({
    path: outPath,
    type: 'png',
    fullPage: false,
    animations: 'disabled',
  });
  await context.close();

  const stat = await fs.stat(outPath);
  const pxW = IPHONE_15_PRO.viewport.width * IPHONE_15_PRO.deviceScaleFactor;
  const pxH = IPHONE_15_PRO.viewport.height * IPHONE_15_PRO.deviceScaleFactor;
  log(`OK ${shot.file}  ←  ${usedUrl}`);
  log(`   ${outPath}  (${Math.round(stat.size / 1024)} KB, ${pxW}×${pxH} px)`);
  return outPath;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const server = await ensureLocalServer();

  const browser = await chromium.launch({
    args: ['--disable-dev-shm-usage'],
  });

  try {
    const charcuPath = await captureShot(browser, CHARCULOGIC_SHOT);
    const hofsyncPath = await captureShot(browser, HOFSYNC_SHOT);
    log('');
    log('Smartphone-Screenshots gespeichert:');
    log(`  ${charcuPath}`);
    log(`  ${hofsyncPath}`);
  } finally {
    await browser.close();
    if (server && !process.env.KEEP_DEV_SERVER) {
      server.kill('SIGTERM');
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
