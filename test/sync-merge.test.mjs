import assert from 'node:assert/strict';

function installBrowserStubs() {
  const storage = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      showToast: () => {},
      updateOnlineStatusUi: () => {},
    },
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      getElementById: () => null,
    },
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { onLine: true },
  });
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: { randomUUID: () => 'queued-merge-test' },
  });
  return storage;
}

describe('sync merge writes', () => {
  let sync;
  let writes;
  let storage;
  let firebaseReady;

  beforeEach(async () => {
    writes = [];
    storage = installBrowserStubs();
    firebaseReady = true;

    sync = await import(`../web/sync.js?test=${Date.now()}-${Math.random()}`);
    sync.initSyncEngine({
      getDatabase: () => ({
        doc: (path) => ({
          set: async (payload, options) => {
            writes.push({ path, payload, options });
          },
        }),
      }),
      isFirebaseReady: () => firebaseReady,
      getFirebase: () => ({
        firestore: {
          FieldValue: {
            serverTimestamp: () => 'server-timestamp',
          },
        },
      }),
      getTenantId: () => 'StevesHof_Hauptbetrieb',
      showHUD: () => {},
    });
  });

  it('flushes queued merge writes without replacing untouched bulletin fields', async () => {
    navigator.onLine = false;
    firebaseReady = false;

    const queued = await sync.writeFirestoreDocOrQueue({
      collectionPath: 'bulletinBoard',
      docId: 'current',
      op: 'merge',
      onlineData: {
        message: 'Bestellungen stehen abholbereit.',
        author: 'Paddy',
        tenantId: 'StevesHof_Hauptbetrieb',
        updatedAt: 'server-timestamp',
      },
      queueData: {
        message: 'Bestellungen stehen abholbereit.',
        author: 'Paddy',
        tenantId: 'StevesHof_Hauptbetrieb',
        updatedAt: '2026-06-26T22:00:00.000Z',
      },
    });

    assert.equal(queued, 'queued');
    assert.deepEqual(writes, []);

    const queueKey = 'charculogic.pendingSyncs.StevesHof_Hauptbetrieb';
    const queuedEntries = JSON.parse(storage.get(queueKey));
    assert.equal(queuedEntries.length, 1);
    assert.equal(queuedEntries[0]._op, 'merge');
    assert.equal(Object.hasOwn(queuedEntries[0].data, 'attachments'), false);

    navigator.onLine = true;
    firebaseReady = true;
    await sync.flushPendingSyncs();

    assert.deepEqual(writes, [
      {
        path: 'tenants/StevesHof_Hauptbetrieb/bulletinBoard/current',
        payload: {
          message: 'Bestellungen stehen abholbereit.',
          author: 'Paddy',
          tenantId: 'StevesHof_Hauptbetrieb',
          updatedAt: '2026-06-26T22:00:00.000Z',
        },
        options: { merge: true },
      },
    ]);
    assert.deepEqual(JSON.parse(storage.get(queueKey)), []);
  });
});
