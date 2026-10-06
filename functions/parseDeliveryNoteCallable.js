/**
 * Callable isoliert – Gemini wird erst im Handler via deliveryNote.js geladen.
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const REGION = 'europe-west3';

function claimText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isAdminClaim(token) {
  const role = claimText(token?.role);
  return role === 'admin' || token?.isAdmin === true || token?.admin === true;
}

function tenantIdFromClaim(token) {
  return claimText(token?.tenantId || token?.tenant_id || token?.tenantID);
}

/**
 * Sitzung muss stehen. Admins mit tenantId bleiben erlaubt;
 * fehlende Rolle blockiert sie nicht, wenn das Admin-Claim gesetzt ist.
 */
function assertDeliveryNoteCaller(request) {
  if (!request?.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Keine aktive HofSync-Sitzung gefunden.');
  }
  const token = request.auth.token || {};
  const tenantId = tenantIdFromClaim(token);
  const admin = isAdminClaim(token);
  if (!tenantId) {
    throw new HttpsError(
      'permission-denied',
      admin
        ? 'Admin-Sitzung ohne Mandanten-Claim. Bitte tenantId setzen und erneut anmelden.'
        : 'Custom Claim tenantId fehlt.',
    );
  }
  const role = claimText(token.role);
  if (!admin && role !== 'employee') {
    throw new HttpsError('permission-denied', 'Mitarbeiter- oder Admin-Rolle erforderlich.');
  }
  return { uid: request.auth.uid, tenantId, isAdmin: admin, role: admin ? 'admin' : role };
}

exports.assertDeliveryNoteCaller = assertDeliveryNoteCaller;

exports.parseDeliveryNote = onCall(
  {
    region: REGION,
    enforceAppCheck: false,
    secrets: ['GEMINI_API_KEY'],
    timeoutSeconds: 120,
    memory: '1GiB',
  },
  async (request) => {
    assertDeliveryNoteCaller(request);
    const { ensureAdminApp } = require('./firebaseAdmin');
    ensureAdminApp();
    return require('./deliveryNote').handleParseDeliveryNote(request);
  },
);
