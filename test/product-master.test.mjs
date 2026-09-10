/**
 * Unit tests for tenant-scoped product-master local cache.
 */
import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import {
  productMasterStorageKey,
  readLocalProductMaster,
  writeLocalProductMasterEntry,
} from '../web/product-master.js';

function installLocalStorageStub() {
  const store = new Map();
  global.localStorage = {
    get length() {
      return store.size;
    },
    key(index) {
      return [...store.keys()][index] ?? null;
    },
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
  return store;
}

describe('product-master local cache', () => {
  let store;

  beforeEach(() => {
    store = installLocalStorageStub();
  });

  afterEach(() => {
    delete global.localStorage;
  });

  it('keeps learned article names separated per tenant on a shared browser', () => {
    writeLocalProductMasterEntry(
      { ean: '4012346200507', name: 'StevesHof Cold Brew' },
      'StevesHof_Hauptbetrieb',
    );
    writeLocalProductMasterEntry(
      { ean: '4012346200507', name: 'TorFabrik Cold Brew' },
      'TorFabrik',
    );

    expect(readLocalProductMaster('StevesHof_Hauptbetrieb')['4012346200507'].name)
      .to.equal('StevesHof Cold Brew');
    expect(readLocalProductMaster('TorFabrik')['4012346200507'].name)
      .to.equal('TorFabrik Cold Brew');
    expect(store.has('charculogic.productMaster.v1')).to.equal(false);
  });

  it('fails closed instead of reading or writing the legacy global key without a tenant', () => {
    store.set('charculogic.productMaster.v1', JSON.stringify({
      4012346200507: { barcode: '4012346200507', name: 'Foreign Tenant Name' },
    }));

    expect(productMasterStorageKey('')).to.equal('');
    expect(readLocalProductMaster('')).to.deep.equal({});
    expect(writeLocalProductMasterEntry({ ean: '4012346200507', name: 'No Tenant' }, ''))
      .to.equal(null);
    expect(JSON.parse(store.get('charculogic.productMaster.v1'))['4012346200507'].name)
      .to.equal('Foreign Tenant Name');
  });
});
