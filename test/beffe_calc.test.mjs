import assert from 'node:assert/strict';
import {
  BeffeCalcEngine,
  applyYieldLosses,
  calcVkFromSk,
  calculateBeffeImFePercent,
  calculateMarginPricing,
} from '../web/beffe_calc.js';

function testBeffeImFePercent() {
  assert.equal(calculateBeffeImFePercent(100, 20), 80);
  assert.equal(calculateBeffeImFePercent(250, 50), 80);
  assert.equal(calculateBeffeImFePercent(0, 0), null);
  assert.equal(calculateBeffeImFePercent(0, 10), null);
  assert.equal(calculateBeffeImFePercent(-5, 1), null);
  assert.equal(calculateBeffeImFePercent(100, 0), 100);
}

function testMarginFormula() {
  assert.equal(calcVkFromSk(7, 0.3), 10);
  assert.equal(calcVkFromSk(10, 0.25), 13.333333333333334);
  assert.equal(calcVkFromSk(10, 1), null);
  assert.equal(calcVkFromSk(-1, 0.2), null);
}

function testYieldLossSeparation() {
  const result = applyYieldLosses({
    inputKg: 10,
    maschinenverlustG: 500,
    garverlustProzent: 10,
  });

  assert.equal(result.afterMaschinenverlustKg, 9.5);
  assert.equal(result.outputKg, 8.55);
  assert.equal(result.maschinenverlustG, 500);
  assert.equal(result.garverlustProzent, 10);
}

function testMarginPricingChain() {
  const result = calculateMarginPricing({
    sk: 5,
    margin: 0.25,
    inputKg: 10,
    maschinenverlustG: 1000,
    garverlustProzent: 0,
  });

  assert.equal(result.outputKg, 9);
  assert.equal(result.adjustedSk, 5.555555555555555);
  assert.equal(result.vk, 7.407407407407407);
}

function testChargeBeffeImFeFromEngine() {
  const engine = new BeffeCalcEngine({
    rohstoffe: {
      'S I': { preis: 3.1, wasser: 69.3, beffe: 24.5, be: 1.1, fett: 5.1 },
    },
    rezepte: {
      Probe: {
        name: 'Probe',
        category: 'Kochwurst',
        baseTotalKg: 1,
        ingredients: [{
          material: 'S I',
          amountKg: 1,
          percent: 100,
          basePriceKg: 3.1,
          category: 'Kochwurst',
        }],
      },
    },
  });

  const charge = engine.calculateCharge('Probe', 1);
  assert.equal(charge.totals.feG, 256);
  assert.ok(Math.abs(charge.totals.bepG - 11) < 0.001);
  assert.equal(charge.totals.beffeImFePercent, calculateBeffeImFePercent(256, 11));

  const zeroMeat = new BeffeCalcEngine({
    rohstoffe: {
      Wasser: { preis: 0.05, wasser: 100, beffe: 0, be: 0, fett: 0 },
    },
    rezepte: {
      NurWasser: {
        name: 'NurWasser',
        category: 'Kochwurst',
        baseTotalKg: 1,
        ingredients: [{
          material: 'Wasser',
          amountKg: 1,
          percent: 100,
          basePriceKg: 0.05,
          category: 'Kochwurst',
        }],
      },
    },
  }).calculateCharge('NurWasser', 1);

  assert.equal(zeroMeat.totals.beffeImFePercent, null);
}

function run() {
  testBeffeImFePercent();
  testMarginFormula();
  testYieldLossSeparation();
  testMarginPricingChain();
  testChargeBeffeImFeFromEngine();
  console.log('beffe_calc tests: OK');
}

run();
