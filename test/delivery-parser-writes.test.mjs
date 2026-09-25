/**
 * Unit checks for KI-Lieferschein persistence write plans.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const mod = await import(pathToFileURL(path.resolve('web/delivery-parser-writes.js')).href);
const {
  buildDeliveryParserWriteOps,
  createDeliveryParserBatchId,
  toMhdKategorie,
} = mod;

describe('delivery-parser write plan', () => {
  it('writes receipt inventory and tenant-tagged MHD rows, never stammdaten', () => {
    const ops = buildDeliveryParserWriteOps(
      { artikel: 'Bio Salami', menge: 3, kategorie: 'Aufschnitt', mhdIso: '2026-10-05' },
      {
        tenantId: 'StevesHof_Hauptbetrieb',
        author: 'anna',
        nowIso: '2026-09-25T08:00:00.000Z',
        batchId: 'ls_testbatch',
        index: 0,
        todayIso: '2026-09-25',
      },
    );

    assert.deepEqual(ops.map((op) => op.collectionPath), ['inventory', 'mhd_liste']);
    assert.equal(ops.some((op) => op.collectionPath === 'stammdaten'), false);

    const [inventory, mhd] = ops;
    assert.equal(inventory.docId, 'ls_testbatch_0_bio-salami');
    assert.deepEqual(inventory.onlineData, {
      artikel: 'Bio Salami',
      menge: 3,
      kategorie: '🥓 Aufschnitt',
      tenantId: 'StevesHof_Hauptbetrieb',
      source: 'wareneingang-lieferschein',
      batchId: 'ls_testbatch',
      createdBy: 'anna',
      createdAt: '2026-09-25T08:00:00.000Z',
    });

    assert.equal(mhd.docId, 'ls_testbatch_mhd_0_bio-salami');
    assert.equal(mhd.onlineData.tenantId, 'StevesHof_Hauptbetrieb');
    assert.equal(mhd.onlineData.lieferungId, 'ls_testbatch');
    assert.equal(mhd.onlineData.qty, 3);
    assert.equal(mhd.onlineData.mhd, '2026-10-05');
    assert.equal(mhd.onlineData.tage, 10);
  });

  it('uses row indexes so duplicate article rows do not overwrite each other', () => {
    const first = buildDeliveryParserWriteOps(
      { artikel: 'Joghurt Natur', menge: 1, kategorie: 'MoPro', mhdIso: '2026-09-30' },
      { tenantId: 'StevesHof_Hauptbetrieb', batchId: 'ls_dupe', index: 0 },
    );
    const second = buildDeliveryParserWriteOps(
      { artikel: 'Joghurt Natur', menge: 2, kategorie: 'MoPro', mhdIso: '2026-10-01' },
      { tenantId: 'StevesHof_Hauptbetrieb', batchId: 'ls_dupe', index: 1 },
    );

    assert.notEqual(first[0].docId, second[0].docId);
    assert.notEqual(first[1].docId, second[1].docId);
  });

  it('fails closed without tenant context', () => {
    assert.throws(
      () => buildDeliveryParserWriteOps({ artikel: 'Butter', menge: 1 }, { tenantId: '' }),
      /Mandant fehlt/,
    );
  });

  it('classifies Aufschnitt items consistently', () => {
    assert.equal(toMhdKategorie('Fleisch', 'Rinder-Salami'), '🥓 Aufschnitt');
    assert.match(createDeliveryParserBatchId(1700000000000), /^ls_loyw3v28_/);
  });
});
