import { describe, it } from 'mocha';
import { expect } from 'chai';

import { buildStockDeductionsForItems } from '../web/customer-orders.js';
import { buildDeliveryParserMhdData, buildDeliveryParserStockData } from '../web/delivery-parser.js';
import { normalizeOrganicAssociationForSave } from '../web/traceability.js';

describe('customer order stock deductions', () => {
  it('aggregates duplicate order lines for the same stock document', async () => {
    const stockRef = { path: 'tenants/StevesHof_Hauptbetrieb/stammdaten/fleischsalat' };
    const deductions = await buildStockDeductionsForItems(
      [
        { product: 'Fleischsalat', quantity: '1,5', unit: 'kg' },
        { product: 'Fleischsalat', actualQuantity: '0.25', quantity: '1', unit: 'kg' },
      ],
      async () => stockRef,
    );

    expect(deductions).to.have.length(1);
    expect(deductions[0]).to.include({
      ref: stockRef,
      amount: 1.75,
      product: 'Fleischsalat',
    });
  });

  it('fails closed when an order item cannot be matched to stock', async () => {
    try {
      await buildStockDeductionsForItems(
        [{ product: 'Rindersteak', quantity: '2', unit: 'kg' }],
        async () => null,
      );
      throw new Error('Expected buildStockDeductionsForItems to throw');
    } catch (err) {
      expect(String(err?.message || err)).to.contain('Bestand für Rindersteak wurde nicht gefunden');
    }
  });
});

describe('traceability organic association persistence', () => {
  it('does not invent EU-Bio for blank or conventional entries', () => {
    expect(normalizeOrganicAssociationForSave('')).to.equal('');
    expect(normalizeOrganicAssociationForSave('   ')).to.equal('');
    expect(normalizeOrganicAssociationForSave('Keine / Konventionell')).to.equal('Keine / Konventionell');
    expect(normalizeOrganicAssociationForSave(' EU-Bio ')).to.equal('EU-Bio');
  });
});

describe('delivery parser receiving payloads', () => {
  it('builds matching tenant-scoped stock and MHD records for one atomic batch', () => {
    const row = {
      artikel: 'Joghurt Natur',
      kategorie: 'Molkerei',
      menge: 6,
      mhdIso: '2026-08-25',
    };
    const stock = buildDeliveryParserStockData(
      row,
      'team',
      '2026-08-18T10:00:00.000Z',
      'StevesHof_Hauptbetrieb',
      { __op: 'increment', operand: 6 },
      'server-time',
    );
    const mhd = buildDeliveryParserMhdData(
      row,
      'team',
      '2026-08-18T10:00:00.000Z',
      'StevesHof_Hauptbetrieb',
      'ls_joghurt-natur_1',
    );

    expect(stock).to.include({
      artikel: 'Joghurt Natur',
      produkt: 'Joghurt Natur',
      name: 'Joghurt Natur',
      source: 'wareneingang-lieferschein',
      tenantId: 'StevesHof_Hauptbetrieb',
      updatedAt: 'server-time',
    });
    expect(stock.currentStock).to.deep.equal({ __op: 'increment', operand: 6 });
    expect(mhd).to.include({
      id: 'ls_joghurt-natur_1',
      postenId: 'ls_joghurt-natur_1',
      produkt: 'Joghurt Natur',
      source: 'wareneingang-lieferschein',
      postentyp: 'wareneingang',
      tenantId: 'StevesHof_Hauptbetrieb',
    });
  });
});
