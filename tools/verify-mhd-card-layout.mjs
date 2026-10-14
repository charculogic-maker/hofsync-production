#!/usr/bin/env node
/**
 * Visueller Layout-Check: kompakte MHD-Kartenhöhe + Akkordeon-Toggle (Playwright).
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
const base = `http://127.0.0.1:${port}/index.html?v=mhd-redesign`;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
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
  const seed = [
    {
      id: 'demo-1',
      ean: '4035626114608',
      name: 'b*Vollmilch Demeter 3,8% Flasche',
      produkt: 'b*Vollmilch Demeter 3,8% Flasche',
      brand: 'Schönegger',
      qty: 3,
      menge: 3,
      kategorie: '🥛MoPro',
      mhdDate: isoDaysFromToday(0),
      mhd: isoDaysFromToday(0),
      status: 'aktiv',
      scannedBy: 'Anna Müller',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-1b',
      ean: '4035626114608',
      name: 'b*Vollmilch Demeter 3,8% Flasche',
      produkt: 'b*Vollmilch Demeter 3,8% Flasche',
      brand: 'Schönegger',
      qty: 2,
      menge: 2,
      kategorie: '🥛MoPro',
      mhdDate: isoDaysFromToday(3),
      mhd: isoDaysFromToday(3),
      status: 'aktiv',
      scannedBy: 'Anna Müller',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-2',
      ean: '4000417025006',
      name: 'TK Spinat Portionen',
      produkt: 'TK Spinat Portionen',
      brand: 'Iglo',
      qty: 5,
      menge: 5,
      kategorie: '🧊 TK',
      mhdDate: isoDaysFromToday(4),
      mhd: isoDaysFromToday(4),
      status: 'aktiv',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-3',
      ean: '4000417025008',
      name: 'Joghurt mild 1,8%',
      produkt: 'Joghurt mild 1,8%',
      brand: 'Andechser',
      qty: 1,
      menge: 1,
      kategorie: '🥛MoPro',
      mhdDate: isoDaysFromToday(-1),
      mhd: isoDaysFromToday(-1),
      status: 'aktiv',
      createdAt: new Date().toISOString(),
    },
  ];

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

  await new Promise((r) => setTimeout(r, 600));
  document.getElementById('tab-mhd')?.click();
  await new Promise((r) => setTimeout(r, 200));

  const cards = [...document.querySelectorAll('#mhd-items-container .mhd-card')];
  // Höhe im geschlossenen Zustand (ohne aufgeklappte Folge-Chargen)
  document.querySelectorAll('.mhd-accordion-content.is-open').forEach((el) => el.classList.remove('is-open'));
  document.querySelectorAll('.mhd-multi-batch-badge.is-expanded').forEach((el) => {
    el.classList.remove('is-expanded');
    el.setAttribute('aria-expanded', 'false');
    const chev = el.querySelector('.mhd-multi-batch-chevron');
    if (chev) chev.textContent = '▼';
  });
  const heightsClosed = cards.map((card) => Math.round(card.getBoundingClientRect().height));
  const hasTop = Boolean(document.querySelector('.mhd-card-top'));
  const hasActionRow = Boolean(document.querySelector('.mhd-touch-action-row'));
  const hasMore = Boolean(document.querySelector('.mhd-card-more-trigger'));
  const badge = document.querySelector('.mhd-multi-batch-badge');
  const accordionBefore = document.querySelector('.mhd-accordion-content');
  const openBefore = accordionBefore?.classList.contains('is-open') === true;
  badge?.click();
  await new Promise((r) => setTimeout(r, 100));
  const accordionAfter = document.querySelector('.mhd-accordion-content');
  const openAfter = accordionAfter?.classList.contains('is-open') === true;
  const chevron = badge?.querySelector('.mhd-multi-batch-chevron')?.textContent?.trim();
  const heightsOpen = cards.map((card) => Math.round(card.getBoundingClientRect().height));

  return {
    cardCount: cards.length,
    heights: heightsClosed,
    heightsOpen,
    maxHeight: Math.max(0, ...heightsClosed),
    avgHeight: heightsClosed.length
      ? Math.round(heightsClosed.reduce((a, b) => a + b, 0) / heightsClosed.length)
      : 0,
    hasTop,
    hasActionRow,
    hasMore,
    hasBadge: Boolean(badge),
    openBefore,
    openAfter,
    chevron,
    ampel: document.querySelector('.mhd-ampel-badge')?.textContent?.trim() || '',
    category: document.querySelector('.mhd-card-category')?.textContent?.trim() || '',
    meta: document.querySelector('.mhd-product-meta-line')?.textContent?.trim() || '',
  };
});

// Closed state: collapse accordion if the click opened it
if (result.openAfter) {
  await page.locator('.mhd-multi-batch-badge').first().click({ force: true });
  await page.waitForTimeout(120);
}
await page.screenshot({ path: path.join(artifactsDir, 'mhd-cards-compact-closed.png'), fullPage: false });

if (result.hasBadge) {
  await page.locator('.mhd-multi-batch-badge').first().click({ force: true });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(artifactsDir, 'mhd-cards-accordion-open.png'), fullPage: false });
}

writeFileSync(path.join(artifactsDir, 'mhd-card-layout-verify.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));

const fail = [];
if (result.cardCount < 2) fail.push('zu wenige Karten');
if (result.maxHeight > 230) fail.push(`maxHeight ${result.maxHeight} > 230 (Ziel kompakt)`);
if (!result.hasTop || !result.hasActionRow || !result.hasMore) fail.push('Layout-Klassen fehlen');
if (result.hasBadge && !result.openAfter) fail.push('Akkordeon öffnete nicht');
if (fail.length) {
  console.error('FAIL', fail);
  process.exitCode = 1;
} else {
  console.log('OK verify-mhd-card-layout');
}

await browser.close();
server.close();
