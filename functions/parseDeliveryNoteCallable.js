/**
 * Callable isoliert – Gemini wird erst im Handler via deliveryNote.js geladen.
 */
const { onCall } = require('firebase-functions/v2/https');

const REGION = 'europe-west3';

exports.parseDeliveryNote = onCall(
  {
    region: REGION,
    secrets: ['GEMINI_API_KEY'],
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (request) => require('./deliveryNote').handleParseDeliveryNote(request),
);
