/**
 * Avery 3475 Modul — PLU-Katalog, Trimmings, Freifeld, Plain-Text, Sheet-Planung.
 */
import { readFileSync } from 'node:fs';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import {
  AVERY_CUT_CATALOG,
  AVERY_LABELS_PER_SHEET,
  AVERY_LEGACY_CUT_IDS,
  AVERY_TRIMMINGS,
  CUSTOM_AGING_OPTIONS,
  GALLOWAY_CATALOG,
  addDaysIso,
  buildAveryLot,
  buildLabelHtml,
  expandQueueToLabels,
  formatDateDe,
  formatLabelTitle,
  getCutByArtNr,
  getCutById,
  labelQtyFromButcheryTask,
  mapButcheryTasksToAveryImportItems,
  mapHerkunftRecordToAveryHeader,
  matchAveryCatalogEntry,
  parseAveryPlainTextLine,
  parseAveryPlainTextList,
  parseHerkunftLotForAvery,
  planAverySheet,
  planAverySheets,
  applyAveryDraftPayload,
  averyDraftUpdatedAtMs,
  resolveAveryCutId,
  resolveQueueCut,
  serializeAveryDraft,
  storageFootLine,
  storageHintForCut,
} from '../web/avery-labels.js';

describe('Avery 3475 labels module', () => {
  it('exposes 24 labels and five PLU practice catalog groups', () => {
    expect(AVERY_LABELS_PER_SHEET).to.equal(24);
    expect(Object.keys(GALLOWAY_CATALOG).sort()).to.deep.equal([
      'innereien',
      'keule',
      'lappen',
      'ruecken',
      'schultern',
    ]);
    expect(GALLOWAY_CATALOG.schultern.some((c) => /Brust/.test(c.name))).to.equal(true);
    expect(GALLOWAY_CATALOG.schultern.every((c) => c.artNr)).to.equal(true);
    expect(GALLOWAY_CATALOG.ruecken.some((c) => /Nacken/.test(c.name))).to.equal(false);
    expect(GALLOWAY_CATALOG.lappen.some((c) => /Brust/.test(c.name))).to.equal(false);
    expect(GALLOWAY_CATALOG.ruecken.some((c) => c.artNr === '514')).to.equal(true);
    expect(AVERY_CUT_CATALOG.length).to.be.above(40);
    expect(new Set(AVERY_CUT_CATALOG.map((c) => c.artNr)).size).to.equal(AVERY_CUT_CATALOG.length);
  });

  it('maps trimmings to farm PLU numbers from Zerlege-HTML', () => {
    expect(AVERY_TRIMMINGS.map((t) => t.artNr)).to.deep.equal(['504', '535', '503', '460', '449']);
    expect(AVERY_TRIMMINGS.map((t) => t.name)).to.deep.equal([
      'R I Mager',
      'R I Spieße',
      'R II Hack',
      'R III Wurst',
      'Fett',
    ]);
  });

  it('resolves legacy cut ids and looks up by PLU', () => {
    expect(resolveAveryCutId('rue-entrecote')).to.equal('rue-514');
    expect(AVERY_LEGACY_CUT_IDS['sch-falsches-filet']).to.equal('sch-510');
    expect(getCutById('sch-falsches-filet')?.name).to.equal('Falsches Filet');
    expect(getCutByArtNr('514')?.id).to.equal('rue-514');
    expect(matchAveryCatalogEntry('Entrecôte')?.artNr).to.equal('514');
    expect(matchAveryCatalogEntry('Hackfleisch')?.id).to.equal('tr-r2-hack');
  });

  it('parses plain-text packing notes into catalog rows and freefield', () => {
    expect(parseAveryPlainTextLine('Entrecôte 4')).to.deep.include({ name: 'Entrecôte', qty: 4 });
    expect(parseAveryPlainTextLine('514 x3')).to.deep.include({ plu: '514', qty: 3 });
    expect(parseAveryPlainTextLine('Club Steak 549')).to.deep.include({ plu: '549', qty: 1 });
    expect(parseAveryPlainTextLine('Picanha')).to.deep.include({ name: 'Picanha', qty: 1 });

    const parsed = parseAveryPlainTextList([
      'Entrecôte 4',
      'Filet 2',
      '514 x3',
      'R II Hack 6',
      'Picanha',
      '# Kommentar',
    ].join('\n'));
    expect(parsed.matchedCount).to.equal(4);
    expect(parsed.customCount).to.equal(1);
    expect(parsed.totalLabels).to.equal(4 + 2 + 3 + 6 + 1);
    expect(parsed.items.find((i) => i.name === 'Picanha')?.cut).to.equal(null);
    expect(parsed.items.find((i) => i.plu === '514')?.cut?.id).to.equal('rue-514');
  });

  it('shares drafts via merge-update (no op:set createdAt clash)', () => {
    const source = readFileSync(
      new URL('../web/avery-labels.js', import.meta.url),
      'utf8',
    );
    const rules = readFileSync(
      new URL('../firebase.rules', import.meta.url),
      'utf8',
    );
    expect(source).to.match(/AVERY_DRAFT_COLLECTION/);
    expect(rules).to.match(/match \/tenants\/\{tenantId\}\/averyDrafts/);
    expect(rules).to.match(/'createdAt'/);
    const flushBlock = source.slice(
      source.indexOf('async function flushAveryDraftToCloud'),
      source.indexOf('function scheduleAveryDraftCloudWrite'),
    );
    expect(flushBlock).to.match(/writeFirestoreDocOrQueue\(\{[\s\S]*?op:\s*'update'/);
    expect(flushBlock).to.not.match(/writeFirestoreDocOrQueue\(\{[\s\S]*?op:\s*'set'/);
  });

  it('serializes and applies shared Phone↔PC draft payloads', () => {
    expect(averyDraftUpdatedAtMs('2026-10-21T10:00:00.000Z')).to.be.above(0);
    applyAveryDraftPayload({
      header: {
        betrieb: 'StevesHof',
        oeko: 'DE-ÖKO-006',
        ohrmarke: 'DE999',
        schlachtDatum: '2026-10-20',
        zerlegeDatum: '2026-10-21',
        brand: 'SH',
        printBetrieb: false,
        printSchlachthof: false,
        printPlu: true,
      },
      queue: [
        { cutId: 'rue-514', qty: 2 },
        { cutId: 'custom-x', qty: 1, isCustom: true, name: 'Picanha', days: 0 },
        { cutId: 'legacy-gone', qty: 3 },
      ],
      startSlot: 3,
      activeTab: 'ruecken',
      updatedAtMs: 1_700_000_000_000,
      updatedBy: 'Metzgerei',
      deviceId: 'phone-1',
    });
    const draft = serializeAveryDraft({
      updatedAtMs: 1_700_000_000_100,
      updatedBy: 'Metzgerei',
      deviceId: 'phone-1',
    });
    expect(draft.startSlot).to.equal(3);
    expect(draft.activeTab).to.equal('ruecken');
    expect(draft.queue).to.deep.equal([
      { cutId: 'rue-514', qty: 2 },
      {
        cutId: 'custom-x',
        qty: 1,
        isCustom: true,
        name: 'Picanha',
        days: 0,
      },
    ]);
    expect(draft.header.ohrmarke).to.equal('DE999');
    expect(draft.updatedBy).to.equal('Metzgerei');
    expect(draft.deviceId).to.equal('phone-1');
  });

  it('builds LOT as BRAND-OHR-YYYYMMDD', () => {
    expect(buildAveryLot({
      brand: 'SH',
      ohrmarke: 'DE12 345',
      schlachtDatum: '2026-10-17',
    })).to.equal('SH-DE12345-20261017');
  });

  it('parses Herkunft LOT / Ohrmarke into Avery header fields', () => {
    expect(parseHerkunftLotForAvery('SH-DE123456789-20261017')).to.deep.equal({
      brand: 'SH',
      ohrmarke: 'DE123456789',
      schlachtDatum: '2026-10-17',
    });
    expect(parseHerkunftLotForAvery('DE 12 345 6789').ohrmarke).to.equal('DE123456789');

    const mapped = mapHerkunftRecordToAveryHeader({
      id: 'rec-1',
      lotNumber: 'SH-DE999-20261010',
      healthMark: 'DE-NW-12345',
      organicControlBody: 'DE-ÖKO-006',
      origin: { cuttingPlantNo: 'DE-NW-999' },
    });
    expect(mapped.ohrmarke).to.equal('DE999');
    expect(mapped.schlachtDatum).to.equal('2026-10-10');
    expect(mapped.schlachthof).to.equal('DE-NW-12345');
    expect(mapped.oeko).to.equal('DE-ÖKO-006');
    expect(mapped.herkunftId).to.equal('rec-1');
  });

  it('maps Metzgerei packlist rows onto Avery catalog quantities', () => {
    expect(labelQtyFromButcheryTask({ quantity: 4, unit: 'Stück' })).to.equal(4);
    expect(labelQtyFromButcheryTask({ quantity: 1.5, unit: 'kg' })).to.equal(1);
    expect(labelQtyFromButcheryTask({ quantity: 6, unit: 'kg' })).to.equal(6);

    const mapped = mapButcheryTasksToAveryImportItems([
      { product: 'Entrecôte / Rib Eye o. K.', productId: '514', quantity: 3, unit: 'Stück' },
      { product: 'Hackfleisch', productId: '503', quantity: 2, unit: 'kg' },
      { product: 'Picanha Spezial', quantity: 1, unit: 'Stück' },
    ]);
    expect(mapped.matchedCount).to.equal(2);
    expect(mapped.customCount).to.equal(1);
    expect(mapped.totalLabels).to.equal(3 + 2 + 1);
    expect(mapped.items[0].cut?.id).to.equal('rue-514');
    expect(mapped.items[1].cut?.id).to.equal('tr-r2-hack');
    expect(mapped.items[2].cut).to.equal(null);
  });

  it('formats dates and computes ripening readiness', () => {
    expect(formatDateDe('2026-10-17')).to.equal('17.10.2026');
    expect(addDaysIso('2026-10-17', 14)).to.equal('2026-10-31');
    expect(CUSTOM_AGING_OPTIONS.map((o) => o.days)).to.deep.equal([0, 14, 21, 28]);
  });

  it('plans empty offset cells from start slot including custom cuts', () => {
    const queue = [
      { cutId: 'rue-514', qty: 2 },
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
    expect(plan.sheetCount).to.equal(2);
  });

  it('splits overflow into additional sheets (startSlot only on sheet 1)', () => {
    const queue = [{ cutId: 'tr-r2-hack', qty: 27 }];
    const multi = planAverySheets({ queue, startSlot: 1 });
    expect(multi.sheetCount).to.equal(2);
    expect(multi.totalQueued).to.equal(27);
    expect(multi.sheets[0].filledCount).to.equal(24);
    expect(multi.sheets[0].full).to.equal(true);
    expect(multi.sheets[1].startSlot).to.equal(1);
    expect(multi.sheets[1].filledCount).to.equal(3);
    expect(multi.sheets[1].full).to.equal(false);

    const partial = planAverySheets({ queue: [{ cutId: 'tr-r2-hack', qty: 10 }], startSlot: 20 });
    expect(partial.sheetCount).to.equal(2);
    expect(partial.sheets[0].emptyCount).to.equal(19);
    expect(partial.sheets[0].filledCount).to.equal(5);
    expect(partial.sheets[1].filledCount).to.equal(5);
  });

  it('uses colder storage hint for Innereien', () => {
    expect(storageHintForCut(GALLOWAY_CATALOG.innereien[0])).to.equal('≤ 3 °C');
    expect(storageHintForCut(AVERY_TRIMMINGS[0])).to.equal('0–2 °C');
  });

  it('formats R-Abschnitt titles with middle dot', () => {
    expect(formatLabelTitle('R I Spieße')).to.equal('R I · Spieße');
    expect(formatLabelTitle('R II Hack')).to.equal('R II · Hack');
    expect(formatLabelTitle('R III Wurst')).to.equal('R III · Wurst');
    expect(formatLabelTitle('Brust o. K. / Brisket')).to.equal('Brust o. K. / Brisket');
  });

  it('builds Inhalt-zuerst label HTML with optional PLU', () => {
    const cut = AVERY_TRIMMINGS.find((t) => t.id === 'tr-r1-spiesse');
    expect(storageFootLine(cut, 'DE-ÖKO-006')).to.equal('DE-ÖKO-006 · Gekühlt bei 0–2 °C lagern');
    expect(storageFootLine(GALLOWAY_CATALOG.innereien[0], 'DE-ÖKO-006'))
      .to.equal('DE-ÖKO-006 · Gekühlt bei ≤ 3 °C lagern');

    const htmlWithPlu = buildLabelHtml(cut, {
      betrieb: 'StevesHof Hofladen',
      oeko: 'DE-ÖKO-006',
      schlachthof: 'Bio-Schlachthof Stautenhof Willich',
      ohrmarke: '',
      schlachtDatum: '2026-10-18',
      zerlegeDatum: '2026-10-18',
      printBetrieb: false,
      printSchlachthof: false,
      printPlu: true,
    }, 'SH-OHR-20261018');
    expect(htmlWithPlu).to.include('label-card');
    expect(htmlWithPlu).to.include('lbl-hero');
    expect(htmlWithPlu).to.include('lbl-meta');
    expect(htmlWithPlu).to.include('lbl-foot');
    expect(htmlWithPlu).to.include('R I · Spieße');
    expect(htmlWithPlu).to.include('PLU: 535');
    expect(htmlWithPlu).to.include('Gekühlt bei 0–2 °C lagern');
    expect(htmlWithPlu).to.not.include('ART.');
    expect(htmlWithPlu).to.not.include('lbl-header');
    expect(htmlWithPlu).to.not.match(/OHR\s/);
    expect(htmlWithPlu).to.not.include('StevesHof Hofladen');

    const htmlNoPlu = buildLabelHtml(cut, {
      betrieb: 'StevesHof Hofladen',
      oeko: 'DE-ÖKO-006',
      ohrmarke: 'DE123',
      schlachtDatum: '2026-10-18',
      zerlegeDatum: '2026-10-18',
      printBetrieb: false,
      printSchlachthof: false,
      printPlu: false,
    }, 'SH-DE123-20261018');
    expect(htmlNoPlu).to.not.include('PLU:');
    expect(htmlNoPlu).to.include('OHR DE123');

    const longCut = GALLOWAY_CATALOG.schultern.find((c) => c.id === 'sch-510');
    const longHtml = buildLabelHtml(longCut, {
      betrieb: 'StevesHof Galloway',
      oeko: 'DE-ÖKO-006',
      ohrmarke: 'DE123',
      schlachtDatum: '2026-10-18',
      zerlegeDatum: '2026-10-18',
      printBetrieb: true,
      printSchlachthof: false,
      printPlu: true,
    }, 'SH-DE123-20261018');
    expect(longHtml).to.include('Falsches Filet');
    expect(longHtml).to.include('PLU: 510');
    expect(longHtml).to.include('lbl-farm');
    expect(longHtml).to.include('StevesHof Galloway');
    expect(longHtml).to.include('OHR DE123');
  });
});
