/**
 * Architektur-Guards: Modul-SSOT, Router-Einmalstart, Loader ohne showTab, Nav-Sync.
 */
import { expect } from 'chai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('Architektur: Modul-SSOT & Router', () => {
  it('verbietet showTab in MHD/HACCP/Teamboard-Daten-Loadern', () => {
    for (const rel of ['web/mhd.js', 'web/haccp.js', 'web/teamboard.js']) {
      const src = read(rel);
      expect(src).to.not.match(/\bshowTab\s*\(/);
      expect(src).to.not.match(/\bshowPreferredStartTab\s*\(/);
      expect(src).to.not.match(/\bshowInitialTab\s*\(/);
      expect(src).to.not.match(/\bswitchTab\s*\(/);
      expect(src).to.not.match(/__userNavigated/);
    }
  });

  it('hat showInitialTab genau einmal nach Auth und currentActiveTabId', () => {
    const app = read('web/app.js');
    expect(app).to.match(/function showInitialTab\s*\(/);
    expect(app).to.match(/currentActiveTabId/);
    expect(app).to.match(/showInitialTab\s*\(\s*\)/);
    // Kein zweiter Forced-Start nach Fixed-Terminal
    expect(app).to.match(/kein zweiter showPreferredStartTab/);
    expect(app).to.not.match(/__userNavigated/);
  });

  it('exponiert Packtisch in #sidebar und #bottom-nav', () => {
    const html = read('web/index.html');
    expect(html).to.match(/id="sidebar"/);
    expect(html).to.match(/id="bottom-nav"/);
    expect(html).to.match(/id="page-orders"/);
    expect(html).to.match(/id="view-orders"/);
    expect(html).to.match(/data-tab="orders"/);
    expect(html).to.match(/data-module-key="orders"/);
    expect(html).to.match(/id="dev-dashboard-betrieb-modules-list"/);
    expect(html).to.not.match(/data-betrieb-module=/);
  });

  it('persistiert orders als Merge-Patch im Dev-Dashboard (Plattform)', () => {
    const dash = read('web/dev-dashboard.js');
    expect(dash).to.include('buildEnabledModulesFieldPatch');
    expect(dash).to.include('enabledModules.${key}');
    expect(dash).to.match(/key:\s*'orders'/);
    expect(dash).to.match(/averyLabels:\s*'Avery Etiketten'/);
    expect(dash).to.not.include('readBetriebModulePatch');
  });

  it('SW-Cache ist aktueller iOS-InPage-Print-Build', () => {
    expect(read('web/sw.js')).to.match(/charculogic-v20261031-wissen-gewolft-v1/);
    expect(read('web/sw.js')).to.match(/isStandaloneHtmlDoc/);
  });
});
