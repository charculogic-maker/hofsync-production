import { expect } from 'chai';
import { __customerOrdersTestInternals } from '../web/customer-orders.js';

const {
  buildStockDeductionsForOrderItems,
  calculateStockAfterDeduction,
  findSingleStockDocByField,
} = __customerOrdersTestInternals;

function ref(path) {
  return { path };
}

async function expectRejects(fn, pattern) {
  let error;
  try {
    await fn();
  } catch (err) {
    error = err;
  }
  expect(error).to.be.instanceOf(Error);
  expect(error.message).to.match(pattern);
}

describe('customer order pickup stock integrity', () => {
  it('fails closed when an order item cannot be matched to stock', async () => {
    await expectRejects(
      () => buildStockDeductionsForOrderItems(
        [{ product: 'Fleischsalat', quantity: '2', unit: 'kg' }],
        async () => null,
      ),
      /Kein Lagerbestand/,
    );
  });

  it('fails closed when product-name stock lookup is ambiguous', async () => {
    const col = {
      where(field, operator, value) {
        expect(field).to.equal('produkt');
        expect(operator).to.equal('==');
        expect(value).to.equal('Fleischsalat');
        return {
          limit(count) {
            expect(count).to.equal(2);
            return {
              async get() {
                return { docs: [{ ref: ref('stock/a') }, { ref: ref('stock/b') }] };
              },
            };
          },
        };
      },
    };

    await expectRejects(
      () => findSingleStockDocByField(col, 'produkt', 'Fleischsalat', 'Fleischsalat'),
      /Mehrere Lagerbest/,
    );
  });

  it('aggregates duplicate order lines before deducting stock', async () => {
    const stockRef = ref('tenants/shop/stammdaten/fleischsalat');
    const deductions = await buildStockDeductionsForOrderItems(
      [
        { product: 'Fleischsalat', quantity: '1,25', unit: 'kg' },
        { product: 'Fleischsalat', quantity: '1', actualQuantity: '0,75', unit: 'kg' },
      ],
      async () => stockRef,
    );

    expect(deductions).to.have.lengthOf(1);
    expect(deductions[0]).to.include({ ref: stockRef, product: 'Fleischsalat' });
    expect(deductions[0].amount).to.equal(2);
  });

  it('fails closed instead of clamping insufficient stock to zero', () => {
    expect(() => calculateStockAfterDeduction('1,5', 2, 'Fleischsalat'))
      .to.throw(/Nicht genug Lagerbestand/);
    expect(calculateStockAfterDeduction('5', 1.234, 'Fleischsalat')).to.equal(3.766);
  });
});
