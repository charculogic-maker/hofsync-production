import { describe, expect, test } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  buildCustomerSignal,
  calculateFinalOrderPrice,
} = require('../orderNotifications')._test;

describe('orderNotifications Kunden-Signal Preis', () => {
  test('nutzt finalPrice wenn gesetzt', () => {
    expect(calculateFinalOrderPrice({ finalPrice: 12.34, items: [] })).toBe(12.34);
  });

  test('rechnet Waagengewicht * pricePerKg', () => {
    const total = calculateFinalOrderPrice({
      items: [{ product: 'Rumpsteak', pricePerKg: 65.99, actualWeightGrams: 1000 }],
    });
    expect(total).toBe(65.99);
  });

  test('buildCustomerSignal enthält Waagen-Endpreis', () => {
    const signal = buildCustomerSignal({
      customerName: 'Anna',
      customerEmail: 'anna@example.com',
      callbackPhone: '01761234567',
      readyAt: '2026-10-20T09:00',
      readyMarkedBy: 'Thomas',
      finalPrice: 15,
      items: [],
    }, { betriebsName: 'StevesHof' });
    expect(signal.message).toMatch(/15,00/);
    expect(signal.message).toMatch(/Thomas/);
    expect(signal.to.email).toBe('anna@example.com');
  });
});
