/**
 * Firestore-Zugriff für Hybrid-Katalog-Overrides (Vorbestellportal).
 * Pfad: tenants/{tenantId}/catalog_overrides/{artikelNummer}
 */
import { resolveFirebaseConfig, toFirebaseSdkConfig } from './firebase-config.js';
import {
  ORDER_CATALOG,
  applyProductOverride,
  firestoreOverrideToCatalogPatch,
  normalizeFirestoreCatalogOverride,
  resolvePricingType,
} from './orderCatalog.js';

/** Soft-Launch-Mandant für StevesHof-Vorbestellung */
export const PREORDER_CATALOG_TENANT_ID = 'StevesHof_Hauptbetrieb';
export const CATALOG_OVERRIDES_COLLECTION = 'catalog_overrides';

/**
 * @returns {typeof firebase | null}
 */
function firebaseApi() {
  return typeof globalThis.firebase !== 'undefined' ? globalThis.firebase : null;
}

/**
 * Stellt sicher, dass eine Firebase-App existiert (Compat-SDK).
 * @returns {{ app: any, db: any } | null}
 */
export function ensurePreorderFirebase() {
  const api = firebaseApi();
  if (!api?.initializeApp || !api.firestore) {
    console.warn('[catalog-overrides] Firebase Compat-SDK fehlt');
    return null;
  }
  try {
    if (!api.apps?.length) {
      api.initializeApp(toFirebaseSdkConfig(resolveFirebaseConfig()));
    }
    const app = api.app();
    const db = api.firestore();
    return { app, db };
  } catch (err) {
    console.error('[catalog-overrides] Firebase-Init fehlgeschlagen:', err);
    return null;
  }
}

/**
 * @param {string} [tenantId]
 * @returns {string}
 */
export function resolvePreorderTenantId(tenantId) {
  const fromArg = String(tenantId || '').trim();
  if (fromArg) return fromArg;
  try {
    const params = new URLSearchParams(globalThis.location?.search || '');
    const fromUrl = String(params.get('tenant') || params.get('tenantId') || '').trim();
    if (fromUrl) return fromUrl;
  } catch (_) { /* noop */ }
  return PREORDER_CATALOG_TENANT_ID;
}

/**
 * @param {any} db
 * @param {string} tenantId
 * @param {string} artNr
 */
function overrideDocRef(db, tenantId, artNr) {
  const id = String(artNr || '').trim();
  if (!id) throw new Error('Artikelnummer fehlt');
  return db.collection('tenants').doc(tenantId).collection(CATALOG_OVERRIDES_COLLECTION).doc(id);
}

/**
 * Alle Overrides eines Mandanten laden (öffentlich lesbar).
 * @param {{ db?: any, tenantId?: string }} [options]
 * @returns {Promise<Record<string, { isActive?: boolean, promoPrice?: number|null, promoText?: string }>>}
 */
export async function fetchCatalogOverridesFromFirestore(options = {}) {
  const boot = options.db ? { db: options.db } : ensurePreorderFirebase();
  if (!boot?.db) return {};
  const tenantId = resolvePreorderTenantId(options.tenantId);
  try {
    const snap = await boot.db
      .collection('tenants')
      .doc(tenantId)
      .collection(CATALOG_OVERRIDES_COLLECTION)
      .get();
    /** @type {Record<string, any>} */
    const byArtNr = {};
    snap.forEach((docSnap) => {
      const artNr = String(docSnap.id || '').trim();
      if (!artNr) return;
      byArtNr[artNr] = normalizeFirestoreCatalogOverride({ artNr, ...docSnap.data() });
    });
    return byArtNr;
  } catch (err) {
    console.error('[catalog-overrides] Laden fehlgeschlagen:', err);
    return {};
  }
}

/**
 * Firestore-Docs (by artNr) → interne Overrides (by product.id).
 * @param {Record<string, any>} byArtNr
 * @returns {Record<string, import('./orderCatalog.js').CatalogOverride>}
 */
export function mapArtNrOverridesToProductOverrides(byArtNr) {
  /** @type {Record<string, any>} */
  const byProductId = {};
  if (!byArtNr || typeof byArtNr !== 'object') return byProductId;

  for (const category of ORDER_CATALOG) {
    for (const product of category.products) {
      const artNr = String(product.artNr || '').trim();
      if (!artNr) continue;
      const doc = byArtNr[artNr];
      if (!doc) continue;
      byProductId[product.id] = firestoreOverrideToCatalogPatch(product, doc);
    }
  }
  return byProductId;
}

/**
 * Einzelnen Override speichern (Auth + Tenant-Claim erforderlich).
 * @param {{
 *   artNr: string,
 *   isActive?: boolean,
 *   promoPrice?: number|null,
 *   promoText?: string|null,
 *   tenantId?: string,
 *   db?: any,
 *   updatedBy?: string,
 * }} payload
 */
export async function saveCatalogOverrideToFirestore(payload) {
  const boot = payload.db ? { db: payload.db } : ensurePreorderFirebase();
  if (!boot?.db) throw new Error('Firestore nicht bereit');
  const tenantId = resolvePreorderTenantId(payload.tenantId);
  const artNr = String(payload.artNr || '').trim();
  if (!artNr) throw new Error('Artikelnummer fehlt');

  const api = firebaseApi();
  const authUser = api?.auth?.()?.currentUser || null;
  if (!authUser) {
    throw new Error('Bitte zuerst am Laden-iPhone anmelden, um Sortiment zu speichern.');
  }

  /** @type {Record<string, any>} */
  const data = {
    isActive: payload.isActive !== false,
    promoPrice: payload.promoPrice == null || payload.promoPrice === ''
      ? null
      : Number(payload.promoPrice),
    promoText: payload.promoText == null
      ? null
      : String(payload.promoText).trim().slice(0, 48) || null,
    updatedAt: api.firestore.FieldValue.serverTimestamp(),
    updatedBy: String(payload.updatedBy || authUser.email || authUser.uid || '').slice(0, 120),
  };
  if (!(Number.isFinite(data.promoPrice) && data.promoPrice >= 0)) {
    data.promoPrice = null;
  }

  await overrideDocRef(boot.db, tenantId, artNr).set(data, { merge: true });
  return data;
}

/**
 * Override-Dokument löschen (Aktion zurücksetzen / Default).
 * @param {{ artNr: string, tenantId?: string, db?: any }} payload
 */
export async function deleteCatalogOverrideFromFirestore(payload) {
  const boot = payload.db ? { db: payload.db } : ensurePreorderFirebase();
  if (!boot?.db) throw new Error('Firestore nicht bereit');
  const tenantId = resolvePreorderTenantId(payload.tenantId);
  const artNr = String(payload.artNr || '').trim();
  if (!artNr) throw new Error('Artikelnummer fehlt');
  const api = firebaseApi();
  if (!api?.auth?.()?.currentUser) {
    throw new Error('Bitte zuerst am Laden-iPhone anmelden, um Sortiment zu speichern.');
  }
  await overrideDocRef(boot.db, tenantId, artNr).delete();
}

/**
 * Produkt mit Basispreis + Override für Admin-Formular vorbereiten.
 * @param {import('./orderCatalog.js').CatalogProduct} product
 * @param {import('./orderCatalog.js').CatalogOverride|null|undefined} override
 */
export function describeOverrideEditorState(product, override) {
  const merged = applyProductOverride(product, override);
  const pricingType = resolvePricingType(product);
  const basePrice = pricingType === 'fixed'
    ? (Number(product.estimatedPiecePrice) || 0)
    : (Number(product.pricePerKg) || 0);
  const promoPrice = pricingType === 'fixed'
    ? (override && Number.isFinite(Number(override.estimatedPiecePrice))
      ? Number(override.estimatedPiecePrice)
      : null)
    : (override && Number.isFinite(Number(override.pricePerKg))
      ? Number(override.pricePerKg)
      : null);
  return {
    artNr: product.artNr || '',
    productId: product.id,
    name: product.name,
    categoryId: product.categoryId,
    pricingType,
    basePrice,
    isActive: merged.active !== false,
    promoPrice: promoPrice != null && promoPrice !== basePrice ? promoPrice : (promoPrice ?? null),
    promoText: String(override?.badge || '').trim(),
    unitLabel: pricingType === 'fixed' ? '€ / Stück' : '€ / kg',
  };
}
