/**
 * Role-based PROD./kitchen tab visibility (StevesHof Soft-Lock fallback).
 */
import { expect } from 'chai';
import {
  applySessionKitchenModuleOverride,
  isKitchenModuleVisibleForSession,
  isProductionEmployeeName,
  isSalesFloorEmployeeName,
  resolveEmployeeKitchenAccess,
} from '../web/tenant-modules.js';

describe('Kitchen / PROD. role-based nav', () => {
  it('hides kitchen for sales-floor name hints', () => {
    expect(isSalesFloorEmployeeName('Laden-Team')).to.equal(true);
    expect(isSalesFloorEmployeeName('Verkauf Theke')).to.equal(true);
    expect(isSalesFloorEmployeeName('Service')).to.equal(true);
    expect(isSalesFloorEmployeeName('Laden')).to.equal(true);
    expect(isSalesFloorEmployeeName('Magdalena')).to.equal(false);
    expect(resolveEmployeeKitchenAccess('Laden-Team')).to.equal('deny');
    expect(isKitchenModuleVisibleForSession(true, { employeeName: 'Laden-Team' })).to.equal(false);
  });

  it('keeps tenant kitchen setting for production names and admin/produktion roles', () => {
    expect(isProductionEmployeeName('Paddy')).to.equal(true);
    expect(isProductionEmployeeName('Metzgerei')).to.equal(true);
    expect(isProductionEmployeeName('Küche')).to.equal(true);
    expect(isProductionEmployeeName('Produktion Ost')).to.equal(true);
    expect(resolveEmployeeKitchenAccess('Paddy')).to.equal('allow');
    expect(resolveEmployeeKitchenAccess('Finn', { role: 'produktion' })).to.equal('allow');
    expect(resolveEmployeeKitchenAccess('Büro', null, 'admin')).to.equal('allow');
    expect(isKitchenModuleVisibleForSession(true, { employeeName: 'Paddy' })).to.equal(true);
    expect(isKitchenModuleVisibleForSession(false, { employeeName: 'Paddy' })).to.equal(false);
  });

  it('denies kitchen when no employee is selected (timeout fallback)', () => {
    expect(resolveEmployeeKitchenAccess('')).to.equal('deny');
    expect(isKitchenModuleVisibleForSession(true, { employeeName: '' })).to.equal(false);
    expect(isKitchenModuleVisibleForSession(true, { employeeName: 'Bettina' })).to.equal(false);
  });

  it('overrides module map locally without requiring tenant kitchen off', () => {
    const base = { wurstkueche: true, mhdMonitor: true, kitchen: true, kueche: true };
    const hidden = applySessionKitchenModuleOverride(base, { employeeName: 'Laden-Team' });
    expect(hidden.wurstkueche).to.equal(false);
    expect(hidden.kitchen).to.equal(false);
    expect(hidden.kueche).to.equal(false);
    expect(hidden.mhdMonitor).to.equal(true);

    const shown = applySessionKitchenModuleOverride(base, { employeeName: 'Paddy' });
    expect(shown.wurstkueche).to.equal(true);
    expect(shown.kitchen).to.equal(true);
  });
});
