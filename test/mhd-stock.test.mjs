import { expect } from 'chai';
import {
  computeTotalStock,
  normalizeUnassignedStock,
  resolveUnassignedFromTotalTarget,
  sumActiveBatchQuantities,
} from '../web/mhd-stock.js';

describe('MHD-sicherer Bestandsabgleich', () => {
  it('summiert nur aktive Chargen', () => {
    const sum = sumActiveBatchQuantities([
      { qty: 3, mhd: '2026-10-01' },
      { menge: 2, mhd: '2026-10-05' },
      { qty: 9, soldOut: true },
    ]);
    expect(sum).to.equal(5);
  });

  it('berechnet Gesamtbestand als Chargen + Allgemeiner Bestand', () => {
    expect(computeTotalStock(5, 3)).to.equal(8);
    expect(computeTotalStock(5, -1)).to.equal(4);
  });

  it('verbucht die Differenz im Allgemeinen Bestand ohne Chargen zu ändern', () => {
    expect(resolveUnassignedFromTotalTarget(10, 7)).to.equal(3);
    expect(resolveUnassignedFromTotalTarget(4, 7)).to.equal(-3);
    expect(resolveUnassignedFromTotalTarget(-1, 7)).to.equal(null);
  });

  it('normalisiert UnassignedStock auf ganze Zahlen', () => {
    expect(normalizeUnassignedStock(3.9)).to.equal(3);
    expect(normalizeUnassignedStock('2')).to.equal(2);
    expect(normalizeUnassignedStock('x')).to.equal(0);
  });
});
