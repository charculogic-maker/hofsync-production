import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const mod = await import(pathToFileURL(path.resolve('web/delivery-parser.js')).href);
const { buildDeliveryParserMhdPosten } = mod;

describe('delivery-parser direct booking payload', () => {
  it('builds tenant-scoped MHD rows without legacy stock increments', () => {
    const record = buildDeliveryParserMhdPosten(
      {
        artikel: 'Bio Vollmilch 3,8%',
        menge: 6,
        kategorie: 'Mopro',
        mhdIso: '2026-10-15',
        ean: '4035626114608',
      },
      'Bettina',
      '2026-10-09T12:00:00.000Z',
      { sequence: 'batch-1_0', tenantId: 'StevesHof_Hauptbetrieb' },
    );

    assert.equal(record.id, 'ls_bio-vollmilch-3-8_batch-1_0');
    assert.equal(record.tenantId, 'StevesHof_Hauptbetrieb');
    assert.equal(record.source, 'wareneingang-lieferschein');
    assert.equal(record.postentyp, 'wareneingang');
    assert.equal(record.qty, 6);
    assert.equal(record.ean, '4035626114608');
    assert.equal(record.barcode, '4035626114608');
    assert.equal(Object.hasOwn(record, 'currentStock'), false);
  });
});
