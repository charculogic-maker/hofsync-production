/**
 * Persist a completed Wareneingang without ever publishing the completed
 * delivery header ahead of its MHD rows.
 */

function defaultIsOnline() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

function cleanOp(op) {
  return op === 'update' || op === 'delete' || op === 'create' ? op : 'set';
}

function writeDocPath(write) {
  const collectionPath = String(write?.collectionPath || '').replace(/^\/+|\/+$/g, '');
  const docId = String(write?.docId || '').trim();
  if (!collectionPath || !docId) throw new Error('Firestore-Ziel fehlt');
  return `${collectionPath}/${docId}`;
}

function applyBatchWrite(batch, db, write) {
  const ref = db.doc(writeDocPath(write));
  const op = cleanOp(write?.op);
  if (op === 'delete') {
    batch.delete(ref);
    return;
  }
  if (op === 'update') {
    batch.update(ref, write.onlineData || {});
    return;
  }
  if (op === 'create' && typeof batch.create === 'function') {
    batch.create(ref, write.onlineData || {});
    return;
  }
  batch.set(ref, write.onlineData || {}, { merge: false });
}

export function canUseFinalizeBatch({ db, firebaseReady = true, online = defaultIsOnline() } = {}) {
  return Boolean(online && firebaseReady && db && typeof db.batch === 'function' && typeof db.doc === 'function');
}

export function isRetryableFinalizeBatchError(error) {
  const code = String(error?.code || '').toLowerCase();
  if (['aborted', 'deadline-exceeded', 'internal', 'resource-exhausted', 'unavailable'].includes(code)) {
    return true;
  }
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('network')
    || message.includes('offline')
    || message.includes('timeout')
    || message.includes('failed to fetch');
}

export function queueFinalizeWritesInSafeOrder({ addPendingSync, deliveryWrite, mhdWrites = [] } = {}) {
  if (typeof addPendingSync !== 'function') {
    throw new Error('Offline-Queue ist nicht initialisiert.');
  }

  const queuedMhdResults = mhdWrites.map((write) => {
    const saved = addPendingSync({
      _syncType: 'firestore-doc',
      _collectionPath: write.collectionPath,
      _docId: write.docId,
      _op: cleanOp(write.op),
      data: write.queueData || write.onlineData || {},
    });
    if (!saved) throw new Error('Offline-Queue konnte nicht geschrieben werden');
    return 'queued';
  });

  const savedDelivery = addPendingSync({
    _syncType: 'firestore-doc',
    _collectionPath: deliveryWrite.collectionPath,
    _docId: deliveryWrite.docId,
    _op: cleanOp(deliveryWrite.op),
    data: deliveryWrite.queueData || deliveryWrite.onlineData || {},
  });
  if (!savedDelivery) throw new Error('Offline-Queue konnte nicht geschrieben werden');

  return {
    deliveryResult: 'queued',
    mhdResults: queuedMhdResults,
  };
}

export async function commitDeliveryFinalizeWrites({
  db,
  firebaseReady = true,
  online = defaultIsOnline(),
  addPendingSync,
  deliveryWrite,
  mhdWrites = [],
} = {}) {
  if (!deliveryWrite) throw new Error('Lieferungs-Kopf fehlt');
  const normalizedMhdWrites = Array.isArray(mhdWrites) ? mhdWrites : [];

  if (!canUseFinalizeBatch({ db, firebaseReady, online })) {
    return queueFinalizeWritesInSafeOrder({ addPendingSync, deliveryWrite, mhdWrites: normalizedMhdWrites });
  }

  const batch = db.batch();
  applyBatchWrite(batch, db, deliveryWrite);
  normalizedMhdWrites.forEach((write) => applyBatchWrite(batch, db, write));

  try {
    await batch.commit();
    return {
      deliveryResult: 'written',
      mhdResults: normalizedMhdWrites.map(() => 'written'),
    };
  } catch (error) {
    if (!isRetryableFinalizeBatchError(error)) throw error;
    return queueFinalizeWritesInSafeOrder({ addPendingSync, deliveryWrite, mhdWrites: normalizedMhdWrites });
  }
}
