/**
 * Avery 3475 Modul — Hof-Katalog, Trimmings, Freifeld, Sheet-Planung.
 */
import { describe, it } from 'mocha';
import { expect } from 'chai';
import {
  AVERY_CUT_CATALOG,
  AVERY_LABELS_PER_SHEET,
  AVERY_TRIMMINGS,
  CUSTOM_AGING_OPTIONS,
  GALLOWAY_CATALOG,
  addDaysIso,
  buildAveryLot,
  buildLabelHtml,
  expandQueueToLabels,
  formatDateDe,
  formatLabelTitle,
  planAverySheet,
  resolveQueueCut,
  storageFootLine,
  storageHintForCut,
} from '../web/avery-labels.js';

describe('Avery 3475 labels module', () => {
  it('exposes 24 labels and five practice catalog groups', () => {
    expect(AVERY_LABELS_PER_SHEET).to.equal(24);
    expect(Object.keys(GALLOWAY_CATALOG).sort()).to.deep.equal([
      'innereien',
      'keule',
      'lappen',
      'ruecken',
      'schultern',
    ]);
    expect(GALLOWAY_CATALOG.schultern.some((c) => /Brust/.test(c.name))).to.equal(true);
    expect(GALLOWAY_CATALOG.schultern.some((c) => /Nacken|Hals/.test(c.name))).to.equal(true);
    expect(GALLOWAY_CATALOG.ruecken.some((c) => /Nacken/.test(c.name))).to.equal(false);
    expect(GALLOWAY_CATALOG.lappen.some((c) => /Brust/.test(c.name))).to.equal(false);
    expect(AVERY_CUT_CATALOG.length).to.be.above(20);
  });

  it('maps trimmings to farm article numbers', () => {
    expect(AVERY_TRIMMINGS.map((t) => t.artNr)).to.deep.equal(['504', '543', '503', '530', '449']);
    expect(AVERY_TRIMMINGS.map((t) => t.name)).to.deep.equal([
      'R I Mager',
      'R I Spieße',
      'R II Hack',
      'R III Wurst',
      'Fett',
    ]);
  });

  it('builds LOT as BRAND-OHR-YYYYMMDD', () => {
    expect(buildAveryLot({
      brand: 'SH',
      ohrmarke: 'DE12 345',
      schlachtDatum: '2026-10-17',
    })).to.equal('SH-DE12345-20261017');
  });

  it('formats dates and computes ripening readiness', () => {
    expect(formatDateDe('2026-10-17')).to.equal('17.10.2026');
    expect(addDaysIso('2026-10-17', 14)).to.equal('2026-10-31');
    expect(CUSTOM_AGING_OPTIONS.map((o) => o.days)).to.deep.equal([0, 14, 21, 28]);
  });

  it('plans empty offset cells from start slot including custom cuts', () => {
    const queue = [
      { cutId: 'rue-entrecote', qty: 2 },
      { cutId: 'tr-r2-hack', qty: 1 },
      { cutId: 'custom-1', qty: 1, isCustom: true, name: 'Tomahawk', days: 21 },
    ];
    const plan = planAverySheet({ queue, startSlot: 5 });
    expect(plan.emptyCount).to.equal(4);
    expect(plan.filledCount).to.equal(4);
    expect(expandQueueToLabels(queue)).to.have.length(4);
    expect(resolveQueueCut(queue[2]).name).to.equal('Tomahawk');
    expect(resolveQueueCut(queue[2]).days).to.equal(21);
  });

  it('reports overflow when queue exceeds remaining sheet capacity', () => {
    const queue = [{ cutId: 'tr-r2-hack', qty: 10 }];
    const plan = planAverySheet({ queue, startSlot: 20 });
    expect(plan.capacity).to.equal(5);
    expect(plan.filledCount).to.equal(5);
    expect(plan.overflow).to.equal(5);
  });

  it('uses colder storage hint for Innereien', () => {
    expect(storageHintForCut(GALLOWAY_CATALOG.innereien[0])).to.equal('≤ 3 °C');
    expect(storageHintForCut(AVERY_TRIMMINGS[0])).to.equal('0–2 °C');
  });

  it('formats R-Abschnitt titles with middle dot', () => {
    expect(formatLabelTitle('R I Spieße')).to.equal('R I · Spieße');
    expect(formatLabelTitle('R II Hack')).to.equal('R II · Hack');
    expect(formatLabelTitle('R III Wurst')).to.equal('R III · Wurst');
    expect(formatLabelTitle('Brust / Brisket')).to.equal('Brust / Brisket');
  });

  it('builds Inhalt-zuerst label HTML without Art.-Nr. or empty OHR', () => {
    const cut = AVERY_TRIMMINGS.find((t) => t.id === 'tr-r1-spiesse');
    expect(storageFootLine(cut, 'DE-ÖKO-006')).to.equal('DE-ÖKO-006 · Gekühlt bei 0–2 °C lagern');
    expect(storageFootLine(GALLOWAY_CATALOG.innereien[0], 'DE-ÖKO-006'))
      .to.equal('DE-ÖKO-006 · Gekühlt bei ≤ 3 °C lagern');

    const htmlEmptyOhr = buildLabelHtml(cut, {
      betrieb: 'StevesHof Hofladen',
      oeko: 'DE-ÖKO-006',
      schlachthof: 'Bio-Schlachthof Stautenhof Willich',
      ohrmarke: '',
      schlachtDatum: '2026-10-18',
      zerlegeDatum: '2026-10-18',
      printBetrieb: false,
      printSchlachthof: false,
    }, 'SH-OHR-20261018');
    expect(htmlEmptyOhr).to.include('label-card');
    expect(htmlEmptyOhr).to.include('lbl-hero');
    expect(htmlEmptyOhr).to.include('lbl-meta');
    expect(htmlEmptyOhr).to.include('lbl-foot');
    expect(htmlEmptyOhr).to.include('R I · Spieße');
    expect(htmlEmptyOhr).to.include('Gekühlt bei 0–2 °C lagern');
    expect(htmlEmptyOhr).to.not.include('ART.');
    expect(htmlEmptyOhr).to.not.include('lbl-header');
    expect(htmlEmptyOhr).to.not.match(/OHR\s/);
    expect(htmlEmptyOhr).to.not.include('StevesHof Hofladen');

    const longCut = GALLOWAY_CATALOG.schultern.find((c) => c.id === 'sch-falsches-filet');
    const longHtml = buildLabelHtml(longCut, {
      betrieb: 'StevesHof Galloway',
      oeko: 'DE-ÖKO-006',
      ohrmarke: 'DE123',
      schlachtDatum: '2026-10-18',
      zerlegeDatum: '2026-10-18',
      printBetrieb: true,
      printSchlachthof: false,
    }, 'SH-DE123-20261018');
    expect(longHtml).to.include('Falsches Filet');
    expect(longHtml).to.include('lbl-farm');
    expect(longHtml).to.include('StevesHof Galloway');
    expect(longHtml).to.include('OHR DE123');
  });
});
