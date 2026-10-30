#!/usr/bin/env node
/**
 * iPhone-14-Viewport: MHD-Chrome + Kartenhöhe + sichtbare Karten (Playwright).
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactsDir = '/opt/cursor/artifacts';
mkdirSync(artifactsDir, { recursive: true });

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

function serveStatic(dir) {
  return createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    let rel = urlPath === '/' ? '/index.html' : urlPath;
    const filePath = path.join(dir, rel);
    if (!filePath.startsWith(dir) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
    res.end(readFileSync(filePath));
  });
}

const server = serveStatic(path.join(root, 'web'));
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const base = `http://127.0.0.1:${port}/index.html?v=mhd-density`;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});
await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });

const result = await page.evaluate(async () => {
  const lock = document.getElementById('auth-lock-screen');
  if (lock) {
    lock.style.display = 'none';
    lock.classList.remove('active');
  }
  const isoDaysFromToday = (days) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(today.getTime() + days * 86400000).toISOString().slice(0, 10);
  };
  // Einzigartige Artikelnamen (wie im Laden-Alltag / Screenshot) — keine Multi-MHD-Fußzeile.
  const seed = [
    { name: 'VOE – Limettensaft', brand: 'VOE', kategorie: '🥩Aufschnitt', days: -3 },
    { name: 'Galloway Gulasch', brand: 'Galloway', kategorie: '🥩Fleisch', days: -1 },
    { name: 'b*Vollmilch Demeter', brand: 'Schönegger', kategorie: '🥛MoPro', days: 0 },
    { name: 'Joghurt mild 1,8%', brand: 'Andechser', kategorie: '🥛MoPro', days: 1 },
    { name: 'TK Spinat Portionen', brand: 'Iglo', kategorie: '🧊 TK', days: 2 },
    { name: 'Haferdrink Natur', brand: 'Voelkel', kategorie: '🥛MoPro', days: 3 },
    { name: 'Butter Demeter', brand: 'Berchtesgadener', kategorie: '🥛MoPro', days: 4 },
    { name: 'Gouda jung', brand: 'Hofkäserei', kategorie: '🥛MoPro', days: 5 },
  ].map((item, i) => ({
    id: `demo-density-${i}`,
    ean: `40356261146${String(i).padStart(2, '0')}`,
    name: item.name,
    produkt: item.name,
    brand: item.brand,
    qty: 1 + (i % 3),
    menge: 1 + (i % 3),
    kategorie: item.kategorie,
    mhdDate: isoDaysFromToday(item.days),
    mhd: isoDaysFromToday(item.days),
    status: 'aktiv',
    scannedBy: 'Paddy',
    createdAt: new Date().toISOString(),
  }));

  window.firebase = { apps: [{}], auth: () => ({ currentUser: { uid: 'employee-user' } }) };
  window.canStartFirestoreLiveListeners = () => true;
  window.hasActiveFirebaseAuthUser = () => true;
  localStorage.setItem('charculogic.tenantId', 'StevesHof_Hauptbetrieb');

  const makeCollection = () => ({
    onSnapshot: (onNext) => {
      onNext({
        docs: seed.map((item) => ({ id: item.id, data: () => ({ ...item }) })),
        metadata: { fromCache: false },
        empty: false,
      });
      return () => {};
    },
    where: () => makeCollection(),
    limit: () => ({ get: async () => ({ empty: true, docs: [] }) }),
    doc: () => ({ set: async () => {}, update: async () => {}, delete: async () => {} }),
  });

  const { initMhdModule } = await import('./mhd.js');
  initMhdModule({ collection: () => makeCollection() }, {
    writeOrQueueFirestore: async () => 'written',
    addPendingSync: () => {},
  }, { playClickSound: () => {} }, {
    showHUD: () => {},
    isFirebaseReady: () => true,
    getFirebase: () => window.firebase,
    tenantId: 'StevesHof_Hauptbetrieb',
  });

  await new Promise((r) => setTimeout(r, 700));
  document.getElementById('tab-mhd')?.click();
  await new Promise((r) => setTimeout(r, 250));

  // SLA-Banner wie im Screenshot sichtbar machen
  const banner = document.getElementById('mhd-sla-banner');
  if (banner) {
    banner.hidden = false;
    banner.classList.remove('hidden');
    banner.innerHTML = '<strong>37</strong> kritische MHDs heute noch offen – antippen zum Prüfen';
  }

  // Admin-Suche sichtbar (wie auf dem Screenshot von Paddy)
  const adminSearch = document.getElementById('mhd-admin-search');
  if (adminSearch) adminSearch.hidden = false;

  // Toolbar geschlossen = Standard-Morgencheck
  const accordion = document.getElementById('mhd-toolbar-accordion');
  if (accordion) accordion.open = false;

  // Dev-/Init-Overlays aus dem Screenshot halten (nicht Teil des MHD-Layouts)
  document.querySelectorAll(
    '#update-toast, #release-toast, .update-toast, .release-toast, .toast, .hud-overlay, .mhd-undo-toast, .qa-panel, [data-toast], .sync-banner',
  ).forEach((el) => {
    el.hidden = true;
    el.classList.remove('is-visible');
    el.style.display = 'none';
  });
  document.querySelectorAll('.sticky-action-bar, .mhd-sticky-save-bar').forEach((el) => {
    el.classList.remove('is-visible');
    el.hidden = true;
  });

  await new Promise((r) => setTimeout(r, 80));

  const vh = window.innerHeight;
  const nav = document.querySelector('.bottom-nav, .app-nav');
  const header = document.querySelector('.app-header');
  const updateInfo = document.querySelector('.app-update-info');
  const toolbar = document.querySelector('.mhd-monitor-toolbar');
  const cards = [...document.querySelectorAll('#mhd-items-container .mhd-card')];
  const bannerCs = banner ? getComputedStyle(banner) : null;
  const bannerRect = banner?.getBoundingClientRect();
  const toolbarRect = toolbar?.getBoundingClientRect();
  const navRect = nav?.getBoundingClientRect();
  const listTop = document.getElementById('mhd-items-container')?.getBoundingClientRect()?.top ?? 0;
  const listBottom = navRect ? navRect.top : vh;
  const listViewport = Math.max(0, listBottom - listTop);

  const cardHeights = cards.map((card) => Math.round(card.getBoundingClientRect().height));
  const visibleFully = cards.filter((card) => {
    const r = card.getBoundingClientRect();
    return r.top >= listTop - 1 && r.bottom <= listBottom + 1;
  }).length;
  const visiblePartial = cards.filter((card) => {
    const r = card.getBoundingClientRect();
    return r.bottom > listTop + 8 && r.top < listBottom - 8;
  }).length;

  const actionH = Math.round(
    document.querySelector('.btn-mhd-action--primary')?.getBoundingClientRect()?.height || 0,
  );
  const qtyH = Math.round(
    document.querySelector('.mhd-qty-badge')?.getBoundingClientRect()?.height || 0,
  );

  return {
    viewport: { w: window.innerWidth, h: vh },
    banner: {
      visible: Boolean(banner && !banner.hidden),
      height: bannerRect ? Math.round(bannerRect.height) : 0,
      textTransform: bannerCs?.textTransform || '',
      fontSize: bannerCs?.fontSize || '',
      sample: banner?.textContent?.trim()?.slice(0, 80) || '',
    },
    chrome: {
      header: header ? Math.round(header.getBoundingClientRect().height) : 0,
      updateInfo: updateInfo ? Math.round(updateInfo.getBoundingClientRect().height) : 0,
      banner: bannerRect ? Math.round(bannerRect.height + (bannerRect.top > 0 ? 0 : 0)) : 0,
      toolbar: toolbarRect ? Math.round(toolbarRect.height) : 0,
      adminOutsideToolbar: Boolean(
        adminSearch && !toolbar?.contains(adminSearch) && !adminSearch.hidden,
      ),
      nav: navRect ? Math.round(navRect.height) : 0,
      aboveList: Math.round(listTop),
      listViewport: Math.round(listViewport),
    },
    cards: {
      count: cards.length,
      heights: cardHeights,
      maxHeight: Math.max(0, ...cardHeights),
      avgHeight: cardHeights.length
        ? Math.round(cardHeights.reduce((a, b) => a + b, 0) / cardHeights.length)
        : 0,
      visibleFully,
      visiblePartial,
      actionButtonHeight: actionH,
      qtyBadgeHeight: qtyH,
    },
  };
});

await page.screenshot({
  path: path.join(artifactsDir, 'mhd-mobile-density-iphone14.png'),
  fullPage: false,
});

writeFileSync(
  path.join(artifactsDir, 'mhd-mobile-density-verify.json'),
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));

const fail = [];
if (result.banner.textTransform !== 'none') {
  fail.push(`SLA banner text-transform=${result.banner.textTransform} (erwartet none)`);
}
if (result.banner.height > 44) {
  fail.push(`SLA banner height ${result.banner.height} > 44`);
}
if (result.chrome.adminOutsideToolbar) {
  fail.push('Erweiterte Suche liegt außerhalb der Toolbar (soll im Akkordeon stecken)');
}
if (result.chrome.toolbar > 52) {
  fail.push(`Toolbar geschlossen ${result.chrome.toolbar}px > 52`);
}
if (result.cards.maxHeight > 200) {
  fail.push(`max card height ${result.cards.maxHeight} > 200`);
}
if (result.cards.actionButtonHeight < 44 || result.cards.actionButtonHeight > 46) {
  fail.push(`OK-Button height ${result.cards.actionButtonHeight} (Ziel 44)`);
}
if (result.cards.visibleFully < 3 && result.cards.visiblePartial < 4) {
  fail.push(
    `nur ${result.cards.visibleFully} volle / ${result.cards.visiblePartial} teilweise Karten (Ziel ≥3 voll oder ≥4 teilweise)`,
  );
}

if (fail.length) {
  console.error('FAIL', fail);
  process.exitCode = 1;
} else {
  console.log('OK verify-mhd-mobile-density');
}

await browser.close();
server.close();
