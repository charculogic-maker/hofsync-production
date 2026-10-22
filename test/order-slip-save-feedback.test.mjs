/**
 * Bestellung speichern mit Foto: sichtbares Feedback (Busy + Status + Toast).
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { describe, it } from 'mocha';

const customerOrders = readFileSync(new URL('../web/customer-orders.js', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const appJs = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');

describe('Bestellung speichern – Feedback bei Bestellzettel', () => {
  it('hat Statuszeile und Speichern-Button mit id', () => {
    assert.match(indexHtml, /id="order-save-status"/);
    assert.match(indexHtml, /id="order-save-btn"/);
    assert.match(indexHtml, /aria-live="polite"/);
  });

  it('setzt Busy-Zustand bevor der Zettel-Upload startet', () => {
    assert.match(customerOrders, /function setOrderSaveBusy/);
    assert.match(customerOrders, /function setOrderSaveStatus/);
    const createIdx = customerOrders.indexOf('async function createOrderFromForm');
    const busyIdx = customerOrders.indexOf('setOrderSaveBusy(true', createIdx);
    const uploadIdx = customerOrders.indexOf('uploadOrderSlipFile', createIdx);
    assert.ok(createIdx >= 0 && busyIdx > createIdx);
    assert.ok(uploadIdx > busyIdx, 'Busy-Feedback muss vor dem Storage-Upload greifen');
    assert.match(customerOrders, /Zettel wird hochgeladen/);
    assert.match(customerOrders, /Kundenbestellung mit Bestellzettel gespeichert/);
  });

  it('hält Erfolgs-Toast bei Zettel-Speichern länger sichtbar', () => {
    assert.match(appJs, /function showToast\(message, type = "success", durationMs = 3000\)/);
    assert.match(customerOrders, /hasSlips \? 5200 : 3000/);
  });
});
