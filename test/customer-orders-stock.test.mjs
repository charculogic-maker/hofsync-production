import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { join } from 'node:path';

function loadCustomerOrdersModule(getTenantCollection) {
  const file = join(process.cwd(), 'web', 'customer-orders.js');
  let source = readFileSync(file, 'utf8');
  source = source.replace(/import[\s\S]*?from\s+'[^']+';\n/g, '');
  source = source.replace(/^export function /gm, 'function ');
  source += `
return {
  orderState,
  quantityForStock,
  prepareStockDeductionsForOrder,
  markOrderPickedUpWithStock,
};`;

  const factory = new Function(
    'getTenantCollection',
    'writeFirestoreDocOrQueue',
    'getActiveEmployeeName',
    'postTeamboardBulletin',
    'initGermanDateInputs',
    'readGermanDateField',
    'setGermanDateField',
    source,
  );

  return factory(
    getTenantCollection,
    async () => 'written',
    () => 'Tester',
    async () => {},
    () => {},
    () => '',
    () => {},
  );
}

function snap(exists, data, ref) {
  return {
    exists,
    ref,
    data: () => data,
  };
}

class FakeStockCollection {
  constructor(records = []) {
    this.records = new Map(records.map((record) => [record.id, record]));
  }

  doc(id) {
    const ref = { id, path: `tenants/demo/stammdaten/${id}` };
    return {
      ...ref,
      get: async () => this.snapForRef(ref),
    };
  }

  where(field, op, value) {
    assert.equal(op, '==');
    return {
      limit: (count) => ({
        get: async () => {
          const docs = [...this.records.values()]
            .filter((record) => record.data?.[field] === value)
            .slice(0, count)
            .map((record) => snap(true, record.data, { id: record.id, path: `tenants/demo/stammdaten/${record.id}` }));
          return { empty: docs.length === 0, docs };
        },
      }),
    };
  }

  snapForRef(ref) {
    const id = String(ref?.id || '').trim();
    const record = this.records.get(id);
    return snap(Boolean(record), record?.data || {}, ref);
  }
}

function createHarness({ stockRecords = [], orderData = {} } = {}) {
  const stockCollection = new FakeStockCollection(stockRecords);
  const orderUpdates = [];
  const stockUpdates = [];
  const orderCollection = {
    doc: (id) => ({ id, path: `tenants/demo/customerOrders/${id}` }),
  };
  const mod = loadCustomerOrdersModule((name) => {
    if (name === 'stammdaten') return stockCollection;
    if (name === 'customerOrders') return orderCollection;
    throw new Error(`Unexpected collection ${name}`);
  });

  mod.orderState.tenantId = 'demo';
  mod.orderState.getFirebase = () => ({
    firestore: {
      FieldValue: {
        serverTimestamp: () => 'SERVER_TS',
      },
    },
  });
  mod.orderState.db = {
    runTransaction: async (callback) => {
      const transaction = {
        get: async (ref) => {
          if (String(ref.path).includes('/customerOrders/')) {
            return snap(true, orderData, ref);
          }
          return stockCollection.snapForRef(ref);
        },
        update: (ref, payload) => {
          if (String(ref.path).includes('/customerOrders/')) {
            orderUpdates.push({ ref, payload });
          } else {
            stockUpdates.push({ ref, payload });
          }
        },
      };
      await callback(transaction);
    },
  };

  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true },
    configurable: true,
  });

  return { ...mod, orderUpdates, stockUpdates };
}

describe('customer order stock pickup integrity', () => {
  it('aggregates duplicate order lines before deducting stock once', async () => {
    const harness = createHarness({
      stockRecords: [{
        id: 'beef',
        data: { currentStock: 5, name: 'Rinderbraten' },
      }],
      orderData: { status: 'ready' },
    });

    const count = await harness.markOrderPickedUpWithStock({
      id: 'order-1',
      items: [
        { stockItemId: 'beef', product: 'Rinderbraten', quantity: '2' },
        { stockItemId: 'beef', product: 'Rinderbraten', actualQuantity: '1,5', quantity: '1' },
      ],
    }, 'Paddy');

    assert.equal(count, 1);
    assert.equal(harness.stockUpdates.length, 1);
    assert.equal(harness.stockUpdates[0].payload.currentStock, 1.5);
    assert.equal(harness.orderUpdates.length, 1);
    assert.equal(harness.orderUpdates[0].payload.status, 'picked_up');
  });

  it('fails closed when no stock document matches an ordered item', async () => {
    const harness = createHarness({
      orderData: { status: 'ready' },
    });

    await assert.rejects(
      () => harness.markOrderPickedUpWithStock({
        id: 'order-2',
        items: [{ product: 'Verschollener Artikel', quantity: '1' }],
      }, 'Paddy'),
      /Bestand nicht gefunden/,
    );

    assert.equal(harness.stockUpdates.length, 0);
    assert.equal(harness.orderUpdates.length, 0);
  });

  it('fails closed when stock would become negative', async () => {
    const harness = createHarness({
      stockRecords: [{
        id: 'milk',
        data: { currentStock: 1, name: 'Milch' },
      }],
      orderData: { status: 'ready' },
    });

    await assert.rejects(
      () => harness.markOrderPickedUpWithStock({
        id: 'order-3',
        items: [{ stockItemId: 'milk', product: 'Milch', quantity: '2' }],
      }, 'Paddy'),
      /Nicht genug Bestand/,
    );

    assert.equal(harness.stockUpdates.length, 0);
    assert.equal(harness.orderUpdates.length, 0);
  });

  it('fails closed when product-name stock lookup is ambiguous', async () => {
    const harness = createHarness({
      stockRecords: [
        { id: 'cheese-a', data: { currentStock: 3, name: 'Käse' } },
        { id: 'cheese-b', data: { currentStock: 4, name: 'Käse' } },
      ],
      orderData: { status: 'ready' },
    });

    await assert.rejects(
      () => harness.prepareStockDeductionsForOrder({
        items: [{ product: 'Käse', quantity: '1' }],
      }),
      /Bestand nicht eindeutig/,
    );
  });

  it('ignores non-positive quantities instead of increasing stock', () => {
    const harness = createHarness();

    assert.equal(harness.quantityForStock({ product: 'Test', quantity: '-2' }), 0);
    assert.equal(harness.quantityForStock({ product: 'Test', actualQuantity: '-1', quantity: '0' }), 0);
  });
});
