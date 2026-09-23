import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const mod = await import(pathToFileURL(path.resolve('web/delivery-parser.js')).href);
const {
  buildDeliveryParserDocIds,
  buildDeliveryParserInventoryRecord,
  buildDeliveryParserMhdRecord,
} = mod;

describe('delivery-parser persistence payloads', () => {
  it('builds employee-writable tenant-scoped inventory receipt records', () => {
    const record = buildDeliveryParserInventoryRecord(
      { artikel: 'Bio Milch', menge: 6, kategorie: 'Mopro' },
      {
        tenantId: 'StevesHof_Hauptbetrieb',
        batchId: 'ls_1700000000000',
        author: 'paddy',
        createdAt: '2026-09-23T10:00:00.000Z',
      },
    );

    assert.deepEqual(record, {
      artikel: 'Bio Milch',
      menge: 6,
      kategorie: 'Mopro',
      tenantId: 'StevesHof_Hauptbetrieb',
      source: 'wareneingang-lieferschein',
      batchId: 'ls_1700000000000',
      createdBy: 'paddy',
      createdAt: '2026-09-23T10:00:00.000Z',
    });
  });

  it('includes tenantId in MHD records so Firestore rules allow receipt rows', () => {
    const ids = buildDeliveryParserDocIds(
      { artikel: 'Bio Milch' },
      'ls_1700000000000',
      0,
    );
    const record = buildDeliveryParserMhdRecord(
      { artikel: 'Bio Milch', menge: 6, kategorie: 'Mopro', mhdIso: '2026-10-01' },
      {
        tenantId: 'StevesHof_Hauptbetrieb',
        author: 'paddy',
        nowIso: '2026-09-23T10:00:00.000Z',
        postenId: ids.mhdDocId,
      },
    );

    assert.equal(record.tenantId, 'StevesHof_Hauptbetrieb');
    assert.equal(record.source, 'wareneingang-lieferschein');
    assert.equal(record.postenId, ids.mhdDocId);
    assert.equal(record.produkt, 'Bio Milch');
    assert.equal(record.qty, 6);
  });

  it('uses stable row indexes so duplicate article lines do not overwrite each other', () => {
    const first = buildDeliveryParserDocIds(
      { artikel: 'Bio Milch' },
      'ls_1700000000000',
      0,
    );
    const second = buildDeliveryParserDocIds(
      { artikel: 'Bio Milch' },
      'ls_1700000000000',
      1,
    );

    assert.notEqual(first.inventoryDocId, second.inventoryDocId);
    assert.notEqual(first.mhdDocId, second.mhdDocId);
  });
});
