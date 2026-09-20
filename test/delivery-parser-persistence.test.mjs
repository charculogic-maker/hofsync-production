/**
 * Regression checks for KI-Lieferschein persistence payloads.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const mod = await import(pathToFileURL(path.resolve('web/delivery-parser.js')).href);
const { buildDeliveryPersistenceWrites } = mod;

describe('delivery-parser persistence writes', () => {
  it('creates tenant-scoped inventory and MHD writes without stammdaten stock mutation', () => {
    const writes = buildDeliveryPersistenceWrites(
      [
        { artikel: 'Bio Milch', menge: 6, kategorie: 'MoPro', mhdIso: '2026-09-27' },
        { artikel: 'Bio Milch', menge: 2, kategorie: 'MoPro', mhdIso: '2026-09-28' },
      ],
      {
        tenantId: 'StevesHof_Hauptbetrieb',
        author: 'lena',
        nowIso: '2026-09-20T10:00:00.000Z',
        batchId: 'ls_test_batch',
      },
    );

    assert.equal(writes.length, 4);
    assert.deepEqual(
      writes.map((write) => write.collectionPath),
      ['inventory', 'mhd_liste', 'inventory', 'mhd_liste'],
    );
    assert.equal(writes.some((write) => write.collectionPath === 'stammdaten'), false);

    const inventoryWrites = writes.filter((write) => write.collectionPath === 'inventory');
    const mhdWrites = writes.filter((write) => write.collectionPath === 'mhd_liste');

    assert.deepEqual(inventoryWrites.map((write) => write.docId), [
      'ls_test_batch_inventory_0',
      'ls_test_batch_inventory_1',
    ]);
    assert.deepEqual(mhdWrites.map((write) => write.docId), [
      'ls_test_batch_mhd_0',
      'ls_test_batch_mhd_1',
    ]);
    assert.equal(new Set(mhdWrites.map((write) => write.docId)).size, 2);

    for (const write of writes) {
      assert.equal(write.op, 'set');
      assert.equal(write.onlineData.tenantId, 'StevesHof_Hauptbetrieb');
      assert.equal(write.queueData.tenantId, 'StevesHof_Hauptbetrieb');
      assert.equal(write.onlineData.source, 'wareneingang-lieferschein');
    }

    for (const write of mhdWrites) {
      assert.equal(write.onlineData.lieferungId, 'ls_test_batch');
      assert.equal(write.onlineData.postenId, write.docId);
      assert.equal(write.onlineData.id, write.docId);
      assert.equal(write.onlineData.qty > 0, true);
    }
  });

  it('fails closed when no tenant is available', () => {
    assert.throws(
      () => buildDeliveryPersistenceWrites(
        [{ artikel: 'Bio Milch', menge: 1, kategorie: 'MoPro', mhdIso: '2026-09-27' }],
        { tenantId: '' },
      ),
      /Mandant fehlt/,
    );
  });
});
