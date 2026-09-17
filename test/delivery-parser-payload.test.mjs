/**
 * Focused regression checks for KI-Lieferschein booking payloads.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

globalThis.window = {
  ...(globalThis.window || {}),
  addEventListener: globalThis.window?.addEventListener || (() => {}),
  removeEventListener: globalThis.window?.removeEventListener || (() => {}),
};
globalThis.document = {
  ...(globalThis.document || {}),
  addEventListener: globalThis.document?.addEventListener || (() => {}),
  removeEventListener: globalThis.document?.removeEventListener || (() => {}),
};

const mod = await import(pathToFileURL(path.resolve('web/delivery-parser.js')).href);
const {
  buildDeliveryParserBatchId,
  buildDeliveryParserDocId,
  buildInventoryReceiptPayload,
} = mod;

describe('delivery-parser booking payloads', () => {
  it('builds rule-compliant inventory receipt payloads for employees', () => {
    const payload = buildInventoryReceiptPayload(
      { artikel: 'Bio Milch', menge: 6, kategorie: 'Molkerei' },
      'anna',
      '2026-09-17T09:00:00.000Z',
      'StevesHof_Hauptbetrieb',
      'ls_20260917_abc123',
    );

    assert.deepEqual(Object.keys(payload).sort(), [
      'artikel',
      'batchId',
      'createdAt',
      'createdBy',
      'kategorie',
      'menge',
      'source',
      'tenantId',
    ].sort());
    assert.equal(payload.tenantId, 'StevesHof_Hauptbetrieb');
    assert.equal(payload.source, 'wareneingang-lieferschein');
    assert.equal(payload.kategorie, '🥛MoPro');
    assert.equal(Object.hasOwn(payload, 'currentStock'), false);
    assert.equal(Object.hasOwn(payload, 'lastMhd'), false);
  });

  it('uses unique deterministic document ids per parsed row', () => {
    const row = { artikel: 'Bio Milch' };
    const first = buildDeliveryParserDocId('ls_inventory', row, 'ls_20260917_abc123', 0);
    const second = buildDeliveryParserDocId('ls_inventory', row, 'ls_20260917_abc123', 1);

    assert.notEqual(first, second);
    assert.equal(first, 'ls_inventory_ls_20260917_abc123_00_bio-milch');
    assert.equal(second, 'ls_inventory_ls_20260917_abc123_01_bio-milch');
  });

  it('builds Firestore-safe batch ids from ISO timestamps', () => {
    const batchId = buildDeliveryParserBatchId('2026-09-17T09:00:00.000Z');

    assert.match(batchId, /^ls_20260917T090000000Z_[a-z0-9]+$/);
    assert.equal(batchId.includes(':'), false);
    assert.equal(batchId.includes('/'), false);
  });
});
