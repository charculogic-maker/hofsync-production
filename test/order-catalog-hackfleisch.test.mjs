/**
 * BioOffice Hackfleisch-Staffel & Filet-Margenschutz (Task 6b-2).
 */
import { strict as assert } from 'node:assert';
import {
  findProductById,
  resolveHackfleischTier,
  applyHackfleischTier,
  isHackfleischProduct,
  estimateLinePrice,
  validateCutSelection,
  HACKFLEISCH_BASE_PRICE,
} from '../web/orderCatalog.js';

describe('orderCatalog BioOffice Hackfleisch-Staffel', () => {
  it('nutzt Basis Art. 503 / 26,99 € unter 1,5 kg', () => {
    for (const kg of [0.5, 1.0, 1.49]) {
      const tier = resolveHackfleischTier(kg);
      assert.equal(tier.artNr, '503');
      assert.equal(tier.pricePerKg, HACKFLEISCH_BASE_PRICE);
      assert.equal(tier.badge, '');
    }
  });

  it('Staffel Art. 5031 ab 1,5 kg', () => {
    for (const kg of [1.5, 2.0, 2.5, 2.99]) {
      const tier = resolveHackfleischTier(kg);
      assert.equal(tier.artNr, '5031');
      assert.equal(tier.pricePerKg, 24.99);
      assert.match(tier.badge, /1,5/);
    }
  });

  it('Vorratsrabatt Art. 5033 ab 3,0 kg', () => {
    for (const kg of [3.0, 4.5, 10]) {
      const tier = resolveHackfleischTier(kg);
      assert.equal(tier.artNr, '5033');
      assert.equal(tier.pricePerKg, 22.99);
      assert.match(tier.badge, /3/);
    }
  });

  it('applyHackfleischTier setzt Preis und Artikelnummer dynamisch', () => {
    const product = findProductById('gal-hack');
    assert.ok(product);
    assert.equal(product.artNr, '503');
    assert.ok(isHackfleischProduct(product));

    const small = applyHackfleischTier(product, 1.0);
    assert.equal(small.artNr, '503');
    assert.equal(estimateLinePrice(small, { weightKg: 1.0 }), 26.99);

    const mid = applyHackfleischTier(product, 1.5);
    assert.equal(mid.artNr, '5031');
    assert.equal(estimateLinePrice(mid, { weightKg: 1.5 }), 37.49);

    const bulk = applyHackfleischTier(product, 3.0);
    assert.equal(bulk.artNr, '5033');
    assert.equal(estimateLinePrice(bulk, { weightKg: 3.0 }), 68.97);
  });
});

describe('orderCatalog Filet-Margenschutz', () => {
  it('Filet am Stück (501) hat nur Ganz/Halb – keinen Männercut', () => {
    const product = findProductById('gal-filet');
    assert.ok(product);
    assert.equal(product.artNr, '501');
    assert.equal(product.pricePerKg, 109.99);
    const ids = (product.cutOptions || []).map((c) => c.id);
    assert.deepEqual(ids, ['ganz', 'halb']);
    assert.ok(!ids.includes('4cm') && !ids.includes('maennercut'));
  });

  it('Filet Tournedos (500) bietet Klassisch und Männercut 4 cm', () => {
    const product = findProductById('gal-filet-tournedos');
    assert.ok(product);
    assert.equal(product.artNr, '500');
    assert.equal(product.pricePerKg, 139.99);
    const ids = (product.cutOptions || []).map((c) => c.id);
    assert.deepEqual(ids, ['klassisch', 'maennercut']);
  });

  it('Männercut am Filet am Stück ist nicht wählbar / Validierung nutzt Ganz-Mindestgewicht', () => {
    const product = findProductById('gal-filet');
    const ok = validateCutSelection(product, { cutId: 'ganz', weightKg: 2.0 });
    assert.equal(ok.ok, true);
    const tooLight = validateCutSelection(product, { cutId: 'ganz', weightKg: 1.0 });
    assert.equal(tooLight.ok, false);
  });

  it('BioOffice-Kernartikelnummern sind gesetzt', () => {
    const expected = {
      'gal-hack': '503',
      'gal-filet-tournedos': '500',
      'gal-filet': '501',
      'gal-filet-spitze': '499',
      'gal-rumpsteak': '502',
      'gal-entrecote': '514',
      'gal-rouladen': '505',
      'gal-gulasch': '504',
      'sw-schnitzel': '550',
      'sw-kotelett': '552',
      'sw-filet': '554',
      'sw-krustenbraten': '556',
      'huhn-brust': '590',
      'huhn-keulen': '591',
      'huhn-ganz': '597',
      'huhn-suppe': '598',
      'ws-kochschinken': '655',
      'ws-gal-kochschinken': '611',
      'ws-roastbeef': '660',
      'ws-fleischwurst': '420',
    };
    for (const [id, artNr] of Object.entries(expected)) {
      const product = findProductById(id);
      assert.ok(product, `missing ${id}`);
      assert.equal(product.artNr, artNr, `${id} artNr`);
    }
  });
});
