/**
 * Öffentlicher Checkout nur für Hofladen komplett.
 * Legt eine Stripe-Subscription-Session an (79 € / Monat, metadata.tier)
 * und leitet den Browser dorthin. Der bestehende billingWebhook liest
 * checkout.session.completed und provisioniert den Mandanten.
 * MHD-Retter und Metzgerei Pro haben hier keinen Zweig.
 */
const { hofladenCheckoutForm } = require('./billingTiers');

const STRIPE_SESSIONS_URL = 'https://api.stripe.com/v1/checkout/sessions';

function configuredSecret(value) {
  const secret = String(value || '').trim();
  if (!secret || secret.toLowerCase() === 'unset') return '';
  return secret;
}

function isStripeCheckoutUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'https:' && url.hostname === 'checkout.stripe.com' && url.pathname.length > 1;
  } catch {
    return false;
  }
}

async function handleHofladenCheckout(req, res, deps = {}) {
  if (req?.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }
  const secret = configuredSecret(deps.secretKey ?? process.env.STRIPE_SECRET_KEY);
  if (!secret) {
    res.status(503).json({ ok: false, error: 'checkout_not_configured' });
    return;
  }
  const fetchImpl = deps.fetch || global.fetch;
  let response;
  try {
    response = await fetchImpl(STRIPE_SESSIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: hofladenCheckoutForm().toString(),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    console.error('[hofladenCheckout] stripe_unreachable', err?.name || 'error');
    res.status(502).json({ ok: false, error: 'checkout_failed' });
    return;
  }
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  const checkoutUrl = String(payload?.url || '').trim();
  if (!response.ok || !isStripeCheckoutUrl(checkoutUrl)) {
    console.error('[hofladenCheckout] stripe_rejected', response.status, payload?.error?.code || payload?.error?.type || '');
    res.status(502).json({ ok: false, error: 'checkout_failed' });
    return;
  }
  res.redirect(303, checkoutUrl);
}

module.exports = {
  handleHofladenCheckout,
  isStripeCheckoutUrl,
};
