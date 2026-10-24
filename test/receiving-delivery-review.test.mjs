/**
 * Unit-Tests: Prüffrage vor Lieferabschluss (Postenübersicht).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDeliveryReviewListHtml } from '../web/receiving.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mhdSrc = readFileSync(path.join(root, 'web/mhd.js'), 'utf8');
const indexSrc = readFileSync(path.join(root, 'web/index.html'), 'utf8');

describe('Wareneingang delivery review prompt', () => {
  it('renders empty state when no items', () => {
    const html = buildDeliveryReviewListHtml([]);
    assert.ok(html.includes('delivery-review-empty'));
    assert.ok(html.includes('Keine Posten'));
  });

  it('lists product, qty and MHD (newest first)', () => {
    const html = buildDeliveryReviewListHtml([
      {
        product: 'Alte Milch',
        qtyValue: 2,
        qtyUnit: 'Stk',
        mhdDate: '2026-10-20',
        addedAt: 100,
      },
      {
        product: 'Frischer Joghurt',
        qtyValue: 1,
        qtyUnit: 'Stk',
        mhdDate: '2026-11-01',
        addedAt: 200,
      },
    ]);
    assert.ok(html.includes('Frischer Joghurt'));
    assert.ok(html.includes('Alte Milch'));
    assert.ok(html.indexOf('Frischer Joghurt') < html.indexOf('Alte Milch'));
    assert.ok(html.includes('1 Stk'));
    assert.ok(html.includes('MHD'));
  });

  it('marks missing MHD as warning', () => {
    const html = buildDeliveryReviewListHtml([
      { product: 'Ohne MHD', qtyValue: 3, qtyUnit: 'Stk', mhdDate: '' },
    ]);
    assert.ok(html.includes('delivery-review-meta--warn'));
    assert.ok(html.includes('fehlt'));
  });

  it('wires review modal into finalizeDelivery', () => {
    assert.ok(indexSrc.includes('id="delivery-review-modal"'));
    assert.ok(indexSrc.includes('id="delivery-review-proceed"'));
    assert.ok(indexSrc.includes('id="delivery-review-check"'));
    assert.ok(indexSrc.includes('Liste nochmals prüfen?'));
    assert.ok(mhdSrc.includes('showDeliveryReviewPrompt'));
    assert.ok(mhdSrc.includes("reviewChoice === 'review'"));
    assert.ok(mhdSrc.includes('skipReviewPrompt'));
    assert.ok(indexSrc.includes('Jetzt abschließen'));
    assert.ok(indexSrc.includes('Liste prüfen'));
  });
});
