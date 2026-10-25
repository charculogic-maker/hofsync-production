/**
 * Stammdaten-EAN-Index für den Barcode-Wareneingang.
 * (Extrahiert aus dem archivierten KI-Lieferschein-Abgleich.)
 */

import { getTenantCollection } from './tenant-db.js';

const SUPPLIER_ARTICLE_KEYS = [
  'artikelnummer',
  'artnr',
  'artikelNr',
  'sku',
  'itemNumber',
  'lieferantenArtNr',
  'supplierArticleNumber',
  'articleNumber',
  'nummer',
];

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function foldCatalogName(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function consumerEan(value) {
  const digits = digitsOnly(value);
  return digits.length >= 8 && digits.length <= 14 ? digits : '';
}

/**
 * Liefert die Verbraucher-EAN aus den Stammdaten, wenn nur
 * Lieferanten-Artikelnummer oder Titel bekannt sind.
 */
export function lookupCatalogEan(index, { name = '', articleNumber = '', ean = '' } = {}) {
  const direct = consumerEan(ean);
  if (direct) return direct;
  if (!index) return '';
  const rawDigits = digitsOnly(ean);
  const article = digitsOnly(articleNumber)
    || (rawDigits.length >= 4 && rawDigits.length <= 8 ? rawDigits : '');
  if (article && index.byArticle?.has(article)) return index.byArticle.get(article);
  const folded = foldCatalogName(name);
  if (folded && index.byName?.has(folded)) return index.byName.get(folded);
  return '';
}

function indexCatalogEanDoc(data, docId, byArticle, byName, ambiguousNames) {
  const ean = consumerEan(data.ean || data.barcode || (consumerEan(docId) ? docId : ''));
  if (!ean) return;
  SUPPLIER_ARTICLE_KEYS.forEach((key) => {
    const article = digitsOnly(data[key]);
    if (article.length >= 4 && article.length <= 8 && article !== ean) {
      byArticle.set(article, ean);
    }
  });
  const labels = [data.name, data.artikel, data.articleName];
  labels.join(' ').match(/\b(\d{5,8})\b/g)?.forEach((token) => {
    if (token !== ean) byArticle.set(token, ean);
  });
  labels.forEach((label) => {
    const folded = foldCatalogName(label);
    if (!folded) return;
    if (byName.has(folded) && byName.get(folded) !== ean) {
      ambiguousNames.add(folded);
      return;
    }
    byName.set(folded, ean);
  });
}

/** Lie-Fi Schutz: Stammdaten-GETs dürfen finalizeDelivery nicht blockieren. */
const CATALOG_READ_TIMEOUT_MS = 3500;

class CatalogReadTimeoutError extends Error {
  constructor(collectionName, ms) {
    super(`EAN-Katalog (${collectionName}) hat nach ${ms}ms nicht geantwortet.`);
    this.name = 'CatalogReadTimeoutError';
    this.code = 'catalog-read-timeout';
    this.collectionName = collectionName;
  }
}

function withCatalogReadTimeout(promise, collectionName, ms = CATALOG_READ_TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new CatalogReadTimeoutError(collectionName, ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// #region agent log
function agentDbgLog(hypothesisId, location, message, data = {}) {
  try {
    const entry = { hypothesisId, location, message, data, timestamp: Date.now(), runId: 'post-fix' };
    const w = typeof window !== 'undefined' ? window : globalThis;
    w.__agentDebugLog = w.__agentDebugLog || [];
    w.__agentDebugLog.push(entry);
    console.log('AGENT_DBG', JSON.stringify(entry));
  } catch (_) { /* ignore */ }
}
// #endregion

async function loadCatalogCollectionSnap(collectionName, limit) {
  // #region agent log
  agentDbgLog('A', `catalog-ean.js:${collectionName}:before`, `before ${collectionName}.get`, {});
  // #endregion
  try {
    const snap = await withCatalogReadTimeout(
      getTenantCollection(collectionName).limit(limit).get(),
      collectionName,
    );
    // #region agent log
    agentDbgLog('A', `catalog-ean.js:${collectionName}:after`, `after ${collectionName}.get`, { size: snap?.size ?? null });
    // #endregion
    return snap;
  } catch (err) {
    // #region agent log
    agentDbgLog('A', `catalog-ean.js:${collectionName}:error`, `${collectionName}.get failed`, {
      message: String(err?.message || err),
      code: String(err?.code || ''),
      timedOut: err?.name === 'CatalogReadTimeoutError',
    });
    // #endregion
    console.warn(`[HofSync] ${collectionName} für EAN-Abgleich nicht lesbar:`, err);
    return null;
  }
}

/** Lädt einen Index byArticle/byName aus stammdaten + product_master. */
export async function loadCatalogEanIndex() {
  // #region agent log
  agentDbgLog('A', 'catalog-ean.js:loadCatalogEanIndex:entry', 'loadCatalogEanIndex start', { timeoutMs: CATALOG_READ_TIMEOUT_MS });
  // #endregion
  const byArticle = new Map();
  const byName = new Map();
  const ambiguousNames = new Set();

  // Parallel + per-read timeout: finalize waits at most ~3.5s, not 7s stacked.
  const [stammdatenSnap, productMasterSnap] = await Promise.all([
    loadCatalogCollectionSnap('stammdaten', 400),
    loadCatalogCollectionSnap('product_master', 500),
  ]);

  stammdatenSnap?.forEach((doc) => {
    indexCatalogEanDoc(doc.data() || {}, doc.id, byArticle, byName, ambiguousNames);
  });
  // Manuell gelernte EANs aus dem Wareneingang (product_master).
  productMasterSnap?.forEach((doc) => {
    indexCatalogEanDoc(doc.data() || {}, doc.id, byArticle, byName, ambiguousNames);
  });

  ambiguousNames.forEach((folded) => byName.delete(folded));
  // #region agent log
  agentDbgLog('A', 'catalog-ean.js:loadCatalogEanIndex:exit', 'loadCatalogEanIndex done', { byArticle: byArticle.size, byName: byName.size });
  // #endregion
  return { byArticle, byName };
}
