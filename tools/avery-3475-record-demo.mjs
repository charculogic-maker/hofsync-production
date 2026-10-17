/**
 * Records a short demo video of Avery 3475 form + label grid via Playwright.
 */
import { chromium } from 'playwright';
import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const artifactDir = '/opt/cursor/artifacts';
const BASE = 'http://127.0.0.1:4173';

await mkdir(artifactDir, { recursive: true });
await copyFile(
  path.join(root, 'tools/avery-3475-demo.html'),
  path.join(root, 'dist/avery-3475-demo.html'),
);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 430, height: 900 },
  recordVideo: { dir: artifactDir, size: { width: 430, height: 900 } },
});
const page = await context.newPage();

await page.goto(`${BASE}/avery-3475-demo.html`, { waitUntil: 'networkidle' });
await page.waitForSelector('#print-avery-container .avery-label');
await page.waitForTimeout(800);

await page.fill('#avery-start-position', '5');
await page.fill('#avery-label-count', '3');
await page.click('#btn-avery-print');
await page.waitForTimeout(1000);
await page.screenshot({ path: `${artifactDir}/avery-offset-5-preview.png`, fullPage: true });

await page.fill('#avery-start-position', '1');
await page.fill('#avery-label-count', '2');
await page.click('#btn-avery-print');
await page.waitForTimeout(1000);
await page.screenshot({ path: `${artifactDir}/avery-ui-manual.png`, fullPage: true });

const videoPath = await page.video().path();
await context.close();
await browser.close();

// Normalize to avery-print-demo.mp4 via ffmpeg if available
const outMp4 = path.join(artifactDir, 'avery-print-demo.mp4');
await new Promise((resolve, reject) => {
  const ff = spawn('ffmpeg', ['-y', '-i', videoPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', outMp4], {
    stdio: 'ignore',
  });
  ff.on('error', reject);
  ff.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`))));
});

console.log(JSON.stringify({ ok: true, videoPath, outMp4 }, null, 2));
