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

const DELIVERY_NOTE_PROMPT = [
  'Du bist ein präziser OCR-Gastro-Parser.',
  'Analysiere diesen Lieferschein (z.B. von Weiling, Metro oder Jakob Bayen).',
  'Großhändler berechnen oft eine VPE/Gebinde, der Laden bucht Einzelstücke.',
  'Lies die Gebindezahl als menge und den Innenpack aus der Beschreibung, z.B. "10x230g" oder "6x500g".',
  'Fanggewichte wie "18,14 kg Bananen" bleiben Kilogramm, nicht in Stück umrechnen.',
  'Antworte AUSSCHLIESSLICH mit einem validen JSON-Array im Format:',
  '[{ "artikel": "...", "menge": 1, "einheit": "VPE", "packMultiplier": 10, "inhalt": "10x230g", "kategorie": "..." }].',
  'packMultiplier ist die Zahl vor dem x bei Stückpackungen (10x230g -> 10). Bei reinem kg-Gewicht ist packMultiplier 1.',
  'Kein Markdown, kein Text drumherum, nur das nackte JSON-Array.',
].join(' ');

const INNER_PACK_RE = /(\d{1,3})\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(g|ml|l)\b/gi;

function extractInnerPackMultiplier(text) {
  const source = String(text || '');
  const pattern = new RegExp(INNER_PACK_RE.source, 'gi');
  let best = 0;
  for (const match of source.matchAll(pattern)) {
    const count = Number(match[1]);
    if (!Number.isFinite(count) || count < 2 || count > 200) continue;
    if (count > best) best = count;
  }
  return best;
}

function catchWeightKg(text) {
  const source = String(text || '');
  if (extractInnerPackMultiplier(source)) return null;
  const match = source.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i);
  if (!match) return null;
  const kg = Number(String(match[1]).replace(',', '.'));
  return Number.isFinite(kg) && kg > 0 ? kg : null;
}

/**
 * VPE-Menge × Innenpack (10x230g) = Einzelstücke.
 * Fanggewicht in kg bleibt unverändert.
 */
function expandRetailLine(entry) {
  const artikel = String(entry?.artikel || entry?.name || entry?.produkt || '').trim();
  const inhalt = String(entry?.inhalt || entry?.gebinde || entry?.pack || '').trim();
  const text = `${artikel} ${inhalt}`;
  const billedRaw = Number(String(entry?.menge ?? entry?.quantity ?? 1).replace(',', '.'));
  const billedPacks = Number.isFinite(billedRaw) && billedRaw > 0 ? billedRaw : 1;
  const unitKey = String(entry?.einheit || entry?.unit || '').trim().toLowerCase();
  const explicit = Number(entry?.packMultiplier ?? entry?.multiplier);
  const fromText = extractInnerPackMultiplier(text);
  const namedKg = catchWeightKg(text);

  if (unitKey === 'kg' || (namedKg && !fromText && !(Number.isFinite(explicit) && explicit >= 2))) {
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

  const multiplier = Number.isFinite(explicit) && explicit >= 2 ? explicit : fromText;
  if (multiplier >= 2) {
    const calculatedQuantity = Math.round(billedPacks * multiplier * 1000) / 1000;
    return {
      ...entry,
      artikel,
      menge: calculatedQuantity,
      billedPacks,
      packMultiplier: multiplier,
      calculatedQuantity,
      einheit: 'Stk',
      inhalt: inhalt || `${multiplier}x`,
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
  return String(responseText || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
}

function extractJsonArray(responseText) {
  const cleanText = sanitizeGeminiResponseText(responseText);
  if (!cleanText) {
    throw new Error('Gemini lieferte eine leere Antwort.');
  }

  try {
    const parsed = JSON.parse(cleanText);
    if (Array.isArray(parsed)) return parsed;
  } catch (_err) {
    // continue with bracket extraction
  }

  const start = cleanText.indexOf('[');
  const end = cleanText.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Kein JSON-Array in der Gemini-Antwort gefunden.');
  }

  const parsed = JSON.parse(cleanText.slice(start, end + 1));
  if (!Array.isArray(parsed)) {
    throw new Error('Gemini-Antwort ist kein JSON-Array.');
  }
  return parsed;
}

function normalizeDeliveryLine(entry, index) {
  const mengeRaw = entry?.menge ?? entry?.quantity ?? entry?.qty ?? 1;
  const menge = Number(String(mengeRaw).replace(',', '.'));
  const packMultiplier = Number(entry?.packMultiplier ?? entry?.multiplier);
  return {
    artikel: String(entry?.artikel || entry?.name || entry?.produkt || entry?.bezeichnung || '').trim(),
    menge: Number.isFinite(menge) && menge > 0 ? menge : 1,
    einheit: String(entry?.einheit || entry?.unit || '').trim(),
    inhalt: String(entry?.inhalt || entry?.gebinde || entry?.pack || '').trim(),
    packMultiplier: Number.isFinite(packMultiplier) ? packMultiplier : 0,
    kategorie: String(entry?.kategorie || entry?.category || '').trim(),
    ean: String(entry?.ean || entry?.barcode || '').replace(/\D/g, ''),
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
    const expanded = expandRetailLine(line);
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
    generationConfig: { temperature: 0.1 },
  });

  console.log('[parseDeliveryNote] OCR/KI-Extraktion gestartet', {
    model: DELIVERY_NOTE_MODEL,
    mimeType,
    base64Length: imageBase64?.length || 0,
  });

  let result;
  try {
    result = await model.generateContent([
      { text: DELIVERY_NOTE_PROMPT },
      { inlineData: { mimeType, data: imageBase64 } },
    ]);
  } catch (error) {
    console.error('[parseDeliveryNote] Gemini-Fehler:', {
      message: error?.message,
      status: error?.status,
      isFetchError: error instanceof GoogleGenerativeAIFetchError,
    });
    throw new HttpsError('internal', 'Lieferschein konnte nicht analysiert werden.');
  }

  const responseText = result?.response?.text?.() || '';
  const parsed = extractJsonArray(responseText)
    .map(normalizeDeliveryLine)
    .filter((line) => line.artikel);

  if (!parsed.length) {
    throw new HttpsError('invalid-argument', 'Keine Artikel auf dem Lieferschein erkannt.');
  }

  return validateParsedItems(parsed);
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

  const items = await parseDeliveryNoteImage(imageBase64, mimeType);
  const response = {
    items,
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
  expandRetailLine,
  extractInnerPackMultiplier,
  handleParseDeliveryNote,
  normalizeMimeType,
  parseDeliveryNoteImage,
  resolveImagePayload,
};
