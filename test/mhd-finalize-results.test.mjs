import { describe, it } from 'mocha';
import { expect } from 'chai';
import { summarizeDeliveryFinalizeResults } from '../web/mhd-finalize-results.js';

describe('MHD delivery finalize result handling', () => {
  it('treats queued delivery and MHD writes as retryable offline work', () => {
    const summary = summarizeDeliveryFinalizeResults('queued', [
      { status: 'fulfilled', value: 'written' },
      { status: 'fulfilled', value: 'queued' },
    ]);

    expect(summary.hasQueuedWrites).to.equal(true);
    expect(summary.rejectedMhdWrites).to.deep.equal([]);
  });

  it('keeps rejected MHD item writes separate from queued writes', () => {
    const rejection = new Error('permission-denied');
    const summary = summarizeDeliveryFinalizeResults('written', [
      { status: 'fulfilled', value: 'written' },
      { status: 'rejected', reason: rejection },
    ]);

    expect(summary.hasQueuedWrites).to.equal(false);
    expect(summary.rejectedMhdWrites).to.have.length(1);
    expect(summary.rejectedMhdWrites[0].reason).to.equal(rejection);
  });
});
