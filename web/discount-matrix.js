/**
 * Mandanten-Rabattstaffel für den MHD-Monitor.
 * Firestore: tenants/{tenantId}/settings/discount_matrix
 */

import { canonicalTenantId, getNamedTenantCollection } from './tenant-db.js';

export const DISCOUNT_MATRIX_DOC_ID = 'discount_matrix';

export const DISCOUNT_CATEGORY_OPTIONS = Object.freeze([
  { id: '', label: 'Standard (Alle Warengruppen)' },
  { id: 'MoPro & Kühlware', label: 'MoPro & Kühlware' },
  { id: 'Milch', label: 'Milch (Sonderstaffel)' },
  { id: 'Fleisch', label: 'Fleisch' },
  { id: 'Trockenware', label: 'Trockenware' },
]);

export function stickerBadgeText(percent) {
  return `🏷️ -${percent} % Aufkleber`;
}

export function defaultMilkRules() {
  return [
    { daysRemainingMax: 0, discountPercent: 20, badgeText: stickerBadgeText(20) },
    { daysRemainingMax: 1, discountPercent: 10, badgeText: stickerBadgeText(10) },
  ];
}

function foldText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Kategorie „Milch“ oder Artikelname mit Milch / Frischmilch / Vollmilch / Rohmilch. */
export function isMilkArticle(category = '', articleName = '') {
  const pattern = /frischmilch|vollmilch|rohmilch|(^|[^a-z])milch([^a-z]|$)/;
  return pattern.test(foldText(category)) || pattern.test(foldText(articleName));
}

const memoryCache = new Map();

function storageKey(tenantId) {
  return `charculogic_discount_matrix_${canonicalTenantId(tenantId)}`;
}

function cloneMatrix(matrix) {
  return JSON.parse(JSON.stringify(matrix));
}

export function getDefaultDiscountMatrix() {
  return {
    enabled: true,
    defaultRules: [
      { daysRemainingMax: 0, discountPercent: 50, badgeText: stickerBadgeText(50) },
      { daysRemainingMax: 1, discountPercent: 30, badgeText: stickerBadgeText(30) },
      { daysRemainingMax: 2, discountPercent: 20, badgeText: stickerBadgeText(20) },
      { daysRemainingMax: 3, discountPercent: 10, badgeText: stickerBadgeText(10) },
    ],
    categoryOverrides: {
      Milch: defaultMilkRules(),
    },
    rounding: 'commercial_cent',
    updatedAt: '',
    updatedBy: '',
  };
}

function finiteNumber(value) {
  const number = typeof value === 'string'
    ? Number(String(value).trim().replace(',', '.'))
    : Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeRule(rule = {}) {
  const daysRemainingMax = finiteNumber(rule.daysRemainingMax);
  const discountPercent = finiteNumber(rule.discountPercent);
  if (daysRemainingMax == null || discountPercent == null) return null;
  const percent = Math.min(100, Math.max(0, Math.round(discountPercent)));
  const badgeText = stickerBadgeText(percent);
  return {
    daysRemainingMax: Math.round(daysRemainingMax),
    discountPercent: percent,
    badgeText,
  };
}

function normalizeRules(rules) {
  if (!Array.isArray(rules)) return [];
  return rules
    .map(normalizeRule)
    .filter(Boolean)
    .sort((left, right) => left.daysRemainingMax - right.daysRemainingMax);
}

function stampToIso(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }
  return '';
}

export function normalizeDiscountMatrix(raw = {}) {
  const fallback = getDefaultDiscountMatrix();
  const overrides = {};
  const source = raw?.categoryOverrides && typeof raw.categoryOverrides === 'object'
    ? raw.categoryOverrides
    : {};
  Object.entries(source).forEach(([key, rules]) => {
    const name = String(key || '').trim();
    const normalized = normalizeRules(rules);
    if (name && normalized.length) overrides[name] = normalized;
  });
  if (!overrides.Milch) overrides.Milch = defaultMilkRules();
  const defaultRules = Array.isArray(raw?.defaultRules)
    ? normalizeRules(raw.defaultRules)
    : fallback.defaultRules;
  return {
    enabled: raw?.enabled !== false,
    defaultRules,
    categoryOverrides: overrides,
    rounding: 'commercial_cent',
    updatedAt: stampToIso(raw?.updatedAt),
    updatedBy: String(raw?.updatedBy || ''),
  };
}

function readLocalMatrix(tenantId) {
  try {
    const raw = localStorage.getItem(storageKey(tenantId));
    if (!raw) return null;
    return normalizeDiscountMatrix(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeLocalMatrix(tenantId, matrix) {
  try {
    localStorage.setItem(storageKey(tenantId), JSON.stringify(matrix));
  } catch {
    /* private mode */
  }
}

function rememberMatrix(tenantId, matrix) {
  const normalized = normalizeDiscountMatrix(matrix);
  memoryCache.set(canonicalTenantId(tenantId), normalized);
  writeLocalMatrix(tenantId, normalized);
  return cloneMatrix(normalized);
}

export function getActiveDiscountMatrix(tenantId = '') {
  const id = canonicalTenantId(tenantId);
  if (id && memoryCache.has(id)) return cloneMatrix(memoryCache.get(id));
  if (id) {
    const cached = readLocalMatrix(id);
    if (cached) {
      memoryCache.set(id, cached);
      return cloneMatrix(cached);
    }
  }
  return getDefaultDiscountMatrix();
}

export async function loadDiscountMatrix(tenantId) {
  const id = canonicalTenantId(tenantId);
  if (!id) return getDefaultDiscountMatrix();
  const cached = getActiveDiscountMatrix(id);
  try {
    const snap = await getNamedTenantCollection(id, 'settings').doc(DISCOUNT_MATRIX_DOC_ID).get();
    if (!snap.exists) return cached;
    return rememberMatrix(id, snap.data() || {});
  } catch (err) {
    console.warn('[CharcuLogic Rabatt] Matrix konnte nicht geladen werden:', err);
    return cached;
  }
}

function resolveOverrideKey(category = '') {
  const text = String(category || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (/frischmilch|vollmilch|rohmilch|(^|[^a-z])milch([^a-z]|$)/.test(text)) return 'Milch';
  if (/fleisch|wurst|aufschnitt/.test(text)) return 'Fleisch';
  if (/trocken|konserve|gewuerz|getraenk|\btk\b|tiefk/.test(text)) return 'Trockenware';
  if (/mopro|kuh?l|kae?se|molke/.test(text)) return 'MoPro & Kühlware';
  return '';
}

function rulesForCategory(matrix, category, articleName = '') {
  if (isMilkArticle(category, articleName)) {
    const milk = matrix.categoryOverrides?.Milch;
    if (Array.isArray(milk) && milk.length) return milk;
    return defaultMilkRules();
  }
  const key = resolveOverrideKey(category);
  const override = key ? matrix.categoryOverrides?.[key] : null;
  if (Array.isArray(override) && override.length) return override;
  return matrix.defaultRules || [];
}

function pickStrictestRule(rules, daysRemaining) {
  return rules
    .filter((rule) => daysRemaining <= rule.daysRemainingMax)
    .sort((left, right) => left.daysRemainingMax - right.daysRemainingMax)[0] || null;
}

export function roundCommercialCent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  const sign = number < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(number) * 100)) / 100;
}

export function calculateDiscount(originalPrice, daysRemaining, category, tenantId = '', articleName = '') {
  const empty = {
    hasDiscount: false,
    discountPercent: 0,
    discountedPrice: roundCommercialCent(originalPrice),
    badgeText: '',
  };
  const days = Number(daysRemaining);
  if (!Number.isFinite(days) || days < 0) return empty;
  const matrix = getActiveDiscountMatrix(tenantId);
  if (matrix.enabled === false) return empty;
  const rule = pickStrictestRule(rulesForCategory(matrix, category, articleName), days);
  if (!rule || rule.discountPercent <= 0) return empty;
  const price = finiteNumber(originalPrice);
  const discountedPrice = price == null
    ? 0
    : roundCommercialCent(price * (1 - rule.discountPercent / 100));
  return {
    hasDiscount: true,
    discountPercent: rule.discountPercent,
    discountedPrice,
    badgeText: stickerBadgeText(rule.discountPercent),
  };
}

export async function saveDiscountMatrix(tenantId, matrixData) {
  const id = canonicalTenantId(tenantId);
  if (!id) throw new Error('Kein Betrieb gewählt.');
  const matrix = rememberMatrix(id, {
    ...matrixData,
    updatedAt: new Date().toISOString(),
  });
  await getNamedTenantCollection(id, 'settings').doc(DISCOUNT_MATRIX_DOC_ID).set(matrix, { merge: true });
  return matrix;
}
