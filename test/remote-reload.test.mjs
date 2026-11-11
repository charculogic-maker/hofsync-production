/**
 * Remote Neu-Laden: Prompt-Logik und Rules-Anbindung.
 */
import { expect } from 'chai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const {
  shouldShowReloadPrompt,
  DEFAULT_RELOAD_MESSAGE,
} = await import(path.join(root, 'web/remote-reload.js'));

const rules = fs.readFileSync(path.join(root, 'firebase.rules'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'web/dev-dashboard.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'web/sw.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'web/index.html'), 'utf8');

describe('Remote Reload Prompt', () => {
  it('zeigt Hinweis nur bei required + neuem requestId', () => {
    expect(shouldShowReloadPrompt({
      required: true,
      requestId: 'reload_a',
      ackedRequestId: '',
    })).to.equal(true);

    expect(shouldShowReloadPrompt({
      required: true,
      requestId: 'reload_a',
      ackedRequestId: 'reload_a',
    })).to.equal(false);

    expect(shouldShowReloadPrompt({
      required: false,
      requestId: 'reload_a',
      ackedRequestId: '',
    })).to.equal(false);

    expect(shouldShowReloadPrompt({
      required: true,
      requestId: 'reload_b',
      ackedRequestId: 'reload_a',
      snoozedUntil: Date.now() + 60_000,
      now: Date.now(),
    })).to.equal(false);
  });

  it('hat verständlichen Standardtext ohne Dev-Jargon', () => {
    expect(DEFAULT_RELOAD_MESSAGE).to.match(/speichern/i);
    expect(DEFAULT_RELOAD_MESSAGE).to.match(/App neu laden/i);
    expect(DEFAULT_RELOAD_MESSAGE.toLowerCase()).to.not.include('firestore');
    expect(DEFAULT_RELOAD_MESSAGE.toLowerCase()).to.not.include('service worker');
  });
});

describe('Remote Reload Wiring', () => {
  it('erlaubt settings/appReload in firebase.rules', () => {
    expect(rules).to.match(/function isAppReloadSettings/);
    expect(rules).to.include("'appReload'");
    expect(rules).to.include("'requestId'");
    expect(rules).to.include("'notifyPush'");
    expect(rules).to.match(/\|\| isAppReloadSettings\(document\)/);
  });

  it('bindet Admin-UI und Cache-Asset', () => {
    expect(dashboard).to.include('requestRemoteAppReload');
    expect(dashboard).to.include('bindRemoteReloadAdmin');
    expect(indexHtml).to.include('dev-dashboard-remote-reload-request');
    expect(indexHtml).to.match(/Laden-iPhone neu laden/);
    expect(sw).to.include('/remote-reload.js');
    expect(sw).to.include("const CACHE_NAME = 'charculogic-v20261110-dashboard-responsive-v1'");
  });

  it('zeigt Laden-iPhone neu laden nur für Super-Admins', () => {
    expect(indexHtml).to.match(/id="dev-dashboard-remote-reload"[\s\S]*?data-super-admin-only="1"/);
    expect(indexHtml).to.match(/id="dev-dashboard-remote-reload"[\s\S]*?\bhidden\b/);
    expect(dashboard).to.include('syncRemoteReloadAdminVisibility');
    expect(dashboard).to.match(/section\.hidden\s*=\s*!dashboardStateRef\.isSuperAdmin/);
    expect(dashboard).to.include('Nur die Plattform-Verwaltung darf Laden-iPhones neu laden.');
  });
});
