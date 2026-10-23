/**
 * Unit-Tests: GS1-128 Umverpackung → EAN + MHD + Charge
 * Beispiel-Label: Trafo corn peanuts (01)08718754506861(15)270407(10)L262501111
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cleanScannedBarcode,
  gs1DateToIso,
  normalizeGtinToEan,
  normalizeScanCode,
  parseBarcodeScan,
} from '../web/barcode-normalize.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAMPLE_PAREN = '(01)08718754506861(15)270407(10)L262501111';
const SAMPLE_CONCAT = '01087187545068611527040710L262501111';
const EXPECTED_EAN = '8718754506861';
const EXPECTED_GTIN = '08718754506861';
const EXPECTED_MHD = '2027-04-07';
const EXPECTED_LOT = 'L262501111';

describe('barcode-normalize GS1-128 Umverpackung', () => {
  it('parses parenthesized human-readable GS1 from carton label', () => {
    const parsed = parseBarcodeScan(SAMPLE_PAREN);
    assert.equal(parsed.isGs1, true);
    assert.equal(parsed.ean, EXPECTED_EAN);
    assert.equal(parsed.gtin, EXPECTED_GTIN);
    assert.equal(parsed.bestBeforeIso, EXPECTED_MHD);
    assert.equal(parsed.lot, EXPECTED_LOT);
  });

  it('parses concatenated camera/decoder GS1 payload', () => {
    const parsed = parseBarcodeScan(SAMPLE_CONCAT);
    assert.equal(parsed.ean, EXPECTED_EAN);
    assert.equal(parsed.bestBeforeIso, EXPECTED_MHD);
    assert.equal(parsed.lot, EXPECTED_LOT);
  });

  it('parses AIM ]C1 prefix and FNC1/GS separators', () => {
    assert.equal(parseBarcodeScan(`]C1${SAMPLE_CONCAT}`).ean, EXPECTED_EAN);
    assert.equal(
      parseBarcodeScan(`0108718754506861\u001D1527040710L262501111`).bestBeforeIso,
      EXPECTED_MHD,
    );
  });

  it('does not turn GS1 into a long digit mash (regression)', () => {
    const naive = SAMPLE_PAREN.replace(/[^0-9]/g, '');
    assert.equal(naive.length, 35);
    assert.notEqual(normalizeScanCode(SAMPLE_PAREN), naive);
    assert.equal(normalizeScanCode(SAMPLE_PAREN), EXPECTED_EAN);
    assert.equal(cleanScannedBarcode(SAMPLE_CONCAT), EXPECTED_EAN);
  });

  it('keeps plain EAN-13 unchanged', () => {
    assert.equal(normalizeScanCode('4006381333931'), '4006381333931');
    assert.equal(parseBarcodeScan('4006381333931').isGs1, false);
  });

  it('normalizes GTIN-14 with leading zero to EAN-13', () => {
    assert.equal(normalizeGtinToEan(EXPECTED_GTIN), EXPECTED_EAN);
    assert.equal(gs1DateToIso('270407'), EXPECTED_MHD);
    assert.equal(gs1DateToIso('000000'), '');
  });
});

describe('scanner + mhd wiring for GS1', () => {
  it('scanner emits raw payload into GS1-aware parse path', () => {
    const scannerSrc = readFileSync(path.join(root, 'web/scanner.js'), 'utf8');
    assert.ok(scannerSrc.includes("from './barcode-normalize.js'"));
    assert.ok(scannerSrc.includes('parseBarcodeScan'));
    assert.ok(scannerSrc.includes('ASSUME_GS1'));
    assert.ok(scannerSrc.includes('code_128_reader'));
    assert.ok(scannerSrc.includes('getLastScanExtras'));
  });

  it('mhd uses barcode-normalize and accepts GS1 MHD on receiving auto-add', () => {
    const mhdSrc = readFileSync(path.join(root, 'web/mhd.js'), 'utf8');
    assert.ok(mhdSrc.includes("from './barcode-normalize.js'"));
    assert.ok(mhdSrc.includes('gs1-barcode'));
    assert.ok(mhdSrc.includes('resolveScanExtras'));
    assert.ok(mhdSrc.includes('barcodeLookupKeys'));
  });

  it('service worker precaches barcode-normalize.js', () => {
    const swSrc = readFileSync(path.join(root, 'web/sw.js'), 'utf8');
    assert.ok(swSrc.includes("'/barcode-normalize.js'"));
    assert.ok(swSrc.includes('gs1-128-umverpackung'));
  });
});
