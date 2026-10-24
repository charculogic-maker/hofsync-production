#!/usr/bin/env node
/**
 * Prüft, dass die Rabattstaffel in „Mein Betrieb“ liegt und speicherbar ist.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getDefaultDiscountMatrix,
  normalizeDiscountMatrix,
} from '../web/discount-matrix.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'web/index.html'), 'utf8');
const rules = fs.readFileSync(path.join(root, 'firebase.rules'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'web/discount-matrix-ui.js'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'web/dev-dashboard.js'), 'utf8');
const matrixSrc = fs.readFileSync(path.join(root, 'web/discount-matrix.js'), 'utf8');

const settingsStart = html.indexOf('id="dev-dashboard-view-settings"');
const settingsEnd = html.indexOf('id="dev-dashboard-haccp-setup"');
assert.ok(settingsStart >= 0 && settingsEnd > settingsStart, 'Mein-Betrieb-Ansicht fehlt');
const settingsView = html.slice(settingsStart, settingsEnd);

assert.match(settingsView, /id="dev-dashboard-discount-matrix"/, 'Panel fehlt in Mein Betrieb');
assert.match(settingsView, /id="discount-matrix-card"/, 'Matrix-Karte fehlt in Mein Betrieb');
assert.match(settingsView, /id="discount-matrix-save"/, 'Speichern-Button fehlt');
assert.match(settingsView, /id="discount-matrix-reset"/, 'Standard-Button fehlt');
assert.match(settingsView, /id="discount-matrix-enabled"/, 'Aktiv-Schalter fehlt');

const cardMatches = html.match(/id="discount-matrix-card"/g) || [];
assert.equal(cardMatches.length, 1, 'discount-matrix-card darf nur einmal vorkommen (Mein Betrieb)');

assert.match(rules, /function isDiscountMatrixSettings/, 'Firestore-Rule fehlt');
assert.match(rules, /\|\| isDiscountMatrixSettings\(document\)/, 'Rule nicht an create/update angebunden');
assert.match(ui, /canEditDiscountMatrix/, 'Admin-Guard fehlt');
assert.match(ui, /export async function refreshDiscountMatrixUi/, 'Refresh-API fehlt');
assert.match(dashboard, /refreshDiscountMatrixUi/, 'Mein-Betrieb-Tab lädt Matrix nicht');
assert.match(matrixSrc, /tenantId: id/, 'save muss tenantId setzen');

const defaults = getDefaultDiscountMatrix();
assert.equal(defaults.enabled, true);
assert.ok(defaults.categoryOverrides.Milch.length >= 1);
assert.ok(defaults.categoryOverrides.Trockenware.length >= 1);

const normalized = normalizeDiscountMatrix({
  enabled: true,
  tenantId: 'DemoHof',
  defaultRules: defaults.defaultRules,
  categoryOverrides: { Milch: defaults.categoryOverrides.Milch },
});
assert.equal(normalized.categoryOverrides.Trockenware.length, 3, 'fehlende Trockenware-Override wird ergänzt');

console.log('Mein-Betrieb Rabattstaffel-Check bestanden.');
