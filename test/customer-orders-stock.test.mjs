import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import { initTenantDb, setGlobalTenantId } from '../web/tenant-db.js';
import { __customerOrdersTestHooks } from '../web/customer-orders.js';

const TENANT_ID = 'StevesHof_Hauptbetrieb';

function makeSnapshot(id, data, ref) {
  return {
    id,
    exists: Boolean(data),
    data: () => data,
    ref,
  };
}

function makeCollection(seed = {}) {
  const docs = new Map(Object.entries(seed));
  const collection = {
    doc(id) {
      const ref = {
        id,
        path: `tenants/${TENANT_ID}/stammdaten/${id}`,
        get: async () => makeSnapshot(id, docs.get(id), ref),
      };
      return ref;
    },
    where(field, op, value) {
      if (op !== '==') throw new Error(`Unsupported op ${op}`);
      return {
        limit(max) {
          return {
            async get() {
              const matches = Array.from(docs.entries())
                .filter(([, data]) => data?.[field] === value)
                .slice(0, max)
                .map(([id, data]) => {
                  const ref = collection.doc(id);
                  return makeSnapshot(id, data, ref);
                });
              return {
                empty: matches.length === 0,
                size: matches.length,
                docs: matches,
              };
            },
          };
        },
      };
    },
  };
  return collection;
}

function initStockDocs(seed) {
  const stockCollection = makeCollection(seed);
  initTenantDb({
    collection(name) {
      if (name !== 'tenants') throw new Error(`Unexpected collection ${name}`);
      return {
        doc(tenantId) {
          if (tenantId !== TENANT_ID) throw new Error(`Unexpected tenant ${tenantId}`);
          return {
            collection(collectionName) {
              if (collectionName !== 'stammdaten') throw new Error(`Unexpected child collection ${collectionName}`);
              return stockCollection;
            },
          };
        },
      };
    },
  });
  setGlobalTenantId(TENANT_ID);
  __customerOrdersTestHooks.setStateForTest({ db: {}, tenantId: TENANT_ID });
}

describe('customer order pickup stock deductions', () => {
  beforeEach(() => {
    setGlobalTenantId('');
  });

  it('fails closed when an order line has no matching stock document', async () => {
    initStockDocs({});

    let error = null;
    try {
      await __customerOrdersTestHooks.prepareStockDeductionsForOrder({
        items: [{ product: 'Fleischsalat', quantity: '2', unit: 'kg' }],
      });
    } catch (err) {
      error = err;
    }
    expect(error?.message).to.include('Kein Lagerartikel');
  });

  it('aggregates duplicate order lines for the same stock document', async () => {
    initStockDocs({
      fleischsalat: { produkt: 'Fleischsalat', name: 'Fleischsalat', currentStock: 12 },
    });

    const deductions = await __customerOrdersTestHooks.prepareStockDeductionsForOrder({
      items: [
        { stockItemId: 'fleischsalat', product: 'Fleischsalat', quantity: '1.5', unit: 'kg' },
        { stockItemId: 'fleischsalat', product: 'Fleischsalat', quantity: '2,25', unit: 'kg' },
      ],
    });

    expect(deductions).to.have.length(1);
    expect(deductions[0].amount).to.equal(3.75);
    expect(deductions[0].ref.path).to.equal(`tenants/${TENANT_ID}/stammdaten/fleischsalat`);
  });

  it('ignores pure Bestellzettel scan placeholders', async () => {
    initStockDocs({});

    const deductions = await __customerOrdersTestHooks.prepareStockDeductionsForOrder({
      items: [{ product: 'Siehe Bestellzettel (Scan)', quantity: '1', unit: 'Aufnahme' }],
    });

    expect(deductions).to.deep.equal([]);
  });
});
