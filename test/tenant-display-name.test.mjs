/**
 * getTenantDisplayName: Multi-Tenant ohne Sticky StevesHof.
 */
import { expect } from 'chai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const brandingSrc = fs.readFileSync(path.join(root, 'web/branding.js'), 'utf8');

function loadBrandingSandbox({ tenantId = '', brandTitle = '', brandingName = '' } = {}) {
  const store = {
    charculogic_brand_title: brandTitle,
    charculogic_cached_tenant_id: tenantId,
  };
  const localStorage = {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
  };
  const window = {
    localStorage,
    BRANDING: brandingName ? { betriebsName: brandingName } : undefined,
    location: { search: '' },
    currentTenantConfig: { tenantId: '', displayName: '', name: '' },
  };
  const sandbox = {
    window,
    localStorage,
    document: undefined,
    console,
    URLSearchParams,
    module: { exports: {} },
    exports: {},
  };
  // branding.js is ESM — evaluate exported helpers by rewriting to CJS-ish assignment.
  const transformed = brandingSrc
    .replace(/^export const /gm, 'const ')
    .replace(/^export function /gm, 'function ')
    + '\n;sandboxApi = { getTenantDisplayName, resolveBranding, STEVESHOF_BRAND_TITLE, DEFAULT_BRAND_TITLE, syncCurrentTenantConfig, applyResolvedBranding };';
  sandbox.sandboxApi = null;
  vm.runInNewContext(transformed, sandbox, { filename: 'branding.js' });
  return { api: sandbox.sandboxApi, window, store };
}

describe('getTenantDisplayName', () => {
  it('liefert StevesHof Hofladen für StevesHof_Hauptbetrieb', () => {
    const { api, window } = loadBrandingSandbox({
      tenantId: 'StevesHof_Hauptbetrieb',
    });
    api.syncCurrentTenantConfig('StevesHof_Hauptbetrieb', '');
    window.currentTenantConfig = { tenantId: 'StevesHof_Hauptbetrieb', displayName: '', name: '' };
    expect(api.getTenantDisplayName()).to.equal(api.STEVESHOF_BRAND_TITLE);
  });

  it('liefert konfigurierten Namen für andere Mandanten', () => {
    const { api } = loadBrandingSandbox({
      tenantId: 'test_auto_seed',
      brandTitle: 'StevesHof Hofladen',
    });
    api.syncCurrentTenantConfig(
      'test_auto_seed',
      'Fleischerei & Hofladen Musterbetrieb',
    );
    expect(api.getTenantDisplayName()).to.equal('Fleischerei & Hofladen Musterbetrieb');
  });

  it('fällt auf Mein Betrieb zurück ohne Config', () => {
    const { api } = loadBrandingSandbox({
      tenantId: 'neuer_kunde',
      brandTitle: '',
    });
    api.syncCurrentTenantConfig('neuer_kunde', '');
    expect(api.getTenantDisplayName()).to.equal(api.DEFAULT_BRAND_TITLE);
  });
});
