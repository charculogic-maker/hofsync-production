import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  classifyPacktischBucket,
  formatOrderPickupLabel,
  isOrderPickupTbd,
} from '../web/order-packlist.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const js = readFileSync(join(root, 'web/customer-orders.js'), 'utf8');
const html = readFileSync(join(root, 'web/index.html'), 'utf8');
const css = readFileSync(join(root, 'web/style.css'), 'utf8');
const sw = readFileSync(join(root, 'web/sw.js'), 'utf8');

describe('Packtisch Abholdatum noch absprechen', () => {
  it('erkennt Anfragen ohne Termin und hält sie unter Fällig sichtbar', () => {
    assert.equal(isOrderPickupTbd({ pickupTbd: true }), true);
    assert.equal(isOrderPickupTbd({
      additionalWishes: 'Website-Kontaktformular · Abholdatum noch absprechen',
    }), true);
    assert.equal(isOrderPickupTbd({
      readyAt: '2026-10-25T12:00',
      additionalWishes: 'Abholdatum noch absprechen',
    }), false);
    assert.equal(formatOrderPickupLabel({ pickupTbd: true }), 'noch absprechen');
    assert.equal(
      classifyPacktischBucket({ status: 'open', pickupTbd: true }, '2026-10-25'),
      'due',
    );
  });

  it('bietet Checkbox in Aufnahme und Edit ohne required-Datum', () => {
    assert.match(html, /id="order-pickup-tbd"/);
    assert.match(html, /id="order-edit-pickup-tbd"/);
    assert.match(html, /Abholdatum noch absprechen/);
    assert.match(js, /function syncPickupTbdUi/);
    assert.match(js, /function readPickupScheduleFromForm/);
    assert.match(js, /pickupTbd:\s*schedule\.pickupTbd/);
    assert.doesNotMatch(
      html,
      /id="order-edit-ready-date"[^>]*required/,
    );
    assert.match(css, /\.customer-order-inquiry-badge\b/);
  });

  it('hebt Cache für Pickup-TBD an', () => {
    assert.match(sw, /charculogic-v20261026-phase-d-header-v1/);
    assert.match(html, /20261025-month-calendar/);
  });
});
