/**
 * Laden-Nav: max. 5 Primärslots — MHD · Neu · Packtisch · Herkunft · Mehr.
 */
import { expect } from 'chai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACCESS_MODULE_TO_TAB,
  resolveAccessModules,
  DEFAULT_ROLE_MODULE_DEFAULTS,
} from '../web/tenant-modules.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('Laden-Nav max. 5', () => {
  const html = read('web/index.html');
  const app = read('web/app.js');
  const sw = read('web/sw.js');

  it('ordnet Primärtabs MHD · Neu · Packtisch · Herkunft vor Mehr', () => {
    const scrollMatch = html.match(/id="bottom-nav-scroll"([\s\S]*?)<\/div>\s*<div class="app-nav-zone app-nav-zone--admin/);
    expect(scrollMatch, 'bottom-nav-scroll block').to.be.ok;
    const block = scrollMatch[1];
    const mhd = block.indexOf('data-tab="mhd"');
    const neu = block.indexOf('data-tab="receiving"');
    const pack = block.indexOf('data-tab="orders"');
    const doku = block.indexOf('data-tab="chargenDoku"');
    const mehr = block.indexOf('id="mehr-nav-accordion"');
    expect(mhd).to.be.greaterThan(-1);
    expect(neu).to.be.greaterThan(mhd);
    expect(pack).to.be.greaterThan(neu);
    expect(doku).to.be.greaterThan(pack);
    expect(mehr).to.be.greaterThan(doku);
  });

  it('legt Start/Team/HACCP/Prod./Etiketten unter Mehr ab', () => {
    expect(html).to.match(/id="mehr-nav-accordion"/);
    expect(html).to.match(/id="mehr-nav-trigger"/);
    expect(html).to.match(/id="mehr-nav-popover"/);
    const mehrBlock = html.match(/id="mehr-nav-popover"[\s\S]*?<\/div>\s*<button[^>]*id="mehr-nav-trigger"/);
    expect(mehrBlock, 'mehr popover').to.be.ok;
    const body = mehrBlock[0];
    for (const tab of ['teamboard', 'team', 'haccp', 'kitchen', 'avery']) {
      expect(body).to.include(`data-tab="${tab}"`);
      expect(body).to.include('data-nav-slot="mehr"');
    }
    expect(body).to.not.include('data-tab="mhd"');
    expect(body).to.not.include('data-tab="knowledge"');
  });

  it('markiert Primärtabs mit data-nav-slot=primary', () => {
    for (const tab of ['mhd', 'receiving', 'orders', 'chargenDoku']) {
      expect(html).to.match(new RegExp(`data-tab="${tab}"[^>]*data-nav-slot="primary"|data-nav-slot="primary"[^>]*data-tab="${tab}"`));
    }
  });

  it('hält Mehr-Sync und Accordion-Bindung in app.js', () => {
    expect(app).to.match(/const PRIMARY_BOTTOM_NAV_TAB_IDS\s*=/);
    expect(app).to.match(/const MEHR_NAV_TAB_IDS\s*=/);
    expect(app).to.match(/function syncMehrNavOverflow\s*\(/);
    expect(app).to.match(/function bindMehrNavAccordion\s*\(/);
    expect(app).to.match(/function syncMehrNavActiveState\s*\(/);
    expect(app).to.include("MEHR_NAV_TAB_IDS = new Set(['teamboard', 'team', 'haccp', 'kitchen', 'avery'])");
    expect(app).to.include("PRIMARY_BOTTOM_NAV_TAB_IDS = new Set(['mhd', 'receiving', 'orders', 'chargenDoku'])");
    expect(app).to.match(/BOTTOM_NAV_TAB_PRIORITY\s*=\s*\['mhd',\s*'receiving',\s*'orders',\s*'chargenDoku'/);
  });

  it('bumpt den Service-Worker-Cache für thekenklade-sichtbar', () => {
    expect(sw).to.include("const CACHE_NAME = 'charculogic-v20261025-thekenklade-sichtbar-v1'");
    expect(app).to.include("sw.js?v=20261025-thekenklade-sichtbar");
  });

  it('FOUC-Boot synchronisiert Mehr-Trigger', () => {
    expect(html).to.match(/function syncMehrBoot\s*\(/);
    expect(html).to.match(/syncMehrBoot\s*\(\s*\)/);
  });

  it('Claims-Mapping: ACCESS_MODULE_TO_TAB deckt Primär + Mehr ab', () => {
    const expected = {
      mhd: 'mhd',
      receiving: 'receiving',
      orders: 'orders',
      chargenDoku: 'chargenDoku',
      start: 'teamboard',
      team: 'team',
      haccp: 'haccp',
      kitchen: 'kitchen',
      averyLabels: 'avery',
    };
    Object.entries(expected).forEach(([key, tab]) => {
      expect(ACCESS_MODULE_TO_TAB[key]).to.equal(tab);
    });
  });

  it('Helper sieht MHD/HACCP/Start/Doku, nicht Packtisch/Team (Claims)', () => {
    const tenantAllOn = Object.fromEntries(
      Object.keys(DEFAULT_ROLE_MODULE_DEFAULTS.admin).map((k) => [k, true]),
    );
    // ACCESS keys from defaults
    const access = resolveAccessModules({
      tenantModules: {
        mhd: true,
        receiving: true,
        orders: true,
        chargenDoku: true,
        start: true,
        team: true,
        haccp: true,
        kitchen: true,
        averyLabels: true,
        knowledge: true,
        buero: true,
      },
      role: 'helper',
    });
    expect(access.mhd).to.equal(true);
    expect(access.haccp).to.equal(true);
    expect(access.orders).to.equal(false);
    expect(access.team).to.equal(false);
    expect(access.kitchen).to.equal(false);
    void tenantAllOn;
  });
});
