/**
 * Unit-Tests: Duplicate-Scan-Fenster & MHD-Schnelleingabe (Wareneingang Speed).
 */
import assert from 'node:assert/strict';
import {
  parseReceivingQuickMhdInput,
  RECEIVING_DUPLICATE_SCAN_MS,
  SCANNER_MHD_QUICK_DAYS,
  SCANNER_QUICK_ADJUST_IDLE_MS,
  shouldMergeDuplicateReceivingScan,
} from '../web/receiving.js';

describe('Wareneingang scan quick-adjust helpers', () => {
  it('merges same barcode within 3 seconds', () => {
    const last = { barcode: '400123', itemId: 'item-1', at: 1_000 };
    assert.equal(shouldMergeDuplicateReceivingScan(last, '400123', 1_000 + 2_999), true);
    assert.equal(shouldMergeDuplicateReceivingScan(last, '400123', 1_000 + 3_001), false);
    assert.equal(RECEIVING_DUPLICATE_SCAN_MS, 3000);
  });

  it('rejects different barcode or missing item', () => {
    assert.equal(
      shouldMergeDuplicateReceivingScan({ barcode: '1', itemId: 'a', at: 10 }, '2', 20),
      false,
    );
    assert.equal(shouldMergeDuplicateReceivingScan({ barcode: '1', at: 10 }, '1', 20), false);
    assert.equal(shouldMergeDuplicateReceivingScan(null, '1', 20), false);
  });

  it('parses TT.MM and TT.MM.JJJJ for scanner MHD', () => {
    assert.equal(parseReceivingQuickMhdInput('20.10', '2026-10-16'), '2026-10-20');
    assert.equal(parseReceivingQuickMhdInput('01.01', '2026-10-16'), '2027-01-01');
    assert.equal(parseReceivingQuickMhdInput('20.10.2027'), '2027-10-20');
    assert.equal(parseReceivingQuickMhdInput(''), '');
  });

  it('exposes scanner quick-day presets and idle window', () => {
    assert.deepEqual(SCANNER_MHD_QUICK_DAYS, [7, 14, 30]);
    assert.equal(SCANNER_QUICK_ADJUST_IDLE_MS, 2000);
  });
});
