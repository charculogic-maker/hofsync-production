import { expect } from 'chai';
import { setGlobalTenantId } from '../web/tenant-db.js';
import { getPendingSyncs } from '../web/sync.js';

function createLocalStorage() {
  const data = new Map();
  return {
    get length() {
      return data.size;
    },
    key(index) {
      return Array.from(data.keys())[index] || null;
    },
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

describe('sync queue tenant casing migration', () => {
  it('moves legacy lowercase queues to the canonical tenant key', () => {
    globalThis.window = { showToast: () => {} };
    globalThis.localStorage = createLocalStorage();
    setGlobalTenantId('StevesHof_Hauptbetrieb');

    localStorage.setItem('charculogic.pendingSyncs.steveshof_hauptbetrieb', JSON.stringify([
      {
        _syncType: 'firestore-doc',
        _collectionPath: 'tenants/steveshof_hauptbetrieb/mhd_liste',
        _docId: 'mhd-1',
        _op: 'set',
        data: {
          tenantId: 'steveshof_hauptbetrieb',
          nested: { tenantId: 'steveshof_hauptbetrieb' },
        },
      },
    ]));

    const pending = getPendingSyncs();

    expect(localStorage.getItem('charculogic.pendingSyncs.steveshof_hauptbetrieb')).to.equal(null);
    expect(pending).to.have.lengthOf(1);
    expect(pending[0]._collectionPath).to.equal('tenants/StevesHof_Hauptbetrieb/mhd_liste');
    expect(pending[0].data.tenantId).to.equal('StevesHof_Hauptbetrieb');
    expect(pending[0].data.nested.tenantId).to.equal('StevesHof_Hauptbetrieb');
    expect(JSON.parse(localStorage.getItem('charculogic.pendingSyncs.StevesHof_Hauptbetrieb'))).to.have.lengthOf(1);
  });
});
