import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import {
  buildDeliveryParserPersistenceWrites,
  persistDeliveryParserRows,
} from '../web/delivery-parser-persistence.js';

const sampleRows = [
  { artikel: 'Rinder Hack', menge: 4.5, kategorie: 'Frischfleisch', mhdIso: '2026-10-05' },
  { artikel: 'Rinder Hack', menge: 2, kategorie: 'Frischfleisch', mhdIso: '2026-10-06' },
];

const buildOptions = {
  tenantId: 'StevesHof_Hauptbetrieb',
  author: 'Stephie',
  nowIso: '2026-10-01T10:00:00.000Z',
  batchId: 'ls_test_batch',
  getMhdKategorie: () => 'Fleisch & Wurst',
  getResttage: (mhdIso) => (mhdIso === '2026-10-05' ? 4 : 5),
  formatMhdDate: (mhdIso) => mhdIso.split('-').reverse().join('.'),
};

describe('delivery parser persistence', () => {
  let originalNavigatorDescriptor;

  beforeEach(() => {
    originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  });

  afterEach(() => {
    if (originalNavigatorDescriptor) {
      Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
    } else {
      delete globalThis.navigator;
    }
  });

  function setOnlineState(onLine) {
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine },
      configurable: true,
    });
  }

  it('builds tenant-scoped MHD and inventory writes without stammdaten targets', () => {
    const writes = buildDeliveryParserPersistenceWrites(sampleRows, buildOptions);

    expect(writes).to.have.length(4);
    expect(writes.map((write) => write.collectionPath)).to.deep.equal([
      'mhd_liste',
      'inventory',
      'mhd_liste',
      'inventory',
    ]);
    expect(writes.some((write) => write.collectionPath === 'stammdaten')).to.equal(false);
    expect(new Set(writes.map((write) => write.docId)).size).to.equal(2);

    const mhdWrites = writes.filter((write) => write.collectionPath === 'mhd_liste');
    expect(mhdWrites.map((write) => write.docId)).to.have.length(2);
    expect(new Set(mhdWrites.map((write) => write.docId)).size).to.equal(2);
    for (const write of mhdWrites) {
      expect(write.data.tenantId).to.equal('StevesHof_Hauptbetrieb');
      expect(write.data.source).to.equal('wareneingang-lieferschein');
      expect(write.data.scannedBy).to.equal('Stephie');
    }

    const inventoryWrites = writes.filter((write) => write.collectionPath === 'inventory');
    for (const write of inventoryWrites) {
      expect(write.data).to.include({
        tenantId: 'StevesHof_Hauptbetrieb',
        source: 'wareneingang-lieferschein',
        batchId: 'ls_test_batch',
        createdBy: 'Stephie',
      });
    }
  });

  it('commits all receipt docs in one online Firestore batch', async () => {
    setOnlineState(true);
    const setCalls = [];
    const batch = {
      set(ref, data, options) {
        setCalls.push({ ref, data, options });
      },
      commit: async () => {},
    };
    const firebaseApi = {
      firestore: () => ({
        batch: () => batch,
      }),
    };
    const queued = [];

    const result = await persistDeliveryParserRows(sampleRows, {
      ...buildOptions,
      firebaseApi,
      getDocRef: (collectionPath, docId) => ({ path: `tenants/${buildOptions.tenantId}/${collectionPath}/${docId}` }),
      writeOrQueueFirestore: (entry) => {
        queued.push(entry);
        return 'queued';
      },
    });

    expect(result).to.equal('written');
    expect(queued).to.deep.equal([]);
    expect(setCalls).to.have.length(4);
    expect(setCalls.map((call) => call.ref.path)).to.deep.equal([
      'tenants/StevesHof_Hauptbetrieb/mhd_liste/ls_test_batch_01_rinder-hack',
      'tenants/StevesHof_Hauptbetrieb/inventory/ls_test_batch_01_rinder-hack',
      'tenants/StevesHof_Hauptbetrieb/mhd_liste/ls_test_batch_02_rinder-hack',
      'tenants/StevesHof_Hauptbetrieb/inventory/ls_test_batch_02_rinder-hack',
    ]);
    expect(setCalls.every((call) => call.options?.merge === false)).to.equal(true);
  });

  it('queues MHD before inventory when offline', async () => {
    setOnlineState(false);
    const queued = [];

    const result = await persistDeliveryParserRows(sampleRows.slice(0, 1), {
      ...buildOptions,
      firebaseApi: null,
      getDocRef: () => {
        throw new Error('online batch should not be used');
      },
      writeOrQueueFirestore: async (entry) => {
        queued.push(entry);
        return 'queued';
      },
    });

    expect(result).to.equal('queued');
    expect(queued.map((entry) => entry.collectionPath)).to.deep.equal(['mhd_liste', 'inventory']);
    expect(queued[0].queueData.tenantId).to.equal('StevesHof_Hauptbetrieb');
    expect(queued[1].queueData.tenantId).to.equal('StevesHof_Hauptbetrieb');
  });
});
