import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  absurdPastAmpelLabel,
  assessMhdDatePlausibility,
  resttageFromIsoDate,
  suggestDayMonthSwap,
} from '../web/mhd-date-guard.js';

const TODAY = new Date('2026-10-30T12:00:00');

describe('mhd-date-guard', () => {
  it('erkennt extremes Vergangenheit-Jahr (02 statt 26)', () => {
    const assessment = assessMhdDatePlausibility('2002-12-09', {
      today: TODAY,
      kategorie: '🥛MoPro',
    });
    assert.equal(assessment.severity, 'block');
    assert.equal(assessment.code, 'past_extreme');
    assert.ok(Math.abs(assessment.resttage) > 8000);
  });

  it('blockiert weit abgelaufenes MoPro-MHD (März bei Oktober-Heute)', () => {
    const assessment = assessMhdDatePlausibility('2026-03-11', {
      today: TODAY,
      kategorie: '🥛MoPro',
    });
    assert.equal(assessment.severity, 'block');
    assert.equal(assessment.code, 'past_extreme');
    assert.equal(assessment.resttage, -233);
    assert.equal(assessment.altIso, '2026-11-03');
  });

  it('warnt bei leicht abgelaufenem MHD', () => {
    const assessment = assessMhdDatePlausibility('2026-10-27', {
      today: TODAY,
      kategorie: '🥩Aufschnitt',
    });
    assert.equal(assessment.severity, 'warn');
    assert.equal(assessment.code, 'past_soft');
    assert.equal(assessment.resttage, -3);
  });

  it('schlägt Tag/Monat-Vertauschung vor', () => {
    const swap = suggestDayMonthSwap('2026-03-11', TODAY);
    assert.ok(swap);
    assert.equal(swap.altIso, '2026-11-03');
    assert.equal(swap.altResttage, 4);
  });

  it('lässt normale Frische durch', () => {
    const assessment = assessMhdDatePlausibility('2026-11-04', {
      today: TODAY,
      kategorie: '🥛MoPro',
    });
    assert.equal(assessment.severity, 'ok');
    assert.equal(assessment.resttage, 5);
  });

  it('kennzeichnet absurde Ampel-Labels', () => {
    assert.equal(absurdPastAmpelLabel(-8726), '⚠️ DATUM PRÜFEN');
    assert.equal(absurdPastAmpelLabel(-3), null);
    assert.equal(resttageFromIsoDate('2002-12-09', TODAY), -8726);
  });
});
