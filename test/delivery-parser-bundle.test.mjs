import { expect } from 'chai';
import { __deliveryParserTestInternals } from '../web/delivery-parser.js';

const { buildDeliveryParserWriteBundle } = __deliveryParserTestInternals;

describe('delivery parser receipt bundle', () => {
  it('builds tenant-scoped inventory and MHD writes with allowed receipt fields', () => {
    const entries = buildDeliveryParserWriteBundle(
      [{ artikel: 'Fleischsalat', menge: 3.5, kategorie: 'Wurst', mhdIso: '2026-08-30' }],
      {
        author: 'team',
        nowIso: '2026-08-24T12:00:00.000Z',
        tenantId: 'torfabrik',
        batchId: 'batch-test',
      },
    );

    expect(entries).to.have.lengthOf(2);
    const [inventory, mhd] = entries;

    expect(inventory.collectionPath).to.equal('tenants/torfabrik/inventory');
    expect(inventory.op).to.equal('create');
    expect(Object.keys(inventory.onlineData).sort()).to.deep.equal([
      'artikel',
      'batchId',
      'createdAt',
      'createdBy',
      'kategorie',
      'menge',
      'source',
      'tenantId',
    ]);
    expect(inventory.onlineData).to.include({
      artikel: 'Fleischsalat',
      menge: 3.5,
      source: 'wareneingang-lieferschein',
      tenantId: 'torfabrik',
    });

    expect(mhd.collectionPath).to.equal('tenants/torfabrik/mhd_liste');
    expect(mhd.onlineData).to.include({
      produkt: 'Fleischsalat',
      qty: 3.5,
      menge: 3.5,
      tenantId: 'torfabrik',
      source: 'wareneingang-lieferschein',
      postentyp: 'wareneingang',
      lieferungId: 'batch-test',
    });
  });
});
