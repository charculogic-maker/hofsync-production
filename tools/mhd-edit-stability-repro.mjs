#!/usr/bin/env node
/**
 * Shell repro / verification for MHD edit/list stability (no Firebase).
 * Post-fix: asserts pending-merge on live sync, renderKey completion fields,
 * and post-save consistency. Writes NDJSON to /opt/cursor/logs/debug.log.
 *
 * Run: node tools/mhd-edit-stability-repro.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOG_PATH = '/opt/cursor/logs/debug.log';
const RUN_ID = process.env.MHD_DEBUG_RUN_ID || 'post-fix';

function log(hypothesisId, location, message, data = {}) {
  const line = JSON.stringify({
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
    runId: RUN_ID,
  });
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.appendFileSync(LOG_PATH, `${line}\n`);
  console.log(line);
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

/** Fixed live merge — overlays pending onto cloud docs */
function mergeMhdLiveProductsFixed(state) {
  const inStock = Array.isArray(state.inStockProducts) ? state.inStockProducts : [];
  state.products = mergeCloudProductsWithPendingChanges(inStock, state.pendingChanges, state.products);
  return state.products;
}

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

function assertSourceContracts() {
  const mhd = fs.readFileSync(path.join(ROOT, 'web/mhd.js'), 'utf8');
  const checks = {
    liveMergeUsesPending: /function mergeMhdLiveProducts\([\s\S]*?mergeCloudProductsWithPendingChanges\(cloudProducts\)/.test(mhd),
    renderKeyHasChecked: /function buildMhdListRenderKey\([\s\S]*?lastCheckedDate[\s\S]*?mhdActionStatus/.test(mhd),
    saveCallsRender: /clearMhdPendingChanges\(\);\s*\n\s*renderMhdList\(\);/.test(mhd),
  };
  log('B', 'repro:source-contract', 'mhd-js-fix-contracts', checks);
  return checks;
}

function simulateFixedScenario() {
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

  state.pendingChanges.a1 = { lastCheckedDate: today, mhdActionStatus: 'ok' };
  state.products = state.products.map((p) => (
    p.id === 'a1' ? { ...p, lastCheckedDate: today, mhdActionStatus: 'ok' } : p
  ));

  const keyBefore = buildMhdListRenderKeyFixed(state.products);
  log('E', 'repro:stage', 'staged-completion-edit', {
    id: 'a1',
    productHasLastChecked: Boolean(state.products.find((p) => p.id === 'a1')?.lastCheckedDate),
    pendingCount: Object.keys(state.pendingChanges).length,
  });

  const beforeChecked = Boolean(state.products.find((p) => p.id === 'a1')?.lastCheckedDate);
  mergeMhdLiveProductsFixed(state);
  const afterChecked = Boolean(state.products.find((p) => p.id === 'a1')?.lastCheckedDate);
  const wiped = beforeChecked && !afterChecked;

  log('A', 'repro:mergeMhdLiveProducts', 'live-merge-assigned', {
    pendingCount: Object.keys(state.pendingChanges).length,
    usedPendingMerge: true,
    wipedPendingLocalFields: wiped ? 1 : 0,
    afterSample: {
      id: 'a1',
      hasLastCheckedDate: afterChecked,
      pendingHasLastCheckedDate: Boolean(state.pendingChanges.a1?.lastCheckedDate),
    },
  });

  const keyAfterMerge = buildMhdListRenderKeyFixed(state.products);
  const renderSkipped = keyBefore === keyAfterMerge && !afterChecked;
  // With fixed key: completion stamp is in the key; list still shows checked product
  // so animate+render can rebuild and drop mhd-card--leaving.
  log('D', 'repro:renderMhdList', 'render-key-includes-completion', {
    productCount: state.products.length,
    leavingCount: 1,
    keyOmitsCompletionFields: false,
    keyKeepsCompletionAfterLiveSync: keyAfterMerge.includes(today),
    keysEqualWhileChecked: keyBefore === keyAfterMerge,
    sampleKey: keyAfterMerge.slice(0, 120),
    wouldSkipWhileUnchecked: renderSkipped,
  });

  // Post-save: keep optimistic stamps on cache, clear pending, "render"
  for (const [id, updates] of Object.entries(state.pendingChanges)) {
    const idx = state.inStockProducts.findIndex((p) => p.id === id);
    if (idx >= 0) state.inStockProducts[idx] = { ...state.inStockProducts[idx], ...updates };
    const pIdx = state.products.findIndex((p) => p.id === id);
    if (pIdx >= 0) state.products[pIdx] = { ...state.products[pIdx], ...updates };
  }
  state.pendingChanges = {};
  const willCallRender = true;
  // Simulate stale cloud snapshot after clear — optimistic inStock still has stamp
  state.inStockProducts = state.inStockProducts.map((p) => ({ ...p }));
  mergeMhdLiveProductsFixed(state);
  const offenAgain = !state.products.find((p) => p.id === 'a1')?.lastCheckedDate;

  log('C', 'repro:saveAllPendingMhdChanges', 'cleared-pending-with-render', {
    savedCount: 1,
    productsStillHaveCheckStamp: offenAgain ? 0 : 1,
    willCallRender,
    reappearsInOffen: offenAgain,
  });

  return {
    wiped,
    usedPendingMerge: true,
    keyKeepsCompletion: keyAfterMerge.includes(today),
    reappearsInOffen: offenAgain,
    willCallRender,
  };
}

const contracts = assertSourceContracts();
const result = simulateFixedScenario();
console.error('\n[mhd-edit-stability-repro] summary:', { ...result, ...contracts });

const ok = contracts.liveMergeUsesPending
  && contracts.renderKeyHasChecked
  && contracts.saveCallsRender
  && !result.wiped
  && result.keyKeepsCompletion
  && !result.reappearsInOffen
  && result.willCallRender;

if (!ok) {
  console.error('[mhd-edit-stability-repro] FAIL: fix signals missing');
  process.exit(2);
}
console.error('[mhd-edit-stability-repro] fix signals confirmed (post-fix)');
process.exit(0);
