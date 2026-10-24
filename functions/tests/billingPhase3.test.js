import crypto from 'crypto';
import { readFileSync } from 'fs';
import { describe, expect, test } from 'vitest';
import {
  HOFLADEN_CHECKOUT_OFFER,
  TIER_AMOUNT_CENTS,
  applyModulePatch,
  hofladenCheckoutForm,
  minimalReadOnlyModules,
  modulesForTier,
  parseBillingEvent,
  verifyLemonSignature,
  verifyStripeSignature,
} from '../billingTiers.js';
import { handleHofladenCheckout, isStripeCheckoutUrl } from '../hofladenCheckout.js';

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
    expect(modules.orders).toBe(true);
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

  test('team:false does not reset orders:true', () => {
    const next = applyModulePatch(
      { team: true, orders: true, mhd: true },
      { team: false },
    );
    expect(next.team).toBe(false);
    expect(next.orders).toBe(true);
    expect(next.mhd).toBe(true);
  });

  test('orders patch does not rewrite team', () => {
    const next = applyModulePatch(
      { team: true, orders: false, mhd: true },
      { orders: true },
    );
    expect(next.orders).toBe(true);
    expect(next.team).toBe(true);
  });

  test('unknown module keys are rejected', () => {
    expect(() => applyModulePatch({}, { notAModule: true })).toThrow(/Unbekanntes Modul/);
  });

  test('averyLabels / retterBox / rezeptAudit are accepted module keys', () => {
    const next = applyModulePatch(
      { mhd: true },
      { averyLabels: true, retterBox: true, rezeptAudit: false },
    );
    expect(next.averyLabels).toBe(true);
    expect(next.avery).toBe(true);
    expect(next.zerlegung).toBe(true);
    expect(next.retterBox).toBe(true);
    expect(next.rezeptAudit).toBe(false);
    expect(next.mhd).toBe(true);
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
    const block = source.slice(at, at + 700);
    expect(block).toMatch(/secrets:\s*\[[^\]]*['"]STRIPE_WEBHOOK_SECRET['"]/);
  });

  test('hofladenCheckout is the only public tariff and stays on the webhook metadata', () => {
    expect(HOFLADEN_CHECKOUT_OFFER.tier).toBe('hofladen_komplett');
    expect(HOFLADEN_CHECKOUT_OFFER.amountCents).toBe(TIER_AMOUNT_CENTS.hofladen_komplett);
    expect(HOFLADEN_CHECKOUT_OFFER.amountCents).toBe(7900);
    expect(HOFLADEN_CHECKOUT_OFFER.interval).toBe('month');
    expect(HOFLADEN_CHECKOUT_OFFER.currency).toBe('eur');
    const form = hofladenCheckoutForm();
    expect(form.get('mode')).toBe('subscription');
    expect(form.get('metadata[tier]')).toBe('hofladen_komplett');
    expect(form.get('subscription_data[metadata][tier]')).toBe('hofladen_komplett');
    expect(form.get('line_items[0][price_data][unit_amount]')).toBe('7900');
    expect(form.get('line_items[0][price_data][recurring][interval]')).toBe('month');
    expect(form.get('automatic_tax[enabled]')).toBe('false');
    expect(form.getAll('line_items[0][quantity]')).toEqual(['1']);
    expect(form.has('line_items[1][quantity]')).toBe(false);
    expect(form.get('metadata[plan]')).toBeNull();

    const taxed = parseBillingEvent('stripe', {
      id: 'evt_tax',
      type: 'checkout.session.completed',
      data: {
        object: {
          customer_email: 'inhaber@biohof-sonnenschein.de',
          metadata: { tier: form.get('metadata[tier]') },
          amount_total: 9401,
          subscription: 'sub_hof',
        },
      },
    });
    expect(taxed.action).toBe('provision');
    expect(taxed.tier).toBe('hofladen_komplett');
  });

  test('hofladenCheckout mounts STRIPE_SECRET_KEY and does not provision tenants itself', () => {
    const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
    const at = source.indexOf("lazyExport('hofladenCheckout'");
    expect(at).toBeGreaterThanOrEqual(0);
    const block = source.slice(at, at + 700);
    expect(block).toMatch(/secrets:\s*\[[^\]]*['"]STRIPE_SECRET_KEY['"]/);
    expect(block).not.toMatch(/ensureAdminApp/);
    expect(block).toMatch(/handleHofladenCheckout/);
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

function mockResponse() {
  return {
    statusCode: 0,
    body: null,
    location: '',
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    redirect(code, location) {
      this.statusCode = code;
      this.location = location;
      return this;
    },
  };
}

describe('Hofladen checkout redirect', () => {
  test('refuses to run without a Stripe secret and ignores other tariff query params', async () => {
    const res = mockResponse();
    const fetchImpl = () => {
      throw new Error('stripe must not be called');
    };
    await handleHofladenCheckout({
      method: 'GET',
      url: '/hofladenCheckout?tier=metzgerei_pro&amount=14900',
    }, res, { secretKey: '', fetch: fetchImpl });
    expect(res.statusCode).toBe(503);
    expect(res.body.error).toBe('checkout_not_configured');
  });

  test('redirects only to a Stripe Checkout url from the hofladen session', async () => {
    const res = mockResponse();
    let sent = '';
    await handleHofladenCheckout({ method: 'GET' }, res, {
      secretKey: 'sk_test_example',
      fetch: async (_url, init) => {
        sent = init.body;
        return {
          ok: true,
          status: 200,
          json: async () => ({ url: 'https://checkout.stripe.com/c/pay/cs_test_hofladen' }),
        };
      },
    });
    const form = new URLSearchParams(sent);
    expect(form.get('metadata[tier]')).toBe('hofladen_komplett');
    expect(form.get('line_items[0][price_data][unit_amount]')).toBe('7900');
    expect(res.statusCode).toBe(303);
    expect(res.location).toBe('https://checkout.stripe.com/c/pay/cs_test_hofladen');
    expect(isStripeCheckoutUrl('https://evil.example/checkout.stripe.com')).toBe(false);
    expect(isStripeCheckoutUrl('http://checkout.stripe.com/c/pay/cs_test')).toBe(false);
  });

  test('does not follow a non-Stripe url from the API', async () => {
    const res = mockResponse();
    await handleHofladenCheckout({ method: 'GET' }, res, {
      secretKey: 'sk_test_example',
      fetch: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ url: 'https://evil.example/phish' }),
      }),
    });
    expect(res.statusCode).toBe(502);
    expect(res.body.error).toBe('checkout_failed');
    expect(res.location).toBe('');
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
