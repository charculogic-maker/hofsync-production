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
    assert.match(html, /edit-modal-viewport/);
  });
});
