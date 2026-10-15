/**
 * Boot-Branding: StevesHof Hofladen als Fallback, kein Modul-Untertitel-Override.
 */
import { expect } from 'chai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('Header-Branding Boot', () => {
  it('setzt StevesHof Hofladen als Default und Cache-Key', () => {
    const branding = read('web/branding.js');
    const index = read('web/index.html');
    const app = read('web/app.js');

    expect(branding).to.match(/DEFAULT_BRAND_TITLE\s*=\s*'StevesHof Hofladen'/);
    expect(branding).to.match(/BRAND_TITLE_STORAGE_KEY\s*=\s*'charculogic_brand_title'/);
    expect(branding).to.match(/betriebsName:\s*DEFAULT_BRAND_TITLE/);
    expect(index).to.include('charculogic_brand_title');
    expect(index).to.include('id="header-subtitle">StevesHof Hofladen<');
    expect(app).to.include('applyHeaderBrandName');
    expect(app).to.match(/Mandantenname.*nie mit Modul/);
    expect(app).to.not.match(/headerSubtitle\.textContent\s*=\s*["']Qualitätssicherung["']/);
  });
});
