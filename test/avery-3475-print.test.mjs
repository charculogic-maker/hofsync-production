/**
 * Avery 3475 Etiketten-Druckstation – Offset, Validierung, Datumsformat.
 */
import { describe, it } from 'mocha';
import { expect } from 'chai';
import {
  AVERY_LABELS_PER_SHEET,
  formatSlaughterDateDe,
  planAverySheet,
  validateAveryForm,
  escapeHtml,
} from '../web/prod.js';

describe('Avery 3475 print planner', () => {
  it('uses 24 labels per A4 sheet', () => {
    expect(AVERY_LABELS_PER_SHEET).to.equal(24);
  });

  it('plans empty offset cells from start position', () => {
    const plan = planAverySheet({ startPosition: 5, count: 3 });
    expect(plan).to.include({
      emptyCount: 4,
      filledCount: 3,
      lastPosition: 7,
      fitsOnSheet: true,
    });
  });

  it('defaults start position to 1', () => {
    const plan = planAverySheet({ count: 2 });
    expect(plan.emptyCount).to.equal(0);
    expect(plan.filledCount).to.equal(2);
  });

  it('rejects overflow past label 24', () => {
    const plan = planAverySheet({ startPosition: 22, count: 5 });
    expect(plan.fitsOnSheet).to.equal(false);
    expect(validateAveryForm({
      article: 'Roastbeef',
      lot: 'L-1',
      slaughterDateIso: '2026-10-17',
      startPosition: 22,
      count: 5,
    })).to.match(/passen nur noch/);
  });

  it('requires article, lot and slaughter date', () => {
    expect(validateAveryForm({
      article: '',
      lot: 'L-1',
      slaughterDateIso: '2026-10-17',
      startPosition: 1,
      count: 1,
    })).to.match(/Artikel/);
    expect(validateAveryForm({
      article: 'Filet',
      lot: '',
      slaughterDateIso: '2026-10-17',
      startPosition: 1,
      count: 1,
    })).to.match(/LOT/);
    expect(validateAveryForm({
      article: 'Filet',
      lot: 'L-1',
      slaughterDateIso: '',
      startPosition: 1,
      count: 1,
    })).to.match(/Schlachtdatum/);
  });

  it('formats ISO slaughter date as German DD.MM.YYYY', () => {
    expect(formatSlaughterDateDe('2026-10-17')).to.equal('17.10.2026');
  });

  it('escapes HTML in label text helpers', () => {
    expect(escapeHtml('A & B <C>')).to.equal('A &amp; B &lt;C&gt;');
  });
});
