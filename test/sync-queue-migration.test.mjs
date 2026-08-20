import { expect } from 'chai';

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  get length() {
    return this.values.size;
  }

  key(index) {
    return [...this.values.keys()][index] || null;
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(String(key), String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

describe('offline sync queue tenant migration', () => {
  let sync;
  let tenantDb;
  let storage;

  before(async () => {
    global.window = global.window || { showToast: () => {} };
    global.document = global.document || { getElementById: () => null };
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { onLine: true },
    });
    storage = new MemoryStorage();
    global.localStorage = storage;

    tenantDb = await import('../web/tenant-db.js');
    sync = await import('../web/sync.js');
  });

  beforeEach(() => {
    storage.values.clear();
    tenantDb.setGlobalTenantId('StevesHof_Hauptbetrieb');
    sync.initSyncEngine({ getTenantId: () => 'StevesHof_Hauptbetrieb' });
  });

  it('moves lowercase pending syncs to the canonical tenant key', () => {
    storage.setItem('charculogic.pendingSyncs.steveshof_hauptbetrieb', JSON.stringify([
      {
        _syncType: 'firestore-doc',
        _collectionPath: 'tenants/steveshof_hauptbetrieb/mhd_liste',
        _docId: 'mhd-1',
        _op: 'set',
        data: { tenantId: 'steveshof_hauptbetrieb', name: 'Probe', qty: 1 },
      },
    ]));

    const pending = sync.getPendingSyncs();

    expect(storage.getItem('charculogic.pendingSyncs.steveshof_hauptbetrieb')).to.equal(null);
    expect(pending).to.have.length(1);
    expect(pending[0]._collectionPath).to.equal('tenants/StevesHof_Hauptbetrieb/mhd_liste');
    expect(pending[0].data.tenantId).to.equal('StevesHof_Hauptbetrieb');
  });

  it('canonicalizes lowercase tenant paths already stored under the canonical key', () => {
    storage.setItem('charculogic.pendingSyncs.StevesHof_Hauptbetrieb', JSON.stringify([
      {
        _syncType: 'firestore-doc',
        _collectionPath: 'tenants/steveshof_hauptbetrieb/haccp_logs',
        _docId: 'haccp-1',
        _op: 'set',
        data: { tenantId: 'steveshof_hauptbetrieb', temperatur: 4 },
      },
    ]));

    const pending = sync.getPendingSyncs();

    expect(pending[0]._collectionPath).to.equal('tenants/StevesHof_Hauptbetrieb/haccp_logs');
    expect(pending[0].data.tenantId).to.equal('StevesHof_Hauptbetrieb');
  });

  it('moves lowercase dead-letter syncs to the canonical tenant key', () => {
    storage.setItem('charculogic.pendingSyncs.dead.steveshof_hauptbetrieb', JSON.stringify([
      {
        _syncType: 'firestore-doc',
        _collectionPath: 'tenants/steveshof_hauptbetrieb/customerOrders',
        _docId: 'order-1',
        _op: 'update',
        data: { tenantId: 'steveshof_hauptbetrieb', status: 'ready' },
      },
    ]));

    const dead = sync.getDeadPendingSyncs();

    expect(storage.getItem('charculogic.pendingSyncs.dead.steveshof_hauptbetrieb')).to.equal(null);
    expect(dead).to.have.length(1);
    expect(dead[0]._collectionPath).to.equal('tenants/StevesHof_Hauptbetrieb/customerOrders');
    expect(dead[0].data.tenantId).to.equal('StevesHof_Hauptbetrieb');
  });
});
