/**
 * Unit-Tests: Duplicate-Scan-Fenster & MHD-Schnelleingabe (Wareneingang Speed).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseReceivingQuickMhdInput,
  RECEIVING_DUPLICATE_SCAN_MS,
  SCANNER_MHD_QUICK_DAYS,
  shouldMergeDuplicateReceivingScan,
} from '../web/receiving.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mhdSrc = readFileSync(path.join(root, 'web/mhd.js'), 'utf8');
const indexSrc = readFileSync(path.join(root, 'web/index.html'), 'utf8');

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

  it('exposes scanner MHD quick-day presets', () => {
    assert.deepEqual(SCANNER_MHD_QUICK_DAYS, [7, 14, 30]);
  });

  it('keeps quick-adjust open until explicit Fertig confirm', () => {
    assert.equal(mhdSrc.includes('SCANNER_QUICK_ADJUST_IDLE_MS'), false);
    assert.equal(mhdSrc.includes('resetScannerQuickAdjustIdleTimer'), false);
    assert.ok(mhdSrc.includes('confirmScannerQuickAdjust'));
    assert.ok(mhdSrc.includes('Bitte zuerst „Fertig“ tippen'));
    assert.ok(indexSrc.includes('Fertig – weiter scannen'));
  });
});
