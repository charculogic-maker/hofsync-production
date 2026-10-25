import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const js = readFileSync(join(root, 'web/customer-orders.js'), 'utf8');
const html = readFileSync(join(root, 'web/index.html'), 'utf8');
const css = readFileSync(join(root, 'web/style.css'), 'utf8');
const sw = readFileSync(join(root, 'web/sw.js'), 'utf8');
const require = createRequire(import.meta.url);
const notifications = require(join(root, 'functions/orderNotifications.js'));

describe('Packtisch Lagerort & Großhändler-Datalist', () => {
  it('persistiert Lagerort-Felder und zeigt sie auf Karte/Detail/Avery', () => {
    assert.match(js, /internalStorageLocation/);
    assert.match(js, /customerPickupNote/);
    assert.match(js, /saveOrderStorageNotes/);
    assert.match(js, /renderOrderStorageBlock/);
    assert.match(js, /avery-label-storage/);
    assert.match(html, /id="order-edit-internal-storage"/);
    assert.match(html, /id="order-edit-customer-pickup-note"/);
    assert.match(css, /\.order-storage-banner\b/);
  });

  it('nutzt dynamische Lieferanten-Vorschläge inkl. procurementStatus', () => {
    assert.match(js, /id="suppliers-list"|suppliers-list/);
    assert.match(js, /collectSupplierSuggestions/);
    assert.match(js, /confirm_wholesaler/);
    assert.match(js, /procurementStatus:\s*'ordered'/);
    assert.match(js, /supplierName/);
    assert.match(js, /orderedAt/);
    assert.match(js, /orderedBy/);
    assert.match(js, /mergeOrderHistory/);
    assert.match(html, /id="suppliers-list"/);
  });

  it('bindet customerPickupNote in die Ready-Mail ein', () => {
    const signal = notifications._test.buildCustomerSignal({
      customerName: 'Testkunde',
      customerEmail: 'test@example.com',
      readyAt: '2026-10-27T13:00',
      customerPickupNote: 'SB-Kühlschrank Fach 2 – Code 4821',
      items: [],
    }, { betriebsName: 'StevesHof' });
    assert.match(signal.message, /Hinweis zur Abholung: SB-Kühlschrank Fach 2/);
    assert.match(signal.htmlMessage, /Hinweis zur Abholung/);
    assert.match(signal.htmlMessage, /SB-Kühlschrank Fach 2/);

    const plain = notifications._test.buildCustomerSignal({
      customerName: 'Testkunde',
      readyAt: '2026-10-27T13:00',
      items: [],
    }, { betriebsName: 'StevesHof' });
    assert.doesNotMatch(plain.htmlMessage, /Hinweis zur Abholung/);
  });

  it('hebt Service-Worker-Cache für Packtisch-Notizen an', () => {
    assert.match(sw, /charculogic-v20261025-thekenklade-sichtbar-v1/);
    assert.match(html, /20261025-month-calendar|ready-fields-clarity|pickup-tbd|packtisch-ux|optional-ready-price|order-activity-log|packtisch-notes|wholesaler-ordered/);
  });
});
