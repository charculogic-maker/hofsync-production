/**
 * Callable isoliert – Gemini wird erst im Handler via deliveryNote.js geladen.
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const REGION = 'europe-west3';

function claimText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isAdminClaim(token) {
  const role = claimText(token?.role);
  return role === 'admin' || token?.isAdmin === true || token?.admin === true;
}

function tenantIdFromClaim(token) {
  return claimText(token?.tenantId || token?.tenant_id || token?.tenantID);
}

/**
 * Sitzung muss stehen. Admins mit tenantId bleiben erlaubt;
 * fehlende Rolle blockiert sie nicht, wenn das Admin-Claim gesetzt ist.
 */
function assertDeliveryNoteCaller(request) {
  if (!request?.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Keine aktive HofSync-Sitzung gefunden.');
  }
  const token = request.auth.token || {};
  const tenantId = tenantIdFromClaim(token);
  const admin = isAdminClaim(token);
  if (!tenantId) {
    throw new HttpsError(
      'permission-denied',
      admin
        ? 'Admin-Sitzung ohne Mandanten-Claim. Bitte tenantId setzen und erneut anmelden.'
        : 'Custom Claim tenantId fehlt.',
    );
  }
  const role = claimText(token.role);
  if (!admin && role !== 'employee') {
    throw new HttpsError('permission-denied', 'Mitarbeiter- oder Admin-Rolle erforderlich.');
  }
  return { uid: request.auth.uid, tenantId, isAdmin: admin, role: admin ? 'admin' : role };
}

exports.assertDeliveryNoteCaller = assertDeliveryNoteCaller;

function handleProcessDeliveryNoteDraft(event) {
  // parseDeliveryNoteImage setzt maxOutputTokens auf 8192 und liest alle PDF-Seiten.
  return require('./deliveryNote').handleProcessDeliveryNoteDraft(event);
}

exports.handleProcessDeliveryNoteDraft = handleProcessDeliveryNoteDraft;

const MAX_SAVE_ITEMS = 200;

function safeDocId(value) {
  const id = String(value || '').trim();
  if (!id || id.length > 180 || /[/\\]/.test(id) || id.includes('..') || id.startsWith('.')) {
    throw new HttpsError('invalid-argument', 'Ungültige Dokument-ID.');
  }
  return id;
}

function clipText(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function positiveNumber(value) {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : NaN;
}

/**
 * Baut die Admin-SDK-Schreibvorgänge für MHD und Stammdaten.
 * Der Mandant kommt nur aus der Sitzung, nie aus dem Payload.
 */
function planReconciledWrites(items, tenantId) {
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_SAVE_ITEMS) {
    throw new HttpsError('invalid-argument', 'Keine gültige Positionsliste.');
  }
  const writes = [];
  for (const item of items) {
    if (!item || typeof item !== 'object' || item.excluded === true) continue;
    if (item.mhdUpdate && item.mhdId) {
      const quantity = positiveNumber(item.mhdUpdate.menge ?? item.mhdUpdate.qty);
      if (!Number.isFinite(quantity)) {
        throw new HttpsError('invalid-argument', 'Korrektur ohne Menge.');
      }
      writes.push({
        collection: 'mhd_liste',
        id: safeDocId(item.mhdId),
        merge: true,
        data: {
          menge: quantity,
          qty: quantity,
          eingangMenge: quantity,
        },
      });
      continue;
    }
    if (item.renameMaster && item.masterData && typeof item.masterData === 'object') {
      const masterName = clipText(item.masterData.name || item.masterData.artikel, 200);
      if (!masterName) {
        throw new HttpsError('invalid-argument', 'Stammdaten ohne Namen.');
      }
      const masterId = safeDocId(item.masterData.id);
      writes.push({
        collection: 'stammdaten',
        id: masterId,
        merge: true,
        data: {
          id: masterId,
          name: masterName,
          artikel: masterName,
          ean: clipText(item.masterData.ean || item.masterData.barcode, 32).replace(/\D/g, '').slice(0, 14),
          tenantId,
          source: 'stammdaten-rename',
        },
      });
      continue;
    }
    const source = item.mhdData && typeof item.mhdData === 'object' ? item.mhdData : null;
    if (!source) continue;
    const name = clipText(source.name || source.produkt, 200);
    const quantity = positiveNumber(source.menge ?? source.qty);
    if (!name || !Number.isFinite(quantity)) {
      throw new HttpsError('invalid-argument', 'Position ohne Namen oder Menge.');
    }
    const unit = clipText(source.einheit || source.mengeEinheit || 'Stk', 16) || 'Stk';
    const ean = clipText(source.ean || source.barcode, 32).replace(/\D/g, '').slice(0, 14);
    const mhdId = safeDocId(source.id);
    writes.push({
      collection: 'mhd_liste',
      id: mhdId,
      merge: false,
      data: {
        id: mhdId,
        postenId: mhdId,
        ean,
        barcode: ean,
        produkt: name,
        name,
        menge: quantity,
        qty: quantity,
        eingangMenge: quantity,
        mengeEinheit: unit,
        einheit: unit,
        status: 'aktiv',
        soldOut: false,
        source: 'delivery-reconciliation',
        postentyp: 'wareneingang',
        lieferant: clipText(source.lieferant, 120),
        tenantId,
        scannedBy: clipText(source.scannedBy, 80),
        kategorie: 'Wareneingang',
        wareneingangAt: clipText(source.wareneingangAt, 40),
        erfassungsDatum: clipText(source.erfassungsDatum, 40),
      },
    });
    if (item.createMasterData && item.masterData && typeof item.masterData === 'object') {
      const master = item.masterData;
      const masterName = clipText(master.name || master.artikel || name, 200);
      const masterId = safeDocId(master.id || mhdId);
      const masterEan = clipText(master.ean || master.barcode || ean, 32).replace(/\D/g, '').slice(0, 14);
      writes.push({
        collection: 'stammdaten',
        id: masterId,
        merge: true,
        data: {
          id: masterId,
          artikel: masterName,
          name: masterName,
          ean: masterEan,
          barcode: masterEan,
          einheit: clipText(master.einheit || unit, 16) || unit,
          unitPrice: positiveNumber(master.unitPrice) || '',
          lieferant: clipText(master.lieferant || source.lieferant, 120),
          tenantId,
          source: 'delivery-reconciliation',
        },
      });
    }
  }
  if (!writes.length) {
    throw new HttpsError('invalid-argument', 'Keine buchbaren Positionen.');
  }
  return writes;
}

async function handleSaveReconciledItems(request) {
  const caller = assertDeliveryNoteCaller(request);
  const { ensureAdminApp, getAdminDb, ensureFirestoreStatics } = require('./firebaseAdmin');
  ensureAdminApp();
  const FieldValue = ensureFirestoreStatics().FieldValue;
  const db = getAdminDb();
  const writes = planReconciledWrites(request.data?.items, caller.tenantId);
  const batch = db.batch();
  const now = FieldValue.serverTimestamp();
  writes.forEach((write) => {
    const ref = db.collection(`tenants/${caller.tenantId}/${write.collection}`).doc(write.id);
    const data = write.merge
      ? { ...write.data, updatedAt: now }
      : { ...write.data, createdAt: now, updatedAt: now };
    batch.set(ref, data, { merge: write.merge });
  });
  await batch.commit();
  const booked = writes.filter((write) => write.collection === 'mhd_liste').length;
  return { success: true, count: booked };
}

exports.planReconciledWrites = planReconciledWrites;
exports.handleSaveReconciledItems = handleSaveReconciledItems;

exports.saveReconciledItems = onCall(
  {
    region: REGION,
    enforceAppCheck: false,
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (request) => handleSaveReconciledItems(request),
);

exports.reprocessDeliveryNoteDraft = onCall(
  {
    region: REGION,
    enforceAppCheck: false,
    secrets: ['GEMINI_API_KEY'],
    timeoutSeconds: 120,
    memory: '1GiB',
  },
  async (request) => {
    const caller = assertDeliveryNoteCaller(request);
    const { ensureAdminApp } = require('./firebaseAdmin');
    ensureAdminApp();
    return require('./deliveryNote').handleReprocessDeliveryNoteDraft({
      tenantId: caller.tenantId,
      draftId: request?.data?.draftId,
    });
  },
);

exports.parseDeliveryNote = onCall(
  {
    region: REGION,
    enforceAppCheck: false,
    secrets: ['GEMINI_API_KEY'],
    timeoutSeconds: 120,
    memory: '1GiB',
  },
  async (request) => {
    assertDeliveryNoteCaller(request);
    const { ensureAdminApp } = require('./firebaseAdmin');
    ensureAdminApp();
    return require('./deliveryNote').handleParseDeliveryNote(request);
  },
);
