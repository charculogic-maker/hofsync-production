import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

globalThis.document = {
  getElementById: () => null,
};
globalThis.window = {};

const { distributeActualQuantityForPicklistItem } = await import('../web/customer-orders.js');
const { assertNoRejectedMhdWrites } = await import('../web/mhd.js');

describe('customer order picklist quantity distribution', () => {
  it('splits a changed scale value proportionally by ordered quantities', () => {
    const updates = distributeActualQuantityForPicklistItem({
      product: 'Rindersteak',
      unit: 'kg',
      quantity: 3,
      refs: [
        { orderId: 'order-a', lineIndex: 0, quantity: 1 },
        { orderId: 'order-b', lineIndex: 2, quantity: 2 },
      ],
    }, 4.5);

    assert.deepEqual(updates, [
      {
        orderId: 'order-a',
        lineIndex: 0,
        actualQuantity: '1,5',
        actualQuantityUnit: 'kg',
      },
      {
        orderId: 'order-b',
        lineIndex: 2,
        actualQuantity: '3',
        actualQuantityUnit: 'kg',
      },
    ]);
  });

  it('rejects ambiguous multi-order scale values when ordered quantities cannot be parsed', () => {
    assert.throws(
      () => distributeActualQuantityForPicklistItem({
        product: 'Rindersteak',
        unit: 'kg',
        quantity: 0,
        refs: [
          { orderId: 'order-a', lineIndex: 0, quantity: 0 },
          { orderId: 'order-b', lineIndex: 1, quantity: 0 },
        ],
      }, 4.2),
      /Waagen-Wert für Rindersteak/,
    );
  });
});

describe('MHD delivery finalization write results', () => {
  it('allows completed or queued MHD item writes', () => {
    assert.doesNotThrow(() => assertNoRejectedMhdWrites([
      { status: 'fulfilled', value: 'ok' },
      { status: 'fulfilled', value: 'queued' },
    ]));
  });

  it('throws when any MHD item write was rejected', () => {
    const reason = new Error('permission denied');
    assert.throws(
      () => assertNoRejectedMhdWrites([
        { status: 'fulfilled', value: 'ok' },
        { status: 'rejected', reason },
      ]),
      (err) => {
        assert.match(err.message, /1 MHD-Posten/);
        assert.deepEqual(err.causes, [reason]);
        return true;
      },
    );
  });
});
