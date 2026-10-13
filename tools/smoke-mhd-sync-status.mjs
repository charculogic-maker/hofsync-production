/**
 * Smoke-Test: Firestore-Datenvertrag Raus/Ausverkauft + aktive Prüflisten-Filter.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mhdSrc = readFileSync(path.join(root, 'web/mhd.js'), 'utf8');
const syncSrc = readFileSync(path.join(root, 'web/sync.js'), 'utf8');
const rulesSrc = readFileSync(path.join(root, 'firebase.rules'), 'utf8');
const swSrc = readFileSync(path.join(root, 'web/sw.js'), 'utf8');
const archiveSrc = readFileSync(path.join(root, 'functions/mhdArchive.js'), 'utf8');

function assertIncludes(haystack, needle, label) {
  assert.ok(haystack.includes(needle), `${label}: erwartet "${needle}"`);
}

// 1) Datenvertrag-Helfer
assertIncludes(mhdSrc, 'function buildMhdZeroStockContract(', 'Zero-Stock-Contract');
assertIncludes(mhdSrc, "kind === 'raus' ? 'raus' : 'ausverkauft'", 'status raus/ausverkauft');
assertIncludes(mhdSrc, 'archived: true', 'archived true');
assertIncludes(mhdSrc, 'active: false', 'active false');
assertIncludes(mhdSrc, 'actionTimestamp', 'actionTimestamp');
assertIncludes(mhdSrc, 'lastActionBy', 'lastActionBy');
assertIncludes(mhdSrc, "buildMhdZeroStockContract('raus')", 'Raus nutzt Contract');
assertIncludes(mhdSrc, "buildMhdZeroStockContract('ausverkauft'", 'Ausverkauft nutzt Contract');

// 2) Strikte aktive Filterung
assertIncludes(mhdSrc, 'function isInactiveMhdChecklistDoc(', 'Inactive-Helper');
assertIncludes(mhdSrc, 'function isActiveMhdChecklistItem(', 'Active-Helper');
assertIncludes(mhdSrc, 'isActiveMhdChecklistItem(prod)', 'filterMhdProducts aktiv');
assertIncludes(mhdSrc, 'isActiveMhdChecklistItem(item)', 'Live-Sync aktiv');
assertIncludes(mhdSrc, "MHD_INACTIVE_STATUSES", 'Inactive-Status-Set');

// 3) Shared Store Felder in Sanitize/Rules/Sync
for (const field of ['archived', 'active', 'actionTimestamp', 'lastActionBy']) {
  assertIncludes(mhdSrc, `'${field}'`, `mhd WRITE_FIELDS ${field}`);
  assertIncludes(syncSrc, `'${field}'`, `sync SYNC_FIELDS ${field}`);
  assertIncludes(rulesSrc, `'${field}'`, `firestore.rules create allowlist ${field}`);
}

// 4) Archiv-Kandidaten inkl. archived/active
assertIncludes(archiveSrc, 'data.archived === true || data.active === false', 'mhdArchive archived/active');

// 5) SW Cache
assert.match(swSrc, /CACHE_NAME = 'charculogic-v\d{8}-[^']+'/, 'SW Cache-Version gesetzt');

// 6) Spiegel: aktive Prüfliste darf inaktive Docs nie durchlassen
const MHD_INACTIVE_STATUSES = new Set([
  'raus',
  'ausverkauft',
  'abgeschrieben',
  'rausgenommen',
  'sold_out',
  'disposed',
]);

function mhdItemQuantity(item) {
  const qty = Number(item?.menge ?? item?.qty ?? 0);
  return Number.isFinite(qty) ? qty : 0;
}

function isInactiveMhdChecklistDoc(data = {}) {
  if (mhdItemQuantity(data) <= 0) return true;
  if (data.archived === true) return true;
  if (data.active === false) return true;
  if (data.soldOut === true) return true;
  const status = String(data.status || '').trim().toLowerCase();
  return MHD_INACTIVE_STATUSES.has(status);
}

function isActiveMhdChecklistItem(data = {}) {
  return !isInactiveMhdChecklistDoc(data);
}

const samples = [
  { id: 'ok', menge: 3, status: 'aktiv', active: true, archived: false },
  { id: 'zero', menge: 0, qty: 0, status: 'aktiv' },
  { id: 'raus', menge: 2, status: 'raus', archived: true, active: false },
  { id: 'aus', menge: 5, status: 'ausverkauft', soldOut: true },
  { id: 'arch', menge: 4, archived: true, status: 'aktiv' },
  { id: 'inactive', menge: 4, active: false, status: 'aktiv' },
  { id: 'ab', menge: 1, status: 'abgeschrieben' },
];

const active = samples.filter(isActiveMhdChecklistItem);
assert.deepEqual(active.map((s) => s.id), ['ok'], 'nur aktive Posten in Prüfliste');

const zeros = samples.filter((s) => mhdItemQuantity(s) <= 0 || isInactiveMhdChecklistDoc(s));
assert.ok(zeros.length === samples.length - 1, '0er/Archiv enthält alle Inaktiven');

console.log('OK smoke-mhd-sync-status: Raus/Ausverkauft-Vertrag & Filter erfüllt.');
