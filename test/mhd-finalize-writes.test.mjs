import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const mod = await import(pathToFileURL(path.resolve('web/mhd-finalize-writes.js')).href);
const { commitDeliveryFinalizeWrites } = mod;

function makeWrite(kind, docId) {
  const collectionPath = kind === 'delivery'
    ? 'tenants/StevesHof_Hauptbetrieb/wareneingang_lieferungen'
    : 'tenants/StevesHof_Hauptbetrieb/mhd_liste';
  return {
    collectionPath,
    docId,
    op: kind === 'existing-mhd' ? 'update' : 'set',
    onlineData: { id: docId, online: true },
    queueData: { id: docId, queued: true },
  };
}

function makeBatchDb(commitImpl = async () => {}) {
  const ops = [];
  const db = {
    ops,
    doc: (docPath) => ({ path: docPath }),
    batch: () => ({
      set: (ref, data, options) => ops.push({ op: 'set', path: ref.path, data, options }),
      update: (ref, data) => ops.push({ op: 'update', path: ref.path, data }),
      delete: (ref) => ops.push({ op: 'delete', path: ref.path }),
      commit: commitImpl,
    }),
  };
  return db;
}

describe('mhd finalize writes', () => {
  it('commits delivery header and MHD rows in one Firestore batch when online', async () => {
    const db = makeBatchDb();
    const queued = [];

    const result = await commitDeliveryFinalizeWrites({
      db,
      firebaseReady: true,
      online: true,
      addPendingSync: (entry) => { queued.push(entry); return true; },
      deliveryWrite: makeWrite('delivery', 'lieferung-1'),
      mhdWrites: [
        makeWrite('mhd', 'mhd-new'),
        makeWrite('existing-mhd', 'mhd-existing'),
      ],
    });

    assert.deepEqual(result, { deliveryResult: 'written', mhdResults: ['written', 'written'] });
    assert.equal(queued.length, 0);
    assert.deepEqual(db.ops.map((op) => [op.op, op.path]), [
      ['set', 'tenants/StevesHof_Hauptbetrieb/wareneingang_lieferungen/lieferung-1'],
      ['set', 'tenants/StevesHof_Hauptbetrieb/mhd_liste/mhd-new'],
      ['update', 'tenants/StevesHof_Hauptbetrieb/mhd_liste/mhd-existing'],
    ]);
  });

  it('queues MHD rows before the completed delivery header when offline', async () => {
    const queued = [];

    const result = await commitDeliveryFinalizeWrites({
      db: null,
      firebaseReady: false,
      online: false,
      addPendingSync: (entry) => { queued.push(entry); return true; },
      deliveryWrite: makeWrite('delivery', 'lieferung-1'),
      mhdWrites: [
        makeWrite('mhd', 'mhd-a'),
        makeWrite('mhd', 'mhd-b'),
      ],
    });

    assert.deepEqual(result, { deliveryResult: 'queued', mhdResults: ['queued', 'queued'] });
    assert.deepEqual(queued.map((entry) => entry._docId), ['mhd-a', 'mhd-b', 'lieferung-1']);
    assert.deepEqual(queued.map((entry) => entry._collectionPath), [
      'tenants/StevesHof_Hauptbetrieb/mhd_liste',
      'tenants/StevesHof_Hauptbetrieb/mhd_liste',
      'tenants/StevesHof_Hauptbetrieb/wareneingang_lieferungen',
    ]);
  });

  it('does not queue or write a completed header after non-retryable batch failures', async () => {
    const db = makeBatchDb(async () => {
      const error = new Error('Missing or insufficient permissions');
      error.code = 'permission-denied';
      throw error;
    });
    const queued = [];

    await assert.rejects(
      commitDeliveryFinalizeWrites({
        db,
        firebaseReady: true,
        online: true,
        addPendingSync: (entry) => { queued.push(entry); return true; },
        deliveryWrite: makeWrite('delivery', 'lieferung-1'),
        mhdWrites: [makeWrite('mhd', 'mhd-a')],
      }),
      /Missing or insufficient permissions/,
    );

    assert.equal(queued.length, 0);
  });

  it('falls back to safe queue order after retryable batch failures', async () => {
    const db = makeBatchDb(async () => {
      const error = new Error('network timeout');
      error.code = 'unavailable';
      throw error;
    });
    const queued = [];

    const result = await commitDeliveryFinalizeWrites({
      db,
      firebaseReady: true,
      online: true,
      addPendingSync: (entry) => { queued.push(entry); return true; },
      deliveryWrite: makeWrite('delivery', 'lieferung-1'),
      mhdWrites: [makeWrite('mhd', 'mhd-a')],
    });

    assert.deepEqual(result, { deliveryResult: 'queued', mhdResults: ['queued'] });
    assert.deepEqual(queued.map((entry) => entry._docId), ['mhd-a', 'lieferung-1']);
  });
});
