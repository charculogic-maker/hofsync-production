/**
 * Keyword-basierte MHD-/Wareneingang-Kategorie-Erkennung.
 * Neue Erkennungs-Tags werden als Kategorien angelegt, falls noch nicht vorhanden.
 */

export const MHD_CANONICAL_CATEGORY_LABELS = {
  frische: '🍎 Frische',
  mopro: '🥛MoPro',
  kuehlware: '🥗 Kühlware',
  fleischWurst: '🥩 Fleisch/Wurst',
  feinkost: '🍽️ Feinkost',
  konserven: '🥫 Konserven',
  suesswaren: '🍫 Süßwaren & Schokolade',
  tk: '🧊 TK',
  trockenware: '📦 Trockenware',
  gewuerze: '🌿 Gewürze',
  getraenke: '🍺 Getränke',
};

/** Standard-Liste für Wareneingang (inkl. erweiterter Tags). */
export const DEFAULT_RECEIVING_CATEGORY_OPTIONS = [
  { value: MHD_CANONICAL_CATEGORY_LABELS.frische, label: '🍎 Frische' },
  { value: MHD_CANONICAL_CATEGORY_LABELS.mopro, label: '🥛 MoPro' },
  { value: MHD_CANONICAL_CATEGORY_LABELS.kuehlware, label: '❄️ Kühlware' },
  { value: MHD_CANONICAL_CATEGORY_LABELS.fleischWurst, label: '🥩 Fleisch/Wurst' },
  { value: MHD_CANONICAL_CATEGORY_LABELS.feinkost, label: '🍽️ Feinkost' },
  { value: MHD_CANONICAL_CATEGORY_LABELS.konserven, label: '🥫 Konserven' },
  { value: MHD_CANONICAL_CATEGORY_LABELS.suesswaren, label: '🍫 Süßwaren & Schokolade' },
  { value: MHD_CANONICAL_CATEGORY_LABELS.tk, label: '🧊 TK' },
  { value: MHD_CANONICAL_CATEGORY_LABELS.getraenke, label: '🍺 Getränke' },
  { value: MHD_CANONICAL_CATEGORY_LABELS.trockenware, label: '📦 Trockenware' },
  { value: MHD_CANONICAL_CATEGORY_LABELS.gewuerze, label: '🌿 Gewürze' },
];

/**
 * Reihenfolge zählt: spezifischere Regeln (Süßwaren, Konserven, MoPro) vor Trockenware.
 * @type {Array<{ category: string, test: RegExp }>}
 */
export const MHD_CATEGORY_KEYWORD_RULES = [
  {
    category: MHD_CANONICAL_CATEGORY_LABELS.suesswaren,
    test: /schokolade|schoko|praline|riegel|keks|cookie|bonbon|gummibaer|gummibär|lakritz|nougat|marzipan|kuvertüre|kuvertuere/,
  },
  {
    category: MHD_CANONICAL_CATEGORY_LABELS.konserven,
    test: /\bdose\b|dosenware|passata|eingelegt|im glas|gefluegel im glas|geflügel im glas|konserve|einmach/,
  },
  {
    category: MHD_CANONICAL_CATEGORY_LABELS.mopro,
    test: /joghurt|jogurt|quark|topfen|skyr|kefir|lassi|ayran|sahne|schmand|butter|feta|frischkaese|frischkase|weichkaese|weichkase|kaese|kase|mozzarella|ricotta|mascarpone|brie|camembert|molkerei|mopro/,
  },
  {
    category: MHD_CANONICAL_CATEGORY_LABELS.mopro,
    test: /(^|[^a-z0-9])(h-?milch|frischmilch|frische milch|fettarme milch|alpenmilch|heumilch|weidemilch|vollmilch|milch|kakao-milch|schokoladen-milch|milch alternative)([^a-z0-9]|$)/,
  },
  {
    category: MHD_CANONICAL_CATEGORY_LABELS.fleischWurst,
    test: /fleisch|wurst|salami|schinken|speck|leberkaes|leberkäs|lyoner|bratwurst|mettwurst|aufschnitt|gefluegel|geflügel|pute|hähnchen|haehnchen|hackfleisch/,
  },
  {
    category: MHD_CANONICAL_CATEGORY_LABELS.feinkost,
    test: /feinkost|antipasti|oliven|pesto|hummus|aufstrich|delikatess|tapenade|aioli|remoulade/,
  },
  {
    category: MHD_CANONICAL_CATEGORY_LABELS.getraenke,
    test: /getraenk|getränk|saft|limonade|schorle|wasser|cola|bier|wein|sekt|sprudel|tee getraenk|eistee/,
  },
  {
    category: MHD_CANONICAL_CATEGORY_LABELS.frische,
    test: /gemuese|gemüse|salat|kraeuter|kräuter|obst|frucht|beere|frische/,
  },
  {
    category: MHD_CANONICAL_CATEGORY_LABELS.tk,
    test: /\btk\b|tiefkuehl|tiefkühl|gefrier/,
  },
  {
    category: MHD_CANONICAL_CATEGORY_LABELS.gewuerze,
    test: /gewuerz|gewürz|pfeffer|salz|curry|paprika pulver|zimt/,
  },
];

export function normalizeTextForCategoryMatch(value = '') {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss');
}

/**
 * Erkennt eine Kategorie aus Produktname und optionalem Lieferanten-/Kategorietext.
 * @param {string} productName
 * @param {string} [supplierOrCategoryHint]
 * @returns {string|null} Canonical category label or null
 */
export function detectCategoryFromKeywords(productName = '', supplierOrCategoryHint = '') {
  const haystack = normalizeTextForCategoryMatch(`${productName} ${supplierOrCategoryHint}`);
  if (!haystack.trim()) return null;

  // Trockenware-Ausnahmen: Milchschokolade / Milchreis nicht als MoPro
  const looksLikeDryMilkChocolate = /(^|[^a-z0-9])(vollmilch|milch)([^a-z0-9].*)?(schoko|schokolade|kuvert|waffel|keks|cookie|osterei|osterhase|baumkuchen|muesli|nuss|nougat|riegel|marzipan|praline|lolly|dattel|cashew|kern)/.test(haystack)
    || /(schoko|schokolade|kuvert|waffel|keks|cookie|osterei|osterhase|baumkuchen|muesli|nuss|nougat|riegel|marzipan|praline|lolly|dattel|cashew|kern).*(^|[^a-z0-9])(vollmilch|milch)([^a-z0-9]|$)/.test(haystack);
  const looksLikeDryRice = /milchreis.*(rundkorn|reis|weiss|weiss)/.test(haystack);
  if (looksLikeDryMilkChocolate) return MHD_CANONICAL_CATEGORY_LABELS.suesswaren;
  if (looksLikeDryRice) return MHD_CANONICAL_CATEGORY_LABELS.trockenware;

  for (const rule of MHD_CATEGORY_KEYWORD_RULES) {
    if (rule.test.test(haystack)) return rule.category;
  }
  return null;
}

/**
 * Stellt sicher, dass eine erkannte Kategorie in der Options-Liste existiert.
 * @param {Array<{ value: string, label?: string }>} categories
 * @param {string} categoryValue
 * @returns {Array<{ value: string, label: string }>}
 */
export function ensureCategoryInList(categories = [], categoryValue = '') {
  const value = String(categoryValue || '').trim();
  if (!value) return [...categories];
  const list = Array.isArray(categories) ? [...categories] : [];
  if (list.some((entry) => String(entry?.value || '').trim() === value)) return list;
  list.push({ value, label: value });
  return list;
}
