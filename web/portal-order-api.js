/**
 * Client-Aufruf submitPortalCustomerOrder für bestellen.html.
 */
import { ensurePreorderFirebase, resolvePreorderTenantId } from './catalog-overrides-db.js';
import { createHttpsCallable } from './firebase-functions.js';
import { mapPortalOrderToCustomerOrder } from './portal-order-mapper.js';

const LOCAL_PREORDER_KEY = 'steveshof.preorders.v1';

/**
 * @param {object} portalOrder
 * @param {{ tenantId?: string }} [options]
 * @returns {Promise<{ orderId: string, tenantId: string, portalRef: string|null, readyAt: string, localOnly?: boolean }>}
 */
export async function submitPortalOrderToFirestore(portalOrder, options = {}) {
  const tenantId = resolvePreorderTenantId(options.tenantId);
  // Client-seitige Vorprüfung (klare Fehlermeldung vor dem Netzwerk).
  const preview = mapPortalOrderToCustomerOrder(portalOrder, tenantId);

  const boot = ensurePreorderFirebase();
  if (!boot) {
    throw new Error('Verbindung zum Hofladen gerade nicht möglich. Bitte Seite neu laden.');
  }

  const callable = createHttpsCallable('submitPortalCustomerOrder', { timeout: 45000 });
  const result = await callable({
    tenantId,
    order: portalOrder,
    orderId: preview.orderId,
  });
  const data = result?.data || {};
  if (!data.ok || !data.orderId) {
    throw new Error('Bestellung konnte nicht übernommen werden.');
  }
  return {
    orderId: String(data.orderId),
    tenantId: String(data.tenantId || tenantId),
    portalRef: data.portalRef ? String(data.portalRef) : null,
    readyAt: data.readyAt ? String(data.readyAt) : String(preview.payload.readyAt || ''),
  };
}

/**
 * Lokale Kopie nur als Notiz/Backup – kein Ersatz für Packtisch.
 * @param {object} portalOrder
 * @param {{ firestoreOrderId?: string, synced?: boolean }} [meta]
 */
export function appendLocalPreorderBackup(portalOrder, meta = {}) {
  try {
    const existing = JSON.parse(localStorage.getItem(LOCAL_PREORDER_KEY) || '[]');
    if (!Array.isArray(existing)) {
      localStorage.setItem(LOCAL_PREORDER_KEY, JSON.stringify([{
        ...portalOrder,
        firestoreOrderId: meta.firestoreOrderId || null,
        synced: Boolean(meta.synced),
      }]));
      return;
    }
    existing.push({
      ...portalOrder,
      firestoreOrderId: meta.firestoreOrderId || null,
      synced: Boolean(meta.synced),
    });
    localStorage.setItem(LOCAL_PREORDER_KEY, JSON.stringify(existing));
  } catch (err) {
    console.error('[Bestellen] Lokales Backup fehlgeschlagen:', err);
  }
}

export { LOCAL_PREORDER_KEY };
