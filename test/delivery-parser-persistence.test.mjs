/**
 * Regression checks for KI-Lieferschein persistence payloads.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

globalThis.window = {
  addEventListener() {},
  removeEventListener() {},
  showToast() {},
};
globalThis.document = {
  getElementById() { return null; },
  querySelector() { return null; },
  body: { classList: { add() {}, remove() {} } },
};
globalThis.sessionStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };

const mod = await import(pathToFileURL(path.resolve('web/delivery-parser.js')).href);
const { buildDeliveryParserWrites } = mod;

describe('delivery-parser persistence writes', () => {
  it('creates tenant-scoped inventory and MHD rows without touching stammdaten', () => {
    const [write] = buildDeliveryParserWrites(
      [{ artikel: 'Bio Milch 1L', menge: 6, kategorie: 'MoPro', mhdIso: '2026-10-04' }],
      {
        author: 'stephie',
        nowIso: '2026-09-26T12:00:00.000Z',
        tenantId: 'StevesHof_Hauptbetrieb',
        batchId: 'ls_test_123',
      },
    );

    assert.equal(write.inventory.collectionPath, 'inventory');
    assert.equal(write.inventory.docId, write.mhd.docId);
    assert.deepEqual(Object.keys(write.inventory.onlineData).sort(), [
      'artikel',
      'batchId',
      'createdAt',
      'createdBy',
      'kategorie',
      'menge',
      'source',
      'tenantId',
    ]);
    assert.equal(write.inventory.onlineData.tenantId, 'StevesHof_Hauptbetrieb');
    assert.equal(write.inventory.onlineData.source, 'wareneingang-lieferschein');

    assert.equal(write.mhd.collectionPath, 'mhd_liste');
    assert.equal(write.mhd.onlineData.tenantId, 'StevesHof_Hauptbetrieb');
    assert.equal(write.mhd.onlineData.source, 'wareneingang-lieferschein');
    assert.equal(write.mhd.onlineData.qty, 6);
    assert.equal(write.mhd.onlineData.mhd, '2026-10-04');
  });

  it('uses unique stable document ids for duplicate article rows in one batch', () => {
    const writes = buildDeliveryParserWrites(
      [
        { artikel: 'Joghurt Natur', menge: 4, kategorie: 'MoPro', mhdIso: '2026-10-01' },
        { artikel: 'Joghurt Natur', menge: 2, kategorie: 'MoPro', mhdIso: '2026-10-08' },
      ],
      {
        tenantId: 'StevesHof_Hauptbetrieb',
        batchId: 'ls_duplicate',
        nowIso: '2026-09-26T12:00:00.000Z',
      },
    );

    assert.equal(writes.length, 2);
    assert.notEqual(writes[0].mhd.docId, writes[1].mhd.docId);
    assert.equal(writes[0].mhd.onlineData.id, writes[0].mhd.docId);
    assert.equal(writes[1].mhd.onlineData.id, writes[1].mhd.docId);
  });

  it('fails closed when the tenant context is missing', () => {
    assert.throws(
      () => buildDeliveryParserWrites([{ artikel: 'Milch', menge: 1, mhdIso: '2026-10-01' }]),
      /Mandant fehlt/,
    );
  });
});
