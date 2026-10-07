function getAdmin() {
  return require('./firebaseAdmin');
}
const { HttpsError } = require('firebase-functions/v2/https');
const { requireEmployeeAccess, resolveAuthContext } = require('./authContext');

function loadGeminiSdk() {
  return require('@google/generative-ai');
}

const DELIVERY_NOTE_MODEL = process.env.GEMINI_DELIVERY_NOTE_MODEL || 'gemini-2.5-flash';
const MAX_IMAGE_BASE64_LENGTH = 16 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

const EXT_TO_MIME = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  heic: 'image/heic',
  heif: 'image/heif',
  webp: 'image/webp',
};

const DELIVERY_NOTE_GENERATION_CONFIG = {
  temperature: 0.1,
  responseMimeType: 'application/json',
  maxOutputTokens: 8192,
};

const DELIVERY_NOTE_PROMPT = [
  'THIS DOCUMENT CONTAINS MULTIPLE PAGES (e.g. Page 1 of 4, Page 2 of 4...). You MUST process ALL pages from start to finish and extract every single line item across all pages into the JSON array.',
  'Ignore legal footers, privacy statements, bank accounts, and header boilerplate. Extract ONLY line item table rows to minimize output processing time.',
  'Antworte nur mit einem kompakten JSON-Array, ohne Markdown und ohne weitere Schlüssel.',
  '[{"n":"Name","q":10,"u":"Stk","p":1.83,"t":18.30,"ean":""}]',
  'n=Name, q=Menge, u=Stk oder kg, p=Einzelpreis, t=Zeilensumme, ean=Ziffern.',
  'Wenn das Belegdatum sichtbar ist, setze als erstes Array-Element nur {"d":"YYYY-MM-DD"}.',
  'u=kg nur bei Gewicht. Preise als Zahl. Steht eine Artikelnummer vor dem Namen, lass sie in n.',
].join(' ');

const STATED_PIECE_RE = /(\d{1,4})\s*[x×]\s*\d+(?:[.,]\d+)?\s*(?:g|ml|l)\b/i;
const EXCLUDED_ARTICLE_NUMBERS = new Set(['99166', '99050', '99270', '99100', '99500', '987003']);
const EXCLUDED_NAME_KEYS = [
  'ifco',
  'pfand',
  'rollwagen',
  'logistikpauschale',
  'buttercroissant',
  'rosinenbroetchen',
  'mueslibroetchen',
];

function toIsoDate(value) {
  const raw = String(value || '').trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dotted = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(raw);
  if (dotted) return `${dotted[3]}-${dotted[2]}-${dotted[1]}`;
  return '';
}

/** Trennt ein optionales Datumsobjekt vom Positionsarray. */
function splitDeliveryDate(lines) {
  const items = [];
  let deliveryDate = '';
  for (const line of Array.isArray(lines) ? lines : []) {
    const name = String(line?.n || line?.name || line?.artikel || line?.bezeichnung || '').trim();
    const date = toIsoDate(line?.d || line?.datum || line?.deliveryDate || line?.lieferdatum);
    if (date && !name) {
      deliveryDate = deliveryDate || date;
      continue;
    }
    items.push(line);
  }
  return { deliveryDate, items };
}

function parsePrice(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const cleaned = String(value ?? '').replace(/[€\s]/g, '').replace(',', '.');
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) return NaN;
  return Number(match[0]);
}

/**
 * Weiling: Gesamtpreis / Einzelpreis ist die lieferbare Menge.
 * kg bleibt auf zwei Stellen, Stück wird gerundet.
 */
function applyPriceQuantity(item) {
  const unitPrice = parsePrice(item?.unitPrice ?? item?.p ?? item?.einzelpreis ?? item?.preis ?? item?.ekEinzel);
  const totalPrice = parsePrice(item?.totalPrice ?? item?.t ?? item?.gesamtpreis ?? item?.summe ?? item?.zeilensumme);
  if (!(unitPrice > 0) || !(totalPrice > 0)) return item;
  const calculatedQty = totalPrice / unitPrice;
  const unit = String(item?.einheit || item?.unit || item?.u || '').toLowerCase();
  const quantity = unit === 'kg'
    ? Math.round(calculatedQty * 100) / 100
    : Math.round(calculatedQty);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 99999) return item;
  return {
    ...item,
    menge: quantity,
    quantity,
    calculatedQuantity: quantity,
    unitPrice,
    totalPrice,
    einheit: unit === 'kg' ? 'kg' : (item?.einheit || item?.unit || 'Stk'),
  };
}

function statedPieceTotal(text) {
  const match = String(text || '').match(STATED_PIECE_RE);
  if (!match) return 0;
  const count = Number(match[1]);
  if (!Number.isFinite(count) || count < 1 || count > 9999) return 0;
  return count;
}

function normalizeNameKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

function isNonStockLine(entry) {
  const numbers = [
    entry?.artikelnummer,
    entry?.artnr,
    entry?.artikelNr,
    entry?.sku,
    entry?.itemNumber,
    entry?.nummer,
  ].map((value) => String(value || '').replace(/\D/g, '')).filter(Boolean);
  const blob = `${entry?.artikel || ''} ${entry?.name || ''} ${entry?.inhalt || ''} ${entry?.bezeichnung || ''}`;
  for (const match of blob.matchAll(/\b(\d{5,6})\b/g)) numbers.push(match[1]);
  if (numbers.some((value) => EXCLUDED_ARTICLE_NUMBERS.has(value))) return true;
  const key = normalizeNameKey(blob);
  return EXCLUDED_NAME_KEYS.some((word) => key.includes(word));
}

function catchWeightKg(text) {
  const source = String(text || '');
  if (statedPieceTotal(source)) return null;
  const match = source.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i);
  if (!match) return null;
  const kg = Number(String(match[1]).replace(',', '.'));
  return Number.isFinite(kg) && kg > 0 ? kg : null;
}

/**
 * "Gesamt Stück / Gewicht" nennt die Endmenge ("3 x 175 g" = 3 Stk).
 * Diese Zahl wird nicht mit der Gebinde-Menge multipliziert.
 * Fanggewicht in kg bleibt unverändert.
 */
function expandRetailLine(entry) {
  const artikel = String(entry?.artikel || entry?.name || entry?.produkt || '').trim();
  const inhalt = String(entry?.inhalt || entry?.gebinde || entry?.pack || entry?.gesamt || '').trim();
  const text = `${artikel} ${inhalt} ${entry?.beschreibung || ''}`;
  const billedRaw = Number(String(entry?.menge ?? entry?.quantity ?? 1).replace(',', '.'));
  const billedPacks = Number.isFinite(billedRaw) && billedRaw > 0 ? billedRaw : 1;
  const unitKey = String(entry?.einheit || entry?.unit || '').trim().toLowerCase();
  const declared = Number(String(entry?.totalQuantity ?? entry?.gesamtStueck ?? '').replace(',', '.'));
  const fromText = statedPieceTotal(text);
  const stated = fromText || (Number.isFinite(declared) && declared > 0 ? declared : 0);
  const namedKg = catchWeightKg(text);

  if (stated && unitKey !== 'kg') {
    return {
      ...entry,
      artikel,
      menge: stated,
      billedPacks,
      packMultiplier: 1,
      calculatedQuantity: stated,
      einheit: 'Stk',
      inhalt,
    };
  }

  if (unitKey === 'kg' || namedKg) {
    const kg = unitKey === 'kg' ? billedPacks : namedKg;
    return {
      ...entry,
      artikel,
      menge: kg,
      billedPacks,
      packMultiplier: 1,
      calculatedQuantity: kg,
      einheit: 'kg',
      inhalt,
    };
  }

  return {
    ...entry,
    artikel,
    menge: billedPacks,
    billedPacks,
    packMultiplier: 1,
    calculatedQuantity: billedPacks,
    einheit: String(entry?.einheit || entry?.unit || 'Stk').trim() || 'Stk',
    inhalt,
  };
}

function sanitizeGeminiResponseText(responseText) {
  let rawText = String(responseText || '').replace(/^\uFEFF/, '').trim();
  rawText = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  rawText = rawText.replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  return rawText;
}

function asItemArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.artikel)) return value.artikel;
  if (value.artikel || value.name || value.produkt) return [value];
  return null;
}

function parseSafeJsonArray(str) {
  const source = String(str || '');
  try {
    return JSON.parse(source);
  } catch (err) {
    const lastObjEnd = source.lastIndexOf('}');
    if (lastObjEnd !== -1) {
      const repaired = `${source.slice(0, lastObjEnd + 1).replace(/,\s*$/, '')}]`;
      const arrayStart = repaired.indexOf('[');
      if (arrayStart !== -1) {
        try {
          return JSON.parse(repaired.slice(arrayStart));
        } catch (_repairErr) {
          // unvollständig und nicht reparierbar
        }
      }
    }
    throw err;
  }
}

function extractJsonArray(responseText) {
  const cleanText = sanitizeGeminiResponseText(responseText);
  if (!cleanText) {
    throw new Error('Gemini lieferte eine leere Antwort.');
  }

  let parsed = null;
  try {
    parsed = parseSafeJsonArray(cleanText);
  } catch (_err) {
    parsed = null;
  }

  const direct = asItemArray(parsed);
  if (direct) return direct;

  const start = cleanText.indexOf('[');
  const end = cleanText.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    const err = new SyntaxError('Kein JSON-Array in der Gemini-Antwort gefunden.');
    err.rawPreview = cleanText.slice(0, 240);
    throw err;
  }

  try {
    parsed = parseSafeJsonArray(cleanText.slice(start));
  } catch (err) {
    err.rawPreview = cleanText.slice(start, start + 240);
    throw err;
  }

  const items = asItemArray(parsed);
  if (!items) {
    const err = new SyntaxError('Gemini-Antwort ist kein JSON-Array.');
    err.rawPreview = cleanText.slice(0, 240);
    throw err;
  }
  return items;
}

function normalizeDeliveryLine(entry, index) {
  const mengeRaw = entry?.q ?? entry?.menge ?? entry?.quantity ?? entry?.qty ?? 1;
  const menge = Number(String(mengeRaw).replace(',', '.'));
  const packMultiplier = Number(entry?.packMultiplier ?? entry?.multiplier);
  return {
    artikel: String(entry?.n || entry?.artikel || entry?.name || entry?.produkt || entry?.bezeichnung || '').trim(),
    menge: Number.isFinite(menge) && menge > 0 ? menge : 1,
    einheit: String(entry?.u || entry?.einheit || entry?.unit || '').trim(),
    inhalt: String(entry?.inhalt || entry?.gebinde || entry?.pack || '').trim(),
    packMultiplier: Number.isFinite(packMultiplier) ? packMultiplier : 0,
    totalQuantity: Number(String(entry?.totalQuantity ?? entry?.gesamtStueck ?? '').replace(',', '.')),
    artikelnummer: String(entry?.a || entry?.artikelnummer || entry?.artnr || entry?.artikelNr || entry?.sku || '').trim(),
    kategorie: String(entry?.kategorie || entry?.category || '').trim(),
    ean: String(entry?.ean || entry?.barcode || '').replace(/\D/g, ''),
    unitPrice: parsePrice(entry?.p ?? entry?.unitPrice ?? entry?.einzelpreis ?? entry?.preis ?? entry?.ekEinzel),
    totalPrice: parsePrice(entry?.t ?? entry?.totalPrice ?? entry?.gesamtpreis ?? entry?.summe ?? entry?.zeilensumme),
    excluded: entry?.excluded === true,
    _index: index,
  };
}

function resolveGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'DEIN_AI_STUDIO_KEY') {
    throw new HttpsError('failed-precondition', 'GEMINI_API_KEY ist nicht konfiguriert.');
  }
  return apiKey;
}

function validateParsedItems(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 200) {
    throw new HttpsError('invalid-argument', 'Ungültige Artikelliste aus dem Lieferschein.');
  }
  return items.map((line, index) => {
    const expanded = applyPriceQuantity(expandRetailLine(line));
    const artikel = String(expanded.artikel || '').trim().slice(0, 200);
    const kategorie = String(expanded.kategorie || line.kategorie || '').trim().slice(0, 80);
    const menge = Number(expanded.calculatedQuantity ?? expanded.menge);
    if (!artikel) {
      throw new HttpsError('invalid-argument', `Artikel in Zeile ${index + 1} fehlt.`);
    }
    if (!Number.isFinite(menge) || menge <= 0 || menge > 99999) {
      throw new HttpsError('invalid-argument', `Ungültige Menge in Zeile ${index + 1}.`);
    }
    return {
      artikel,
      menge,
      kategorie,
      einheit: expanded.einheit || 'Stk',
      billedPacks: expanded.billedPacks,
      packMultiplier: expanded.packMultiplier,
      calculatedQuantity: menge,
      inhalt: expanded.inhalt || '',
      ean: String(line.ean || '').replace(/\D/g, ''),
      artikelnummer: String(line.artikelnummer || expanded.artikelnummer || '').replace(/\D/g, ''),
      excluded: line.excluded === true || expanded.excluded === true || isNonStockLine({ ...line, ...expanded }),
      unitPrice: Number.isFinite(expanded.unitPrice) ? expanded.unitPrice : null,
      totalPrice: Number.isFinite(expanded.totalPrice) ? expanded.totalPrice : null,
    };
  });
}

function normalizeMimeType(mimeType, storagePath = '') {
  let mime = String(mimeType || '').trim().toLowerCase();
  if (mime === 'image/jpg') mime = 'image/jpeg';
  if (mime && mime !== 'application/octet-stream' && ALLOWED_MIME_TYPES.has(mime)) {
    return mime;
  }
  const extMatch = String(storagePath || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  const fromExt = extMatch ? EXT_TO_MIME[extMatch[1]] : '';
  if (fromExt) return fromExt;
  return mime || 'image/jpeg';
}

function assertAllowedMimeType(mimeType) {
  const mime = normalizeMimeType(mimeType);
  if (!ALLOWED_MIME_TYPES.has(mime)) {
    throw new HttpsError('invalid-argument', 'Dateityp nicht erlaubt.');
  }
  return mime;
}

/**
 * Erzwingt tenants/{tenantId}/… und blockiert Path-Traversal / Cross-Tenant.
 */
function assertTenantStoragePath(tenantId, storagePath) {
  const cleaned = String(storagePath || '').trim().replace(/^\/+/, '');
  const prefix = `tenants/${tenantId}/`;
  if (!cleaned || !cleaned.startsWith(prefix)) {
    throw new HttpsError('permission-denied', 'Speicherpfad gehört nicht zu diesem Mandanten.');
  }
  if (cleaned.includes('..') || cleaned.includes('\\')) {
    throw new HttpsError('invalid-argument', 'Ungültiger Speicherpfad.');
  }
  if (!cleaned.startsWith(`${prefix}delivery_notes/`)) {
    throw new HttpsError('invalid-argument', 'Speicherpfad muss unter delivery_notes liegen.');
  }
  return cleaned;
}

async function loadImageFromStorage(tenantId, storagePath) {
  const cleaned = assertTenantStoragePath(tenantId, storagePath);
  console.log('[parseDeliveryNote] Storage-Pfad verifiziert', { tenantId, storagePath: cleaned });

  try {
    const bucket = getAdmin().storage().bucket();
    const file = bucket.file(cleaned);
    const [exists] = await file.exists();
    if (!exists) {
      throw new HttpsError('not-found', 'Lieferschein-Datei wurde nicht gefunden.');
    }
    const [buffer] = await file.download();
    const [metadata] = await file.getMetadata();
    const mimeType = assertAllowedMimeType(
      normalizeMimeType(metadata?.contentType, cleaned),
    );
    const imageBase64 = buffer.toString('base64');
    if (!imageBase64 || imageBase64.length < 32) {
      throw new HttpsError('invalid-argument', 'Bilddaten fehlen oder sind zu kurz.');
    }
    if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
      throw new HttpsError('invalid-argument', 'Bild ist zu groß (max. 12 MB).');
    }
    return { imageBase64, mimeType, storagePath: cleaned };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('[parseDeliveryNote] Storage-Download fehlgeschlagen:', error?.message || error);
    throw new HttpsError('internal', 'Lieferschein konnte nicht aus dem Speicher geladen werden.');
  }
}

async function resolveImagePayload(requestData, tenantId) {
  const imageBase64 = String(
    requestData?.imageBase64
    || requestData?.imageBytes
    || '',
  ).trim();
  const storagePath = String(requestData?.storagePath || requestData?.imagePath || '').trim();
  const mimeHint = String(requestData?.mimeType || '').trim().toLowerCase();

  if (storagePath) {
    return loadImageFromStorage(tenantId, storagePath);
  }

  if (imageBase64) {
    if (imageBase64.length < 32) {
      throw new HttpsError('invalid-argument', 'Bilddaten fehlen oder sind zu kurz.');
    }
    if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
      throw new HttpsError('invalid-argument', 'Bild ist zu groß (max. 12 MB).');
    }
    const mimeType = assertAllowedMimeType(normalizeMimeType(mimeHint || 'image/jpeg'));
    return { imageBase64, mimeType, storagePath: '' };
  }

  throw new HttpsError('invalid-argument', 'Bilddaten oder Speicherpfad fehlen.');
}

async function parseDeliveryNoteImage(imageBase64, mimeType = 'image/jpeg') {
  const apiKey = resolveGeminiApiKey();
  const { GoogleGenerativeAI, GoogleGenerativeAIFetchError } = loadGeminiSdk();
  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({
    model: DELIVERY_NOTE_MODEL,
    generationConfig: DELIVERY_NOTE_GENERATION_CONFIG,
  }, {
    timeout: 110000,
  });

  console.log('[parseDeliveryNote] OCR/KI-Extraktion gestartet', {
    model: DELIVERY_NOTE_MODEL,
    mimeType,
    base64Length: imageBase64?.length || 0,
  });

  let parsed;
  try {
    const result = await model.generateContent([
      { text: DELIVERY_NOTE_PROMPT },
      { inlineData: { mimeType, data: imageBase64 } },
    ]);
    const responseText = result?.response?.text?.() || '';
    const split = splitDeliveryDate(extractJsonArray(responseText));
    parsed = {
      deliveryDate: split.deliveryDate,
      lines: split.items.map(normalizeDeliveryLine).filter((line) => line.artikel),
    };
  } catch (err) {
    console.error('[parseDeliveryNote] Gemini Error:', err);
    if (err instanceof GoogleGenerativeAIFetchError) {
      console.error('[parseDeliveryNote] Gemini Error status:', err.status);
    }
    throw new HttpsError('internal', 'Lieferschein konnte nicht analysiert werden.');
  }

  if (!parsed.lines.length) {
    throw new HttpsError('invalid-argument', 'Keine Artikel auf dem Lieferschein erkannt.');
  }

  return {
    items: validateParsedItems(parsed.lines),
    deliveryDate: parsed.deliveryDate || '',
  };
}

async function handleProcessDeliveryNoteDraft(event) {
  const tenantId = String(event?.params?.tenantId || '').trim();
  const draftId = String(event?.params?.draftId || '').trim();
  const snapshot = event?.data;
  const data = typeof snapshot?.data === 'function' ? snapshot.data() : null;
  if (!tenantId || !draftId || !data || data.status !== 'processing') return null;
  if (data.tenantId && data.tenantId !== tenantId) return null;

  const admin = getAdmin();
  const db = admin.firestore();
  const ref = db.doc(`tenants/${tenantId}/delivery_note_drafts/${draftId}`);
  const FieldValue = require('firebase-admin/firestore').FieldValue;

  try {
    const loaded = await loadImageFromStorage(tenantId, data.storagePath);
    const parsed = await parseDeliveryNoteImage(
      loaded.imageBase64,
      loaded.mimeType || data.mimeType,
    );
    const items = JSON.parse(JSON.stringify(parsed.items || []));
    await ref.set({
      status: 'completed',
      items,
      itemCount: items.length,
      deliveryDate: parsed.deliveryDate || data.deliveryDate || '',
      completedAt: FieldValue.serverTimestamp(),
      error: '',
    }, { merge: true });
    console.log('[processDeliveryNoteDraft] Entwurf fertig', {
      tenantId,
      draftId,
      itemCount: items.length,
      deliveryDate: parsed.deliveryDate || data.deliveryDate || '',
    });
    return { status: 'completed', itemCount: items.length };
  } catch (err) {
    console.error('[processDeliveryNoteDraft] Analyse fehlgeschlagen:', err);
    await ref.set({
      status: 'failed',
      error: String(err?.message || 'Analyse fehlgeschlagen.').slice(0, 300),
    }, { merge: true });
    return { status: 'failed' };
  }
}

async function handleParseDeliveryNote(request) {
  const admin = getAdmin();
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  // Jeder angemeldete Mitarbeiter/Admin liest den Lieferschein für den
  // eigenen Mandanten ein. Die KI liefert nur die erkannten Posten zurück –
  // ein mandantenübergreifender Zugriff ist dadurch ausgeschlossen.
  const callerContext = resolveAuthContext(request.auth);
  const tenantContext = requireEmployeeAccess(request.auth, callerContext.tenantId);

  console.log('[parseDeliveryNote] Upload empfangen', {
    tenantId: tenantContext.tenantId,
    hasStoragePath: Boolean(request.data?.storagePath || request.data?.imagePath),
    hasBase64: Boolean(request.data?.imageBase64 || request.data?.imageBytes),
    mimeHint: request.data?.mimeType || null,
  });

  const { imageBase64, mimeType, storagePath } = await resolveImagePayload(
    request.data || {},
    tenantContext.tenantId,
  );

  const parsed = await parseDeliveryNoteImage(imageBase64, mimeType);
  const items = parsed.items || [];
  const response = {
    items,
    deliveryDate: parsed.deliveryDate || '',
    model: DELIVERY_NOTE_MODEL,
    tenantId: tenantContext.tenantId,
    previewOnly: true,
    storagePath: storagePath || null,
  };

  console.log('[parseDeliveryNote] Ergebnis zurückgesendet', {
    tenantId: tenantContext.tenantId,
    itemCount: items.length,
    storagePath: storagePath || null,
  });

  return response;
}

module.exports = {
  DELIVERY_NOTE_MODEL,
  ALLOWED_MIME_TYPES,
  assertTenantStoragePath,
  applyPriceQuantity,
  expandRetailLine,
  normalizeDeliveryLine,
  isNonStockLine,
  extractJsonArray,
  parseSafeJsonArray,
  splitDeliveryDate,
  handleProcessDeliveryNoteDraft,
  sanitizeGeminiResponseText,
  handleParseDeliveryNote,
  normalizeMimeType,
  parseDeliveryNoteImage,
  resolveImagePayload,
};
