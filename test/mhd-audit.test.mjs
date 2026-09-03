/**
 * Unit tests for Warenbewegungs-Report helpers (Protokoll / CSV).
 */
import { describe, it } from 'mocha';
import { expect } from 'chai';
import {
  berlinAddDaysIso,
  berlinDayEndMs,
  berlinDayStartMs,
  berlinTodayIso,
  buildShopNameOptions,
  csvFilename,
  defaultReportFromIso,
  filterMovements,
  formatBerlinDay,
  formatMovementTime,
  formatQtyDelta,
  inferMovementAction,
  mergeMovementRows,
  movementFromAuditDoc,
  movementFromMhdListeDoc,
  movementsToCsv,
  normalizeActorName,
  timestampToMs,
} from '../web/mhd-audit.js';

describe('mhd-audit report helpers', () => {
  it('maps Berlin midnight for 2026-09-03 (CEST)', () => {
    const start = berlinDayStartMs('2026-09-03');
    const end = berlinDayEndMs('2026-09-03');
    expect(start).to.equal(Date.parse('2026-09-02T22:00:00.000Z'));
    expect(end).to.equal(start + 24 * 60 * 60 * 1000 - 1);
    expect(formatBerlinDay('2026-09-03')).to.equal('03.09.2026');
  });

  it('formats timestamps and quantity deltas for the report table', () => {
    const atMs = Date.parse('2026-09-03T09:15:00.000Z');
    expect(formatMovementTime(atMs)).to.equal('03.09.2026, 11:15 Uhr');
    expect(formatQtyDelta(12, 8)).to.equal('12 → 8 (-4)');
    expect(formatQtyDelta(0, 6)).to.equal('0 → 6 (+6)');
  });

  it('infers action types from MHD status and quantity changes', () => {
    expect(inferMovementAction({ isCreate: true })).to.equal('neu');
    expect(inferMovementAction({ qtyFrom: 12, qtyTo: 8 })).to.equal('menge');
    expect(inferMovementAction({ mhdActionStatus: 'tonne', qtyFrom: 4, qtyTo: 0 })).to.equal('abschreiben');
    expect(inferMovementAction({ soldOut: true, qtyFrom: 3, qtyTo: 0 })).to.equal('raus');
    expect(inferMovementAction({ mhdActionStatus: 'geprueft' })).to.equal('ok');
  });

  it('normalizes actor names and keeps StevesHof shop options first', () => {
    expect(normalizeActorName('stephie@steveshof-hofladen.de')).to.equal('Stephie');
    expect(buildShopNameOptions(['Finn'])).to.deep.equal([
      'Paddy', 'Stephie', 'Bettina', 'Nicole', 'Heiko', 'Finn',
    ]);
  });

  it('filters movements by actor and action type', () => {
    const rows = [
      { actorName: 'Stephie', actionType: 'menge' },
      { actorName: 'Paddy', actionType: 'neu' },
      { actorName: 'Bettina', actionType: 'raus' },
    ];
    expect(filterMovements(rows, { actorName: 'Stephie' })).to.have.length(1);
    expect(filterMovements(rows, { actionType: 'raus' })[0].actorName).to.equal('Bettina');
    expect(filterMovements(rows, {})).to.have.length(3);
  });

  it('builds Excel-friendly UTF-8 CSV with BOM and semicolons', () => {
    const atMs = Date.parse('2026-09-03T09:15:00.000Z');
    const csv = movementsToCsv([{
      atMs,
      actorName: 'Stephie',
      articleName: 'Rapunzel Schokolade; Karamell',
      ean: '4006040000000',
      actionType: 'menge',
      qtyFrom: 12,
      qtyTo: 8,
    }]);
    expect(csv.startsWith('\uFEFF')).to.equal(true);
    expect(csv).to.include('Zeitstempel;Mitarbeiter;Artikel;EAN;Aktion;Menge von;Menge nach;Delta');
    expect(csv).to.include('"Rapunzel Schokolade; Karamell"');
    expect(csv).to.include('MENGE GEÄNDERT');
    expect(csv).to.include(';-4');
    expect(csvFilename('2026-09-03')).to.equal('HofSync_Warenbericht_2026-09-03.csv');
  });

  it('defaults the report window to vorgestern', () => {
    const today = berlinTodayIso();
    expect(defaultReportFromIso()).to.equal(berlinAddDaysIso(today, -2));
    expect(berlinAddDaysIso('2026-09-03', -2)).to.equal('2026-09-01');
  });

  it('parses German and ISO day stamps', () => {
    expect(timestampToMs('2026-09-01')).to.equal(berlinDayStartMs('2026-09-01'));
    expect(timestampToMs('01.09.2026')).to.equal(berlinDayStartMs('2026-09-01'));
  });

  it('maps audit docs and keeps distinct MHD-list rows without EAN', () => {
    const atMs = Date.parse('2026-09-03T09:15:00.000Z');
    const audit = movementFromAuditDoc('a1', {
      atMs,
      actorName: 'Stephie',
      articleName: 'Rapunzel Schokolade Karamell',
      ean: '4006040000000',
      actionType: 'menge',
      qtyFrom: 12,
      qtyTo: 8,
    });
    const listeSame = movementFromMhdListeDoc('m1', {
      lastMhdCheckAt: atMs,
      scannedBy: 'Stephie',
      name: 'Rapunzel Schokolade Karamell',
      ean: '4006040000000',
      qty: 8,
      mhdActionStatus: '',
    });
    const listeOther = movementFromMhdListeDoc('m2', {
      lastCheckedDate: '2026-09-01',
      lastCheckedBy: 'Paddy',
      name: 'Hofmilch 1l',
      qty: 3,
      mhdActionStatus: 'geprueft',
    });
    const merged = mergeMovementRows([[audit], [listeSame, listeOther]]);
    expect(audit.actionType).to.equal('menge');
    expect(listeSame.source).to.equal('mhd_liste');
    expect(merged).to.have.length(2);
    expect(merged.some((row) => row.articleName === 'Hofmilch 1l')).to.equal(true);
    expect(merged.filter((row) => row.articleName.includes('Rapunzel'))).to.have.length(1);
  });
});
