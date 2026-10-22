#!/usr/bin/env node
/**
 * Shell repro for MHD edit/list stability bugs (no Firebase).
 * Mirrors current mhd.js merge/renderKey/save behavior and writes NDJSON
 * evidence to /opt/cursor/logs/debug.log.
 *
 * Run: node tools/mhd-edit-stability-repro.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const LOG_PATH = '/opt/cursor/logs/debug.log';

function log(hypothesisId, location, message, data = {}) {
  const line = JSON.stringify({
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
    runId: process.env.MHD_DEBUG_RUN_ID || 'pre-fix',
  });
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.appendFileSync(LOG_PATH, `${line}\n`);
  console.log(line);
}

/** Current (buggy) render key — omits lastCheckedDate / mhdActionStatus */
function buildMhdListRenderKeyBuggy(products = []) {
  return products.map((prod) => {
    const qty = Number(prod?.qty ?? prod?.menge ?? 0);
    const mhd = String(prod?.mhd || prod?.mhdDate || prod?.expiryDate || '');
    const status = String(prod?.status || '');
    return `${prod?.id || ''}:${qty}:${mhd}:${status}`;
  }).join('|');
}

/** Proposed fixed render key */
function buildMhdListRenderKeyFixed(products = []) {
  return products.map((prod) => {
    const qty = Number(prod?.qty ?? prod?.menge ?? 0);
    const mhd = String(prod?.mhd || prod?.mhdDate || prod?.expiryDate || '');
    const status = String(prod?.status || '');
    const checked = String(prod?.lastCheckedDate || prod?.lastMhdCheckDate || '');
    const action = String(prod?.mhdActionStatus || '');
    return `${prod?.id || ''}:${qty}:${mhd}:${status}:${checked}:${action}`;
  }).join('|');
}

function mergeCloudProductsWithPendingChanges(cloudProducts = [], pending = {}, previousProducts = []) {
  const pendingIds = Object.keys(pending);
  if (!pendingIds.length) return cloudProducts;
  const mergedById = new Map();
  cloudProducts.forEach((prod) => {
    if (!prod?.id) return;
    mergedById.set(prod.id, pending[prod.id] ? { ...prod, ...pending[prod.id] } : prod);
  });
  pendingIds.forEach((id) => {
    if (mergedById.has(id)) return;
    const previous = previousProducts.find((prod) => prod.id === id);
    if (previous) mergedById.set(id, { ...previous, ...pending[id] });
  });
  return [...mergedById.values()];
}

/** Current (buggy) live merge — assigns cloud docs without pending overlay */
function mergeMhdLiveProductsBuggy(state) {
  const inStock = Array.isArray(state.inStockProducts) ? state.inStockProducts : [];
  state.products = inStock;
  return state.products;
}

function mergeMhdLiveProductsFixed(state) {
  const inStock = Array.isArray(state.inStockProducts) ? state.inStockProducts : [];
  state.products = mergeCloudProductsWithPendingChanges(inStock, state.pendingChanges, state.products);
  return state.products;
}

function simulateScenario() {
  const today = '2026-10-22';
  const state = {
    products: [
      { id: 'a1', qty: 2, mhd: '2026-10-24', status: 'aktiv' },
      { id: 'a2', qty: 1, mhd: '2026-10-23', status: 'aktiv' },
    ],
    inStockProducts: [
      { id: 'a1', qty: 2, mhd: '2026-10-24', status: 'aktiv' },
      { id: 'a2', qty: 1, mhd: '2026-10-23', status: 'aktiv' },
    ],
    pendingChanges: {},
  };

  // Stage completion edit on a1 (as stageMhdChange would)
  state.pendingChanges.a1 = { lastCheckedDate: today, mhdActionStatus: 'ok' };
  state.products = state.products.map((p) => (
    p.id === 'a1' ? { ...p, lastCheckedDate: today, mhdActionStatus: 'ok' } : p
  ));

  const keyBefore = buildMhdListRenderKeyBuggy(state.products);
  const keyBeforeFixed = buildMhdListRenderKeyFixed(state.products);

  log('E', 'repro:stage', 'staged-completion-edit', {
    id: 'a1',
    productHasLastChecked: Boolean(state.products.find((p) => p.id === 'a1')?.lastCheckedDate),
    pendingCount: Object.keys(state.pendingChanges).length,
  });

  // Simulate animate exit leaving class still on DOM while live sync arrives
  const leavingCount = 1;

  // Live snapshot replaces products WITHOUT pending merge (bug A)
  const beforeChecked = Boolean(state.products.find((p) => p.id === 'a1')?.lastCheckedDate);
  mergeMhdLiveProductsBuggy(state);
  const afterChecked = Boolean(state.products.find((p) => p.id === 'a1')?.lastCheckedDate);
  const wiped = beforeChecked && !afterChecked;

  log('A', 'repro:mergeMhdLiveProducts', 'live-merge-assigned', {
    pendingCount: Object.keys(state.pendingChanges).length,
    usedPendingMerge: false,
    wipedPendingLocalFields: wiped ? 1 : 0,
    wipedSample: wiped ? { id: 'a1', hadLastCheckedDate: true, hasLastCheckedDate: false } : null,
    afterSample: {
      id: 'a1',
      hasLastCheckedDate: afterChecked,
      pendingHasLastCheckedDate: Boolean(state.pendingChanges.a1?.lastCheckedDate),
    },
  });

  // Prove helper exists but buggy path did not call it (hypothesis B)
  const wouldKeep = mergeCloudProductsWithPendingChanges(
    state.inStockProducts,
    state.pendingChanges,
    [{ id: 'a1', qty: 2, mhd: '2026-10-24', status: 'aktiv', lastCheckedDate: today }],
  );
  log('B', 'repro:mergeCloudProductsWithPendingChanges', 'pending-merge-would-preserve', {
    pendingCount: 1,
    sampleHasLastChecked: Boolean(wouldKeep.find((p) => p.id === 'a1')?.lastCheckedDate),
    buggyPathUsedPendingMerge: false,
  });

  // Render key unchanged after wipe → skip re-render while leaving class remains (D)
  const keyAfterWipe = buildMhdListRenderKeyBuggy(state.products);
  const renderSkipped = keyBefore === keyAfterWipe;
  log('D', 'repro:renderMhdList', 'render-skipped-same-key', {
    productCount: state.products.length,
    leavingCount,
    keyOmitsCompletionFields: true,
    renderSkipped,
    keysEqual: renderSkipped,
    buggyKeyBefore: keyBefore.slice(0, 80),
    buggyKeyAfter: keyAfterWipe.slice(0, 80),
    fixedKeyWouldChange: keyBeforeFixed !== buildMhdListRenderKeyFixed(state.products),
  });

  // Save clears pending without render; products lack lastCheckedDate → reappear in Offen (C)
  state.pendingChanges = {};
  const offenAgain = !state.products.find((p) => p.id === 'a1')?.lastCheckedDate;
  log('C', 'repro:saveAllPendingMhdChanges', 'cleared-pending-no-render', {
    savedCount: 1,
    productsStillHaveCheckStamp: offenAgain ? 0 : 1,
    willCallRender: false,
    reappearsInOffen: offenAgain,
  });

  // Contrast: fixed merge would keep stamp through live sync
  const fixedState = {
    products: [
      { id: 'a1', qty: 2, mhd: '2026-10-24', status: 'aktiv', lastCheckedDate: today, mhdActionStatus: 'ok' },
    ],
    inStockProducts: [
      { id: 'a1', qty: 2, mhd: '2026-10-24', status: 'aktiv' },
    ],
    pendingChanges: { a1: { lastCheckedDate: today, mhdActionStatus: 'ok' } },
  };
  mergeMhdLiveProductsFixed(fixedState);
  log('A', 'repro:fixed-merge-contrast', 'fixed-merge-keeps-pending', {
    hasLastCheckedDate: Boolean(fixedState.products.find((p) => p.id === 'a1')?.lastCheckedDate),
    usedPendingMerge: true,
  });

  return {
    wiped,
    renderSkipped,
    leavingStuckEditable: renderSkipped && leavingCount > 0,
    reappearsInOffen: offenAgain,
    fixedMergeKeepsStamp: Boolean(fixedState.products.find((p) => p.id === 'a1')?.lastCheckedDate),
  };
}

const result = simulateScenario();
console.error('\n[mhd-edit-stability-repro] summary:', result);
if (!result.wiped || !result.renderSkipped || !result.reappearsInOffen) {
  console.error('[mhd-edit-stability-repro] unexpected: bug signals missing — inspect logs');
  process.exit(2);
}
console.error('[mhd-edit-stability-repro] bug signals confirmed (pre-fix)');
process.exit(0);
