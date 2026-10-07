/**
 * HTTP-Webhook für Stripe und Lemon Squeezy.
 * Ungültige Signaturen werden abgelehnt. Ohne gesetztes Secret antwortet der
 * Endpunkt mit 401, damit kein unsignierter Aufruf einen Mandanten anlegt.
 */
const { getAdminDb, firestore } = require('./firebaseAdmin');
const {
  verifyStripeSignature,
  verifyLemonSignature,
  parseBillingEvent,
} = require('./billingTiers');
const {
  provisionNewCustomerTenantInner,
  deactivateTenantForBilling,
} = require('./tenantAdmin');

function configuredSecret(value) {
  const secret = String(value || '').trim();
  if (!secret || secret.toLowerCase() === 'unset') return '';
  return secret;
}

function readRawBody(req) {
  if (Buffer.isBuffer(req?.rawBody)) return req.rawBody;
  if (typeof req?.rawBody === 'string') return Buffer.from(req.rawBody, 'utf8');
  return Buffer.from(JSON.stringify(req?.body || {}), 'utf8');
}

function identifyProvider(req, rawBody) {
  const stripeSecret = configuredSecret(process.env.STRIPE_WEBHOOK_SECRET);
  const lemonSecret = configuredSecret(process.env.LEMON_SQUEEZY_WEBHOOK_SECRET);
  const stripeHeader = req.get?.('stripe-signature') || req.headers?.['stripe-signature'] || '';
  const lemonHeader = req.get?.('x-signature') || req.headers?.['x-signature'] || '';
  if (stripeHeader && verifyStripeSignature(rawBody, stripeHeader, stripeSecret)) {
    return 'stripe';
  }
  if (lemonHeader && verifyLemonSignature(rawBody, lemonHeader, lemonSecret)) {
    return 'lemonsqueezy';
  }
  return '';
}

function billingEventRef(event) {
  const eventId = String(event.eventId || '').trim();
  if (!eventId) return null;
  return getAdminDb().collection('billingEvents').doc(`${event.provider}_${eventId}`);
}

async function rememberBillingEvent(event) {
  const ref = billingEventRef(event);
  if (!ref) return false;
  try {
    await ref.create({
      provider: event.provider,
      action: event.action,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
    return false;
  } catch (err) {
    const code = String(err?.code || '');
    if (code === 'already-exists' || code === '6') return true;
    throw err;
  }
}

async function releaseBillingEvent(event) {
  const ref = billingEventRef(event);
  if (!ref) return;
  try {
    await ref.delete();
  } catch (err) {
    console.error('[billingWebhook] Ereignis-Sperre konnte nicht gelöst werden:', err?.message || err);
  }
}

async function handleBillingWebhook(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const rawBody = readRawBody(req);
  const provider = identifyProvider(req, rawBody);
  if (!provider) {
    res.status(401).json({ ok: false, error: 'invalid_signature' });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    res.status(400).json({ ok: false, error: 'invalid_json' });
    return;
  }

  const event = parseBillingEvent(provider, payload);
  if (event.action === 'ignore') {
    res.status(200).json({ ok: true, ignored: true });
    return;
  }
  if (event.action === 'provision') {
    if (!event.email || !event.email.includes('@')) {
      res.status(400).json({ ok: false, error: 'missing_email' });
      return;
    }
    if (!event.tier) {
      res.status(400).json({ ok: false, error: 'missing_tier' });
      return;
    }
  }

  const duplicate = await rememberBillingEvent(event);
  if (duplicate) {
    res.status(200).json({ ok: true, duplicate: true });
    return;
  }

  try {
    if (event.action === 'cancel') {
      const result = await deactivateTenantForBilling(event);
      res.status(200).json({ ok: true, action: 'cancel', tenantId: result.tenantId || '' });
      return;
    }

    const companyName = event.companyName || event.email.split('@')[0];
    const result = await provisionNewCustomerTenantInner({
      companyName,
      adminEmail: event.email,
      tier: event.tier,
      actorUid: 'billing-webhook',
      billing: {
        provider: event.provider,
        adminEmail: event.email,
        subscriptionId: event.subscriptionId,
        customerId: event.customerId,
      },
    });
    res.status(200).json({
      ok: true,
      action: 'provision',
      tenantId: result.tenantId,
      created: result.created === true,
      emailed: result.emailed === true,
    });
  } catch (err) {
    await releaseBillingEvent(event);
    const code = String(err?.code || '');
    console.error('[billingWebhook] Verarbeitung fehlgeschlagen:', code || err?.message || err);
    if (code === 'already-exists') {
      res.status(409).json({ ok: false, error: 'tenant_exists' });
      return;
    }
    if (code === 'invalid-argument' || code === 'invalid-tier') {
      res.status(400).json({ ok: false, error: 'invalid_payload' });
      return;
    }
    res.status(500).json({ ok: false, error: 'provision_failed' });
  }
}

module.exports = {
  handleBillingWebhook,
};
