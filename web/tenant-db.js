/** Zentrale Mandanten-Firestore-Hilfen (White-Label / Multi-Tenant). */

let globalTenantId = null;
let firestoreDb = null;

export function initTenantDb(database) {
  firestoreDb = database || null;
}

export function normalizeTenantId(tenantId) {
  return typeof tenantId === 'string' ? tenantId.trim().toLowerCase() : '';
}

export function setGlobalTenantId(tenantId) {
  const normalized = normalizeTenantId(tenantId);
  globalTenantId = normalized || null;
  if (globalTenantId) {
    console.log(`[CharcuLogic] Mandant aktiv: ${globalTenantId}`);
  }
}

export function getGlobalTenantId() {
  return globalTenantId || '';
}

export function requireGlobalTenantId() {
  if (!globalTenantId) {
    throw new Error('Kritischer Fehler: Keine Tenant-ID gesetzt! Zugriff blockiert.');
  }
  return globalTenantId;
}

export function getTenantCollection(collectionName) {
  requireGlobalTenantId();
  if (!firestoreDb) {
    throw new Error('Kritischer Fehler: Firestore ist nicht initialisiert.');
  }
  const name = String(collectionName || '').replace(/^\/+|\/+$/g, '');
  if (!name) {
    throw new Error('Kritischer Fehler: Collection-Name fehlt.');
  }
  return firestoreDb.collection('tenants').doc(globalTenantId).collection(name);
}

export function getTenantCollectionPath(collectionName) {
  const name = String(collectionName || '').replace(/^\/+|\/+$/g, '');
  if (!name) {
    throw new Error('Kritischer Fehler: Collection-Name fehlt.');
  }
  return `tenants/${requireGlobalTenantId()}/${name}`;
}

export function getTenantDocRef(collectionName, docId) {
  return getTenantCollection(collectionName).doc(docId);
}
