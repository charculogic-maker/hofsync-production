/**
 * MHD-Monitor: allgemeine 7-Tage-Ansicht inkl. Sortierung MoPro → Kühlware → Trockenware.
 */
import { expect } from 'chai';
import {
  getMhdMonitorHorizonDays,
  getMhdStammdatenBucket,
  matchesMhdMonitorGroupFilter,
  matchesMhdMonitorHorizonDays,
  resolveMhdCategoryFilter,
  sortMhdProductsForMonitor,
} from '../web/mhd-monitor-filter.js';

describe('MHD-Monitor Filter „Alle (7 Tage)“', () => {
  it('setzt unbekannte Filter auf alle zurück', () => {
    expect(resolveMhdCategoryFilter('alle')).to.equal('alle');
    expect(resolveMhdCategoryFilter('mopro')).to.equal('mopro');
    expect(resolveMhdCategoryFilter('kuehlware')).to.equal('kuehlware');
    expect(resolveMhdCategoryFilter('trockenware')).to.equal('trockenware');
    expect(resolveMhdCategoryFilter('')).to.equal('alle');
    expect(resolveMhdCategoryFilter('kaese')).to.equal('alle');
  });

  it('nutzt in der allgemeinen Ansicht 7 Tage für alle Warengruppen', () => {
    expect(getMhdMonitorHorizonDays('alle', 'mopro')).to.equal(7);
    expect(getMhdMonitorHorizonDays('alle', 'kuehlware')).to.equal(7);
    expect(getMhdMonitorHorizonDays('alle', 'trockenware')).to.equal(7);
    expect(matchesMhdMonitorHorizonDays(7, 'alle', 'trockenware')).to.equal(true);
    expect(matchesMhdMonitorHorizonDays(8, 'alle', 'trockenware')).to.equal(false);
    expect(matchesMhdMonitorHorizonDays(5, 'alle', 'mopro')).to.equal(true);
  });

  it('behält fokussierte Horizonte für MoPro, Kühlware und Trockenware', () => {
    expect(getMhdMonitorHorizonDays('mopro', 'mopro')).to.equal(2);
    expect(matchesMhdMonitorHorizonDays(3, 'mopro', 'mopro')).to.equal(false);
    expect(getMhdMonitorHorizonDays('kuehlware', 'kuehlware')).to.equal(2);
    expect(matchesMhdMonitorHorizonDays(3, 'kuehlware', 'kuehlware')).to.equal(false);
    expect(getMhdMonitorHorizonDays('trockenware', 'trockenware')).to.equal(30);
    expect(matchesMhdMonitorHorizonDays(30, 'trockenware', 'trockenware')).to.equal(true);
    expect(matchesMhdMonitorHorizonDays(31, 'trockenware', 'trockenware')).to.equal(false);
  });

  it('zeigt in „alle“ alle Gruppen, sonst nur die gewählte', () => {
    expect(matchesMhdMonitorGroupFilter('mopro', 'alle')).to.equal(true);
    expect(matchesMhdMonitorGroupFilter('kuehlware', 'alle')).to.equal(true);
    expect(matchesMhdMonitorGroupFilter('trockenware', 'alle')).to.equal(true);
    expect(matchesMhdMonitorGroupFilter('kuehlware', 'mopro')).to.equal(false);
    expect(matchesMhdMonitorGroupFilter('mopro', 'kuehlware')).to.equal(false);
    expect(matchesMhdMonitorGroupFilter('trockenware', 'mopro')).to.equal(false);
    expect(matchesMhdMonitorGroupFilter('mopro', 'trockenware')).to.equal(false);
  });

  it('mappt Kühlware in den Stammdaten-Eimer gekühlt', () => {
    expect(getMhdStammdatenBucket('mopro')).to.equal('mopro');
    expect(getMhdStammdatenBucket('kuehlware')).to.equal('mopro');
    expect(getMhdStammdatenBucket('trockenware')).to.equal('trockenware');
  });

  it('sortiert in „alle“ zuerst MoPro, dann Kühlware, dann Trockenware, danach Resttage', () => {
    const products = [
      { id: 't-spaet', group: 'trockenware', tage: 6 },
      { id: 'k-spaet', group: 'kuehlware', tage: 3 },
      { id: 'm-spaet', group: 'mopro', tage: 3 },
      { id: 't-frueh', group: 'trockenware', tage: 1 },
      { id: 'k-frueh', group: 'kuehlware', tage: 0 },
      { id: 'm-frueh', group: 'mopro', tage: 0 },
    ];
    const sorted = sortMhdProductsForMonitor(products, {
      categoryFilter: 'alle',
      getResttage: (p) => p.tage,
      getMonitorGroup: (p) => p.group,
    });
    expect(sorted.map((p) => p.id)).to.deep.equal([
      'm-frueh',
      'm-spaet',
      'k-frueh',
      'k-spaet',
      't-frueh',
      't-spaet',
    ]);
  });

  it('sortiert in fokussierten Filtern nur nach Resttagen', () => {
    const products = [
      { id: 'b', group: 'trockenware', tage: 5 },
      { id: 'a', group: 'mopro', tage: 1 },
    ];
    const sorted = sortMhdProductsForMonitor(products, {
      categoryFilter: 'trockenware',
      getResttage: (p) => p.tage,
      getMonitorGroup: (p) => p.group,
    });
    expect(sorted.map((p) => p.id)).to.deep.equal(['a', 'b']);
  });
});
