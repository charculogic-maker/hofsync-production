/**
 * Boot-Branding: neutrales Fallback, StevesHof nur über Tenant-Override.
 */
import { expect } from 'chai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('Header-Branding Boot', () => {
  it('setzt Mein Betrieb als Default und hält StevesHof als Tenant-Override', () => {
    const branding = read('web/branding.js');
    const index = read('web/index.html');
    const app = read('web/app.js');

    expect(branding).to.match(/DEFAULT_BRAND_TITLE\s*=\s*'Mein Betrieb'/);
    expect(branding).to.match(/STEVESHOF_BRAND_TITLE\s*=\s*'StevesHof Hofladen'/);
    expect(branding).to.match(/BRAND_TITLE_STORAGE_KEY\s*=\s*'charculogic_brand_title'/);
    expect(branding).to.match(/betriebsName:\s*DEFAULT_BRAND_TITLE/);
    expect(branding).to.match(/steveshof_hauptbetrieb:\s*\{[\s\S]*betriebsName:\s*STEVESHOF_BRAND_TITLE/);
    expect(branding).to.include('function getTenantDisplayName');
    expect(branding).to.include('window.getTenantDisplayName = getTenantDisplayName');
    expect(index).to.include('charculogic_brand_title');
    expect(index).to.include('id="header-subtitle">Mein Betrieb<');
    expect(index).to.not.include('Frische-Bestand StevesHof wird geladen');
    expect(app).to.include('applyHeaderBrandName');
    expect(app).to.include('getTenantDisplayName');
    expect(app).to.match(/Mandantenname.*nie mit Modul/);
    expect(app).to.not.match(/headerSubtitle\.textContent\s*=\s*["']Qualitätssicherung["']/);
  });

  it('nutzt getTenantDisplayName für Avery-Betriebsname statt StevesHof-Hardcode', () => {
    const avery = read('web/avery-labels.js');
    expect(avery).to.include('resolveAveryBetriebDefault');
    expect(avery).to.include('getTenantDisplayName');
    expect(avery).to.not.match(/betrieb:\s*'StevesHof Hofladen'/);
    expect(avery).to.not.match(/betrieb:\s*'STEVESHOF GALLOWAY'/i);
  });
});
