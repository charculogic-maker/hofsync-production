/**
 * Offline sync queue: upsert, retryCount / dead-letter, write-only add.
 */
import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';

const memoryStore = new Map();

function installGlobals() {
  globalThis.window = globalThis.window || globalThis;
  globalThis.window.showToast = () => {};
  globalThis.localStorage = {
    getItem: (key) => (memoryStore.has(key) ? memoryStore.get(key) : null),
    setItem: (key, value) => { memoryStore.set(String(key), String(value)); },
    removeItem: (key) => { memoryStore.delete(String(key)); },
    clear: () => { memoryStore.clear(); },
  };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { onLine: true, userAgent: 'sync-queue-test' },
  });
  if (!globalThis.crypto?.randomUUID) {
    globalThis.crypto = {
      randomUUID: () => `test-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    };
  }
}

installGlobals();

const {
  MAX_SYNC_RETRIES,
  addPendingSync,
  clearAllPendingSyncQueues,
  flushOnePendingSync,
  flushPendingSyncs,
  getDeadPendingSyncs,
  getPendingSyncs,
  getSyncErrors,
  initSyncEngine,
  isFatalSyncError,
  writeFirestoreDocOrQueue,
} = await import('../web/sync.js');
const { setGlobalTenantId } = await import('../web/tenant-db.js');

const TENANT = 'TestHof_SyncQueue';

function makeDbMock({ onSet, onUpdate, onAdd, onDelete, onGet } = {}) {
  const docs = new Map();
  const collection = (path) => ({
    add: async (payload) => {
      onAdd?.(path, payload);
      const id = `auto-${docs.size + 1}`;
      docs.set(`${path}/${id}`, payload);
      return { id };
    },
    doc: (id) => {
      const full = `${path}/${id}`;
      return {
        set: async (payload, opts) => {
          onSet?.(full, payload, opts);
          if (opts?.merge && docs.has(full)) {
            docs.set(full, { ...docs.get(full), ...payload });
          } else {
            docs.set(full, { ...payload });
          }
        },
        update: async (payload) => {
          onUpdate?.(full, payload);
          if (!docs.has(full)) {
            const err = new Error('No document to update: NOT_FOUND');
            err.code = 'not-found';
            throw err;
          }
          docs.set(full, { ...docs.get(full), ...payload });
        },
        delete: async () => {
          onDelete?.(full);
          if (!docs.has(full)) {
            const err = new Error('NOT_FOUND');
            err.code = 'not-found';
            throw err;
          }
          docs.delete(full);
        },
        create: async (payload) => {
          if (docs.has(full)) {
            const err = new Error('already-exists');
            err.code = 'already-exists';
            throw err;
          }
          docs.set(full, payload);
        },
        get: async () => {
          onGet?.(full);
          const data = docs.get(full);
          return {
            exists: Boolean(data),
            data: () => data,
          };
        },
      };
    },
  });
  return {
    collection: (name) => {
      if (String(name).startsWith('tenants/')) {
        return collection(name);
      }
      return collection(`tenants/${TENANT}/${name}`);
    },
    doc: (path) => {
      const parts = String(path).split('/');
      const id = parts.pop();
      const colPath = parts.join('/');
      return collection(colPath).doc(id);
    },
    _docs: docs,
  };
}

const firebaseMock = {
  firestore: {
    FieldValue: {
      serverTimestamp: () => ({ __serverTimestamp: true }),
    },
  },
};

describe('sync queue resilience', () => {
  let db;

  beforeEach(() => {
    memoryStore.clear();
    setGlobalTenantId(TENANT);
    db = makeDbMock();
    initSyncEngine({
      getDatabase: () => db,
      isFirebaseReady: () => true,
      getFirebase: () => firebaseMock,
      getTenantId: () => TENANT,
      showHUD: () => {},
    });
    clearAllPendingSyncQueues();
  });

  afterEach(() => {
    clearAllPendingSyncQueues();
  });

  it('exports a retry limit of 3', () => {
    expect(MAX_SYNC_RETRIES).to.equal(3);
  });

  it('treats permission-denied as fatal', () => {
    expect(isFatalSyncError({ code: 'permission-denied' })).to.equal(true);
    expect(isFatalSyncError({ code: 'unavailable' })).to.equal(false);
  });

  it('upserts missing docs with set merge instead of update NOT_FOUND', async () => {
    const sets = [];
    db = makeDbMock({
      onSet: (path, payload, opts) => sets.push({ path, payload, opts }),
      onUpdate: () => {
        throw new Error('update must not be called');
      },
    });
    initSyncEngine({
      getDatabase: () => db,
      isFirebaseReady: () => true,
      getFirebase: () => firebaseMock,
      getTenantId: () => TENANT,
    });

    const result = await writeFirestoreDocOrQueue({
      collectionPath: 'mhd_liste',
      docId: 'ghost-1',
      op: 'update',
      onlineData: { name: 'Bratwurst', qty: 2, tenantId: TENANT },
    });
    expect(result).to.equal('written');
    expect(sets).to.have.length(1);
    expect(sets[0].opts).to.deep.equal({ merge: true });
    expect(sets[0].payload.name).to.equal('Bratwurst');
  });

  it('writes mhd_audit via add without GET', async () => {
    const adds = [];
    const gets = [];
    db = makeDbMock({
      onAdd: (path, payload) => adds.push({ path, payload }),
      onGet: (path) => gets.push(path),
    });
    initSyncEngine({
      getDatabase: () => db,
      isFirebaseReady: () => true,
      getFirebase: () => firebaseMock,
      getTenantId: () => TENANT,
    });

    const result = await writeFirestoreDocOrQueue({
      collectionPath: 'mhd_audit',
      op: 'add',
      onlineData: { articleName: 'Milch', actionType: 'menge', tenantId: TENANT },
    });
    expect(result).to.equal('written');
    expect(adds).to.have.length(1);
    expect(adds[0].path).to.include('mhd_audit');
    expect(gets).to.have.length(0);
  });

  it('moves fatal failures to sync_errors without blocking siblings', async () => {
    addPendingSync({
      _syncType: 'firestore-doc',
      _collectionPath: `tenants/${TENANT}/mhd_liste`,
      _docId: 'ok-doc',
      _op: 'update',
      data: { name: 'OK', qty: 1 },
    });
    addPendingSync({
      _syncType: 'firestore-doc',
      _collectionPath: `tenants/${TENANT}/mhd_liste`,
      _docId: 'denied-doc',
      _op: 'update',
      data: { name: 'Denied', qty: 1 },
    });

    const originalFlush = flushOnePendingSync;
    // Patch via re-init with a db that denies one doc.
    db = makeDbMock({
      onSet: (path) => {
        if (path.endsWith('/denied-doc')) {
          const err = new Error('PERMISSION_DENIED');
          err.code = 'permission-denied';
          throw err;
        }
      },
    });
    initSyncEngine({
      getDatabase: () => db,
      isFirebaseReady: () => true,
      getFirebase: () => firebaseMock,
      getTenantId: () => TENANT,
    });

    expect(getPendingSyncs()).to.have.length(2);
    await flushPendingSyncs();
    expect(getPendingSyncs()).to.have.length(0);
    const dead = getSyncErrors();
    expect(dead).to.have.length(1);
    expect(dead[0]._docId).to.equal('denied-doc');
    expect(dead[0].retryCount).to.be.at.least(1);
    void originalFlush;
  });

  it('dead-letters after MAX_SYNC_RETRIES transient failures', async () => {
    addPendingSync({
      _syncType: 'firestore-doc',
      _collectionPath: `tenants/${TENANT}/mhd_liste`,
      _docId: 'flaky',
      _op: 'update',
      data: { name: 'Flaky', qty: 1 },
      retryCount: MAX_SYNC_RETRIES - 1,
    });

    db = makeDbMock({
      onSet: () => {
        const err = new Error('unavailable');
        err.code = 'unavailable';
        throw err;
      },
    });
    initSyncEngine({
      getDatabase: () => db,
      isFirebaseReady: () => true,
      getFirebase: () => firebaseMock,
      getTenantId: () => TENANT,
    });

    await flushPendingSyncs();
    expect(getPendingSyncs()).to.have.length(0);
    expect(getDeadPendingSyncs()).to.have.length(1);
    expect(getDeadPendingSyncs()[0].retryCount).to.equal(MAX_SYNC_RETRIES);
  });

  it('clearAllPendingSyncQueues empties active and dead buffers', () => {
    addPendingSync({
      _syncType: 'firestore-doc',
      _collectionPath: `tenants/${TENANT}/mhd_liste`,
      _docId: 'x',
      _op: 'update',
      data: { name: 'X' },
    });
    expect(getPendingSyncs().length).to.be.greaterThan(0);
    clearAllPendingSyncQueues();
    expect(getPendingSyncs()).to.deep.equal([]);
    expect(getSyncErrors()).to.deep.equal([]);
  });
});
