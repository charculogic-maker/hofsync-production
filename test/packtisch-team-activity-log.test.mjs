import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const js = readFileSync(join(root, 'web/customer-orders.js'), 'utf8');
const css = readFileSync(join(root, 'web/style.css'), 'utf8');
const html = readFileSync(join(root, 'web/index.html'), 'utf8');
const sw = readFileSync(join(root, 'web/sw.js'), 'utf8');

describe('Packtisch Team-Aktivitätsprotokoll', () => {
  it('entfernt Weiling-Vorbelegung in Lieferanten-Eingaben', () => {
    assert.doesNotMatch(js, /value="Weiling"/);
    assert.doesNotMatch(js, /\|\|\s*'Weiling'/);
    assert.doesNotMatch(js, /\|\|\s*"Weiling"/);
    assert.match(js, /Lieferant optional\.\.\./);
    assert.match(js, /Bitte zuerst einen Lieferanten eingeben/);
  });

  it('bietet Inline-Aktivitätserfassung mit Chips und Persistenz', () => {
    assert.match(js, /function addOrderTeamActivity/);
    assert.match(js, /function renderOrderTeamActivityBlock/);
    assert.match(js, /type:\s*'team_activity'/);
    assert.match(js, /act_\$\{Date\.now\(\)\}|act_\$\{Date\.now/);
    assert.match(js, /data-order-action="add_activity"/);
    assert.match(js, /data-activity-chip/);
    assert.match(js, /activities:\s*nextActivities/);
    assert.match(css, /\.order-team-activity\b/);
  });

  it('hebt Cache für Activity-Log an', () => {
    assert.match(sw, /charculogic-v20261025-optional-ready-price-v1/);
    assert.match(html, /optional-ready-price|order-activity-log/);
  });
});
