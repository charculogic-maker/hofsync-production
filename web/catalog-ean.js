/**
 * Stammdaten-EAN-Index für Wareneingang (Barcode / Artikelnummer → Verbraucher-EAN).
 * Früher Teil von delivery-reconciliation.js; OCR-UI wurde archiviert.
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

function consumerEan(value) {
  const digits = digitsOnly(value);
  return digits.length >= 8 && digits.length <= 14 ? digits : '';
}

function foldCatalogName(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Liefert die Verbraucher-EAN aus den Stammdaten, wenn die Rechnung nur
 * eine Lieferanten-Artikelnummer oder den Titel nennt.
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

export async function loadCatalogEanIndex() {
  const byArticle = new Map();
  const byName = new Map();
  const ambiguousNames = new Set();
  try {
    const snap = await getTenantCollection('stammdaten').limit(400).get();
    snap.forEach((doc) => {
      const data = doc.data() || {};
      const ean = consumerEan(data.ean || data.barcode || (consumerEan(doc.id) ? doc.id : ''));
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
    });
  } catch (err) {
    console.warn('[HofSync] Stammdaten für EAN-Abgleich nicht lesbar:', err);
  }
  ambiguousNames.forEach((folded) => byName.delete(folded));
  return { byArticle, byName };
}
