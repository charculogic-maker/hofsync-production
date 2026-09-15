import { expect } from 'chai';
import {
  MHD_CANONICAL_CATEGORY_LABELS,
  detectCategoryFromKeywords,
  ensureCategoryInList,
} from '../web/mhd-category-rules.js';

describe('MHD Kategorie-Keyword-Erkennung', () => {
  it('ordnet MoPro-Keywords zu', () => {
    expect(detectCategoryFromKeywords('Bio Joghurt Natur')).to.equal(MHD_CANONICAL_CATEGORY_LABELS.mopro);
    expect(detectCategoryFromKeywords('Mozzarella Kugel')).to.equal(MHD_CANONICAL_CATEGORY_LABELS.mopro);
    expect(detectCategoryFromKeywords('Frischmilch 3,5%')).to.equal(MHD_CANONICAL_CATEGORY_LABELS.mopro);
    expect(detectCategoryFromKeywords('Magerquark')).to.equal(MHD_CANONICAL_CATEGORY_LABELS.mopro);
  });

  it('ordnet Süßwaren zu und legt Tag an', () => {
    expect(detectCategoryFromKeywords('Vollmilch Schokolade')).to.equal(MHD_CANONICAL_CATEGORY_LABELS.suesswaren);
    expect(detectCategoryFromKeywords('Nuss-Riegel')).to.equal(MHD_CANONICAL_CATEGORY_LABELS.suesswaren);
    expect(detectCategoryFromKeywords('Butterkeks')).to.equal(MHD_CANONICAL_CATEGORY_LABELS.suesswaren);
  });

  it('ordnet Konserven zu', () => {
    expect(detectCategoryFromKeywords('Tomaten Passata Dose')).to.equal(MHD_CANONICAL_CATEGORY_LABELS.konserven);
    expect(detectCategoryFromKeywords('Geflügel im Glas')).to.equal(MHD_CANONICAL_CATEGORY_LABELS.konserven);
  });

  it('ordnet Fleisch/Wurst, Feinkost und Getränke zu', () => {
    expect(detectCategoryFromKeywords('Bio Salami')).to.equal(MHD_CANONICAL_CATEGORY_LABELS.fleischWurst);
    expect(detectCategoryFromKeywords('Oliven Antipasti')).to.equal(MHD_CANONICAL_CATEGORY_LABELS.feinkost);
    expect(detectCategoryFromKeywords('Apfelsaft Schorle')).to.equal(MHD_CANONICAL_CATEGORY_LABELS.getraenke);
  });

  it('gibt null zurück ohne Treffer', () => {
    expect(detectCategoryFromKeywords('Unbekanntes XYZ Produkt')).to.equal(null);
  });

  it('stellt fehlende Kategorien in der Liste sicher', () => {
    const next = ensureCategoryInList(
      [{ value: MHD_CANONICAL_CATEGORY_LABELS.mopro, label: 'MoPro' }],
      MHD_CANONICAL_CATEGORY_LABELS.konserven,
    );
    expect(next.some((entry) => entry.value === MHD_CANONICAL_CATEGORY_LABELS.konserven)).to.equal(true);
    expect(next).to.have.length(2);
  });
});
