import { describe, it } from 'mocha';
import { expect } from 'chai';
import { buildDeliveryParserReceiptWrites } from '../web/delivery-parser.js';

describe('delivery parser receipt persistence payloads', () => {
  it('builds tenant-scoped MHD and inventory writes without touching stammdaten stock', () => {
    const writes = buildDeliveryParserReceiptWrites({
      artikel: 'Galloway Hack 500g',
      menge: 6,
      kategorie: 'Fleisch',
      mhdIso: '2026-10-12',
    }, {
      author: 'Paddy',
      nowIso: '2026-10-03T12:00:00.000Z',
      tenantId: 'StevesHof_Hauptbetrieb',
      batchId: 'batch-test',
      rowIndex: 0,
    });

    expect(writes.mhd.collectionName).to.equal('mhd_liste');
    expect(writes.inventory.collectionName).to.equal('inventory');
    expect(writes.mhd.data.tenantId).to.equal('StevesHof_Hauptbetrieb');
    expect(writes.inventory.data.tenantId).to.equal('StevesHof_Hauptbetrieb');
    expect(writes.mhd.data.source).to.equal('wareneingang-lieferschein');
    expect(writes.inventory.data.source).to.equal('wareneingang-lieferschein');
    expect(writes.mhd.data.qty).to.equal(6);
    expect(writes.inventory.data.menge).to.equal(6);
    expect(writes.inventory.data).to.not.have.property('currentStock');
  });

  it('uses row indexes so duplicate Lieferschein articles do not overwrite each other', () => {
    const row = {
      artikel: 'Galloway Hack 500g',
      menge: 2,
      kategorie: 'Fleisch',
      mhdIso: '2026-10-12',
    };
    const first = buildDeliveryParserReceiptWrites(row, {
      tenantId: 'StevesHof_Hauptbetrieb',
      batchId: 'batch-test',
      rowIndex: 0,
    });
    const second = buildDeliveryParserReceiptWrites(row, {
      tenantId: 'StevesHof_Hauptbetrieb',
      batchId: 'batch-test',
      rowIndex: 1,
    });

    expect(first.mhd.docId).to.not.equal(second.mhd.docId);
    expect(first.inventory.docId).to.not.equal(second.inventory.docId);
  });
});
