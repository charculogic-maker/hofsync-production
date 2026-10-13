import { describe, it } from 'mocha';
import { expect } from 'chai';
import {
  commitFinalizeDeliveryBatch,
  queueFinalizeDeliveryWrites,
  writeFinalizeDeliveryBundle,
} from '../web/mhd-finalize-writes.js';

function createFakeDb({ commitRejectsWith = null } = {}) {
  const operations = [];
  const db = {
    doc: (path) => ({ path }),
    batch: () => ({
      set: (ref, data, options) => {
        operations.push({ type: 'set', path: ref.path, data, options });
      },
      commit: () => (commitRejectsWith ? Promise.reject(commitRejectsWith) : Promise.resolve()),
    }),
  };
  return { db, operations };
}

const deliveryWrite = {
  collectionPath: 'tenants/demo/wareneingang_lieferungen',
  docId: 'lieferung_1',
  op: 'set',
  onlineData: { status: 'completed', itemCount: 2 },
  queueData: { status: 'completed', itemCount: 2 },
};

const mhdWrites = [
  {
    collectionPath: 'tenants/demo/mhd_liste',
    docId: 'mhd_a',
    op: 'set',
    onlineData: { name: 'Artikel A', qty: 1 },
    queueData: { name: 'Artikel A', qty: 1 },
  },
  {
    collectionPath: 'tenants/demo/mhd_liste',
    docId: 'mhd_b',
    op: 'update',
    onlineData: { name: 'Artikel B', qty: 3 },
    queueData: { name: 'Artikel B', qty: 3 },
  },
];

describe('mhd finalize delivery writes', () => {
  it('commits MHD rows and completed delivery header in one Firestore batch', async () => {
    const { db, operations } = createFakeDb();

    const result = await commitFinalizeDeliveryBatch({ db, deliveryWrite, mhdWrites });

    expect(result).to.equal('written');
    expect(operations.map((op) => op.path)).to.deep.equal([
      'tenants/demo/mhd_liste/mhd_a',
      'tenants/demo/mhd_liste/mhd_b',
      'tenants/demo/wareneingang_lieferungen/lieferung_1',
    ]);
    expect(operations[0].options).to.deep.equal({ merge: true });
    expect(operations[2].options).to.deep.equal({ merge: false });
  });

  it('queues MHD rows before the completed delivery header when offline', async () => {
    const calls = [];

    const result = await queueFinalizeDeliveryWrites({
      deliveryWrite,
      mhdWrites,
      writeOrQueueFirestore: async (call) => {
        calls.push(call);
        return 'queued';
      },
    });

    expect(result).to.equal('queued');
    expect(calls.map((call) => `${call.collectionPath}/${call.docId}`)).to.deep.equal([
      'tenants/demo/mhd_liste/mhd_a',
      'tenants/demo/mhd_liste/mhd_b',
      'tenants/demo/wareneingang_lieferungen/lieferung_1',
    ]);
  });

  it('does not queue a completed delivery header after a non-retryable batch denial', async () => {
    const denied = Object.assign(new Error('denied'), { code: 'permission-denied' });
    const { db } = createFakeDb({ commitRejectsWith: denied });
    const calls = [];

    let thrown = null;
    try {
      await writeFinalizeDeliveryBundle({
        db,
        isFirebaseReady: () => true,
        navigatorRef: { onLine: true },
        deliveryWrite,
        mhdWrites,
        writeOrQueueFirestore: async (call) => {
          calls.push(call);
          return 'queued';
        },
      });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).to.equal(denied);
    expect(calls).to.deep.equal([]);
  });

  it('falls back to queued MHD rows before header on retryable batch errors', async () => {
    const unavailable = Object.assign(new Error('network unavailable'), { code: 'unavailable' });
    const { db } = createFakeDb({ commitRejectsWith: unavailable });
    const calls = [];
    const originalWarn = console.warn;
    console.warn = () => {};

    let result = null;
    try {
      result = await writeFinalizeDeliveryBundle({
        db,
        isFirebaseReady: () => true,
        navigatorRef: { onLine: true },
        deliveryWrite,
        mhdWrites,
        writeOrQueueFirestore: async (call) => {
          calls.push(call);
          return 'queued';
        },
      });
    } finally {
      console.warn = originalWarn;
    }

    expect(result).to.equal('queued');
    expect(calls.map((call) => `${call.collectionPath}/${call.docId}`)).to.deep.equal([
      'tenants/demo/mhd_liste/mhd_a',
      'tenants/demo/mhd_liste/mhd_b',
      'tenants/demo/wareneingang_lieferungen/lieferung_1',
    ]);
  });
});
