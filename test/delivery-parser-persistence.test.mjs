/**
 * Unit tests for KI-Lieferschein persistence payloads.
 */
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { buildDeliveryParserPersistenceRows } from '../web/delivery-parser.js';

describe('delivery parser persistence rows', () => {
  it('builds tenant-scoped inventory and MHD rows for one receipt batch', () => {
    const [entry] = buildDeliveryParserPersistenceRows([
      {
        artikel: 'Bio Milch 1l',
        menge: 6,
        kategorie: 'Molkerei',
        mhdIso: '2026-09-23',
      },
    ], {
      tenantId: 'StevesHof_Hauptbetrieb',
      author: 'Mara',
      nowIso: '2026-09-16T10:00:00.000Z',
      batchId: 'ls_test',
    });

    expect(entry.inventoryDocId).to.equal('ls_test_0');
    expect(entry.mhdDocId).to.equal('ls_test_bio-milch-1l_0');
    expect(entry.inventoryOnlineData).to.deep.equal({
      artikel: 'Bio Milch 1l',
      menge: 6,
      kategorie: '🥛MoPro',
      tenantId: 'StevesHof_Hauptbetrieb',
      source: 'wareneingang-lieferschein',
      batchId: 'ls_test',
      createdBy: 'Mara',
      createdAt: '2026-09-16T10:00:00.000Z',
    });
    expect(entry.inventoryOnlineData).not.to.have.property('currentStock');

    expect(entry.mhdOnlineData).to.include({
      id: 'ls_test_bio-milch-1l_0',
      postenId: 'ls_test_bio-milch-1l_0',
      produkt: 'Bio Milch 1l',
      name: 'Bio Milch 1l',
      qty: 6,
      menge: 6,
      eingangMenge: 6,
      source: 'wareneingang-lieferschein',
      tenantId: 'StevesHof_Hauptbetrieb',
      scannedBy: 'Mara',
    });
    expect(entry.mhdOnlineData.tage).to.equal(7);
  });

  it('keeps duplicate article lines as separate receipt and MHD documents', () => {
    const rows = buildDeliveryParserPersistenceRows([
      { artikel: 'Gouda jung', menge: 2, kategorie: 'Käse', mhdIso: '2026-09-20' },
      { artikel: 'Gouda jung', menge: 3, kategorie: 'Käse', mhdIso: '2026-09-21' },
    ], {
      tenantId: 'StevesHof_Hauptbetrieb',
      author: 'Team',
      nowIso: '2026-09-16T10:00:00.000Z',
      batchId: 'ls_double',
    });

    expect(rows.map((entry) => entry.inventoryDocId)).to.deep.equal(['ls_double_0', 'ls_double_1']);
    expect(rows.map((entry) => entry.mhdDocId)).to.deep.equal([
      'ls_double_gouda-jung_0',
      'ls_double_gouda-jung_1',
    ]);
    expect(new Set(rows.map((entry) => entry.mhdDocId))).to.have.length(2);
  });

  it('fails closed when no tenant context is available', () => {
    expect(() => buildDeliveryParserPersistenceRows([], { tenantId: '' }))
      .to.throw('Mandant fehlt');
  });
});
