/**
 * Öffentliche Soft-Launch-Callable: Portal-Vorbestellung → tenants/{id}/customerOrders.
 * Kein Kunden-Login; Tenant-Allowlist + Payload-Validierung serverseitig.
 * Admin-SDK umgeht Client-Rules (Create bleibt Mitarbeiter-only).
 */
const { HttpsError, onCall } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');
const { ensureAdminApp, getAdminDb } = require('./firebaseAdmin');
const {
  mapPortalOrderToCustomerOrder,
  trimStr,
} = require('./portalOrderMapper');

const REGION = 'europe-west3';

/**
 * @param {import('firebase-functions/v2/https').CallableRequest} request
 */
async function handleSubmitPortalCustomerOrder(request) {
  ensureAdminApp();
  const data = request.data && typeof request.data === 'object' ? request.data : {};
  const tenantId = trimStr(data.tenantId);
  const portalOrder = data.order && typeof data.order === 'object' ? data.order : null;

  if (!tenantId) {
    throw new HttpsError('invalid-argument', 'Betrieb fehlt.');
  }
  if (!portalOrder) {
    throw new HttpsError('invalid-argument', 'Bestellung fehlt.');
  }

  let mapped;
  try {
    mapped = mapPortalOrderToCustomerOrder(portalOrder, tenantId, {
      orderId: trimStr(data.orderId) || undefined,
    });
  } catch (err) {
    const code = err?.code === 'failed-precondition' ? 'failed-precondition' : 'invalid-argument';
    throw new HttpsError(code, err?.message || 'Bestellung ungültig.');
  }

  const db = getAdminDb();
  const ref = db
    .collection('tenants')
    .doc(mapped.tenantId)
    .collection('customerOrders')
    .doc(mapped.orderId);

  const existing = await ref.get();
  if (existing.exists) {
    throw new HttpsError('already-exists', 'Diese Bestellung wurde bereits übernommen.');
  }

  const payload = {
    ...mapped.payload,
    createdAt: FieldValue.serverTimestamp(),
    acceptedAt: FieldValue.serverTimestamp(),
  };

  await ref.set(payload);

  console.log('[PortalOrder] customerOrder angelegt', {
    tenantId: mapped.tenantId,
    orderId: mapped.orderId,
    portalRef: mapped.payload.portalRef || null,
    itemCount: Array.isArray(mapped.payload.items) ? mapped.payload.items.length : 0,
  });

  return {
    ok: true,
    orderId: mapped.orderId,
    tenantId: mapped.tenantId,
    portalRef: mapped.payload.portalRef || null,
    readyAt: mapped.payload.readyAt,
  };
}

exports.handleSubmitPortalCustomerOrder = handleSubmitPortalCustomerOrder;

exports.submitPortalCustomerOrder = onCall(
  {
    region: REGION,
    cors: true,
    // Öffentliches Vorbestellportal (Vercel) – gleiches Muster wie provisionDemoTenant.
    enforceAppCheck: false,
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  handleSubmitPortalCustomerOrder,
);
