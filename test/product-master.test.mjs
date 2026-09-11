import { expect } from 'chai';
import { initTenantDb } from '../web/tenant-db.js';
import {
  PRODUCT_MASTER_STORAGE_KEY,
  hydrateProductMasterFromFirestore,
  persistProductMasterToFirestore,
  productMasterStorageKey,
  readLocalProductMaster,
  writeLocalProductMasterEntry,
} from '../web/product-master.js';

const TENANT_A = 'StevesHof_Hauptbetrieb';
const TENANT_B = 'TorFabrik';
const EAN = '4012346200507';

class MemoryLocalStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(String(key), String(value));
  }

  removeItem(key) {
    this.values.delete(String(key));
  }
}

function createFirestoreStub({ docsByTenant = {}, writes = [] } = {}) {
  return {
    collection(rootName) {
      expect(rootName).to.equal('tenants');
      return {
        doc(tenantId) {
          return {
            collection(collectionName) {
              expect(collectionName).to.equal('product_master');
              return {
                doc(docId) {
                  return {
                    async set(data, options) {
                      writes.push({ tenantId, collectionName, docId, data, options });
                    },
                  };
                },
                async get() {
                  const tenantDocs = docsByTenant[tenantId] || [];
                  return {
                    docs: tenantDocs.map((entry) => ({
                      id: entry.id,
                      data: () => entry.data,
                    })),
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

describe('product master tenant-local cache', () => {
  beforeEach(() => {
    globalThis.localStorage = new MemoryLocalStorage();
    initTenantDb(null);
  });

  afterEach(() => {
    initTenantDb(null);
    delete globalThis.localStorage;
  });

  it('stores learned EAN names under tenant-scoped localStorage keys', () => {
    writeLocalProductMasterEntry(TENANT_A, {
      ean: EAN,
      name: 'StevesHof Cold Brew',
      brand: 'Hofmarke',
    });
    writeLocalProductMasterEntry(TENANT_B, {
      ean: EAN,
      name: 'TorFabrik Cold Brew',
      brand: 'TorFabrik',
    });

    expect(productMasterStorageKey(TENANT_A)).to.equal(`${PRODUCT_MASTER_STORAGE_KEY}.steveshof_hauptbetrieb`);
    expect(productMasterStorageKey(TENANT_B)).to.equal(`${PRODUCT_MASTER_STORAGE_KEY}.torfabrik`);
    expect(globalThis.localStorage.getItem(PRODUCT_MASTER_STORAGE_KEY)).to.equal(null);
    expect(readLocalProductMaster(TENANT_A)[EAN].name).to.equal('StevesHof Cold Brew');
    expect(readLocalProductMaster(TENANT_B)[EAN].name).to.equal('TorFabrik Cold Brew');
    expect(readLocalProductMaster('')).to.deep.equal({});
  });

  it('persists and hydrates shared product names only for the active tenant cache', async () => {
    const writes = [];
    initTenantDb(createFirestoreStub({
      writes,
      docsByTenant: {
        [TENANT_A]: [{
          id: EAN,
          data: {
            ean: EAN,
            articleName: 'Cold Brew Süáe Kräuter',
            brand: 'Hofmarke',
          },
        }],
        [TENANT_B]: [{
          id: EAN,
          data: {
            ean: EAN,
            articleName: 'TorFabrik Kräuter',
            brand: 'TorFabrik',
          },
        }],
      },
    }));

    await persistProductMasterToFirestore(TENANT_A, {
      ean: EAN,
      name: 'StevesHof Korrektur',
      scanBarcode: '04012346200507',
    }, 'Paddy');
    await hydrateProductMasterFromFirestore(TENANT_B);

    expect(writes).to.have.length(1);
    expect(writes[0]).to.include({
      tenantId: TENANT_A,
      collectionName: 'product_master',
      docId: EAN,
    });
    expect(writes[0].options).to.deep.equal({ merge: true });
    expect(globalThis.localStorage.getItem(PRODUCT_MASTER_STORAGE_KEY)).to.equal(null);
    expect(readLocalProductMaster(TENANT_A)[EAN].name).to.equal('StevesHof Korrektur');
    expect(readLocalProductMaster(TENANT_A)['04012346200507'].einzelBarcode).to.equal(EAN);
    expect(readLocalProductMaster(TENANT_B)[EAN].name).to.equal('TorFabrik Kräuter');
  });
});
