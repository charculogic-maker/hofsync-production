/**
 * Tenant ∩ Rolle ∩ Nutzer — Session-Modulzugriff.
 */
import { expect } from 'chai';
import {
  ACCESS_MODULE_KEYS,
  applySessionAccessModuleOverride,
  DEFAULT_ROLE_MODULE_DEFAULTS,
  isTenantAccessKeyEnabled,
  normalizeAccessModuleMap,
  normalizeRoleModuleDefaults,
  resolveAccessModules,
  resolveRoleModuleAllowlist,
} from '../web/tenant-modules.js';

describe('module access resolve (tenant ∩ role ∩ user)', () => {
  const tenantAllOn = Object.fromEntries(ACCESS_MODULE_KEYS.map((key) => [key, true]));

  it('normalisiert fehlende Keys als erlaubt', () => {
    const map = normalizeAccessModuleMap({ mhd: false, kitchen: true });
    expect(map.mhd).to.equal(false);
    expect(map.kitchen).to.equal(true);
    expect(map.orders).to.equal(true);
    expect(ACCESS_MODULE_KEYS.every((key) => typeof map[key] === 'boolean')).to.equal(true);
  });

  it('liefert Code-Defaults je Rolle ohne Tenant-Settings', () => {
    expect(resolveRoleModuleAllowlist('helper').orders).to.equal(false);
    expect(resolveRoleModuleAllowlist('helper').mhd).to.equal(true);
    expect(resolveRoleModuleAllowlist('employee').buero).to.equal(false);
    expect(resolveRoleModuleAllowlist('admin').buero).to.equal(true);
  });

  it('lässt Tenant-Rollen-Overrides greifen', () => {
    const allow = resolveRoleModuleAllowlist('helper', {
      helper: { ...DEFAULT_ROLE_MODULE_DEFAULTS.helper, orders: true },
    });
    expect(allow.orders).to.equal(true);
    expect(allow.receiving).to.equal(false);
  });

  it('schneidet Tenant-Decke mit Rolle und Nutzer', () => {
    const access = resolveAccessModules({
      tenantModules: { ...tenantAllOn, buero: false, kitchen: true },
      role: 'employee',
      allowedModules: { kitchen: false, mhd: true },
    });
    expect(access.mhd).to.equal(true);
    expect(access.kitchen).to.equal(false);
    expect(access.buero).to.equal(false);
    expect(access.haccp).to.equal(true);
  });

  it('Helper sieht keine Bestellungen trotz Tenant-Freigabe', () => {
    const access = resolveAccessModules({
      tenantModules: tenantAllOn,
      role: 'helper',
    });
    expect(access.orders).to.equal(false);
    expect(access.team).to.equal(false);
    expect(access.mhd).to.equal(true);
    expect(access.haccp).to.equal(true);
  });

  it('behandelt fehlende Keys in partieller Tenant-Map als aus', () => {
    expect(isTenantAccessKeyEnabled('orders', { mhd: true })).to.equal(false);
    expect(isTenantAccessKeyEnabled('mhd', { mhd: true })).to.equal(true);
    expect(isTenantAccessKeyEnabled('kitchen', { kitchen: false })).to.equal(false);
    expect(isTenantAccessKeyEnabled('mhd', {})).to.equal(true);
  });

  it('überschreibt Modul-Map lokal ohne Cache-Semantik', () => {
    const base = {
      mhd: true,
      mhdMonitor: true,
      orders: true,
      kitchen: true,
      wurstkueche: true,
    };
    const next = applySessionAccessModuleOverride(base, {
      role: 'helper',
      allowedModules: null,
    });
    expect(next.mhd).to.equal(true);
    expect(next.orders).to.equal(false);
    expect(next.kitchen).to.equal(false);
    expect(next.wurstkueche).to.equal(false);
  });

  it('normalisiert role_modules-Dokumente vollständig', () => {
    const normalized = normalizeRoleModuleDefaults({
      helper: { mhd: false },
    });
    expect(normalized.helper.mhd).to.equal(false);
    expect(normalized.helper.haccp).to.equal(true);
    expect(normalized.admin.buero).to.equal(true);
    expect(normalized.employee.knowledge).to.equal(false);
  });
});
