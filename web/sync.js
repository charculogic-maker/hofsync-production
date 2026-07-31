import { getGlobalTenantId, tenantIdsMatch } from './tenant-db.js';
import { logAndMapOperatorError } from './operator-errors.js';

const PENDING_SYNCS_KEY_PREFIX = 'charculogic.pendingSyncs.';
const DEAD_PENDING_SYNCS_KEY_PREFIX = 'charculogic.pendingSyncs.dead.';
const ERROR_TELEMETRY_KEY_PREFIX = 'charculogic.errorTelemetry.';

let flushInFlight = false;

function hasActiveFirebaseAuthUserForSelfHealing() {
  if (typeof window.hasActiveFirebaseAuthUser === 'function') {
    return window.hasActiveFirebaseAuthUser();
  }
  try {
    const firebaseApi = syncContext.getFirebase?.() || (typeof firebase !== 'undefined' ? firebase : null);
    return Boolean(firebaseApi?.apps?.length && firebaseApi.auth?.().currentUser);
  } catch (_) {
    return false;
  }
}

function maybeResetOnFirestorePermissionError(err, context = '') {
  if (typeof window.isFirestorePermissionDeniedError === 'function'
    && window.isFirestorePermissionDeniedError(err)) {
    console.warn('[CharcuLogic Sync] Firestore-Zugriff verweigert — kein Auto-Logout', {
      context,
      code: err?.code,
      message: err?.message,
    });
  }
  return false;
}

let syncContext = {
  getDatabase: () => null,
  isFirebaseReady: () => false,
  getFirebase: () => null,
  getTenantId: () => '',
  appsScriptWebAppUrl: '',
  showHUD: () => {},
};

// QA Simulation State — zero overhead in production (localhost gate in app.js)
export const qaState = {
  active: false,
  latency: false,
  teardown: false,
  log: () => {},
};

export function initSyncEngine({ getDatabase, isFirebaseReady, getFirebase, getTenantId, appsScriptWebAppUrl, showHUD } = {}) {
  syncContext = {
    getDatabase: typeof getDatabase === 'function' ? getDatabase : syncContext.getDatabase,
    isFirebaseReady: typeof isFirebaseReady === 'function' ? isFirebaseReady : syncContext.isFirebaseReady,
    getFirebase: typeof getFirebase === 'function' ? getFirebase : syncContext.getFirebase,
    getTenantId: typeof getTenantId === 'function' ? getTenantId : syncContext.getTenantId,
    appsScriptWebAppUrl: appsScriptWebAppUrl || syncContext.appsScriptWebAppUrl,
    showHUD: typeof showHUD === 'function' ? showHUD : syncContext.showHUD,
  };
}

function currentTenantId() {
  const fromGlobal = getGlobalTenantId();
  if (fromGlobal) return fromGlobal;
  return typeof syncContext.getTenantId === 'function' ? String(syncContext.getTenantId() || '').trim() : '';
}

function pendingSyncsKey() {
  const tenantId = currentTenantId();
  return tenantId ? `${PENDING_SYNCS_KEY_PREFIX}${tenantId}` : '';
}

function deadPendingSyncsKey() {
  const tenantId = currentTenantId();
  return tenantId ? `${DEAD_PENDING_SYNCS_KEY_PREFIX}${tenantId}` : '';
}

function requireTenantId() {
  const tenantId = currentTenantId();
  if (!tenantId) throw new Error('Mandant fehlt: Sync ist ohne Firebase-Auth gesperrt.');
  return tenantId;
}

function normalizeTenantCollectionPath(collectionPath) {
  const tenantId = requireTenantId();
  const path = String(collectionPath || '').replace(/^\/+|\/+$/g, '');
  if (!path) throw new Error('Firestore-Ziel fehlt');

  if (path.startsWith('tenants/')) {
    const [, pathTenantId] = path.split('/');
    if (!tenantIdsMatch(pathTenantId, tenantId)) {
      throw new Error('Mandantenkonflikt: Firestore-Pfad passt nicht zum angemeldeten Betrieb.');
    }
    return path;
  }

  return `tenants/${tenantId}/${path}`;
}

function tenantFirestoreDocRef(db, collectionPath, docId) {
  const normalized = normalizeTenantCollectionPath(collectionPath);
  return db.doc(`${normalized}/${docId}`);
}

function normalizeQueueDate(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  }
  const de = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (de) {
    return `${de[3]}-${de[2].padStart(2, '0')}-${de[1].padStart(2, '0')}`;
  }
  if (raw.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return null;
}

function sanitizeTaskSyncPayload(data = {}) {
  if (!data || typeof data !== 'object') return {};
  const out = { ...data };
  ['targetDate', 'validFrom', 'validUntil', 'dueDate'].forEach((key) => {
    if (!(key in out)) return;
    const normalized = normalizeQueueDate(out[key]);
    if (normalized) out[key] = normalized;
    else delete out[key];
  });
  if (out.createdAt && typeof out.createdAt === 'string' && out.createdAt.length > 24) {
    delete out.createdAt;
  }
  return out;
}

function isTaskCollectionPath(collectionPath) {
  return String(collectionPath || '').includes('/tasks');
}

export function getPendingSyncs() {
  const key = pendingSyncsKey();
  if (!key) return [];
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    try {
      localStorage.setItem(`${key}.corrupt.${Date.now()}`, raw);
      localStorage.removeItem(key);
    } catch (storageErr) {
      console.error('[CharcuLogic Offline] Beschadigte Queue konnte nicht gesichert werden:', storageErr);
    }
    console.error('[CharcuLogic Offline] Sync-Queue beschadigt:', err);
    window.showToast?.("Sync-Queue wurde isoliert.", "warning");
    return [];
  }
}

export function getDeadPendingSyncs() {
  const key = deadPendingSyncsKey();
  if (!key) return [];
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[CharcuLogic Offline] Dead-Letter Queue beschadigt:', err);
    return [];
  }
}

export function saveDeadPendingSyncs(queue) {
  const key = deadPendingSyncsKey();
  if (!key) return false;
  try {
    localStorage.setItem(key, JSON.stringify(queue));
    return true;
  } catch (err) {
    console.warn('[CharcuLogic Offline] Dead-Letter konnte nicht gespeichert werden:', err);
    return false;
  }
}

/** Legt gültige Dead-Letter-Einträge erneut in die Warteschlange (z. B. nach App-Update). */
export function requeueDeadPendingSyncs() {
  const dead = getDeadPendingSyncs();
  if (!dead.length) return 0;

  const stillDead = [];
  let requeued = 0;

  for (const item of dead) {
    const {
      _deadAt, _lastError, _errorCode, _attempts, _id, _queuedAt,
      ...rest
    } = item;
    if (!isValidPendingSync(rest)) {
      stillDead.push(item);
      continue;
    }
    addPendingSync({ ...rest, _attempts: 0 });
    requeued += 1;
  }

  saveDeadPendingSyncs(stillDead);
  return requeued;
}

export function savePendingSyncs(queue) {
  const key = pendingSyncsKey();
  if (!key) {
    window.showToast?.("Sync wartet auf Mandanten-Anmeldung.", "warning");
    return false;
  }
  try {
    localStorage.setItem(key, JSON.stringify(queue));
    return true;
  } catch (err) {
    console.error('[CharcuLogic Offline] localStorage-Schreiben fehlgeschlagen:', err);
    window.showToast?.("Fehler: Offline-Aktion wurde nicht gesichert.", "error");
    return false;
  }
}

export function addPendingSync(entry) {
  const queue = getPendingSyncs();
  queue.push({ ...entry, _queuedAt: Date.now(), _id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}` });
  const saved = savePendingSyncs(queue);
  updateSyncIndicator();
  return saved;
}

function saveDeadPendingSync(item, error) {
  const key = deadPendingSyncsKey();
  if (!key) return;
  const deadEntry = {
    ...item,
    _deadAt: Date.now(),
    _lastError: error?.message || String(error || 'Unbekannter Fehler'),
    _errorCode: error?.code || '',
  };
  try {
    const dead = JSON.parse(localStorage.getItem(key) || '[]');
    dead.push(deadEntry);
    localStorage.setItem(key, JSON.stringify(dead.slice(-100)));
  } catch (err) {
    console.error('[CharcuLogic Offline] Dead-Letter konnte nicht geschrieben werden:', err);
  }
  reportCriticalError({
    errorCode: 'ERR_SYNC_DEAD_LETTER',
    type: 'dead-letter',
    syncType: item._syncType,
    collectionPath: item._collectionPath,
    docId: item._docId,
    op: item._op,
    attempts: item._attempts || 0,
    errorMessage: error?.message || String(error || ''),
    errorCode: error?.code || '',
    queuedAt: item._queuedAt || null,
    deadAt: deadEntry._deadAt,
    payload: item.data || null,
  });
}

function errorTelemetryKey() {
  const tenantId = currentTenantId();
  return tenantId ? `${ERROR_TELEMETRY_KEY_PREFIX}${tenantId}` : '';
}

function getErrorTelemetryQueue() {
  const key = errorTelemetryKey();
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[CharcuLogic Telemetrie] Error-Queue konnte nicht gelesen werden:', err);
    return [];
  }
}

function saveErrorTelemetryQueue(queue) {
  const key = errorTelemetryKey();
  if (!key) return false;
  try {
    if (!queue.length) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(queue.slice(-200)));
    }
    return true;
  } catch (err) {
    console.warn('[CharcuLogic Telemetrie] Error-Queue konnte nicht geschrieben werden:', err);
    return false;
  }
}

export function reportCriticalError(errorContext) {
  let userId = null;
  try {
    const firebase = syncContext.getFirebase();
    userId = firebase?.auth()?.currentUser?.uid || null;
  } catch (_) { /* noop */ }

  const entry = {
    ...errorContext,
    tenantId: currentTenantId() || 'unknown',
    userId,
    reportedAt: new Date().toISOString(),
    userAgent: navigator.userAgent || '',
    url: window.location.href || '',
    _telemetryId: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };

  console.error('[CharcuLogic CriticalError]', entry);

  const queue = getErrorTelemetryQueue();
  queue.push(entry);
  saveErrorTelemetryQueue(queue);
}

function mapTelemetryErrorCode(entry) {
  const code = String(entry?.errorCode || '').trim();
  if (code.startsWith('ERR_')) return code.slice(0, 64);
  if (entry?.type === 'dead-letter') return 'ERR_SYNC_DEAD_LETTER';
  return 'ERR_CLIENT_TELEMETRY';
}

function buildTelemetryMessage(entry) {
  return String(entry?.errorMessage || entry?.type || 'Unbekannter Client-Fehler').slice(0, 999);
}

function buildTelemetryContext(entry) {
  const parts = [];
  if (entry?.syncType) parts.push(`sync:${entry.syncType}`);
  if (entry?.collectionPath) parts.push(entry.collectionPath);
  if (entry?.docId) parts.push(entry.docId);
  if (entry?.op) parts.push(`op:${entry.op}`);
  return parts.join(' · ').slice(0, 500);
}

function buildSystemErrorDocument(entry, firebase) {
  const tenantId = currentTenantId() || entry.tenantId;
  const doc = {
    tenantId: tenantId && tenantId !== 'unknown' ? tenantId : currentTenantId(),
    errorCode: mapTelemetryErrorCode(entry),
    message: buildTelemetryMessage(entry),
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  };
  if (entry?.userId) doc.userId = String(entry.userId).slice(0, 128);
  const context = buildTelemetryContext(entry);
  if (context) doc.context = context;
  return doc;
}

let telemetryFlushInFlight = false;

export async function flushErrorTelemetry() {
  if (telemetryFlushInFlight) return;
  if (!navigator.onLine) return;

  const db = syncContext.getDatabase();
  const firebase = syncContext.getFirebase();
  if (!db || !firebase || !syncContext.isFirebaseReady()) return;

  const queue = getErrorTelemetryQueue();
  if (!queue.length) return;

  telemetryFlushInFlight = true;
  const remaining = [];

  try {
    for (const entry of queue) {
      try {
        const payload = buildSystemErrorDocument(entry, firebase);
        if (!payload.tenantId) {
          remaining.push(entry);
          continue;
        }
        await db.collection('system_errors').add(payload);
      } catch (writeErr) {
        console.warn('[CharcuLogic Telemetrie] system_errors Schreiben fehlgeschlagen:', writeErr);
        remaining.push(entry);
      }
    }
    saveErrorTelemetryQueue(remaining);
  } finally {
    telemetryFlushInFlight = false;
  }
}

function isValidPendingSync(item) {
  if (!item || typeof item !== 'object') return false;
  if (item._syncType === 'haccp') return Boolean(item._collectionPath);
  if (item._syncType === 'appsScript') return true;
  if (item._syncType === 'firestore-doc') {
    return Boolean(item._collectionPath && item._docId && ['create', 'set', 'update', 'delete'].includes(item._op));
  }
  return false;
}

function isPermissionOrExistsError(err) {
  const code = err?.code || '';
  return code === 'permission-denied'
    || code === 'already-exists'
    || code === 'PERMISSION_DENIED'
    || code === 'ALREADY_EXISTS';
}

export function isPermissionDeniedError(err) {
  const code = String(err?.code || '').toLowerCase();
  return code.includes('permission-denied') || code === 'permission-denied';
}

const permissionToastState = { lastAt: 0 };

function notifyPermissionDeniedToast(collectionPath, docId) {
  const now = Date.now();
  if (now - permissionToastState.lastAt < 3500) return;
  permissionToastState.lastAt = now;
  console.error('[CharcuLogic Sync] permission-denied', { collectionPath, docId });
  window.showToast?.(logAndMapOperatorError({ code: 'permission-denied' }, 'sync'), 'error');
}

class ServerGetFailedError extends Error {
  constructor(cause) {
    super('Server-Get fehlgeschlagen — kein inhaltlicher Vergleich möglich');
    this.name = 'ServerGetFailedError';
    this.cause = cause;
  }
}

async function verifyDocContentOnServer(ref, payload) {
  let snap;
  try {
    snap = await ref.get({ source: 'server' });
  } catch (readErr) {
    throw new ServerGetFailedError(readErr);
  }
  if (!snap.exists) return false;
  const remote = snap.data();
  const keysToCheck = Object.keys(payload).filter((k) =>
    !k.startsWith('_') && k !== 'createdAt' && k !== 'updatedAt'
  );
  return keysToCheck.every((k) => {
    const local = payload[k];
    const server = remote[k];
    if (local === server) return true;
    if (local == null && server == null) return true;
    if (typeof local === 'number' && typeof server === 'number') return Math.abs(local - server) < 0.001;
    return String(local) === String(server);
  });
}

function isStaleHaccpPayload(item) {
  const collPath = item._collectionPath || '';
  if (!collPath.includes('haccp_logs')) return false;
  const queuedAt = item._queuedAt || 0;
  return queuedAt > 0 && (Date.now() - queuedAt) > 48 * 60 * 60 * 1000;
}

async function tryStaleArchiveFallback(item) {
  const db = syncContext.getDatabase();
  const firebase = syncContext.getFirebase();
  if (!db || !firebase) return false;

  const tenantId = currentTenantId();
  if (!tenantId) return false;

  const archivePath = `tenants/${tenantId}/haccp_stale_archive`;
  const payload = item.data || {};
  const archiveDoc = {
    ...payload,
    _originalDocId: item._docId || '',
    _originalCollection: item._collectionPath || '',
    _queuedAt: item._queuedAt || null,
    _archivedAt: new Date().toISOString(),
    _reason: 'stale-payload-rejected-by-rules',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  try {
    await db.collection(archivePath).add(archiveDoc);
    console.info(`[CharcuLogic Sync] Stale HACCP-Eintrag in ${archivePath} archiviert.`);
    if (qaState.active) qaState.log(`[QA] Stale-Archiv: ${item._docId}`);
    return true;
  } catch (archiveErr) {
    console.warn('[CharcuLogic Sync] Stale-Archiv-Fallback fehlgeschlagen:', archiveErr);
    return false;
  }
}

export async function flushOnePendingSync(item) {
  const db = syncContext.getDatabase();
  const firebase = syncContext.getFirebase();
  const { _queuedAt, _id, _syncType, _collectionPath, _docId, _op, _merge, _attempts, data, ...legacyData } = item;
  if (_syncType === 'haccp' && _collectionPath) {
    const collectionPath = normalizeTenantCollectionPath(_collectionPath);
    try {
      await db.collection(collectionPath).add({
        ...legacyData,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      if (maybeResetOnFirestorePermissionError(err, 'Sync-Flush')) return;
      throw err;
    }
    return;
  }
  if (_syncType === 'appsScript') {
    await fetch(syncContext.appsScriptWebAppUrl, {
      method: 'POST', mode: 'no-cors', keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(data || legacyData),
    });
    return;
  }
  if (_syncType === 'firestore-doc') {
    const collectionPath = normalizeTenantCollectionPath(_collectionPath);
    const ref = tenantFirestoreDocRef(db, _collectionPath, _docId);
    const payload = isTaskCollectionPath(collectionPath)
      ? sanitizeTaskSyncPayload(data || {})
      : (data || {});
    const writeOp = (_op === 'create' && isTaskCollectionPath(collectionPath)) ? 'set' : _op;
    try {
      if (writeOp === 'delete') {
        await ref.delete();
      } else if (writeOp === 'set') {
        const setPayload = { ...payload };
        if (firebase?.firestore?.FieldValue?.serverTimestamp) {
          setPayload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        }
        await ref.set(setPayload, { merge: Boolean(_merge) });
      } else if (writeOp === 'create') {
        const createPayload = { ...payload };
        if (firebase?.firestore?.FieldValue?.serverTimestamp) {
          createPayload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        }
        await ref.create(createPayload);
      } else {
        await ref.update(payload);
      }
    } catch (err) {
      if (maybeResetOnFirestorePermissionError(err, 'Sync-Flush')) return;
      if (isPermissionOrExistsError(err) && _op !== 'delete') {
        if (isStaleHaccpPayload(item)) {
          const archived = await tryStaleArchiveFallback(item);
          if (archived) return;
        }

        try {
          const match = await verifyDocContentOnServer(ref, payload);
          if (match) {
            console.info(`[CharcuLogic Sync] Idempotent-Retry: ${_docId} bereits identisch auf Server, Queue-Eintrag aufgelöst.`);
            if (qaState.active) qaState.log(`[QA] Idempotent-OK: ${_docId}`);
            return;
          }
        } catch (verifyErr) {
          if (verifyErr instanceof ServerGetFailedError) {
            console.warn(`[CharcuLogic Sync] Server-Get für ${_docId} fehlgeschlagen — Eintrag bleibt sicher in Queue.`);
            if (qaState.active) qaState.log(`[QA] Server-Get fehlgeschlagen: ${_docId} bleibt in Queue`);
            throw verifyErr;
          }
          throw err;
        }
      }
      throw err;
    }
  }
}

// Lie-Fi Schutz: Hartes Timeout für alle Firestore-Schreiboperationen.
// Verhindert, dass das SDK bei Schein-Online (navigator.onLine === true,
// aber kein echtes Netz) unendlich blockiert und die UI einfriert.
const WRITE_TIMEOUT_MS = 3500;

class NetworkTimeoutError extends Error {
  constructor(ms) {
    super(`Firestore-Schreibvorgang hat nach ${ms}ms nicht geantwortet (Lie-Fi vermutet).`);
    this.name = 'NetworkTimeoutError';
    this.code = 'network-timeout';
  }
}

function withTimeout(promise, ms = WRITE_TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new NetworkTimeoutError(ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function isCloudReachable() {
  return Boolean(
    typeof navigator !== 'undefined' && navigator.onLine
    && syncContext.isFirebaseReady()
    && syncContext.getDatabase(),
  );
}

/** Badge + Sync-Punkt an aktuellen Netz-/Firebase- und Queue-Stand anpassen. */
export function refreshSyncConnectivityUi() {
  if (typeof window.updateOnlineStatusUi === 'function') {
    window.updateOnlineStatusUi(isCloudReachable());
  } else {
    updateSyncIndicator();
  }
}

export async function safeServerWrite(collectionPath, payload) {
  const db = syncContext.getDatabase();
  if (!navigator.onLine || !syncContext.isFirebaseReady() || !db) {
    refreshSyncConnectivityUi();
    throw new NetworkTimeoutError(0);
  }
  const normalized = normalizeTenantCollectionPath(collectionPath);
  try {
    const result = await withTimeout(db.collection(normalized).add(payload));
    refreshSyncConnectivityUi();
    return result;
  } catch (err) {
    if (maybeResetOnFirestorePermissionError(err, 'Sync-Write')) return;
    if (err?.name === 'NetworkTimeoutError') {
      refreshSyncConnectivityUi();
    }
    throw err;
  }
}

export async function writeFirestoreDocOrQueue({
  collectionPath,
  docId,
  op = 'update',
  onlineData = {},
  queueData = onlineData,
  merge = false,
  offlineMessage = "Wird automatisch synchronisiert, sobald WLAN verfügbar ist.",
  silentPermissionDenied = false,
}) {
  const db = syncContext.getDatabase();
  if (!collectionPath || !docId) throw new Error('Firestore-Ziel fehlt');
  const normalizedCollectionPath = normalizeTenantCollectionPath(collectionPath);
  const syncData = isTaskCollectionPath(normalizedCollectionPath)
    ? sanitizeTaskSyncPayload(queueData)
    : queueData;
  const syncOp = (op === 'create' && isTaskCollectionPath(normalizedCollectionPath)) ? 'set' : op;

  if (!navigator.onLine || !syncContext.isFirebaseReady() || !db) {
    const saved = addPendingSync({
      _syncType: 'firestore-doc',
      _collectionPath: normalizedCollectionPath,
      _docId: docId,
      _op: syncOp,
      _merge: Boolean(merge),
      data: syncData,
    });
    if (!saved) throw new Error('Offline-Queue konnte nicht geschrieben werden');
    window.showToast?.(offlineMessage, 'warning');
    refreshSyncConnectivityUi();
    return 'queued';
  }

  try {
    if (qaState.active && qaState.latency) {
      qaState.log(`[QA] Latenz 5000ms auf ${op} ${docId}`);
      await new Promise((r) => setTimeout(r, 5000));
    }

    const ref = tenantFirestoreDocRef(db, collectionPath, docId);
    const firebase = syncContext.getFirebase();
    const onlinePayload = isTaskCollectionPath(normalizedCollectionPath)
      ? sanitizeTaskSyncPayload(onlineData)
      : onlineData;
    const writeOp = syncOp;
    let writePromise;
    if (writeOp === 'delete') {
      writePromise = ref.delete();
    } else if (writeOp === 'set') {
      const setPayload = { ...onlinePayload };
      if (firebase?.firestore?.FieldValue?.serverTimestamp) {
        setPayload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      }
      writePromise = ref.set(setPayload, { merge: Boolean(merge) });
    } else if (writeOp === 'create') {
      const createPayload = { ...onlinePayload };
      if (firebase?.firestore?.FieldValue?.serverTimestamp) {
        createPayload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      }
      writePromise = ref.create(createPayload);
    } else {
      writePromise = ref.update(onlinePayload);
    }
    await withTimeout(writePromise);

    if (qaState.active && qaState.teardown) {
      qaState.log(`[QA] Abreißer: Schreiben für ${docId} lokal als gescheitert simuliert`);
      throw new Error('[QA-Teardown] Simulierter Netzwerk-Abreißer nach Firebase-Trigger');
    }

    refreshSyncConnectivityUi();
    return 'written';
  } catch (err) {
    if (maybeResetOnFirestorePermissionError(err, 'Sync-Write')) return 'written';
    const errorCode = String(err?.code || '').toLowerCase();
    if (errorCode.includes('permission-denied') || errorCode === 'permission-denied') {
      if (!silentPermissionDenied) {
        notifyPermissionDeniedToast(normalizedCollectionPath, docId);
      }
      throw err;
    }
    const saved = addPendingSync({
      _syncType: 'firestore-doc',
      _collectionPath: normalizedCollectionPath,
      _docId: docId,
      _op: syncOp,
      _merge: Boolean(merge),
      data: syncData,
    });
    if (!saved) throw err;
    window.showToast?.(offlineMessage, 'warning');
    refreshSyncConnectivityUi();
    return 'queued';
  }
}

export async function flushPendingSyncs() {
  if (flushInFlight) return;
  flushInFlight = true;
  const queue = getPendingSyncs();
  try {
    if (!queue.length) {
      refreshSyncConnectivityUi();
      return;
    }
    if (!syncContext.isFirebaseReady() || !syncContext.getDatabase()) {
      refreshSyncConnectivityUi();
      return;
    }
    requireTenantId();

    const failed = [];
    for (const item of queue) {
      if (!isValidPendingSync(item)) {
        saveDeadPendingSync(item, new Error('Ungultiger Queue-Eintrag'));
        continue;
      }
      try {
        await flushOnePendingSync(item);
      } catch (err) {
        if (maybeResetOnFirestorePermissionError(err, 'Sync-Flush')) return;
        console.warn('[CharcuLogic Offline] Sync fehlgeschlagen, bleibt in Queue:', err);
        const attempts = (item._attempts || 0) + 1;
        if (attempts >= 5) {
          saveDeadPendingSync({ ...item, _attempts: attempts }, err);
        } else {
          failed.push({
            ...item,
            _attempts: attempts,
            _lastError: err?.message || String(err),
            _errorCode: err?.code || '',
          });
        }
      }
    }
    savePendingSyncs(failed);
    refreshSyncConnectivityUi();
    if (failed.length === 0 && queue.length > 0) {
      window.showToast?.("Alle Offline-Daten synchronisiert!", "success");
    }
  } finally {
    flushInFlight = false;
  }
}

export function updateSyncIndicator() {
  const dot = document.getElementById('sync-status-dot');
  const count = document.getElementById('sync-pending-count');
  if (!dot) return;
  const pending = getPendingSyncs();
  const isOnline = navigator.onLine;

  if (pending.length > 0) {
    dot.className = 'sync-dot sync-dot--pending';
    dot.title = `${pending.length} Eintrage warten auf Sync`;
    if (count) { count.textContent = pending.length; count.style.display = 'inline'; }
  } else if (!isOnline) {
    dot.className = 'sync-dot sync-dot--offline';
    dot.title = 'Offline';
    if (count) count.style.display = 'none';
  } else {
    dot.className = 'sync-dot sync-dot--ok';
    dot.title = 'Online & synchronisiert';
    if (count) count.style.display = 'none';
  }
}
