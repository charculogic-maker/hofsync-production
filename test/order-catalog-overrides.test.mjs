/**
 * Hybrid-Katalog: Firestore-Overrides (isActive / promoPrice / promoText).
 */
import { strict as assert } from 'node:assert';
import {
  findProductById,
  getVisibleCatalog,
  applyProductOverride,
  firestoreOverrideToCatalogPatch,
  catalogOverrideToFirestoreFields,
  normalizeFirestoreCatalogOverride,
  hasPromoPrice,
} from '../web/orderCatalog.js';
import { mapArtNrOverridesToProductOverrides } from '../web/catalog-overrides-db.js';

describe('orderCatalog Firestore-Override-Merge', () => {
  it('blendet isActive=false aus dem Kundenkatalog aus', () => {
    const product = findProductById('gal-filet');
    const patch = firestoreOverrideToCatalogPatch(product, { isActive: false });
    const merged = applyProductOverride(product, patch);
    assert.equal(merged.active, false);
    const visible = getVisibleCatalog({ [product.id]: patch }, { includeInactive: false });
    const ids = visible.flatMap((c) => c.products.map((p) => p.id));
    assert.ok(!ids.includes('gal-filet'));
  });

  it('setzt promoPrice als Aktionspreis mit Streichpreis und Badge', () => {
    const product = findProductById('gal-hack');
    const patch = firestoreOverrideToCatalogPatch(product, {
      isActive: true,
      promoPrice: 19.99,
      promoText: 'Wochen-Aktion',
    });
    const merged = applyProductOverride(product, patch);
    assert.equal(merged.pricePerKg, 19.99);
    assert.equal(merged.originalPricePerKg, 26.99);
    assert.equal(merged.badge, 'Wochen-Aktion');
    assert.equal(hasPromoPrice(merged), true);
  });

  it('mappt artNr-Dokumente auf Produkt-IDs', () => {
    const byProduct = mapArtNrOverridesToProductOverrides({
      503: normalizeFirestoreCatalogOverride({ isActive: false, promoPrice: null, promoText: '' }),
      501: { isActive: true, promoPrice: 99.99, promoText: 'Filet-Deal' },
    });
    assert.equal(byProduct['gal-hack'].active, false);
    assert.equal(byProduct['gal-filet'].pricePerKg, 99.99);
    assert.equal(byProduct['gal-filet'].badge, 'Filet-Deal');
  });

  it('serialisiert interne Overrides zurück nach Firestore-Feldern', () => {
    const product = findProductById('hm-rinderfond');
    const fields = catalogOverrideToFirestoreFields(product, {
      active: true,
      estimatedPiecePrice: 4.9,
      badge: 'Aktion',
    });
    assert.equal(fields.isActive, true);
    assert.equal(fields.promoPrice, 4.9);
    assert.equal(fields.promoText, 'Aktion');
  });
});
