import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'web/style.css'), 'utf8');
const js = readFileSync(join(root, 'web/customer-orders.js'), 'utf8');
const html = readFileSync(join(root, 'web/index.html'), 'utf8');

describe('Packtisch Edit-Modal Viewport', () => {
  it('vermeidet transform in page fadeIn (kein Fixed-Containing-Block)', () => {
    const fade = css.match(/@keyframes fadeIn\s*\{[\s\S]*?\}/);
    assert.ok(fade, 'fadeIn keyframes vorhanden');
    assert.doesNotMatch(fade[0], /transform\s*:/);
  });

  it('hängt Edit-/Notify-Modal an document.body', () => {
    assert.match(js, /function mountOrderModalOnBody/);
    assert.match(js, /mountOrderModalOnBody\(document\.getElementById\('order-edit-modal'\)\)/);
    assert.match(js, /mountOrderModalOnBody\(document\.getElementById\('order-notify-modal'\)\)/);
  });

  it('hat Edit-Modal-Markup und Cache-Buster', () => {
    assert.match(html, /id="order-edit-modal"/);
    assert.match(html, /20261025-month-calendar|ready-fields-clarity|pickup-tbd|packtisch-ux|optional-ready-price|order-activity-log|ready-fields-clarity|packtisch-notes|wholesaler-ordered/);
  });

  it('stellt Positionen und Änderungsnotiz oben im Edit-Modal bereit', () => {
    assert.match(html, /Aktuelle Positionen \(zum Packen\)/);
    assert.match(html, /id="order-edit-amendment-note"/);
    assert.match(html, /id="order-edit-original-section"/);
    assert.match(html, /order-edit-scroll/);
    assert.match(js, /originalItems/);
    assert.match(js, /renderOrderAmendmentBlock/);
    assert.match(js, /amendmentNote/);
  });
});
