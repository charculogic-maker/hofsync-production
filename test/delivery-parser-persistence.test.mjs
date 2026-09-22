import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const mod = await import(pathToFileURL(path.resolve('web/delivery-parser.js')).href);
const { buildDeliveryReceiptWrites } = mod;

describe('delivery-parser persistence payloads', () => {
  it('builds tenant-scoped inventory and MHD writes for receipt rows', () => {
    const writes = buildDeliveryReceiptWrites([
      { artikel: 'Bio Milch', menge: 6, kategorie: 'MoPro', mhdIso: '2026-09-25' },
    ], {
      tenantId: 'StevesHof_Hauptbetrieb',
      author: 'Laden',
      nowIso: '2026-09-22T10:00:00.000Z',
      batchId: 'ls_test',
    });

    assert.equal(writes.length, 1);
    assert.equal(writes[0].inventoryDocId, 'ls_test_0');
    assert.deepEqual(writes[0].inventoryData, {
      artikel: 'Bio Milch',
      menge: 6,
      kategorie: '🥛MoPro',
      tenantId: 'StevesHof_Hauptbetrieb',
      source: 'wareneingang-lieferschein',
      batchId: 'ls_test',
      createdBy: 'Laden',
      createdAt: '2026-09-22T10:00:00.000Z',
    });
    assert.equal(writes[0].mhdData.tenantId, 'StevesHof_Hauptbetrieb');
    assert.equal(writes[0].mhdData.source, 'wareneingang-lieferschein');
    assert.equal(writes[0].mhdData.qty, 6);
    assert.equal(writes[0].mhdData.mhdDate, '2026-09-25');
  });

  it('uses stable unique MHD document IDs for duplicate article rows', () => {
    const writes = buildDeliveryReceiptWrites([
      { artikel: 'Galloway Wurst', menge: 2, kategorie: 'Aufschnitt', mhdIso: '2026-09-26' },
      { artikel: 'Galloway Wurst', menge: 3, kategorie: 'Aufschnitt', mhdIso: '2026-09-27' },
    ], {
      tenantId: 'StevesHof_Hauptbetrieb',
      author: 'Laden',
      nowIso: '2026-09-22T10:00:00.000Z',
      batchId: 'ls_dupe',
    });

    assert.equal(writes[0].mhdDocId, 'ls_dupe_mhd_0_galloway-wurst');
    assert.equal(writes[1].mhdDocId, 'ls_dupe_mhd_1_galloway-wurst');
    assert.notEqual(writes[0].mhdDocId, writes[1].mhdDocId);
  });

  it('fails closed when tenant context is missing', () => {
    assert.throws(
      () => buildDeliveryReceiptWrites([
        { artikel: 'Bio Milch', menge: 1, kategorie: 'MoPro', mhdIso: '2026-09-25' },
      ], {
        tenantId: '',
        author: 'Laden',
        nowIso: '2026-09-22T10:00:00.000Z',
        batchId: 'ls_missing_tenant',
      }),
      /Mandant fehlt/,
    );
  });
});
