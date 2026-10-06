/**
 * Sample-Lieferschein gegen MHD-Liste und Stammdaten.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const mod = await import(pathToFileURL(path.resolve('web/delivery-reconciliation.js')).href);
const { reconcileDelivery, normalizeArticleKey, levenshtein, expandRetailQuantity } = mod;

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

  it('expands VPE inner packs to retail pieces and keeps catch weight in kg', () => {
    const knoedel = expandRetailQuantity({ name: 'Kartoffelknödel 10x230g', menge: 1 });
    assert.equal(knoedel.quantity, 10);
    assert.equal(knoedel.unit, 'Stk');
    assert.equal(knoedel.packMultiplier, 10);

    const honig = expandRetailQuantity({ artikel: 'Familienhonig', inhalt: '6x500g', menge: 1, einheit: 'VPE' });
    assert.equal(honig.quantity, 6);
    assert.equal(honig.unit, 'Stk');

    const aufstrich = expandRetailQuantity({ name: 'Fruchtaufstrich 3x175g', quantity: 2, unit: 'VPE' });
    assert.equal(aufstrich.quantity, 6);
    assert.equal(aufstrich.packMultiplier, 3);

    const bananen = expandRetailQuantity({ name: '18.14 kg Bananen', menge: 1 });
    assert.equal(bananen.quantity, 18.14);
    assert.equal(bananen.unit, 'kg');
    assert.equal(bananen.packMultiplier, 1);

    const bananenParsed = expandRetailQuantity({ name: 'Bananen', quantity: 18.14, unit: 'kg' });
    assert.equal(bananenParsed.quantity, 18.14);
    assert.equal(bananenParsed.unit, 'kg');

    const alreadyExpanded = expandRetailQuantity({
      artikel: 'Kartoffelknödel 10x230g',
      menge: 10,
      billedPacks: 1,
      packMultiplier: 10,
      calculatedQuantity: 10,
      einheit: 'Stk',
    });
    assert.equal(alreadyExpanded.quantity, 10);

    const recorded = [
      { id: 'mhd-knoedel', produkt: 'Kartoffelknödel', menge: 10, einheit: 'Stk' },
      { id: 'mhd-banane', produkt: 'Bananen', menge: 18.14, einheit: 'kg' },
    ];
    const rows = reconcileDelivery(
      [
        { name: 'Kartoffelknödel 10x230g', menge: 1 },
        { name: 'Bananen', quantity: 18.14, unit: 'kg' },
      ],
      recorded,
      [],
    );
    assert.equal(rows[0].status, 'PERFECT_MATCH');
    assert.equal(rows[0].sourceItem.quantity, 10);
    assert.equal(rows[0].sourceItem.unit, 'Stk');
    assert.equal(rows[1].status, 'PERFECT_MATCH');
    assert.equal(rows[1].sourceItem.quantity, 18.14);
    assert.equal(rows[1].sourceItem.unit, 'kg');
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