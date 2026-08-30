import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { initTenantDb, setGlobalTenantId } from '../web/tenant-db.js';
import { __customerOrdersTest } from '../web/customer-orders.js';

const TENANT_ID = 'test-tenant';

class FakeDocRef {
  constructor(db, path) {
    this.db = db;
    this.path = path;
    this.id = path.split('/').pop();
  }

  async get() {
    const data = this.db.docs.get(this.path);
    return {
      exists: data !== undefined,
      ref: this,
      data: () => ({ ...data }),
    };
  }
}

class FakeCollectionRef {
  constructor(db, path) {
    this.db = db;
    this.path = path;
  }

  doc(id) {
    return new FakeDocRef(this.db, `${this.path}/${id}`);
  }

  where(field, operator, value) {
    if (operator !== '==') throw new Error(`Unsupported operator ${operator}`);
    const matches = Array.from(this.db.docs.entries())
      .filter(([path, data]) => path.startsWith(`${this.path}/`) && data?.[field] === value)
      .map(([path]) => ({ ref: new FakeDocRef(this.db, path) }));
    return {
      limit: (count) => ({
        get: async () => ({
          empty: matches.length === 0,
          docs: matches.slice(0, count),
        }),
      }),
    };
  }
}

class FakeDb {
  constructor(seed = {}) {
    this.docs = new Map(Object.entries(seed).map(([path, data]) => [path, { ...data }]));
    this.appliedUpdates = [];
  }

  collection(name) {
    if (name !== 'tenants') throw new Error(`Unexpected root collection ${name}`);
    return {
      doc: (tenantId) => ({
        collection: (collectionName) => new FakeCollectionRef(
          this,
          `tenants/${tenantId}/${collectionName}`,
        ),
      }),
    };
  }

  async runTransaction(callback) {
    const pendingUpdates = [];
    await callback({
      get: (ref) => ref.get(),
      update: (ref, data) => {
        pendingUpdates.push({ ref, data });
      },
    });
    pendingUpdates.forEach(({ ref, data }) => {
      const current = this.docs.get(ref.path) || {};
      this.docs.set(ref.path, { ...current, ...data });
    });
    this.appliedUpdates.push(...pendingUpdates);
  }
}

function stockPath(id) {
  return `tenants/${TENANT_ID}/stammdaten/${id}`;
}

function orderPath(id) {
  return `tenants/${TENANT_ID}/customerOrders/${id}`;
}

function readyOrder(overrides = {}) {
  return {
    id: 'order-1',
    status: 'ready',
    tenantId: TENANT_ID,
    items: [
      { product: 'Rinderhack', quantity: '1', unit: 'kg' },
    ],
    ...overrides,
  };
}

function setupDb(seed) {
  const db = new FakeDb(seed);
  initTenantDb(db);
  setGlobalTenantId(TENANT_ID);
  __customerOrdersTest.setState({
    db,
    tenantId: TENANT_ID,
    getFirebase: () => ({
      firestore: {
        FieldValue: {
          serverTimestamp: () => 'SERVER_TIMESTAMP',
        },
      },
    }),
  });
  return db;
}

async function expectRejectsWith(promise, messagePart) {
  try {
    await promise;
  } catch (err) {
    expect(String(err?.message || err)).to.include(messagePart);
    return;
  }
  throw new Error(`Expected rejection including ${messagePart}`);
}

describe('customer order pickup stock deductions', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { onLine: true },
    });
  });

  afterEach(() => {
    __customerOrdersTest.setState({ db: null, tenantId: '' });
  });

  it('aggregates duplicate order lines before marking the order picked up', async () => {
    const order = readyOrder({
      items: [
        { product: 'Rinderhack', quantity: '1', unit: 'kg' },
        { product: 'Rinderhack', quantity: '0,75', unit: 'kg' },
      ],
    });
    const db = setupDb({
      [orderPath(order.id)]: { ...order },
      [stockPath('rinderhack')]: { name: 'Rinderhack', currentStock: 2.5 },
    });

    const deductedCount = await __customerOrdersTest.markOrderPickedUpWithStock(order, 'Mia');

    expect(deductedCount).to.equal(1);
    expect(db.docs.get(stockPath('rinderhack')).currentStock).to.equal(0.75);
    expect(db.docs.get(orderPath(order.id)).status).to.equal('picked_up');
  });

  it('does not mark picked up when no matching stock document exists', async () => {
    const order = readyOrder();
    const db = setupDb({
      [orderPath(order.id)]: { ...order },
    });

    await expectRejectsWith(
      __customerOrdersTest.markOrderPickedUpWithStock(order, 'Mia'),
      'Kein Lagerbestand',
    );

    expect(db.docs.get(orderPath(order.id)).status).to.equal('ready');
    expect(db.appliedUpdates).to.have.length(0);
  });

  it('does not mark picked up when the stock match is ambiguous', async () => {
    const order = readyOrder();
    const db = setupDb({
      [orderPath(order.id)]: { ...order },
      [stockPath('rinderhack-a')]: { name: 'Rinderhack', currentStock: 3 },
      [stockPath('rinderhack-b')]: { name: 'Rinderhack', currentStock: 3 },
    });

    await expectRejectsWith(
      __customerOrdersTest.markOrderPickedUpWithStock(order, 'Mia'),
      'nicht eindeutig',
    );

    expect(db.docs.get(orderPath(order.id)).status).to.equal('ready');
    expect(db.appliedUpdates).to.have.length(0);
  });

  it('does not mark picked up when stock would go negative', async () => {
    const order = readyOrder({
      items: [{ product: 'Rinderhack', quantity: '2', unit: 'kg' }],
    });
    const db = setupDb({
      [orderPath(order.id)]: { ...order },
      [stockPath('rinderhack')]: { name: 'Rinderhack', currentStock: 1 },
    });

    await expectRejectsWith(
      __customerOrdersTest.markOrderPickedUpWithStock(order, 'Mia'),
      'Nicht genug Lagerbestand',
    );

    expect(db.docs.get(stockPath('rinderhack')).currentStock).to.equal(1);
    expect(db.docs.get(orderPath(order.id)).status).to.equal('ready');
    expect(db.appliedUpdates).to.have.length(0);
  });
});
