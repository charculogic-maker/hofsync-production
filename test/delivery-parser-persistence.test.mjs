/**
 * Regression coverage for KI-Lieferschein booking payloads.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const mod = await import(pathToFileURL(path.resolve('web/delivery-parser.js')).href);
const { buildDeliveryBookingWrites } = mod;

describe('delivery-parser booking persistence', () => {
  it('builds tenant-scoped MHD and inventory writes without touching stammdaten', () => {
    const writes = buildDeliveryBookingWrites([
      {
        artikel: 'Bio Joghurt Natur',
        menge: 6,
        kategorie: 'Mopro',
        mhdIso: '2026-10-08',
      },
    ], {
      tenantId: 'StevesHof_Hauptbetrieb',
      author: 'Stephie',
      nowIso: '2026-09-28T10:00:00.000Z',
      todayIso: '2026-09-28',
      batchId: 'ls_test_batch',
    });

    assert.equal(writes.length, 2);
    assert.deepEqual(writes.map((write) => write.collectionPath), ['mhd_liste', 'inventory']);
    assert.equal(writes[0].docId, 'ls_test_batch_000');
    assert.equal(writes[1].docId, 'ls_test_batch_000');
    assert.equal(writes[0].onlineData.tenantId, 'StevesHof_Hauptbetrieb');
    assert.equal(writes[0].onlineData.lieferungId, 'ls_test_batch');
    assert.equal(writes[0].onlineData.tage, 10);
    assert.equal(writes[1].onlineData.tenantId, 'StevesHof_Hauptbetrieb');
    assert.equal(writes[1].onlineData.source, 'wareneingang-lieferschein');
    assert.equal(writes.some((write) => write.collectionPath === 'stammdaten'), false);
  });

  it('keeps duplicate article rows as distinct documents', () => {
    const writes = buildDeliveryBookingWrites([
      { artikel: 'Eier 10er', menge: 2, kategorie: 'Trockenware', mhdIso: '2026-10-05' },
      { artikel: 'Eier 10er', menge: 3, kategorie: 'Trockenware', mhdIso: '2026-10-12' },
    ], {
      tenantId: 'StevesHof_Hauptbetrieb',
      author: 'Stephie',
      nowIso: '2026-09-28T10:00:00.000Z',
      todayIso: '2026-09-28',
      batchId: 'ls_duplicate_batch',
    });

    assert.deepEqual(
      writes.map((write) => write.docId),
      [
        'ls_duplicate_batch_000',
        'ls_duplicate_batch_000',
        'ls_duplicate_batch_001',
        'ls_duplicate_batch_001',
      ],
    );
  });
});
