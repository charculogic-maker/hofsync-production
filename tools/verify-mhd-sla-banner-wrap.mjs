#!/usr/bin/env node
/**
 * iPhone-14: SLA-Banner mit Zähler 40 – Ziffern dürfen nicht umbrechen.
 * Isoliertes Fixture (style.css + mhd-sla.js), ohne Auth-Shell.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactsDir = '/opt/cursor/artifacts';
mkdirSync(artifactsDir, { recursive: true });

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

const fixtureHtml = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <link rel="stylesheet" href="/style.css" />
  <style>
    body { margin: 0; background: #f4f6f8; font-family: system-ui, sans-serif; }
    #frame { padding: 12px 0; max-width: 390px; margin: 0 auto; }
  </style>
</head>
<body>
  <div id="frame">
    <button type="button" id="mhd-sla-banner" class="mhd-sla-banner hidden" hidden></button>
  </div>
  <script type="module">
    import { updateMhdSlaBanner } from '/mhd-sla.js';
    updateMhdSlaBanner(40, { onOpen: () => {} });
    window.__slaBannerReady = true;
  </script>
</body>
</html>`;

function serve() {
  return createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/' || urlPath === '/index.html' || urlPath === '/fixture.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fixtureHtml);
      return;
    }
    const filePath = path.join(root, 'web', urlPath);
    if (!filePath.startsWith(path.join(root, 'web')) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
    res.end(readFileSync(filePath));
  });
}

const server = serve();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});
await page.goto(`http://127.0.0.1:${port}/fixture.html`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForFunction(() => window.__slaBannerReady === true, null, { timeout: 15000 });

const result = await page.evaluate(() => {
  const banner = document.getElementById('mhd-sla-banner');
  const count = banner?.querySelector('.mhd-sla-banner-count');
  if (!banner || !count) return { ok: false, error: 'missing' };
  const style = getComputedStyle(banner);
  const countStyle = getComputedStyle(count);
  const countBox = count.getBoundingClientRect();
  const lineHeight = Number.parseFloat(countStyle.lineHeight) || Number.parseFloat(countStyle.fontSize) * 1.35;
  const wrapsDigits = countBox.height > lineHeight * 1.55;
  const text = (banner.innerText || '').replace(/\s+/g, ' ').trim();
  return {
    ok: style.display === 'block'
      && countStyle.whiteSpace === 'nowrap'
      && !wrapsDigits
      && /^40\s+kritische/.test(text),
    display: style.display,
    countWhiteSpace: countStyle.whiteSpace,
    countHeight: Math.round(countBox.height * 100) / 100,
    lineHeight: Math.round(lineHeight * 100) / 100,
    wrapsDigits,
    text,
    bannerWidth: Math.round(banner.getBoundingClientRect().width),
  };
});

const shotPath = path.join(artifactsDir, 'mhd-sla-banner-40-nowrap.png');
await page.screenshot({ path: shotPath, fullPage: false });
writeFileSync(path.join(artifactsDir, 'mhd-sla-banner-40-nowrap.json'), JSON.stringify(result, null, 2));

await browser.close();
server.close();

if (!result.ok) {
  console.error('FAIL verify-mhd-sla-banner-wrap', result);
  process.exit(1);
}
console.log('OK verify-mhd-sla-banner-wrap', result);
console.log('screenshot', shotPath);
