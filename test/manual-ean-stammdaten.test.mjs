/**
 * Regression: Manuell eingepflegte EANs müssen sofort in den Stammdaten landen
 * (nicht erst beim Lieferabschluss), damit der nächste Scan den Artikel kennt.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildProductMasterDoc,
  cleanProductEan,
  writeLocalProductMasterEntry,
  readLocalProductMaster,
  PRODUCT_MASTER_STORAGE_KEY,
} from '../web/product-master.js';
import { lookupCatalogEan } from '../web/catalog-ean.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mhdSrc = readFileSync(path.join(root, 'web/mhd.js'), 'utf8');
const catalogSrc = readFileSync(path.join(root, 'web/catalog-ean.js'), 'utf8');

describe('Manuelle EAN → Stammdaten', () => {
  beforeEach(() => {
    globalThis.localStorage = {
      _data: {},
      getItem(key) {
        return Object.prototype.hasOwnProperty.call(this._data, key) ? this._data[key] : null;
      },
      setItem(key, value) {
        this._data[key] = String(value);
      },
      removeItem(key) {
        delete this._data[key];
      },
    };
  });

  it('lernt EAN+Name lokal unter product_master', () => {
    const entry = writeLocalProductMasterEntry({
      ean: '4028332320111',
      name: 'Weißenhorner Paprika Creme',
      brand: 'Weißenhorner',
      category: '🥛MoPro',
    });
    assert.equal(entry?.barcode, '4028332320111');
    assert.equal(entry?.name, 'Weißenhorner Paprika Creme');
    const local = readLocalProductMaster();
    assert.equal(local['4028332320111']?.name, 'Weißenhorner Paprika Creme');
    assert.equal(cleanProductEan('4028 3323 2011 1'), '4028332320111');
    assert.ok(PRODUCT_MASTER_STORAGE_KEY.includes('productMaster'));
  });

  it('baut Firestore-Doc für product_master/{ean}', () => {
    const doc = buildProductMasterDoc('StevesHof_Hauptbetrieb', {
      ean: '4028332320111',
      name: 'Weißenhorner Paprika Creme',
      brand: 'Weißenhorner',
    }, 'Finn');
    assert.equal(doc.ean, '4028332320111');
    assert.equal(doc.articleName, 'Weißenhorner Paprika Creme');
    assert.equal(doc.tenantId, 'StevesHof_Hauptbetrieb');
    assert.equal(doc.updatedBy, 'Finn');
  });

  it('lookupCatalogEan behält manuell eingetippte Verbraucher-EAN', () => {
    const index = {
      byArticle: new Map([['12345', '4000000000001']]),
      byName: new Map([['joghurt', '4000000000002']]),
    };
    assert.equal(
      lookupCatalogEan(index, { ean: '4028332320111', name: 'Sonstiges' }),
      '4028332320111',
    );
  });

  it('addDeliveryItem speichert Stammdaten sofort (nicht erst beim Abschließen)', () => {
    const addFnStart = mhdSrc.indexOf('async function addDeliveryItem(');
    assert.ok(addFnStart > 0, 'addDeliveryItem muss existieren');
    const addFnEnd = mhdSrc.indexOf('\nasync function ', addFnStart + 1);
    const addFnBody = mhdSrc.slice(addFnStart, addFnEnd > 0 ? addFnEnd : addFnStart + 8000);
    assert.ok(
      addFnBody.includes('saveProductMaster({'),
      'addDeliveryItem muss saveProductMaster aufrufen',
    );
    assert.ok(
      addFnBody.includes('rememberCategoryForBarcode('),
      'addDeliveryItem muss Kategorie je EAN merken',
    );
    // Reihenfolge: Item anlegen, dann Stammdaten lernen, dann Formular leeren
    const unshiftAt = addFnBody.indexOf('currentDeliveryItems.unshift(');
    const saveAt = addFnBody.indexOf('saveProductMaster({');
    const clearAt = addFnBody.indexOf('clearDeliveryItemFields(');
    assert.ok(unshiftAt >= 0 && saveAt > unshiftAt && clearAt > saveAt);
  });

  it('Stammdaten-UI hydriert product_master aus der Cloud', () => {
    assert.ok(mhdSrc.includes('await refreshSharedProductMaster()'));
    assert.ok(mhdSrc.includes('async function collectStammdatenEntries()'));
  });

  it('EAN-Index liest auch product_master', () => {
    assert.ok(catalogSrc.includes("getTenantCollection('product_master')"));
    assert.ok(catalogSrc.includes('indexCatalogEanDoc'));
  });
});
