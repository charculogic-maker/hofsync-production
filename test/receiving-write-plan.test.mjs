import { describe, it } from 'mocha';
import { expect } from 'chai';
import { buildDeliveryParserMhdWrite } from '../web/delivery-parser.js';
import { mergeDeliveryMhdRecordsForWrite } from '../web/mhd.js';

describe('receiving write plans', () => {
  it('builds tenant-scoped Lieferschein MHD writes with unique duplicate-line ids', () => {
    const base = {
      author: 'Paddy',
      nowIso: '2026-09-24T10:00:00.000Z',
      tenantId: 'StevesHof_Hauptbetrieb',
      batchId: 'ls_batch_1',
    };

    const first = buildDeliveryParserMhdWrite(
      { artikel: 'Bio Milch', menge: 2.4, kategorie: 'MoPro', mhdIso: '2026-09-30' },
      { ...base, index: 0 },
    );
    const second = buildDeliveryParserMhdWrite(
      { artikel: 'Bio Milch', menge: 1, kategorie: 'MoPro', mhdIso: '2026-09-30' },
      { ...base, index: 1 },
    );

    expect(first.collectionPath).to.equal('mhd_liste');
    expect(first.docId).to.not.equal(second.docId);
    expect(first.onlineData.tenantId).to.equal('StevesHof_Hauptbetrieb');
    expect(first.queueData.tenantId).to.equal('StevesHof_Hauptbetrieb');
    expect(first.onlineData.qty).to.equal(2);
    expect(first.onlineData.menge).to.equal(2.4);
    expect(first.onlineData.source).to.equal('wareneingang-lieferschein');
  });

  it('rejects Lieferschein writes without a tenant context', () => {
    expect(() => buildDeliveryParserMhdWrite(
      { artikel: 'Bio Milch', menge: 1, mhdIso: '2026-09-30' },
      { tenantId: '' },
    )).to.throw('Mandant fehlt');
  });

  it('sums duplicate same-batch Wareneingang rows before writing', () => {
    const [record] = mergeDeliveryMhdRecordsForWrite([
      {
        id: '4000000000000_2026-09-30',
        qty: 7,
        menge: 7,
        _qtyFrom: 5,
        _mengeFrom: 5,
        _lineQty: 2,
        _lineMenge: 2,
        _deliveryAlreadyApplied: false,
      },
      {
        id: '4000000000000_2026-09-30',
        qty: 8,
        menge: 8,
        _qtyFrom: 5,
        _mengeFrom: 5,
        _lineQty: 3,
        _lineMenge: 3,
        _deliveryAlreadyApplied: false,
      },
    ]);

    expect(record.qty).to.equal(10);
    expect(record.menge).to.equal(10);
    expect(record.eingangMenge).to.equal(10);
    expect(record._qtyFrom).to.equal(5);
    expect(record._lineQty).to.equal(5);
    expect(record._deliveryAlreadyApplied).to.equal(false);
  });

  it('keeps already-applied retry rows from adding quantity again', () => {
    const [record] = mergeDeliveryMhdRecordsForWrite([
      {
        id: '4000000000000_2026-09-30',
        qty: 7,
        menge: 7,
        _qtyFrom: 7,
        _mengeFrom: 7,
        _lineQty: 0,
        _lineMenge: 0,
        _deliveryAlreadyApplied: true,
      },
    ]);

    expect(record.qty).to.equal(7);
    expect(record.menge).to.equal(7);
    expect(record._lineQty).to.equal(0);
    expect(record._deliveryAlreadyApplied).to.equal(true);
  });
});
