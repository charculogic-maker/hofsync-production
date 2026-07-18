import { describe, it } from 'mocha';
import { expect } from 'chai';
import { prepareStockDeductionsForItems } from '../web/customer-orders.js';

function ref(path) {
  return { path };
}

describe('customer order pickup stock deductions', () => {
  it('aggregates duplicate order lines before the transaction writes stock', async () => {
    const deductions = await prepareStockDeductionsForItems(
      [
        { product: 'Fleischsalat', quantity: '2' },
        { product: 'Fleischsalat', actualQuantity: '1,5', quantity: '2' },
      ],
      async () => ref('tenants/StevesHof_Hauptbetrieb/stammdaten/fleischsalat'),
    );

    expect(deductions).to.have.lengthOf(1);
    expect(deductions[0].amount).to.equal(3.5);
    expect(deductions[0].product).to.equal('Fleischsalat');
  });

  it('rejects pickup preparation when a stock match is missing', async () => {
    let error = null;
    try {
      await prepareStockDeductionsForItems(
        [{ product: 'Rindersteak', quantity: '1' }],
        async () => { throw new Error('Kein Bestandseintrag gefunden: Rindersteak.'); },
      );
    } catch (err) {
      error = err;
    }

    expect(error).to.be.instanceOf(Error);
    expect(error.message).to.equal('Kein Bestandseintrag gefunden: Rindersteak.');
  });
});
