import { expect } from 'chai';
import { mergeDeliveryMhdRecords } from '../web/mhd-delivery-records.js';

describe('Wareneingang MHD record merging', () => {
  it('aggregates duplicate delivery lines for the same MHD batch before writing', () => {
    const records = mergeDeliveryMhdRecords([
      {
        id: '123456__2026-10-20',
        qty: 15,
        menge: 15,
        eingangMenge: 15,
        _qtyFrom: 10,
        _mengeFrom: 10,
        _qtyIncrement: 5,
        _mengeIncrement: 5,
      },
      {
        id: '123456__2026-10-20',
        qty: 13,
        menge: 12.5,
        eingangMenge: 12.5,
        _qtyFrom: 10,
        _mengeFrom: 10,
        _qtyIncrement: 3,
        _mengeIncrement: 2.5,
      },
    ]);

    expect(records).to.have.length(1);
    expect(records[0]).to.include({
      id: '123456__2026-10-20',
      qty: 18,
      menge: 17.5,
      eingangMenge: 17.5,
      _qtyIncrement: 8,
      _mengeIncrement: 7.5,
    });
  });

  it('keeps distinct MHD batches as separate writes', () => {
    const records = mergeDeliveryMhdRecords([
      { id: '123456__2026-10-20', _qtyFrom: 0, _mengeFrom: 0, _qtyIncrement: 2, _mengeIncrement: 2 },
      { id: '123456__2026-10-21', _qtyFrom: 5, _mengeFrom: 5, _qtyIncrement: 1, _mengeIncrement: 1 },
    ]);

    expect(records.map((record) => record.id)).to.deep.equal([
      '123456__2026-10-20',
      '123456__2026-10-21',
    ]);
    expect(records.map((record) => record.qty)).to.deep.equal([2, 6]);
  });
});
