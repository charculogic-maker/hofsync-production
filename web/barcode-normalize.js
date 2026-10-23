/**
 * Barcode-/Scan-Normalisierung für Laden-iPhone (EAN/UPC + GS1-128 Umverpackung).
 *
 * GS1-128 auf Kartons enthält oft (01)GTIN + (15)MHD + (10)Charge.
 * Ohne Parsing würden Ziffern-Filter einen langen Ungültig-Code erzeugen.
 */

/** Group Separator (FNC1) in vielen Decoder-Ausgaben. */
const GS = '\u001D';

/** Feste Wertlängen bekannter Application Identifier (ohne AI-Ziffern). */
const GS1_FIXED_LENGTH = Object.freeze({
  '00': 18,
  '01': 14,
  '02': 14,
  '11': 6,
  '12': 6,
  '13': 6,
  '15': 6,
  '17': 6,
  '310': 6,
  '311': 6,
  '312': 6,
  '313': 6,
  '314': 6,
  '315': 6,
  '316': 6,
  '320': 6,
  '330': 6,
  '340': 6,
  '37': 8,
});

/** Variable AIs (Wert bis FNC1/GS oder Stringende). */
const GS1_VARIABLE_PREFIXES = Object.freeze(['10', '21', '22', '240', '241', '250', '251', '400', '401', '420', '421']);

/**
 * @typedef {object} ParsedBarcodeScan
 * @property {string} ean Normalisierte Produkt-/Gebinde-EAN (Ziffern, typ. 8/12/13/14)
 * @property {string} [gtin] Rohe 14-stellige GTIN aus AI (01), falls vorhanden
 * @property {string} [bestBeforeIso] MHD aus AI (15) als YYYY-MM-DD
 * @property {string} [expiryIso] Verfallsdatum aus AI (17) als YYYY-MM-DD
 * @property {string} [lot] Charge/Los aus AI (10)
 * @property {boolean} isGs1
 * @property {string} raw
 */

/**
 * Entfernt AIM-Symbology-Identifier und Klammern-Rauschen.
 * @param {string} raw
 * @returns {string}
 */
function stripAimPrefix(raw) {
  return String(raw || '')
    .trim()
    .replace(/^\u001D+/, '')
    .replace(/^\][A-Za-z0-9]{2}/, '');
}

/**
 * GTIN-14 mit führender 0 → EAN-13 (Handelsüblich in unserem Bestand).
 * @param {string} gtin
 * @returns {string}
 */
export function normalizeGtinToEan(gtin) {
  const digits = String(gtin || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 14 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

/**
 * YYMMDD → YYYY-MM-DD (Lebensmittel-Horizont 2000–2099).
 * @param {string} yymmdd
 * @returns {string}
 */
export function gs1DateToIso(yymmdd) {
  const digits = String(yymmdd || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(digits)) return '';
  const yy = Number(digits.slice(0, 2));
  const mm = Number(digits.slice(2, 4));
  const dd = Number(digits.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return '';
  const year = 2000 + yy;
  const iso = `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  const probe = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(probe.getTime())) return '';
  if (probe.getFullYear() !== year || probe.getMonth() + 1 !== mm || probe.getDate() !== dd) return '';
  return iso;
}

/**
 * Menschlich lesbare GS1-Zeile: (01)…(15)…(10)…
 * @param {string} text
 * @returns {Record<string, string>|null}
 */
function parseParenthesizedGs1(text) {
  if (!/\(\d{2,4}\)/.test(text)) return null;
  /** @type {Record<string, string>} */
  const fields = {};
  const re = /\((\d{2,4})\)([^\()]*)/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const ai = match[1];
    const value = String(match[2] || '').trim();
    if (ai && value) fields[ai] = value;
  }
  return Object.keys(fields).length ? fields : null;
}

/**
 * Nächsten AI am Cursor erkennen (längere Prefixe zuerst).
 * @param {string} payload
 * @param {number} index
 * @returns {{ ai: string, fixedLen: number|null }|null}
 */
function matchAiAt(payload, index) {
  const slice = payload.slice(index);
  for (const ai of Object.keys(GS1_FIXED_LENGTH).sort((a, b) => b.length - a.length)) {
    if (slice.startsWith(ai)) {
      return { ai, fixedLen: GS1_FIXED_LENGTH[ai] };
    }
  }
  for (const ai of [...GS1_VARIABLE_PREFIXES].sort((a, b) => b.length - a.length)) {
    if (slice.startsWith(ai)) {
      return { ai, fixedLen: null };
    }
  }
  // Unbekannter 2-stelliger AI: nur fortsetzen wenn Ziffern folgen
  if (/^\d{2}/.test(slice)) {
    return { ai: slice.slice(0, 2), fixedLen: null };
  }
  return null;
}

/**
 * Konkateniertes GS1 ohne Klammern (Decoder-/Kamera-Ausgabe).
 * @param {string} rawPayload
 * @returns {Record<string, string>|null}
 */
function parseConcatenatedGs1(rawPayload) {
  let payload = stripAimPrefix(rawPayload).replace(/[()]/g, '');
  if (!payload) return null;

  // Häufig: nur Ziffern + Charge mit Buchstaben — GS ggf. als Leerzeichen
  payload = payload.replace(/\s+/g, '');

  // Muss mit bekanntem AI starten (typisch 01 auf Umverpackung)
  if (!/^(00|01|02|10|11|15|17|21)/.test(payload)) {
    return null;
  }

  /** @type {Record<string, string>} */
  const fields = {};
  let i = 0;
  let guard = 0;
  while (i < payload.length && guard < 32) {
    guard += 1;
    if (payload[i] === GS) {
      i += 1;
      continue;
    }
    const matched = matchAiAt(payload, i);
    if (!matched) break;
    const { ai, fixedLen } = matched;
    i += ai.length;
    if (fixedLen != null) {
      const value = payload.slice(i, i + fixedLen);
      if (value.length < fixedLen) break;
      fields[ai] = value;
      i += fixedLen;
      continue;
    }
    let end = payload.indexOf(GS, i);
    if (end < 0) {
      // Variable AI am Ende: Rest übernehmen, aber vor nächstem festen AI abschneiden falls erkennbar
      let rest = payload.slice(i);
      const nextFixed = rest.search(/(?=\d{2})(?:01|02|11|15|17)(?=\d)/);
      // Bei Charge am Ende ist oft kein weiterer AI — Rest ist der Wert
      if (ai === '10' || ai === '21' || nextFixed < 0) {
        fields[ai] = rest;
        i = payload.length;
      } else {
        fields[ai] = rest.slice(0, nextFixed);
        i += nextFixed;
      }
      continue;
    }
    fields[ai] = payload.slice(i, end);
    i = end + 1;
  }

  return fields['01'] || fields['00'] || fields['02'] ? fields : null;
}

/**
 * @param {Record<string, string>} fields
 * @param {string} raw
 * @returns {ParsedBarcodeScan}
 */
function fieldsToParsed(fields, raw) {
  const gtinRaw = String(fields['01'] || '').replace(/\D/g, '');
  const ean = normalizeGtinToEan(gtinRaw) || String(fields['01'] || '').replace(/\D/g, '');
  const bestBeforeIso = gs1DateToIso(fields['15'] || '');
  const expiryIso = gs1DateToIso(fields['17'] || '');
  const lot = String(fields['10'] || '').trim();
  return {
    ean,
    gtin: gtinRaw || undefined,
    bestBeforeIso: bestBeforeIso || undefined,
    expiryIso: expiryIso || undefined,
    lot: lot || undefined,
    isGs1: true,
    raw: String(raw || ''),
  };
}

/**
 * Vollständige Scan-Auswertung (EAN + optionale GS1-Felder).
 * @param {string} rawCode
 * @returns {ParsedBarcodeScan}
 */
export function parseBarcodeScan(rawCode) {
  const raw = String(rawCode || '').trim();
  if (!raw) {
    return { ean: '', isGs1: false, raw: '' };
  }

  const paren = parseParenthesizedGs1(raw);
  if (paren?.['01']) {
    return fieldsToParsed(paren, raw);
  }

  const concat = parseConcatenatedGs1(raw);
  if (concat?.['01']) {
    return fieldsToParsed(concat, raw);
  }

  // Reiner EAN/UPC: nur Ziffern
  const digits = raw.replace(/\D/g, '');
  return {
    ean: digits,
    isGs1: false,
    raw,
  };
}

/**
 * Kamera-/Manuell-Scan → Produkt-EAN (GS1-fähig).
 * @param {string} rawCode
 * @returns {string}
 */
export function normalizeScanCode(rawCode) {
  return parseBarcodeScan(rawCode).ean;
}

/**
 * Alias für bestehende cleanScannedBarcode-Aufrufer.
 * @param {string} rawCode
 * @returns {string}
 */
export function cleanScannedBarcode(rawCode) {
  return normalizeScanCode(rawCode);
}
