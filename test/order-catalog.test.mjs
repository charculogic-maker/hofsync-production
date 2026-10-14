import { strict as assert } from 'node:assert';
import {
  estimateLinePrice,
  estimateSelectionWeightKg,
  findProductById,
} from '../web/orderCatalog.js';

const rumpsteak = findProductById('gal-rumpsteak');
assert.ok(rumpsteak, 'Rumpsteak must exist in the preorder catalog');

const staleDefaultWeight = estimateSelectionWeightKg(rumpsteak, { pieces: 4, weightKg: 0.56 });
assert.equal(staleDefaultWeight, 1.12);
assert.equal(estimateLinePrice(rumpsteak, { pieces: 4, weightKg: 0.56 }), 73.91);

const explicitHeavierWeight = estimateSelectionWeightKg(rumpsteak, { pieces: 4, weightKg: 1.4 });
assert.equal(explicitHeavierWeight, 1.4);
assert.equal(estimateLinePrice(rumpsteak, { pieces: 4, weightKg: 1.4 }), 92.39);

console.log('order catalog estimate tests ok');
