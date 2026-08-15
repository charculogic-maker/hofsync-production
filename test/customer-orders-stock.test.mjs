import { expect } from 'chai';
import { buildStockDeductionsForItems } from '../web/customer-orders.js';
import { normalizeTraceOrganicAssociation } from '../web/traceability.js';

async function expectRejects(promise, pattern) {
  try {
    await promise;
  } catch (err) {
    expect(String(err?.message || err)).to.match(pattern);
    return;
  }
  throw new Error('Expected promise to reject');
}

describe('customer order stock deduction integrity', () => {
  it('aggregates duplicate order lines for the same stock document', async () => {
    const ref = { path: 'tenants/StevesHof_Hauptbetrieb/stammdaten/fleischsalat' };
    const deductions = await buildStockDeductionsForItems(
      [
        { product: 'Fleischsalat', quantity: '1' },
        { product: 'Fleischsalat', quantity: '1', actualQuantity: '2,5' },
      ],
      async () => ref,
    );

    expect(deductions).to.have.length(1);
    expect(deductions[0].ref).to.equal(ref);
    expect(deductions[0].amount).to.equal(3.5);
  });

  it('fails closed when an order line has no matching stock document', async () => {
    await expectRejects(
      buildStockDeductionsForItems(
        [{ product: 'Roulade', quantity: '2' }],
        async () => null,
      ),
      /Bestand für Roulade wurde nicht gefunden/,
    );
  });

  it('propagates ambiguous stock matches before marking pickup complete', async () => {
    await expectRejects(
      buildStockDeductionsForItems(
        [{ product: 'Bratwurst', quantity: '1' }],
        async () => {
          throw new Error('Mehrere Bestände für Bratwurst gefunden. Bitte im Büro klären.');
        },
      ),
      /Mehrere Bestände für Bratwurst/,
    );
  });
});

describe('traceability Bio association normalization', () => {
  it('keeps empty Bio-Verband empty instead of inventing EU-Bio', () => {
    expect(normalizeTraceOrganicAssociation('')).to.equal('');
    expect(normalizeTraceOrganicAssociation('Mystery-Bio')).to.equal('');
    expect(normalizeTraceOrganicAssociation('EU-Bio')).to.equal('EU-Bio');
  });
});
