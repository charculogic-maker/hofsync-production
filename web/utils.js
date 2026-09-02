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
    .replace(/Ã©/g, 'é');

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

  return text.replace(/\s+/g, ' ').trim();
}
