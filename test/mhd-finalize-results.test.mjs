import { describe, it } from 'mocha';
import { expect } from 'chai';
import { assertDeliveryItemWritesSucceeded, findRejectedDeliveryItemWrite } from '../web/mhd-finalize-results.js';

describe('MHD delivery finalization result handling', () => {
  it('allows fully written or queued MHD item writes', () => {
    const results = [
      { status: 'fulfilled', value: 'written' },
      { status: 'fulfilled', value: 'queued' },
    ];

    expect(findRejectedDeliveryItemWrite(results)).to.equal(null);
    expect(() => assertDeliveryItemWritesSucceeded(results)).not.to.throw();
  });

  it('throws when any MHD item write was rejected', () => {
    const permissionError = new Error('permission-denied');
    const results = [
      { status: 'fulfilled', value: 'written' },
      { status: 'rejected', reason: permissionError },
    ];

    expect(findRejectedDeliveryItemWrite(results)).to.equal(permissionError);
    expect(() => assertDeliveryItemWritesSucceeded(results)).to.throw(permissionError);
  });
});
