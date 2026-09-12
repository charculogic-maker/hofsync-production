/**
 * Unit tests for tenant-scoped Artikel-Stammdaten cache.
 */
import { afterEach, beforeEach, describe, it } from 'mocha';
import { expect } from 'chai';
import {
  getProductMasterStorageKey,
  readLocalProductMaster,
  writeLocalProductMasterEntry,
  PRODUCT_MASTER_STORAGE_KEY,
} from '../web/product-master.js';

class MemoryStorage {
  constructor() {
    this.store = new Map();
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    this.store.set(key, String(value));
  }

  removeItem(key) {
    this.store.delete(key);
  }
}

describe('product master local cache', () => {
  let previousLocalStorage;

  beforeEach(() => {
    previousLocalStorage = globalThis.localStorage;
    globalThis.localStorage = new MemoryStorage();
  });

  afterEach(() => {
    if (previousLocalStorage === undefined) {
      delete globalThis.localStorage;
    } else {
      globalThis.localStorage = previousLocalStorage;
    }
  });

  it('stores learned product names under tenant-scoped keys only', () => {
    writeLocalProductMasterEntry('StevesHof_Hauptbetrieb', {
      ean: '4012346200507',
      name: 'Hofmilch',
      category: 'Kuehlung',
    });

    const steveshofKey = getProductMasterStorageKey('StevesHof_Hauptbetrieb');
    expect(steveshofKey).to.equal(`${PRODUCT_MASTER_STORAGE_KEY}.steveshof_hauptbetrieb`);
    expect(readLocalProductMaster('StevesHof_Hauptbetrieb')).to.have.nested.property(
      '4012346200507.name',
      'Hofmilch',
    );
    expect(readLocalProductMaster('TorFabrik')).to.deep.equal({});
    expect(globalThis.localStorage.getItem(PRODUCT_MASTER_STORAGE_KEY)).to.equal(null);
  });

  it('ignores legacy global product-master entries without an active tenant', () => {
    globalThis.localStorage.setItem(PRODUCT_MASTER_STORAGE_KEY, JSON.stringify({
      4012346200507: { barcode: '4012346200507', name: 'Falscher Betrieb' },
    }));

    expect(readLocalProductMaster('StevesHof_Hauptbetrieb')).to.deep.equal({});
    expect(readLocalProductMaster('')).to.deep.equal({});
  });
});
