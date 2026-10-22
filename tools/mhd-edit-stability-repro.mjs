#!/usr/bin/env node
/**
 * Lean regression check for MHD edit/list stability (no Firebase).
 * Verifies source contracts in web/mhd.js and simulates pending-merge /
 * renderKey / post-save behaviour. Exit 0 on success, 2 on failure.
 *
 * Run: node tools/mhd-edit-stability-repro.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

function mergeMhdLiveProducts(state) {
  const inStock = Array.isArray(state.inStockProducts) ? state.inStockProducts : [];
  state.products = mergeCloudProductsWithPendingChanges(inStock, state.pendingChanges, state.products);
  return state.products;
}

function buildMhdListRenderKey(products = []) {
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
  return {
    liveMergeUsesPending: /function mergeMhdLiveProducts\([\s\S]*?mergeCloudProductsWithPendingChanges\(cloudProducts\)/.test(mhd),
    renderKeyHasChecked: /function buildMhdListRenderKey\([\s\S]*?lastCheckedDate[\s\S]*?mhdActionStatus/.test(mhd),
    saveCallsRender: /clearMhdPendingChanges\(\);\s*\n\s*renderMhdList\(\);/.test(mhd),
    noAgentDebugLog: !mhd.includes('mhdAgentDebugLog') && !mhd.includes('#region agent log'),
  };
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

  state.pendingChanges.a1 = { lastCheckedDate: today, mhdActionStatus: 'ok' };
  state.products = state.products.map((p) => (
    p.id === 'a1' ? { ...p, lastCheckedDate: today, mhdActionStatus: 'ok' } : p
  ));

  const beforeChecked = Boolean(state.products.find((p) => p.id === 'a1')?.lastCheckedDate);
  mergeMhdLiveProducts(state);
  const afterChecked = Boolean(state.products.find((p) => p.id === 'a1')?.lastCheckedDate);
  const keyAfter = buildMhdListRenderKey(state.products);

  for (const [id, updates] of Object.entries(state.pendingChanges)) {
    const idx = state.inStockProducts.findIndex((p) => p.id === id);
    if (idx >= 0) state.inStockProducts[idx] = { ...state.inStockProducts[idx], ...updates };
    const pIdx = state.products.findIndex((p) => p.id === id);
    if (pIdx >= 0) state.products[pIdx] = { ...state.products[pIdx], ...updates };
  }
  state.pendingChanges = {};
  mergeMhdLiveProducts(state);
  const reappearsInOffen = !state.products.find((p) => p.id === 'a1')?.lastCheckedDate;

  return {
    wiped: beforeChecked && !afterChecked,
    keyKeepsCompletion: keyAfter.includes(today),
    reappearsInOffen,
  };
}

const contracts = assertSourceContracts();
const result = simulateScenario();
const ok = contracts.liveMergeUsesPending
  && contracts.renderKeyHasChecked
  && contracts.saveCallsRender
  && contracts.noAgentDebugLog
  && !result.wiped
  && result.keyKeepsCompletion
  && !result.reappearsInOffen;

const summary = { ...contracts, ...result, ok };
console.log(JSON.stringify(summary));
if (!ok) {
  console.error('[mhd-edit-stability-repro] FAIL', summary);
  process.exit(2);
}
console.error('[mhd-edit-stability-repro] ok');
process.exit(0);
