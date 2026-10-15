/**
 * Bestellportal Feinschliff (Task 6b-3): Wording, Handwerks-Logik, TK-Option.
 */
import { strict as assert } from 'node:assert';
import {
  findProductById,
  PRODUCT_STATE_OPTIONS,
  PRODUCT_STATE_HINT,
} from '../web/orderCatalog.js';

describe('orderCatalog Feinschliff 6b-3', () => {
  it('enthält nirgends mehr das Wording „Männercut“', () => {
    const products = [
      'gal-rumpsteak', 'gal-entrecote', 'gal-filet-tournedos', 'gal-hueftsteak', 'gal-flat-iron',
    ].map((id) => findProductById(id));
    for (const product of products) {
      assert.ok(product, 'product missing');
      for (const cut of product.cutOptions || []) {
        assert.ok(!/Männercut/i.test(cut.label || ''), `${product.id}: ${cut.label}`);
      }
      assert.ok(!/Männercut/i.test(product.subtitle || ''), product.id);
    }
  });

  it('Rouladen (505) nutzen Aufschnitt-Stufen statt Breiter Schnitt', () => {
    const product = findProductById('gal-rouladen');
    assert.equal(product.artNr, '505');
    const labels = (product.cutOptions || []).map((c) => c.label);
    assert.deepEqual(labels, ['Klassisch (Stufe 4,5)', 'Dicker geschnitten']);
  });

  it('Schnitzel (550) hat kein Plattieren', () => {
    const product = findProductById('sw-schnitzel');
    assert.equal(product.artNr, '550');
    const labels = (product.cutOptions || []).map((c) => c.label);
    assert.deepEqual(labels, ['Klassisch geschnitten']);
    assert.ok(!labels.some((l) => /Plattiert/i.test(l)));
  });

  it('Braten nur am Stück – keine Scheiben-Option', () => {
    for (const id of ['gal-schmorbraten', 'gal-braten-keule', 'sw-krustenbraten', 'gal-tafelspitz']) {
      const product = findProductById(id);
      assert.ok(product, id);
      const labels = (product.cutOptions || []).map((c) => c.label);
      assert.ok(labels.every((l) => /Am Stück/i.test(l)), `${id}: ${labels.join(',')}`);
      assert.ok(!labels.some((l) => /Scheiben/i.test(l)), id);
    }
  });

  it('Ganzes Weidehähnchen (597) nur Im Ganzen', () => {
    const product = findProductById('huhn-ganz');
    assert.equal(product.artNr, '597');
    assert.deepEqual((product.cutOptions || []).map((c) => c.label), ['Im Ganzen']);
  });

  it('stellt Frisch/TK-Zustandsoptionen bereit', () => {
    assert.deepEqual(
      PRODUCT_STATE_OPTIONS.map((o) => o.id),
      ['frisch', 'tk'],
    );
    assert.match(PRODUCT_STATE_HINT, /TK/);
  });
});
