/**
 * Unit checks for KI-Lieferschein Firestore write plans.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const mod = await import(pathToFileURL(path.resolve('web/delivery-parser.js')).href);
const { buildDeliveryParserWritePlans } = mod;

describe('delivery-parser persistence plans', () => {
  it('builds tenant-scoped MHD and inventory creates without mutating stammdaten', () => {
    const plans = buildDeliveryParserWritePlans([
      { artikel: 'Bio Milch', menge: 6, kategorie: 'Mopro', mhdIso: '2026-10-08' },
    ], {
      author: 'Laden',
      nowIso: '2026-10-02T10:00:00.000Z',
      tenantId: 'StevesHof_Hauptbetrieb',
      batchId: 'ls_test_batch',
    });

    assert.equal(plans.length, 1);
    assert.equal(plans[0].mhd.collectionPath, 'mhd_liste');
    assert.equal(plans[0].inventory.collectionPath, 'inventory');
    assert.notEqual(plans[0].mhd.collectionPath, 'stammdaten');
    assert.notEqual(plans[0].inventory.collectionPath, 'stammdaten');

    assert.equal(plans[0].mhd.data.tenantId, 'StevesHof_Hauptbetrieb');
    assert.equal(plans[0].mhd.data.source, 'wareneingang-lieferschein');
    assert.equal(plans[0].mhd.data.produkt, 'Bio Milch');
    assert.equal(plans[0].mhd.data.qty, 6);
    assert.equal(plans[0].mhd.data.lieferungId, 'ls_test_batch');

    assert.equal(plans[0].inventory.data.tenantId, 'StevesHof_Hauptbetrieb');
    assert.equal(plans[0].inventory.data.source, 'wareneingang-lieferschein');
    assert.equal(plans[0].inventory.data.artikel, 'Bio Milch');
    assert.equal(plans[0].inventory.data.menge, 6);
    assert.equal(Object.hasOwn(plans[0].inventory.data, 'currentStock'), false);
  });

  it('keeps duplicate Lieferschein article rows in separate documents', () => {
    const plans = buildDeliveryParserWritePlans([
      { artikel: 'Joghurt Natur', menge: 1, kategorie: 'Mopro', mhdIso: '2026-10-08' },
      { artikel: 'Joghurt Natur', menge: 2, kategorie: 'Mopro', mhdIso: '2026-10-09' },
    ], {
      author: 'Laden',
      nowIso: '2026-10-02T10:00:00.000Z',
      tenantId: 'StevesHof_Hauptbetrieb',
      batchId: 'ls_duplicate_batch',
    });

    assert.equal(plans.length, 2);
    assert.notEqual(plans[0].mhd.docId, plans[1].mhd.docId);
    assert.notEqual(plans[0].inventory.docId, plans[1].inventory.docId);
    assert.equal(plans[0].mhd.data.qty, 1);
    assert.equal(plans[1].mhd.data.qty, 2);
  });

  it('fails closed when no tenant is available', () => {
    assert.throws(
      () => buildDeliveryParserWritePlans([
        { artikel: 'Milch', menge: 1, kategorie: 'Mopro', mhdIso: '2026-10-08' },
      ], {
        author: 'Laden',
        nowIso: '2026-10-02T10:00:00.000Z',
        tenantId: '',
        batchId: 'ls_missing_tenant',
      }),
      /Mandant fehlt/,
    );
  });
});
