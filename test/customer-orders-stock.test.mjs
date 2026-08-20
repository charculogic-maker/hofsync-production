import { expect } from 'chai';

describe('customer order stock deductions', () => {
  let helpers;

  before(async () => {
    global.window = global.window || {
      showToast: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    };
    global.CustomEvent = global.CustomEvent || class CustomEvent {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      }
    };
    global.localStorage = global.localStorage || {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
    global.document = global.document || { getElementById: () => null, querySelector: () => null };
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { onLine: true },
    });
    ({ __customerOrdersTest: helpers } = await import('../web/customer-orders.js'));
  });

  it('aggregates duplicate order lines for the same stock document', async () => {
    const ref = { id: 'salami', path: 'tenants/StevesHof_Hauptbetrieb/stammdaten/salami' };
    const deductions = await helpers.aggregateStockDeductions(
      [
        { product: 'Salami', quantity: '0,5' },
        { product: 'Salami', actualQuantity: 0.3, quantity: 0.4 },
      ],
      async () => ref,
    );

    expect(deductions).to.have.length(1);
    expect(deductions[0].amount).to.equal(0.8);
  });

  it('fails before pickup when a stock document is missing', async () => {
    try {
      await helpers.aggregateStockDeductions(
        [{ product: 'Fleischsalat', quantity: 1 }],
        async () => null,
      );
      throw new Error('expected aggregateStockDeductions to throw');
    } catch (err) {
      expect(String(err.message)).to.include('Bestand fehlt');
    }
  });

  it('fails before pickup when stock would go negative', () => {
    expect(() => helpers.nextStockAfterDeduction(0.4, 0.8, 'Salami'))
      .to.throw('Bestand reicht nicht aus');
  });
});
