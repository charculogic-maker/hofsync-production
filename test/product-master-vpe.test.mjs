/**
 * Unit tests for default_vpe / Gebindegröße helpers (product-master).
 */
import { describe, it } from 'mocha';
import { expect } from 'chai';
import {
  normalizeDefaultVpe,
  shouldLearnDefaultVpe,
  resolvePrefillQty,
  hasHabitualVpe,
  formatHabitualVpeBadge,
  buildProductMasterDoc,
  DEFAULT_VPE_FALLBACK,
} from '../web/product-master.js';

describe('product-master default_vpe', () => {
  it('normalizes invalid values to fallback 1', () => {
    expect(normalizeDefaultVpe(undefined)).to.equal(DEFAULT_VPE_FALLBACK);
    expect(normalizeDefaultVpe(null)).to.equal(1);
    expect(normalizeDefaultVpe(0)).to.equal(1);
    expect(normalizeDefaultVpe(-3)).to.equal(1);
    expect(normalizeDefaultVpe('abc')).to.equal(1);
  });

  it('rounds and caps positive piece counts', () => {
    expect(normalizeDefaultVpe(6)).to.equal(6);
    expect(normalizeDefaultVpe(6.4)).to.equal(6);
    expect(normalizeDefaultVpe(6.6)).to.equal(7);
    expect(normalizeDefaultVpe('12')).to.equal(12);
    expect(normalizeDefaultVpe(100000)).to.equal(9999);
  });

  it('learns only confirmed piece bookings, not storno/diff/sold-out/kg', () => {
    expect(shouldLearnDefaultVpe({ qty: 6, qtyUnit: 'Stk' })).to.equal(true);
    expect(shouldLearnDefaultVpe({ qty: 6, qtyUnit: 'kg' })).to.equal(false);
    expect(shouldLearnDefaultVpe({ qty: 6, soldOut: true })).to.equal(false);
    expect(shouldLearnDefaultVpe({ qty: 6, actionType: 'storno' })).to.equal(false);
    expect(shouldLearnDefaultVpe({ qty: 6, actionType: 'differenz' })).to.equal(false);
    expect(shouldLearnDefaultVpe({ qty: 6, actionType: 'raus' })).to.equal(false);
    expect(shouldLearnDefaultVpe({ qty: 6, isDiff: true })).to.equal(false);
    expect(shouldLearnDefaultVpe({ qty: 0, qtyUnit: 'Stk' })).to.equal(false);
  });

  it('prefills from packageSize for VPE barcodes, else default_vpe, else 1', () => {
    expect(resolvePrefillQty(null)).to.equal(1);
    expect(resolvePrefillQty({ isVpe: true, packageSize: 6 })).to.equal(6);
    expect(resolvePrefillQty({ default_vpe: 8 })).to.equal(8);
    expect(resolvePrefillQty({ name: 'Joghurt' })).to.equal(1);
    expect(resolvePrefillQty({ isVpe: true, packageSize: 12, default_vpe: 4 })).to.equal(12);
  });

  it('shows habit badge only when VPE comes from history', () => {
    expect(hasHabitualVpe(null)).to.equal(false);
    expect(hasHabitualVpe({ name: 'Joghurt' })).to.equal(false);
    expect(hasHabitualVpe({ default_vpe: 6, _hasStoredVpe: true })).to.equal(true);
    expect(hasHabitualVpe({ _hasStoredVpe: false })).to.equal(false);
    expect(hasHabitualVpe({ isVpe: true, packageSize: 6 })).to.equal(true);
    expect(formatHabitualVpeBadge(6)).to.equal('Gewohnte VPE: 6');
  });

  it('includes default_vpe in Firestore docs when provided', () => {
    const withVpe = buildProductMasterDoc('StevesHof_Hauptbetrieb', {
      ean: '4035626114509',
      name: 'b*Joghurt mild',
      default_vpe: 6,
    }, 'Paddy');
    expect(withVpe.default_vpe).to.equal(6);
    expect(withVpe.ean).to.equal('4035626114509');
    expect(withVpe.tenantId).to.equal('StevesHof_Hauptbetrieb');

    const withoutVpe = buildProductMasterDoc('StevesHof_Hauptbetrieb', {
      ean: '4035626114509',
      name: 'b*Joghurt mild',
    }, 'Paddy');
    expect(withoutVpe).to.not.have.property('default_vpe');
  });
});
