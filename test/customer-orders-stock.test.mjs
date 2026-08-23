import { describe, it } from 'mocha';
import assert from 'node:assert/strict';
import { expect } from 'chai';

import { __customerOrdersTest } from '../web/customer-orders.js';
import { __traceabilityTest } from '../web/traceability.js';

let mhdTest = null;

function makeRef(path) {
  return {
    path,
    id: path.split('/').pop(),
  };
}

function makeSnap(path, data = {}, exists = true) {
  return {
    exists,
    ref: makeRef(path),
    data: () => data,
  };
}

function makeStockCollection({ byId = {}, byProdukt = {}, byName = {} } = {}) {
  return {
    doc(id) {
      return {
        async get() {
          return byId[id] || makeSnap(`tenants/test/stammdaten/${id}`, {}, false);
        },
      };
    },
    where(field, _op, value) {
      const source = field === 'produkt' ? byProdukt : byName;
      const docs = source[value] || [];
      return {
        limit(count) {
          return {
            async get() {
              const limitedDocs = docs.slice(0, count);
              return {
                empty: limitedDocs.length === 0,
                docs: limitedDocs,
              };
            },
          };
        },
      };
    },
  };
}

describe('customer order pickup stock safety', () => {
  it('aggregates duplicate order lines for the same stock document', async () => {
    const stockSnap = makeSnap('tenants/test/stammdaten/fleischsalat', { currentStock: 5 });
    const collection = makeStockCollection({
      byProdukt: {
        Fleischsalat: [stockSnap],
      },
    });

    const deductions = await __customerOrdersTest.prepareStockDeductionsForOrder({
      items: [
        { product: 'Fleischsalat', quantity: '1.25' },
        { product: 'Fleischsalat', actualQuantity: '0,75' },
      ],
    }, collection);

    expect(deductions).to.have.length(1);
    expect(deductions[0].ref.path).to.equal('tenants/test/stammdaten/fleischsalat');
    expect(deductions[0].amount).to.equal(2);
  });

  it('fails closed when no stock document matches an ordered item', async () => {
    const collection = makeStockCollection();

    await assert.rejects(__customerOrdersTest.prepareStockDeductionsForOrder({
      items: [{ product: 'Leberwurst', quantity: '1' }],
    }, collection), /Lagerartikel für Leberwurst nicht gefunden\./);
  });

  it('fails closed when product lookup is ambiguous', async () => {
    const collection = makeStockCollection({
      byProdukt: {
        Bratwurst: [
          makeSnap('tenants/test/stammdaten/bratwurst-a'),
          makeSnap('tenants/test/stammdaten/bratwurst-b'),
        ],
      },
    });

    await assert.rejects(__customerOrdersTest.prepareStockDeductionsForOrder({
      items: [{ product: 'Bratwurst', quantity: '1' }],
    }, collection), /Mehrere Lagerartikel für Bratwurst gefunden\./);
  });

  it('fails closed when stock is deleted or insufficient during pickup transaction', () => {
    const FieldValue = { serverTimestamp: () => 'server-time' };
    const deduction = { product: 'Fleischsalat', amount: 4 };

    expect(() => __customerOrdersTest.buildStockDeductionUpdate(
      makeSnap('tenants/test/stammdaten/fleischsalat', {}, false),
      deduction,
      FieldValue,
    )).to.throw('Lagerartikel für Fleischsalat nicht gefunden.');

    expect(() => __customerOrdersTest.buildStockDeductionUpdate(
      makeSnap('tenants/test/stammdaten/fleischsalat', { currentStock: 3 }),
      deduction,
      FieldValue,
    )).to.throw('Nicht genug Lagerbestand für Fleischsalat.');

    expect(__customerOrdersTest.buildStockDeductionUpdate(
      makeSnap('tenants/test/stammdaten/fleischsalat', { currentStock: 5 }),
      deduction,
      FieldValue,
    )).to.deep.equal({ currentStock: 1, updatedAt: 'server-time' });
  });
});

describe('chargendoku Bio association normalization', () => {
  it('keeps blank or unknown Bio association blank', () => {
    expect(__traceabilityTest.normalizeOrganicAssociationInput('')).to.equal('');
    expect(__traceabilityTest.normalizeOrganicAssociationInput('Keine / Konventionell')).to.equal('Keine / Konventionell');
    expect(__traceabilityTest.normalizeOrganicAssociationInput('unbekannt')).to.equal('');
  });

  it('preserves explicit supported Bio associations', () => {
    expect(__traceabilityTest.normalizeOrganicAssociationInput('EU-Bio')).to.equal('EU-Bio');
    expect(__traceabilityTest.normalizeOrganicAssociationInput(' Bioland ')).to.equal('Bioland');
  });
});

describe('MHD delivery finalize retry identifiers', () => {
  it('keeps delivery MHD posten ids stable for the same retry target', async () => {
    if (!mhdTest) {
      globalThis.document = globalThis.document || {
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
      };
      globalThis.window = globalThis.window || {};
      ({ __mhdTest: mhdTest } = await import('../web/mhd.js'));
    }

    const item = {
      id: 'item-1',
      product: 'Galloway Hack',
      mhdDate: '2026-09-01',
    };

    const first = mhdTest.createDeliveryMhdPostenId('lieferung_abc', item, '123456789');
    const retry = mhdTest.createDeliveryMhdPostenId('lieferung_abc', item, '123456789');
    const otherItem = mhdTest.createDeliveryMhdPostenId(
      'lieferung_abc',
      { ...item, id: 'item-2' },
      '123456789',
    );

    expect(retry).to.equal(first);
    expect(otherItem).to.not.equal(first);
  });
});
