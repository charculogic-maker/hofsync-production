import { describe, expect, test } from 'vitest';
import {
  PORTAL_ORDER_TENANT_ALLOWLIST,
  assertPortalTenantAllowed,
  buildReadyAt,
  mapPortalOrderToCustomerOrder,
} from '../portalOrderMapper.js';

describe('portalOrderMapper', () => {
  test('allowlist enthält Soft-Launch-Mandanten', () => {
    expect(PORTAL_ORDER_TENANT_ALLOWLIST).toContain('StevesHof_Hauptbetrieb');
    expect(PORTAL_ORDER_TENANT_ALLOWLIST).toContain('biohof_mueller');
  });

  test('fremde tenantId wird abgelehnt', () => {
    expect(() => assertPortalTenantAllowed('not_on_allowlist_tenant')).toThrow(/nimmt Online-Vorbestellungen noch nicht an/i);
  });

  test('buildReadyAt und Payload für Packtisch', () => {
    expect(buildReadyAt('2026-11-01', { start: '16:00' })).toBe('2026-11-01T16:00');
    const { payload, tenantId } = mapPortalOrderToCustomerOrder({
      ref: 'SH-ABC',
      channel: 'sb',
      pickupDate: '2026-11-01',
      pickupSlot: { start: '16:00', label: '16:00 – 18:00 Uhr' },
      customer: { name: 'Max', phone: '+491701234', email: 'max@example.de' },
      items: [{ name: 'Rumpsteak', productId: 'r1', weightKg: 0.5, pricePerKg: 32, estimatedPrice: 16 }],
      estimatedTotal: 16,
    }, 'biohof_mueller');
    expect(tenantId).toBe('biohof_mueller');
    expect(payload.status).toBe('open');
    expect(payload.source).toBe('portal');
    expect(payload.channel).toBe('sb');
    expect(payload.customerEmail).toBe('max@example.de');
    expect(payload.items[0].pricePerKg).toBe(32);
  });
});
