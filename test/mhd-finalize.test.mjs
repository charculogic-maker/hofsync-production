import { describe, it, before, beforeEach, afterEach, after } from 'mocha';
import { expect } from 'chai';

let __mhdTest;

describe('MHD delivery finalization retry guards', () => {
  before(async () => {
    globalThis.window = { showToast: () => {}, BRANDING: {} };
    globalThis.document = {
      getElementById: () => null,
      addEventListener: () => {},
    };
    ({ __mhdTest } = await import('../web/mhd.js'));
  });

  beforeEach(() => {
    __mhdTest.clearPendingFinalizeDeliveryId();
  });

  afterEach(() => {
    __mhdTest.clearPendingFinalizeDeliveryId();
    __mhdTest.setWriteOrQueueFirestoreForTest(null);
  });

  it('reuses the same delivery id across retries until the form is reset', () => {
    const first = __mhdTest.getFinalizeDeliveryId(false, '');
    const retry = __mhdTest.getFinalizeDeliveryId(false, '');
    __mhdTest.clearPendingFinalizeDeliveryId();
    const afterReset = __mhdTest.getFinalizeDeliveryId(false, '');

    expect(first).to.equal(retry);
    expect(afterReset).to.not.equal(first);
  });

  it('uses the existing draft id when completing a draft', () => {
    expect(__mhdTest.getFinalizeDeliveryId(true, 'draft-123')).to.equal('draft-123');
  });

  it('deletes a partially saved delivery header after an item write failure', async () => {
    const calls = [];
    __mhdTest.setWriteOrQueueFirestoreForTest(async (payload) => {
      calls.push(payload);
      return 'written';
    });

    const cleaned = await __mhdTest.cleanupPartialDeliveryHeader(
      'tenants/StevesHof_Hauptbetrieb/wareneingang_lieferungen',
      'lieferung_retry',
    );

    expect(cleaned).to.equal(true);
    expect(calls).to.have.length(1);
    expect(calls[0]).to.include({
      collectionPath: 'tenants/StevesHof_Hauptbetrieb/wareneingang_lieferungen',
      docId: 'lieferung_retry',
      op: 'delete',
      silentPermissionDenied: true,
    });
  });

  after(() => {
    delete globalThis.document;
    delete globalThis.window;
  });
});
