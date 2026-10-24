import { describe, expect, test } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  buildCustomerSignal,
  formatPickupWindow,
  shouldSendReadySignal,
  wantsAnyReadyNotify,
} = require('../orderNotifications')._test;

describe('orderNotifications Ready-Signal', () => {
  test('formatiert Abholfenster mit ab statt um', () => {
    const window = formatPickupWindow('2026-10-24T14:30:00');
    expect(window).toMatch(/ab 14:30/);
    expect(window).not.toMatch(/\bum\b/);
  });

  test('Kundenmail nutzt ab-Fenster ohne doppeltes ab', () => {
    const signal = buildCustomerSignal({
      customerName: 'Esther',
      customerEmail: 'esther@example.com',
      readyAt: '2026-10-24T14:30:00',
      readyMarkedBy: 'Patrik',
      items: [{ quantity: 1, pricePerKg: 10, actualQuantity: 1 }],
    }, { betriebsName: 'StevesHof' });
    expect(signal.message).toContain('Du kannst es');
    expect(signal.message).toMatch(/ab 14:30 Uhr abholen/);
    expect(signal.message).not.toMatch(/ab .+ um /);
    expect(signal.subject).toBe('Dein Genuss-Paket ist abholbereit');
  });

  test('Update-Mail bei readyNotifyAt-Änderung', () => {
    expect(shouldSendReadySignal({ status: 'in_progress' }, { status: 'ready' })).toEqual({
      send: true,
      kind: 'initial',
    });
    expect(shouldSendReadySignal(
      { status: 'ready', readyNotifyAt: '2026-10-21T10:00:00.000Z' },
      { status: 'ready', readyNotifyAt: '2026-10-21T11:00:00.000Z' },
    )).toEqual({ send: true, kind: 'update' });
    expect(shouldSendReadySignal(
      { status: 'ready', readyNotifyAt: '2026-10-21T10:00:00.000Z' },
      { status: 'ready', readyNotifyAt: '2026-10-21T10:00:00.000Z' },
    )).toEqual({ send: false, kind: null });

    const update = buildCustomerSignal({
      customerName: 'Esther',
      customerEmail: 'esther@example.com',
      readyAt: '2026-10-24T14:30:00',
      readyNotifyBy: 'Patrik',
      items: [],
    }, { betriebsName: 'StevesHof' }, { kind: 'update' });
    expect(update.subject).toMatch(/^Update:/);
    expect(update.message).toContain('Update');
  });

  test('skipNotify unterdrückt Ready-Mail (Sicherheitsnetz)', () => {
    expect(wantsAnyReadyNotify({ skipNotify: true, notifyChannels: { email: true } })).toBe(false);
    expect(shouldSendReadySignal(
      { status: 'in_progress' },
      { status: 'ready', skipNotify: true },
    )).toEqual({ send: false, kind: null, skipped: true });
    expect(shouldSendReadySignal(
      { status: 'in_progress' },
      { status: 'ready', notifyChannels: { email: false, sms: false, whatsapp: false } },
    )).toEqual({ send: false, kind: null, skipped: true });
  });
});
