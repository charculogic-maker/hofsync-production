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

describe('Packtisch Karten: 1 Primary Action', () => {
  it('rendert status-gesteuerte Primary-Buttons und Mehr-Menü', () => {
    assert.match(js, /function renderPacktischCardActions/);
    assert.match(js, /function renderPacktischMoreMenu/);
    assert.match(js, /In Bearbeitung nehmen/);
    assert.match(js, /Nachwiegen &amp; Bereitstellen|Nachwiegen & Bereitstellen/);
    assert.match(js, /Als abgeholt markieren/);
    assert.match(js, /data-order-action="weigh_ready"/);
    assert.match(js, /['"]back_to_open['"]/);
    assert.match(js, /packtisch-more-summary/);
    assert.match(js, /··· Mehr/);
    assert.match(css, /\.packtisch-actions--primary\b/);
    assert.match(css, /\.packtisch-more-menu\b/);
  });

  it('klappt Großhändler-Eingabe und Notiz-Composer standardmäßig ein', () => {
    assert.match(js, /Großhändler vermerken/);
    assert.match(js, /Notiz hinzufügen/);
    assert.match(js, /expandedActivityOrderId/);
    assert.match(js, /expandedWholesalerKeys/);
    assert.match(js, /canMarkWholesalerOnCard/);
    assert.match(css, /\.packtisch-wholesaler-toggle\b/);
    assert.match(css, /\.packtisch-activity-toggle\b/);
  });

  it('hebt Cache für Packtisch-UX-Verschlankung an', () => {
    assert.match(sw, /charculogic-v20261025-mein-betrieb-split-v1/);
    assert.match(html, /20261025-month-calendar|ready-fields-clarity|pickup-tbd|packtisch-ux|optional-ready-price|order-activity-log|packtisch-notes|wholesaler-ordered/);
  });
});
