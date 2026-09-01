const MHD_PENDING_CHANGES_KEY_PREFIX = 'charculogic.mhd.pendingChanges.';
const MHD_PENDING_CHANGES_VERSION = 1;

function getStorage(storage) {
  return storage || globalThis.localStorage || null;
}

function cleanTenantId(tenantId) {
  return String(tenantId || '').trim();
}

function normalizeChanges(changes = {}) {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return {};
  const normalized = {};
  Object.entries(changes).forEach(([id, updates]) => {
    const docId = String(id || '').trim();
    if (!docId || !updates || typeof updates !== 'object' || Array.isArray(updates)) return;
    const cleanUpdates = {};
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined) return;
      cleanUpdates[key] = value;
    });
    if (Object.keys(cleanUpdates).length) normalized[docId] = cleanUpdates;
  });
  return normalized;
}

export function getMhdPendingChangesStorageKey(tenantId) {
  const clean = cleanTenantId(tenantId);
  return clean ? `${MHD_PENDING_CHANGES_KEY_PREFIX}${clean}` : '';
}

export function saveMhdPendingChangesDraft({ tenantId, changes, storage } = {}) {
  const key = getMhdPendingChangesStorageKey(tenantId);
  const target = getStorage(storage);
  if (!key || !target) return { saved: false, count: 0 };

  const normalized = normalizeChanges(changes);
  const count = Object.keys(normalized).length;
  if (!count) {
    target.removeItem(key);
    return { saved: true, count: 0 };
  }

  target.setItem(key, JSON.stringify({
    version: MHD_PENDING_CHANGES_VERSION,
    tenantId: cleanTenantId(tenantId),
    savedAt: new Date().toISOString(),
    changes: normalized,
  }));
  return { saved: true, count };
}

export function loadMhdPendingChangesDraft({ tenantId, storage } = {}) {
  const key = getMhdPendingChangesStorageKey(tenantId);
  const target = getStorage(storage);
  if (!key || !target) return { changes: {}, count: 0 };

  const raw = target.getItem(key);
  if (!raw) return { changes: {}, count: 0 };

  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || parsed.tenantId !== cleanTenantId(tenantId)) {
    return { changes: {}, count: 0 };
  }

  const changes = normalizeChanges(parsed.changes);
  return {
    changes,
    count: Object.keys(changes).length,
    savedAt: parsed.savedAt || '',
  };
}

export function clearMhdPendingChangesDraft({ tenantId, storage } = {}) {
  const key = getMhdPendingChangesStorageKey(tenantId);
  const target = getStorage(storage);
  if (!key || !target) return false;
  target.removeItem(key);
  return true;
}
