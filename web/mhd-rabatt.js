/**
 * MHD-Rabattvorschläge je Warenkategorie (Hofladen).
 *
 * Frischmilch: 1 Tag vorher 10 %, am MHD-Tag 20 %, sonst kein Rabatt.
 * Pasteurisierte Milch und übrige kühlpflichtige Ware (MoPro/Kühlware):
 * 2 Tage vorher 10 %, 1 Tag vorher 20 %, am MHD-Tag 50 %.
 */

const MHD_MOPRO_CATEGORY = '🥛MoPro';
const MHD_KUEHLWARE_CATEGORY = '🥗 Kühlware';
const MHD_TROCKEN_CATEGORY = '📦 Trockenware';

export const MHD_ACTION_SEVERITY = ['tonne', 'rabatt50', 'rabatt30', 'rabatt20', 'rabatt10', 'pruefen'];

export const MHD_ACTION_STYLES = {
  tonne: { label: '🗑️ ABSCHREIBEN / TONNE', color: '#F44336', bg: 'rgba(244, 67, 54, 0.14)' },
  rabatt50: { label: '🔥 50% RABATT', color: '#EF6C00', bg: 'rgba(239, 108, 0, 0.14)' },
  rabatt30: { label: '🏷️ 30% RABATT', color: '#F57F17', bg: 'rgba(245, 127, 23, 0.14)' },
  rabatt20: { label: '🏷️ 20% RABATT', color: '#F57F17', bg: 'rgba(245, 127, 23, 0.14)' },
  rabatt10: { label: '🏷️ 10% RABATT', color: '#F9A825', bg: 'rgba(249, 168, 37, 0.14)' },
  pruefen: { label: '👀 PRÜFEN', color: '#1565C0', bg: 'rgba(21, 101, 192, 0.14)' },
  ok: { label: '✅ OK (Regal)', color: '#2E7D32', bg: 'rgba(46, 125, 50, 0.14)' },
};

const MHD_KUEHLPFLICHTIG_RABATT = {
  rabatt10: 2,
  rabatt20: 1,
  rabatt50: 0,
  tonne: -1,
};

export const MHD_FRISCHMILCH_RABATT = {
  rabatt10: 1,
  rabatt20: 0,
  tonne: -1,
};

export const MHD_RABATT_MATRIX = {
  '🍎 Frische': { pruefen: 2, rabatt30: 1, rabatt50: 0, tonne: -1 },
  [MHD_MOPRO_CATEGORY]: MHD_KUEHLPFLICHTIG_RABATT,
  [MHD_KUEHLWARE_CATEGORY]: MHD_KUEHLPFLICHTIG_RABATT,
  '🧊 TK': { pruefen: 14, rabatt30: 7, rabatt50: 3, tonne: -1 },
  [MHD_TROCKEN_CATEGORY]: { pruefen: 30, rabatt30: 2, rabatt50: 1, tonne: -1 },
  '🌿 Gewürze': { pruefen: 60, rabatt30: 30, rabatt50: 14, tonne: -1 },
  '🍺 Getränke': { pruefen: 14, rabatt30: 7, rabatt50: 3, tonne: -1 },
};

const FRISCHMILCH_EXCLUDE_RE = /(joghurt|jogurt|quark|topfen|skyr|kefir|lassi|ayran|sahne|schmand|butter|frischkaese|frischkase|weichkaese|weichkase|kaese|kase|mozzarella|ricotta|mascarpone|brie|camembert|feta|pudding|milchreis|schoko|kakao|nougat|praline|riegel|waffel|keks|cookie|creme|aufstrich|hafermilch|mandelmilch|sojamilch|reisdrink|pflanzendrink|milch alternative|milchmix|mischgetraenk)/;
const PASTEURIZED_OR_UHT_RE = /(^|[^a-z0-9])(h-?milch|esl)([^a-z0-9]|$)|haltbare milch|uperisiert|ultrahocherhitzt|\buht\b|pasteurisiert|langer haltbar|laenger haltbar|laengerfrisch/;
const FRISCHMILCH_NAME_RE = /(frischmilch|frische milch|rohmilch|vorzugsmilch|vollmilch|fettarme milch|alpenmilch|heumilch|weidemilch|landmilch|hofmilch)/;
const DRINKING_MILK_TOKEN_RE = /(^|[^a-z0-9])milch([^a-z0-9]|$)/;

export function normalizeMhdRabattText(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss');
}

export function isFrischmilchProduct(prod = {}, category = '') {
  const resolvedCategory = String(category || prod.kategorie || prod.category || prod.warenKategorie || '').trim();
  if (resolvedCategory !== MHD_MOPRO_CATEGORY) return false;

  const name = normalizeMhdRabattText(prod.name || prod.produkt || prod.product || '');
  if (!name) return false;
  if (FRISCHMILCH_EXCLUDE_RE.test(name)) return false;
  if (PASTEURIZED_OR_UHT_RE.test(name)) return false;
  return FRISCHMILCH_NAME_RE.test(name) || DRINKING_MILK_TOKEN_RE.test(name);
}

export function getMhdRabattRules(category, prod = {}) {
  if (isFrischmilchProduct(prod, category)) return MHD_FRISCHMILCH_RABATT;
  return MHD_RABATT_MATRIX[category] || MHD_RABATT_MATRIX[MHD_MOPRO_CATEGORY];
}

export function resolveMhdActionKey(category, tage, prod = {}) {
  const days = Number(tage);
  if (!Number.isFinite(days)) return 'ok';
  const rules = getMhdRabattRules(category, prod);
  for (const key of MHD_ACTION_SEVERITY) {
    if (!Number.isFinite(rules[key])) continue;
    if (days <= rules[key]) return key;
  }
  return 'ok';
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
  if (actionKey === 'pruefen' && category === MHD_TROCKEN_CATEGORY) {
    return { label: '📦 SONDERFLÄCHE / 20%', color: '#F57F17', bg: 'rgba(245, 127, 23, 0.14)' };
  }
  return MHD_ACTION_STYLES[actionKey] || MHD_ACTION_STYLES.ok;
}

export function getMhdActionShortLabel(actionKey, category) {
  const shortLabels = {
    tonne: 'Abschreiben',
    rabatt50: '50%',
    rabatt30: '30%',
    rabatt20: '20%',
    rabatt10: '10%',
    pruefen: category === MHD_TROCKEN_CATEGORY ? '20%' : 'Prüfen',
    ok: 'OK',
  };
  return shortLabels[actionKey] || getMhdActionStyle(actionKey, category).label;
}
