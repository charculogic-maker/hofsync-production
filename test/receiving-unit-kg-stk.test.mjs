/**
 * Unit-Tests: Wareneingang STK/KG-Umschaltung & Dezimal-Gewicht.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildReceivingItemCardHtml,
  buildReceivingQuantityFields,
  formatReceivingQuantityLabel,
  isReceivingWeightEan,
  normalizeReceivingUnit,
  parseReceivingWeightKg,
  resolveDefaultReceivingUnit,
  RECEIVING_UNIT_KG,
  RECEIVING_UNIT_STK,
} from '../web/receiving.js';
import { isInhouseWeightEan } from '../web/scanner.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexSrc = readFileSync(path.join(root, 'web/index.html'), 'utf8');
const mhdSrc = readFileSync(path.join(root, 'web/mhd.js'), 'utf8');
const swSrc = readFileSync(path.join(root, 'web/sw.js'), 'utf8');

describe('Wareneingang STK/KG unit helpers', () => {
  it('normalizes legacy and display units to stk|kg', () => {
    assert.equal(normalizeReceivingUnit('Stk'), RECEIVING_UNIT_STK);
    assert.equal(normalizeReceivingUnit('STK'), RECEIVING_UNIT_STK);
    assert.equal(normalizeReceivingUnit('kg'), RECEIVING_UNIT_KG);
    assert.equal(normalizeReceivingUnit('Kilogramm'), RECEIVING_UNIT_KG);
    assert.equal(normalizeReceivingUnit('Gewicht'), RECEIVING_UNIT_KG);
  });

  it('detects inhouse weight EANs (21/28 and 20–29)', () => {
    assert.equal(isReceivingWeightEan('2812345678901'), true);
    assert.equal(isReceivingWeightEan('2112345678901'), true);
    assert.equal(isReceivingWeightEan('2012345678901'), true);
    assert.equal(isReceivingWeightEan('4001234567890'), false);
    assert.equal(isInhouseWeightEan('2898765432101'), true);
    assert.equal(isInhouseWeightEan('4035626114608'), false);
  });

  it('defaults to kg for master unit or weight EAN, otherwise stk', () => {
    assert.equal(resolveDefaultReceivingUnit({ unit: 'kg' }), RECEIVING_UNIT_KG);
    assert.equal(resolveDefaultReceivingUnit({ barcode: '2812345678901' }), RECEIVING_UNIT_KG);
    assert.equal(resolveDefaultReceivingUnit({
      product: { unit: 'kg', barcode: '4001234567890' },
    }), RECEIVING_UNIT_KG);
    assert.equal(resolveDefaultReceivingUnit({ barcode: '4001234567890' }), RECEIVING_UNIT_STK);
  });

  it('parses comma/dot weights and rounds to 3 decimals', () => {
    assert.equal(parseReceivingWeightKg('1,886'), 1.886);
    assert.equal(parseReceivingWeightKg('1.924'), 1.924);
    assert.equal(parseReceivingWeightKg('2,5'), 2.5);
    assert.equal(parseReceivingWeightKg('1,8864'), 1.886);
    assert.equal(Number.isNaN(parseReceivingWeightKg('')), true);
    assert.equal(Number.isNaN(parseReceivingWeightKg('abc')), true);
    assert.equal(Number.isNaN(parseReceivingWeightKg('0')), true);
  });

  it('builds quantity/unit fields with legacy mirrors', () => {
    const stk = buildReceivingQuantityFields(10, 'stk');
    assert.deepEqual(stk, {
      quantity: 10,
      unit: 'stk',
      qtyValue: 10,
      qtyUnit: 'Stk',
      qtyKg: 10,
    });
    const kg = buildReceivingQuantityFields(1.886, 'kg');
    assert.equal(kg.quantity, 1.886);
    assert.equal(kg.unit, 'kg');
    assert.equal(kg.qtyUnit, 'kg');
  });

  it('formats labels in German shop wording', () => {
    assert.equal(formatReceivingQuantityLabel(10, 'stk'), '10 STK');
    assert.equal(formatReceivingQuantityLabel(1.886, 'kg'), '1,886 kg');
  });

  it('renders LIFO cards with STK stepper/VPE or KG weight edit', () => {
    const stkHtml = buildReceivingItemCardHtml({
      id: 'i-stk',
      product: 'SB-Cheddar',
      quantity: 10,
      unit: 'stk',
      mhdDate: '',
    });
    assert.ok(stkHtml.includes('data-item-unit="stk"'));
    assert.ok(stkHtml.includes('data-item-qty-delta="3"'));
    assert.ok(stkHtml.includes('STK'));
    assert.equal(stkHtml.includes('we-item-qty-block--kg'), false);

    const kgHtml = buildReceivingItemCardHtml({
      id: 'i-kg',
      product: 'Comté',
      quantity: 1.886,
      unit: 'kg',
      mhdDate: '',
    });
    assert.ok(kgHtml.includes('data-item-unit="kg"'));
    assert.ok(kgHtml.includes('1,886'));
    assert.ok(kgHtml.includes('input-weight-kg'));
    assert.ok(kgHtml.includes('data-item-weight-edit="i-kg"'));
    assert.equal(kgHtml.includes('data-item-qty-delta="3"'), false);
  });

  it('ships scanner STK/KG toggle and weight input markup', () => {
    assert.ok(indexSrc.includes('data-scanner-qa="unit-stk"'));
    assert.ok(indexSrc.includes('data-scanner-qa="unit-kg"'));
    assert.ok(indexSrc.includes('id="scanner-qa-weight-input"'));
    assert.ok(indexSrc.includes('class="input-weight-kg scanner-qa-weight-input"'));
    assert.ok(indexSrc.includes('inputmode="decimal"'));
    assert.ok(indexSrc.includes('pattern="[0-9]*[.,]?[0-9]*"'));
    assert.ok(mhdSrc.includes('switchScannerQuickAdjustUnit'));
    assert.ok(mhdSrc.includes('applyScannerQuickAdjustWeightInput'));
    assert.ok(mhdSrc.includes('weightInput.select'));
  });

  it('bumps service-worker cache for unit-kg-stk release', () => {
    assert.match(swSrc, /const CACHE_NAME = 'charculogic-v20261017-unit-kg-stk-v1'/);
  });
});
