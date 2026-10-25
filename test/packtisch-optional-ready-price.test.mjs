import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'web/index.html'), 'utf8');
const js = readFileSync(join(root, 'web/customer-orders.js'), 'utf8');
const sw = readFileSync(join(root, 'web/sw.js'), 'utf8');
const require = createRequire(import.meta.url);
const notifications = require(join(root, 'functions/orderNotifications.js'));

describe('Packtisch optionaler Waagen-Endpreis in Ready-Mail', () => {
  it('bietet Checkbox im Notify-Modal und persistiert notifyIncludePrice', () => {
    assert.match(html, /id="order-notify-include-price"/);
    assert.match(html, /Waagen-Endpreis in der Nachricht nennen/);
    assert.match(js, /notifyIncludePrice/);
    assert.match(js, /readNotifyIncludePriceFromModal/);
    assert.match(js, /orderHasReliableFinalPrice/);
    assert.match(js, /syncOrderNotifyPriceControls/);
  });

  it('nimmt Preis nur bei Flag und Betrag > 0 in die Mail auf', () => {
    const base = {
      customerName: 'Patrik Rehm',
      customerEmail: 'test@example.com',
      readyAt: '2026-12-25T12:30',
      items: [{ product: 'Steak', quantity: '1', unit: 'kg', pricePerKg: 24.9, actualQuantity: 1 }],
    };
    const withoutFlag = notifications._test.buildCustomerSignal(base, { betriebsName: 'StevesHof' });
    assert.doesNotMatch(withoutFlag.message, /Waagen-Endpreis/);
    assert.doesNotMatch(withoutFlag.htmlMessage, /Waagen-Endpreis/);

    const withFlag = notifications._test.buildCustomerSignal(
      { ...base, notifyIncludePrice: true },
      { betriebsName: 'StevesHof' },
    );
    assert.match(withFlag.message, /Waagen-Endpreis beträgt 24,90 €/);
    assert.match(withFlag.htmlMessage, /Waagen-Endpreis/);

    const zeroPrice = notifications._test.buildCustomerSignal(
      {
        ...base,
        notifyIncludePrice: true,
        items: [{ product: 'Waschpulver', quantity: '2', unit: 'Stück' }],
      },
      { betriebsName: 'StevesHof' },
    );
    assert.equal(notifications._test.shouldIncludeFinalPriceInSignal({
      notifyIncludePrice: true,
      items: [{ product: 'Waschpulver', quantity: '2', unit: 'Stück' }],
    }), false);
    assert.doesNotMatch(zeroPrice.message, /Waagen-Endpreis/);
    assert.doesNotMatch(zeroPrice.htmlMessage, /0,00/);
  });

  it('hebt Cache für optionale Preis-Mail an', () => {
    assert.match(sw, /charculogic-v20261025-phase-a-ux-v1/);
    assert.match(html, /20261025-month-calendar|ready-fields-clarity|pickup-tbd|packtisch-ux|optional-ready-price|order-activity-log|packtisch-notes|wholesaler-ordered/);
  });
});
