import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import { initTenantDb, setGlobalTenantId } from '../web/tenant-db.js';
import { __customerOrdersTest } from '../web/customer-orders.js';

const TENANT_ID = 'StevesHof_Hauptbetrieb';

class MockDocRef {
  constructor(store, path) {
    this.store = store;
    this.path = path;
    this.id = path.split('/').pop();
  }

  collection(name) {
    return new MockCollectionRef(this.store, `${this.path}/${name}`);
  }

  async get() {
    const data = this.store.get(this.path);
    return {
      exists: Boolean(data),
      ref: this,
      data: () => ({ ...data }),
    };
  }
}

class MockCollectionRef {
  constructor(store, path) {
    this.store = store;
    this.path = path;
  }

  doc(id) {
    return new MockDocRef(this.store, `${this.path}/${id}`);
  }

  where(field, _op, value) {
    return new MockQuery(this.store, this.path, field, value);
  }
}

class MockQuery {
  constructor(store, path, field, value) {
    this.store = store;
    this.path = path;
    this.field = field;
    this.value = value;
    this.limitValue = Infinity;
  }

  limit(value) {
    this.limitValue = value;
    return this;
  }

  async get() {
    const docs = [];
    for (const [path, data] of this.store.entries()) {
      if (!path.startsWith(`${this.path}/`)) continue;
      if (path.slice(this.path.length + 1).includes('/')) continue;
      if (data?.[this.field] === this.value) {
        docs.push({
          id: path.split('/').pop(),
          ref: new MockDocRef(this.store, path),
          data: () => ({ ...data }),
        });
      }
      if (docs.length >= this.limitValue) break;
    }
    return { empty: docs.length === 0, docs };
  }
}

class MockDb {
  constructor(store) {
    this.store = store;
  }

  collection(name) {
    return new MockCollectionRef(this.store, name);
  }

  async runTransaction(callback) {
    const updates = [];
    const transaction = {
      get: (ref) => ref.get(),
      update: (ref, patch) => updates.push({ ref, patch }),
    };
    await callback(transaction);
    updates.forEach(({ ref, patch }) => {
      this.store.set(ref.path, { ...this.store.get(ref.path), ...patch });
    });
  }
}

function createHarness({ stockDocs = {}, order = null } = {}) {
  const store = new Map();
  Object.entries(stockDocs).forEach(([id, data]) => {
    store.set(`tenants/${TENANT_ID}/stammdaten/${id}`, data);
  });
  if (order) {
    store.set(`tenants/${TENANT_ID}/customerOrders/${order.id}`, order);
  }
  const db = new MockDb(store);
  initTenantDb(db);
  setGlobalTenantId(TENANT_ID);
  __customerOrdersTest.orderState.db = db;
  __customerOrdersTest.orderState.tenantId = TENANT_ID;
  __customerOrdersTest.orderState.getFirebase = () => ({
    firestore: {
      FieldValue: {
        serverTimestamp: () => 'SERVER_TIME',
      },
    },
  });
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true },
    configurable: true,
  });
  return { store, db };
}

async function expectRejectsWith(promise, text) {
  try {
    await promise;
  } catch (err) {
    expect(String(err?.message || err)).to.include(text);
    return;
  }
  throw new Error(`Expected rejection including: ${text}`);
}

describe('customer order pickup stock integrity', () => {
  beforeEach(() => {
    setGlobalTenantId(TENANT_ID);
  });

  it('fails closed when an order item has no matching stock document', async () => {
    createHarness();

    await expectRejectsWith(
      __customerOrdersTest.prepareStockDeductionsForOrder({
        items: [{ product: 'Fleischsalat', quantity: '2', unit: 'kg' }],
      }),
      'Kein Bestand',
    );
  });

  it('fails closed when a product name resolves to multiple stock documents', async () => {
    createHarness({
      stockDocs: {
        a: { produkt: 'Fleischsalat', currentStock: 10 },
        b: { name: 'Fleischsalat', currentStock: 8 },
      },
    });

    await expectRejectsWith(
      __customerOrdersTest.prepareStockDeductionsForOrder({
        items: [{ product: 'Fleischsalat', quantity: '2', unit: 'kg' }],
      }),
      'nicht eindeutig',
    );
  });

  it('aggregates duplicate order lines before updating stock and order status', async () => {
    const order = {
      id: 'order-1',
      status: 'ready',
      items: [
        { product: 'Fleischsalat', quantity: '2', unit: 'kg' },
        { product: 'Fleischsalat', quantity: '3', unit: 'kg' },
      ],
      tenantId: TENANT_ID,
    };
    const { store } = createHarness({
      stockDocs: {
        fleischsalat: { produkt: 'Fleischsalat', currentStock: 10 },
      },
      order,
    });

    const deductions = await __customerOrdersTest.prepareStockDeductionsForOrder(order);
    expect(deductions).to.have.length(1);
    expect(deductions[0].amount).to.equal(5);

    await __customerOrdersTest.markOrderPickedUpWithStock(order, 'Team');

    expect(store.get(`tenants/${TENANT_ID}/stammdaten/fleischsalat`).currentStock).to.equal(5);
    expect(store.get(`tenants/${TENANT_ID}/customerOrders/order-1`).status).to.equal('picked_up');
  });

  it('rejects insufficient stock without marking the order picked up', async () => {
    const order = {
      id: 'order-2',
      status: 'ready',
      items: [{ product: 'Fleischsalat', quantity: '7', unit: 'kg' }],
      tenantId: TENANT_ID,
    };
    const { store } = createHarness({
      stockDocs: {
        fleischsalat: { produkt: 'Fleischsalat', currentStock: 4 },
      },
      order,
    });

    await expectRejectsWith(
      __customerOrdersTest.markOrderPickedUpWithStock(order, 'Team'),
      'Nicht genug Bestand',
    );

    expect(store.get(`tenants/${TENANT_ID}/stammdaten/fleischsalat`).currentStock).to.equal(4);
    expect(store.get(`tenants/${TENANT_ID}/customerOrders/order-2`).status).to.equal('ready');
  });
});
