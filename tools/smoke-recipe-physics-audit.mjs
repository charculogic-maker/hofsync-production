#!/usr/bin/env node
/**
 * Smoke: Physik-Audit der 40 Wurstrezepte + Regression gegen Brühwurst-Template in Kochwurst.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bratwurstRecipes } from '../web/rezepte.js';
import {
  auditRecipePhysics,
  classifyRecipeFamily,
  fixKochwurstColdTemplate,
} from './audit-recipe-physics.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

assert.equal(bratwurstRecipes.length, 40, 'Masterliste enthält 40 Rezepte');
assert.ok(
  bratwurstRecipes.every((r) => r.auditStatus === 'verified' || r.auditStatus === 'review_needed'),
  'Jedes Rezept hat auditStatus',
);

const gLw = bratwurstRecipes.find((r) => r.id === 'G-LW');
assert.ok(gLw, 'G-LW vorhanden');
assert.equal(classifyRecipeFamily(gLw), 'kochwurst');
assert.match(String(gLw.tipp || ''), /Warmemulsion/);
assert.match(String(gLw.anweisung_B || ''), /42\s*[–-]\s*46/);
assert.equal(gLw.auditStatus, 'verified');
const gLwAudit = auditRecipePhysics(gLw);
assert.equal(gLwAudit.ok, true, `G-LW muss fehlerfrei sein: ${gLwAudit.errors.join('; ')}`);

const pfalzer = bratwurstRecipes.find((r) => r.id === 'GS-Pfälzer-LW');
assert.ok(pfalzer, 'GS-Pfälzer-LW vorhanden');
assert.match(String(pfalzer.anweisung_B || ''), /Warmemulsion|42/);
assert.equal(auditRecipePhysics(pfalzer).ok, true, 'Pfälzer Leberwurst fehlerfrei');

// Regression: Brühwurst-Kaltkutter-Maske in Kochwurst muss erkannt werden
const poisoned = {
  id: 'TEST-LW-COLD',
  name: 'Test Leberwurst Kaltkutter',
  kat: 'Kochwurst',
  tipp: '',
  anweisung_A: 'Fleisch, Fett, Eis oder Schuettung auf 0 bis 2 Grad C vorkuehlen.',
  anweisung_B: 'Fett und restliche Schuettung kalt einarbeiten; die Masse moeglichst unter 12 Grad C halten.',
  anweisung_C: 'Fuellen.',
  anweisung_D: 'Bei 72 bis 78 Grad C bruehen oder daempfen.',
  ingredients: [{ name: 'Rinderleber', pct: 30, typ: 'base' }],
};
const poisonedAudit = auditRecipePhysics(poisoned);
assert.equal(poisonedAudit.ok, false, 'Kaltkutter-Template in Kochwurst muss Fehler flaggen');
assert.ok(
  poisonedAudit.errors.some((e) => /Kaltkutter|≤ 15|Warmemulsion/i.test(e)),
  `Erwarteter Kaltkutter-Fehler, got: ${poisonedAudit.errors.join('; ')}`,
);

const { changed, notes } = fixKochwurstColdTemplate(poisoned);
assert.equal(changed, true, 'fixKochwurstColdTemplate korrigiert Kaltkutter-Maske');
assert.ok(notes.length, 'Korrektur-Notizen vorhanden');
assert.equal(auditRecipePhysics(fixKochwurstColdTemplate(poisoned).recipe).ok, true, 'Nach Fix fehlerfrei');

// Rohwurst darf nicht gebrüht werden
const rawPoison = {
  id: 'TEST-RAW-COOK',
  name: 'Test Mettwurst',
  kat: 'Rohwurst',
  anweisung_A: 'Fleisch kuehlen.',
  anweisung_B: 'Wolfen.',
  anweisung_C: 'Fuellen.',
  anweisung_D: 'Bei 72 Grad C bruehen bis Kerntemperatur 72 Grad C.',
  ingredients: [
    { name: 'Schweinefleisch', pct: 70, typ: 'base' },
    { name: 'Meersalz', pct: 2, typ: 'spice' },
    { name: 'Starterkulturen', pct: 0.05, typ: 'spice' },
  ],
};
assert.equal(auditRecipePhysics(rawPoison).ok, false, 'Brühen in Rohwurst muss Fehler flaggen');

const swSrc = read('web/sw.js');
assert.match(swSrc, /CACHE_NAME = 'charculogic-v\d{8}-[^']+'/);
assert.ok(existsSync(path.join(root, 'reports', 'audit_rezepte_status.md')), 'Audit-Report vorhanden');

const report = read('reports/audit_rezepte_status.md');
assert.match(report, /Grün \(fehlerfrei/);
assert.match(report, /\|\s*\*\*Gesamt\*\*\s*\|\s*\*\*40\*\*/);

const all = bratwurstRecipes.map((r) => ({ id: r.id, ...auditRecipePhysics(r) }));
const fails = all.filter((r) => !r.ok);
assert.equal(fails.length, 0, `Masterliste fehlerfrei, aber: ${fails.map((f) => f.id).join(', ')}`);

console.log('OK smoke-recipe-physics-audit: 40 Rezepte physikalisch geprüft, G-LW/Pfälzer verified, Regressionen grün.');
