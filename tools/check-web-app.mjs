import { execSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const webDir = path.join(projectRoot, 'web');
const indexPath = path.join(webDir, 'index.html');
const manifestPath = path.join(webDir, 'manifest.json');
const swPath = path.join(webDir, 'sw.js');
const totalChecks = 7;

function fail(message, details = '') {
  console.error(`\n[CharcuLogic] ${message}`);
  if (details) console.error(details.trimEnd());
  process.exit(1);
}

function logStep(message) {
  console.log(`\n[CharcuLogic] ${message}`);
}

async function listFilesRecursive(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFilesRecursive(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

async function checkJavaScriptSyntax() {
  logStep(`Check 1/${totalChecks}: JavaScript-Syntax wird geprueft...`);
  const webFiles = await readdir(webDir, { withFileTypes: true });
  const jsFiles = webFiles
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => path.join(webDir, entry.name))
    .sort();

  if (jsFiles.length === 0) {
    fail('Keine JavaScript-Dateien in web/ gefunden.');
  }

  for (const file of jsFiles) {
    try {
      execSync(`"${process.execPath}" --check "${file}"`, {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
      });
      console.log(`  OK ${path.relative(projectRoot, file)}`);
    } catch (err) {
      fail(
        `Syntaxfehler in ${path.relative(projectRoot, file)}`,
        `${err.stdout || ''}${err.stderr || err.message || ''}`,
      );
    }
  }
}

function extractServiceWorkerArray(source, arrayName) {
  const arrayMatch = source.match(new RegExp(`const\\s+${arrayName}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
  if (!arrayMatch) {
    fail(`Array ${arrayName} wurde in web/sw.js nicht gefunden.`);
  }

  return [...arrayMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

function assetPathToDiskPath(assetPath) {
  if (assetPath === '/') return path.join(webDir, 'index.html');
  const normalizedAsset = assetPath.replace(/^\/+/, '');
  const diskPath = path.resolve(webDir, normalizedAsset);

  if (!diskPath.startsWith(webDir + path.sep) && diskPath !== webDir) {
    fail(`Ungueltiger Service-Worker-Assetpfad: ${assetPath}`);
  }

  return diskPath;
}

function isExternalPath(reference) {
  return /^(?:[a-z]+:)?\/\//i.test(reference)
    || reference.startsWith('data:')
    || reference.startsWith('mailto:')
    || reference.startsWith('#');
}

function localReferenceToDiskPath(reference) {
  const cleanReference = reference.split(/[?#]/, 1)[0];
  if (!cleanReference) return null;
  if (cleanReference === '/') return indexPath;

  const normalizedReference = cleanReference.replace(/^\/+/, '');
  const diskPath = path.resolve(webDir, normalizedReference);

  if (!diskPath.startsWith(webDir + path.sep) && diskPath !== webDir) {
    fail(`Ungueltiger lokaler Pfad in web/index.html: ${reference}`);
  }

  return diskPath;
}

async function checkCacheAssetIntegrity() {
  logStep(`Check 2/${totalChecks}: Service-Worker-Cache-Assets werden geprueft...`);
  const swSource = await readFile(swPath, 'utf8');
  const assets = [
    ...extractServiceWorkerArray(swSource, 'CRITICAL_ASSETS'),
    ...extractServiceWorkerArray(swSource, 'SCANNER_LIBS'),
  ];

  const missingAssets = assets
    .map((asset) => ({ asset, diskPath: assetPathToDiskPath(asset) }))
    .filter(({ diskPath }) => !existsSync(diskPath));

  if (missingAssets.length > 0) {
    fail(
      'Cache-Asset-Integritaet fehlgeschlagen. Diese Dateien fehlen:',
      missingAssets
        .map(({ asset, diskPath }) => `  ${asset} -> ${path.relative(projectRoot, diskPath)}`)
        .join('\n'),
    );
  }

  console.log(`  OK ${assets.length} Cache-Assets vorhanden`);
}

async function checkHtmlReferences() {
  logStep(`Check 3/${totalChecks}: HTML-Referenzen werden geprueft...`);
  const html = await readFile(indexPath, 'utf8');
  const references = [
    ...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi),
    ...html.matchAll(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi),
  ]
    .map((match) => match[1])
    .filter((reference) => !isExternalPath(reference));

  const missingReferences = references
    .map((reference) => ({ reference, diskPath: localReferenceToDiskPath(reference) }))
    .filter(({ diskPath }) => diskPath && !existsSync(diskPath));

  if (missingReferences.length > 0) {
    fail(
      'HTML-Referenzen-Check fehlgeschlagen. Diese Dateien fehlen:',
      missingReferences
        .map(({ reference, diskPath }) => `  ${reference} -> ${path.relative(projectRoot, diskPath)}`)
        .join('\n'),
    );
  }

  console.log(`  OK ${references.length} lokale HTML-Referenzen vorhanden`);
}

async function checkManifestAndIcons() {
  logStep(`Check 4/${totalChecks}: Manifest und PWA-Icons werden geprueft...`);
  let manifest;

  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (err) {
    fail('web/manifest.json konnte nicht als JSON gelesen werden.', err?.message || String(err));
  }

  const validStartUrls = new Set(['/', '/index.html', './', './index.html', 'index.html']);
  if (!validStartUrls.has(manifest.start_url)) {
    fail(`Manifest start_url ist unerwartet: "${manifest.start_url}". Erwartet: ./index.html oder /index.html.`);
  }

  if (manifest.display !== 'standalone') {
    fail(`Manifest display muss "standalone" sein, ist aber "${manifest.display}".`);
  }

  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    fail('Manifest enthaelt kein icons-Array.');
  }

  const missingIcons = manifest.icons
    .map((icon) => ({
      src: icon?.src,
      diskPath: icon?.src ? localReferenceToDiskPath(icon.src) : null,
      type: icon?.type,
    }))
    .filter(({ src, diskPath, type }) => !src || !diskPath || type !== 'image/png' || !existsSync(diskPath));

  if (missingIcons.length > 0) {
    fail(
      'Manifest/Icon-Check fehlgeschlagen:',
      missingIcons
        .map(({ src, diskPath, type }) => `  ${src || '(src fehlt)'} -> ${diskPath ? path.relative(projectRoot, diskPath) : '(ungueltig)'}; type=${type || '(fehlt)'}`)
        .join('\n'),
    );
  }

  console.log(`  OK start_url=${manifest.start_url}, display=${manifest.display}, ${manifest.icons.length} Icon(s) vorhanden`);
}

function checkServiceWorkerVersionGuard() {
  logStep(`Check 5/${totalChecks}: Service-Worker-Version-Guard wird geprueft...`);
  if (process.env.VERCEL || process.env.CI) {
    console.log('  SKIP mtime-Guard auf CI/Vercel (Checkout-Zeitstempel sind nicht aussagekraeftig)');
    return;
  }
  const swMtime = statSync(swPath).mtimeMs;
  const guardedFiles = ['app.js', 'mhd.js', 'index.html'].map((fileName) => path.join(webDir, fileName));
  const newerFiles = guardedFiles.filter((file) => statSync(file).mtimeMs > swMtime);

  if (newerFiles.length > 0) {
    fail(
      "⚠️ ACHTUNG: App-Logik wurde geändert, aber 'web/sw.js' wurde seitdem nicht aktualisiert. Bitte CACHE_NAME erhöhen!",
      newerFiles.map((file) => `  Neuer als sw.js: ${path.relative(projectRoot, file)}`).join('\n'),
    );
  }

  console.log('  OK web/sw.js ist aktueller als die bewachten Kerndateien');
}

async function checkAntiRegressionMarkers() {
  logStep(`Check 6/${totalChecks}: Anti-Regression-Reste werden gesucht...`);
  const forbiddenMarkers = ['hidden-logout-trigger', 'window.charcuDebug'];
  const files = await listFilesRecursive(webDir);
  const findings = [];

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const marker of forbiddenMarkers) {
      const index = source.indexOf(marker);
      if (index === -1) continue;
      const line = source.slice(0, index).split(/\r?\n/).length;
      findings.push(`${path.relative(projectRoot, file)}:${line} enthaelt "${marker}"`);
    }
  }

  if (findings.length > 0) {
    fail('Anti-Regression-Check fehlgeschlagen. Alte Marker gefunden:', findings.map((item) => `  ${item}`).join('\n'));
  }

  console.log('  OK keine alten Logout- oder Debug-Marker gefunden');
}

async function checkRequiredDeployAssets() {
  logStep(`Check 7/${totalChecks}: Pflicht-Assets fuer PWA-Deploy werden geprueft...`);
  const requiredFiles = [
    'beffe_calc.js',
    'datenschutz.html',
    'manifest.json',
    'icon-192.png',
    'icon-512.png',
    'sw.js',
    'index.html',
    path.join('data', 'beffe_data.json'),
  ];

  const missingFiles = requiredFiles
    .map((relPath) => ({ relPath, diskPath: path.join(webDir, relPath) }))
    .filter(({ diskPath }) => !existsSync(diskPath));

  if (missingFiles.length > 0) {
    fail(
      'Pflicht-Assets fehlen in web/:',
      missingFiles
        .map(({ relPath, diskPath }) => `  ${relPath} -> ${path.relative(projectRoot, diskPath)}`)
        .join('\n'),
    );
  }

  console.log(`  OK ${requiredFiles.length} Pflicht-Assets vorhanden`);
}

try {
  await checkJavaScriptSyntax();
  await checkCacheAssetIntegrity();
  await checkHtmlReferences();
  await checkManifestAndIcons();
  checkServiceWorkerVersionGuard();
  await checkAntiRegressionMarkers();
  await checkRequiredDeployAssets();
  console.log('\n🚀 [CharcuLogic] Validierung erfolgreich! Bereit für Firebase- und Vercel-Deploy.');
} catch (err) {
  fail('Validierung unerwartet abgebrochen.', err?.stack || err?.message || String(err));
}
