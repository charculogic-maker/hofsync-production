/**
 * Packtisch-Kalender Markup & Abholbereit-Aktionen im Frontend-Quelltext.
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { describe, it } from 'mocha';

const customerOrders = readFileSync(new URL('../web/customer-orders.js', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const styleCss = readFileSync(new URL('../web/style.css', import.meta.url), 'utf8');

describe('Packtisch Kalender & Abholbereit-Nachbearbeitung', () => {
  it('hängt Kalender-Host im Packtisch-View ein', () => {
    assert.match(indexHtml, /id="packtisch-calendar"/);
    assert.match(indexHtml, /Abholung <strong>ab<\/strong>/);
  });

  it('rendert Kalender-Modi und Tagesfilter', () => {
    assert.match(customerOrders, /function renderPacktischCalendar/);
    assert.match(customerOrders, /data-calendar-mode="2weeks"/);
    assert.match(customerOrders, /data-calendar-mode="month"/);
    assert.match(customerOrders, /data-calendar-day=/);
    assert.match(customerOrders, /selectedPickupDayIso/);
  });

  it('erlaubt Weiterbearbeiten und erneute Kunden-Benachrichtigung', () => {
    assert.match(customerOrders, /data-order-action="reopen"|renderPacktischMoreItem\(\s*['"]reopen['"]/);
    assert.match(customerOrders, /data-order-action="notify_ready"|renderPacktischMoreItem\(\s*['"]notify_ready['"]/);
    assert.match(customerOrders, /function requestNotifyCustomerReadyAgain/);
    assert.match(customerOrders, /readyNotifyAt/);
  });

  it('nutzt Abholung mit ab-Label', () => {
    assert.match(customerOrders, /formatPickupReadyLabel/);
    assert.match(styleCss, /\.packtisch-calendar-grid/);
  });
});
