/** Shared text helpers for shopfloor UI and imports. */

const HTML_ENTITY_MAP = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  auml: 'ä',
  Auml: 'Ä',
  ouml: 'ö',
  Ouml: 'Ö',
  uuml: 'ü',
  Uuml: 'Ü',
  szlig: 'ß',
  eacute: 'é',
  Eacute: 'É',
};

function decodeHtmlEntities(value = '') {
  return String(value).replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (match, entity) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return Object.prototype.hasOwnProperty.call(HTML_ENTITY_MAP, entity)
      ? HTML_ENTITY_MAP[entity]
      : match;
  });
}

/**
 * Bereinigt Produktnamen aus OCR/Importen (Encoding-Artefakte, fehlende Umlaute).
 * @param {unknown} str
 * @returns {string}
 */
export function sanitizeProductName(str) {
  if (str == null) return '';
  let text = decodeHtmlEntities(String(str)).trim();
  if (!text) return '';

  text = text
    .replace(/\uFFFD/g, '')
    .replace(/Ã¤/g, 'ä')
    .replace(/Ã¶/g, 'ö')
    .replace(/Ã¼/g, 'ü')
    .replace(/Ã„/g, 'Ä')
    .replace(/Ã–/g, 'Ö')
    .replace(/Ãœ/g, 'Ü')
    .replace(/ÃŸ/g, 'ß')
    .replace(/Ã©/g, 'é')
    .replace(/Ã¡/g, 'á');

  text = text
    .replace(/([A-Za-zÄÖÜäöüß])"l\b/g, '$1öl')
    .replace(/([A-Za-zÄÖÜäöüß])'l\b/g, '$1öl')
    .replace(/([A-Za-zÄÖÜäöüß])`l\b/g, '$1öl');

  text = text
    .replace(/\ba\*(?=[A-Za-zÄÖÜäöüß])/g, 'ä')
    .replace(/\bo\*(?=[A-Za-zÄÖÜäöüß])/g, 'ö')
    .replace(/\bu\*(?=[A-Za-zÄÖÜäöüß])/g, 'ü')
    .replace(/\be\*(?=[A-Za-zÄÖÜäöüß])/g, 'ë')
    .replace(/\bA\*(?=[A-Za-zÄÖÜäöüß])/g, 'Ä')
    .replace(/\bO\*(?=[A-Za-zÄÖÜäöüß])/g, 'Ö')
    .replace(/\bU\*(?=[A-Za-zÄÖÜäöüß])/g, 'Ü')
    .replace(/\bb\*(?=[A-Za-zÄÖÜäöüß])/g, 'Bio ')
    .replace(/\bB\*(?=[A-Za-zÄÖÜäöüß])/g, 'Bio ');

  text = text
    .replace(/k\u0084se/gi, 'käse')
    .replace(/Grie\u00e1/gi, 'Grieß')
    .replace(/S\u00fc\u00e1/gi, 'Süß')
    .replace(/Affin\u201a/gi, 'Affiné')
    .replace(/\u0084/g, 'ä')
    .replace(/\u201a/g, '');

  // OCR/Import: áe / á stehen für ß (Weiáenhorner -> Weißenhorner)
  text = text.replace(/[áÁ]/g, 'ß');

  return text.replace(/\s+/g, ' ').trim();
}

const GRAMMAGE_PATTERN = /\b(\d+(?:[.,]\d+)?\s?(?:g|kg|ml|l|ltr|cl))\b/i;
const PRODUCT_FAMILY_HINTS = [
  { family: 'Schokolade', pattern: /\b(schokolade|schoko|karamell|krachnuss|nougat|zartbitter|vollmilch|nirwana|caramel|himbeere|studentenfutter|rum\s*traube|mond|tiger|rumba|faire|bionella|samba)\b/i },
  { family: 'Müsli', pattern: /\b(m[üu]sli|krachnuss)\b/i },
  { family: 'Creme', pattern: /\b(creme|mus|butter|aufstrich|samba)\b/i },
];

const SINGLE_SORT_CHOCOLATE_NAMES = new Set([
  'karamell', 'krachnuss', 'mond', 'tiger', 'rumba', 'faire', 'bionella', 'nirwana', 'samba',
]);

function normalizeCompareText(value = '') {
  return String(value || '').trim().toLowerCase();
}

/**
 * Extrahiert Grammatur/Einheit aus Produkttext.
 * @param {unknown} value
 * @returns {{ label: string, remainder: string }}
 */
export function extractProductGrammageLabel(value = '') {
  const text = sanitizeProductName(value);
  if (!text) return { label: '', remainder: '' };
  const match = text.match(GRAMMAGE_PATTERN);
  if (!match) return { label: '', remainder: text };
  const label = match[1].replace(/\s+/g, '').replace(',', '.');
  const remainder = text.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
  return { label, remainder };
}

function nameIncludesBrand(name = '', brand = '') {
  const normalizedName = normalizeCompareText(name);
  const normalizedBrand = normalizeCompareText(brand);
  return Boolean(normalizedBrand && normalizedName.includes(normalizedBrand));
}

function countMeaningfulNameTokens(name = '') {
  return String(name || '')
    .split(/[\s,–\-\/+&]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .length;
}

function inferProductFamily(name = '', category = '') {
  const lower = normalizeCompareText(name);
  const categoryLower = normalizeCompareText(category);
  if (/\b(schokolade|schoko)\b/i.test(lower)) return '';
  for (const hint of PRODUCT_FAMILY_HINTS) {
    if (hint.pattern.test(lower)) return hint.family;
  }
  if (categoryLower.includes('trocken') && SINGLE_SORT_CHOCOLATE_NAMES.has(lower)) {
    return 'Schokolade';
  }
  return '';
}

function isAmbiguousSortName(name = '', brand = '') {
  const clean = sanitizeProductName(name);
  if (!clean || normalizeCompareText(clean) === 'unbekannt') return false;
  if (nameIncludesBrand(clean, brand)) return false;

  const { remainder } = extractProductGrammageLabel(clean);
  const baseName = remainder || clean;
  const tokens = countMeaningfulNameTokens(baseName);
  if (tokens <= 1) return true;

  const lower = normalizeCompareText(baseName);
  if (tokens === 2 && SINGLE_SORT_CHOCOLATE_NAMES.has(lower.split(/\s+/)[0])) {
    return !/\b(schokolade|schoko|m[üu]sli|creme|mus|butter)\b/i.test(lower);
  }
  return false;
}

/**
 * Baut einen eindeutigen Anzeigen-Titel inkl. optionaler Grammatur.
 * @param {object} item
 * @returns {{ title: string, grammageBadge: string }}
 */
export function composeProductDisplayTitle(item = {}) {
  const brand = sanitizeProductName(item.brand || item.marke || '');
  const rawName = sanitizeProductName(item.name || item.produkt || item.product || '');
  const { label: grammageFromName, remainder: nameWithoutGrammage } = extractProductGrammageLabel(rawName);
  const baseName = nameWithoutGrammage || rawName;
  let title = baseName || 'Unbekannt';

  if (brand && !nameIncludesBrand(title, brand)) {
    if (isAmbiguousSortName(baseName, brand)) {
      const family = inferProductFamily(baseName, item.kategorie || item.category || item.warenKategorie || '');
      title = family ? `${brand} ${family} ${baseName}` : `${brand} - ${baseName}`;
    } else if (countMeaningfulNameTokens(baseName) <= 2) {
      title = `${brand} ${baseName}`;
    }
  }

  const grammageBadge = grammageFromName
    || extractProductGrammageLabel(item.vpeInhalt || item.einheit || '').label
    || '';

  return {
    title: sanitizeProductName(title),
    grammageBadge,
  };
}
