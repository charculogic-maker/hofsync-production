import crypto from 'crypto';
import { readFileSync } from 'fs';
import { describe, expect, test } from 'vitest';
import {
  applyModulePatch,
  minimalReadOnlyModules,
  modulesForTier,
  parseBillingEvent,
  verifyLemonSignature,
  verifyStripeSignature,
} from '../billingTiers.js';

function authAs({ uid = 'uid-test', tenantId = 'torfabrik', role = 'admin', email = 'admin@example.de' } = {}) {
  return { uid, token: { tenantId, role, email, isAdmin: role === 'admin' } };
}

describe('Phase 3 tariffs', () => {
  test('mhd_retter opens monitor, receiving and retter box only', () => {
    const modules = modulesForTier('mhd_retter');
    expect(modules.mhd).toBe(true);
    expect(modules.mhdMonitor).toBe(true);
    expect(modules.receiving).toBe(true);
    expect(modules.wareneingang).toBe(true);
    expect(modules.retterBox).toBe(true);
    expect(modules.haccp).toBe(false);
    expect(modules.team).toBe(false);
    expect(modules.orders).toBe(false);
    expect(modules.buero).toBe(false);
    expect(modules.kitchen).toBe(false);
    expect(modules.wurstkueche).toBe(false);
    expect(modules.rezepte).toBe(false);
  });

  test('hofladen_komplett keeps the butcher modules closed', () => {
    const modules = modulesForTier('hofladen_komplett');
    expect(modules.haccp).toBe(true);
    expect(modules.team).toBe(true);
    expect(modules.buero).toBe(true);
    expect(modules.batches).toBe(true);
    expect(modules.kitchen).toBe(false);
    expect(modules.wareneingangMetzgerei).toBe(false);
    expect(modules.rezeptAudit).toBe(false);
  });

  test('metzgerei_pro opens kitchen aliases the rules already understand', () => {
    const modules = modulesForTier('metzgerei_pro');
    expect(modules.kitchen).toBe(true);
    expect(modules.wurstkueche).toBe(true);
    expect(modules.rezepte).toBe(true);
    expect(modules.wareneingangMetzgerei).toBe(true);
    expect(modules.rezeptAudit).toBe(true);
    expect(modules.haccp).toBe(true);
  });

  test('cancellation map closes every flag', () => {
    const modules = minimalReadOnlyModules();
    expect(Object.values(modules).every((value) => value === false)).toBe(true);
  });

  test('an explicit kitchen toggle also closes the recipe alias', () => {
    const next = applyModulePatch(
      { kitchen: true, wurstkueche: true, rezepte: true, mhd: true },
      { kitchen: false },
    );
    expect(next.kitchen).toBe(false);
    expect(next.wurstkueche).toBe(false);
    expect(next.rezepte).toBe(false);
    expect(next.mhd).toBe(true);
  });

  test('unknown module keys are rejected', () => {
    expect(() => applyModulePatch({}, { notAModule: true })).toThrow(/Unbekanntes Modul/);
  });
});

describe('Phase 3 webhook signatures', () => {
  test('accepts a fresh Stripe signature and rejects a wrong secret', () => {
    const secret = 'whsec_test';
    const body = '{"id":"evt_1"}';
    const timestamp = '1700000000';
    const digest = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
    const header = `t=${timestamp},v1=${digest}`;
    const now = 1700000000 * 1000;
    expect(verifyStripeSignature(body, header, secret, now)).toBe(true);
    expect(verifyStripeSignature(body, `t=${timestamp},v1=deadbeef,v1=${digest}`, secret, now)).toBe(true);
    expect(verifyStripeSignature(body, header, 'other-secret', now)).toBe(false);
    expect(verifyStripeSignature(body, header, secret, now + 10 * 60 * 1000)).toBe(false);
    expect(verifyStripeSignature(body, header, '', now)).toBe(false);
  });

  test('billingWebhook mounts STRIPE_WEBHOOK_SECRET from Secret Manager', () => {
    const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
    const at = source.indexOf("lazyExport('billingWebhook'");
    expect(at).toBeGreaterThanOrEqual(0);
    const block = source.slice(at, at + 600);
    expect(block).toMatch(/secrets:\s*\[[^\]]*['"]STRIPE_WEBHOOK_SECRET['"]/);
  });

  test('accepts a Lemon Squeezy HMAC of the raw body', () => {
    const secret = 'lemon_test';
    const body = '{"meta":{"event_name":"order_created"}}';
    const digest = crypto.createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyLemonSignature(body, digest, secret)).toBe(true);
    expect(verifyLemonSignature(body, digest, 'wrong')).toBe(false);
  });

  test('maps Stripe checkout and cancellation events', () => {
    const checkout = parseBillingEvent('stripe', {
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          customer_email: 'Inhaber@Hofladen.de',
          customer: 'cus_1',
          subscription: 'sub_1',
          metadata: { companyName: 'Hof Meier', tier: 'hofladen_komplett' },
        },
      },
    });
    expect(checkout.action).toBe('provision');
    expect(checkout.email).toBe('inhaber@hofladen.de');
    expect(checkout.companyName).toBe('Hof Meier');
    expect(checkout.tier).toBe('hofladen_komplett');
    expect(checkout.subscriptionId).toBe('sub_1');

    const cancelled = parseBillingEvent('stripe', {
      id: 'evt_2',
      type: 'customer.subscription.deleted',
      data: { object: { customer: 'cus_1', id: 'sub_1' } },
    });
    expect(cancelled.action).toBe('cancel');
    expect(cancelled.subscriptionId).toBe('sub_1');
  });

  test('checkout without metadata uses the mail domain and the paid amount', () => {
    const checkout = parseBillingEvent('stripe', {
      id: 'evt_link',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_a1HIs7PqeRDHwZfHxqRq6O2ggLVh5RP7HOImBiXrgkWZCprWW7gnSzu6sP',
          customer_email: 'meister@biohof-sonnenschein.de',
          customer_details: { email: 'meister@biohof-sonnenschein.de', name: '' },
          metadata: {},
          amount_total: 3900,
        },
      },
    });
    expect(checkout.action).toBe('provision');
    expect(checkout.companyName).toBe('Biohof Sonnenschein');
    expect(checkout.tier).toBe('mhd_retter');
    expect(parseBillingEvent('stripe', {
      type: 'checkout.session.completed',
      data: { object: { customer_email: 'a@hof.de', metadata: {}, amount_total: 7900 } },
    }).tier).toBe('hofladen_komplett');
    expect(parseBillingEvent('stripe', {
      type: 'checkout.session.completed',
      data: { object: { customer_email: 'a@hof.de', metadata: {}, amount_subtotal: 14900 } },
    }).tier).toBe('metzgerei_pro');
    expect(parseBillingEvent('stripe', {
      type: 'checkout.session.completed',
      data: { object: { customer_email: 'meister@gmail.com', metadata: {} } },
    }).companyName).toBe('Neukunde');
    expect(parseBillingEvent('stripe', {
      type: 'checkout.session.completed',
      data: {
        object: {
          customer_email: 'meister@biohof-sonnenschein.de',
          customer_details: { name: 'Hof "Sonnenschein"!' },
          metadata: {},
          amount_total: 3900,
        },
      },
    }).companyName).toBe('Hof Sonnenschein');
  });

  test('maps Lemon Squeezy subscription events from the product name', () => {
    const created = parseBillingEvent('lemonsqueezy', {
      meta: { event_name: 'subscription_created', webhook_id: 'wh_1' },
      data: {
        id: 'sub_9',
        attributes: {
          user_email: 'meister@example.de',
          user_name: 'Metzgerei Klein',
          product_name: 'HofSync Metzgerei Pro',
        },
      },
    });
    expect(created.action).toBe('provision');
    expect(created.tier).toBe('metzgerei_pro');
    expect(created.eventId).toBe('wh_1');

    const cancelled = parseBillingEvent('lemonsqueezy', {
      meta: { event_name: 'subscription_cancelled' },
      data: { id: 'sub_9', attributes: { user_email: 'meister@example.de' } },
    });
    expect(cancelled.action).toBe('cancel');
  });

  test('rejects an unsigned webhook before any tenant write', async () => {
    const { handleBillingWebhook } = await import('../billingWebhook.js');
    const res = {
      statusCode: 0,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
    };
    await handleBillingWebhook({
      method: 'POST',
      rawBody: Buffer.from('{}'),
      headers: {},
      get() { return ''; },
    }, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('invalid_signature');
  });
});

describe('Phase 3 callables', () => {
  test('setTenantModules rejects a tenant admin', async () => {
    const { handleSetTenantModules } = await import('../tenantAdmin.js');
    await expect(handleSetTenantModules({
      auth: authAs({ role: 'admin', email: 'admin@torfabrik.de' }),
      data: { targetTenantId: 'torfabrik', enabledModules: { mhd: true } },
    })).rejects.toMatchObject({ code: 'permission-denied' });
  });

  test('provisionNewCustomerTenant rejects a shop employee', async () => {
    const { handleProvisionNewCustomerTenant } = await import('../tenantAdmin.js');
    await expect(handleProvisionNewCustomerTenant({
      auth: authAs({ role: 'employee' }),
      data: {
        companyName: 'Hof Meier',
        adminEmail: 'inhaber@example.de',
        tier: 'mhd_retter',
      },
    })).rejects.toMatchObject({ code: 'permission-denied' });
  });
});
