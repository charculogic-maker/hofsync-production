import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { setGlobalTenantId } from '../web/tenant-db.js';
import { __syncTest, getDeadPendingSyncs, getPendingSyncs } from '../web/sync.js';

const TENANT_ID = 'StevesHof_Hauptbetrieb';
const LEGACY_TENANT_ID = 'steveshof_hauptbetrieb';

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    key: (index) => [...values.keys()][index] || null,
    get length() { return values.size; },
  };
}

describe('sync queue tenant migration', () => {
  beforeEach(() => {
    globalThis.localStorage = createMemoryStorage();
    globalThis.window = { showToast: () => {} };
    setGlobalTenantId(TENANT_ID);
    __syncTest.clearMigratedTenantStorageScopes();
  });

  afterEach(() => {
    setGlobalTenantId('');
    __syncTest.clearMigratedTenantStorageScopes();
    delete globalThis.localStorage;
    delete globalThis.window;
  });

  it('migrates lowercase pending queue keys and canonicalizes queued tenant paths', () => {
    const legacyKey = `charculogic.pendingSyncs.${LEGACY_TENANT_ID}`;
    const canonicalKey = `charculogic.pendingSyncs.${TENANT_ID}`;
    localStorage.setItem(legacyKey, JSON.stringify([
      {
        _id: 'queued-1',
        _syncType: 'firestore-doc',
        _collectionPath: `tenants/${LEGACY_TENANT_ID}/mhd_liste`,
        _docId: 'mhd-1',
        _op: 'set',
        data: { tenantId: LEGACY_TENANT_ID },
      },
    ]));

    const queue = getPendingSyncs();

    expect(queue).to.have.length(1);
    expect(queue[0]._collectionPath).to.equal(`tenants/${TENANT_ID}/mhd_liste`);
    expect(queue[0].data.tenantId).to.equal(TENANT_ID);
    expect(localStorage.getItem(legacyKey)).to.equal(null);
    expect(JSON.parse(localStorage.getItem(canonicalKey))).to.have.length(1);
  });

  it('migrates lowercase dead-letter queue keys without dropping existing canonical entries', () => {
    const legacyKey = `charculogic.pendingSyncs.dead.${LEGACY_TENANT_ID}`;
    const canonicalKey = `charculogic.pendingSyncs.dead.${TENANT_ID}`;
    localStorage.setItem(canonicalKey, JSON.stringify([
      {
        _id: 'dead-existing',
        _syncType: 'firestore-doc',
        _collectionPath: `tenants/${TENANT_ID}/tasks`,
        _docId: 'task-1',
        _op: 'update',
      },
    ]));
    localStorage.setItem(legacyKey, JSON.stringify([
      {
        _id: 'dead-legacy',
        _syncType: 'firestore-doc',
        _collectionPath: `tenants/${LEGACY_TENANT_ID}/haccp_logs`,
        _docId: 'haccp-1',
        _op: 'set',
      },
    ]));

    const queue = getDeadPendingSyncs();

    expect(queue.map((item) => item._id)).to.deep.equal(['dead-existing', 'dead-legacy']);
    expect(queue[1]._collectionPath).to.equal(`tenants/${TENANT_ID}/haccp_logs`);
    expect(localStorage.getItem(legacyKey)).to.equal(null);
  });

  it('rewrites matching tenant paths to the canonical claim casing during flush', () => {
    expect(__syncTest.normalizeTenantCollectionPath(`tenants/${LEGACY_TENANT_ID}/mhd_liste`))
      .to.equal(`tenants/${TENANT_ID}/mhd_liste`);
  });
});
