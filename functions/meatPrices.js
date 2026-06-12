/**
 * Fleischpreis-Automation – geplanter Lauf + manueller Admin-Trigger.
 * Lifecycle-Logging in /priceRuns/{runId}, Validierung vor Schreiben nach fleischpreise/.
 */
const { GoogleGenerativeAI, GoogleGenerativeAIFetchError } = require('@google/generative-ai');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const adminDb = require('./adminDb');
const { cleanTenantId } = require('./authContext');
const { randomUUID } = require('crypto');

const GEMINI_API_KEY_PLACEHOLDER = 'DEIN_AI_STUDIO_KEY';
const MODEL_VERSION = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const SCHEDULER_DEFAULT_TENANT_ID = 'StevesHof_Hauptbetrieb';
const TIME_ZONE = 'Europe/Berlin';
const SCHEDULE_CRON = '0 8 * * 3';
const REGION = 'europe-west3';

const MIN_PRICE_ENTRIES = 3;
const MAX_PRICE_EUR = 500;
const MAX_RAW_EVIDENCE_CHARS = 8000;

const PRICE_RUNS_COLLECTION = 'priceRuns';

const ERROR_CODES = {
  VALIDATION: 'ERR_LLM_VALIDATION_FAILED',
  PARSE: 'ERR_LLM_PARSE_FAILED',
  GEMINI_API: 'ERR_GEMINI_API_FAILED',
  CONFIG: 'ERR_CONFIG_FAILED',
  UNKNOWN: 'ERR_RUN_FAILED',
};

const logger = {
  error: (...args) => console.error(...args),
};

const MEAT_PRICE_PROJECT_ID = String(
  process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || '',
).trim();

const WHITELABEL_TEST_PROJECT_ID = 'charculogic-whitelabel-test';

function shouldSkipScheduledMeatPriceRun(projectId = MEAT_PRICE_PROJECT_ID) {
  return projectId === WHITELABEL_TEST_PROJECT_ID;
}

function resolveSchedulerTenantId() {
  const fromEnv = String(process.env.MEAT_PRICE_TENANT_ID || '').trim();
  return fromEnv || SCHEDULER_DEFAULT_TENANT_ID;
}

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
    // bracket extraction below
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
    price_conv: Number.isFinite(priceConv) ? priceConv : NaN,
    price_bio: Number.isFinite(priceBio) ? priceBio : NaN,
    trend: String(entry?.trend || '').trim(),
    last_update: String(entry?.last_update || '').trim(),
  };
}

function isPositiveMarketPrice(value) {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value > 0
    && value <= MAX_PRICE_EUR;
}

function validateParsedPrices(parsedArray) {
  if (!Array.isArray(parsedArray) || parsedArray.length < MIN_PRICE_ENTRIES) {
    throw new Error(
      `Validierung fehlgeschlagen: mindestens ${MIN_PRICE_ENTRIES} Preise erforderlich, erhalten: ${parsedArray?.length || 0}.`,
    );
  }

  const validated = [];
  parsedArray.forEach((entry, index) => {
    const row = normalizePriceEntry(entry, index);
    const hasConv = isPositiveMarketPrice(row.price_conv);
    const hasBio = isPositiveMarketPrice(row.price_bio);

    if (!row.category || !row.cut) {
      throw new Error(`Validierung fehlgeschlagen in Zeile ${index + 1}: category/cut fehlt.`);
    }
    if (!hasConv && !hasBio) {
      throw new Error(
        `Validierung fehlgeschlagen in Zeile ${index + 1}: kein gültiger Preis > 0 und <= ${MAX_PRICE_EUR}.`,
      );
    }

    validated.push({
      ...row,
      price_conv: hasConv ? row.price_conv : 0,
      price_bio: hasBio ? row.price_bio : 0,
    });
  });

  return validated;
}

function extractSourceUrls(groundingMetadata = {}) {
  const urls = new Set();

  if (Array.isArray(groundingMetadata.webSearchQueries)) {
    groundingMetadata.webSearchQueries.forEach((q) => {
      if (typeof q === 'string' && q.trim()) urls.add(`query:${q.trim()}`);
    });
  }

  const chunks = groundingMetadata.groundingChunks || groundingMetadata.groundingChuncks || [];
  if (Array.isArray(chunks)) {
    chunks.forEach((chunk) => {
      const uri = chunk?.web?.uri || chunk?.retrievedContext?.uri;
      if (typeof uri === 'string' && uri.trim()) urls.add(uri.trim());
    });
  }

  return [...urls];
}

function truncateRawEvidence(text) {
  const clean = String(text || '').trim();
  if (clean.length <= MAX_RAW_EVIDENCE_CHARS) return clean;
  return `${clean.slice(0, MAX_RAW_EVIDENCE_CHARS)}…`;
}

function createCorrelationId() {
  return randomUUID();
}

function classifyRunError(error) {
  const message = String(error?.message || '');
  if (message.includes('Validierung fehlgeschlagen')) return ERROR_CODES.VALIDATION;
  if (message.includes('GEMINI_API_KEY')) return ERROR_CODES.CONFIG;
  if (
    message.includes('JSON')
    || message.includes('Gemini lieferte')
    || message.includes('Kein JSON-Array')
  ) {
    return ERROR_CODES.PARSE;
  }
  if (error instanceof GoogleGenerativeAIFetchError) return ERROR_CODES.GEMINI_API;
  return ERROR_CODES.UNKNOWN;
}

function logRunFailureSecure(correlationId, error, context = {}) {
  logger.error(`[FLEISCHPREIS_RUN_FAILED] Correlation ID: ${correlationId}`, error, context);
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
  console.log('[DIAGNOSE] Genutztes Modell:', MODEL_VERSION);
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
}

function resolveGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (apiKey && apiKey !== GEMINI_API_KEY_PLACEHOLDER) {
    return apiKey;
  }
  throw new Error('GEMINI_API_KEY ist nicht gebunden. Secret in onSchedule/onCall und Cloud Secret Manager prüfen.');
}

async function fetchMeatPricesFromGemini() {
  logGeminiDiagnostics('gemini-fetch');

  const apiKey = resolveGeminiApiKey();
  const ai = new GoogleGenerativeAI(apiKey);
  const geminiRequestOptions = getGeminiRequestOptions();
  const model = ai.getGenerativeModel({
    model: MODEL_VERSION,
    tools: [{ googleSearch: {} }],
    generationConfig: { temperature: 0.2 },
  }, geminiRequestOptions);

  let result;
  try {
    result = await model.generateContent(buildMeatPricePrompt());
  } catch (error) {
    logGeminiDetailedError(error, {
      phase: 'generateContent',
      apiVersion: geminiRequestOptions.apiVersion,
      model: MODEL_VERSION,
    });
    throw error;
  }

  const responseText = result?.response?.text?.() || '';
  const groundingMetadata = result?.response?.candidates?.[0]?.groundingMetadata || {};
  const sourceUrls = extractSourceUrls(groundingMetadata);
  const rawEvidence = truncateRawEvidence(responseText);

  if (groundingMetadata?.webSearchQueries?.length) {
    console.log('[fetchWeeklyMeatPrices] Google Search Queries:', groundingMetadata.webSearchQueries);
  } else {
    console.warn('[fetchWeeklyMeatPrices] Keine groundingMetadata.webSearchQueries – Suche evtl. nicht ausgeführt.');
  }

  const parsedArray = extractJsonArray(responseText);
  const validatedPrices = validateParsedPrices(parsedArray);

  console.log(
    `[fetchWeeklyMeatPrices] Gemini OK: ${validatedPrices.length} Preise validiert (${MODEL_VERSION}).`,
  );

  return {
    validatedPrices,
    modelUsed: MODEL_VERSION,
    sourceUrls,
    rawEvidence,
    groundingMetadata,
  };
}

function priceRunRef(runId) {
  return adminDb.firestore().collection(PRICE_RUNS_COLLECTION).doc(runId);
}

async function initializePriceRun({ tenantId, initiatedBy, scheduleEventId = null }) {
  if (!tenantId) throw new Error('tenantId ist erforderlich.');
  const runId = randomUUID();
  const { year: jahr, week } = getCalendarWeekParts();
  const kw = buildDocId(jahr, week);

  await priceRunRef(runId).set({
    runId,
    tenantId,
    targetDocId: kw,
    targetPath: `tenants/${tenantId}/fleischpreise/${kw}`,
    startedAt: adminDb.FieldValue.serverTimestamp(),
    status: 'running',
    initiatedBy: initiatedBy || 'system',
    modelVersion: MODEL_VERSION,
    scheduleEventId: scheduleEventId || null,
    timeZone: TIME_ZONE,
  });

  return { runId, jahr, week, kw, tenantId };
}

async function finalizePriceRunSuccess(runId, payload) {
  await priceRunRef(runId).update({
    finishedAt: adminDb.FieldValue.serverTimestamp(),
    status: 'success',
    sourceUrls: payload.sourceUrls || [],
    rawEvidence: payload.rawEvidence || '',
    parsedValues: payload.validatedPrices || [],
    priceCount: payload.validatedPrices?.length || 0,
    firestorePath: payload.firestorePath || null,
  });
}

async function finalizePriceRunFailure(runId, error, correlationId) {
  const errorCode = classifyRunError(error);
  await priceRunRef(runId).update({
    finishedAt: adminDb.FieldValue.serverTimestamp(),
    status: 'failed',
    correlationId,
    errorCode,
  }).catch((updateErr) => {
    logger.error('[FLEISCHPREIS_RUN_FAILED] priceRuns-Update fehlgeschlagen', updateErr);
  });
}

async function publishValidatedPrices({
  tenantId,
  validatedPrices,
  modelUsed,
  jahr,
  week,
  kw,
  runId,
}) {
  if (!tenantId) throw new Error('tenantId ist erforderlich.');
  const firestorePath = `tenants/${tenantId}/fleischpreise/${kw}`;

  await adminDb.firestore().doc(firestorePath).set({
    tenantId,
    kw,
    jahr,
    week,
    preise: validatedPrices,
    prices: validatedPrices,
    priceCount: validatedPrices.length,
    source: 'gemini',
    modelUsed,
    model: modelUsed,
    priceRunId: runId,
    fetchedAt: adminDb.FieldValue.serverTimestamp(),
    updatedAt: adminDb.FieldValue.serverTimestamp(),
  });

  console.log(`[fetchWeeklyMeatPrices] Firestore geschrieben: ${firestorePath} (${validatedPrices.length} Preise).`);
  return firestorePath;
}

/**
 * Kernpipeline – wird von Scheduler und manuellem Callable gemeinsam genutzt.
 * Bei Fehler: priceRuns = failed, fleischpreise/ bleibt unverändert.
 */
async function executeMeatPriceRun({
  tenantId,
  initiatedBy = 'system',
  scheduleEventId = null,
  deps = {},
} = {}) {
  if (!tenantId) throw new Error('tenantId ist erforderlich.');
  const fetchPricesFn = deps.fetchMeatPricesFromGemini || fetchMeatPricesFromGemini;
  const publishFn = deps.publishValidatedPrices || publishValidatedPrices;
  const initRunFn = deps.initializePriceRun || initializePriceRun;
  const successFn = deps.finalizePriceRunSuccess || finalizePriceRunSuccess;
  const failureFn = deps.finalizePriceRunFailure || finalizePriceRunFailure;
  const logFailureFn = deps.logRunFailure || logRunFailureSecure;

  const run = await initRunFn({ tenantId, initiatedBy, scheduleEventId });

  try {
    const gemini = await fetchPricesFn();
    const firestorePath = await publishFn({
      tenantId,
      validatedPrices: gemini.validatedPrices,
      modelUsed: gemini.modelUsed,
      jahr: run.jahr,
      week: run.week,
      kw: run.kw,
      runId: run.runId,
    });

    await successFn(run.runId, {
      validatedPrices: gemini.validatedPrices,
      sourceUrls: gemini.sourceUrls,
      rawEvidence: gemini.rawEvidence,
      firestorePath,
    });

    return {
      ok: true,
      runId: run.runId,
      kw: run.kw,
      jahr: run.jahr,
      week: run.week,
      firestorePath,
      priceCount: gemini.validatedPrices.length,
      modelUsed: gemini.modelUsed,
      tenantId,
      initiatedBy,
    };
  } catch (error) {
    const correlationId = createCorrelationId();
    await failureFn(run.runId, error, correlationId);
    logFailureFn(correlationId, error, { runId: run.runId, tenantId, initiatedBy });
    throw error;
  }
}

const scheduledMeatPriceOptions = {
  schedule: SCHEDULE_CRON,
  timeZone: TIME_ZONE,
  retryCount: 2,
  timeoutSeconds: 120,
  secrets: ['GEMINI_API_KEY'],
};

exports.fetchWeeklyMeatPrices = onSchedule(
  scheduledMeatPriceOptions,
  async (event) => {
    if (shouldSkipScheduledMeatPriceRun()) {
      console.log(
        '[fetchWeeklyMeatPrices] Scheduler übersprungen — Whitelabel-Testprojekt ohne Fleischpreis-Pipeline.',
        { projectId: MEAT_PRICE_PROJECT_ID },
      );
      return {
        ok: true,
        skipped: true,
        reason: 'whitelabel-test-project',
        projectId: MEAT_PRICE_PROJECT_ID,
      };
    }

    logGeminiDiagnostics('scheduler-start');
    return executeMeatPriceRun({
      tenantId: resolveSchedulerTenantId(),
      initiatedBy: 'system',
      scheduleEventId: event?.id || null,
    });
  },
);

exports.triggerManualMeatPriceRun = onCall(
  {
    region: REGION,
    enforceAppCheck: true,
    timeoutSeconds: 120,
    memory: '512MiB',
    secrets: ['GEMINI_API_KEY'],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Anmeldung erforderlich.');
    }
    if (request.auth.token?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Nur Admins dürfen einen manuellen Fleischpreis-Lauf starten.');
    }

    const tenantId = cleanTenantId(request.auth.token?.tenantId);
    if (!tenantId) {
      throw new HttpsError('unauthenticated', 'Custom Claim tenantId fehlt.');
    }

    logGeminiDiagnostics('manual-trigger');
    return executeMeatPriceRun({ tenantId, initiatedBy: request.auth.uid });
  },
);

module.exports = {
  executeMeatPriceRun,
  fetchWeeklyMeatPrices: exports.fetchWeeklyMeatPrices,
  triggerManualMeatPriceRun: exports.triggerManualMeatPriceRun,
  extractJsonArray,
  sanitizeGeminiResponseText,
  validateParsedPrices,
  classifyRunError,
  createCorrelationId,
  finalizePriceRunFailure,
  logRunFailureSecure,
  logGeminiDiagnostics,
  logGeminiDetailedError,
  logger,
  ERROR_CODES,
  GoogleGenerativeAIFetchError,
  resolveSchedulerTenantId,
  shouldSkipScheduledMeatPriceRun,
  WHITELABEL_TEST_PROJECT_ID,
  SCHEDULER_DEFAULT_TENANT_ID,
  MODEL_VERSION,
  modelName: MODEL_VERSION,
  TIME_ZONE,
  SCHEDULE_CRON,
  publishValidatedPrices,
  initializePriceRun,
};
