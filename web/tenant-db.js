/** Zentrale Mandanten-Firestore-Hilfen (White-Label / Multi-Tenant). */

let globalTenantId = null;
let firestoreDb = null;

export function initTenantDb(database) {
  firestoreDb = database || null;
}

/** Firestore-Pfade und Custom Claims: exakte Schreibweise beibehalten. */
export function canonicalTenantId(tenantId) {
  return typeof tenantId === 'string' ? tenantId.trim() : '';
}

/** localStorage, Branding-Index, Vergleiche: immer lowercase. */
export function normalizeTenantId(tenantId) {
  return canonicalTenantId(tenantId).toLowerCase();
}

export function tenantIdsMatch(left, right) {
  const a = normalizeTenantId(left);
  const b = normalizeTenantId(right);
  return Boolean(a && b && a === b);
}

export function setGlobalTenantId(tenantId) {
  const canonical = canonicalTenantId(tenantId);
  globalTenantId = canonical || null;
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

export function getNamedTenantCollection(tenantId, collectionName) {
  const id = canonicalTenantId(tenantId);
  if (!id) {
    throw new Error('Kritischer Fehler: Keine Tenant-ID gesetzt! Zugriff blockiert.');
  }
  if (!firestoreDb) {
    throw new Error('Kritischer Fehler: Firestore ist nicht initialisiert.');
  }
  const name = String(collectionName || '').replace(/^\/+|\/+$/g, '');
  if (!name || name.includes('/')) {
    throw new Error('Kritischer Fehler: Collection-Name fehlt.');
  }
  return firestoreDb.collection('tenants').doc(id).collection(name);
}
