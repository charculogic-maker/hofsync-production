/**
 * Smoke-Test: MHD Initial-Loading vs. Leermeldung (kein Empty-Flash).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mhdSrc = readFileSync(path.join(root, 'web/mhd.js'), 'utf8');
const indexSrc = readFileSync(path.join(root, 'web/index.html'), 'utf8');
const styleSrc = readFileSync(path.join(root, 'web/style.css'), 'utf8');
const swSrc = readFileSync(path.join(root, 'web/sw.js'), 'utf8');
const appSrc = readFileSync(path.join(root, 'web/app.js'), 'utf8');

function assertIncludes(haystack, needle, label) {
  assert.ok(haystack.includes(needle), `${label}: erwartet "${needle}"`);
}

function assertNotIncludes(haystack, needle, label) {
  assert.ok(!haystack.includes(needle), `${label}: darf "${needle}" nicht enthalten`);
}

// 1) Loading-State Helfer vorhanden
assertIncludes(mhdSrc, 'function shouldShowMhdCloudLoadingState(', 'Loading-Guard');
assertIncludes(mhdSrc, 'function isMhdCloudLoadSettled(', 'Settled-Guard');
assertIncludes(mhdSrc, 'function hasMhdCachedProducts(', 'Cache-first Guard');
assertIncludes(mhdSrc, 'function markMhdCloudSyncReady(', 'Ready-Marker');
assertIncludes(mhdSrc, 'function shouldKeepMhdCloudLoading(', 'fromCache Wait');
assertIncludes(mhdSrc, 'Artikel werden synchronisiert', 'Loading-Wording');

// 2) Ready wird nach Snapshot gesetzt (Regression: Dual-Query-Refactor)
assertIncludes(mhdSrc, 'markMhdCloudSyncReady()', 'applyInStock markiert Ready');
assertIncludes(mhdSrc, 'shouldKeepMhdCloudLoading(inStockSnaps, 2)', 'fromCache-Gate in applyInStock');
assertIncludes(mhdSrc, 'markMhdCloudSyncError()', 'Fehler setzt Error-Status');

// 3) Leermeldung nur nach settled
assertIncludes(mhdSrc, 'if (!isMhdCloudLoadSettled())', 'Empty nur nach Settled');
assertIncludes(mhdSrc, "cloudSyncStatus === 'idle'", 'idle zählt als Loading');

// 4) Stabiler Re-Render / kein Sprung bei Hintergrund-Sync
assertIncludes(mhdSrc, 'buildMhdListRenderKey', 'Render-Key gegen List-Rebuild');
assertIncludes(mhdSrc, 'mhd-card--enter', 'Fade-in Klasse');

// 5) HTML startet mit Skeleton, nicht mit Leermeldung
assertIncludes(indexSrc, 'data-mhd-render-mode="loading"', 'Initial Loading im Markup');
assertIncludes(indexSrc, 'Artikel werden synchronisiert', 'Initial Loading-Text');
assertNotIncludes(
  indexSrc.slice(indexSrc.indexOf('id="mhd-items-container"'), indexSrc.indexOf('id="mhd-items-container"') + 900),
  'Keine offenen Prüfungen',
  'Kein Empty im Initial-Markup',
);

// 6) CSS Skeleton + Fade-in
assertIncludes(styleSrc, '.mhd-skeleton-card', 'Skeleton-CSS');
assertIncludes(styleSrc, 'mhd-card-fade-in', 'Fade-in Keyframes');
assertIncludes(styleSrc, 'prefers-reduced-motion', 'Reduced-Motion Guard');

// 7) SW Cache-Version
assert.match(
  swSrc,
  /CACHE_NAME = 'charculogic-v20261013-mhd-loading-state-v1'/,
  'SW Cache-Version mhd-loading-state-v1',
);

// 8) App-Shell respektiert MHD Loading während Bootstrap
assertIncludes(appSrc, 'startMhdLiveSync()', 'App startet MHD Live-Sync');
assertIncludes(appSrc, 'pendingCloudSync', 'App kennt pending/Loading-Hinweis');

console.log('OK smoke-mhd-loading-state: Initial-Loading vs. Empty-Flash Verträge erfüllt.');
