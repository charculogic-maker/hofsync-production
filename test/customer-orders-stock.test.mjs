import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'mocha';
import { expect } from 'chai';

function loadCustomerOrderStockHelpers(getTenantCollection) {
  const root = join(fileURLToPath(new URL('..', import.meta.url)));
  const sourcePath = join(root, 'web', 'customer-orders.js');
  const source = readFileSync(sourcePath, 'utf8')
    .replace(/^import .*;\n/gm, '')
    .replace(/export function /g, 'function ');
  const factory = new Function('__stubs', `
    const getTenantCollection = __stubs.getTenantCollection;
    const writeFirestoreDocOrQueue = async () => {};
    const getActiveEmployeeName = () => '';
    const postTeamboardBulletin = async () => {};
    const initGermanDateInputs = () => {};
    const readGermanDateField = () => '';
    const setGermanDateField = () => {};
    ${source}
    return {
      orderState,
      prepareStockDeductionsForOrder,
      markOrderPickedUpWithStock,
    };
  `);
  return factory({ getTenantCollection });
}

class FakeDocRef {
  constructor(path, data = null) {
    this.path = path;
    this.id = path.split('/').pop();
    this._data = data;
  }

  async get() {
    return {
      exists: Boolean(this._data),
      ref: this,
      data: () => this._data,
    };
  }
}

class FakeCollection {
  constructor(name, docsById) {
    this.name = name;
    this.docsById = docsById;
    this.filters = [];
    this.limitCount = Infinity;
  }

  doc(id) {
    return new FakeDocRef(`${this.name}/${id}`, this.docsById.get(id) || null);
  }

  where(field, _op, value) {
    const next = new FakeCollection(this.name, this.docsById);
    next.filters = [...this.filters, { field, value }];
    next.limitCount = this.limitCount;
    return next;
  }

  limit(count) {
    const next = new FakeCollection(this.name, this.docsById);
    next.filters = this.filters;
    next.limitCount = count;
    return next;
  }

  async get() {
    const matches = Array.from(this.docsById.entries())
      .filter(([, data]) => this.filters.every(({ field, value }) => data?.[field] === value))
      .slice(0, this.limitCount)
      .map(([id, data]) => ({ ref: new FakeDocRef(`${this.name}/${id}`, data), data: () => data }));
    return {
      empty: matches.length === 0,
      docs: matches,
    };
  }
}

function createStockHelpers(stockRows, orderData = null) {
  const stockDocs = new Map(stockRows.map((row) => [row.id, row.data]));
  const orderRef = new FakeDocRef('customerOrders/order-1', orderData);
  const stockCollection = new FakeCollection('stammdaten', stockDocs);
  const orderCollection = {
    doc: () => orderRef,
  };
  const helpers = loadCustomerOrderStockHelpers((collectionName) => (
    collectionName === 'stammdaten' ? stockCollection : orderCollection
  ));
  helpers.orderState.db = {};
  helpers.orderState.tenantId = 'StevesHof_Hauptbetrieb';
  return { ...helpers, orderRef };
}

async function expectRejectsWith(promise, message) {
  let caught = null;
  try {
    await promise;
  } catch (err) {
    caught = err;
  }
  expect(caught).to.be.an('error');
  expect(caught.message).to.equal(message);
}

describe('customer order pickup stock integrity', () => {
  it('fails closed when an ordered item has no stock document', async () => {
    const { prepareStockDeductionsForOrder } = createStockHelpers([]);

    await expectRejectsWith(prepareStockDeductionsForOrder({
      items: [{ product: 'Fleischsalat', quantity: '2' }],
    }), 'Bestandseintrag für Fleischsalat fehlt.');
  });

  it('aggregates duplicate order lines against the same stock document', async () => {
    const { prepareStockDeductionsForOrder } = createStockHelpers([
      { id: 'fleischsalat', data: { name: 'Fleischsalat', produkt: 'Fleischsalat', currentStock: 10 } },
    ]);

    const deductions = await prepareStockDeductionsForOrder({
      items: [
        { product: 'Fleischsalat', quantity: '2' },
        { product: 'Fleischsalat', quantity: '3' },
      ],
    });

    expect(deductions).to.have.length(1);
    expect(deductions[0].amount).to.equal(5);
  });

  it('fails closed when a product name matches multiple stock documents', async () => {
    const { prepareStockDeductionsForOrder } = createStockHelpers([
      { id: 'fleischsalat-a', data: { name: 'Fleischsalat', produkt: 'Fleischsalat', currentStock: 10 } },
      { id: 'fleischsalat-b', data: { name: 'Fleischsalat', produkt: 'Fleischsalat', currentStock: 4 } },
    ]);

    await expectRejectsWith(prepareStockDeductionsForOrder({
      items: [{ product: 'Fleischsalat', quantity: '2' }],
    }), 'Mehrere Bestandseinträge für Fleischsalat gefunden.');
  });

  it('does not mark an order picked up when stock is insufficient', async () => {
    const orderData = {
      status: 'ready',
      items: [{ product: 'Fleischsalat', quantity: '2' }],
    };
    const { orderState, markOrderPickedUpWithStock } = createStockHelpers([
      { id: 'fleischsalat', data: { name: 'Fleischsalat', produkt: 'Fleischsalat', currentStock: 1 } },
    ], orderData);
    const updates = [];
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true },
      configurable: true,
    });
    orderState.getFirebase = () => ({
      firestore: { FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' } },
    });
    orderState.db = {
      runTransaction: async (callback) => callback({
        get: async (ref) => ref.get(),
        update: (ref, payload) => updates.push({ path: ref.path, payload }),
      }),
    };

    await expectRejectsWith(
      markOrderPickedUpWithStock({ id: 'order-1', ...orderData }, 'Stephan'),
      'Nicht genug Bestand für Fleischsalat.',
    );
    expect(updates).to.deep.equal([]);
  });
});
