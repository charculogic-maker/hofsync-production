import { describe, it } from 'mocha';
import { expect } from 'chai';
import {
  DISPLAY_NAME,
  ENABLED_MODULES,
  TENANT_ID,
  buildHaccpLogs,
  buildMhdItems,
  buildShowcaseRecipe,
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

  it('builds the DLS Schinkenwurst recipe at 30 kg', () => {
    const recipe = buildShowcaseRecipe(TENANT_ID).data;
    expect(recipe.name).to.include('Schinkenwurst');
    expect(recipe.chargeKg).to.equal(30);
    expect(recipe.material).to.deep.equal([
      { name: 'S II Magerfleisch', kg: 15, typ: 'base' },
      { name: 'S IV Speck', kg: 7.5, typ: 'base' },
      { name: 'Eisschüttung', kg: 7.5, typ: 'spice' },
    ]);
    expect(recipe.kpis.beffeIst).to.equal(12.8);
    expect(recipe.kpis.beffeSoll).to.equal(11.0);
    expect(recipe.kpis.kutterEndTempMax).to.equal(12.0);
    expect(recipe.kpis.coreTempTarget).to.equal(72);
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
