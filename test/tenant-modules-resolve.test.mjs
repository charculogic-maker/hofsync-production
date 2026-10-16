/**
 * resolveEffectiveModules: Firestore führend, Branding Fallback, team ≠ orders.
 */
import { expect } from 'chai';
import {
  CANONICAL_MODULE_KEYS,
  mergeEnabledModulesIntoBranding,
  resolveEffectiveModules,
  isTenantModuleEnabled,
} from '../web/tenant-modules.js';

describe('resolveEffectiveModules', () => {
  it('liefert die kanonische Modulliste', () => {
    expect(CANONICAL_MODULE_KEYS).to.deep.equal([
      'mhdMonitor',
      'wareneingang',
      'wareneingangMetzgerei',
      'wurstkueche',
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
});
