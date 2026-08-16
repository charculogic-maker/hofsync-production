import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { initTenantDb, setGlobalTenantId } from '../web/tenant-db.js';
import { __customerOrdersTest } from '../web/customer-orders.js';

const TENANT_ID = 'StevesHof_Hauptbetrieb';

function createStockDb(stockDocs) {
  const docs = new Map(Object.entries(stockDocs));
  const collectionPath = `tenants/${TENANT_ID}/stammdaten`;

  function makeRef(id) {
    const ref = {
      id,
      path: `${collectionPath}/${id}`,
      parent: { path: collectionPath },
      async get() {
        return {
          exists: docs.has(id),
          ref,
          data: () => docs.get(id),
        };
      },
    };
    return ref;
  }

  const stockCollection = {
    doc: (id) => makeRef(id),
    where(field, operator, value) {
      expect(operator).to.equal('==');
      const matches = [...docs.entries()]
        .filter(([, data]) => data?.[field] === value)
        .map(([id, data]) => ({
          id,
          ref: makeRef(id),
          data: () => data,
        }));

      return {
        limit(limitCount) {
          return {
            async get() {
              const limited = matches.slice(0, limitCount);
              return {
                empty: limited.length === 0,
                size: limited.length,
                docs: limited,
              };
            },
          };
        },
      };
    },
  };

  return {
    collection(name) {
      expect(name).to.equal('tenants');
      return {
        doc(tenantId) {
          expect(tenantId).to.equal(TENANT_ID);
          return {
            collection(collectionName) {
              expect(collectionName).to.equal('stammdaten');
              return stockCollection;
            },
          };
        },
      };
    },
  };
}

describe('customer order stock deductions', () => {
  beforeEach(() => {
    setGlobalTenantId(TENANT_ID);
  });

  afterEach(() => {
    initTenantDb(null);
    setGlobalTenantId('');
    __customerOrdersTest.setCustomerOrdersTestContext();
  });

  function useStockDocs(stockDocs) {
    const db = createStockDb(stockDocs);
    initTenantDb(db);
    __customerOrdersTest.setCustomerOrdersTestContext({ db, tenantId: TENANT_ID });
  }

  it('aggregates duplicate order lines for the same stock document', async () => {
    useStockDocs({
      fleischsalat: { produkt: 'Fleischsalat', name: 'Fleischsalat', currentStock: 8 },
    });

    const deductions = await __customerOrdersTest.prepareStockDeductionsForOrder({
      items: [
        { product: 'Fleischsalat', quantity: '1' },
        { product: 'Fleischsalat', actualQuantity: '2,5', quantity: '2' },
      ],
    });

    expect(deductions).to.have.length(1);
    expect(deductions[0].ref.path).to.equal(`tenants/${TENANT_ID}/stammdaten/fleischsalat`);
    expect(deductions[0].amount).to.equal(3.5);
  });

  it('fails closed when no matching stock document exists', async () => {
    useStockDocs({});

    let error = null;
    try {
      await __customerOrdersTest.prepareStockDeductionsForOrder({
        items: [{ product: 'Fleischsalat', quantity: '1' }],
      });
    } catch (err) {
      error = err;
    }

    expect(error).to.be.instanceOf(Error);
    expect(error.message).to.match(/kein Bestand gefunden/);
  });

  it('fails closed when product lookup is ambiguous', async () => {
    useStockDocs({
      fleischsalat_a: { produkt: 'Fleischsalat', name: 'Fleischsalat', currentStock: 8 },
      fleischsalat_b: { produkt: 'Fleischsalat', name: 'Fleischsalat', currentStock: 5 },
    });

    let error = null;
    try {
      await __customerOrdersTest.prepareStockDeductionsForOrder({
        items: [{ product: 'Fleischsalat', quantity: '1' }],
      });
    } catch (err) {
      error = err;
    }

    expect(error).to.be.instanceOf(Error);
    expect(error.message).to.match(/nicht eindeutig/);
  });

  it('fails closed when stock is insufficient during pickup', () => {
    expect(() => __customerOrdersTest.assertStockDeductionAvailable(
      { product: 'Fleischsalat', amount: 4 },
      { exists: true, data: () => ({ currentStock: 3 }) },
    )).to.throw(/reicht nicht aus/);
  });
});
