/**
 * Phase B.4: Claims.role ↔ sichtbare Tabs (Employee vs Admin).
 */
import { expect } from 'chai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACCESS_MODULE_KEYS,
  ACCESS_MODULE_TO_TAB,
  DEFAULT_ROLE_MODULE_DEFAULTS,
  resolveAccessModules,
  resolveTabsForClaimRole,
} from '../web/tenant-modules.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

/** Tenant mit allen Access-Keys an (volle Decke). */
const TENANT_ALL_ON = Object.fromEntries(ACCESS_MODULE_KEYS.map((key) => [key, true]));

describe('Claims ↔ Tabs Mapping (B.4)', () => {
  const app = read('web/app.js');
  const auth = read('web/auth.js');
  const docs = read('docs/CLAIMS_TABS_MAPPING.md');
  const sw = read('web/sw.js');
  const appBoot = read('web/app.js');

  it('mappt Access-Keys 1:1 auf Tab-IDs (außer retterBox)', () => {
    expect(ACCESS_MODULE_TO_TAB.mhd).to.equal('mhd');
    expect(ACCESS_MODULE_TO_TAB.receiving).to.equal('receiving');
    expect(ACCESS_MODULE_TO_TAB.orders).to.equal('orders');
    expect(ACCESS_MODULE_TO_TAB.chargenDoku).to.equal('chargenDoku');
    expect(ACCESS_MODULE_TO_TAB.buero).to.equal('batches');
    expect(ACCESS_MODULE_TO_TAB.knowledge).to.equal('knowledge');
    expect(ACCESS_MODULE_TO_TAB).to.not.have.property('retterBox');
  });

  it('Employee: Laden-Tabs inkl. Wissen, Büro nein (Code-Defaults)', () => {
    const tabs = resolveTabsForClaimRole('employee', { tenantModules: TENANT_ALL_ON });
    expect(tabs).to.include.members([
      'mhd', 'receiving', 'orders', 'chargenDoku',
      'teamboard', 'team', 'haccp', 'kitchen', 'avery', 'knowledge',
    ]);
    expect(tabs).to.not.include('batches');
    expect(DEFAULT_ROLE_MODULE_DEFAULTS.employee.buero).to.equal(false);
    expect(DEFAULT_ROLE_MODULE_DEFAULTS.employee.knowledge).to.equal(true);
  });

  it('Admin: wie Employee plus Büro', () => {
    const employee = new Set(resolveTabsForClaimRole('employee', { tenantModules: TENANT_ALL_ON }));
    const admin = resolveTabsForClaimRole('admin', { tenantModules: TENANT_ALL_ON });
    expect(admin).to.include.members([...employee]);
    expect(admin).to.include('knowledge');
    expect(admin).to.include('batches');
    expect(DEFAULT_ROLE_MODULE_DEFAULTS.admin.buero).to.equal(true);
    expect(DEFAULT_ROLE_MODULE_DEFAULTS.admin.knowledge).to.equal(true);
  });

  it('Helper: MHD/Start/HACCP/Herkunft, kein Neu/Packtisch/Team/Büro', () => {
    const tabs = resolveTabsForClaimRole('helper', { tenantModules: TENANT_ALL_ON });
    expect(tabs).to.include.members(['mhd', 'teamboard', 'haccp', 'chargenDoku']);
    expect(tabs).to.not.include('receiving');
    expect(tabs).to.not.include('orders');
    expect(tabs).to.not.include('team');
    expect(tabs).to.not.include('batches');
    expect(tabs).to.not.include('knowledge');
  });

  it('Nutzer-allowedModules kann Employee-Packtisch zusätzlich sperren', () => {
    const tabs = resolveTabsForClaimRole('employee', {
      tenantModules: TENANT_ALL_ON,
      allowedModules: { orders: false },
    });
    expect(tabs).to.not.include('orders');
    expect(tabs).to.include('mhd');
  });

  it('Tenant-Decke schlägt Rolle: ohne receiving kein Neu-Tab', () => {
    const tabs = resolveTabsForClaimRole('admin', {
      tenantModules: { ...TENANT_ALL_ON, receiving: false },
    });
    expect(tabs).to.not.include('receiving');
    expect(tabs).to.include('batches');
  });

  it('Access-Map und Tab-Liste bleiben konsistent', () => {
    const access = resolveAccessModules({
      tenantModules: TENANT_ALL_ON,
      role: 'employee',
    });
    const tabs = resolveTabsForClaimRole('employee', { tenantModules: TENANT_ALL_ON });
    Object.entries(ACCESS_MODULE_TO_TAB).forEach(([key, tabId]) => {
      if (access[key]) expect(tabs).to.include(tabId);
      else expect(tabs).to.not.include(tabId);
    });
  });

  it('app.js verdrahtet Claims/Profil-allowedModules über resolveTabsForClaimRole', () => {
    expect(app).to.match(/function resolveSessionAllowedTabs\s*\(/);
    expect(app).to.match(/resolveTabsForClaimRole\s*\(/);
    expect(app).to.match(/authSession\?\.claims\?\.allowedModules/);
    expect(app).to.match(/authSession\?\.profile\?\.allowedModules/);
    expect(app).to.match(/applyRoleBasedUi\s*\(/);
  });

  it('auth.js liest role aus Custom Claims (inkl. isAdmin-Alias)', () => {
    expect(auth).to.match(/function roleFromClaims\s*\(/);
    expect(auth).to.match(/claims\.isAdmin\s*===\s*true/);
    expect(auth).to.match(/role === 'admin' \|\| role === 'employee' \|\| role === 'helper'/);
    expect(auth).to.match(/function claimsAreComplete\s*\(/);
  });

  it('Dokumentation CLAIMS_TABS_MAPPING beschreibt Employee vs Admin', () => {
    expect(docs).to.match(/Claims ↔ sichtbare Tabs/);
    expect(docs).to.match(/Employee vs Admin/);
    expect(docs).to.match(/resolveTabsForClaimRole/);
    expect(docs).to.match(/buero/);
    expect(docs).to.match(/knowledge/);
  });

  it('bumpt den Service-Worker-Cache', () => {
    expect(sw).to.include("const CACHE_NAME = 'charculogic-v20261031-wissen-gewolft-v1'");
    expect(appBoot).to.include('sw.js?v=20261031-wissen-gewolft-v1');
  });
});
