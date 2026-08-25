import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import { setGlobalTenantId } from '../web/tenant-db.js';
import { addPendingSync, getPendingSyncs } from '../web/sync.js';

const TENANT_ID = 'StevesHof_Hauptbetrieb';
const LOWER_TENANT_ID = 'steveshof_hauptbetrieb';

function createLocalStorageMock() {
  const store = new Map();
  return {
    get length() {
      return store.size;
    },
    key(index) {
      return Array.from(store.keys())[index] || null;
    },
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

describe('offline sync tenant queue migration', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: createLocalStorageMock(),
      configurable: true,
    });
    Object.defineProperty(globalThis, 'window', {
      value: { showToast: () => {} },
      configurable: true,
    });
    Object.defineProperty(globalThis, 'document', {
      value: { getElementById: () => null },
      configurable: true,
    });
    setGlobalTenantId(TENANT_ID);
  });

  it('migrates lowercase tenant queue keys to the canonical tenant path', () => {
    localStorage.setItem(
      `charculogic.pendingSyncs.${LOWER_TENANT_ID}`,
      JSON.stringify([
        {
          _syncType: 'firestore-doc',
          _collectionPath: `tenants/${LOWER_TENANT_ID}/mhd_liste`,
          _docId: 'mhd-1',
          _op: 'set',
          data: {
            tenantId: LOWER_TENANT_ID,
            nested: { tenantId: LOWER_TENANT_ID },
            name: 'Joghurt',
          },
        },
      ]),
    );

    const queue = getPendingSyncs();

    expect(queue).to.have.length(1);
    expect(queue[0]._collectionPath).to.equal(`tenants/${TENANT_ID}/mhd_liste`);
    expect(queue[0].data.tenantId).to.equal(TENANT_ID);
    expect(queue[0].data.nested.tenantId).to.equal(TENANT_ID);
    expect(localStorage.getItem(`charculogic.pendingSyncs.${LOWER_TENANT_ID}`)).to.equal(null);
    expect(localStorage.getItem(`charculogic.pendingSyncs.${TENANT_ID}`)).to.be.a('string');
  });

  it('canonicalizes newly queued absolute tenant paths', () => {
    addPendingSync({
      _syncType: 'firestore-doc',
      _collectionPath: `tenants/${LOWER_TENANT_ID}/inventory`,
      _docId: 'receipt-1',
      _op: 'set',
      data: { tenantId: LOWER_TENANT_ID, artikel: 'Joghurt' },
    });

    const [entry] = getPendingSyncs();
    expect(entry._collectionPath).to.equal(`tenants/${TENANT_ID}/inventory`);
    expect(entry.data.tenantId).to.equal(TENANT_ID);
  });
});
