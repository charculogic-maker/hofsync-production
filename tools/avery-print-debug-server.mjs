/**
 * Static server for Avery print debugging.
 * Serves web/ (+ dist/ smoke html) and appends POST /__debug_log → /opt/cursor/logs/debug.log
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const webRoot = path.join(root, 'web');
const distRoot = path.join(root, 'dist');
const LOG = '/opt/cursor/logs/debug.log';
const PORT = Number(process.env.AVERY_DEBUG_PORT || 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

fs.mkdirSync(path.dirname(LOG), { recursive: true });
fs.mkdirSync(distRoot, { recursive: true });

const smokeHtml = `<!DOCTYPE html>
<html lang="de"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/style.css">
<link rel="stylesheet" href="/avery-labels.css">
<title>Avery Print Debug Repro</title>
<style>
  body { background: #0f172a; color: #e2e8f0; }
  @media print {
    body > *:not(.preview-container) { display: none !important; }
  }
</style>
</head><body>
<div class="preview-container"><div id="page-avery" class="page active"></div></div>
<script type="module">
  import { initAveryLabelsModule, printAveryLabelsSheet } from '/avery-labels.js';
  window.print = () => {
    window.__printed = true;
    window.__printBodyClass = document.body.classList.contains('print-avery-labels');
    window.__printAreaParent = document.getElementById('avery-print-area')?.parentElement?.tagName || null;
    window.__printLabelCount = document.querySelectorAll('#avery-print-area .avery-label').length;
    window.__printFilled = document.querySelectorAll('#avery-print-area .avery-label:not(.empty)').length;
    const area = document.getElementById('avery-print-area');
    let display = null;
    try {
      if (area) display = getComputedStyle(area).display;
    } catch (_) {}
    window.__printAreaDisplay = display;
    console.log('[AVERY-DEBUG-PRINT]', JSON.stringify({
      bodyClass: window.__printBodyClass,
      areaParent: window.__printAreaParent,
      labelCount: window.__printLabelCount,
      filled: window.__printFilled,
      areaDisplay: display,
    }));
  };
  window.showToast = (msg, type) => { window.__toast = { msg, type }; };
  window.BRANDING = { betriebsName: 'StevesHof Hofladen' };
  initAveryLabelsModule();
  window.__print = printAveryLabelsSheet;
</script>
</body></html>`;

fs.writeFileSync(path.join(distRoot, 'avery-labels-smoke.html'), smokeHtml);
fs.writeFileSync(path.join(webRoot, 'avery-labels-smoke.html'), smokeHtml);

function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  if (clean === '/' || clean === '/avery-labels-smoke.html') {
    return path.join(webRoot, 'avery-labels-smoke.html');
  }
  const candidates = [
    path.join(webRoot, clean),
    path.join(distRoot, clean),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);

  if (req.method === 'POST' && url.pathname === '/__debug_log') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const parsed = JSON.parse(body || '{}');
      fs.appendFileSync(LOG, `${JSON.stringify(parsed)}\n`);
      res.writeHead(204);
      res.end();
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end(String(err));
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/__debug_log/dump') {
    const raw = fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8') : '';
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(raw);
    return;
  }

  const file = resolveFile(url.pathname);
  if (!file) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(file);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Avery debug server http://127.0.0.1:${PORT}/avery-labels-smoke.html`);
  console.log(`Debug log → ${LOG}`);
});
