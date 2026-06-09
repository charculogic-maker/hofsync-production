const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

function parseQuantityValue(value) {
  const normalized = String(value ?? '')
    .trim()
    .replace(',', '.')
    .match(/-?\d+(?:\.\d+)?/);
  if (!normalized) return 0;
  const parsed = Number(normalized[0]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseMoneyValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? '')
    .trim()
    .replace(/\./g, '')
    .replace(',', '.')
    .match(/-?\d+(?:\.\d+)?/);
  if (!normalized) return 0;
  const parsed = Number(normalized[0]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoneyValue(value) {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatPickupDate(value) {
  if (!value) return 'deinem Abholtermin';
  const date = typeof value?.toDate === 'function'
    ? value.toDate()
    : new Date(value);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getItemUnitPrice(item, orderedQuantity) {
  const direct = [
    item?.pricePerKg,
    item?.kgPrice,
    item?.kiloPrice,
    item?.unitPrice,
    item?.pricePerUnit,
    item?.singlePrice,
  ].map(parseMoneyValue).find((price) => price > 0);
  if (direct) return direct;

  const lineTotal = [item?.lineTotal, item?.totalPrice, item?.price]
    .map(parseMoneyValue)
    .find((price) => price > 0);
  if (lineTotal && orderedQuantity > 0) return lineTotal / orderedQuantity;
  return 0;
}

function calculateFinalOrderPrice(order) {
  const total = (Array.isArray(order?.items) ? order.items : []).reduce((sum, item) => {
    const orderedQuantity = parseQuantityValue(item?.quantity);
    const actualQuantity = item?.actualQuantity ? parseQuantityValue(item.actualQuantity) : orderedQuantity;
    const unitPrice = getItemUnitPrice(item, orderedQuantity);
    return sum + (actualQuantity * unitPrice);
  }, 0);
  return Math.round(total * 100) / 100;
}

function buildCustomerSignal(order) {
  const customerName = String(order?.customerName || 'lieber Hofladen-Gast').trim();
  const pickupDate = formatPickupDate(order?.readyAt);
  const finalPrice = formatMoneyValue(calculateFinalOrderPrice(order));
  const message = [
    `Hallo ${customerName}, deine Bestellung vom ${pickupDate} wurde frisch für dich zusammengestellt und steht abholbereit im Laden-Kühlschrank! 🥩 🍳`,
    `Tatsächlicher Abholpreis: ${finalPrice} € (präzise nachgewogen).`,
    'Wir freuen uns auf deinen Besuch!',
  ].join('\n');

  return {
    to: {
      name: customerName,
      email: order?.customerEmail || null,
      phone: order?.callbackPhone || null,
    },
    message,
    sendgrid: order?.customerEmail ? {
      personalizations: [{
        to: [{ email: order.customerEmail, name: customerName }],
      }],
      from: { email: 'hofladen@example.invalid', name: 'Hofladen' },
      subject: 'Deine Bestellung ist abholbereit',
      content: [{ type: 'text/plain', value: message }],
    } : null,
    twilio: order?.callbackPhone ? {
      to: order.callbackPhone,
      body: message,
    } : null,
  };
}

exports.onOrderReadySendSignal = onDocumentUpdated(
  {
    document: 'tenants/{tenantId}/customerOrders/{orderId}',
    region: 'europe-west3',
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return null;
    if (before.status === 'ready' || after.status !== 'ready') return null;

    const tenantId = event.params.tenantId;
    const orderId = event.params.orderId;
    if (after.tenantId && after.tenantId !== tenantId) {
      console.warn('[KundenSignal] Tenant-Abgleich uebersprungen', { tenantId, orderId });
      return null;
    }

    const signal = buildCustomerSignal(after);
    console.log('[KundenSignal] Abhol-Nachricht vorbereitet', {
      tenantId,
      orderId,
      customerName: signal.to.name,
      hasEmail: Boolean(signal.to.email),
      hasPhone: Boolean(signal.to.phone),
      message: signal.message,
      sendgrid: signal.sendgrid,
      twilio: signal.twilio,
    });
    return null;
  },
);

exports._test = {
  buildCustomerSignal,
  calculateFinalOrderPrice,
  formatPickupDate,
};
