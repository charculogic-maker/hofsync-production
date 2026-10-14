#!/usr/bin/env node
/**
 * Smoke: Mobile Fußleisten-Entschlackung (Büro/Admin ausblenden, Header-Zugang, SW).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

const indexHtml = read('web/index.html');
const styleCss = read('web/style.css');
const appSrc = read('web/app.js');
const swSrc = read('web/sw.js');

assert.match(indexHtml, /nav-desktop-only/, 'Admin-Zone trägt nav-desktop-only');
assert.match(
  indexHtml,
  /id="admin-header-dashboard-link"/,
  'Header-Zahnrad enthält Verwaltungs-Link',
);
assert.match(
  indexHtml,
  /style\.css\?v=20261014-receiving-batch-cat-v1/,
  'style.css Cache-Buster mhd-full-redesign',
);

assert.match(
  styleCss,
  /@media \(max-width:\s*768px\)[\s\S]*?\.nav-desktop-only[\s\S]*?display:\s*none\s*!important/,
  'CSS blendet nav-desktop-only unter 768px aus',
);
assert.match(
  styleCss,
  /@media \(max-width:\s*768px\)[\s\S]*?\.nav-item[\s\S]*?min-height:\s*48px/,
  'Mobile Nav-Items haben mind. 48px Touch-Target',
);
assert.match(
  styleCss,
  /@media \(max-width:\s*768px\)[\s\S]*?\.bottom-nav-scroll[\s\S]*?overflow-x:\s*hidden/,
  'Fußleiste ohne horizontalen Scroll auf Mobile',
);

assert.match(appSrc, /DESKTOP_ONLY_NAV_TAB_IDS/, 'Desktop-only Tab-Set vorhanden');
assert.match(appSrc, /isMobileNavViewport/, 'Mobile-Viewport-Helfer vorhanden');
assert.match(appSrc, /resolveMobileOpsFallbackTab/, 'Mobile Fallback auf MHD vorhanden');
assert.match(appSrc, /MOBILE_OPS_DEFAULT_TAB = 'mhd'/, 'Fallback-Default ist MHD');
assert.match(appSrc, /syncAdminHeaderDashboardLink/, 'Header-Dashboard-Sync vorhanden');
assert.match(
  appSrc,
  /scrollable = !isMobileNavViewport\(\) && visibleCount > 3/,
  'Kein Scroll-Layout am Smartphone',
);

assert.match(
  swSrc,
  /CACHE_NAME = 'charculogic-v20261014-receiving-batch-cat-v1'/,
  'SW Cache-Version receiving-batch-cat-v1',
);

console.log('OK smoke-mobile-nav-cleanup: Mobile Nav-Entschlackung Verträge erfüllt.');
