/**
 * Gemeinsame Artikel-Stammdaten (Name je EAN) für Wareneingang und Protokoll-Korrekturen.
 * Pfad: tenants/{tenantId}/product_master/{ean}
 *
 * default_vpe: gelernte Gebindegröße / übliche Stückzahl beim nächsten Scan (Fallback: 1).
 */
import { getNamedTenantCollection } from './tenant-db.js';
import { sanitizeProductName } from './utils.js';

export const PRODUCT_MASTER_COLLECTION = 'product_master';
export const PRODUCT_MASTER_STORAGE_KEY = 'charculogic.productMaster.v1';
export const DEFAULT_VPE_FALLBACK = 1;
export const DEFAULT_VPE_MAX = 9999;

export function cleanProductEan(raw) {
  return String(raw || '').replace(/\D/g, '');
}

/**
 * Normalisiert eine Gebindegröße / Stückzahl auf Integer ≥ 1.
 * Ungültige Werte → Fallback 1.
 */
export function normalizeDefaultVpe(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_VPE_FALLBACK;
  const rounded = Math.round(parsed);
  if (rounded < 1) return DEFAULT_VPE_FALLBACK;
  return Math.min(rounded, DEFAULT_VPE_MAX);
}

/**
 * Ob die eingegebene Menge als neue default_vpe gelernt werden darf.
 * Storno, Differenzbuchungen, Ausverkauft und kg-Erfassungen überspringen.
 */
export function shouldLearnDefaultVpe(options = {}) {
  if (options.soldOut === true) return false;
  if (options.isStorno === true || options.isDiff === true || options.isDifferenz === true) {
    return false;
  }
  const action = String(options.actionType || options.action || '').trim().toLowerCase();
  if (['storno', 'differenz', 'diff', 'raus', 'abschreiben', 'soldout', 'ausverkauft'].includes(action)) {
    return false;
  }
  const unit = String(options.qtyUnit || options.einheit || options.mengeEinheit || 'Stk').trim();
  if (unit && unit !== 'Stk') return false;
  const qty = Number(options.qty ?? options.menge ?? options.default_vpe);
  if (!Number.isFinite(qty) || qty < 1) return false;
  return true;
}

/**
 * Prefill-Menge beim Scan: VPE-Stamm (packageSize) vor default_vpe, sonst 1.
 */
export function resolvePrefillQty(productInfo = null) {
  if (!productInfo) return DEFAULT_VPE_FALLBACK;
  if (productInfo.isVpe) {
    const packageSize = Number(productInfo.packageSize ?? productInfo.vpeInhalt);
    if (Number.isFinite(packageSize) && packageSize >= 1) {
      return normalizeDefaultVpe(packageSize);
    }
  }
  if (productInfo.default_vpe != null || productInfo.defaultVpe != null) {
    return normalizeDefaultVpe(productInfo.default_vpe ?? productInfo.defaultVpe);
  }
  return DEFAULT_VPE_FALLBACK;
}

/**
 * Neue default_vpe nach bestätigter Menge.
 * Mehrere gleiche Gebinde (z. B. 12 bei gewohnter VPE 6) überschreiben die
 * Gebindegröße nicht — nur die Stückzahl der Erfassung war höher.
 */
export function resolveLearnedDefaultVpe(confirmedQty, previousDefaultVpe = null) {
  const qty = normalizeDefaultVpe(confirmedQty);
  if (previousDefaultVpe == null || previousDefaultVpe === '') return qty;
  const prev = normalizeDefaultVpe(previousDefaultVpe);
  if (prev > 1 && qty > prev && qty % prev === 0) return prev;
  return qty;
}

/**
 * Ob ein Badge „Gewohnte VPE“ angezeigt werden soll (Wert stammt aus Historie/Stamm).
 */
export function hasHabitualVpe(productInfo = null) {
  if (!productInfo) return false;
  if (productInfo.isVpe) {
    const packageSize = Number(productInfo.packageSize ?? productInfo.vpeInhalt);
    return Number.isFinite(packageSize) && packageSize >= 1;
  }
  if (productInfo._hasStoredVpe === true) return true;
  if (productInfo._hasStoredVpe === false) return false;
  const stored = productInfo.default_vpe ?? productInfo.defaultVpe;
  return stored != null && Number.isFinite(Number(stored));
}

export function formatHabitualVpeBadge(qty) {
  const n = normalizeDefaultVpe(qty);
  return `Gewohnte VPE: ${n}`;
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

export function writeLocalProductMasterEntry(product = {}) {
  const barcode = cleanProductEan(product.barcode || product.ean);
  const name = sanitizeProductName(product.name || product.articleName || product.produkt || '');
  if (!barcode || !name) return null;
  const productMaster = readLocalProductMaster();
  const previous = productMaster[barcode] || {};
  const hasExplicitVpe = Object.prototype.hasOwnProperty.call(product, 'default_vpe')
    || Object.prototype.hasOwnProperty.call(product, 'defaultVpe');
  const entry = {
    barcode,
    name,
    brand: sanitizeProductName(product.brand || product.marke || ''),
    category: product.kategorie || product.category || previous.category || '📦 Trockenware',
  };
  if (hasExplicitVpe) {
    entry.default_vpe = normalizeDefaultVpe(product.default_vpe ?? product.defaultVpe);
  } else if (previous.default_vpe != null || previous.defaultVpe != null) {
    entry.default_vpe = normalizeDefaultVpe(previous.default_vpe ?? previous.defaultVpe);
  }
  productMaster[barcode] = entry;
  const scanBarcode = cleanProductEan(product.scanBarcode);
  if (scanBarcode && scanBarcode !== barcode) {
    productMaster[scanBarcode] = {
      ...entry,
      barcode: scanBarcode,
      einzelBarcode: barcode,
    };
  }
  writeLocalProductMasterMap(productMaster);
  return entry;
}

/**
 * Aktualisiert nur default_vpe lokal (Name muss bereits existieren oder mitgeliefert werden).
 */
export function writeLocalDefaultVpe(ean, qty, product = {}) {
  const barcode = cleanProductEan(ean || product.barcode || product.ean);
  if (!barcode) return null;
  const defaultVpe = normalizeDefaultVpe(qty);
  const productMaster = readLocalProductMaster();
  const previous = productMaster[barcode] || {};
  const name = sanitizeProductName(
    product.name || product.articleName || product.produkt || previous.name || '',
  );
  if (!name) return null;
  const entry = {
    ...previous,
    barcode,
    name,
    brand: sanitizeProductName(product.brand || product.marke || previous.brand || ''),
    category: product.kategorie || product.category || previous.category || '📦 Trockenware',
    default_vpe: defaultVpe,
  };
  productMaster[barcode] = entry;
  writeLocalProductMasterMap(productMaster);
  return entry;
}

export function buildProductMasterDoc(tenantId, product = {}, editorLabel = '') {
  const ean = cleanProductEan(product.ean || product.barcode);
  const articleName = sanitizeProductName(product.articleName || product.name || product.produkt || '');
  if (!ean || !articleName) return null;
  const doc = {
    tenantId: String(tenantId || '').trim(),
    ean,
    articleName,
    name: articleName,
    brand: sanitizeProductName(product.brand || product.marke || ''),
    category: product.category || product.kategorie || '',
    updatedAt: new Date().toISOString(),
    updatedBy: String(editorLabel || product.updatedBy || '').trim(),
  };
  if (product.default_vpe != null || product.defaultVpe != null) {
    doc.default_vpe = normalizeDefaultVpe(product.default_vpe ?? product.defaultVpe);
  }
  return doc;
}

export async function persistProductMasterToFirestore(tenantId, product = {}, editorLabel = '') {
  const id = String(tenantId || '').trim();
  const doc = buildProductMasterDoc(id, product, editorLabel);
  if (!id || !doc) return null;
  writeLocalProductMasterEntry(doc);
  const col = getNamedTenantCollection(id, PRODUCT_MASTER_COLLECTION);
  await col.doc(doc.ean).set(doc, { merge: true });
  return doc;
}

/**
 * Lernt default_vpe nach bestätigter Stückzahl-Erfassung (Wareneingang / MHD-Einbuchung).
 * Keine Aktualisierung bei Storno / Differenz / Ausverkauft / kg.
 */
export async function learnDefaultVpeFromConfirmedQty(tenantId, product = {}, options = {}) {
  const qty = product.qty ?? product.menge ?? product.default_vpe ?? options.qty;
  if (!shouldLearnDefaultVpe({ ...options, ...product, qty })) return null;
  const ean = cleanProductEan(product.ean || product.barcode || options.ean);
  if (!ean) return null;
  const previous = readLocalProductMaster()[ean]?.default_vpe
    ?? readLocalProductMaster()[ean]?.defaultVpe
    ?? options.previousDefaultVpe
    ?? product.previousDefaultVpe
    ?? null;
  const defaultVpe = resolveLearnedDefaultVpe(qty, previous);
  const local = writeLocalDefaultVpe(ean, defaultVpe, product);
  if (!local) return null;
  const id = String(tenantId || '').trim();
  if (!id) return local;
  try {
    await persistProductMasterToFirestore(id, {
      ...product,
      ean,
      name: local.name,
      brand: local.brand,
      category: local.category,
      default_vpe: defaultVpe,
    }, options.editorLabel || product.updatedBy || '');
  } catch (err) {
    console.warn('[HofSync] default_vpe konnte nicht in Firestore geschrieben werden:', err);
  }
  return { ...local, default_vpe: defaultVpe };
}

export async function hydrateProductMasterFromFirestore(tenantId) {
  const id = String(tenantId || '').trim();
  if (!id) return 0;
  try {
    const col = getNamedTenantCollection(id, PRODUCT_MASTER_COLLECTION);
    const snap = await col.get();
    const local = readLocalProductMaster();
    (snap.docs || []).forEach((doc) => {
      const data = doc.data ? doc.data() : (doc || {});
      const ean = cleanProductEan(data.ean || doc.id);
      const name = sanitizeProductName(data.articleName || data.name || '');
      if (!ean || !name) return;
      const previous = local[ean] || {};
      const entry = {
        barcode: ean,
        name,
        brand: sanitizeProductName(data.brand || ''),
        category: data.category || data.kategorie || '📦 Trockenware',
      };
      if (Object.prototype.hasOwnProperty.call(data, 'default_vpe')
        || Object.prototype.hasOwnProperty.call(data, 'defaultVpe')) {
        entry.default_vpe = normalizeDefaultVpe(data.default_vpe ?? data.defaultVpe);
      } else if (previous.default_vpe != null || previous.defaultVpe != null) {
        entry.default_vpe = normalizeDefaultVpe(previous.default_vpe ?? previous.defaultVpe);
      }
      local[ean] = entry;
    });
    writeLocalProductMasterMap(local);
    return (snap.docs || []).length;
  } catch (err) {
    console.warn('[HofSync] Gemeinsame Artikeldaten konnten nicht geladen werden:', err);
    return 0;
  }
}
