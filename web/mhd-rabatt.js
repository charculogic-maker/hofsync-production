/**
 * MHD-Rabattvorschläge je Produkttyp (Hofladen).
 *
 * Spezifische Produktregeln (Frischmilch) gewinnen immer vor Kategorie-Regeln.
 *
 * FRISCHMILCH: 1 Tag vorher 10 %, MHD-Tag 20 %, sonst 0 %.
 * TROCKENWARE / KONSERVEN / TK / GEWÜRZE / GETRÄNKE:
 *   >5 Tage 0 %, 3–5 Tage 20 %, 1–2 Tage / MHD-Tag 50 %.
 * FRISCHE / FLEISCH / WURST: 2–3 Tage 20 %, 1 Tag / MHD-Tag 50 %.
 * MOPRO / KÄSE: 2–4 Tage 20 %, 1 Tag / MHD-Tag 50 %.
 */

const MHD_MOPRO_CATEGORY = '🥛MoPro';
const MHD_KUEHLWARE_CATEGORY = '🥗 Kühlware';
const MHD_FRISCHE_CATEGORY = '🍎 Frische';
const MHD_TROCKEN_CATEGORY = '📦 Trockenware';
const MHD_TK_CATEGORY = '🧊 TK';
const MHD_GEWUERZE_CATEGORY = '🌿 Gewürze';
const MHD_GETRAENKE_CATEGORY = '🍺 Getränke';

export const MHD_ACTION_SEVERITY = ['tonne', 'rabatt50', 'rabatt30', 'rabatt20', 'rabatt10', 'pruefen'];

export const MHD_ACTION_STYLES = {
  tonne: { label: '🗑️ ABSCHREIBEN / TONNE', color: '#F44336', bg: 'rgba(244, 67, 54, 0.14)' },
  rabatt50: { label: '🔥 50% RABATT', color: '#EF6C00', bg: 'rgba(239, 108, 0, 0.14)' },
  rabatt30: { label: '🏷️ 30% RABATT', color: '#F57F17', bg: 'rgba(245, 127, 23, 0.14)' },
  rabatt20: { label: '🏷️ 20% RABATT', color: '#F57F17', bg: 'rgba(245, 127, 23, 0.14)' },
  rabatt10: { label: '🏷️ 10% RABATT', color: '#F9A825', bg: 'rgba(249, 168, 37, 0.16)' },
  pruefen: { label: '👀 PRÜFEN', color: '#1565C0', bg: 'rgba(21, 101, 192, 0.14)' },
  ok: { label: 'Regulär', color: '#6B7280', bg: 'rgba(107, 114, 128, 0.08)' },
};

/** Bekannte Frischmilch-EANs (Demeter/Hof-Flaschen). */
export const FRISCHMILCH_EANS = new Set([
  '4035626114608', // b*Vollmilch Demeter 3,8% Flasche
  '4035626114622', // b*Milch Demeter 1,5% Flasche
  '4035626100274', // b*Vollmilch 3,7% Karton
]);

const FRISCHMILCH_EXCLUDE_RE = /(joghurt|jogurt|quark|topfen|skyr|kefir|lassi|ayran|sahne|schmand|butter|frischkaese|frischkase|weichkaese|weichkase|kaese|kase|mozzarella|ricotta|mascarpone|brie|camembert|feta|pudding|milchreis|schoko|kakao|nougat|praline|riegel|waffel|keks|cookie|creme|aufstrich|hafermilch|mandelmilch|sojamilch|reisdrink|pflanzendrink|milch alternative|milchmix|mischgetraenk|kuvertuere|kuverture)/;
const PASTEURIZED_OR_UHT_RE = /(^|[^a-z0-9])(h-?milch|esl)([^a-z0-9]|$)|haltbare milch|uperisiert|ultrahocherhitzt|\buht\b|pasteurisiert|langer haltbar|laenger haltbar|laengerfrisch/;
const FRISCHMILCH_NAME_RE = /(frischmilch|frische milch|vollmilch frisch|rohmilch|vorzugsmilch|vollmilch|fettarme milch|alpenmilch|heumilch|weidemilch|landmilch|hofmilch)/;
const DRINKING_MILK_TOKEN_RE = /(^|[^a-z0-9])milch([^a-z0-9]|$)/;
const KAESE_RE = /(kaese|kase|käse|gouda|emmentaler|camembert|brie|feta|mozzarella|bergkaese|schnittkaese|weichkaese|frischkaese|ricotta|mascarpone|parmesan|cheddar|tilsiter|butterkaese)/;
const FLEISCH_WURST_RE = /(fleisch|wurst|schinken|salami|mortadella|bratwurst|leberwurst|mettwurst|hackfleisch|schnitzel|steak|filet|brust|keule|rippchen|bacon|speck|aufschnitt|wurstwaren)/;
const KONSERVEN_RE = /(konserve|glas|eingelegt|marmelade|konfituere|konfitüre|aufstrich|schoko|keks|cookie|gebaeck|gebäck|riegel|nussmus|honig)/;

export function normalizeMhdRabattText(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss');
}

function getProductIdentity(prod = {}) {
  const name = normalizeMhdRabattText(prod.name || prod.produkt || prod.product || '');
  const ean = String(prod.ean || prod.barcode || prod.gtin || '').replace(/\D/g, '');
  return { name, ean };
}

export function isFrischmilchProduct(prod = {}, category = '') {
  const { name, ean } = getProductIdentity(prod);
  if (ean && FRISCHMILCH_EANS.has(ean)) {
    if (name && FRISCHMILCH_EXCLUDE_RE.test(name)) return false;
    return true;
  }

  const resolvedCategory = String(category || prod.kategorie || prod.category || prod.warenKategorie || '').trim();
  const isMoproFamily = !resolvedCategory
    || resolvedCategory === MHD_MOPRO_CATEGORY
    || /mopro/i.test(resolvedCategory);
  if (!isMoproFamily) return false;
  if (!name) return false;
  if (FRISCHMILCH_EXCLUDE_RE.test(name)) return false;
  if (PASTEURIZED_OR_UHT_RE.test(name)) return false;
  return FRISCHMILCH_NAME_RE.test(name) || DRINKING_MILK_TOKEN_RE.test(name);
}

/** Alias for callers that use the design-doc name. */
export const isFrischmilch = isFrischmilchProduct;

export function isKaeseProduct(prod = {}, category = '') {
  const resolvedCategory = String(category || prod.kategorie || prod.category || prod.warenKategorie || '').trim();
  if (/kaese|käse/i.test(resolvedCategory)) return true;
  const { name } = getProductIdentity(prod);
  return Boolean(name) && KAESE_RE.test(name);
}

export function isFleischWurstProduct(prod = {}, category = '') {
  const resolvedCategory = String(category || prod.kategorie || prod.category || prod.warenKategorie || '').trim();
  if (/aufschnitt|🥓/i.test(resolvedCategory)) return true;
  const { name } = getProductIdentity(prod);
  return Boolean(name) && FLEISCH_WURST_RE.test(name);
}

export function isTrockenwareOrKonserven(prod = {}, category = '') {
  const resolvedCategory = String(category || prod.kategorie || prod.category || prod.warenKategorie || '').trim();
  // TK / Gewürze / Getränke use the same Rest-MHD matrix as Trockenware / Konserven.
  if (resolvedCategory === MHD_TROCKEN_CATEGORY
    || resolvedCategory === MHD_TK_CATEGORY
    || resolvedCategory === MHD_GEWUERZE_CATEGORY
    || resolvedCategory === MHD_GETRAENKE_CATEGORY
    || /trocken|konserve|tiefkuehl|tiefkühl|\btk\b|gewuerz|gewürz|getraenk|getränk/i.test(resolvedCategory)) {
    return true;
  }
  // Name-based fallback only when category is missing — avoid misrouting MoPro „… Glas“.
  if (resolvedCategory) return false;
  const { name } = getProductIdentity(prod);
  return Boolean(name) && KONSERVEN_RE.test(name);
}

/**
 * Resolve which product-tier rule group applies.
 * Product-specific hits (Frischmilch) always win over category defaults.
 */
export function resolveMhdRabattRuleGroup(prod = {}, category = '') {
  const resolvedCategory = String(category || prod.kategorie || prod.category || prod.warenKategorie || '').trim();

  if (isFrischmilchProduct(prod, resolvedCategory)) return 'frischmilch';

  if (resolvedCategory === MHD_TROCKEN_CATEGORY || isTrockenwareOrKonserven(prod, resolvedCategory)) {
    return 'trockenware';
  }

  if (resolvedCategory === MHD_FRISCHE_CATEGORY
    || isFleischWurstProduct(prod, resolvedCategory)
    || (resolvedCategory === MHD_KUEHLWARE_CATEGORY && !isKaeseProduct(prod, resolvedCategory))) {
    return 'frische';
  }

  // MoPro, Käse, and unknown chilled dairy fall through here.
  return 'mopro';
}

/**
 * Product-tier discount percent for remaining MHD days.
 * @returns {{ percent: number, actionKey: string, ruleGroup: string }}
 */
export function getDiscountForProduct(product = {}, daysRemaining = null) {
  const days = Number(daysRemaining);
  const category = String(product.kategorie || product.category || product.warenKategorie || '').trim();
  const ruleGroup = resolveMhdRabattRuleGroup(product, category);

  if (!Number.isFinite(days)) {
    return { percent: 0, actionKey: 'ok', ruleGroup };
  }
  if (days < 0) {
    return { percent: 0, actionKey: 'tonne', ruleGroup };
  }

  if (ruleGroup === 'frischmilch') {
    if (days === 0) return { percent: 20, actionKey: 'rabatt20', ruleGroup };
    if (days === 1) return { percent: 10, actionKey: 'rabatt10', ruleGroup };
    return { percent: 0, actionKey: 'ok', ruleGroup };
  }

  if (ruleGroup === 'trockenware') {
    if (days <= 2) return { percent: 50, actionKey: 'rabatt50', ruleGroup };
    if (days <= 5) return { percent: 20, actionKey: 'rabatt20', ruleGroup };
    return { percent: 0, actionKey: 'ok', ruleGroup };
  }

  if (ruleGroup === 'frische') {
    if (days <= 1) return { percent: 50, actionKey: 'rabatt50', ruleGroup };
    if (days <= 3) return { percent: 20, actionKey: 'rabatt20', ruleGroup };
    return { percent: 0, actionKey: 'ok', ruleGroup };
  }

  // MOPRO / KÄSE fallback
  if (days <= 1) return { percent: 50, actionKey: 'rabatt50', ruleGroup };
  if (days <= 4) return { percent: 20, actionKey: 'rabatt20', ruleGroup };
  return { percent: 0, actionKey: 'ok', ruleGroup };
}

export function getMhdRabattRules(category, prod = {}) {
  const group = resolveMhdRabattRuleGroup(prod, category);
  if (group === 'frischmilch') {
    return { rabatt10: 1, rabatt20: 0, tonne: -1 };
  }
  if (group === 'trockenware') {
    return { rabatt20: 5, rabatt50: 2, tonne: -1 };
  }
  if (group === 'frische') {
    return { rabatt20: 3, rabatt50: 1, tonne: -1 };
  }
  return { rabatt20: 4, rabatt50: 1, tonne: -1 };
}

export function resolveMhdActionKey(category, tage, prod = {}) {
  const product = {
    ...prod,
    kategorie: category || prod.kategorie || prod.category || '',
  };
  return getDiscountForProduct(product, tage).actionKey;
}

export function mapMhdActionKeyToStatus(actionKey) {
  if (actionKey === 'tonne') return 'expired';
  if (actionKey === 'rabatt50' || actionKey === 'rabatt30' || actionKey === 'rabatt20' || actionKey === 'rabatt10') {
    return 'critical';
  }
  if (actionKey === 'pruefen') return 'warning';
  return 'ok';
}

export function getMhdActionWindowUpperLimit(category, prod = {}) {
  const rules = getMhdRabattRules(category, prod);
  const thresholds = MHD_ACTION_SEVERITY
    .map((key) => rules[key])
    .filter((value) => Number.isFinite(value) && value >= 0);
  return thresholds.length ? Math.max(...thresholds) : 3;
}

export function getMhdActionStyle(actionKey, category) {
  return MHD_ACTION_STYLES[actionKey] || MHD_ACTION_STYLES.ok;
}

export function getMhdActionShortLabel(actionKey, _category) {
  const shortLabels = {
    tonne: 'Abschreiben',
    rabatt50: '50%',
    rabatt30: '30%',
    rabatt20: '20%',
    rabatt10: '10%',
    pruefen: 'Prüfen',
    ok: 'Regulär',
  };
  return shortLabels[actionKey] || getMhdActionStyle(actionKey).label;
}

export function shouldShowMhdPercentBadge(actionKey) {
  return actionKey === 'rabatt50'
    || actionKey === 'rabatt30'
    || actionKey === 'rabatt20'
    || actionKey === 'rabatt10';
}

// Keep percent helper available for UI/tests without re-deriving keys.
export function discountPercentFromActionKey(actionKey) {
  if (actionKey === 'rabatt50') return 50;
  if (actionKey === 'rabatt30') return 30;
  if (actionKey === 'rabatt20') return 20;
  if (actionKey === 'rabatt10') return 10;
  return 0;
}
