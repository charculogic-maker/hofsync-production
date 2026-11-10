/**
 * Dev-Dashboard Tarif-Schnellwahl → Modul-Checkbox-Presets.
 */
import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('Dev-Dashboard Tarif-Schnellwahl', () => {
  it('HTML enthält Tarif-Buttons und Create-Form-Tarif-Select', () => {
    const html = readFileSync(join(root, 'web/index.html'), 'utf8');
    expect(html).to.match(/id="dev-dashboard-tenant-tier-select"/);
    expect(html).to.match(/data-tier="mhd_retter"/);
    expect(html).to.match(/data-tier="hofladen_komplett"/);
    expect(html).to.match(/data-tier="metzgerei_pro"/);
    expect(html).to.match(/data-tier="manual"/);
    expect(html).to.match(/Hofladen Komplett/);
  });

  it('JS mappt Tarif-Presets und vermeidet Legacy-modules beim Create', () => {
    const js = readFileSync(join(root, 'web/dev-dashboard.js'), 'utf8');
    expect(js).to.match(/TIER_UI_MODULE_PRESETS/);
    expect(js).to.match(/mhd_retter/);
    expect(js).to.match(/hofladen_komplett/);
    expect(js).to.match(/metzgerei_pro/);
    expect(js).to.match(/ensureTenantBranchPresets/);
    expect(js).to.match(/Nur Super-Admins dürfen neue Mandanten anlegen/);
    expect(js).to.match(/tier: tier === 'manual' \? '' : tier/);
    expect(js).to.match(/active: true/);
    // Create payload must not write legacy modules (rules hasOnly).
    expect(js).to.match(/permission-denied/);
    expect(js).not.to.match(/await ref\.set\(\{[\s\S]*modules:\s*\{\s*\.\.\.enabledModules/);
  });

  it('Rules erlauben Super-Admin Create mit tier/id/name/active', () => {
    const rules = readFileSync(join(root, 'firebase.rules'), 'utf8');
    expect(rules).to.match(/function isSuperAdmin\(\)/);
    expect(rules).to.match(/tenantCreateAllowedKeys/);
    expect(rules).to.match(/allow create: if isSuperAdmin\(\)/);
    expect(rules).to.match(/patrik@charculogic\.de/);
  });
});
