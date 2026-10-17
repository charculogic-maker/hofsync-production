/**
 * Unit-Tests: Duplicate-Scan-Fenster & leeres MHD am Scanner (Wareneingang).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildReceivingItemCardHtml,
  hasReceivingItemMhd,
  parseReceivingQuickMhdInput,
  RECEIVING_DUPLICATE_SCAN_MS,
  RECEIVING_SCAN_MHD_EMPTY,
  RECEIVING_VPE_QTY_DELTAS,
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

  it('keeps scan MHD empty and marks missing on cards', () => {
    assert.equal(RECEIVING_SCAN_MHD_EMPTY, '');
    assert.equal(hasReceivingItemMhd({ mhdDate: '' }), false);
    assert.equal(hasReceivingItemMhd({ mhdDate: null }), false);
    assert.equal(hasReceivingItemMhd({ mhdDate: '2026-11-01' }), true);
    const html = buildReceivingItemCardHtml({
      id: 'i1',
      product: 'Joghurt',
      qtyValue: 1,
      qtyUnit: 'Stk',
      mhdDate: '',
    });
    assert.ok(html.includes('we-item-mhd-date--missing'));
    assert.ok(html.includes('fehlt – antippen'));
    assert.equal(html.includes('data-item-mhd-add'), false);
  });

  it('requires empty MHD input without quick-day chips on scanner', () => {
    assert.ok(mhdSrc.includes('RECEIVING_SCAN_MHD_EMPTY'));
    assert.ok(mhdSrc.includes('manual-packaging'));
    assert.equal(mhdSrc.includes('suggestReceivingMhd(productName'), false);
    assert.equal(indexSrc.includes('data-scanner-qa="mhd-add"'), false);
    assert.ok(indexSrc.includes('scanner-qa-mhd-input'));
    assert.ok(indexSrc.includes('MHD von der Verpackung'));
    assert.ok(indexSrc.includes('Fertig – weiter scannen'));
    assert.equal(mhdSrc.includes('SCANNER_QUICK_ADJUST_IDLE_MS'), false);
    assert.ok(mhdSrc.includes('confirmScannerQuickAdjust'));
  });

  it('exposes VPE quick deltas +3/+5/+9 for 4/6/10 packs', () => {
    assert.deepEqual([...RECEIVING_VPE_QTY_DELTAS], [3, 5, 9]);
    assert.ok(indexSrc.includes('data-scanner-qa="qty-plus3"'));
    assert.ok(indexSrc.includes('data-scanner-qa="qty-plus5"'));
    assert.ok(indexSrc.includes('data-scanner-qa="qty-plus9"'));
    assert.equal(indexSrc.includes('qty-plus10'), false);
    assert.ok(mhdSrc.includes("action === 'qty-plus3'"));
    assert.ok(mhdSrc.includes("action === 'qty-plus9'"));
    assert.equal(mhdSrc.includes('qty-plus10'), false);
    const html = buildReceivingItemCardHtml({
      id: 'i2',
      product: 'Kiste',
      qtyValue: 1,
      qtyUnit: 'Stk',
      mhdDate: '',
    });
    assert.ok(html.includes('data-item-qty-delta="3"'));
    assert.ok(html.includes('data-item-qty-delta="5"'));
    assert.ok(html.includes('data-item-qty-delta="9"'));
  });

  it('exposes STK/KG unit toggle on scanner quick-adjust', () => {
    assert.ok(indexSrc.includes('data-scanner-qa="unit-stk"'));
    assert.ok(indexSrc.includes('data-scanner-qa="unit-kg"'));
    assert.ok(indexSrc.includes('scanner-qa-weight-input'));
    assert.ok(mhdSrc.includes('switchScannerQuickAdjustUnit'));
  });
});
