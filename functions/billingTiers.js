/**
 * Tarif-Matrix und Webhook-Signaturen für HofSync.
 * Kein Firebase-Import: die Funktionen bleiben ohne Admin-SDK testbar.
 */
const crypto = require('crypto');

const TIER_IDS = ['mhd_retter', 'hofladen_komplett', 'metzgerei_pro'];

const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;

/** Interne Flags, die die PWA und die Rules lesen, plus die Tarif-Aliase. */
const MODULE_FLAG_KEYS = [
  'start',
  'team',
  'mhd',
  'receiving',
  'kitchen',
  'haccp',
  'knowledge',
  'buero',
  'chargenDoku',
  'cutting',
  'retterBox',
  'deliveryParser',
  'mhdMonitor',
  'wareneingang',
  'wurstkueche',
  'orders',
  'batches',
  'rezepte',
  'wareneingangMetzgerei',
  'rezeptAudit',
  'teamboard',
];

const MODULE_FLAG_SET = new Set(MODULE_FLAG_KEYS);

function allFlags(value) {
  return Object.fromEntries(MODULE_FLAG_KEYS.map((key) => [key, value]));
}

/**
 * Schreibt interne Keys und Tarif-Aliase gemeinsam, damit Paywall und Anzeige
 * dieselbe Wahrheit haben. `kitchen` öffnet die Wurstküche in den Rules.
 */
function expandModuleFlags(flags = {}) {
  const src = flags && typeof flags === 'object' ? flags : {};
  const kitchen = src.kitchen === true || src.wurstkueche === true || src.rezepte === true;
  const mhd = src.mhd === true || src.mhdMonitor === true;
  const receiving = src.receiving === true || src.wareneingang === true;
  const team = src.team === true;
  const buero = src.buero === true || src.batches === true;
  const start = src.start === true || src.teamboard === true;
  const chargenDoku = src.chargenDoku === true || src.cutting === true;
  return {
    start,
    teamboard: start,
    team,
    orders: src.orders === true || team,
    mhd,
    mhdMonitor: mhd,
    receiving,
    wareneingang: receiving,
    deliveryParser: src.deliveryParser === true || receiving,
    kitchen,
    wurstkueche: kitchen,
    rezepte: src.rezepte === true || kitchen,
    haccp: src.haccp === true,
    knowledge: src.knowledge === true,
    buero,
    batches: buero,
    chargenDoku,
    cutting: src.cutting === true || chargenDoku,
    retterBox: src.retterBox === true,
    wareneingangMetzgerei: src.wareneingangMetzgerei === true,
    rezeptAudit: src.rezeptAudit === true,
  };
}

const TIER_MODULES = {
  mhd_retter: expandModuleFlags({
    mhd: true,
    receiving: true,
    retterBox: true,
  }),
  hofladen_komplett: expandModuleFlags({
    start: true,
    team: true,
    orders: true,
    mhd: true,
    receiving: true,
    retterBox: true,
    haccp: true,
    buero: true,
  }),
  metzgerei_pro: expandModuleFlags({
    ...allFlags(true),
    rezepte: true,
    wareneingangMetzgerei: true,
    rezeptAudit: true,
  }),
};

function modulesForTier(tier) {
  const modules = TIER_MODULES[String(tier || '').trim()];
  if (!modules) {
    const error = new Error('Unbekannter Tarif.');
    error.code = 'invalid-tier';
    throw error;
  }
  return { ...modules };
}

function minimalReadOnlyModules() {
  return expandModuleFlags({});
}

function isKnownModuleKey(key) {
  return MODULE_FLAG_SET.has(key);
}

const ALIAS_GROUPS = [
  ['kitchen', 'wurstkueche', 'rezepte'],
  ['mhd', 'mhdMonitor'],
  ['receiving', 'wareneingang', 'deliveryParser'],
  ['team', 'orders'],
  ['buero', 'batches'],
  ['start', 'teamboard'],
  ['chargenDoku', 'cutting'],
];

function applyModulePatch(current = {}, patch = {}) {
  const src = patch && typeof patch === 'object' ? patch : {};
  const keys = Object.keys(src);
  if (!keys.length) {
    const error = new Error('enabledModules darf nicht leer sein.');
    error.code = 'invalid-modules';
    throw error;
  }
  keys.forEach((key) => {
    if (!isKnownModuleKey(key)) {
      const error = new Error(`Unbekanntes Modul: ${key}`);
      error.code = 'invalid-modules';
      throw error;
    }
    if (typeof src[key] !== 'boolean') {
      const error = new Error(`Modul ${key} muss true oder false sein.`);
      error.code = 'invalid-modules';
      throw error;
    }
  });
  const merged = { ...(current && typeof current === 'object' ? current : {}) };
  keys.forEach((key) => {
    merged[key] = src[key];
  });
  const explicit = new Set(keys);
  ALIAS_GROUPS.forEach((group) => {
    const chosen = group.find((key) => explicit.has(key));
    if (!chosen) return;
    const value = merged[chosen] === true;
    group.forEach((key) => {
      merged[key] = value;
    });
  });
  return merged;
}

function tierFromText(value) {
  const text = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!text) return '';
  if (TIER_IDS.includes(text)) return text;
  if (text.includes('metzgerei')) return 'metzgerei_pro';
  if (text.includes('hofladen') || text.includes('komplett')) return 'hofladen_komplett';
  if (text.includes('mhd') || text.includes('retter')) return 'mhd_retter';
  return '';
}

function rawBuffer(rawBody) {
  if (Buffer.isBuffer(rawBody)) return rawBody;
  return Buffer.from(String(rawBody ?? ''), 'utf8');
}

function timingSafeEqualText(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  if (!a.length || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function verifyStripeSignature(rawBody, header, secret, nowMs = Date.now()) {
  const key = String(secret || '').trim();
  const signature = String(header || '').trim();
  if (!key || key.toLowerCase() === 'unset' || !signature) return false;
  const parts = {};
  signature.split(',').forEach((piece) => {
    const index = piece.indexOf('=');
    if (index <= 0) return;
    parts[piece.slice(0, index).trim()] = piece.slice(index + 1).trim();
  });
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1 || !/^\d+$/.test(timestamp)) return false;
  const age = Math.abs(Number(nowMs) - Number(timestamp) * 1000);
  if (!Number.isFinite(age) || age > SIGNATURE_TOLERANCE_MS) return false;
  const payload = Buffer.concat([
    Buffer.from(`${timestamp}.`, 'utf8'),
    rawBuffer(rawBody),
  ]);
  const expected = crypto.createHmac('sha256', key).update(payload).digest('hex');
  return timingSafeEqualText(expected, v1);
}

function verifyLemonSignature(rawBody, header, secret) {
  const key = String(secret || '').trim();
  const signature = String(header || '').trim();
  if (!key || key.toLowerCase() === 'unset' || !signature) return false;
  const expected = crypto.createHmac('sha256', key).update(rawBuffer(rawBody)).digest('hex');
  return timingSafeEqualText(expected, signature);
}

function firstText(...values) {
  return values.map((value) => String(value || '').trim()).find(Boolean) || '';
}

function parseBillingEvent(provider, payload = {}) {
  const event = payload && typeof payload === 'object' ? payload : {};
  if (provider === 'stripe') {
    const type = String(event.type || '');
    const object = event.data?.object || {};
    const metadata = object.metadata || {};
    const email = firstText(
      object.customer_email,
      object.customer_details?.email,
      metadata.adminEmail,
      metadata.email,
    ).toLowerCase();
    const companyName = firstText(
      metadata.companyName,
      metadata.company_name,
      object.customer_details?.name,
    );
    const tier = tierFromText(firstText(
      metadata.tier,
      metadata.plan,
      metadata.price_lookup_key,
      object.display_items?.[0]?.name,
    ));
    const base = {
      provider,
      eventId: firstText(event.id),
      email,
      companyName,
      tier,
      subscriptionId: firstText(
        object.subscription,
        type.startsWith('customer.subscription') ? object.id : '',
        metadata.subscriptionId,
      ),
      customerId: firstText(object.customer, metadata.customerId),
    };
    if (type === 'checkout.session.completed') return { ...base, action: 'provision' };
    if (type === 'customer.subscription.deleted') return { ...base, action: 'cancel' };
    return { ...base, action: 'ignore' };
  }

  const eventName = String(event.meta?.event_name || event.event || '');
  const attributes = event.data?.attributes || {};
  const firstItem = attributes.first_order_item || {};
  const email = firstText(attributes.user_email, attributes.customer_email).toLowerCase();
  const companyName = firstText(
    attributes.user_name,
    firstItem.product_name,
    attributes.product_name,
  );
  const tier = tierFromText(firstText(
    attributes.variant_name,
    firstItem.variant_name,
    attributes.product_name,
    firstItem.product_name,
  ));
  const base = {
    provider,
    eventId: firstText(event.meta?.webhook_id, event.data?.id, eventName),
    email,
    companyName,
    tier,
    subscriptionId: firstText(attributes.subscription_id, event.data?.id),
    customerId: firstText(attributes.customer_id, attributes.store_id),
  };
  if (eventName === 'subscription_created' || eventName === 'order_created') {
    return { ...base, action: 'provision' };
  }
  if (eventName === 'subscription_cancelled' || eventName === 'subscription_expired') {
    return { ...base, action: 'cancel' };
  }
  return { ...base, action: 'ignore' };
}

module.exports = {
  TIER_IDS,
  MODULE_FLAG_KEYS,
  TIER_MODULES,
  modulesForTier,
  minimalReadOnlyModules,
  expandModuleFlags,
  applyModulePatch,
  tierFromText,
  verifyStripeSignature,
  verifyLemonSignature,
  parseBillingEvent,
};
