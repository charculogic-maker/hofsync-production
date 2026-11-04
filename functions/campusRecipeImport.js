/**
 * Import Campus WRS recipes (`campus.recipe.export@1.0.0`) into
 * `tenants/{tenantId}/rezepte/{safeId}`.
 *
 * Admin-only (tenant admin or platform super-admin). App Check off for Vercel hosts
 * (same policy as manageTenantEmployees).
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('./firebaseAdmin');
const { FieldValue } = require('firebase-admin/firestore');
const { assertAdminAccessForTenant } = require('./manageTenantEmployees');

const REGION = 'europe-west3';
const CAMPUS_SCHEMA = 'campus.recipe.export';
const CAMPUS_VERSION = '1.0.0';
const SOURCE = `${CAMPUS_SCHEMA}@${CAMPUS_VERSION}`;

const CALLABLE_BASE_OPTIONS = {
  region: REGION,
  invoker: 'public',
  cors: true,
  enforceAppCheck: false,
};

function safeFirestoreId(id) {
  return String(id || '')
    .replace(/\//g, '-')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 120);
}

function isCampusExport(value) {
  return Boolean(
    value
      && typeof value === 'object'
      && value.schema === CAMPUS_SCHEMA
      && value.schemaVersion === CAMPUS_VERSION
      && value.recipe
      && typeof value.recipe === 'object',
  );
}

function hofSyncKat(family) {
  if (family === 'rohwurst') return 'Rohwurst';
  if (family === 'brueh') return 'Brühwurst';
  return 'Kochwurst';
}

function hofSyncTypFromMaterialId(materialId) {
  const id = String(materialId || '');
  if (id === 'EIS') return 'liquid';
  if (/^S_(V|VI|VII|VIII|IX|X)$/.test(id)) return 'fat';
  return 'base';
}

function mapCampusToHofSyncDoc(doc) {
  const firestoreId = safeFirestoreId(doc.recipe.id);
  if (!firestoreId) {
    throw new HttpsError('invalid-argument', 'Rezept-ID fehlt im Campus-Export.');
  }
  const name = String(doc.recipe.name || '').trim();
  if (!name) {
    throw new HttpsError('invalid-argument', 'Rezeptname fehlt im Campus-Export.');
  }
  const lines = Array.isArray(doc.recipe.lines) ? doc.recipe.lines : [];
  if (lines.length === 0) {
    throw new HttpsError('invalid-argument', 'Campus-Export ohne Zutatenzeilen.');
  }
  const disclaimer = String(doc.disclaimer || 'Import aus CharcuLogic Campus WRS.');
  const beffe = Number(doc.computed?.finished?.beffePct);
  const aw = Number(doc.computed?.aw?.aw);
  const process = doc.process || {};

  return {
    id: firestoreId,
    firestoreId,
    name,
    kat: hofSyncKat(process.productFamily),
    kaliber: '',
    basis_g: Math.round(Number(doc.recipe.basisKg || 0) * 1000),
    allergene: [],
    tipp: Number.isFinite(beffe)
      ? `Campus-WRS BEFFE Fertig ${beffe.toFixed(1)} %${Number.isFinite(aw) ? ` · a_w ${aw.toFixed(3)}` : ''} (Lehrformel)`
      : 'Import aus CharcuLogic Campus WRS',
    haltbar: '',
    hinweis: disclaimer,
    anweisung_A: disclaimer,
    anweisung_B: `Prozess: ${process.productFamily || '—'}, Verlust ${process.lossPct ?? '—'} %, NaCl ${process.saltAsNaclPct ?? '—'} %`,
    anweisung_C: '',
    anweisung_D: '',
    ingredients: lines.map((line) => ({
      name: `${line.code || ''} ${line.name || ''}`.trim(),
      pct: Math.round((Number(line.percentOfBatch) || 0) * 100) / 100,
      typ: hofSyncTypFromMaterialId(line.materialId),
      allergen: false,
      hinweis: '',
    })),
    sourceSchema: SOURCE,
    importedFrom: SOURCE,
  };
}

function normalizeHofSyncDoc(raw) {
  const id = safeFirestoreId(raw.id || raw.firestoreId);
  if (!id) throw new HttpsError('invalid-argument', 'HofSync-Rezept ohne id.');
  const name = String(raw.name || '').trim();
  if (!name) throw new HttpsError('invalid-argument', 'HofSync-Rezept ohne name.');
  const ingredients = Array.isArray(raw.ingredients) ? raw.ingredients : [];
  if (ingredients.length === 0) {
    throw new HttpsError('invalid-argument', 'HofSync-Rezept ohne ingredients.');
  }
  return {
    id,
    firestoreId: safeFirestoreId(raw.firestoreId || id),
    name,
    kat: String(raw.kat || 'Wurst'),
    kaliber: String(raw.kaliber || ''),
    basis_g: Number(raw.basis_g) || 0,
    allergene: Array.isArray(raw.allergene) ? raw.allergene.map(String) : [],
    tipp: String(raw.tipp || ''),
    haltbar: String(raw.haltbar || ''),
    hinweis: String(raw.hinweis || ''),
    anweisung_A: String(raw.anweisung_A || raw.anweisung || ''),
    anweisung_B: String(raw.anweisung_B || ''),
    anweisung_C: String(raw.anweisung_C || ''),
    anweisung_D: String(raw.anweisung_D || ''),
    ingredients: ingredients.map((line) => ({
      name: String(line?.name || ''),
      pct: Number(line?.pct) || 0,
      typ: String(line?.typ || 'base'),
      allergen: Boolean(line?.allergen),
      hinweis: String(line?.hinweis || ''),
    })),
    sourceSchema: String(raw.sourceSchema || SOURCE),
    importedFrom: String(raw.importedFrom || raw.sourceSchema || SOURCE),
    ...(Number.isFinite(Number(raw.standardMhdTage))
      ? { standardMhdTage: Number(raw.standardMhdTage) }
      : {}),
  };
}

/**
 * Resolve Campus envelope / campus export / HofSync doc → write payload.
 * @param {unknown} payload
 */
function resolveImportDocument(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new HttpsError('invalid-argument', 'Export-Payload fehlt.');
  }
  const root = payload;

  if (root.schema === 'campus.recipe.export.envelope' && root.campus) {
    if (!isCampusExport(root.campus)) {
      throw new HttpsError('invalid-argument', 'Envelope ohne gültiges campus.recipe.export@1.0.0.');
    }
    return mapCampusToHofSyncDoc(root.campus);
  }

  if (isCampusExport(root)) {
    return mapCampusToHofSyncDoc(root);
  }

  if (root.campus && isCampusExport(root.campus)) {
    return mapCampusToHofSyncDoc(root.campus);
  }

  if (root.hofSync && typeof root.hofSync === 'object') {
    return normalizeHofSyncDoc(root.hofSync);
  }

  if (typeof root.id === 'string' && typeof root.name === 'string' && Array.isArray(root.ingredients)) {
    return normalizeHofSyncDoc(root);
  }

  throw new HttpsError(
    'invalid-argument',
    'Unbekanntes Format — erwartet campus.recipe.export@1.0.0 oder HofSync-Rezept.',
  );
}

/**
 * @param {import('firebase-functions/v2/https').CallableRequest} request
 */
async function handleImportCampusRecipe(request) {
  if (!admin.apps.length) {
    admin.initializeApp();
  }

  const requestedTenantId = String(request.data?.tenantId || '').trim();
  const token = request.auth?.token || {};
  const claimTenantId = String(token.tenantId || token.tenant_id || token.tenantID || '').trim();
  const tenantId = (requestedTenantId || claimTenantId).trim();
  const ctx = assertAdminAccessForTenant(request.auth, tenantId);

  if (!tenantId) {
    throw new HttpsError('invalid-argument', 'Mandant (tenantId) fehlt.');
  }

  const mode = String(request.data?.mode || 'createOnly').trim();
  if (mode !== 'createOnly' && mode !== 'overwrite') {
    throw new HttpsError('invalid-argument', 'mode muss createOnly oder overwrite sein.');
  }

  const recipe = resolveImportDocument(request.data?.export ?? request.data?.payload ?? request.data);
  const docRef = admin.firestore().doc(`tenants/${tenantId}/rezepte/${recipe.firestoreId}`);
  const existing = await docRef.get();

  if (existing.exists && mode === 'createOnly') {
    throw new HttpsError(
      'already-exists',
      `Rezept „${recipe.name}" (${recipe.firestoreId}) existiert bereits. mode=overwrite zum Ersetzen.`,
    );
  }

  const writePayload = {
    ...recipe,
    tenantId,
    importedAt: FieldValue.serverTimestamp(),
    importedByUid: ctx.uid,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (!existing.exists) {
    writePayload.createdAt = FieldValue.serverTimestamp();
  }

  await docRef.set(writePayload, { merge: mode === 'overwrite' });

  // Optional import audit trail (best-effort; collection may lack rules for clients).
  try {
    await admin.firestore().collection(`tenants/${tenantId}/importe`).add({
      kind: 'campus_recipe',
      recipeId: recipe.firestoreId,
      recipeName: recipe.name,
      sourceSchema: recipe.sourceSchema,
      mode,
      importedByUid: ctx.uid,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn('[importCampusRecipe] importe log skipped', err?.message || err);
  }

  return {
    ok: true,
    tenantId,
    recipeId: recipe.firestoreId,
    name: recipe.name,
    mode,
    overwritten: existing.exists,
  };
}

exports.handleImportCampusRecipe = handleImportCampusRecipe;
exports.resolveImportDocument = resolveImportDocument;
exports.mapCampusToHofSyncDoc = mapCampusToHofSyncDoc;
exports.CALLABLE_BASE_OPTIONS = CALLABLE_BASE_OPTIONS;

exports.importCampusRecipe = onCall(
  CALLABLE_BASE_OPTIONS,
  handleImportCampusRecipe,
);
