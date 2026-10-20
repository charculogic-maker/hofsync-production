/**
 * Soft-Launch: Portal-Checkout → customerOrders Payload (Server-Autorität).
 */

function trimStr(value) {
  return String(value ?? '').trim();
}

function roundMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function buildReadyAt(pickupDate, slot) {
  const date = trimStr(pickupDate);
  let start = trimStr(slot?.start);
  if (!start && slot?.id) {
    const fromId = String(slot.id).match(/^(\d{1,2}:\d{2})/);
    if (fromId) start = fromId[1];
  }
  if (!date) return '';
  if (!/^\d{2}:\d{2}$/.test(start)) start = '09:00';
  return `${date}T${start}`;
}

function mapPortalCartLine(line = {}) {
  const product = trimStr(line.name || line.product || line.produkt);
  const productId = trimStr(line.productId || line.artNr || line.artikelId);
  const weightKg = Number(line.weightKg);
  const pieces = Number(line.pieces);
  const packGrams = Number(line.packGrams);
  const pricePerKg = roundMoney(line.pricePerKg ?? line.unitPrice ?? 0);
  const estimatedPrice = roundMoney(line.estimatedPrice ?? line.lineTotal ?? 0);
  const note = trimStr(line.note || line.lineNotes || line.notes);
  const summary = trimStr(line.summary);
  const cutId = trimStr(line.cutId);
  const vacuumId = trimStr(line.vacuumId);
  const stateId = trimStr(line.stateId || line.productState).toLowerCase() || 'frisch';

  const mapped = {
    product,
    name: product,
    productId,
    artNr: trimStr(line.artNr) || productId,
    cutId,
    cutLabel: trimStr(line.cutLabel) || cutId || 'Standard',
    vacuumId,
    vacuumLabel: trimStr(line.vacuumLabel),
    stateId: stateId === 'tk' ? 'tk' : 'frisch',
    stateLabel: trimStr(line.stateLabel),
    note,
    summary,
    pricePerKg,
    estimatedPrice,
    pricingType: trimStr(line.pricingType),
    tierBadge: trimStr(line.tierBadge),
  };

  if (Number.isFinite(weightKg) && weightKg > 0) {
    mapped.weightKg = weightKg;
    mapped.unit = 'kg';
    mapped.quantity = weightKg;
  }
  if (Number.isFinite(pieces) && pieces > 0) {
    mapped.pieces = pieces;
    if (!mapped.unit) {
      mapped.unit = 'Stück';
      mapped.quantity = pieces;
    }
  }
  if (Number.isFinite(packGrams) && packGrams > 0) {
    mapped.packGrams = packGrams;
  }
  return mapped;
}

/** Soft-Launch-Mandanten, die Portal-Bestellungen annehmen dürfen. */
const PORTAL_ORDER_TENANT_ALLOWLIST = Object.freeze([
  'StevesHof_Hauptbetrieb',
  'biohof_mueller',
]);

function assertPortalTenantAllowed(tenantId) {
  const clean = trimStr(tenantId);
  if (!PORTAL_ORDER_TENANT_ALLOWLIST.includes(clean)) {
    const err = new Error('Dieser Betrieb nimmt Online-Vorbestellungen noch nicht an.');
    err.code = 'failed-precondition';
    throw err;
  }
  return clean;
}

function mapPortalOrderToCustomerOrder(portalOrder = {}, tenantId, options = {}) {
  const cleanTenant = assertPortalTenantAllowed(tenantId);

  const customer = portalOrder.customer && typeof portalOrder.customer === 'object'
    ? portalOrder.customer
    : {};
  const customerName = trimStr(customer.name || portalOrder.customerName);
  const callbackPhone = trimStr(customer.phone || portalOrder.callbackPhone);
  const customerEmail = trimStr(customer.email || portalOrder.customerEmail);
  const rawItems = Array.isArray(portalOrder.items) ? portalOrder.items : [];
  const items = rawItems.map((line) => mapPortalCartLine(line)).filter((line) => line.product);
  const readyAt = buildReadyAt(portalOrder.pickupDate, portalOrder.pickupSlot);
  const portalRef = trimStr(portalOrder.ref);

  if (!customerName) {
    const err = new Error('Bitte einen Namen angeben.');
    err.code = 'invalid-argument';
    throw err;
  }
  if (!callbackPhone && !customerEmail) {
    const err = new Error('Bitte Telefon oder E-Mail angeben.');
    err.code = 'invalid-argument';
    throw err;
  }
  if (!readyAt) {
    const err = new Error('Bitte Abholdatum und Zeitfenster wählen.');
    err.code = 'invalid-argument';
    throw err;
  }
  if (!items.length) {
    const err = new Error('Der Warenkorb ist leer.');
    err.code = 'invalid-argument';
    throw err;
  }
  if (items.length > 40) {
    const err = new Error('Zu viele Positionen in einer Bestellung.');
    err.code = 'invalid-argument';
    throw err;
  }

  const channel = trimStr(portalOrder.channel) || 'counter';
  const channelLabel = channel === 'sb' ? 'SB-Kühlschrank' : 'Bedientheke';
  const slotLabel = trimStr(portalOrder.pickupSlot?.label);
  const wishesParts = [
    portalRef ? `Portal-Ref ${portalRef}` : '',
    `Kanal: ${channelLabel}`,
    slotLabel ? `Zeitfenster: ${slotLabel}` : '',
    trimStr(portalOrder.mode) ? `Modus: ${trimStr(portalOrder.mode)}` : '',
  ].filter(Boolean);

  const orderId = trimStr(options.orderId)
    || `portal_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const payload = {
    customerName,
    readyAt,
    items,
    inputMode: 'portal',
    acceptedBy: 'Online-Vorbestellung',
    status: 'open',
    tenantId: cleanTenant,
    source: 'portal',
    channel,
    portalRef: portalRef || null,
    pickupDate: trimStr(portalOrder.pickupDate) || null,
    pickupSlotLabel: slotLabel || null,
    estimatedTotal: roundMoney(portalOrder.estimatedTotal),
    additionalWishes: wishesParts.join(' · '),
    customer: {
      name: customerName,
      phone: callbackPhone || null,
      email: customerEmail || null,
    },
  };

  if (callbackPhone) payload.callbackPhone = callbackPhone;
  if (customerEmail) payload.customerEmail = customerEmail;

  return { orderId, payload, tenantId: cleanTenant };
}

module.exports = {
  PORTAL_ORDER_TENANT_ALLOWLIST,
  trimStr,
  roundMoney,
  buildReadyAt,
  mapPortalCartLine,
  mapPortalOrderToCustomerOrder,
  assertPortalTenantAllowed,
};
