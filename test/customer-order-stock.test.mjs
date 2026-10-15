import { expect } from 'chai';
import { calculateNextStockOrThrow, mergeStockDeductions } from '../web/customer-order-stock.js';

describe('customer order stock deduction helpers', () => {
  it('aggregates duplicate order lines for the same stock document', () => {
    const ref = { path: 'tenants/demo/stammdaten/hack' };
    const deductions = mergeStockDeductions([
      { ref, amount: 1.2, product: 'Hackfleisch' },
      { ref, amount: 0.8, product: 'Hackfleisch' },
      { ref: { path: 'tenants/demo/stammdaten/filet' }, amount: 1, product: 'Filet' },
    ]);

    expect(deductions).to.have.length(2);
    expect(deductions[0]).to.include({ ref, amount: 2, product: 'Hackfleisch' });
    expect(deductions[1]).to.include({ amount: 1, product: 'Filet' });
  });

  it('fails closed instead of clamping insufficient stock to zero', () => {
    expect(() => calculateNextStockOrThrow(1, 1.5, 'Filet')).to.throw('Nicht genug Bestand');
  });

  it('returns the remaining stock when the deduction is safe', () => {
    expect(calculateNextStockOrThrow(3.125, 1.2, 'Hackfleisch')).to.equal(1.925);
  });
});
