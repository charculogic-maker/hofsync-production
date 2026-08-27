import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { __deliveryParserTest } from '../web/delivery-parser.js';

const TENANT_ID = 'StevesHof_Hauptbetrieb';

describe('delivery parser receipt bundle', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true },
      configurable: true,
    });
  });

  afterEach(() => {
    __deliveryParserTest.parserState.getFirebase = () => null;
    __deliveryParserTest.parserState.writeOrQueueFirestore = null;
  });

  it('builds tenant-scoped inventory receipt and MHD writes for each row', () => {
    const writes = __deliveryParserTest.buildDeliveryParserWrites(
      [{ artikel: 'Joghurt natur', menge: 6, kategorie: 'MoPro', mhdIso: '2026-09-01' }],
      'team',
      '2026-08-25T22:00:00.000Z',
      TENANT_ID,
      'ls_test',
    );

    expect(writes).to.have.length(2);
    expect(writes[0]).to.include({
      collectionPath: 'inventory',
      docId: 'ls_test_0',
      op: 'set',
    });
    expect(writes[0].onlineData).to.deep.include({
      artikel: 'Joghurt natur',
      menge: 6,
      tenantId: TENANT_ID,
      source: 'wareneingang-lieferschein',
      batchId: 'ls_test',
      createdBy: 'team',
    });
    expect(writes[0].onlineData).to.not.have.property('currentStock');

    expect(writes[1]).to.include({
      collectionPath: 'mhd_liste',
      docId: 'ls_test_mhd_0_joghurt-natur',
      op: 'set',
    });
    expect(writes[1].onlineData).to.deep.include({
      produkt: 'Joghurt natur',
      qty: 6,
      tenantId: TENANT_ID,
      source: 'wareneingang-lieferschein',
      postentyp: 'wareneingang',
      lieferungId: 'ls_test',
    });
  });

  it('commits all online writes in one Firestore batch', async () => {
    const operations = [];
    const batch = {
      set: (ref, data) => operations.push({ path: ref.path, data }),
      commit: async () => operations.push({ committed: true }),
    };
    __deliveryParserTest.parserState.getFirebase = () => ({
      firestore: () => ({
        batch: () => batch,
        doc: (path) => ({ path }),
      }),
    });
    __deliveryParserTest.parserState.writeOrQueueFirestore = async () => {
      throw new Error('offline fallback should not run online');
    };

    const writes = __deliveryParserTest.buildDeliveryParserWrites(
      [{ artikel: 'Rinderhack', menge: 2, kategorie: 'Fleisch', mhdIso: '2026-08-30' }],
      'team',
      '2026-08-25T22:00:00.000Z',
      TENANT_ID,
      'ls_batch',
    );

    const result = await __deliveryParserTest.commitDeliveryParserWrites(writes, TENANT_ID);

    expect(result).to.equal('written');
    expect(operations.map((entry) => entry.path).filter(Boolean)).to.deep.equal([
      `tenants/${TENANT_ID}/inventory/ls_batch_0`,
      `tenants/${TENANT_ID}/mhd_liste/ls_batch_mhd_0_rinderhack`,
    ]);
    expect(operations.at(-1)).to.deep.equal({ committed: true });
  });
});
