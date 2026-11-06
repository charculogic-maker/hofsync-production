/**
 * Finalize-Guards: MHD-Pflicht und Schreibreihenfolge MHD → Lieferungsbeleg.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FINALIZE_WRITE_ORDER,
  buildFinalizePhaseFailureCopy,
  buildMissingMhdFinalizeMessage,
  countReceivingItemsMissingMhd,
  listReceivingItemsMissingMhd,
  shouldBlockDeliveryFinalizeForMissingMhd,
} from '../web/receiving-finalize.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mhdSrc = readFileSync(path.join(root, 'web/mhd.js'), 'utf8');
const receivingSrc = readFileSync(path.join(root, 'web/receiving.js'), 'utf8');

describe('receiving-finalize MHD gate', () => {
  it('lists and blocks items without packaging MHD', () => {
    const items = [
      { product: 'Joghurt', mhdDate: '2026-11-10' },
      { product: 'Milch', mhdDate: '' },
      { product: 'Käse', mhdDate: '  ' },
    ];
    const missing = listReceivingItemsMissingMhd(items);
    assert.equal(missing.length, 2);
    assert.equal(countReceivingItemsMissingMhd(items), 2);
    assert.equal(shouldBlockDeliveryFinalizeForMissingMhd(items), true);
    assert.equal(shouldBlockDeliveryFinalizeForMissingMhd([{ mhdDate: '2026-11-10' }]), false);
  });

  it('builds Laden-iPhone copy for missing MHD', () => {
    const one = buildMissingMhdFinalizeMessage([{ product: 'Milch', mhdDate: '' }]);
    assert.equal(one.title, 'MHD fehlt');
    assert.match(one.message, /Milch/);
    assert.match(one.message, /Verpackung/);

    const many = buildMissingMhdFinalizeMessage([
      { product: 'A', mhdDate: '' },
      { product: 'B', mhdDate: '' },
    ]);
    assert.match(many.message, /2 Posten/);
  });

  it('orders MHD writes before delivery receipt', () => {
    assert.deepEqual([...FINALIZE_WRITE_ORDER], ['mhd_liste', 'wareneingang_lieferungen']);
    const mhdFail = buildFinalizePhaseFailureCopy('mhd', { itemCount: 3 });
    assert.match(mhdFail.toast, /nicht abgeschlossen/i);
    const deliveryFail = buildFinalizePhaseFailureCopy('delivery', { itemCount: 3, mhdWritten: 3 });
    assert.match(deliveryFail.toast, /MHD-Posten sind bereits/);
    assert.match(deliveryFail.message, /Lieferungsbeleg/);
  });

  it('wires hard MHD gate and MHD-first finalize into mhd.js', () => {
    assert.ok(mhdSrc.includes("from './receiving-finalize.js'"));
    assert.ok(mhdSrc.includes('blockFinalizeWhenMhdMissing'));
    assert.ok(mhdSrc.includes('shouldBlockDeliveryFinalizeForMissingMhd'));
    assert.ok(mhdSrc.includes('buildFinalizePhaseFailureCopy'));
    assert.match(
      mhdSrc,
      /Reihenfolge:\s*zuerst MHD-Bestand,\s*danach Lieferungsbeleg/,
    );
    // Dead experience-based MHD suggestion removed from productive receiving.js
    assert.equal(receivingSrc.includes('export function vorhersagenMhd'), false);
    assert.equal(receivingSrc.includes('export function suggestReceivingMhd'), false);
  });
});
