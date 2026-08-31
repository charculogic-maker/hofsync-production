import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const webDir = path.join(projectRoot, 'web');
const outputDir = path.join(projectRoot, 'dist');

const REQUIRED_OUTPUT_FILES = [
  'index.html',
  'datenschutz.html',
  'beffe_calc.js',
  'manifest.json',
  'sw.js',
  'icon-192.png',
  'icon-512.png',
  path.join('data', 'beffe_data.json'),
];

function fail(message, details = '') {
  console.error(`\n[HofSync] ${message}`);
  if (details) console.error(details.trimEnd());
  process.exit(1);
}

function shouldCopy(srcPath) {
  const name = path.basename(srcPath);
  if (name.endsWith('.log')) return false;
  if (name === '.DS_Store' || name === 'Thumbs.db') return false;
  return true;
}

async function assertFile(relPath) {
  const diskPath = path.join(outputDir, relPath);
  if (!existsSync(diskPath)) {
    fail(`Build-Output unvollständig. Fehlt: ${relPath}`);
  }
  const info = await stat(diskPath);
  if (!info.isFile() || info.size <= 0) {
    fail(`Build-Output ungültig: ${relPath}`);
  }
  console.log(`  OK dist/${relPath.replaceAll('\\', '/')} (${info.size} bytes)`);
}

async function preparePwaOutput() {
  if (!existsSync(webDir)) {
    fail('Quellordner web/ wurde nicht gefunden.');
  }

  console.log('\n[HofSync] PWA-Output wird nach dist/ kopiert...');
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await cp(webDir, outputDir, {
    recursive: true,
    filter: shouldCopy,
  });

  console.log('[HofSync] Pflicht-Assets im Build-Output:');
  for (const relPath of REQUIRED_OUTPUT_FILES) {
    await assertFile(relPath);
  }

  console.log('\n🚀 [HofSync] dist/ ist bereit für Vercel.');
}

try {
  await preparePwaOutput();
} catch (err) {
  fail('PWA-Output konnte nicht erzeugt werden.', err?.stack || err?.message || String(err));
}
