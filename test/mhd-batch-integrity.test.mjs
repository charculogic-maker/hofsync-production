import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { join } from 'node:path';

const TENANT_ID = 'StevesHof_Hauptbetrieb';

function installBrowserStubs() {
  const noop = () => {};
  globalThis.window = {
    BRANDING: {},
    showToast: noop,
    hasActiveFirebaseAuthUser: () => true,
    canStartFirestoreLiveListeners: () => true,
  };
  globalThis.document = {
    body: { classList: { add: noop, remove: noop, toggle: noop } },
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({
      className: '',
      style: {},
      dataset: {},
      classList: { add: noop, remove: noop, toggle: noop },
      appendChild: noop,
      addEventListener: noop,
      remove: noop,
      querySelector: () => null,
      querySelectorAll: () => [],
    }),
  };
  globalThis.localStorage = {
    getItem: () => null,
    setItem: noop,
    removeItem: noop,
  };
  globalThis.sessionStorage = {
    getItem: () => null,
    setItem: noop,
    removeItem: noop,
  };
  globalThis.requestAnimationFrame = (callback) => callback();
  Object.defineProperty(globalThis, 'crypto', {
    value: { randomUUID: () => 'test-uuid' },
    configurable: true,
  });
}

function loadMhdModule() {
  installBrowserStubs();

  let activeTenantId = TENANT_ID;
  const file = join(process.cwd(), 'web', 'mhd.js');
  let source = readFileSync(file, 'utf8');
  source = source.replace(/import[\s\S]*?from\s+'[^']+';\n/g, '');
  source = source.replace(/^export (async function|function) /gm, '$1 ');
  source = source.replace(/export\s*\{[\s\S]*?\};\s*$/m, '');
  source += `
return {
  mhdState,
  buildMhdBatchDocId,
  findExistingMhdBatch,
  resolveMhdBatchWriteTarget,
  buildMhdRecordFromDeliveryItem,
  commitMhdCardQtyFromInput,
  adjustQty,
  markMhdAction,
};`;

  const factory = new Function(
    'formatIsoToGerman',
    'initGermanDateInputs',
    'readGermanDateField',
    'setGermanDateField',
    'getGlobalTenantId',
    'getTenantCollection',
    'canonicalTenantId',
    'setGlobalTenantId',
    'isOfficeUser',
    'logAndMapOperatorError',
    'resolveEmployeeByPin',
    'verifyMeisterPin',
    'ACTIVE_EMPLOYEE_STORAGE_KEY',
    'readScopedLocalStorageValue',
    'scopedTeamboardStorageKey',
    'writeScopedLocalStorageValue',
    'sanitizeProductName',
    'composeProductDisplayTitle',
    source,
  );

  const mod = factory(
    (value) => String(value || ''),
    () => {},
    () => '',
    () => {},
    () => activeTenantId,
    () => ({ doc: () => ({}) }),
    (value) => (typeof value === 'string' ? value.trim() : ''),
    (value) => { activeTenantId = String(value || '').trim(); },
    () => false,
    (err) => String(err?.message || err || 'Fehler'),
    async () => null,
    async () => false,
    'charculogic.activeEmployee',
    () => '',
    (base, tenant) => `${tenant}_${base}`,
    () => {},
    (value) => String(value || '').trim(),
    ({ name, produkt, brand, marke }) => ({
      title: [brand || marke, name || produkt].filter(Boolean).join(' ').trim() || 'Unbekannt',
      grammageBadge: '',
    }),
  );

  mod.mhdState.tenantId = TENANT_ID;
  mod.mhdState.getFirebase = () => ({
    firestore: {
      FieldValue: {
        serverTimestamp: () => 'SERVER_TS',
      },
    },
  });
  mod.mhdState.isFirebaseReady = () => true;
  mod.mhdState.playClickSound = () => {};
  mod.mhdState.playFeedbackSound = () => {};
  mod.mhdState.showHUD = () => {};
  return mod;
}

function batchProduct(id, qty, overrides = {}) {
  return {
    id,
    ean: '4000000000012',
    barcode: '4000000000012',
    name: 'Joghurt',
    produkt: 'Joghurt',
    mhd: '2026-09-08',
    mhdDate: '2026-09-08',
    qty,
    menge: qty,
    status: 'aktiv',
    tenantId: TENANT_ID,
    ...overrides,
  };
}

describe('MHD batch integrity', () => {
  it('targets the existing legacy batch document when merging received stock', () => {
    const mod = loadMhdModule();
    mod.mhdState.products = [batchProduct('legacy-random-id', 7)];

    const target = mod.resolveMhdBatchWriteTarget('4000000000012', '2026-09-08');
    assert.equal(target.docId, 'legacy-random-id');
    assert.equal(target.op, 'update');

    const record = mod.buildMhdRecordFromDeliveryItem(
      { id: 'line-1', barcode: '4000000000012', product: 'Joghurt', qtyValue: 2, qtyUnit: 'Stk', mhdDate: '2026-09-08' },
      { supplier: 'Molkerei', warenKategorie: 'mopro', temperatur: 4 },
      'delivery-1',
      'aktiv',
      '',
    );

    assert.equal(record.id, 'legacy-random-id');
    assert.equal(record.postenId, 'legacy-random-id');
    assert.equal(record._mhdWriteOp, 'update');
    assert.equal(record.qty, 9);
    assert.equal(record.menge, 9);
  });

  it('stages duplicate-card quantity edits to the displayed grouped total', async () => {
    const mod = loadMhdModule();
    mod.mhdState.products = [
      batchProduct('dup-a', 2),
      batchProduct('dup-b', 3),
    ];

    await mod.commitMhdCardQtyFromInput('dup-a', '4');

    assert.deepEqual(mod.mhdState.pendingChanges['dup-a'], { qty: 4, menge: 4 });
    assert.deepEqual(mod.mhdState.pendingChanges['dup-b'], { qty: 0, menge: 0 });
    assert.equal(mod.mhdState.products.find((entry) => entry.id === 'dup-a').qty, 4);
    assert.equal(mod.mhdState.products.find((entry) => entry.id === 'dup-b').qty, 0);
  });

  it('uses the grouped total for duplicate-card steppers', async () => {
    const mod = loadMhdModule();
    mod.mhdState.products = [
      batchProduct('dup-a', 2),
      batchProduct('dup-b', 3),
    ];

    await mod.adjustQty('dup-a', 1);

    assert.equal(mod.mhdState.pendingChanges['dup-a'].qty, 6);
    assert.equal(mod.mhdState.pendingChanges['dup-b'].qty, 0);
  });

  it('persists grouped MHD actions immediately and keeps unrelated staged edits', async () => {
    const mod = loadMhdModule();
    const writes = [];
    mod.mhdState.products = [
      batchProduct('dup-a', 2),
      batchProduct('dup-b', 3),
    ];
    mod.mhdState.pendingChanges = {
      'dup-a': { qty: 4, menge: 4 },
    };
    mod.mhdState.writeOrQueueFirestore = async (payload) => {
      writes.push(payload);
      return 'written';
    };

    await mod.markMhdAction('dup-a', 'ok');

    assert.equal(writes.length, 2);
    assert.deepEqual(writes.map((entry) => entry.docId).sort(), ['dup-a', 'dup-b']);
    assert.equal(writes[0].collectionPath, `tenants/${TENANT_ID}/mhd_liste`);
    assert.equal(mod.mhdState.products.find((entry) => entry.id === 'dup-a').mhdActionStatus, 'ok');
    assert.equal(mod.mhdState.products.find((entry) => entry.id === 'dup-b').mhdActionStatus, 'ok');
    assert.deepEqual(mod.mhdState.pendingChanges['dup-a'], { qty: 4, menge: 4 });
    assert.equal(mod.mhdState.pendingChanges['dup-b'], undefined);
  });
});
