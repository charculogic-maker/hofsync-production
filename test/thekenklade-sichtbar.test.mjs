/**
 * Thekenklade wieder auffindbar: Herkunft-Nav, Admin-Shortcut, Deep-Link.
 */
import { expect } from 'chai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('Thekenklade sichtbar', () => {
  const html = read('web/index.html');
  const app = read('web/app.js');
  const trace = read('web/traceability.js');
  const docs = read('docs/modulanleitungen/07-herkunft.md');
  const sw = read('web/sw.js');

  it('nennt den Primärtab Herkunft statt Doku', () => {
    const tabBlock = html.match(/id="tab-chargen-doku"[\s\S]*?<\/button>/)?.[0] || '';
    expect(tabBlock).to.include('<span>Herkunft</span>');
    expect(tabBlock).to.not.include('<span>Doku</span>');
    expect(app).to.match(/headerTitle\.textContent\s*=\s*["']Herkunft["']/);
  });

  it('bietet Admin-Shortcut Thekenklade im Header-Zahnrad', () => {
    expect(html).to.match(/data-admin-module="thekenbuch"/);
    expect(html).to.match(/Thekenklade/);
    expect(app).to.match(/thekenbuch:\s*\{/);
    expect(app).to.match(/activateThekenbuchPanel/);
    expect(app).to.match(/thekenbuch:\s*hasModule\('chargenDoku'/);
  });

  it('Deep-Link #thekenbuch öffnet die Buchansicht', () => {
    expect(app).to.match(/function resolveChargenDokuPanelFromHash/);
    expect(app).to.match(/function applyChargenDokuDeepLink/);
    expect(app).to.match(/thekenbuch/);
    expect(app).to.match(/thekenklade/);
    expect(trace).to.match(/export function activateThekenbuchPanel/);
    expect(trace).to.match(/activateChargenDokuTab\(\{\s*panel:\s*'book'\s*\}\)/);
  });

  it('Dashboard-Übersicht verlinkt zur Thekenklade', () => {
    expect(html).to.match(/id="dev-dashboard-jump-thekenbuch"/);
    expect(html).to.match(/href="\/#thekenbuch"/);
  });

  it('aktualisiert die Modul-Anleitung auf Laden-Pfad', () => {
    expect(docs).to.match(/Herkunft → Thekenklade/);
    expect(docs).to.not.match(/\/dev-dashboard → Rückverfolgbarkeit/);
    expect(docs).to.match(/#thekenbuch/);
  });

  it('bumpt den Service-Worker-Cache', () => {
    expect(sw).to.include("const CACHE_NAME = 'charculogic-v20261025-we-herkunft-lot-v1'");
    expect(app).to.include('sw.js?v=20261025-we-herkunft-lot');
  });
});
