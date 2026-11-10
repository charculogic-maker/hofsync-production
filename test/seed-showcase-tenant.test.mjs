import { describe, it } from 'mocha';
import { expect } from 'chai';
import {
  DISPLAY_NAME,
  ENABLED_MODULES,
  MEISTER_STARTER_RECIPES,
  TENANT_ID,
  buildHaccpLogs,
  buildMhdItems,
  buildShowcaseRecipe,
  buildShowcaseRecipes,
  buildWareneingang,
} from '../tools/seed-showcase-tenant.mjs';

describe('seed-showcase-tenant builders', () => {
  it('targets the Musterbetrieb tenant with all core modules', () => {
    expect(TENANT_ID).to.equal('test_auto_seed');
    expect(DISPLAY_NAME).to.equal('Fleischerei & Hofladen Musterbetrieb');
    expect(ENABLED_MODULES.mhd).to.equal(true);
    expect(ENABLED_MODULES.receiving).to.equal(true);
    expect(ENABLED_MODULES.kitchen).to.equal(true);
    expect(ENABLED_MODULES.haccp).to.equal(true);
    expect(ENABLED_MODULES.knowledge).to.equal(true);
    expect(ENABLED_MODULES.buero).to.equal(true);
    expect(ENABLED_MODULES.chargenDoku).to.equal(true);
  });

  it('builds MHD ampel showcase rows', () => {
    const rows = buildMhdItems(TENANT_ID);
    expect(rows).to.have.length(4);
    expect(rows.map((row) => row.data.status)).to.deep.equal(['ok', 'rabatt', 'kueche', 'ok']);
    expect(rows.map((row) => row.data.resttage)).to.deep.equal([4, 1, 0, 45]);
    expect(rows[0].data.name).to.include('Bratwurst');
    expect(rows[2].data.kuecheAngefragt).to.equal(true);
    expect(rows[1].data.rabattiert).to.equal(true);
  });

  it('builds seven Meister starter recipes with neutral cuts', () => {
    expect(MEISTER_STARTER_RECIPES).to.have.length(7);
    const recipes = buildShowcaseRecipes(TENANT_ID);
    expect(recipes).to.have.length(7);
    expect(recipes.map((row) => row.id)).to.deep.equal([
      'rezept_feine_schinkenwurst',
      'rezept_rostbratwurst_grob',
      'rezept_muenchner_weisswurst',
      'rezept_bierwurst_dls',
      'rezept_leberwurst_delikatess',
      'rezept_rotwurst_thueringer',
      'rezept_rinder_hackfleisch',
    ]);
    const schinken = recipes[0].data;
    expect(schinken.name).to.include('Schinkenwurst');
    expect(schinken.chargeKg).to.equal(30);
    expect(schinken.meat).to.deep.equal([
      { cut: 'S II', kg: 15 },
      { cut: 'S IV', kg: 7.5 },
    ]);
    expect(schinken.waterIceKg).to.equal(7.5);
    expect(schinken.kpis.beffeIst).to.equal(12.8);
    expect(schinken.kpis.beffeSoll).to.equal(11.0);
    expect(schinken.kpis.cutterEndTempMax).to.equal(12.0);
    expect(schinken.kpis.coreTempTarget).to.equal(72.0);
    expect(buildShowcaseRecipe(TENANT_ID).id).to.equal('rezept_feine_schinkenwurst');
    const flat = JSON.stringify(recipes);
    expect(flat).to.not.match(/Galloway/i);
  });

  it('builds three HACCP temperature logs by Paddy', () => {
    const logs = buildHaccpLogs(TENANT_ID);
    expect(logs).to.have.length(3);
    expect(logs.map((row) => row.data.deviceName)).to.deep.equal(['Kühlhaus', 'Frischetheke', 'TK']);
    expect(logs.map((row) => row.data.wert)).to.deep.equal([1.4, 2.8, -19.2]);
    expect(logs.every((row) => row.data.doneBy === 'Paddy (Meister)')).to.equal(true);
  });

  it('builds a showcase wareneingang delivery', () => {
    const delivery = buildWareneingang(TENANT_ID).data;
    expect(delivery.lieferant).to.include('Muster');
    expect(delivery.items).to.have.length(2);
  });
});
