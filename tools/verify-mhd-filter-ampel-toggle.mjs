#!/usr/bin/env node
/**
 * Visueller Check: getrennte MoPro/Kühlware-Filter + Ampel → MHD-Datum Toggle.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactsDir = '/opt/cursor/artifacts';
mkdirSync(artifactsDir, { recursive: true });
const videoDir = path.join(artifactsDir, 'mhd-filter-ampel-video-raw');
mkdirSync(videoDir, { recursive: true });

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
const base = `http://127.0.0.1:${port}/index.html?v=mhd-filter-ampel`;

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  recordVideo: { dir: videoDir, size: { width: 390, height: 844 } },
});
const page = await context.newPage();
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
      id: 'mopro-1',
      ean: '4035626114608',
      name: 'Joghurt Natur mild 3,5%',
      produkt: 'Joghurt Natur mild 3,5%',
      brand: 'WMF',
      qty: 6,
      menge: 6,
      kategorie: '🥛MoPro',
      mhdDate: isoDaysFromToday(1),
      mhd: isoDaysFromToday(1),
      status: 'aktiv',
      scannedBy: 'Paddy',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'kuehl-1',
      ean: '4008471492122',
      name: 'Vegane Mayo Bioland 125g',
      produkt: 'Vegane Mayo Bioland 125g',
      brand: 'EMI',
      qty: 3,
      menge: 3,
      kategorie: '🥗 Kühlware',
      mhdDate: isoDaysFromToday(2),
      mhd: isoDaysFromToday(2),
      status: 'aktiv',
      scannedBy: 'Stephanie',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'aufschnitt-1',
      ean: '8008161501772',
      name: 'VOE - Limettensaft',
      produkt: 'VOE - Limettensaft',
      brand: 'VOE',
      qty: 10,
      menge: 10,
      kategorie: '🥓 Aufschnitt',
      mhdDate: isoDaysFromToday(1),
      mhd: isoDaysFromToday(1),
      status: 'aktiv',
      scannedBy: 'Sophie',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'trocken-1',
      ean: '4000417025006',
      name: 'Dinkelmehl Type 1050',
      produkt: 'Dinkelmehl Type 1050',
      brand: 'Hof',
      qty: 4,
      menge: 4,
      kategorie: '📦 Trockenware',
      mhdDate: isoDaysFromToday(20),
      mhd: isoDaysFromToday(20),
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

  await new Promise((r) => setTimeout(r, 700));
  document.getElementById('tab-mhd')?.click();
  await new Promise((r) => setTimeout(r, 250));

  const accordion = document.getElementById('mhd-toolbar-accordion');
  if (accordion && !accordion.open) accordion.open = true;
  await new Promise((r) => setTimeout(r, 100));

  const filterButtons = [...document.querySelectorAll('#mhd-category-toggle [data-mhd-category-filter]')]
    .map((btn) => btn.dataset.mhdCategoryFilter);

  const clickFilter = async (value) => {
    document.querySelector(`[data-mhd-category-filter="${value}"]`)?.click();
    await new Promise((r) => setTimeout(r, 120));
  };

  await clickFilter('alle');
  const alleNames = [...document.querySelectorAll('#mhd-items-container .mhd-product-name')]
    .map((el) => el.textContent.trim());
  const alleHeaders = [...document.querySelectorAll('.mhd-monitor-group-header')]
    .map((el) => el.textContent.trim());

  await clickFilter('mopro');
  const moproNames = [...document.querySelectorAll('#mhd-items-container .mhd-product-name')]
    .map((el) => el.textContent.trim());

  await clickFilter('kuehlware');
  const kuehlNames = [...document.querySelectorAll('#mhd-items-container .mhd-product-name')]
    .map((el) => el.textContent.trim());

  await clickFilter('trockenware');
  const trockenNames = [...document.querySelectorAll('#mhd-items-container .mhd-product-name')]
    .map((el) => el.textContent.trim());

  await clickFilter('alle');
  const ampel = document.querySelector('[data-mhd-days-badge]');
  const before = ampel?.textContent?.trim() || '';
  ampel?.click();
  await new Promise((r) => setTimeout(r, 80));
  const after = ampel?.textContent?.trim() || '';
  const mode = ampel?.dataset.mhdBadgeMode || '';
  ampel?.click();
  await new Promise((r) => setTimeout(r, 80));
  const back = ampel?.textContent?.trim() || '';

  return {
    filterButtons,
    alleNames,
    alleHeaders,
    moproNames,
    kuehlNames,
    trockenNames,
    ampelBefore: before,
    ampelAfter: after,
    ampelMode: mode,
    ampelBack: back,
  };
});

await page.locator('#mhd-toolbar-accordion').evaluate((el) => { el.open = true; });
await page.waitForTimeout(150);
await page.screenshot({ path: path.join(artifactsDir, 'mhd-filter-buttons.png'), fullPage: false });

await page.locator('[data-mhd-category-filter="mopro"]').click();
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(artifactsDir, 'mhd-filter-mopro.png'), fullPage: false });

await page.locator('[data-mhd-category-filter="kuehlware"]').click();
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(artifactsDir, 'mhd-filter-kuehlware.png'), fullPage: false });

await page.locator('[data-mhd-category-filter="alle"]').click();
await page.waitForTimeout(200);
const ampelLocator = page.locator('[data-mhd-days-badge]').first();
await ampelLocator.click();
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(artifactsDir, 'mhd-ampel-shows-date.png'), fullPage: false });

writeFileSync(path.join(artifactsDir, 'mhd-filter-ampel-verify.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));

const fail = [];
if (!result.filterButtons.includes('kuehlware')) fail.push('kein Kühlware-Filter');
if (!result.filterButtons.includes('mopro')) fail.push('kein MoPro-Filter');
if (!result.moproNames.some((n) => n.includes('Joghurt'))) fail.push('MoPro-Filter zeigt Joghurt nicht');
if (result.moproNames.some((n) => n.includes('Mayo') || n.includes('Limette') || n.includes('Dinkel'))) {
  fail.push('MoPro-Filter enthält Nicht-MoPro');
}
if (!result.kuehlNames.some((n) => n.includes('Mayo'))) fail.push('Kühlware-Filter zeigt Mayo nicht');
if (!result.kuehlNames.some((n) => n.includes('Limette'))) fail.push('Kühlware-Filter zeigt Aufschnitt nicht');
if (result.kuehlNames.some((n) => n.includes('Joghurt') || n.includes('Dinkel'))) {
  fail.push('Kühlware-Filter enthält falsche Gruppen');
}
if (!result.trockenNames.some((n) => n.includes('Dinkel'))) fail.push('Trockenware-Filter leer');
if (!/^MHD /.test(result.ampelAfter || '')) fail.push(`Ampel zeigt kein MHD-Datum: ${result.ampelAfter}`);
if (result.ampelMode !== 'date') fail.push('Ampel-Mode nicht date');
if (result.ampelBack !== result.ampelBefore) fail.push('Ampel-Toggle zurück fehlgeschlagen');
if (!result.alleHeaders.some((h) => /MoPro/.test(h))) fail.push('Gruppenkopf MoPro fehlt');
if (!result.alleHeaders.some((h) => /Kühlware/.test(h))) fail.push('Gruppenkopf Kühlware fehlt');

await context.close();
await browser.close();
server.close();

const videoFiles = spawnSync('bash', ['-lc', `ls -1 "${videoDir}"/*.webm 2>/dev/null | head -1`], {
  encoding: 'utf8',
}).stdout.trim();
if (videoFiles) {
  const outMp4 = path.join(artifactsDir, 'mhd-filter-ampel-demo.mp4');
  const ffmpeg = spawnSync('ffmpeg', ['-y', '-i', videoFiles, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', outMp4], {
    encoding: 'utf8',
  });
  if (ffmpeg.status === 0) {
    console.log('video:', outMp4);
  } else {
    console.warn('ffmpeg failed', ffmpeg.stderr?.slice(0, 400));
    spawnSync('cp', [videoFiles, path.join(artifactsDir, 'mhd-filter-ampel-demo.webm')]);
  }
}

if (fail.length) {
  console.error('FAIL', fail);
  process.exitCode = 1;
} else {
  console.log('OK verify-mhd-filter-ampel-toggle');
}
