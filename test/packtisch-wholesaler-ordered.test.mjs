import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const js = readFileSync(join(root, 'web/customer-orders.js'), 'utf8');
const css = readFileSync(join(root, 'web/style.css'), 'utf8');
const html = readFileSync(join(root, 'web/index.html'), 'utf8');

describe('Packtisch Großhändler-Vermerk', () => {
  it('kennt Positionsfelder und Aktionen für Großhändler-Bestellung', () => {
    assert.match(js, /data-line-wholesaler-ordered/);
    assert.match(js, /data-line-wholesaler-name/);
    assert.match(js, /procurementStatus/);
    assert.match(js, /supplierName/);
    assert.match(js, /confirm_wholesaler/);
    assert.match(js, /clear_wholesaler/);
    assert.match(js, /wholesaler_ordered/);
    assert.match(js, /function markOrderItemWholesalerOrdered/);
    assert.match(js, /function formatWholesalerOrderedLabel/);
  });

  it('zeigt Vermerk auf der Karte und im Edit-Formular', () => {
    assert.match(js, /order-line-wholesaler/);
    assert.match(js, /Bei Großhändler bestellt/);
    assert.match(css, /\.order-line-wholesaler\b/);
    assert.match(html, /order-activity-log|packtisch-notes|wholesaler-ordered/);
  });
});
