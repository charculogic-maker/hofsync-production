import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.document = {
  getElementById: () => null,
};
globalThis.window = {
  addEventListener: () => {},
  dispatchEvent: () => {},
  showToast: () => {},
  BRANDING: {},
};
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
};

const {
  getProductCategory,
  matchesMhdMonitorHorizon,
} = await import('../web/mhd.js');

test('keeps explicit Trockenware category for MHD monitor horizon', () => {
  const product = {
    kategorie: '📦 Trockenware',
    produkt: 'Naturjoghurt im Probierpaket',
    tage: 14,
  };

  assert.equal(getProductCategory(product), '📦 Trockenware');
  assert.equal(matchesMhdMonitorHorizon(product), true);
});

test('infers MoPro only when no category is stored', () => {
  const product = {
    produkt: 'Naturjoghurt 500g',
    tage: 14,
  };

  assert.equal(getProductCategory(product), '🥛MoPro');
  assert.equal(matchesMhdMonitorHorizon(product), false);
});

test('infers Trockenware for uncategorized dry goods', () => {
  const product = {
    produkt: 'Dinkel Nudeln',
    tage: 14,
  };

  assert.equal(getProductCategory(product), '📦 Trockenware');
  assert.equal(matchesMhdMonitorHorizon(product), true);
});
