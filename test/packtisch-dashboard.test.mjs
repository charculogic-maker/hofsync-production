/**
 * Packtisch-Dashboard, Vergangene, Bearbeiten & Notify-Kanäle.
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { describe, it } from 'mocha';
import {
  aggregatePastOrderProducts,
  classifyPacktischBucket,
  filterPastOrders,
  normalizeNotifyChannels,
  summarizePacktischDashboard,
  wantsAnyReadyNotify,
  wantsNotifyChannel,
} from '../web/order-packlist.js';

const customerOrders = readFileSync(new URL('../web/customer-orders.js', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const styleCss = readFileSync(new URL('../web/style.css', import.meta.url), 'utf8');

describe('Packtisch Dashboard & Vergangene (Logik)', () => {
  const today = '2026-10-24';

  it('ordnet Bestellungen in Dashboard-Buckets', () => {
    assert.equal(classifyPacktischBucket({ status: 'open', readyAt: '2026-10-24T10:00' }, today), 'due');
    assert.equal(classifyPacktischBucket({ status: 'open', readyAt: '2026-10-26T10:00' }, today), 'open');
    assert.equal(classifyPacktischBucket({ status: 'in_progress', readyAt: '2026-10-26T10:00' }, today), 'in_progress');
    assert.equal(classifyPacktischBucket({ status: 'ready', readyAt: '2026-10-24T10:00' }, today), 'ready');
    assert.equal(classifyPacktischBucket({ status: 'picked_up' }, today), null);
  });

  it('summiert Dashboard-Zähler', () => {
    const summary = summarizePacktischDashboard([
      { status: 'open', readyAt: '2026-10-23T09:00' },
      { status: 'open', readyAt: '2026-10-28T09:00' },
      { status: 'in_progress', readyAt: '2026-10-24T11:00' },
      { status: 'ready', readyAt: '2026-10-24T12:00' },
      { status: 'picked_up', readyAt: '2026-10-20T12:00' },
    ], today);
    assert.deepEqual(summary, {
      due: 1,
      open: 1,
      in_progress: 1,
      ready: 1,
      total: 4,
    });
  });

  it('aggregiert Produkte vergangener Bestellungen mit Wochentag-Filter', () => {
    const orders = [
      {
        status: 'picked_up',
        readyAt: '2026-10-24T12:00', // Samstag
        items: [{ product: 'Rosinenstuten', quantity: 1, unit: 'Stück' }],
      },
      {
        status: 'picked_up',
        readyAt: '2026-10-23T12:00', // Freitag
        items: [
          { product: 'Rosinenstuten', quantity: 2, unit: 'Stück' },
          { product: 'Mehrkornbrot', quantity: 1, unit: 'Stück' },
        ],
      },
      {
        status: 'cancelled',
        readyAt: '2026-10-17T12:00',
        items: [{ product: 'Mehrkornbrot', quantity: 1, unit: 'Stück' }],
      },
    ];
    const all = aggregatePastOrderProducts(orders, {
      rangeDays: 30,
      now: new Date('2026-10-24T15:00:00'),
    });
    const rosinen = all.find((row) => row.product === 'Rosinenstuten');
    const mehrkorn = all.find((row) => row.product === 'Mehrkornbrot');
    assert.equal(rosinen?.orderCount, 2);
    assert.equal(mehrkorn?.orderCount, 2);
    assert.equal(all.length, 2);

    const fridayOnly = aggregatePastOrderProducts(orders, {
      rangeDays: 30,
      weekday: 5,
      now: new Date('2026-10-24T15:00:00'),
    });
    assert.equal(fridayOnly.length, 2);
    assert.ok(fridayOnly.some((row) => row.product === 'Mehrkornbrot'));

    const pastFri = filterPastOrders(orders, {
      rangeDays: 30,
      weekday: 5,
      now: new Date('2026-10-24T15:00:00'),
    });
    assert.equal(pastFri.length, 1);
  });

  it('respektiert Notify-Kanal-Auswahl inkl. Legacy-Default', () => {
    assert.deepEqual(normalizeNotifyChannels(undefined), {
      email: true,
      sms: true,
      whatsapp: false,
    });
    assert.deepEqual(normalizeNotifyChannels({ email: true, sms: false, whatsapp: false }), {
      email: true,
      sms: false,
      whatsapp: false,
    });
    assert.equal(wantsAnyReadyNotify({ skipNotify: true, notifyChannels: { email: true } }), false);
    assert.equal(wantsNotifyChannel({ notifyChannels: { email: true, sms: false } }, 'email'), true);
    assert.equal(wantsNotifyChannel({ notifyChannels: { email: true, sms: false } }, 'sms'), false);
  });
});

describe('Packtisch Dashboard & Vergangene (Markup)', () => {
  it('hängt Dashboard, Vergangene-Tab und Modals ein', () => {
    assert.match(indexHtml, /id="packtisch-dashboard"/);
    assert.match(indexHtml, /data-orders-view="vergangen"/);
    assert.match(indexHtml, /id="past-orders-chart"/);
    assert.match(indexHtml, /id="order-edit-modal"/);
    assert.match(indexHtml, /id="order-notify-modal"/);
    assert.match(indexHtml, /order-notify-whatsapp/);
  });

  it('rendert Dashboard und Bearbeiten/Notify-Flows im Frontend', () => {
    assert.match(customerOrders, /function renderPacktischDashboard/);
    assert.match(customerOrders, /function renderPastOrdersView/);
    assert.match(customerOrders, /data-order-action="edit"/);
    assert.match(customerOrders, /function openOrderEditModal/);
    assert.match(customerOrders, /function openOrderNotifyModal/);
    assert.match(customerOrders, /notifyChannels/);
    assert.match(styleCss, /\.packtisch-dashboard-grid/);
    assert.match(styleCss, /\.past-orders-bar-fill/);
  });
});
