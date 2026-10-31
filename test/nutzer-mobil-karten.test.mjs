/**
 * Admin Nutzer mobil: Karten + Aktionen hinter ⋯.
 */
import { expect } from 'chai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('Nutzer mobil (Karten + ⋯)', () => {
  const dash = read('web/dev-dashboard.js');
  const css = read('web/style.css');
  const sw = read('web/sw.js');
  const app = read('web/app.js');

  it('rendert Nutzerzeilen mit ⋯-Menü und denselben data-action Buttons', () => {
    expect(dash).to.match(/data-action="toggle-employee-menu"/);
    expect(dash).to.match(/class="dev-dashboard-employee-more-btn"/);
    expect(dash).to.match(/class="dev-dashboard-employee-more-menu"/);
    expect(dash).to.match(/data-action="toggle-role"/);
    expect(dash).to.match(/data-action="reset-password"/);
    expect(dash).to.match(/data-action="\$\{disableAction\}"/);
    expect(dash).to.match(/data-label="Person"/);
    expect(dash).to.match(/data-label="Aktionen"/);
  });

  it('schließt und öffnet das Aktionsmenü per Delegation', () => {
    expect(dash).to.match(/action === 'toggle-employee-menu'/);
    expect(dash).to.match(/closeAllEmployeeMenus/);
    expect(dash).to.match(/Escape/);
  });

  it('formatiert Nutzer auf Mobile als Karten und Desktop inline', () => {
    expect(css).to.match(/\.dev-dashboard-table--employees tbody tr\[data-employee-row\]/);
    expect(css).to.match(/grid-template-areas:/);
    expect(css).to.match(/\.dev-dashboard-employee-more-btn/);
    expect(css).to.match(/@media \(min-width: 769px\)/);
    expect(css).to.match(/display: none !important;/);
  });

  it('bumpt den Service-Worker-Cache für we-herkunft-lot', () => {
    expect(sw).to.include("const CACHE_NAME = 'charculogic-v20261031-knowledge-employee-v1'");
    expect(app).to.include('sw.js?v=20261031-knowledge-employee-v1');
  });
});
