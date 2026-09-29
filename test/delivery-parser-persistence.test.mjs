import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const mod = await import(pathToFileURL(path.resolve('web/delivery-parser-persistence.js')).href);
const { buildDeliveryBookingWrites } = mod;

describe('delivery-parser persistence payloads', () => {
  it('builds tenant-scoped MHD and inventory receipt writes only', () => {
    const writes = buildDeliveryBookingWrites(
      [
        { artikel: 'Bio Milch', menge: 6, kategorie: 'MoPro', mhdIso: '2026-10-05' },
        { artikel: 'Bio Milch', menge: 4, kategorie: 'MoPro', mhdIso: '2026-10-06' },
      ],
      {
        tenantId: 'StevesHof_Hauptbetrieb',
        author: 'team',
        nowIso: '2026-09-29T10:00:00.000Z',
        lieferungId: 'lieferung-abc',
      },
    );

    assert.equal(writes.length, 4);
    assert.deepEqual(
      writes.map((write) => write.collectionPath),
      ['mhd_liste', 'inventory', 'mhd_liste', 'inventory'],
    );
    assert.equal(writes.some((write) => write.collectionPath === 'stammdaten'), false);
    assert.equal(new Set(writes.map((write) => write.docId)).size, writes.length);

    const mhdWrites = writes.filter((write) => write.collectionPath === 'mhd_liste');
    assert.equal(mhdWrites[0].onlineData.tenantId, 'StevesHof_Hauptbetrieb');
    assert.equal(mhdWrites[0].onlineData.source, 'wareneingang-lieferschein');
    assert.equal(mhdWrites[0].onlineData.lieferungId, 'lieferung-abc');
    assert.equal(mhdWrites[0].onlineData.qty, 6);
    assert.equal(mhdWrites[1].onlineData.qty, 4);
    assert.notEqual(mhdWrites[0].docId, mhdWrites[1].docId);

    const inventoryWrite = writes.find((write) => write.collectionPath === 'inventory');
    assert.deepEqual(Object.keys(inventoryWrite.onlineData).sort(), [
      'artikel',
      'batchId',
      'createdAt',
      'createdBy',
      'kategorie',
      'menge',
      'source',
      'tenantId',
    ]);
    assert.equal(inventoryWrite.onlineData.tenantId, 'StevesHof_Hauptbetrieb');
  });

  it('fails closed without a tenant id', () => {
    assert.throws(
      () => buildDeliveryBookingWrites([{ artikel: 'Quark', menge: 1, mhdIso: '2026-10-05' }]),
      /Mandant fehlt/,
    );
  });
});
