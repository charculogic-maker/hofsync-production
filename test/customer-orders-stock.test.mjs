import { describe, it } from 'mocha';
import { expect } from 'chai';

const { prepareStockDeductionsForOrderWithCollection } = await import('../web/customer-orders.js');

function createStockCollection(seedDocs) {
  const refs = new Map();

  function refFor(id) {
    if (!refs.has(id)) {
      refs.set(id, {
        id,
        path: `tenants/test/stammdaten/${id}`,
        async get() {
          const data = seedDocs[id];
          return {
            exists: Boolean(data),
            ref: refFor(id),
            data: () => data,
          };
        },
      });
    }
    return refs.get(id);
  }

  return {
    doc(id) {
      return refFor(id);
    },
    where(field, operator, value) {
      if (operator !== '==') throw new Error(`Unsupported fake operator: ${operator}`);
      return {
        limit(max) {
          return {
            async get() {
              const docs = Object.entries(seedDocs)
                .filter(([, data]) => data?.[field] === value)
                .slice(0, max)
                .map(([id]) => ({ ref: refFor(id) }));
              return {
                empty: docs.length === 0,
                docs,
              };
            },
          };
        },
      };
    },
  };
}

describe('customer order stock deduction preparation', () => {
  it('aggregates duplicate order lines for the same stock document', async () => {
    const col = createStockCollection({
      fleischsalat: { name: 'Fleischsalat', produkt: 'Fleischsalat', currentStock: 10 },
    });

    const deductions = await prepareStockDeductionsForOrderWithCollection({
      items: [
        { product: 'Fleischsalat', quantity: '1', stockItemId: 'fleischsalat' },
        { product: 'Fleischsalat', quantity: '2', stockItemId: 'fleischsalat' },
      ],
    }, col);

    expect(deductions).to.have.length(1);
    expect(deductions[0].ref.id).to.equal('fleischsalat');
    expect(deductions[0].amount).to.equal(3);
  });

  it('throws when an ordered product has no unique stock document', async () => {
    const col = createStockCollection({});

    let thrown;
    try {
      await prepareStockDeductionsForOrderWithCollection({
        items: [{ product: 'Fehlender Artikel', quantity: '1' }],
      }, col);
    } catch (err) {
      thrown = err;
    }

    expect(thrown?.message).to.include('Bestand nicht gefunden');
  });

  it('throws when product-name lookup is ambiguous', async () => {
    const col = createStockCollection({
      a: { name: 'Rindersteak', produkt: 'Rindersteak', currentStock: 4 },
      b: { name: 'Rindersteak', produkt: 'Rindersteak', currentStock: 7 },
    });

    let thrown;
    try {
      await prepareStockDeductionsForOrderWithCollection({
        items: [{ product: 'Rindersteak', quantity: '1' }],
      }, col);
    } catch (err) {
      thrown = err;
    }

    expect(thrown?.message).to.include('Bestand ist nicht eindeutig');
  });
});
