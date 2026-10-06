/**
 * Sample-Lieferschein gegen MHD-Liste und Stammdaten.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const mod = await import(pathToFileURL(path.resolve('web/delivery-reconciliation.js')).href);
const { reconcileDelivery, normalizeArticleKey, levenshtein } = mod;

const sampleNote = {
  supplier: 'Metro',
  invoiceNumber: 'LS-100',
  date: '2026-10-06',
  items: [
    { name: 'Bio Vollmilch 3,8%', ean: '4035626114608', quantity: 6, unit: 'Stk', unitPrice: 1.49 },
    { name: 'Gouda jung', ean: '4000000000011', quantity: 10, unit: 'kg', unitPrice: 8.5 },
    { name: 'Haferdrink Barista', ean: '4000000000028', quantity: 4, unit: 'Stk', unitPrice: 1.2 },
    { name: 'Neues Spezialsalz', quantity: 2, unit: 'kg', unitPrice: 3 },
  ],
};

describe('delivery-reconciliation', () => {
  it('normalizes names and measures edit distance', () => {
    assert.equal(normalizeArticleKey('Käse'), 'kaese');
    assert.ok(levenshtein('gouda jung', 'gouda jung') === 0);
    assert.ok(levenshtein('schwarzkummel', 'schwarzkuemmel') <= 2);
  });

  it('classifies a sample delivery note against receipts and master data', () => {
    const recorded = [
      { id: 'mhd-milch', produkt: 'Vollmilch Demeter', ean: '4035626114608', menge: 6, einheit: 'Stk' },
      { id: 'mhd-gouda', name: 'Gouda', ean: '4000000000011', qty: 8, einheit: 'kg' },
    ];
    const master = [
      { id: 'stamm-hafer', name: 'Haferdrink Barista', ean: '4000000000028' },
      { id: 'stamm-milch', name: 'Bio Vollmilch 3,8%', ean: '4035626114608' },
    ];

    const rows = reconcileDelivery(sampleNote.items, recorded, master);
    const byName = Object.fromEntries(rows.map((row) => [row.sourceItem.rawName, row]));

    assert.equal(rows.length, 4);
    assert.equal(byName['Bio Vollmilch 3,8%'].status, 'PERFECT_MATCH');
    assert.equal(byName['Bio Vollmilch 3,8%'].matchedEntryId, 'mhd-milch');
    assert.equal(byName['Bio Vollmilch 3,8%'].deltaQuantity, 0);

    assert.equal(byName['Gouda jung'].status, 'QTY_MISMATCH');
    assert.equal(byName['Gouda jung'].deltaQuantity, 2);
    assert.equal(byName['Gouda jung'].recordedQuantity, 8);

    assert.equal(byName['Haferdrink Barista'].status, 'NOT_RECORDED');
    assert.equal(byName['Haferdrink Barista'].matchedMasterId, 'stamm-hafer');
    assert.equal(byName['Haferdrink Barista'].deltaQuantity, 4);

    assert.equal(byName['Neues Spezialsalz'].status, 'UNMAPPED');
    assert.equal(byName['Neues Spezialsalz'].matchedMasterId, null);
    assert.equal(byName['Neues Spezialsalz'].matchedEntryId, null);
  });

  it('matches by fuzzy name when the EAN is missing', () => {
    const rows = reconcileDelivery(
      [{ name: 'Paprika Creme Glas', quantity: 3, unit: 'Stk' }],
      [{ id: 'we-1', product: 'Paprika-Creme', qtyValue: 3, qtyUnit: 'Stk' }],
      [],
    );
    assert.equal(rows[0].status, 'PERFECT_MATCH');
    assert.equal(rows[0].matchedEntryId, 'we-1');
  });
});