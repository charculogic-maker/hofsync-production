/**
 * Unit checks for Lieferschein ↔ Wareneingang Abgleich.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const mod = await import(pathToFileURL(path.resolve('web/delivery-reconcile.js')).href);
const { articlesLikelyMatch, reconcileDeliveryNote, normalizeArticleKey } = mod;

describe('delivery-reconcile', () => {
  it('normalizes umlauts and punctuation', () => {
    assert.equal(normalizeArticleKey('Bio-Milch 3,5%'), 'bio milch 3 5');
    assert.equal(normalizeArticleKey('Käse'), 'kaese');
  });

  it('matches similar article names', () => {
    assert.equal(articlesLikelyMatch('Vollmilch 1L', 'Vollmilch 1 Liter'), true);
    assert.equal(articlesLikelyMatch('Gouda', 'Emmentaler'), false);
  });

  it('flags missing, extra and qty mismatch', () => {
    const result = reconcileDeliveryNote(
      [
        { artikel: 'Vollmilch', menge: 6 },
        { artikel: 'Butter', menge: 2 },
        { artikel: 'Joghurt', menge: 4 },
      ],
      [
        { product: 'Vollmilch', qtyValue: 6, qtyUnit: 'Stk' },
        { product: 'Butter', qtyValue: 1, qtyUnit: 'Stk' },
        { product: 'Quark', qtyValue: 3, qtyUnit: 'Stk' },
      ],
    );
    assert.equal(result.matched.length, 1);
    assert.equal(result.qtyMismatch.length, 1);
    assert.equal(result.missingInReceiving.length, 1);
    assert.equal(result.extraInReceiving.length, 1);
    assert.equal(result.missingInReceiving[0].artikel, 'Joghurt');
    assert.equal(result.extraInReceiving[0].artikel, 'Quark');
    assert.equal(result.summary.ok, false);
  });

  it('reports ok when lists match', () => {
    const result = reconcileDeliveryNote(
      [{ artikel: 'Eier', menge: 10 }],
      [{ product: 'Eier', qtyValue: 10, qtyUnit: 'Stk' }],
    );
    assert.equal(result.summary.ok, true);
  });
});
