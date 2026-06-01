/**
 * Callable isoliert – Gemini wird erst im Handler via deliveryNote.js geladen.
 */
const { onCall } = require('firebase-functions/v2/https');

const REGION = 'europe-west3';

const CALLABLE_BASE_OPTIONS = {
  region: REGION,
  enforceAppCheck: true,
};

exports.parseDeliveryNote = onCall(
  {
    ...CALLABLE_BASE_OPTIONS,
    secrets: ['GEMINI_API_KEY'],
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (request) => require('./deliveryNote').handleParseDeliveryNote(request),
);
