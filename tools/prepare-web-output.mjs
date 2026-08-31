import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const webDir = path.join(projectRoot, 'web');
const distDir = path.join(projectRoot, 'dist');
const vercelConfigPath = path.join(projectRoot, 'vercel.json');

const REQUIRED_OUTPUT_FILES = [
  'beffe_calc.js',
  'datenschutz.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'sw.js',
  'index.html',
  'style.css',
  'app.js',
  'data/beffe_data.json',
];

function fail(message, details = '') {
  console.error(`\n[CharcuLogic] ${message}`);
  if (details) console.error(details.trimEnd());
  process.exit(1);
}

function assertFile(filePath, label) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    fail(`${label} fehlt: ${path.relative(projectRoot, filePath)}`);
  }
}

function validateVercelConfig() {
  console.log('\n[CharcuLogic] Vercel-Konfiguration wird geprueft...');
  assertFile(vercelConfigPath, 'vercel.json');

  let config;
  try {
    config = JSON.parse(readFileSync(vercelConfigPath, 'utf8'));
  } catch (err) {
    fail('vercel.json ist kein gueltiges JSON.', err?.message || String(err));
  }

  if (config.framework !== null) {
    fail('vercel.json: framework muss null sein (Preset "Other"), damit Vite/Flutter nicht auto-detektiert werden.');
  }
  if (config.outputDirectory !== 'dist') {
    fail(`vercel.json: outputDirectory muss "dist" sein, ist aber "${config.outputDirectory}".`);
  }
  if (config.buildCommand !== 'npm run build') {
    fail(`vercel.json: buildCommand muss "npm run build" sein, ist aber "${config.buildCommand}".`);
  }
  if (config.cleanUrls !== false) {
    fail('vercel.json: cleanUrls muss false sein, sonst wird /datenschutz.html umgeleitet.');
  }

  const rewrites = Array.isArray(config.rewrites) ? config.rewrites : [];
  const hasDatenschutz = rewrites.some((rule) => rule.source === '/datenschutz' && rule.destination === '/datenschutz.html');
  const hasDevDashboard = rewrites.some((rule) => rule.source === '/dev-dashboard' && rule.destination === '/index.html');
  if (!hasDatenschutz) {
    fail('vercel.json: Rewrite /datenschutz → /datenschutz.html fehlt.');
  }
  if (!hasDevDashboard) {
    fail('vercel.json: Rewrite /dev-dashboard → /index.html fehlt.');
  }

  const headers = Array.isArray(config.headers) ? config.headers : [];
  const headerMap = new Map(
    headers.map((entry) => [entry.source, entry.headers?.find((header) => header.key === 'Cache-Control')?.value]),
  );

  if (headerMap.get('/sw.js') !== 'no-cache') {
    fail('vercel.json: Cache-Control fuer /sw.js muss "no-cache" sein.');
  }
  if (headerMap.get('/service-worker.js') !== 'no-cache') {
    fail('vercel.json: Cache-Control fuer /service-worker.js muss "no-cache" sein.');
  }

  const immutableRule = headers.find((entry) => {
    const value = entry.headers?.find((header) => header.key === 'Cache-Control')?.value;
    return value === 'max-age=31536000, immutable';
  });
  if (!immutableRule) {
    fail('vercel.json: Cache-Control "max-age=31536000, immutable" fuer statische Assets fehlt.');
  }

  console.log('  OK vercel.json (PWA-Routing, SW no-cache, immutable Assets)');
}

function copyWebToDist() {
  console.log('\n[CharcuLogic] PWA-Assets werden nach dist/ kopiert...');
  if (!existsSync(webDir) || !statSync(webDir).isDirectory()) {
    fail('Quellordner web/ fehlt.');
  }

  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });
  cpSync(webDir, distDir, { recursive: true });
  console.log(`  OK ${path.relative(projectRoot, webDir)} → ${path.relative(projectRoot, distDir)}`);
}

function verifyDistOutput() {
  console.log('\n[CharcuLogic] Build-Output in dist/ wird geprueft...');
  const missing = REQUIRED_OUTPUT_FILES
    .map((relativePath) => ({ relativePath, diskPath: path.join(distDir, relativePath) }))
    .filter(({ diskPath }) => !existsSync(diskPath) || !statSync(diskPath).isFile());

  if (missing.length > 0) {
    fail(
      'Vercel-Output unvollstaendig. Diese Dateien fehlen in dist/:',
      missing.map(({ relativePath }) => `  ${relativePath}`).join('\n'),
    );
  }

  for (const relativePath of REQUIRED_OUTPUT_FILES) {
    const size = statSync(path.join(distDir, relativePath)).size;
    console.log(`  OK dist/${relativePath} (${size} Bytes)`);
  }
}

validateVercelConfig();
copyWebToDist();
verifyDistOutput();
console.log('\n🚀 [CharcuLogic] Vercel-PWA-Output bereit in dist/.');
