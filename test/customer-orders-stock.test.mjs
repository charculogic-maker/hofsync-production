import { describe, it, before } from 'mocha';
import { expect } from 'chai';

let resolveStockDeductionsForOrder;

function installBrowserGlobals() {
  globalThis.window = globalThis.window || {};
  globalThis.document = globalThis.document || {
    querySelectorAll: () => [],
    getElementById: () => null,
    addEventListener: () => {},
  };
  globalThis.localStorage = globalThis.localStorage || {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}

function stockRef(id) {
  return { path: `tenants/StevesHof_Hauptbetrieb/stammdaten/${id}` };
}

function snapshotFor(ref) {
  return ref ? { exists: true, ref } : { exists: false, ref: null };
}

function querySnapshot(refs) {
  return {
    size: refs.length,
    empty: refs.length === 0,
    docs: refs.map((ref) => ({ ref })),
  };
}

function collectionStub({ byId = {}, byProdukt = {}, byName = {} } = {}) {
  return {
    doc: (id) => ({
      get: async () => snapshotFor(byId[id] || null),
    }),
    where: (field, op, value) => {
      expect(op).to.equal('==');
      const matches = field === 'produkt'
        ? (byProdukt[value] || [])
        : (byName[value] || []);
      return {
        limit: (count) => {
          expect(count).to.equal(2);
          return {
            get: async () => querySnapshot(matches),
          };
        },
      };
    },
  };
}

async function expectRejectsWith(promise, message) {
  try {
    await promise;
    throw new Error('Expected promise to reject');
  } catch (err) {
    expect(String(err?.message || err)).to.equal(message);
  }
}

describe('customer order stock deductions', () => {
  before(async () => {
    installBrowserGlobals();
    ({ resolveStockDeductionsForOrder } = await import('../web/customer-orders.js'));
  });

  it('aggregates duplicate order lines for the same stock document', async () => {
    const ref = stockRef('fleischsalat');
    const deductions = await resolveStockDeductionsForOrder({
      items: [
        { product: 'Fleischsalat', quantity: '1,5 kg' },
        { product: 'Fleischsalat', actualQuantity: '0,25 kg', quantity: '1 kg' },
        { product: 'Siehe Bestellzettel', quantity: '2' },
      ],
    }, collectionStub({ byProdukt: { Fleischsalat: [ref] } }));

    expect(deductions).to.have.lengthOf(1);
    expect(deductions[0]).to.include({ ref, amount: 1.75 });
    expect(deductions[0].product).to.equal('Fleischsalat, Fleischsalat');
  });

  it('fails closed when the matching stock item is missing', async () => {
    await expectRejectsWith(resolveStockDeductionsForOrder({
      items: [{ product: 'Rinderhack', quantity: '2 kg' }],
    }, collectionStub()), 'Bestandsartikel "Rinderhack" wurde nicht gefunden.');
  });

  it('fails closed when product lookup is ambiguous', async () => {
    await expectRejectsWith(resolveStockDeductionsForOrder({
      items: [{ product: 'Bratwurst', quantity: '3' }],
    }, collectionStub({
      byProdukt: {
        Bratwurst: [stockRef('bratwurst-a'), stockRef('bratwurst-b')],
      },
    })), 'Bestandsartikel "Bratwurst" ist mehrfach angelegt.');
  });

  it('fails closed when an explicit stock id does not exist', async () => {
    await expectRejectsWith(resolveStockDeductionsForOrder({
      items: [{ product: 'Salami', stockItemId: 'salami', quantity: '1' }],
    }, collectionStub()), 'Bestandsartikel "Salami" wurde nicht gefunden.');
  });
});
