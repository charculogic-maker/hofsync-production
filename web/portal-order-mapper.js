/**
 * Mappt Soft-Launch-Portal-Checkout auf Packtisch-customerOrders-Dokumente.
 * Rein synchrone, testbare Transformation – Persistenz übernimmt die Callable.
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
export function trimStr(value) {
  return String(value ?? '').trim();
}

/**
 * @param {unknown} value
 * @returns {number}
 */
export function roundMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * readyAt aus Abholdatum + Slot-Start (lokal, ohne TZ-Drift).
 * @param {string} pickupDate YYYY-MM-DD
 * @param {{ start?: string, id?: string, label?: string }|null|undefined} slot
 * @returns {string}
 */
export function buildReadyAt(pickupDate, slot) {
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

/**
 * @param {object} line
 * @returns {object}
 */
export function mapPortalCartLine(line = {}) {
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

  /** @type {Record<string, unknown>} */
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

/**
 * @param {object} portalOrder – Checkout-Objekt aus bestellen.js
 * @param {string} tenantId
 * @param {{ orderId?: string, nowIso?: string }} [options]
 * @returns {{ orderId: string, payload: Record<string, unknown> }}
 */
export function mapPortalOrderToCustomerOrder(portalOrder = {}, tenantId, options = {}) {
  const cleanTenant = trimStr(tenantId);
  if (!cleanTenant) {
    throw new Error('tenantId fehlt');
  }

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
  const orderId = trimStr(options.orderId)
    || (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `portal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const nowIso = trimStr(options.nowIso) || new Date().toISOString();

  if (!customerName) throw new Error('Kundenname fehlt');
  if (!callbackPhone && !customerEmail) throw new Error('Kontakt fehlt');
  if (!readyAt) throw new Error('Abholzeit fehlt');
  if (!items.length) throw new Error('Warenkorb leer');
  if (items.length > 40) throw new Error('Zu viele Positionen');

  const channel = trimStr(portalOrder.channel) || 'counter';
  const channelLabel = channel === 'sb' ? 'SB-Kühlschrank' : 'Bedientheke';
  const slotLabel = trimStr(portalOrder.pickupSlot?.label);
  const wishesParts = [
    portalRef ? `Portal-Ref ${portalRef}` : '',
    `Kanal: ${channelLabel}`,
    slotLabel ? `Zeitfenster: ${slotLabel}` : '',
    trimStr(portalOrder.mode) ? `Modus: ${trimStr(portalOrder.mode)}` : '',
  ].filter(Boolean);

  /** @type {Record<string, unknown>} */
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
    // ISO-Strings – Callable ersetzt createdAt/acceptedAt durch Server-Timestamps.
    createdAt: nowIso,
    acceptedAt: nowIso,
  };

  if (callbackPhone) payload.callbackPhone = callbackPhone;
  if (customerEmail) payload.customerEmail = customerEmail;

  return { orderId, payload };
}

export default {
  trimStr,
  roundMoney,
  buildReadyAt,
  mapPortalCartLine,
  mapPortalOrderToCustomerOrder,
};
