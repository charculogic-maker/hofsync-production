import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'web/index.html'), 'utf8');
const css = readFileSync(join(root, 'web/style.css'), 'utf8');
const sw = readFileSync(join(root, 'web/sw.js'), 'utf8');

describe('Packtisch Abholbereit-Felder klar abgegrenzt', () => {
  it('kennzeichnet Aufnahme- und Edit-Maske als Abholtermin', () => {
    assert.match(html, /customer-order-ready-panel/);
    assert.match(html, /id="order-ready-heading"/);
    assert.match(html, /Abholbereit ab/);
    assert.match(html, /nicht<\/strong> der Zeitpunkt der Aufnahme/);
    assert.match(html, /Datum \(Abholung möglich ab\)/);
    assert.match(html, /Uhrzeit \(Abholung möglich ab\)/);
    assert.match(html, /id="order-edit-ready-heading"/);
    assert.doesNotMatch(
      html.match(/id="order-ready-date"[\s\S]{0,200}/)?.[0] || '',
      />Bereit am</,
    );
  });

  it('hat eigene Panel-Styles und Cache-Buster', () => {
    assert.match(css, /\.customer-order-ready-panel\b/);
    assert.match(css, /\.customer-order-ready-title\b/);
    assert.match(sw, /charculogic-v20261025-finalize-catalog-timeout-v1/);
    assert.match(html, /20261025-month-calendar/);
  });
});
