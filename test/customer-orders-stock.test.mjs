import { describe, it } from 'mocha';
import { strict as assert } from 'node:assert';
import { expect } from 'chai';
import {
  applyStockDeductionsInTransaction,
  prepareStockDeductionsForOrder,
} from '../web/customer-orders.js';

function stockRef(id) {
  return { id, path: `tenants/torfabrik/stammdaten/${id}` };
}

function createStockCollection(rows) {
  const byId = new Map(rows.map((row) => [row.id, row]));

  return {
    doc(id) {
      return {
        async get() {
          return {
            exists: byId.has(id),
            ref: stockRef(id),
          };
        },
      };
    },
    where(field, operator, value) {
      expect(operator).to.equal('==');
      const matches = rows.filter((row) => row.data?.[field] === value);
      return {
        limit(max) {
          return {
            async get() {
              const docs = matches.slice(0, max).map((row) => ({ ref: stockRef(row.id) }));
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

function createTransaction(stockByPath) {
  const updates = [];
  return {
    updates,
    async get(ref) {
      const data = stockByPath.get(ref.path);
      return {
        exists: Boolean(data),
        data: () => data,
      };
    },
    update(ref, payload) {
      updates.push({ path: ref.path, payload });
    },
  };
}

const firebaseApi = {
  firestore: {
    FieldValue: {
      serverTimestamp: () => 'SERVER_TIMESTAMP',
    },
  },
};

describe('customer order pickup stock deductions', () => {
  it('aggregates duplicate order lines for the same stock document', async () => {
    const stockCol = createStockCollection([
      { id: 'fleischsalat', data: { produkt: 'Fleischsalat', name: 'Fleischsalat' } },
    ]);

    const deductions = await prepareStockDeductionsForOrder({
      items: [
        { product: 'Fleischsalat', quantity: '1,5', unit: 'kg' },
        { product: 'Fleischsalat', quantity: '0.5', unit: 'kg' },
      ],
    }, stockCol);

    expect(deductions).to.have.length(1);
    expect(deductions[0].ref.path).to.equal('tenants/torfabrik/stammdaten/fleischsalat');
    expect(deductions[0].amount).to.equal(2);
  });

  it('fails closed when no unique stock document exists', async () => {
    const emptyStock = createStockCollection([]);
    await assert.rejects(prepareStockDeductionsForOrder({
      items: [{ product: 'Leberwurst', quantity: '1', unit: 'Stück' }],
    }, emptyStock), /Kein Bestand für Leberwurst/);

    const ambiguousStock = createStockCollection([
      { id: 'salat-a', data: { produkt: 'Fleischsalat' } },
      { id: 'salat-b', data: { produkt: 'Fleischsalat' } },
    ]);
    await assert.rejects(prepareStockDeductionsForOrder({
      items: [{ product: 'Fleischsalat', quantity: '1', unit: 'kg' }],
    }, ambiguousStock), /Mehrere Bestände für Fleischsalat/);
  });

  it('throws before updating when stock is missing or insufficient in the transaction', async () => {
    const ref = stockRef('fleischsalat');
    const missingTx = createTransaction(new Map());

    await assert.rejects(applyStockDeductionsInTransaction(missingTx, [{
      ref,
      amount: 1,
      product: 'Fleischsalat',
    }], firebaseApi), /wurde nicht gefunden/);
    expect(missingTx.updates).to.deep.equal([]);

    const lowStockTx = createTransaction(new Map([[ref.path, { currentStock: 0.5 }]]));
    await assert.rejects(applyStockDeductionsInTransaction(lowStockTx, [{
      ref,
      amount: 1,
      product: 'Fleischsalat',
    }], firebaseApi), /Nicht genug Bestand/);
    expect(lowStockTx.updates).to.deep.equal([]);
  });

  it('deducts stock without clamping when enough stock is available', async () => {
    const ref = stockRef('fleischsalat');
    const tx = createTransaction(new Map([[ref.path, { currentStock: 3 }]]));

    await applyStockDeductionsInTransaction(tx, [{
      ref,
      amount: 2.25,
      product: 'Fleischsalat',
    }], firebaseApi);

    expect(tx.updates).to.deep.equal([{
      path: ref.path,
      payload: {
        currentStock: 0.75,
        updatedAt: 'SERVER_TIMESTAMP',
      },
    }]);
  });
});
