/**
 * Regressions: Modul-Nav darf ohne lastEffectiveModules-Cache nicht
 * Branding-Defaults (alle Soft-Launch-Module) in die Nav pushen.
 */
import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LAST_EFFECTIVE_MODULES_KEY,
  publishEffectiveModules,
  readCachedEffectiveModules,
  writeCachedEffectiveModules,
  applyEffectiveModulesToBranding,
} from '../web/tenant-modules.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function makeNavDom() {
  const tabs = new Map();
  const ids = ['teamboard', 'team', 'orders', 'mhd', 'receiving', 'chargenDoku', 'kitchen', 'avery', 'haccp', 'knowledge'];
  ids.forEach((id) => {
    tabs.set(id, { 'data-tab': id, hidden: false, style: { display: '' }, getAttribute(k) { return this[k]; } });
  });
  return {
    tabs,
    querySelectorAll(sel) {
      if (!String(sel).includes('nav-item')) return [];
      return [...tabs.values()];
    },
  };
}

describe('Modul-Nav Boot FOUC Guard', () => {
  beforeEach(() => {
    globalThis.localStorage = {
      _data: {},
      getItem(k) { return Object.prototype.hasOwnProperty.call(this._data, k) ? this._data[k] : null; },
      setItem(k, v) { this._data[k] = String(v); },
      removeItem(k) { delete this._data[k]; },
    };
    globalThis.window = globalThis;
  });

  it('does not write branding-all-true into lastEffectiveModules before Firestore', () => {
    // Simuliert den verbotenen Alt-Pfad: publishEffectiveModules(branding, null) beim Cache-Miss.
    const stevesHofDefaults = {
      modules: {
        orders: true,
        team: true,
        teamboard: true,
        mhdMonitor: true,
        wareneingang: true,
        wurstkueche: true,
        averyLabels: true,
        haccp: true,
        batches: true,
      },
    };
    expect(readCachedEffectiveModules()).to.equal(null);

    // Korrektes Boot-Verhalten: ohne Cache nichts publishen.
    expect(localStorage.getItem(LAST_EFFECTIVE_MODULES_KEY)).to.equal(null);

    // Erst Firestore (Teilmenge) darf cachen:
    const enabledModules = {
      mhd: true,
      receiving: true,
      orders: true,
      kitchen: false,
      haccp: false,
      team: false,
      start: false,
      averyLabels: false,
      chargenDoku: true,
    };
    applyEffectiveModulesToBranding(
      publishEffectiveModules(stevesHofDefaults, { enabledModules }).effective,
      stevesHofDefaults,
    );
    const cached = readCachedEffectiveModules();
    expect(cached.orders).to.equal(true);
    expect(cached.haccp).to.equal(false);
    expect(cached.teamboard).to.equal(false);
    expect(cached.averyLabels).to.equal(false);
  });

  it('head script hideAllNavTabs path exists and HTML defaults start hidden', () => {
    const indexHtml = readFileSync(join(root, 'web/index.html'), 'utf8');
    const appJs = readFileSync(join(root, 'web/app.js'), 'utf8');
    const tenantModulesJs = readFileSync(join(root, 'web/tenant-modules.js'), 'utf8');
    expect(indexHtml).to.match(/function hideAllNavTabs/);
    expect(indexHtml).to.match(/if \(!modules\) \{\s*hideAllNavTabs\(\);/);
    expect(indexHtml).to.match(/charculogic\.lastEffectiveModules\.v2/);
    expect(tenantModulesJs).to.match(/lastEffectiveModules\.v2/);
    expect(appJs).to.match(/hideModuleNavTabsPendingConfig/);
    expect(appJs).to.match(/__hofsyncModulesPending\s*=\s*true/);
    // Branding-Fallback publish nur noch im else-Zweig von loadTenantEnabledModules / Fehlerpfad —
    // nicht mehr in bootCachedModuleVisibility.
    const bootFn = appJs.slice(
      appJs.indexOf('function bootCachedModuleVisibility'),
      appJs.indexOf('function applyModuleVisibilityIfChanged'),
    );
    expect(bootFn).to.not.match(/publishEffectiveModules\(branding,\s*null\)/);
    expect(bootFn).to.match(/hideModuleNavTabsPendingConfig\(\)/);
  });

  it('mock DOM: cache miss hides all tabs; cache hit reveals subset', () => {
    const dom = makeNavDom();
    const applyFromCache = (modules) => {
      if (!modules) {
        dom.querySelectorAll('.nav-item[data-tab]').forEach((tab) => {
          tab.hidden = true;
          tab.style.display = 'none';
        });
        return;
      }
      const map = {
        teamboard: 'teamboard', team: 'team', orders: 'orders', mhd: 'mhdMonitor',
        receiving: 'wareneingang', chargenDoku: 'chargenDoku', kitchen: 'wurstkueche',
        avery: 'averyLabels', haccp: 'haccp', knowledge: 'knowledge',
      };
      dom.querySelectorAll('.nav-item[data-tab]').forEach((tab) => {
        const key = map[tab.getAttribute('data-tab')];
        const enabled = modules[key] === true;
        tab.hidden = !enabled;
        tab.style.display = enabled ? '' : 'none';
      });
    };

    applyFromCache(null);
    for (const tab of dom.tabs.values()) {
      expect(tab.hidden).to.equal(true);
      expect(tab.style.display).to.equal('none');
    }

    writeCachedEffectiveModules({
      mhdMonitor: true,
      wareneingang: true,
      chargenDoku: true,
      orders: true,
      haccp: false,
      teamboard: false,
      team: false,
      wurstkueche: false,
      averyLabels: false,
    });
    applyFromCache(readCachedEffectiveModules());
    expect(dom.tabs.get('mhd').hidden).to.equal(false);
    expect(dom.tabs.get('orders').hidden).to.equal(false);
    expect(dom.tabs.get('haccp').hidden).to.equal(true);
    expect(dom.tabs.get('teamboard').hidden).to.equal(true);
    expect(dom.tabs.get('kitchen').hidden).to.equal(true);
  });
});
