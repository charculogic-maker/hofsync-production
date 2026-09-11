/**
 * Gemeinsame Artikel-Stammdaten (Name je EAN) für Wareneingang und Protokoll-Korrekturen.
 * Pfad: tenants/{tenantId}/product_master/{ean}
 */
import { getNamedTenantCollection, normalizeTenantId } from './tenant-db.js';
import { sanitizeProductName } from './utils.js';

export const PRODUCT_MASTER_COLLECTION = 'product_master';
export const PRODUCT_MASTER_STORAGE_KEY = 'charculogic.productMaster.v1';

export function cleanProductEan(raw) {
  return String(raw || '').replace(/\D/g, '');
}

export function productMasterStorageKey(tenantId) {
  const tenantKey = normalizeTenantId(tenantId);
  return tenantKey ? `${PRODUCT_MASTER_STORAGE_KEY}.${tenantKey}` : '';
}

export function readLocalProductMaster(tenantId) {
  const storageKey = productMasterStorageKey(tenantId);
  if (!storageKey) return {};
  try {
    return JSON.parse(localStorage.getItem(storageKey) || '{}') || {};
  } catch (err) {
    console.warn('[HofSync] Lokale Artikeldaten konnten nicht gelesen werden:', err);
    return {};
  }
}

export function writeLocalProductMasterMap(tenantId, value) {
  const storageKey = productMasterStorageKey(tenantId);
  if (!storageKey) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(value || {}));
  } catch (err) {
    console.warn('[HofSync] Lokale Artikeldaten konnten nicht gespeichert werden:', err);
  }
}

export function writeLocalProductMasterEntry(tenantId, product = {}) {
  const barcode = cleanProductEan(product.barcode || product.ean);
  const name = sanitizeProductName(product.name || product.articleName || product.produkt || '');
  const storageKey = productMasterStorageKey(tenantId);
  if (!storageKey || !barcode || !name) return null;
  const productMaster = readLocalProductMaster(tenantId);
  const entry = {
    barcode,
    name,
    brand: sanitizeProductName(product.brand || product.marke || ''),
    category: product.kategorie || product.category || '📦 Trockenware',
  };
  productMaster[barcode] = entry;
  const scanBarcode = cleanProductEan(product.scanBarcode);
  if (scanBarcode && scanBarcode !== barcode) {
    productMaster[scanBarcode] = {
      ...entry,
      barcode: scanBarcode,
      einzelBarcode: barcode,
    };
  }
  writeLocalProductMasterMap(tenantId, productMaster);
  return entry;
}

export function buildProductMasterDoc(tenantId, product = {}, editorLabel = '') {
  const ean = cleanProductEan(product.ean || product.barcode);
  const articleName = sanitizeProductName(product.articleName || product.name || product.produkt || '');
  if (!ean || !articleName) return null;
  return {
    tenantId: String(tenantId || '').trim(),
    ean,
    articleName,
    name: articleName,
    brand: sanitizeProductName(product.brand || product.marke || ''),
    category: product.category || product.kategorie || '',
    updatedAt: new Date().toISOString(),
    updatedBy: String(editorLabel || product.updatedBy || '').trim(),
  };
}

export async function persistProductMasterToFirestore(tenantId, product = {}, editorLabel = '') {
  const id = String(tenantId || '').trim();
  const doc = buildProductMasterDoc(id, product, editorLabel);
  if (!id || !doc) return null;
  writeLocalProductMasterEntry(id, {
    ...product,
    ean: doc.ean,
    name: doc.articleName,
    articleName: doc.articleName,
    brand: doc.brand,
    category: doc.category,
  });
  const col = getNamedTenantCollection(id, PRODUCT_MASTER_COLLECTION);
  await col.doc(doc.ean).set(doc, { merge: true });
  return doc;
}

export async function hydrateProductMasterFromFirestore(tenantId) {
  const id = String(tenantId || '').trim();
  if (!id) return 0;
  try {
    const col = getNamedTenantCollection(id, PRODUCT_MASTER_COLLECTION);
    const snap = await col.get();
    const local = readLocalProductMaster(id);
    (snap.docs || []).forEach((doc) => {
      const data = doc.data ? doc.data() : (doc || {});
      const ean = cleanProductEan(data.ean || doc.id);
      const name = sanitizeProductName(data.articleName || data.name || '');
      if (!ean || !name) return;
      local[ean] = {
        barcode: ean,
        name,
        brand: sanitizeProductName(data.brand || ''),
        category: data.category || data.kategorie || '📦 Trockenware',
      };
    });
    writeLocalProductMasterMap(id, local);
    return (snap.docs || []).length;
  } catch (err) {
    console.warn('[HofSync] Gemeinsame Artikeldaten konnten nicht geladen werden:', err);
    return 0;
  }
}
