const DELIVERY_SOURCE = 'wareneingang-lieferschein';

function cleanDocPart(value, fallback = 'artikel') {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || fallback;
}

function createBatchId(nowIso = new Date().toISOString()) {
  const stamp = String(nowIso || new Date().toISOString()).replace(/[^0-9a-zA-Z]+/g, '').slice(0, 20);
  const random = globalThis.crypto?.randomUUID?.().slice(0, 8)
    || Math.random().toString(36).slice(2, 10);
  return `ls_${stamp}_${random}`;
}

function isPermissionDenied(err) {
  const code = String(err?.code || '').toLowerCase();
  return code.includes('permission-denied') || code === 'permission-denied';
}

function isOfflineLikeError(err) {
  if (!err) return false;
  const code = String(err.code || '').toLowerCase();
  return code.includes('unavailable')
    || code.includes('deadline-exceeded')
    || code.includes('network')
    || err.name === 'NetworkTimeoutError';
}

function canUseOnlineBatch(firebaseApi) {
  return Boolean(
    typeof navigator === 'undefined' || navigator.onLine,
  ) && typeof firebaseApi?.firestore === 'function';
}

function buildMhdPayload(row, {
  tenantId,
  author,
  nowIso,
  docId,
  mhdKategorie,
  tage,
  formattedDate,
}) {
  const mhdIso = row.mhdIso || '';
  return {
    id: docId,
    postenId: docId,
    produkt: row.artikel,
    name: row.artikel,
    marke: '',
    brand: '',
    mhd: mhdIso,
    mhdDate: mhdIso,
    mhdText: Number.isFinite(tage) ? `${tage} Resttage` : 'Wareneingang',
    date: formattedDate,
    tage,
    resttage: tage,
    status: 'aktiv',
    qty: row.menge,
    menge: row.menge,
    eingangMenge: row.menge,
    kategorie: mhdKategorie,
    soldOut: false,
    source: DELIVERY_SOURCE,
    postentyp: 'wareneingang',
    wareneingangAt: nowIso,
    erfassungsDatum: nowIso,
    scannedBy: author,
    tenantId,
    updatedAt: nowIso,
    createdAt: nowIso,
  };
}

function buildInventoryPayload(row, {
  tenantId,
  author,
  nowIso,
  batchId,
  mhdKategorie,
}) {
  return {
    artikel: row.artikel,
    menge: row.menge,
    kategorie: mhdKategorie,
    tenantId,
    source: DELIVERY_SOURCE,
    batchId,
    createdBy: author,
    createdAt: nowIso,
  };
}

export function buildDeliveryParserPersistenceWrites(rows, {
  tenantId,
  author = 'Team',
  nowIso = new Date().toISOString(),
  batchId = createBatchId(nowIso),
  getMhdKategorie,
  getResttage,
  formatMhdDate,
} = {}) {
  const cleanTenantId = String(tenantId || '').trim();
  if (!cleanTenantId) {
    throw new Error('Mandant fehlt: Lieferschein kann nicht verbucht werden.');
  }
  if (!Array.isArray(rows) || rows.length === 0) return [];
  if (typeof getMhdKategorie !== 'function') throw new Error('MHD-Kategorie-Helfer fehlt.');
  if (typeof getResttage !== 'function') throw new Error('Resttage-Helfer fehlt.');
  if (typeof formatMhdDate !== 'function') throw new Error('Datums-Helfer fehlt.');

  return rows.flatMap((row, index) => {
    const docPart = cleanDocPart(row.artikel, `artikel-${index + 1}`);
    const mhdDocId = `${batchId}_${String(index + 1).padStart(2, '0')}_${docPart}`.slice(0, 150);
    const inventoryDocId = `${batchId}_${String(index + 1).padStart(2, '0')}_${docPart}`.slice(0, 150);
    const mhdKategorie = getMhdKategorie(row.kategorie, row.artikel);
    const tage = getResttage(row.mhdIso);
    const formattedDate = row.mhdIso ? formatMhdDate(row.mhdIso) : new Date(nowIso).toLocaleDateString('de-DE');
    const common = {
      tenantId: cleanTenantId,
      author,
      nowIso,
      batchId,
      mhdKategorie,
    };

    return [
      {
        collectionPath: 'mhd_liste',
        docId: mhdDocId,
        op: 'set',
        data: buildMhdPayload(row, {
          ...common,
          docId: mhdDocId,
          tage,
          formattedDate,
        }),
      },
      {
        collectionPath: 'inventory',
        docId: inventoryDocId,
        op: 'set',
        data: buildInventoryPayload(row, common),
      },
    ];
  });
}

async function queueDeliveryParserWrites(writes, writeOrQueueFirestore) {
  if (typeof writeOrQueueFirestore !== 'function') {
    throw new Error('Sync ist nicht bereit: Lieferschein kann nicht vorgemerkt werden.');
  }

  let queued = false;
  for (const write of writes) {
    const result = await writeOrQueueFirestore({
      collectionPath: write.collectionPath,
      docId: write.docId,
      op: write.op,
      onlineData: write.data,
      queueData: write.data,
      offlineMessage: 'Lieferschein wird automatisch verbucht, sobald WLAN verfügbar ist.',
    });
    if (result === 'queued') queued = true;
  }
  return queued ? 'queued' : 'written';
}

export async function persistDeliveryParserRows(rows, {
  firebaseApi,
  writeOrQueueFirestore,
  getDocRef,
  ...buildOptions
} = {}) {
  const writes = buildDeliveryParserPersistenceWrites(rows, buildOptions);
  if (!writes.length) return 'written';

  if (canUseOnlineBatch(firebaseApi) && typeof getDocRef === 'function') {
    try {
      const db = firebaseApi.firestore();
      const batch = db.batch();
      writes.forEach((write) => {
        batch.set(getDocRef(write.collectionPath, write.docId), write.data, { merge: false });
      });
      await batch.commit();
      return 'written';
    } catch (err) {
      if (isPermissionDenied(err) || !isOfflineLikeError(err)) throw err;
    }
  }

  return queueDeliveryParserWrites(writes, writeOrQueueFirestore);
}
