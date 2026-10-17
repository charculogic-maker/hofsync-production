/**
 * Avery 3475 Modul — LOT, Presets, Sheet-Planung, Offset.
 */
import { describe, it } from 'mocha';
import { expect } from 'chai';
import {
  AVERY_CUT_CATALOG,
  AVERY_LABELS_PER_SHEET,
  AVERY_PRESETS,
  buildAveryLot,
  expandQueueToLabels,
  formatDateDe,
  planAverySheet,
} from '../web/avery-labels.js';

describe('Avery 3475 labels module', () => {
  it('exposes 24 labels per sheet and WG catalog cuts', () => {
    expect(AVERY_LABELS_PER_SHEET).to.equal(24);
    expect(AVERY_CUT_CATALOG.length).to.be.above(20);
    expect(AVERY_PRESETS.vv).to.have.length(10);
    expect(AVERY_PRESETS.hv).to.have.length(11);
  });

  it('builds LOT as BRAND-OHR-YYYYMMDD', () => {
    expect(buildAveryLot({
      brand: 'SH',
      ohrmarke: 'DE12 345',
      schlachtDatum: '2026-10-17',
    })).to.equal('SH-DE12345-20261017');
  });

  it('formats slaughter dates as German DD.MM.YYYY', () => {
    expect(formatDateDe('2026-10-17')).to.equal('17.10.2026');
  });

  it('plans empty offset cells from start slot', () => {
    const queue = [
      { cutId: 'vv-entrecote', qty: 2 },
      { cutId: 'tr-r2', qty: 1 },
    ];
    const plan = planAverySheet({ queue, startSlot: 5 });
    expect(plan.emptyCount).to.equal(4);
    expect(plan.filledCount).to.equal(3);
    expect(plan.usage).to.equal(7);
    expect(plan.overflow).to.equal(0);
    expect(expandQueueToLabels(queue)).to.have.length(3);
  });

  it('reports overflow when queue exceeds remaining sheet capacity', () => {
    const queue = [{ cutId: 'tr-r2', qty: 10 }];
    const plan = planAverySheet({ queue, startSlot: 20 });
    expect(plan.capacity).to.equal(5);
    expect(plan.filledCount).to.equal(5);
    expect(plan.overflow).to.equal(5);
  });

  it('includes VV/HV/frisch/innereien tabs and trim grades', () => {
    const tabs = new Set(AVERY_CUT_CATALOG.map((cut) => cut.tab));
    expect([...tabs].sort()).to.deep.equal(['frisch', 'hv', 'innereien', 'vv']);
    expect(AVERY_CUT_CATALOG.filter((cut) => cut.trim)).to.have.length(5);
  });
});
