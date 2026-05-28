const { GoogleGenerativeAI, GoogleGenerativeAIFetchError } = require('@google/generative-ai');
const admin = require('firebase-admin');

const GEMINI_API_KEY_PLACEHOLDER = 'DEIN_AI_STUDIO_KEY';
const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const TENANT_ID = 'StevesHof_Hauptbetrieb';
const TIME_ZONE = 'Europe/Berlin';
const MIN_PRICE_ENTRIES = 3;

function buildMeatPricePrompt() {
  const { week } = getCalendarWeekParts();
  const monthYear = new Intl.DateTimeFormat('de-DE', {
    timeZone: TIME_ZONE,
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return [
    'Nutze die integrierte Google-Suche, um die brandaktuellen Fleischmarkt-Marktnotierungen',
    `der aktuellen Kalenderwoche (KW ${week}, ${monthYear}) in Deutschland zu finden.`,
    'Suche explizit nach den offiziellen Preisen von VEZG (Vereinigung der Erzeugergemeinschaften für Vieh und Fleisch), AMI und MEG.',
    'Extrahiere die Preise für Schweine (S-E), Sauen, Rinder (R3, Roastbeef), Geflügel und Lamm.',
    'Gib mir AUSSCHLIESSLICH ein valides JSON-Array zurück:',
    '[{ "id": number, "category": string, "cut": string, "price_conv": number, "price_bio": number, "trend": string, "last_update": string }].',
    'Sortierung: Schwein, Rind, Geflügel, Lamm, Sonstige.',
    'Kein Markdown, kein Text drumherum, nur das nackte JSON-Array.',
  ].join(' ');
}

function getCalendarWeekParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  const local = new Date(Date.UTC(year, month - 1, day));
  const dayNum = local.getUTCDay() || 7;
  local.setUTCDate(local.getUTCDate() + 4 - dayNum);
  const isoYear = local.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil((((local - yearStart) / 86400000) + 1) / 7);
  return { year: isoYear, week };
}

function buildDocId(jahr, week) {
  return `${jahr}_kw${String(week).padStart(2, '0')}`;
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
    if (parsed && Array.isArray(parsed.preise)) return parsed.preise;
    if (parsed && Array.isArray(parsed.prices)) return parsed.prices;
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

function normalizePriceEntry(entry, index) {
  const priceConv = Number(entry?.price_conv);
  const priceBio = Number(entry?.price_bio);
  return {
    id: Number.isFinite(Number(entry?.id)) ? Number(entry.id) : index + 1,
    category: String(entry?.category || '').trim(),
    cut: String(entry?.cut || '').trim(),
    price_conv: Number.isFinite(priceConv) ? priceConv : 0,
    price_bio: Number.isFinite(priceBio) ? priceBio : 0,
    trend: String(entry?.trend || '').trim(),
    last_update: String(entry?.last_update || '').trim(),
  };
}

function getGeminiApiVersion() {
  return String(process.env.GEMINI_API_VERSION || 'v1').trim() || 'v1';
}

function getGeminiRequestOptions() {
  return { apiVersion: getGeminiApiVersion() };
}

function logGeminiDiagnostics(phase = 'run') {
  const rawKey = process.env.GEMINI_API_KEY;
  const trimmedKey = rawKey?.trim();
  console.log('[DIAGNOSE] Phase:', phase);
  console.log(
    '[DIAGNOSE] GEMINI_API_KEY vorhanden? Länge:',
    trimmedKey ? trimmedKey.length : '0 (FEHLT!)',
  );
  if (rawKey && trimmedKey && rawKey.length !== trimmedKey.length) {
    console.warn('[DIAGNOSE] GEMINI_API_KEY enthält Leerzeichen/Zeilenumbruch – wird getrimmt.');
  }
  console.log('[DIAGNOSE] Genutztes Modell:', modelName);
  console.log('[DIAGNOSE] API-Version:', getGeminiApiVersion());
}

function logGeminiDetailedError(error, context = {}) {
  const payload = {
    message: error?.message,
    status: error?.status,
    statusText: error?.statusText,
    stack: error?.stack,
    name: error?.name,
    isFetchError: error instanceof GoogleGenerativeAIFetchError,
    errorDetails: error?.errorDetails,
    ...context,
  };
  console.error('[GEMINI_DETAILED_ERROR]', payload);
  if (error?.errorDetails) {
    console.error('[GEMINI_DETAILED_ERROR] errorDetails:', JSON.stringify(error.errorDetails));
  }
}

function resolveGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (apiKey && apiKey !== GEMINI_API_KEY_PLACEHOLDER) {
    return apiKey;
  }
  throw new Error('GEMINI_API_KEY ist nicht gebunden. Secret in onSchedule und Cloud Secret Manager prüfen.');
}

async function fetchMeatPricesFromGemini() {
  logGeminiDiagnostics('gemini-fetch');

  const GEMINI_API_KEY = resolveGeminiApiKey();
  const ai = new GoogleGenerativeAI(GEMINI_API_KEY);
  const geminiRequestOptions = getGeminiRequestOptions();
  const model = ai.getGenerativeModel({
    model: modelName,
    tools: [{ googleSearch: {} }],
    generationConfig: {
      temperature: 0.2,
    },
  }, geminiRequestOptions);

  let result;
  try {
    result = await model.generateContent(buildMeatPricePrompt());
  } catch (error) {
    logGeminiDetailedError(error, {
      phase: 'generateContent',
      apiVersion: geminiRequestOptions.apiVersion,
      model: modelName,
    });
    throw error;
  }

  const responseText = result?.response?.text?.() || '';
  const groundingMetadata = result?.response?.candidates?.[0]?.groundingMetadata;
  if (groundingMetadata?.webSearchQueries?.length) {
    console.log('[fetchWeeklyMeatPrices] Google Search Queries:', groundingMetadata.webSearchQueries);
  } else {
    console.warn('[fetchWeeklyMeatPrices] Keine groundingMetadata.webSearchQueries – Suche evtl. nicht ausgeführt.');
  }

  const parsedArray = extractJsonArray(responseText).map(normalizePriceEntry);
  if (!parsedArray.length || parsedArray.length < MIN_PRICE_ENTRIES) {
    throw new Error('Gemini lieferte keine Daten zurück');
  }

  console.log(`[fetchWeeklyMeatPrices] Gemini OK: ${parsedArray.length} Preise geparst (${modelName}, Grounding aktiv).`);
  return { parsedArray, modelUsed: modelName };
}

async function persistWeeklyMeatPrices() {
  const { year: jahr, week } = getCalendarWeekParts();
  const kw = buildDocId(jahr, week);
  const firestorePath = `tenants/${TENANT_ID}/fleischpreise/${kw}`;

  const { parsedArray, modelUsed } = await fetchMeatPricesFromGemini();

  try {
    await admin.firestore().doc(firestorePath).set({
      tenantId: TENANT_ID,
      kw,
      jahr,
      week,
      preise: parsedArray,
      prices: parsedArray,
      priceCount: parsedArray.length,
      source: 'gemini',
      modelUsed,
      model: modelUsed,
      fetchedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[fetchWeeklyMeatPrices] Firestore geschrieben: ${firestorePath} (${parsedArray.length} Preise).`);
  } catch (error) {
    console.error('[FIRESTORE_WRITE_FAILED]', error);
    throw error;
  }

  return {
    ok: true,
    kw,
    jahr,
    firestorePath,
    priceCount: parsedArray.length,
    modelUsed,
    tenantId: TENANT_ID,
  };
}

module.exports = {
  persistWeeklyMeatPrices,
  logGeminiDiagnostics,
  logGeminiDetailedError,
  GoogleGenerativeAIFetchError,
  TENANT_ID,
  modelName,
};
