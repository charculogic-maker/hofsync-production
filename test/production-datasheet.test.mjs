/**
 * Unit tests for DIN-A4 Produktionsdatenblatt (Recipe-to-Print, QUID/LMIV, 16-kg scale).
 */
import { describe, it } from 'mocha';
import { expect } from 'chai';
import {
  MACHINE_BATCH_PROFILES,
  STANDARD_BATCH_PROFILE_ID,
  buildLmivLabel,
  buildProductionDatasheetData,
  classifyIngredient,
  computeQuidValues,
  formatDeNumber,
  getMachineBatchProfile,
  renderProductionDatasheetHtml,
  scaleDatasheetToTargetKg,
  scaleIngredientWeightKg,
} from '../web/production-datasheet.js';

const GALLOWAY_BRATWURST = {
  id: 'G-BW-MIX',
  name: 'Frische Bratwurst vom Galloway',
  kat: 'frische Bratwurst',
  version: '2.0',
  allergene: ['SENF'],
  anweisung_A: 'Rohstoffe auf 0 bis 2 Grad C kuehlen.',
  ingredients: [
    { name: 'Bio-Galloway R II', pct: 52, typ: 'base', hinweis: '0–2 °C' },
    { name: 'Bio-Schweinefleisch S II', pct: 22, typ: 'base', hinweis: '0–2 °C' },
    { name: 'Bio-Speck', pct: 18, typ: 'base', hinweis: 'leicht anfrosten' },
    { name: 'eiskaltes Wasser', pct: 5, typ: 'spice', hinweis: 'Trinkwasserqualität' },
    { name: 'Meersalz fein', pct: 1.8, typ: 'spice' },
    { name: 'Natriumcarbonate', pct: 0.3, typ: 'additive' },
    { name: 'Senfmehl', pct: 0.4, typ: 'spice', allergen: true },
    { name: 'Pfeffer weiß', pct: 0.3, typ: 'spice' },
    { name: 'Thymian', pct: 0.2, typ: 'spice' },
  ],
};

const PROFILE_16 = getMachineBatchProfile(STANDARD_BATCH_PROFILE_ID);

describe('production datasheet mapping', () => {
  it('exposes the Alexanderwerk / OSKAR 20 16 kg standard-charge profile', () => {
    expect(PROFILE_16).to.include({
      targetKg: 16,
      cutterType: 'Alexanderwerk 3-Sichel (M1: 1500 U/min, M2: 3000 U/min)',
      fillerType: 'OSKAR 20 (20 Liter)',
    });
    expect(MACHINE_BATCH_PROFILES.length).to.be.at.least(4);
  });

  it('maps recipe data onto ProductionDatasheetData fields', () => {
    const sheet = buildProductionDatasheetData(GALLOWAY_BRATWURST, {
      targetKg: 16,
      machineProfile: PROFILE_16,
      createdBy: 'StevesHof Hofladen',
      now: new Date('2026-09-13T08:00:00Z'),
    });

    expect(sheet.meta.recipeName).to.equal('Frische Bratwurst vom Galloway');
    expect(sheet.meta.productCategory).to.match(/Bratwurst/i);
    expect(sheet.meta.leitsatzNr).to.equal('2.221');
    expect(sheet.meta.version).to.equal('2.0');
    expect(sheet.meta.createdBy).to.equal('StevesHof Hofladen');
    expect(sheet.meta.dateLabel).to.match(/\d{2}\.\d{2}\.\d{4}/);

    expect(sheet.machines.cutterType).to.include('Alexanderwerk');
    expect(sheet.machines.fillerType).to.include('OSKAR 20');
    expect(sheet.machines.targetYieldKg).to.equal(16);
    expect(sheet.machines.pieceCount).to.equal(136);
    expect(sheet.machines.yieldLabel).to.include('118');

    expect(sheet.meat).to.have.length(3);
    expect(sheet.meat[0]).to.include.keys('name', 'class', 'weightKg', 'percentage', 'conditioning');
    expect(sheet.spices.some((row) => row.name === 'Natriumcarbonate')).to.equal(true);
    expect(sheet.kpis).to.include.keys('beffe', 'wev', 'waterAdditionPercent', 'targetPh', 'coreTempTarget');
    expect(sheet.haccp.length).to.be.at.least(4);
    expect(sheet.haccp.every((row) => row.limit && row.auditField)).to.equal(true);
  });
});

describe('16 kg scaling', () => {
  it('scales meat, water and spice weights to the 16 kg Alexanderwerk charge', () => {
    const at10 = buildProductionDatasheetData(GALLOWAY_BRATWURST, { targetKg: 10, machineProfile: PROFILE_16 });
    const at16 = buildProductionDatasheetData(GALLOWAY_BRATWURST, { targetKg: 16, machineProfile: PROFILE_16 });
    const galloway10 = at10.meat.find((row) => row.quidGroup === 'galloway');
    const galloway16 = at16.meat.find((row) => row.quidGroup === 'galloway');

    expect(galloway10.weightKg).to.be.closeTo(5.2, 1e-9);
    expect(galloway16.weightKg).to.be.closeTo(8.32, 1e-9);
    expect(galloway16.percentage).to.equal(galloway10.percentage);

    const salt10 = at10.spices.find((row) => /meersalz/i.test(row.name));
    const salt16 = at16.spices.find((row) => /meersalz/i.test(row.name));
    expect(salt16.weightTotal).to.be.closeTo(salt10.weightTotal * 1.6, 1e-9);
    expect(salt16.dosePerKg).to.be.closeTo(18, 1e-9);

    const waterRows = at16.spices.filter((row) => row.bucket === 'water');
    expect(waterRows).to.have.length(1);
    expect(waterRows[0].weightTotal).to.be.closeTo(0.8, 1e-9);
    expect(at16.kpis.waterAdditionPercent).to.be.closeTo(5, 1e-9);

    const scaled = scaleDatasheetToTargetKg(at10, 16);
    expect(scaled.meat[0].weightKg).to.be.closeTo(at16.meat[0].weightKg, 1e-9);
    expect(scaleIngredientWeightKg(52, 16)).to.be.closeTo(8.32, 1e-9);
  });
});

describe('QUID and LMIV label', () => {
  it('classifies Galloway, pork and bacon as QUID meat groups', () => {
    expect(classifyIngredient({ name: 'Bio-Galloway R II', pct: 52, typ: 'base' }).quidGroup).to.equal('galloway');
    expect(classifyIngredient({ name: 'Bio-Schweinefleisch S II', pct: 22, typ: 'base' }).quidGroup).to.equal('schwein');
    expect(classifyIngredient({ name: 'Bio-Speck', pct: 18, typ: 'base' }).quidGroup).to.equal('speck');
    expect(classifyIngredient({ name: 'Natriumcarbonate', pct: 0.3, typ: 'additive' }).function).to.equal('Säureregulator');
  });

  it('computes QUID percents of total mass and a descending LMIV list', () => {
    const sheet = buildProductionDatasheetData(GALLOWAY_BRATWURST, {
      targetKg: 16,
      machineProfile: PROFILE_16,
    });
    const quid = computeQuidValues(sheet.meat);
    const byId = Object.fromEntries(quid.map((item) => [item.id, item.percentage]));
    expect(byId.galloway).to.be.closeTo(52, 1e-9);
    expect(byId.schwein).to.be.closeTo(22, 1e-9);
    expect(byId.speck).to.be.closeTo(18, 1e-9);

    expect(sheet.lmiv.ingredientsText).to.match(/^Zutaten:/);
    expect(sheet.lmiv.ingredientsText.indexOf('Bio-Galloway-Rindfleisch'))
      .to.be.lessThan(sheet.lmiv.ingredientsText.indexOf('Bio-Schweinefleisch'));
    expect(sheet.lmiv.ingredientsText.indexOf('Bio-Schweinefleisch'))
      .to.be.lessThan(sheet.lmiv.ingredientsText.indexOf('Bio-Speck'));
    expect(sheet.lmiv.ingredientsText).to.match(/Bio-Galloway-Rindfleisch\*.*\(52,0 %\)/);
    expect(sheet.lmiv.ingredientsText).to.match(/Bio-Schweinefleisch\*.*\(22,0 %\)/);
    expect(sheet.lmiv.ingredientsText).to.match(/Bio-Speck\*.*\(18,0 %\)/);
    expect(sheet.lmiv.ingredientsText).to.include('Säureregulator: Natriumcarbonate');
    expect(sheet.lmiv.ingredientsText).to.include('*');
    expect(sheet.lmiv.allergenText).to.match(/SENF/);
    expect(sheet.lmiv.bioFootnote).to.match(/biologischer Landwirtschaft/);

    const rebuilt = buildLmivLabel(GALLOWAY_BRATWURST, sheet.meat, sheet.spices, sheet.lmiv.quid);
    expect(rebuilt.ingredientsHtml).to.match(/<strong>Senfmehl<\/strong>/);
    expect(rebuilt.allergenHtml).to.match(/<strong>SENF<\/strong>/);
  });
});

describe('print renderer', () => {
  it('renders a 2-page DIN A4 document with print rules and no-print chrome', () => {
    const sheet = buildProductionDatasheetData(GALLOWAY_BRATWURST, {
      targetKg: 16,
      machineProfile: PROFILE_16,
      createdBy: 'StevesHof Hofladen',
      now: new Date('2026-09-13T08:00:00Z'),
      autoPrint: false,
    });
    const html = renderProductionDatasheetHtml(sheet, { autoPrint: false });

    expect(html).to.include('size: A4 portrait');
    expect(html).to.include('print-color-adjust: exact');
    expect(html).to.include('no-print');
    expect(html).to.include('datasheet-page-1');
    expect(html).to.include('datasheet-page-2');
    expect(html).to.include('Alexanderwerk');
    expect(html).to.include('OSKAR 20');
    expect(html).to.include('16,0 kg');
    expect(html).to.include('StevesHof Hofladen');
    expect(html).to.include('Säureregulator: Natriumcarbonate');
    expect(html).to.include('CCP 1');
    expect(html.match(/class="sheet"/g)).to.have.length(2);
    expect(formatDeNumber(16, 1)).to.equal('16,0');
  });
});

describe('Bio-Galloway Rostbrat- & Currywurst (SH-BGW-160)', () => {
  const ROSTBRATWURST = {
    id: 'SH-BGW-160',
    name: 'Bio-Galloway Rostbrat- & Currywurst',
    kat: 'Brühwurst',
    produktgattung: 'Rostbratwurst & Currywurst',
    leitsatzNr: '2.221.03',
    version: '1.0',
    pieceWeightG: 118,
    cutterType: 'Alexanderwerk 3-Sichel (M1: 1500 U/min, M2: 3000 U/min)',
    fillerType: 'OSKAR 20 (20 Liter)',
    zertifizierung: 'Bio (DE-ÖKO-006, nps-frei, phosphatfrei)',
    kpis: {
      beffe: 8.5,
      wev: 4.0,
      targetPh: 6.05,
      targetPhRange: '5,9–6,2',
      coreTempTarget: 70,
      coreTempLabel: 'Kerntemperatur-Soll Brühen 68–70 °C',
      kutterEndTempMax: 11,
      fatPercentRange: '24–26 %',
    },
    anweisung_D: 'Zwei-Stufen-Garen: Brühen dann Pasteurisieren.',
    ingredients: [
      { name: 'Bio-Galloway mager (dry-aged, hofeigen)', pct: 30, typ: 'base', hinweis: '3 mm gewolft, flachgefroren (−18 °C)' },
      { name: 'Bio-Schweinefleisch mager (Zukauf DE-ÖKO-006)', pct: 25, typ: 'base', hinweis: '3 mm gewolft, flachgefroren (−18 °C)' },
      { name: 'Bio-Schweinerückenspeck kernig (Zukauf DE-ÖKO-006)', pct: 25, typ: 'base', hinweis: '3 mm gewolft, flachgefroren (−18 °C)' },
      { name: 'Crushed Ice / Flacheisschollen', pct: 10, typ: 'spice', hinweis: 'Crushed Ice oder dünne Flacheisschollen' },
      { name: 'Eiswasser (Trinkwasser)', pct: 10, typ: 'spice', hinweis: '0–1 °C, Direktzugabe' },
      { name: 'Meersalz (unbehandelt, fein)', pct: 1.8, typ: 'spice', funktion: 'Geschmack & Eiweißquellung' },
      { name: 'BIO Kutterpower OH AF (NovaTaste / WIBERG)', pct: 0.25, typ: 'additive', funktion: 'pH-Puffer & Eiweißaufschluss (Citratbasis)' },
      { name: 'BIO Tex Pure (NovaTaste / WIBERG)', pct: 0.8, typ: 'additive', funktion: 'Knack, Hitzestabilität & Geleeschutz (Bockshornklee-Galactomannane)' },
      { name: 'BIO Pfeffer weiß gemahlen (WIBERG)', pct: 0.3, typ: 'spice', funktion: 'Grundschärfe (helle Optik)' },
    ],
  };

  it('exposes 8/12/16/20 kg Alexanderwerk Schnellwahl profiles', () => {
    expect(getMachineBatchProfile('alexanderwerk-oskar20-8')?.targetKg).to.equal(8);
    expect(getMachineBatchProfile('alexanderwerk-oskar20-12')?.targetKg).to.equal(12);
    expect(getMachineBatchProfile(STANDARD_BATCH_PROFILE_ID)?.targetKg).to.equal(16);
    expect(getMachineBatchProfile('alexanderwerk-oskar20-20')?.targetKg).to.equal(20);
    expect(MACHINE_BATCH_PROFILES.some((profile) => profile.targetKg === 10)).to.equal(true);
  });

  it('scales fleisch and spices to 8/12/16 kg and wires datasheet metadata', () => {
    const at8 = buildProductionDatasheetData(ROSTBRATWURST, { targetKg: 8, machineProfile: PROFILE_16 });
    const at12 = buildProductionDatasheetData(ROSTBRATWURST, { targetKg: 12, machineProfile: PROFILE_16 });
    const at16 = buildProductionDatasheetData(ROSTBRATWURST, { targetKg: 16, machineProfile: PROFILE_16 });

    expect(at16.meta.recipeId).to.equal('SH-BGW-160');
    expect(at16.meta.leitsatzNr).to.equal('2.221.03');
    expect(at16.meta.productCategory).to.match(/Rostbratwurst/i);
    expect(at16.meta.zertifizierung).to.match(/DE-ÖKO-006/);
    expect(at16.machines.pieceWeightG).to.equal(118);
    expect(at16.machines.pieceCount).to.equal(136);
    expect(at16.machines.cutterType).to.include('1500');
    expect(at16.machines.fillerType).to.include('OSKAR 20');

    const galloway8 = at8.meat.find((row) => row.quidGroup === 'galloway');
    const galloway16 = at16.meat.find((row) => row.quidGroup === 'galloway');
    expect(galloway8.weightKg).to.be.closeTo(2.4, 1e-9);
    expect(galloway16.weightKg).to.be.closeTo(4.8, 1e-9);
    expect(at12.meat.find((row) => row.quidGroup === 'speck').weightKg).to.be.closeTo(3.0, 1e-9);

    const salt16 = at16.spices.find((row) => /meersalz/i.test(row.name));
    expect(salt16.dosePerKg).to.be.closeTo(18, 1e-9);
    expect(salt16.weightTotal).to.be.closeTo(0.288, 1e-9);
    expect(salt16.function).to.include('Eiweißquellung');

    const tex = at16.spices.find((row) => /tex\s*pure/i.test(row.name));
    expect(tex.function).to.match(/Knack|Hitzestabilität/i);
    expect(at16.kpis.waterAdditionPercent).to.be.closeTo(20, 1e-9);
    expect(at16.kpis.beffe).to.equal(8.5);
    expect(at16.kpis.wev).to.equal(4.0);
    expect(at16.kpis.targetPhRange).to.equal('5,9–6,2');
    expect(at16.haccp.some((row) => /11,0/.test(row.limit))).to.equal(true);
    expect(at16.sopHint).to.match(/Zwei-Stufen-Garen/);
  });
});
