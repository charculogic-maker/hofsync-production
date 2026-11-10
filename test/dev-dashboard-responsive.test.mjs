/**
 * Responsive Geräte-Filterung im Dev-Dashboard:
 * Desktop-only Flächen (CSV, Bedarfs-Tabelle, Plattform, Raumplan) per CSS,
 * ohne DOM-Entfernung — plus Mobile-Tab-Fallback.
 */
import { expect } from 'chai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const indexHtml = read('web/index.html');
const styleCss = read('web/style.css');
const dashboardJs = read('web/dev-dashboard.js');
const sw = read('web/sw.js');
const app = read('web/app.js');

describe('Dev-Dashboard responsive desktop-only filter', () => {
  it('definiert .desktop-only / .desktop-only-notice Breakpoints in style.css', () => {
    expect(styleCss).to.match(/@media \(max-width:\s*768px\)\s*\{[\s\S]*?\.desktop-only\s*\{[\s\S]*?display:\s*none\s*!important/);
    expect(styleCss).to.match(/@media \(max-width:\s*768px\)\s*\{[\s\S]*?\.desktop-only-notice\s*\{[\s\S]*?display:\s*block\s*!important/);
    expect(styleCss).to.match(/@media \(min-width:\s*769px\)\s*\{[\s\S]*?\.desktop-only-notice\s*\{[\s\S]*?display:\s*none\s*!important/);
  });

  it('markiert CSV-Import, Bedarfs-Katalog, Plattform und Raumplan als desktop-only', () => {
    expect(indexHtml).to.match(
      /id="dev-dashboard-csv-product-import"[\s\S]{0,120}?class="[^"]*\bdesktop-only\b|class="[^"]*\bdesktop-only\b[^"]*"[\s\S]{0,120}?id="dev-dashboard-csv-product-import"/,
    );
    expect(indexHtml).to.match(
      /id="dev-dashboard-supply-catalog"[\s\S]{0,120}?class="[^"]*\bdesktop-only\b|class="[^"]*\bdesktop-only\b[^"]*"[\s\S]{0,120}?id="dev-dashboard-supply-catalog"/,
    );
    expect(indexHtml).to.match(
      /id="dev-dashboard-tab-platform"[\s\S]{0,200}?class="[^"]*\bdesktop-only\b|class="[^"]*\bdesktop-only\b[^"]*"[\s\S]{0,200}?id="dev-dashboard-tab-platform"/,
    );
    expect(indexHtml).to.match(
      /id="dev-dashboard-view-platform"[\s\S]{0,160}?class="[^"]*\bdesktop-only\b|class="[^"]*\bdesktop-only\b[^"]*"[\s\S]{0,160}?id="dev-dashboard-view-platform"/,
    );
    expect(indexHtml).to.match(
      /id="betrieb-tab-raumplan"[\s\S]{0,160}?class="[^"]*\bdesktop-only\b|class="[^"]*\bdesktop-only\b[^"]*"[\s\S]{0,160}?id="betrieb-tab-raumplan"/,
    );
    expect(indexHtml).to.match(
      /id="betrieb-panel-raumplan"[\s\S]{0,160}?class="[^"]*\bdesktop-only\b|class="[^"]*\bdesktop-only\b[^"]*"[\s\S]{0,160}?id="betrieb-panel-raumplan"/,
    );
  });

  it('zeigt Mobile-Hinweise für CSV und Bedarfs-Stammdaten', () => {
    expect(indexHtml).to.include('desktop-only-notice');
    expect(indexHtml).to.include('Artikelstamm-Import per CSV am Büro-PC oder Tablet verfügbar.');
    expect(indexHtml).to.include('Bedarfs-Stammdaten &amp; Zuweisungen werden am Büro-PC oder Tablet gepflegt.');
  });

  it('lässt mobil erlaubte Flächen ohne desktop-only', () => {
    expect(indexHtml).to.match(/id="dev-dashboard-view-overview"/);
    expect(indexHtml).to.not.match(/id="dev-dashboard-view-overview"[^>]*\bdesktop-only\b/);
    expect(indexHtml).to.match(/id="dev-dashboard-view-users"/);
    expect(indexHtml).to.not.match(/id="dev-dashboard-view-users"[^>]*\bdesktop-only\b/);
    expect(indexHtml).to.match(/id="dev-dashboard-settings-form"/);
    expect(indexHtml).to.match(/id="dev-dashboard-discount-matrix"/);
    expect(indexHtml).to.not.match(/id="dev-dashboard-discount-matrix"[^>]*\bdesktop-only\b/);
  });

  it('fällt mobil von Plattform/Raumplan zurück ohne Desktop-Blöcke aus dem DOM zu reißen', () => {
    expect(dashboardJs).to.include('isDevDashboardNarrowViewport');
    expect(dashboardJs).to.include("matchMedia('(max-width: 768px)')");
    expect(dashboardJs).to.match(/nextTab === 'platform'[\s\S]*?isDevDashboardNarrowViewport/);
    expect(dashboardJs).to.match(/next === 'raumplan'[\s\S]*?isDevDashboardNarrowViewport/);
    expect(dashboardJs).to.not.match(/getElementById\('dev-dashboard-csv-product-import'\)[\s\S]{0,80}\.remove\(/);
    expect(dashboardJs).to.not.match(/dev-dashboard-supply-catalog[\s\S]{0,80}removeChild/);
  });

  it('hebt den Service-Worker-Cache für diese Änderung an', () => {
    expect(sw).to.include("const CACHE_NAME = 'charculogic-v20261110-dashboard-responsive-v1'");
    expect(app).to.include('sw.js?v=20261110-dashboard-responsive-v1');
  });
});
