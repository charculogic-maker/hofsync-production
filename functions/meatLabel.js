/**
 * Gemini Vision – LMIV / Bio Fleisch-Etikett → strukturierte Herkunftsdaten.
 */
const admin = require('firebase-admin');
const { GoogleGenerativeAI, GoogleGenerativeAIFetchError } = require('@google/generative-ai');
const { HttpsError } = require('firebase-functions/v2/https');
const { requireEmployeeAccess, resolveAuthContext } = require('./authContext');

const MEAT_LABEL_MODEL = process.env.GEMINI_MEAT_LABEL_MODEL || 'gemini-2.5-flash';
const MAX_IMAGE_BASE64_LENGTH = 16 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const ANIMAL_TYPES = new Set(['rind', 'schwein', 'gefluegel', 'schaf', 'ziege']);
const ORGANIC_ASSOCIATIONS = new Set([
  'EU-Bio',
  'Bioland',
  'Demeter',
  'Naturland',
  'Keine / Konventionell',
]);
const COUNTRY_OPTIONS = new Set([
  'Deutschland',
  'Österreich',
  'Niederlande',
  'Belgien',
  'Frankreich',
  'Polen',
  'Dänemark',
  'Irland',
  'Spanien',
  'Italien',
  'Tschechien',
  'Sonstiges EU-Land',
  'Nicht-EU',
]);

const COUNTRY_ALIASES = {
  deutschland: 'Deutschland',
  germany: 'Deutschland',
  de: 'Deutschland',
  'd.e.': 'Deutschland',
  oesterreich: 'Österreich',
  osterreich: 'Österreich',
  österreich: 'Österreich',
  austria: 'Österreich',
  at: 'Österreich',
  niederlande: 'Niederlande',
  netherlands: 'Niederlande',
  holland: 'Niederlande',
  nl: 'Niederlande',
  belgien: 'Belgien',
  belgium: 'Belgien',
  be: 'Belgien',
  frankreich: 'Frankreich',
  france: 'Frankreich',
  fr: 'Frankreich',
  polen: 'Polen',
  poland: 'Polen',
  pl: 'Polen',
  daenemark: 'Dänemark',
  danemark: 'Dänemark',
  dänemark: 'Dänemark',
  denmark: 'Dänemark',
  dk: 'Dänemark',
  irland: 'Irland',
  ireland: 'Irland',
  ie: 'Irland',
  spanien: 'Spanien',
  spain: 'Spanien',
  es: 'Spanien',
  italien: 'Italien',
  italy: 'Italien',
  it: 'Italien',
  tschechien: 'Tschechien',
  czechia: 'Tschechien',
  'czech republic': 'Tschechien',
  cz: 'Tschechien',
};

const MEAT_LABEL_PROMPT = [
  'Du bist ein präziser OCR-Parser für europäische / deutsche Fleisch-Etiketten (LMIV + Bio).',
  'Analysiere das Foto eines Schlachthof-/Zerlegebetriebs-Etiketts (oval Identitätskennzeichen, Charge/LOT, Herkunft, Öko-Kontrollstelle).',
  'Extrahiere die Felder so genau wie möglich. Fehlende Werte als leeren String "" setzen.',
  'animalType nur als: rind | schwein | gefluegel | schaf | ziege.',
  'organicAssociation nur als: EU-Bio | Bioland | Demeter | Naturland | Keine / Konventionell.',
  'Länder bevorzugt auf Deutsch (Deutschland, Österreich, Niederlande, …).',
  'isSingleOrigin=true wenn Geburt/Aufzucht/Schlachtung im selben Land bzw. nur ein Ursprungsland angegeben ist.',
  'Antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt (kein Markdown, kein Text):',
  '{',
  '"lotNumber":"string",',
  '"healthMark":"string",',
  '"organicControlBody":"string",',
  '"organicAssociation":"EU-Bio | Bioland | Demeter | Naturland | Keine / Konventionell",',
  '"animalType":"rind | schwein | gefluegel | schaf | ziege",',
  '"isSingleOrigin":true,',
  '"singleOriginCountry":"string",',
  '"bornIn":"string",',
  '"raisedIn":"string",',
  '"slaughteredIn":"string",',
  '"slaughterhouseNo":"string",',
  '"cutIn":"string",',
  '"cuttingPlantNo":"string"',
  '}',
].join(' ');

function sanitizeGeminiResponseText(responseText) {
  return String(responseText || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
}

function extractJsonObject(responseText) {
  const cleanText = sanitizeGeminiResponseText(responseText);
  if (!cleanText) {
    throw new Error('Gemini lieferte eine leere Antwort.');
  }

  try {
    const parsed = JSON.parse(cleanText);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch (_err) {
    // continue with brace extraction
  }

  const start = cleanText.indexOf('{');
  const end = cleanText.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Kein JSON-Objekt in der Gemini-Antwort gefunden.');
  }

  const parsed = JSON.parse(cleanText.slice(start, end + 1));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Gemini-Antwort ist kein JSON-Objekt.');
  }
  return parsed;
}

function resolveGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'DEIN_AI_STUDIO_KEY') {
    throw new HttpsError('failed-precondition', 'GEMINI_API_KEY ist nicht konfiguriert.');
  }
  return apiKey;
}

function asTrimmedString(value, maxLen = 120) {
  return String(value ?? '').trim().slice(0, maxLen);
}

function normalizeCountry(value) {
  const raw = asTrimmedString(value, 80);
  if (!raw) return '';
  if (COUNTRY_OPTIONS.has(raw)) return raw;
  const key = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, '')
    .trim();
  if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key];
  if (COUNTRY_ALIASES[raw.toLowerCase()]) return COUNTRY_ALIASES[raw.toLowerCase()];
  return 'Sonstiges EU-Land';
}

function normalizeAnimalType(value) {
  const raw = asTrimmedString(value, 40).toLowerCase();
  const aliases = {
    rind: 'rind',
    rinder: 'rind',
    beef: 'rind',
    cattle: 'rind',
    schwein: 'schwein',
    pork: 'schwein',
    pig: 'schwein',
    gefluegel: 'gefluegel',
    geflügel: 'gefluegel',
    poultry: 'gefluegel',
    huhn: 'gefluegel',
    hähnchen: 'gefluegel',
    pute: 'gefluegel',
    schaf: 'schaf',
    sheep: 'schaf',
    lamm: 'schaf',
    ziege: 'ziege',
    goat: 'ziege',
  };
  const mapped = aliases[raw] || raw;
  return ANIMAL_TYPES.has(mapped) ? mapped : 'rind';
}

function normalizeOrganicAssociation(value) {
  const raw = asTrimmedString(value, 60);
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (lower.includes('bioland')) return 'Bioland';
  if (lower.includes('demeter')) return 'Demeter';
  if (lower.includes('naturland')) return 'Naturland';
  if (lower.includes('konvention') || lower.includes('keine') || lower === 'n/a') {
    return 'Keine / Konventionell';
  }
  if (lower.includes('eu-bio') || lower === 'eu bio' || lower === 'eubio') return 'EU-Bio';
  if (ORGANIC_ASSOCIATIONS.has(raw)) return raw;
  // Unrecognized → empty so operators must confirm manually (no hallucinated EU-Bio).
  return '';
}

function normalizeMeatLabelPayload(raw = {}) {
  const isSingleOrigin = Boolean(
    raw.isSingleOrigin === true
    || raw.isSingleOrigin === 'true'
    || raw.is_single_origin === true,
  );
  const animalType = normalizeAnimalType(raw.animalType || raw.tierart);
  const payload = {
    lotNumber: asTrimmedString(raw.lotNumber || raw.lot || raw.charge, 80),
    healthMark: asTrimmedString(raw.healthMark || raw.identityMark || raw.identitaetskennzeichen, 80),
    organicControlBody: asTrimmedString(
      raw.organicControlBody || raw.oekoKontrollstelle || raw.ecoControlBody,
      40,
    ),
    organicAssociation: normalizeOrganicAssociation(raw.organicAssociation || raw.bioVerband),
    animalType,
    isSingleOrigin,
    singleOriginCountry: normalizeCountry(raw.singleOriginCountry || raw.originCountry || raw.ursprungsland),
    bornIn: normalizeCountry(raw.bornIn || raw.geborenIn),
    raisedIn: normalizeCountry(raw.raisedIn || raw.aufgezogenIn || raw.gemaestetIn),
    slaughteredIn: normalizeCountry(raw.slaughteredIn || raw.geschlachtetIn),
    slaughterhouseNo: asTrimmedString(raw.slaughterhouseNo || raw.schlachthofNr, 80),
    cutIn: normalizeCountry(raw.cutIn || raw.zerlegtIn),
    cuttingPlantNo: asTrimmedString(
      raw.cuttingPlantNo || raw.zerlegebetriebNr || raw.cuttingPlant,
      80,
    ),
  };

  if (payload.isSingleOrigin && !payload.singleOriginCountry) {
    // Infer only from other recognized fields — never invent "Deutschland".
    payload.singleOriginCountry = payload.slaughteredIn || payload.raisedIn || '';
  }
  if (payload.organicAssociation && !ORGANIC_ASSOCIATIONS.has(payload.organicAssociation)) {
    payload.organicAssociation = '';
  }
  return payload;
}

function validateMeatLabelPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new HttpsError('invalid-argument', 'Ungültige Etikett-Daten aus der KI.');
  }
  if (!ANIMAL_TYPES.has(payload.animalType)) {
    throw new HttpsError('invalid-argument', 'Tierart aus der KI ist ungültig.');
  }
  // Empty organicAssociation is allowed (manual review). Non-empty must be known.
  if (payload.organicAssociation && !ORGANIC_ASSOCIATIONS.has(payload.organicAssociation)) {
    throw new HttpsError('invalid-argument', 'Bio-Verband aus der KI ist ungültig.');
  }
  // Mindestens eines der Kernfelder muss lesbar sein – sonst Failsafe manuell.
  const hasSignal = Boolean(
    payload.lotNumber
    || payload.healthMark
    || payload.organicControlBody
    || payload.singleOriginCountry
    || payload.slaughteredIn
    || payload.raisedIn,
  );
  if (!hasSignal) {
    throw new HttpsError('invalid-argument', 'Auf dem Etikett konnten keine LMIV-Daten erkannt werden.');
  }
  return payload;
}

async function loadImageFromStorage(tenantId, storagePath) {
  const cleaned = String(storagePath || '').trim().replace(/^\/+/, '');
  const prefix = `tenants/${tenantId}/`;
  if (!cleaned || !cleaned.startsWith(prefix)) {
    throw new HttpsError('permission-denied', 'Speicherpfad gehört nicht zu diesem Mandanten.');
  }
  if (cleaned.includes('..')) {
    throw new HttpsError('invalid-argument', 'Ungültiger Speicherpfad.');
  }

  try {
    const bucket = admin.storage().bucket();
    const file = bucket.file(cleaned);
    const [exists] = await file.exists();
    if (!exists) {
      throw new HttpsError('not-found', 'Etikett-Datei wurde nicht gefunden.');
    }
    const [buffer] = await file.download();
    const [metadata] = await file.getMetadata();
    const mimeType = String(metadata?.contentType || 'image/jpeg').trim().toLowerCase() || 'image/jpeg';
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new HttpsError('invalid-argument', 'Dateityp nicht erlaubt.');
    }
    const imageBase64 = buffer.toString('base64');
    if (!imageBase64 || imageBase64.length < 32) {
      throw new HttpsError('invalid-argument', 'Bilddaten fehlen oder sind zu kurz.');
    }
    if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
      throw new HttpsError('invalid-argument', 'Bild ist zu groß (max. 12 MB).');
    }
    return { imageBase64, mimeType };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('[parseMeatLabel] Storage-Download fehlgeschlagen:', error?.message || error);
    throw new HttpsError('internal', 'Etikett konnte nicht aus dem Speicher geladen werden.');
  }
}

async function resolveImagePayload(requestData, tenantId) {
  const imageBase64 = String(
    requestData?.imageBase64
    || requestData?.imageBytes
    || '',
  ).trim();
  const storagePath = String(requestData?.storagePath || requestData?.imagePath || '').trim();
  const mimeType = String(requestData?.mimeType || 'image/jpeg').trim().toLowerCase() || 'image/jpeg';

  if (imageBase64) {
    if (imageBase64.length < 32) {
      throw new HttpsError('invalid-argument', 'Bilddaten fehlen oder sind zu kurz.');
    }
    if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
      throw new HttpsError('invalid-argument', 'Bild ist zu groß (max. 12 MB).');
    }
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new HttpsError('invalid-argument', 'Dateityp nicht erlaubt.');
    }
    return { imageBase64, mimeType };
  }

  if (storagePath) {
    return loadImageFromStorage(tenantId, storagePath);
  }

  throw new HttpsError('invalid-argument', 'Bilddaten oder Speicherpfad fehlen.');
}

async function parseMeatLabelImage(imageBase64, mimeType = 'image/jpeg') {
  const apiKey = resolveGeminiApiKey();
  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({
    model: MEAT_LABEL_MODEL,
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  });

  let result;
  try {
    result = await model.generateContent([
      { text: MEAT_LABEL_PROMPT },
      { inlineData: { mimeType, data: imageBase64 } },
    ]);
  } catch (error) {
    console.error('[parseMeatLabel] Gemini-Fehler:', {
      message: error?.message,
      status: error?.status,
      isFetchError: error instanceof GoogleGenerativeAIFetchError,
    });
    throw new HttpsError('internal', 'Etikett konnte nicht analysiert werden.');
  }

  const responseText = result?.response?.text?.() || '';
  let parsedRaw;
  try {
    parsedRaw = extractJsonObject(responseText);
  } catch (error) {
    console.error('[parseMeatLabel] Parse-Fehler:', error?.message || error);
    throw new HttpsError('invalid-argument', 'KI-Antwort konnte nicht gelesen werden.');
  }

  return validateMeatLabelPayload(normalizeMeatLabelPayload(parsedRaw));
}

async function handleParseMeatLabel(request) {
  const callerContext = resolveAuthContext(request.auth);
  const tenantContext = requireEmployeeAccess(request.auth, callerContext.tenantId);

  const { imageBase64, mimeType } = await resolveImagePayload(request.data || {}, tenantContext.tenantId);
  const label = await parseMeatLabelImage(imageBase64, mimeType);

  return {
    label,
    model: MEAT_LABEL_MODEL,
    tenantId: tenantContext.tenantId,
    previewOnly: true,
  };
}

module.exports = {
  MEAT_LABEL_MODEL,
  handleParseMeatLabel,
  normalizeMeatLabelPayload,
  parseMeatLabelImage,
  validateMeatLabelPayload,
};
