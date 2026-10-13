/**
 * Smoke checks for the header team switcher markup + SW cache bump.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'chai';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('Mitarbeiter-Schnellwechsler (Header)', () => {
  const indexHtml = read('web/index.html');
  const appJs = read('web/app.js');
  const styleCss = read('web/style.css');
  const swJs = read('web/sw.js');
  const authJs = read('web/auth.js');

  it('renders #btn-team as a real button type=button', () => {
    expect(indexHtml).to.match(
      /<button[\s\S]*?id="btn-team"[\s\S]*?type="button"|<button[\s\S]*?type="button"[\s\S]*?id="btn-team"/,
    );
    expect(indexHtml).to.match(/class="[^"]*btn-team-switch/);
    expect(indexHtml).to.not.match(/<div[^>]*id="employee-session-badge"/);
  });

  it('binds pointerdown and click via bindTeamSwitcherHeaderButton', () => {
    expect(appJs).to.match(/function bindTeamSwitcherHeaderButton/);
    expect(appJs).to.match(/addEventListener\('pointerdown',\s*openSwitcher\)/);
    expect(appJs).to.match(/addEventListener\('click',\s*openSwitcher\)/);
    expect(appJs).to.match(/function showTeamSwitcher/);
    expect(appJs).to.match(/function openPinModal/);
    expect(appJs).to.match(/function openPinTeamSwitcher/);
    expect(appJs).to.match(/verifyEmployeePin/);
    expect(appJs).to.match(/window\.showTeamSwitcher\s*=\s*showTeamSwitcher/);
    expect(appJs).to.match(/window\.openPinModal\s*=\s*openPinModal/);
  });

  it('keeps cancel/close from clearing the active login', () => {
    expect(appJs).to.match(/onClose:\s*\(\)\s*=>\s*close\(''\)/);
    expect(appJs).to.match(/data-team-switch-cancel/);
    expect(appJs).to.match(/profile-session-close/);
    expect(authJs).to.match(/Team-Schnellwechsler \(#btn-team\)/);
  });

  it('applies touch-action manipulation and pointer cursor on the badge', () => {
    expect(styleCss).to.match(/\.btn-team-switch\s*\{[\s\S]*?touch-action:\s*manipulation/);
    expect(styleCss).to.match(/\.btn-team-switch\s*\{[\s\S]*?cursor:\s*pointer/);
  });

  it('bumps the service-worker cache to team-switcher-v1', () => {
    expect(swJs).to.match(
      /const CACHE_NAME = 'charculogic-v20261013-team-switcher-v1'/,
    );
  });
});
