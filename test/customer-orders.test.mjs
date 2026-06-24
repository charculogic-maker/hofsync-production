import { describe, it } from 'mocha';
import { expect } from 'chai';
import {
  aggregateStockDeductions,
  generateSammelPickliste,
  getProductionTasksByStation,
  prepareStockDeductionsForOrder,
} from '../web/customer-orders.js';

describe('customer order fulfillment helpers', () => {
  it('keeps duplicate order lines addressable by their original line index', () => {
    const orders = [{
      id: 'order-1',
      status: 'open',
      items: [
        { product: 'Rindersteak', quantity: '1', unit: 'kg', category: 'Metzgerei / Produktion', lineNotes: 'dick' },
        { product: 'Rindersteak', quantity: '2', unit: 'kg', category: 'Metzgerei / Produktion', lineNotes: 'dünn' },
      ],
    }];

    const picklistRefs = generateSammelPickliste(orders)
      .categories[0]
      .items[0]
      .refs;
    expect(picklistRefs.map((ref) => ref.lineIndex)).to.deep.equal([0, 1]);

    const productionRefs = getProductionTasksByStation(orders)
      .butchery[0]
      .refs;
    expect(productionRefs.map((ref) => ref.lineIndex)).to.deep.equal([0, 1]);
  });

  it('combines stock deductions that target the same Stammdaten document', () => {
    const ref = { path: 'tenants/StevesHof_Hauptbetrieb/stammdaten/fleischsalat' };
    const aggregated = aggregateStockDeductions([
      { ref, amount: 1.25, product: 'Fleischsalat' },
      { ref, amount: 0.75, product: 'Fleischsalat' },
    ]);

    expect(aggregated).to.have.length(1);
    expect(aggregated[0].amount).to.equal(2);
  });

  it('rejects pickup preparation when an ordered stock item cannot be resolved', async () => {
    const order = {
      id: 'order-2',
      items: [
        { product: 'Nicht angelegter Artikel', quantity: '1', unit: 'kg' },
      ],
    };

    let error;
    try {
      await prepareStockDeductionsForOrder(order, async () => null);
    } catch (err) {
      error = err;
    }
    expect(error?.message).to.include('Lagerartikel fehlt');
  });
});
