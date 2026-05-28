/**
 * Cloud Functions Einstieg – schlanke index.js für schnelles Deploy-Analyse-Timeout.
 * Schwere Module (Gemini) werden erst beim Scheduler-Lauf geladen.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const TIME_ZONE = 'Europe/Berlin';

exports.notifyTeamEntryCreated = require('./teamPush').notifyTeamEntryCreated;

exports.fetchWeeklyMeatPrices = onSchedule({
  schedule: '0 8 * * 3',
  timeZone: TIME_ZONE,
  retryCount: 2,
  timeoutSeconds: 120,
  secrets: ['GEMINI_API_KEY'],
}, async (event) => {
  const meatPrices = require('./meatPrices');
  meatPrices.logGeminiDiagnostics('scheduler-start');
  try {
    return await meatPrices.persistWeeklyMeatPrices();
  } catch (error) {
    meatPrices.logGeminiDetailedError(error, {
      eventId: event?.id,
      tenantId: meatPrices.TENANT_ID,
      model: meatPrices.modelName,
    });
    if (!(error instanceof meatPrices.GoogleGenerativeAIFetchError)) {
      console.error('[FIRESTORE_WRITE_FAILED]', error);
    }
    throw error;
  }
});
