import { strict as assert } from 'node:assert';
import {
  BeffeCalcEngine,
  beffeImFePct,
  beffeImFleischEiweissRelativPct,
  beffeProduktProzentMM,
  finishedMassAfterLosses,
  verkaufspreisFromSelbstkosten,
} from '../web/beffe_calc.js';

// 1) BEFFE im FE % = ((FE - BEP) / FE) * 100
assert.equal(beffeImFePct(20, 4), ((20 - 4) / 20) * 100);
assert.equal(beffeImFleischEiweissRelativPct(16, 20), 80);

// 2) 0 g Fleisch / FE = 0 → null statt NaN
assert.equal(beffeImFePct(0, 0), null);
assert.equal(beffeImFePct(0, 3), null);
assert.equal(beffeImFleischEiweissRelativPct(0, 0), null);
assert.ok(Number.isNaN(0 / 0));

const emptyMeatEngine = new BeffeCalcEngine({
  rohstoffe: { 'Eis / Brühe': { preis: 0.05, wasser: 100, beffe: 0, be: 0, fe: 0, fett: 0 } },
  rezepte: {
    NurEis: {
      name: 'NurEis',
      category: 'Bruehwurst',
      baseTotalKg: 1,
      ingredients: [{ material: 'Eis / Brühe', amountKg: 1, percent: 100, basePriceKg: 0.05, category: 'Bruehwurst' }],
    },
  },
});
const emptyResult = emptyMeatEngine.calculateCharge('NurEis', 5);
assert.equal(emptyResult.totals.fleischG, 0);
assert.equal(emptyResult.totals.beffeImFeProzent, null);
assert.equal(Number.isNaN(emptyResult.totals.beffeImFeProzent), false);

const meatEngine = new BeffeCalcEngine({
  rohstoffe: { 'S I': { preis: 3.1, wasser: 69.3, beffe: 24.5, be: 1.1, fe: 25.6, fett: 5.1 } },
  rezepte: {
    S1: {
      name: 'S1',
      category: 'Kochwurst',
      baseTotalKg: 1,
      ingredients: [{ material: 'S I', amountKg: 1, percent: 100, basePriceKg: 3.1, category: 'Kochwurst' }],
    },
  },
});
const meatResult = meatEngine.calculateCharge('S1', 1);
assert.equal(meatResult.totals.beffeImFeProzent, ((25.6 - 1.1) / 25.6) * 100);
assert.equal(beffeProduktProzentMM(25.6, 1.1), 24.5);

// 3) VK = SK / (1 - Marge)
assert.equal(verkaufspreisFromSelbstkosten(5.5, 0.45), 5.5 / (1 - 0.45));
assert.equal(verkaufspreisFromSelbstkosten(10, 1), null);
assert.equal(verkaufspreisFromSelbstkosten(10, 0), 10);

// 4) Absoluter Maschinenverlust ≠ prozentualer Garverlust
// 10 kg − 0,2 kg Maschine, danach 10 % Garverlust → 8,82 kg
assert.equal(finishedMassAfterLosses(10, { maschinenverlustKg: 0.2, garverlustPct: 10 }), 9.8 * 0.9);
assert.notEqual(
  finishedMassAfterLosses(10, { maschinenverlustKg: 0.2, garverlustPct: 10 }),
  finishedMassAfterLosses(10, { maschinenverlustKg: 0, garverlustPct: 12 }),
);

const priced = meatEngine.calculateCharge('S1', 10, {}, { maschinenverlustKg: 0.2, garverlustPct: 10, marginFrac: 0.4 });
assert.equal(priced.totals.finishedKg, 9.8 * 0.9);
assert.equal(priced.totals.vkProKg, priced.totals.costPerKgFinished / (1 - 0.4));

const viaPct = meatEngine.calculateCharge('S1', 10, {}, { marginPct: 35 });
assert.equal(viaPct.totals.vkProKg, viaPct.totals.costPerKgFinished / (1 - 0.35));
const defaultVk = meatEngine.calculateCharge('S1', 10);
assert.equal(defaultVk.totals.vkProKg, defaultVk.totals.costPerKgFinished);

console.log('beffe-calc campus SSOT tests ok');
