/**
 * Archive zero-stock MHD batches older than 90 days into mhd_archiv.
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const adminDb = require('./adminDb');
const {
  cleanTenantId,
  roleFromToken,
  tenantIdFromToken,
} = require('./authContext');
const { isSuperAdmin } = require('./superAdmin');

const REGION = 'europe-west3';
const CALLABLE_BASE_OPTIONS = {
  region: REGION,
  enforceAppCheck: true,
};

const ARCHIVE_AGE_DAYS = 90;
const MAX_BATCH_OPS = 400; // Firestore limit 500; keep headroom (set + delete = 2 ops/doc)
const ZERO_STATUSES = new Set(['ausverkauft', 'raus', 'rausgenommen', 'sold_out', 'disposed']);

function toMillis(value) {
  if (value == null || value === '') return null;
  if (typeof value?.toMillis === 'function') {
    const ms = value.toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value?.toDate === 'function') {
    const date = value.toDate();
    const ms = date?.getTime?.();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const ms = Date.parse(trimmed.length <= 10 ? `${trimmed}T00:00:00` : trimmed);
      return Number.isNaN(ms) ? null : ms;
    }
    const ms = Date.parse(trimmed);
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof value?.seconds === 'number') {
    return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6);
  }
  return null;
}

function docAgeMillis(data = {}) {
  const candidates = [
    data.updatedAt,
    data.mhdDate,
    data.mhd,
    data.date,
    data.lastMhdCheckAt,
    data.createdAt,
  ];
  for (const candidate of candidates) {
    const ms = toMillis(candidate);
    if (Number.isFinite(ms)) return ms;
  }
  return null;
}

function isZeroStockCandidate(data = {}) {
  const qty = Number(data.quantity ?? data.qty ?? NaN);
  const menge = Number(data.menge ?? NaN);
  if ((Number.isFinite(qty) && qty === 0) || (Number.isFinite(menge) && menge === 0)) {
    return true;
  }
  if (data.soldOut === true) return true;
  const status = String(data.status || '').trim().toLowerCase();
  return ZERO_STATUSES.has(status);
}

function isOlderThanArchiveAge(data, cutoffMs) {
  const ageMs = docAgeMillis(data);
  if (!Number.isFinite(ageMs)) return false;
  return ageMs < cutoffMs;
}

function resolveArchiveTenantId(auth, data = {}) {
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'Anmeldung erforderlich.');
  }
  const role = roleFromToken(auth.token || {});
  const superAdmin = isSuperAdmin(auth);
  if (role !== 'admin' && !superAdmin) {
    throw new HttpsError('permission-denied', 'Nur Admins dürfen 0er-Bestände archivieren.');
  }

  const requested = cleanTenantId(data.tenantId);
  const tokenTenant = tenantIdFromToken(auth.token || {});

  if (superAdmin && requested) return requested;
  if (requested && tokenTenant && requested !== tokenTenant && !superAdmin) {
    throw new HttpsError('permission-denied', 'Kein Zugriff auf diesen Mandanten.');
  }
  const tenantId = requested || tokenTenant;
  if (!tenantId) {
    throw new HttpsError(
      'invalid-argument',
      'Mandant (tenantId) fehlt. Bitte Claims prüfen oder tenantId übergeben.',
    );
  }
  return tenantId;
}

async function loadArchiveCandidates(tenantId) {
  const coll = adminDb.firestore().collection(`tenants/${tenantId}/mhd_liste`);
  const snaps = await Promise.all([
    coll.where('qty', '==', 0).get().catch(() => ({ docs: [] })),
    coll.where('menge', '==', 0).get().catch(() => ({ docs: [] })),
    coll.where('quantity', '==', 0).get().catch(() => ({ docs: [] })),
    coll.where('status', '==', 'ausverkauft').get().catch(() => ({ docs: [] })),
    coll.where('status', '==', 'raus').get().catch(() => ({ docs: [] })),
  ]);

  const byId = new Map();
  snaps.forEach((snap) => {
    (snap.docs || []).forEach((doc) => {
      if (!byId.has(doc.id)) byId.set(doc.id, doc);
    });
  });
  return [...byId.values()];
}

/**
 * Archive expired zero-stock MHD docs for one tenant.
 * @param {string} tenantId
 * @returns {Promise<{ success: true, archivedCount: number, tenantId: string }>}
 */
async function archiveZeroStockBatchesForTenant(tenantId) {
  const cleanId = cleanTenantId(tenantId);
  if (!cleanId) {
    throw new HttpsError('invalid-argument', 'tenantId ist erforderlich.');
  }

  const cutoffMs = Date.now() - ARCHIVE_AGE_DAYS * 24 * 60 * 60 * 1000;
  const candidates = await loadArchiveCandidates(cleanId);
  const toArchive = candidates.filter((doc) => {
    const data = doc.data() || {};
    return isZeroStockCandidate(data) && isOlderThanArchiveAge(data, cutoffMs);
  });

  if (!toArchive.length) {
    return { success: true, archivedCount: 0, tenantId: cleanId };
  }

  const db = adminDb.firestore();
  const archiveColl = db.collection(`tenants/${cleanId}/mhd_archiv`);
  const liveColl = db.collection(`tenants/${cleanId}/mhd_liste`);
  const maxDocsPerBatch = Math.floor(MAX_BATCH_OPS / 2);
  let archivedCount = 0;

  for (let i = 0; i < toArchive.length; i += maxDocsPerBatch) {
    const chunk = toArchive.slice(i, i + maxDocsPerBatch);
    const batch = db.batch();
    chunk.forEach((doc) => {
      const data = doc.data() || {};
      batch.set(archiveColl.doc(doc.id), {
        ...data,
        archivedAt: adminDb.FieldValue.serverTimestamp(),
        archivedFrom: 'mhd_liste',
        sourceDocId: doc.id,
      });
      batch.delete(liveColl.doc(doc.id));
    });
    await batch.commit();
    archivedCount += chunk.length;
  }

  return { success: true, archivedCount, tenantId: cleanId };
}

async function listActiveTenantIds() {
  const db = adminDb.firestore();
  const tenantsRef = db.collection('tenants');
  let snap;
  try {
    snap = await tenantsRef.where('status', '==', 'active').get();
  } catch (_) {
    snap = await tenantsRef.get();
  }
  const ids = snap.docs
    .map((doc) => doc.id)
    .filter((id) => Boolean(cleanTenantId(id)));
  if (ids.length) return ids;

  // Fallback if status filter returned empty but tenants exist without status field.
  const all = await tenantsRef.limit(200).get();
  return all.docs.map((doc) => doc.id).filter(Boolean);
}

async function handleArchiveZeroStockBatches(request) {
  const tenantId = resolveArchiveTenantId(request.auth, request.data || {});
  return archiveZeroStockBatchesForTenant(tenantId);
}

async function handleArchiveZeroStockBatchesScheduled() {
  const tenantIds = await listActiveTenantIds();
  const results = [];
  for (const tenantId of tenantIds) {
    try {
      const result = await archiveZeroStockBatchesForTenant(tenantId);
      results.push(result);
      console.log('[mhdArchive] scheduled ok', result);
    } catch (err) {
      console.error('[mhdArchive] scheduled failed', { tenantId, message: err?.message });
      results.push({
        success: false,
        tenantId,
        archivedCount: 0,
        error: String(err?.message || err),
      });
    }
  }
  const archivedCount = results.reduce((sum, row) => sum + (row.archivedCount || 0), 0);
  return {
    success: true,
    tenantCount: tenantIds.length,
    archivedCount,
    results,
  };
}

exports.ARCHIVE_AGE_DAYS = ARCHIVE_AGE_DAYS;
exports.isZeroStockCandidate = isZeroStockCandidate;
exports.isOlderThanArchiveAge = isOlderThanArchiveAge;
exports.docAgeMillis = docAgeMillis;
exports.archiveZeroStockBatchesForTenant = archiveZeroStockBatchesForTenant;
/** @deprecated alias – prefer archiveZeroStockBatchesForTenant */
exports.archiveZeroStockBatchesCore = archiveZeroStockBatchesForTenant;
exports.handleArchiveZeroStockBatches = handleArchiveZeroStockBatches;
exports.handleArchiveZeroStockBatchesScheduled = handleArchiveZeroStockBatchesScheduled;
exports.resolveArchiveTenantId = resolveArchiveTenantId;

/** Callable export for App Check contract / direct module use. Deployed via index.js. */
exports.archiveZeroStockBatches = onCall(
  {
    ...CALLABLE_BASE_OPTIONS,
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  handleArchiveZeroStockBatches,
);
