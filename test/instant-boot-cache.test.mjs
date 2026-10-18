/**
 * Instant-Boot: Modul-Cache + Mitarbeiter-SWR Marker.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'chai';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('Instant-Boot Cache-First', () => {
  const appJs = read('web/app.js');
  const indexHtml = read('web/index.html');
  const tenantModulesJs = read('web/tenant-modules.js');
  const swJs = read('web/sw.js');

  it('boots module visibility from lastEffectiveModules on DOMContentLoaded', () => {
    expect(appJs).to.match(/function bootCachedModuleVisibility/);
    expect(appJs).to.match(/function applyModuleVisibilityIfChanged/);
    expect(appJs).to.match(/scheduleBootCachedModuleVisibility/);
    expect(appJs).to.match(/DOMContentLoaded/);
    expect(tenantModulesJs).to.match(/LAST_EFFECTIVE_MODULES_KEY\s*=\s*'charculogic\.lastEffectiveModules'/);
    expect(tenantModulesJs).to.match(/export function publishEffectiveModules/);
    expect(indexHtml).to.match(/charculogic\.lastEffectiveModules/);
    expect(indexHtml).to.match(/bootCachedNavModules/);
  });

  it('avoids unhiding module-disabled tabs in role UI', () => {
    expect(appJs).to.match(/Zuerst Modul-Sichtbarkeit/);
    expect(appJs).to.match(/if \(tab\.hidden \|\| tab\.style\.display === 'none'\) return;/);
  });

  it('bumps SW cache for Avery iOS print v1.5.0 release', () => {
    expect(swJs).to.include("const CACHE_NAME = 'charculogic-v20261018-ios-print-v150'");
  });

  it('applies employee kitchen RBAC during zero-flicker boot', () => {
    expect(indexHtml).to.match(/isKitchenAllowedForEmployee/);
    expect(indexHtml).to.match(/charculogic\.activeEmployee/);
    expect(tenantModulesJs).to.match(/export function isKitchenModuleVisibleForSession/);
    expect(appJs).to.match(/function resolveKitchenNavEnabled/);
    expect(appJs).to.match(/function resolveAveryLabelsNavEnabled/);
    expect(indexHtml).to.match(/avery:\s*'averyLabels'/);
  });
});
