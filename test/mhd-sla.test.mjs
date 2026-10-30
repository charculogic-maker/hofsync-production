/**
 * MHD-Tageslauf-SLA: kritische offene Posten (Frontend-Logik).
 */
import { expect } from 'chai';
import {
  MHD_SLA_DEFAULT_CRITICAL_MAX_RESTTAGE,
  MHD_SLA_MIN_RESTTAGE_FOR_CRITICAL,
  computeMhdSlaResttage,
  countMhdSlaCriticalOpen,
  formatMhdSlaBannerText,
  isMhdSlaActiveItem,
  isMhdSlaCriticalOpen,
  normalizeMhdSlaIsoDate,
} from '../web/mhd-sla.js';

describe('MHD-SLA Zähllogik', () => {
  const today = '2026-10-28';

  it('normalisiert ISO- und DE-Daten', () => {
    expect(normalizeMhdSlaIsoDate('2026-10-28')).to.equal('2026-10-28');
    expect(normalizeMhdSlaIsoDate('28.10.2026')).to.equal('2026-10-28');
    expect(normalizeMhdSlaIsoDate('')).to.equal('');
  });

  it('berechnet Resttage kalendarisch', () => {
    expect(computeMhdSlaResttage('2026-10-28', today)).to.equal(0);
    expect(computeMhdSlaResttage('2026-10-27', today)).to.equal(-1);
    expect(computeMhdSlaResttage('2026-10-29', today)).to.equal(1);
    expect(computeMhdSlaResttage('2026-10-30', today)).to.equal(2);
  });

  it('erkenne aktive vs. inaktive Posten', () => {
    expect(isMhdSlaActiveItem({ menge: 2, status: 'aktiv' })).to.equal(true);
    expect(isMhdSlaActiveItem({ qty: 0, status: 'aktiv' })).to.equal(false);
    expect(isMhdSlaActiveItem({ menge: 3, status: 'raus' })).to.equal(false);
    expect(isMhdSlaActiveItem({ menge: 3, archived: true })).to.equal(false);
  });

  it('zählt nur kritische ungeprüfte Posten (Resttage ≤ 1)', () => {
    const items = [
      { id: 'a', menge: 2, mhdDate: '2026-10-27', status: 'aktiv' }, // -1 kritisch
      { id: 'b', menge: 1, mhdDate: '2026-10-28', status: 'aktiv' }, // 0 kritisch
      { id: 'c', menge: 4, mhdDate: '2026-10-29', status: 'aktiv' }, // 1 kritisch
      { id: 'd', menge: 4, mhdDate: '2026-10-30', status: 'aktiv' }, // 2 nicht
      { id: 'e', menge: 2, mhdDate: '2026-10-28', status: 'aktiv', lastCheckedDate: today }, // geprüft
      { id: 'f', menge: 0, mhdDate: '2026-10-28', status: 'aktiv' }, // Nullmenge
      { id: 'g', menge: 1, mhdDate: '2026-10-28', status: 'raus' }, // inaktiv
    ];
    expect(countMhdSlaCriticalOpen(items, { todayIso: today })).to.equal(3);
    expect(MHD_SLA_DEFAULT_CRITICAL_MAX_RESTTAGE).to.equal(1);
  });

  it('respektiert criticalMaxResttage', () => {
    const item = { menge: 1, mhdDate: '2026-10-30', status: 'aktiv' };
    expect(isMhdSlaCriticalOpen(item, { todayIso: today, criticalMaxResttage: 1 })).to.equal(false);
    expect(isMhdSlaCriticalOpen(item, { todayIso: today, criticalMaxResttage: 2 })).to.equal(true);
  });

  it('schließt absurde MHD-Tippfehler aus dem Tageslauf aus', () => {
    expect(MHD_SLA_MIN_RESTTAGE_FOR_CRITICAL).to.equal(-90);
    // −30 Tage: noch im Tageslauf-Fenster
    const overdue = { menge: 1, mhdDate: '2026-09-28', status: 'aktiv' };
    expect(isMhdSlaCriticalOpen(overdue, { todayIso: today })).to.equal(true);
    // −233 / Jahr 2002: Datenfehler, nicht „heute prüfen“
    const farPast = { menge: 1, mhdDate: '2026-03-09', status: 'aktiv' };
    const typoYear = { menge: 1, mhdDate: '2002-10-28', status: 'aktiv' };
    expect(isMhdSlaCriticalOpen(farPast, { todayIso: today })).to.equal(false);
    expect(isMhdSlaCriticalOpen(typoYear, { todayIso: today })).to.equal(false);
    expect(countMhdSlaCriticalOpen([overdue, farPast, typoYear], { todayIso: today })).to.equal(1);
  });

  it('formatiert Banner-Text', () => {
    expect(formatMhdSlaBannerText(0)).to.equal('');
    expect(formatMhdSlaBannerText(1)).to.include('1 kritisches MHD');
    expect(formatMhdSlaBannerText(4)).to.include('4 kritische MHDs');
    expect(formatMhdSlaBannerText(40)).to.include('40 kritische MHDs');
  });
});
