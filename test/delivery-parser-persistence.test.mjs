/**
 * Regression checks for KI-Lieferschein persistence payloads.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const mod = await import(pathToFileURL(path.resolve('web/delivery-parser.js')).href);
const { buildInventoryPostenPayload, buildMhdPostenPayload } = mod;

describe('delivery-parser persistence payloads', () => {
  const row = {
    artikel: 'Bio Vollmilch',
    menge: 6,
    kategorie: 'Molkerei',
    mhdIso: '2026-09-28',
  };

  it('writes tenant-scoped inventory rows instead of legacy stammdaten stock increments', () => {
    const payload = buildInventoryPostenPayload(
      row,
      'StevesHof_Hauptbetrieb',
      'team',
      '2026-09-21T22:00:00.000Z',
      'ls_123',
      0,
    );

    assert.equal(payload.tenantId, 'StevesHof_Hauptbetrieb');
    assert.equal(payload.source, 'wareneingang-lieferschein');
    assert.equal(payload.batchId, 'ls_123');
    assert.equal(payload._docId, 'ls_123_0');
    assert.equal(Object.hasOwn(payload, 'currentStock'), false);
  });

  it('includes tenantId on MHD rows and keeps duplicate article lines distinct', () => {
    const first = buildMhdPostenPayload(
      row,
      'StevesHof_Hauptbetrieb',
      'team',
      '2026-09-21T22:00:00.000Z',
      'ls_123',
      0,
    );
    const second = buildMhdPostenPayload(
      row,
      'StevesHof_Hauptbetrieb',
      'team',
      '2026-09-21T22:00:00.000Z',
      'ls_123',
      1,
    );

    assert.equal(first.tenantId, 'StevesHof_Hauptbetrieb');
    assert.equal(first.source, 'wareneingang-lieferschein');
    assert.notEqual(first.postenId, second.postenId);
  });
});
