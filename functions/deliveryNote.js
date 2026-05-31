const { GoogleGenerativeAI, GoogleGenerativeAIFetchError } = require('@google/generative-ai');
const { HttpsError } = require('firebase-functions/v2/https');

const DELIVERY_NOTE_MODEL = process.env.GEMINI_DELIVERY_NOTE_MODEL || 'gemini-2.5-flash';
const ALLOWED_TENANT_ID = 'torfabrik';
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

function resolveTenantId(auth) {
  const token = auth?.token || {};
  return String(
    token.tenantId || token.tenant_id || token.tenant || '',
  ).trim().toLowerCase();
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

  return parsed.map(({ artikel, menge, kategorie }) => ({ artikel, menge, kategorie }));
}

async function handleParseDeliveryNote(request) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Anmeldung erforderlich.');
  }

  const tenantId = resolveTenantId(request.auth);
  if (tenantId !== ALLOWED_TENANT_ID) {
    throw new HttpsError('permission-denied', 'Lieferschein-Scanner nur für TorFabrik freigeschaltet.');
  }

  const imageBase64 = String(request.data?.imageBase64 || '').trim();
  const mimeType = String(request.data?.mimeType || 'image/jpeg').trim() || 'image/jpeg';

  if (!imageBase64 || imageBase64.length < 32) {
    throw new HttpsError('invalid-argument', 'Bilddaten fehlen oder sind zu kurz.');
  }

  const items = await parseDeliveryNoteImage(imageBase64, mimeType);
  return { items, model: DELIVERY_NOTE_MODEL, tenantId: ALLOWED_TENANT_ID };
}

module.exports = {
  ALLOWED_TENANT_ID,
  DELIVERY_NOTE_MODEL,
  handleParseDeliveryNote,
  parseDeliveryNoteImage,
};
