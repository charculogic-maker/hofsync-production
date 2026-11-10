/**
 * Regression: Betriebs-Admin darf role_modules speichern, auch wenn
 * Knowledge-Sanitize-Metadaten am Dokument kleben.
 */
import { expect } from 'chai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rules = fs.readFileSync(path.join(root, 'firebase.rules'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'web/dev-dashboard.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'web/app.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'web/sw.js'), 'utf8');

describe('role_modules Speichern (Betriebs-Admin)', () => {
  it('Rules erlauben Sanitize-Metadaten neben Rollen-Maps', () => {
    expect(rules).to.match(/function roleModulesAllowedKeys/);
    expect(rules).to.include("'knowledgeSanitizedAt'");
    expect(rules).to.include("'knowledgeSanitizedBy'");
  });

  it('Dashboard und App schreiben role_modules ohne merge', () => {
    const persist = dashboard.slice(
      dashboard.indexOf('async function persistRoleModuleDefaults'),
      dashboard.indexOf('function bindRoleModuleSave'),
    );
    expect(persist).to.include(".doc('role_modules').set({");
    expect(persist).to.not.match(/merge:\s*true/);

    expect(app).to.match(/knowledgeSanitizedBy:\s*'client-load'/);
    expect(app).to.match(/docRef\.set\(\{[\s\S]*?knowledgeSanitizedBy:\s*'client-load'[\s\S]*?\}\)/);
    const sanitize = app.slice(
      app.indexOf('// Vollständiges Set (kein merge)'),
      app.indexOf('return normalized;'),
    );
    expect(sanitize).to.not.match(/merge:\s*true/);
  });

  it('bumpt Service-Worker-Cache für App-JS', () => {
    expect(sw).to.include("const CACHE_NAME = 'charculogic-v20261110-csv-perm-v2'");
  });
});
