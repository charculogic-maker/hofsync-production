import { describe, it } from 'mocha';
import { expect } from 'chai';
import {
  requireAllSettledWritesFulfilled,
  requireSettledWriteFulfilled,
} from '../web/receiving-write-results.js';

describe('receiving write result handling', () => {
  it('keeps successful written and queued Firestore results', () => {
    expect(requireSettledWriteFulfilled({ status: 'fulfilled', value: 'written' }, 'failed')).to.equal('written');
    expect(requireAllSettledWritesFulfilled([
      { status: 'fulfilled', value: 'written' },
      { status: 'fulfilled', value: 'queued' },
    ], 'failed')).to.deep.equal(['written', 'queued']);
  });

  it('throws when a required Firestore write was rejected', () => {
    const reason = new Error('permission-denied');

    expect(() => requireSettledWriteFulfilled(
      { status: 'rejected', reason },
      'Wareneingang konnte nicht in Firestore gespeichert werden.',
    )).to.throw('Wareneingang konnte nicht in Firestore gespeichert werden.')
      .and.have.property('cause', reason);

    expect(() => requireAllSettledWritesFulfilled([
      { status: 'fulfilled', value: 'written' },
      { status: 'rejected', reason },
    ], 'Mindestens ein MHD-Posten konnte nicht gespeichert werden.'))
      .to.throw('Mindestens ein MHD-Posten konnte nicht gespeichert werden.');
  });
});
