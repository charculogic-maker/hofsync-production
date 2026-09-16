#!/usr/bin/env node
/**
 * UI smoke: Wartende Änderungen modal — Erneut synchronisieren / Warteschlange bereinigen
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const BASE_URL = process.env.SYNC_QUEUE_UI_URL || 'http://127.0.0.1:8765/index.html?v=sync-queue-ui';
const OUT_DIR = process.env.SYNC_QUEUE_UI_OUT || '/opt/cursor/artifacts';
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });

await page.addInitScript(() => {
  const block = () => {
    document.body?.classList?.remove('auth-lock-open', 'auth-loop-lockdown');
    document.getElementById('auth-lock-screen')?.remove();
  };
  const start = () => {
    block();
    new MutationObserver(block).observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
});

await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

const result = await page.evaluate(async () => {
  document.body.classList.remove('auth-lock-open', 'auth-loop-lockdown');
  document.getElementById('auth-lock-screen')?.remove();

  const tenantId = 'StevesHof_Hauptbetrieb';
  const tenantDb = await import('./tenant-db.js');
  const sync = await import('./sync.js');
  tenantDb.setGlobalTenantId(tenantId);
  sync.initSyncEngine({
    getDatabase: () => null,
    isFirebaseReady: () => false,
    getFirebase: () => null,
    getTenantId: () => tenantId,
    showHUD: () => {},
  });
  sync.clearAllPendingSyncQueues();
  sync.addPendingSync({
    _syncType: 'firestore-doc',
    _collectionPath: `tenants/${tenantId}/mhd_liste`,
    _docId: 'ghost-blocked',
    _op: 'update',
    data: { name: 'Geister-Posten', qty: 1 },
    retryCount: 2,
    _lastError: 'No document to update: NOT_FOUND',
    _errorCode: 'not-found',
  });
  sync.saveDeadPendingSyncs([
    {
      _syncType: 'firestore-doc',
      _collectionPath: `tenants/${tenantId}/mhd_liste`,
      _docId: 'dead-1',
      _op: 'update',
      data: { name: 'Tot' },
      retryCount: 3,
      _errorCode: 'permission-denied',
      _lastError: 'PERMISSION_DENIED',
      _deadAt: Date.now(),
    },
  ]);
  sync.updateSyncIndicator();
  document.getElementById('sync-indicator')?.click();

  const overlay = document.getElementById('sync-queue-overlay');
  if (overlay) overlay.style.zIndex = '200000';
  const retryBtn = document.getElementById('sync-queue-retry');
  const clearBtn = document.getElementById('sync-queue-clear');
  return {
    overlayVisible: Boolean(overlay),
    title: overlay?.querySelector('h3')?.textContent || '',
    retryLabel: retryBtn?.textContent?.trim() || '',
    clearLabel: clearBtn?.textContent?.trim() || '',
    pendingText: overlay?.textContent?.includes('ghost-blocked') || false,
    deadText: overlay?.textContent?.includes('dead-1') || false,
    pendingCount: sync.getPendingSyncs().length,
    deadCount: sync.getDeadPendingSyncs().length,
  };
});

if (!result.overlayVisible) throw new Error(`Modal missing: ${JSON.stringify(result)}`);
if (result.retryLabel !== 'Erneut synchronisieren') {
  throw new Error(`Unexpected retry label: ${result.retryLabel}`);
}
if (result.clearLabel !== 'Warteschlange bereinigen') {
  throw new Error(`Unexpected clear label: ${result.clearLabel}`);
}

const shotOpen = path.join(OUT_DIR, 'sync-queue-modal-open.png');
await page.locator('#sync-queue-overlay > div').screenshot({ path: shotOpen });

const clearResult = await page.evaluate(async () => {
  document.getElementById('sync-queue-clear')?.click();
  const sync = await import('./sync.js');
  return {
    overlayGone: !document.getElementById('sync-queue-overlay'),
    pending: sync.getPendingSyncs().length,
    dead: sync.getDeadPendingSyncs().length,
  };
});

if (!clearResult.overlayGone || clearResult.pending !== 0 || clearResult.dead !== 0) {
  throw new Error(`Clear failed: ${JSON.stringify(clearResult)}`);
}

await page.evaluate(() => {
  document.getElementById('auth-lock-screen')?.remove();
  document.body.classList.remove('auth-lock-open', 'auth-loop-lockdown');
  document.getElementById('sync-indicator')?.click();
  const overlay = document.getElementById('sync-queue-overlay');
  if (overlay) overlay.style.zIndex = '200000';
});
await page.waitForSelector('#sync-queue-overlay', { timeout: 5000 });
const shotCleared = path.join(OUT_DIR, 'sync-queue-modal-cleared.png');
await page.locator('#sync-queue-overlay > div').screenshot({ path: shotCleared });

const summary = { ok: true, open: result, clear: clearResult, screenshots: [shotOpen, shotCleared] };
fs.writeFileSync(path.join(OUT_DIR, 'sync-queue-ui-check.log'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));

await browser.close();
