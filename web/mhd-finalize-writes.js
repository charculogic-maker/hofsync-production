/**
 * Atomic Wareneingang finalization writes.
 *
 * Online: delivery header and MHD rows are committed in one Firestore batch.
 * Offline/retryable: MHD rows are queued before the completed delivery header so
 * the app never advertises a completed delivery ahead of its inventory rows.
 */

const DEFAULT_FINALIZE_WRITE_TIMEOUT_MS = 3500;

class FinalizeWriteTimeoutError extends Error {
  constructor(timeoutMs) {
    super(`Firestore batch write timed out after ${timeoutMs}ms`);
    this.name = 'FinalizeWriteTimeoutError';
    this.code = 'deadline-exceeded';
  }
}

function withTimeout(promise, timeoutMs = DEFAULT_FINALIZE_WRITE_TIMEOUT_MS) {
  let timer = null;
  return Promise.race([
    promise.finally(() => {
      if (timer) clearTimeout(timer);
    }),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new FinalizeWriteTimeoutError(timeoutMs)), timeoutMs);
    }),
  ]);
}

function asReadyValue(isFirebaseReady) {
  return typeof isFirebaseReady === 'function' ? Boolean(isFirebaseReady()) : Boolean(isFirebaseReady);
}

export function canUseOnlineFinalizeBatch({ db, isFirebaseReady, navigatorRef = globalThis.navigator } = {}) {
  return Boolean(
    navigatorRef?.onLine
    && asReadyValue(isFirebaseReady)
    && db
    && typeof db.batch === 'function'
    && typeof db.doc === 'function',
  );
}

function docRef(db, collectionPath, docId) {
  const cleanCollectionPath = String(collectionPath || '').replace(/^\/+|\/+$/g, '');
  const cleanDocId = String(docId || '').trim();
  if (!cleanCollectionPath || !cleanDocId) {
    throw new Error('Firestore-Ziel fehlt');
  }
  return db.doc(`${cleanCollectionPath}/${cleanDocId}`);
}

function isPermissionDeniedError(err) {
  const code = String(err?.code || '').toLowerCase();
  return code === 'permission-denied' || code.includes('permission-denied');
}

function isRetryableFinalizeError(err) {
  if (!err) return false;
  if (isPermissionDeniedError(err)) return false;
  const code = String(err.code || '').toLowerCase();
  if ([
    'aborted',
    'cancelled',
    'deadline-exceeded',
    'internal',
    'resource-exhausted',
    'unavailable',
    'unknown',
  ].includes(code)) {
    return true;
  }
  const name = String(err.name || '').toLowerCase();
  if (name.includes('timeout')) return true;
  const message = String(err.message || '').toLowerCase();
  return /offline|network|timeout|timed out|unavailable|deadline/.test(message);
}

export async function commitFinalizeDeliveryBatch({
  db,
  deliveryWrite,
  mhdWrites = [],
  timeoutMs = DEFAULT_FINALIZE_WRITE_TIMEOUT_MS,
}) {
  if (!db || typeof db.batch !== 'function' || typeof db.doc !== 'function') {
    throw new Error('Firestore-Batch ist nicht verfügbar');
  }
  if (!deliveryWrite) throw new Error('Lieferungsdaten fehlen');

  const batch = db.batch();
  mhdWrites.forEach((write) => {
    batch.set(
      docRef(db, write.collectionPath, write.docId),
      write.onlineData || {},
      { merge: true },
    );
  });
  batch.set(
    docRef(db, deliveryWrite.collectionPath, deliveryWrite.docId),
    deliveryWrite.onlineData || {},
    { merge: false },
  );

  await withTimeout(batch.commit(), timeoutMs);
  return 'written';
}

export async function queueFinalizeDeliveryWrites({ writeOrQueueFirestore, deliveryWrite, mhdWrites = [] }) {
  if (typeof writeOrQueueFirestore !== 'function') {
    throw new Error('Sync-Engine ist nicht initialisiert.');
  }
  if (!deliveryWrite) throw new Error('Lieferungsdaten fehlen');

  for (const write of mhdWrites) {
    await writeOrQueueFirestore({
      collectionPath: write.collectionPath,
      docId: write.docId,
      op: write.op || 'set',
      onlineData: write.onlineData || {},
      queueData: write.queueData || write.onlineData || {},
      offlineMessage: write.offlineMessage || 'MHD-Posten wird nachträglich synchronisiert.',
    });
  }

  await writeOrQueueFirestore({
    collectionPath: deliveryWrite.collectionPath,
    docId: deliveryWrite.docId,
    op: deliveryWrite.op || 'set',
    onlineData: deliveryWrite.onlineData || {},
    queueData: deliveryWrite.queueData || deliveryWrite.onlineData || {},
    offlineMessage: deliveryWrite.offlineMessage || 'Lieferung wird nachträglich synchronisiert.',
  });

  return 'queued';
}

export async function writeFinalizeDeliveryBundle({
  db,
  isFirebaseReady,
  navigatorRef = globalThis.navigator,
  writeOrQueueFirestore,
  deliveryWrite,
  mhdWrites = [],
  timeoutMs = DEFAULT_FINALIZE_WRITE_TIMEOUT_MS,
}) {
  if (canUseOnlineFinalizeBatch({ db, isFirebaseReady, navigatorRef })) {
    try {
      return await commitFinalizeDeliveryBatch({ db, deliveryWrite, mhdWrites, timeoutMs });
    } catch (err) {
      if (!isRetryableFinalizeError(err)) throw err;
      console.warn('[CharcuLogic Wareneingang] Batch-Speicherung wird offline vorgemerkt:', err);
    }
  }

  return queueFinalizeDeliveryWrites({ writeOrQueueFirestore, deliveryWrite, mhdWrites });
}
