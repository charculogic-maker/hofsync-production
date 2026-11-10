/**
 * Gemeinsame Artikel-Stammdaten (Name je EAN) für Wareneingang und Protokoll-Korrekturen.
 * Pfad: tenants/{tenantId}/product_master/{ean}
 */
import { getNamedTenantCollection } from './tenant-db.js';
import { sanitizeProductName } from './utils.js';
import { addPendingSync } from './sync.js';

export const PRODUCT_MASTER_COLLECTION = 'product_master';
export const PRODUCT_MASTER_STORAGE_KEY = 'charculogic.productMaster.v1';

const DEFAULT_CATEGORY = '📦 Trockenware';
const DEFAULT_DAYS_FRESH = 7;

export function cleanProductEan(raw) {
  return String(raw || '').replace(/\D/g, '');
}

export function readLocalProductMaster() {
  try {
    return JSON.parse(localStorage.getItem(PRODUCT_MASTER_STORAGE_KEY) || '{}') || {};
  } catch (err) {
    console.warn('[HofSync] Lokale Artikeldaten konnten nicht gelesen werden:', err);
    return {};
  }
}

function writeLocalProductMasterMap(value) {
  try {
    localStorage.setItem(PRODUCT_MASTER_STORAGE_KEY, JSON.stringify(value || {}));
  } catch (err) {
    console.warn('[HofSync] Lokale Artikeldaten konnten nicht gespeichert werden:', err);
  }
}

function resolveCategory(product = {}) {
  return String(product.kategorie || product.category || DEFAULT_CATEGORY).trim() || DEFAULT_CATEGORY;
}

function resolveDaysFresh(product = {}) {
  const raw = Number(product.daysFresh ?? product.tage ?? product.resttage);
  if (Number.isFinite(raw) && raw >= 0) return Math.round(raw);
  return DEFAULT_DAYS_FRESH;
}

export function writeLocalProductMasterEntry(product = {}) {
  const rawId = String(product.barcode || product.ean || product.id || '').trim();
  const barcode = cleanProductEan(rawId) || rawId;
  const name = sanitizeProductName(product.name || product.articleName || product.produkt || '');
  if (!barcode || !name) return null;
  const productMaster = readLocalProductMaster();
  const category = resolveCategory(product);
  const entry = {
    id: barcode,
    barcode,
    ean: barcode,
    name,
    articleName: name,
    brand: sanitizeProductName(product.brand || product.marke || ''),
    category,
    kategorie: category,
    daysFresh: resolveDaysFresh(product),
    active: product.active !== false,
    createdAt: product.createdAt || new Date().toISOString(),
  };
  productMaster[barcode] = entry;
  const scanBarcode = cleanProductEan(product.scanBarcode);
  if (scanBarcode && scanBarcode !== barcode) {
    productMaster[scanBarcode] = {
      ...entry,
      barcode: scanBarcode,
      ean: scanBarcode,
      id: scanBarcode,
      einzelBarcode: barcode,
    };
  }
  writeLocalProductMasterMap(productMaster);
  return entry;
}

export function buildProductMasterDoc(tenantId, product = {}, editorLabel = '') {
  const rawId = String(product.ean || product.barcode || product.id || '').trim();
  const ean = cleanProductEan(rawId) || rawId;
  const articleName = sanitizeProductName(product.articleName || product.name || product.produkt || '');
  if (!ean || !articleName) return null;
  const category = resolveCategory(product);
  const nowIso = new Date().toISOString();
  return {
    tenantId: String(tenantId || '').trim(),
    id: ean,
    ean,
    articleName,
    name: articleName,
    brand: sanitizeProductName(product.brand || product.marke || ''),
    category,
    kategorie: category,
    daysFresh: resolveDaysFresh(product),
    supplier: sanitizeProductName(product.supplier || product.lieferant || ''),
    active: product.active !== false,
    createdAt: product.createdAt || nowIso,
    updatedAt: nowIso,
    updatedBy: String(editorLabel || product.updatedBy || '').trim(),
  };
}

function queueProductMasterWrite(tenantId, doc) {
  const collectionPath = `tenants/${tenantId}/${PRODUCT_MASTER_COLLECTION}`;
  return addPendingSync({
    _syncType: 'firestore-doc',
    _collectionPath: collectionPath,
    _docId: doc.ean,
    _op: 'set',
    data: doc,
  });
}

export async function persistProductMasterToFirestore(tenantId, product = {}, editorLabel = '') {
  const id = String(tenantId || '').trim();
  const doc = buildProductMasterDoc(id, product, editorLabel);
  if (!id || !doc) return null;
  // Lokal immer zuerst — UI darf nicht auf Firestore warten.
  writeLocalProductMasterEntry(doc);

  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offline) {
    const queued = queueProductMasterWrite(id, doc);
    if (!queued) {
      console.warn('[HofSync] Artikel-Stammdaten: Offline-Queue voll.');
    }
    return { ...doc, queued: true };
  }

  try {
    const col = getNamedTenantCollection(id, PRODUCT_MASTER_COLLECTION);
    await col.doc(doc.ean).set(doc, { merge: true });
    return doc;
  } catch (err) {
    console.warn('[HofSync] Artikel-Stammdaten: Schreibversuch fehlgeschlagen, queue:', err);
    const queued = queueProductMasterWrite(id, doc);
    if (!queued) throw err;
    return { ...doc, queued: true, error: err };
  }
}

function isFirestoreReadDenied(err) {
  const code = String(err?.code || '').toLowerCase();
  const message = String(err?.message || '').toLowerCase();
  return code.includes('permission-denied') || message.includes('permission') || message.includes('insufficient');
}

export async function hydrateProductMasterFromFirestore(tenantId) {
  const id = String(tenantId || '').trim();
  if (!id) return 0;
  try {
    const col = getNamedTenantCollection(id, PRODUCT_MASTER_COLLECTION);
    let snap;
    try {
      snap = await col.get();
    } catch (err) {
      if (isFirestoreReadDenied(err)) {
        console.warn('[HofSync] Artikel-Stammdaten: Lesen durch Firestore-Regeln verweigert. Lokale Daten bleiben aktiv.');
        return 0;
      }
      throw err;
    }
    const local = readLocalProductMaster();
    (snap?.docs || []).forEach((docSnap) => {
      const data = docSnap.data ? docSnap.data() : (docSnap || {});
      const ean = cleanProductEan(data.ean || docSnap.id);
      const name = sanitizeProductName(data.articleName || data.name || '');
      if (!ean || !name) return;
      const category = data.category || data.kategorie || DEFAULT_CATEGORY;
      local[ean] = {
        id: ean,
        barcode: ean,
        ean,
        name,
        articleName: name,
        brand: sanitizeProductName(data.brand || ''),
        category,
        kategorie: category,
        daysFresh: resolveDaysFresh(data),
        active: data.active !== false,
        createdAt: data.createdAt || undefined,
      };
    });
    writeLocalProductMasterMap(local);
    return (snap?.docs || []).length;
  } catch (err) {
    if (isFirestoreReadDenied(err)) {
      console.warn('[HofSync] Artikel-Stammdaten: Lesen durch Firestore-Regeln verweigert. Lokale Daten bleiben aktiv.');
      return 0;
    }
    console.warn('[HofSync] Gemeinsame Artikeldaten konnten nicht geladen werden:', err);
    return 0;
  }
}
