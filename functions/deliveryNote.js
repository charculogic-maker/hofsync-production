const { GoogleGenerativeAI, GoogleGenerativeAIFetchError } = require('@google/generative-ai');
const { HttpsError } = require('firebase-functions/v2/https');
const { requireEmployeeAccess, resolveAuthContext } = require('./authContext');

const DELIVERY_NOTE_MODEL = process.env.GEMINI_DELIVERY_NOTE_MODEL || 'gemini-2.5-flash';
const MAX_IMAGE_BASE64_LENGTH = 16 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const DELIVERY_NOTE_PROMPT = [
  'Du bist ein präziser OCR-Gastro-Parser.',
  'Analysiere diesen Lieferschein (z.B. von Metro oder Jakob Bayen).',
  'Extrahiere alle Artikel, deren Mengen und ordne sie den Kategorien zu.',
  "Antworte AUSSCHLIESSLICH mit einem validen JSON-Array im Format:",
  "[{ \"artikel\": \"...\", \"menge\": 2, \"kategorie\": \"...\" }].",
  'Kein Markdown, kein Text drumherum, nur das nackte JSON-Array.',
].join(' ');

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
  const menge = Number(mengeRaw);
  return {
    artikel: String(entry?.artikel || entry?.name || entry?.produkt || '').trim(),
    menge: Number.isFinite(menge) && menge > 0 ? menge : 1,
    kategorie: String(entry?.kategorie || entry?.category || '').trim(),
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
  if (!Array.isArray(items) || items.length === 0 || items.length > 80) {
    throw new HttpsError('invalid-argument', 'Ungültige Artikelliste aus dem Lieferschein.');
  }
  return items.map((line, index) => {
    const artikel = String(line.artikel || '').trim().slice(0, 200);
    const kategorie = String(line.kategorie || '').trim().slice(0, 80);
    const menge = Number(line.menge);
    if (!artikel) {
      throw new HttpsError('invalid-argument', `Artikel in Zeile ${index + 1} fehlt.`);
    }
    if (!Number.isFinite(menge) || menge <= 0 || menge > 99999) {
      throw new HttpsError('invalid-argument', `Ungültige Menge in Zeile ${index + 1}.`);
    }
    return { artikel, menge, kategorie };
  });
}

async function parseDeliveryNoteImage(imageBase64, mimeType = 'image/jpeg') {
  const apiKey = resolveGeminiApiKey();
  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({
    model: DELIVERY_NOTE_MODEL,
    generationConfig: { temperature: 0.1 },
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

  return validateParsedItems(
    parsed.map(({ artikel, menge, kategorie }) => ({ artikel, menge, kategorie })),
  );
}

async function handleParseDeliveryNote(request) {
  // Jeder angemeldete Mitarbeiter/Admin liest den Lieferschein für den
  // eigenen Mandanten ein. Die KI liefert nur die erkannten Posten zurück –
  // ein mandantenübergreifender Zugriff ist dadurch ausgeschlossen.
  const callerContext = resolveAuthContext(request.auth);
  const tenantContext = requireEmployeeAccess(request.auth, callerContext.tenantId);

  const imageBase64 = String(request.data?.imageBase64 || '').trim();
  const mimeType = String(request.data?.mimeType || 'image/jpeg').trim().toLowerCase() || 'image/jpeg';

  if (!imageBase64 || imageBase64.length < 32) {
    throw new HttpsError('invalid-argument', 'Bilddaten fehlen oder sind zu kurz.');
  }
  if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
    throw new HttpsError('invalid-argument', 'Bild ist zu groß (max. 12 MB).');
  }
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new HttpsError('invalid-argument', 'Dateityp nicht erlaubt.');
  }

  const items = await parseDeliveryNoteImage(imageBase64, mimeType);
  return {
    items,
    model: DELIVERY_NOTE_MODEL,
    tenantId: tenantContext.tenantId,
    previewOnly: true,
  };
}

module.exports = {
  DELIVERY_NOTE_MODEL,
  handleParseDeliveryNote,
  parseDeliveryNoteImage,
};
