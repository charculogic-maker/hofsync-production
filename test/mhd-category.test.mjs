import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getProductCategory,
  matchesMhdMonitorHorizon,
} from '../web/mhd.js';

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
