/**
 * resolveEffectiveModules: Firestore führend, Branding Fallback, team ≠ orders.
 */
import { expect } from 'chai';
import {
  CANONICAL_MODULE_KEYS,
  effectiveModulesEqual,
  LAST_EFFECTIVE_MODULES_KEY,
  mergeEnabledModulesIntoBranding,
  publishEffectiveModules,
  readCachedEffectiveModules,
  resolveEffectiveModules,
  isTenantModuleEnabled,
  writeCachedEffectiveModules,
} from '../web/tenant-modules.js';

describe('resolveEffectiveModules', () => {
  it('liefert die kanonische Modulliste', () => {
    expect(CANONICAL_MODULE_KEYS).to.deep.equal([
      'mhdMonitor',
      'wareneingang',
      'wareneingangMetzgerei',
      'wurstkueche',
      'averyLabels',
      'haccp',
      'teamboard',
      'team',
      'orders',
      'batches',
      'retterBox',
    ]);
  });

  it('nimmt Branding als Offline-Fallback und lässt Firestore führend', () => {
    const branding = {
      modules: {
        mhdMonitor: true,
        wareneingang: true,
        wareneingangMetzgerei: true,
        wurstkueche: true,
        haccp: true,
        teamboard: true,
        team: true,
        orders: true,
        batches: true,
        retterBox: false,
      },
    };
    const boot = resolveEffectiveModules(branding, null);
    expect(boot.orders).to.equal(true);
    expect(boot.team).to.equal(true);

    const fromFs = resolveEffectiveModules(branding, {
      enabledModules: { orders: false, team: true, mhd: true },
    });
    expect(fromFs.orders).to.equal(false);
    expect(fromFs.team).to.equal(true);
    expect(fromFs.mhdMonitor).to.equal(true);
  });

  it('überschreibt orders nicht, wenn nur team in Firestore steht', () => {
    const branding = {
      modules: {
        orders: true,
        team: true,
        mhdMonitor: true,
        wareneingang: true,
        wareneingangMetzgerei: false,
        wurstkueche: true,
        haccp: true,
        teamboard: true,
        batches: true,
        retterBox: false,
      },
    };
    const resolved = resolveEffectiveModules(branding, {
      enabledModules: { team: false, mhd: true },
    });
    expect(resolved.team).to.equal(false);
    expect(resolved.orders).to.equal(true);
  });

  it('evaluiert StevesHof_Hauptbetrieb orders+team aktiv aus Branding-Fallback', () => {
    const steves = {
      modules: {
        orders: true,
        team: true,
        teamboard: true,
        mhdMonitor: true,
        wareneingang: true,
        wareneingangMetzgerei: true,
        wurstkueche: true,
        haccp: true,
        batches: true,
        retterBox: false,
      },
    };
    const resolved = resolveEffectiveModules(steves, null);
    expect(resolved.orders).to.equal(true);
    expect(resolved.team).to.equal(true);
  });

  it('mergeEnabledModulesIntoBranding koppelt team nicht an orders', () => {
    const branding = {
      modules: { orders: true, team: true, mhdMonitor: true },
    };
    mergeEnabledModulesIntoBranding({ team: false }, branding);
    expect(branding.modules.team).to.equal(false);
    expect(branding.modules.orders).to.equal(true);
    expect(isTenantModuleEnabled('orders', branding)).to.equal(true);
    expect(isTenantModuleEnabled('team', branding)).to.equal(false);
  });

  it('cached lastEffectiveModules round-trips and detects changes', () => {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => { store.set(key, String(value)); },
      removeItem: (key) => { store.delete(key); },
    };
    const branding = {
      modules: {
        mhdMonitor: true,
        wareneingang: true,
        wareneingangMetzgerei: false,
        wurstkueche: true,
        haccp: true,
        teamboard: false,
        team: false,
        orders: false,
        batches: true,
        retterBox: false,
      },
    };
    const first = publishEffectiveModules(branding, null);
    expect(first.changed).to.equal(true);
    expect(readCachedEffectiveModules().orders).to.equal(false);
    expect(localStorage.getItem(LAST_EFFECTIVE_MODULES_KEY)).to.be.a('string');

    const second = publishEffectiveModules(branding, null);
    expect(second.changed).to.equal(false);
    expect(effectiveModulesEqual(first.effective, second.effective)).to.equal(true);

    const third = publishEffectiveModules(branding, { enabledModules: { orders: true } });
    expect(third.changed).to.equal(true);
    expect(third.effective.orders).to.equal(true);
    writeCachedEffectiveModules(third.effective);
    expect(readCachedEffectiveModules().orders).to.equal(true);
  });
});
