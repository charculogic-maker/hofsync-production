/**
 * Neutral Rind-Katalog + optionale beefBreed (Galloway nur für StevesHof).
 */
import { expect } from 'chai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BEEF_CATALOG,
  GALLOWAY_CATALOG,
  formatCutDisplayName,
  formatLabelTitle,
  getTenantBeefBreed,
  resolveBeefSpeciesLabel,
} from '../web/avery-labels.js';
import { buildBeefFallbackLot, buildGallowayFallbackLot } from '../web/receiving.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('Beef catalog multi-tenancy', () => {
  it('aliases GALLOWAY_CATALOG to BEEF_CATALOG without breed in cut names', () => {
    expect(GALLOWAY_CATALOG).to.equal(BEEF_CATALOG);
    const names = Object.values(BEEF_CATALOG).flat().map((c) => c.name);
    expect(names.every((n) => !/Galloway/i.test(n))).to.equal(true);
  });

  it('formats label titles without hardcoded Galloway', () => {
    expect(formatLabelTitle('Rumpsteak')).to.equal('Rumpsteak');
    expect(formatLabelTitle('Galloway · Rumpsteak')).to.equal('Rumpsteak');
    expect(formatLabelTitle('Rind Roulade')).to.equal('Roulade');
  });

  it('falls back to RIND lot prefix without breed, GAL with Galloway', () => {
    const prev = globalThis.window;
    globalThis.window = { currentTenantConfig: {}, BRANDING: {} };
    try {
      expect(buildBeefFallbackLot({
        klassifizierung: 'OCHSE',
        schlachtDatumIso: '2026-11-10',
      })).to.equal('RIND-OCHSE-20261110');
      expect(buildGallowayFallbackLot({
        klassifizierung: 'OCHSE',
        schlachtDatumIso: '2026-11-10',
      })).to.equal('RIND-OCHSE-20261110');
    } finally {
      globalThis.window = {
        currentTenantConfig: { beefBreed: 'Galloway' },
        BRANDING: { beefBreed: 'Galloway' },
      };
    }
    try {
      expect(buildBeefFallbackLot({
        klassifizierung: 'OCHSE',
        schlachtDatumIso: '2026-11-10',
      })).to.equal('GAL-OCHSE-20261110');
      expect(getTenantBeefBreed()).to.equal('Galloway');
      expect(resolveBeefSpeciesLabel()).to.equal('Galloway');
      expect(formatCutDisplayName('Hackfleisch')).to.equal('Galloway · Hackfleisch');
    } finally {
      if (prev === undefined) delete globalThis.window;
      else globalThis.window = prev;
    }
  });

  it('keeps StevesHof beefBreed in branding override and neutral UI copy', () => {
    const branding = read('web/branding.js');
    const index = read('web/index.html');
    const fast = read('web/fast-onboarding.js');
    expect(branding).to.match(/steveshof_hauptbetrieb:[\s\S]*beefBreed:\s*'Galloway'/);
    expect(index).to.include('Rind-Zerlegung &amp; Avery 3475 Etiketten');
    expect(index).to.include('Lohnschlachtung Rind (Eigenbestand)');
    expect(index).to.not.include('Galloway / Eigenbestand');
    expect(fast).to.include('Rind-Zerlegung & Avery 3475 Etiketten');
  });
});
