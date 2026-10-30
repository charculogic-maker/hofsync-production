/**
 * Runtime-Verification der Loading-vs-Empty Entscheidungslogik (ohne DOM/Firebase).
 */
import assert from 'node:assert/strict';

function isMhdSnapshotWaitingForServer(snapshot) {
  return Boolean(snapshot?.metadata?.fromCache) && Boolean(snapshot?.empty);
}

function shouldKeepMhdCloudLoading(snapshots = [], expectedCount = 2) {
  const readySnaps = (snapshots || []).filter(Boolean);
  if (readySnaps.length < expectedCount) return true;
  return readySnaps.every((snap) => isMhdSnapshotWaitingForServer(snap));
}

function shouldShowMhdCloudLoadingState({ products = [], status = 'idle', pending = false } = {}) {
  if (products.length > 0) return false;
  if (status === 'ready' || status === 'error') return false;
  return status === 'loading' || status === 'idle' || pending === true;
}

function snapshotsIncludeServerData(snapshots = []) {
  return (snapshots || []).filter(Boolean).some((snap) => {
    const meta = snap?.metadata;
    return Boolean(meta) && meta.fromCache === false;
  });
}

function shouldShowSlaLoadingBanner({ awaitingServer = true, status = 'loading' } = {}) {
  if (status === 'error') return false;
  return awaitingServer === true;
}

function shouldShowEmpty({ products = [], status = 'idle', visible = 0 } = {}) {
  if (shouldShowMhdCloudLoadingState({ products, status })) return false;
  if (!(status === 'ready' || status === 'error')) return false;
  return products.length === 0 || visible === 0;
}

const emptyFromCache = { empty: true, metadata: { fromCache: true } };
const emptyFromServer = { empty: true, metadata: { fromCache: false } };
const cachedDocs = { empty: false, metadata: { fromCache: true }, docs: [{ id: 'a' }] };

// 1) Initial idle ohne Artikel → Loading, kein Empty
assert.equal(shouldShowMhdCloudLoadingState({ status: 'idle' }), true);
assert.equal(shouldShowEmpty({ status: 'idle' }), false);

// 2) Loading ohne Artikel → Loading
assert.equal(shouldShowMhdCloudLoadingState({ status: 'loading' }), true);
assert.equal(shouldShowEmpty({ status: 'loading' }), false);

// 3) Ready + 0 Artikel → Empty erlaubt
assert.equal(shouldShowMhdCloudLoadingState({ status: 'ready' }), false);
assert.equal(shouldShowEmpty({ status: 'ready', products: [], visible: 0 }), true);

// 4) Cache-Artikel während Loading → Liste, kein Spinner
assert.equal(shouldShowMhdCloudLoadingState({ status: 'loading', products: [{ id: 1 }] }), false);

// 5) Dual-Query: nur ein Snapshot → weiter laden
assert.equal(shouldKeepMhdCloudLoading([emptyFromServer, null], 2), true);
assert.equal(shouldKeepMhdCloudLoading([emptyFromCache, null], 2), true);

// 6) Beide fromCache leer → weiter laden (kein Empty-Flash)
assert.equal(shouldKeepMhdCloudLoading([emptyFromCache, emptyFromCache], 2), true);

// 7) Beide Server leer → fertig (echt leer)
assert.equal(shouldKeepMhdCloudLoading([emptyFromServer, emptyFromServer], 2), false);

// 8) Cache mit Docs → Hydration sofort
assert.equal(shouldKeepMhdCloudLoading([cachedDocs, emptyFromCache], 2), false);

// 9) Cache-Docs ≠ Server – Banner bleibt im Ladezustand
assert.equal(snapshotsIncludeServerData([cachedDocs, cachedDocs]), false);
assert.equal(snapshotsIncludeServerData([cachedDocs, emptyFromServer]), true);
assert.equal(shouldShowSlaLoadingBanner({ awaitingServer: true, status: 'ready' }), true);
assert.equal(shouldShowSlaLoadingBanner({ awaitingServer: false, status: 'ready' }), false);
assert.equal(shouldShowSlaLoadingBanner({ awaitingServer: true, status: 'error' }), false);

console.log('OK verify-mhd-loading-logic: Loading vs Empty Entscheidung korrekt.');
