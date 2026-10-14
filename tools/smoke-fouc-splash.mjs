#!/usr/bin/env node
/**
 * Smoke: FOUC-/Splash-Boot (Inline-CSS, Theme-Script, Cache, Manifest).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

const indexHtml = read('web/index.html');
const styleCss = read('web/style.css');
const swSrc = read('web/sw.js');
const appSrc = read('web/app.js');
const brandingSrc = read('web/branding.js');
const manifest = JSON.parse(read('web/manifest.json'));

assert.match(indexHtml, /background-color:\s*#1c130e\s*!important/, 'Inline-Boot-CSS setzt #1c130e');
assert.match(indexHtml, /meta name="theme-color" content="#1c130e"/, 'theme-color Meta ist #1c130e');
assert.match(indexHtml, /bootThemeSplash/, 'Synchrones Boot-Script vorhanden');
assert.match(indexHtml, /charculogic_brand_bg/, 'Boot-Script liest Mandanten-Hintergrund');
assert.match(indexHtml, /charculogic\.theme|charculogic_theme/, 'Boot-Script liest Theme-Key');
assert.match(
  indexHtml,
  /style\.css\?v=20261014-mhd-full-redesign-v1/,
  'style.css Cache-Buster aktualisiert',
);

assert.match(swSrc, /CACHE_NAME = 'charculogic-v20261014-mhd-full-redesign-v1'/);
assert.match(appSrc, /APP_RELEASE_AT = '2026-10-14T08:45:00\+02:00'/);
assert.match(appSrc, /persistBootBrandColors/);
assert.match(appSrc, /charculogic_brand_bg/);
assert.match(brandingSrc, /background_color:\s*splashColor/);
assert.match(brandingSrc, /theme_color:\s*splashColor/);

assert.equal(manifest.background_color.toLowerCase(), '#1c130e');
assert.equal(manifest.theme_color.toLowerCase(), '#1c130e');

assert.match(styleCss, /--boot-bg:\s*#1c130e/);
assert.match(styleCss, /\[data-theme="dark"\][\s\S]*--bg-color:\s*#1c130e/);
assert.match(styleCss, /html,\s*body\s*\{[\s\S]*background-color:\s*var\(--bg-color/);
assert.match(styleCss, /\.app-container\s*\{[\s\S]*background-color:\s*var\(--bg-color/);
assert.match(styleCss, /overscroll-behavior:\s*none/);

console.log('OK FOUC-Splash-Smoke: Inline-CSS, Theme-Boot, SW, Manifest und Shell-Hintergründe konsistent.');
