import { describe, expect, test } from 'vitest';
import { modulesForTier, parseBillingEvent } from '../billingTiers.js';

describe('billingTiers - Kernlogik Unit Tests', () => {
  describe('Fallback-Ermittlung des Tiers anhand der Cent-Beträge', () => {
    test('3900 Cent liefert mhd_retter', () => {
      const event = parseBillingEvent('stripe', {
        id: 'evt_3900',
        type: 'checkout.session.completed',
        data: {
          object: {
            customer_email: 'test@example.com',
            amount_total: 3900,
            metadata: {},
          },
        },
      });
      expect(event.tier).toBe('mhd_retter');
    });

    test('7900 Cent liefert hofladen_komplett', () => {
      const event = parseBillingEvent('stripe', {
        id: 'evt_7900',
        type: 'checkout.session.completed',
        data: {
          object: {
            customer_email: 'test@example.com',
            amount_total: 7900,
            metadata: {},
          },
        },
      });
      expect(event.tier).toBe('hofladen_komplett');
    });

    test('14900 Cent liefert metzgerei_pro', () => {
      const event = parseBillingEvent('stripe', {
        id: 'evt_14900',
        type: 'checkout.session.completed',
        data: {
          object: {
            customer_email: 'test@example.com',
            amount_total: 14900,
            metadata: {},
          },
        },
      });
      expect(event.tier).toBe('metzgerei_pro');
    });

    test('unbekannter Betrag liefert Fallback mhd_retter bei checkout.session.completed', () => {
      const event = parseBillingEvent('stripe', {
        id: 'evt_unknown',
        type: 'checkout.session.completed',
        data: {
          object: {
            customer_email: 'test@example.com',
            amount_total: 9900,
            metadata: {},
          },
        },
      });
      expect(event.tier).toBe('mhd_retter');
    });
  });

  describe('Module-Freischaltung für alle drei Tiers', () => {
    test('mhd_retter schaltet nur relevante Module frei und wurstkueche ist false', () => {
      const modules = modulesForTier('mhd_retter');
      expect(modules.mhd).toBe(true);
      expect(modules.mhdMonitor).toBe(true);
      expect(modules.receiving).toBe(true);
      expect(modules.wareneingang).toBe(true);
      expect(modules.retterBox).toBe(true);
      expect(modules.wurstkueche).toBe(false);
      expect(modules.kitchen).toBe(false);
      expect(modules.team).toBe(false);
      expect(modules.haccp).toBe(false);
    });

    test('hofladen_komplett schaltet Hofladen-Module frei, aber wurstkueche bleibt false', () => {
      const modules = modulesForTier('hofladen_komplett');
      expect(modules.start).toBe(true);
      expect(modules.team).toBe(true);
      expect(modules.orders).toBe(true);
      expect(modules.mhd).toBe(true);
      expect(modules.receiving).toBe(true);
      expect(modules.retterBox).toBe(true);
      expect(modules.haccp).toBe(true);
      expect(modules.buero).toBe(true);
      expect(modules.wurstkueche).toBe(false);
      expect(modules.kitchen).toBe(false);
    });

    test('metzgerei_pro schaltet alle Module frei inklusive wurstkueche', () => {
      const modules = modulesForTier('metzgerei_pro');
      expect(modules.wurstkueche).toBe(true);
      expect(modules.kitchen).toBe(true);
      expect(modules.rezepte).toBe(true);
      expect(modules.haccp).toBe(true);
      expect(modules.mhd).toBe(true);
      expect(modules.team).toBe(true);
      expect(modules.buero).toBe(true);
      expect(modules.wareneingangMetzgerei).toBe(true);
      expect(modules.rezeptAudit).toBe(true);
    });
  });
});
