const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const { isConfiguredParam, readSmtpConfig, readTwilioConfig } = require('./runtimeParams');

if (!admin.apps.length) {
  admin.initializeApp();
}

function getNotificationConfig() {
  return {
    ...readSmtpConfig(),
    ...readTwilioConfig(),
  };
}

function createSmtpTransport(config) {
  const port = Number.parseInt(String(config.smtpPort || '465'), 10) || 465;
  return nodemailer.createTransport({
    host: String(config.smtpHost || 'mail.agenturserver.de').trim(),
    port,
    secure: port === 465,
    auth: {
      user: String(config.smtpUser || '').trim(),
      pass: String(config.smtpPass || ''),
    },
    ...(port === 587 ? { requireTLS: true } : {}),
  });
}

function resolveFromAddress(config) {
  const fromEmail = String(config.fromEmail || config.smtpUser || '').trim();
  return fromEmail
    ? { address: fromEmail, name: 'StevesHof' }
    : null;
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

function parseReadyAtDate(value) {
  if (!value) return null;
  const date = typeof value?.toDate === 'function'
    ? value.toDate()
    : new Date(value);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function formatPickupWindow(value) {
  const date = parseReadyAtDate(value);
  if (!date) {
    return value ? String(value) : 'deinem Abholtermin';
  }
  const weekday = date.toLocaleDateString('de-DE', { weekday: 'short' });
  const time = date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${weekday}. um ${time} Uhr`;
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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildCustomerSignal(order) {
  const customerName = String(order?.customerName || 'lieber Hofladen-Gast').trim();
  const pickupWindow = formatPickupWindow(order?.readyAt);
  const finalPrice = formatMoneyValue(calculateFinalOrderPrice(order));
  const message = [
    `Hallo ${customerName}, dein Genuss-Paket ist fertig gepackt!`,
    'Thomas aus der Metzgerei hat alles frisch vorbereitet.',
    `Der genaue Waagen-Endpreis beträgt ${finalPrice} €.`,
    `Du kannst es ab ${pickupWindow} abholen.`,
    'Wir freuen uns auf dich!',
    'Dein StevesHof-Team.',
  ].join(' ');

  const htmlMessage = [
    `<p>Hallo ${escapeHtml(customerName)},</p>`,
    '<p>dein <strong>Genuss-Paket</strong> ist fertig gepackt!</p>',
    '<p>Thomas aus der Metzgerei hat alles frisch vorbereitet.</p>',
    `<p>Der genaue Waagen-Endpreis beträgt <strong>${escapeHtml(finalPrice)}&nbsp;€</strong>.</p>`,
    `<p>Du kannst es ab ${escapeHtml(pickupWindow)} abholen.</p>`,
    '<p>Wir freuen uns auf dich!</p>',
    '<p>Dein StevesHof-Team.</p>',
  ].join('\n');

  return {
    to: {
      name: customerName,
      email: order?.customerEmail || null,
      phone: order?.callbackPhone || null,
    },
    message,
    htmlMessage,
    subject: 'Dein Genuss-Paket ist abholbereit',
  };
}

function normalizePhoneForTwilio(phone) {
  const raw = String(phone || '').trim();
  if (!raw) return null;
  if (raw.startsWith('+')) return raw;

  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.startsWith('0')) return `+49${digits.slice(1)}`;
  if (digits.startsWith('49')) return `+${digits}`;
  return `+${digits}`;
}

async function sendCustomerEmail(signal, config, meta) {
  if (!signal.to.email) {
    return { channel: 'email', skipped: true };
  }

  const smtpUser = String(config.smtpUser || '').trim();
  const smtpPass = String(config.smtpPass || '');
  const from = resolveFromAddress(config);
  if (!isConfiguredParam(smtpUser) || !isConfiguredParam(smtpPass) || !from) {
    console.warn('[KundenSignal] SMTP nicht konfiguriert, E-Mail uebersprungen', meta);
    return { channel: 'email', skipped: true, reason: 'not_configured' };
  }

  try {
    const transport = createSmtpTransport(config);
    await transport.sendMail({
      from,
      to: `${signal.to.name} <${signal.to.email}>`,
      subject: signal.subject,
      text: signal.message,
      html: `<!DOCTYPE html><html lang="de"><body style="font-family:Georgia,'Times New Roman',serif;color:#2f2a24;line-height:1.6;max-width:560px;margin:0 auto;padding:24px;">${signal.htmlMessage}</body></html>`,
    });
    console.log('[KundenSignal] E-Mail versendet', { ...meta, email: signal.to.email });
    return { channel: 'email', sent: true };
  } catch (error) {
    console.error('[KundenSignal] SMTP-Fehler', {
      ...meta,
      email: signal.to.email,
      message: error?.message,
      code: error?.code,
      responseCode: error?.responseCode,
    });
    return { channel: 'email', sent: false, error: error?.message || 'send_failed' };
  }
}

async function sendCustomerSms(signal, config, meta) {
  if (!signal.to.phone) {
    return { channel: 'sms', skipped: true };
  }

  const accountSid = String(config.twilioAccountSid || '').trim();
  const authToken = String(config.twilioAuthToken || '').trim();
  const fromNumber = String(config.fromNumber || '').trim();
  const toNumber = normalizePhoneForTwilio(signal.to.phone);

  if (!isConfiguredParam(accountSid) || !isConfiguredParam(authToken) || !isConfiguredParam(fromNumber)) {
    console.warn('[KundenSignal] Twilio nicht konfiguriert, SMS uebersprungen', meta);
    return { channel: 'sms', skipped: true, reason: 'not_configured' };
  }
  if (!toNumber) {
    console.warn('[KundenSignal] Ungueltige Mobilnummer, SMS uebersprungen', {
      ...meta,
      phone: signal.to.phone,
    });
    return { channel: 'sms', skipped: true, reason: 'invalid_phone' };
  }

  try {
    const client = twilio(accountSid, authToken);
    await client.messages.create({
      to: toNumber,
      from: fromNumber,
      body: signal.message,
    });
    console.log('[KundenSignal] SMS versendet', { ...meta, phone: toNumber });
    return { channel: 'sms', sent: true };
  } catch (error) {
    console.error('[KundenSignal] Twilio-Fehler', {
      ...meta,
      phone: toNumber,
      message: error?.message,
      code: error?.code,
      status: error?.status,
    });
    return { channel: 'sms', sent: false, error: error?.message || 'send_failed' };
  }
}

async function dispatchCustomerSignal(signal, meta) {
  const config = getNotificationConfig();
  const tasks = [];

  if (signal.to.email) {
    tasks.push(sendCustomerEmail(signal, config, meta));
  }
  if (signal.to.phone) {
    tasks.push(sendCustomerSms(signal, config, meta));
  }

  if (!tasks.length) {
    console.log('[KundenSignal] Kein Kundenkanal hinterlegt, Versand uebersprungen', meta);
    return [];
  }

  return Promise.all(tasks);
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

    const meta = { tenantId, orderId, customerName: after.customerName || null };
    const signal = buildCustomerSignal(after);

    console.log('[KundenSignal] Abhol-Nachricht vorbereitet', {
      ...meta,
      hasEmail: Boolean(signal.to.email),
      hasPhone: Boolean(signal.to.phone),
      finalPrice: formatMoneyValue(calculateFinalOrderPrice(after)),
      pickupWindow: formatPickupWindow(after.readyAt),
    });

    try {
      const results = await dispatchCustomerSignal(signal, meta);
      console.log('[KundenSignal] Versand abgeschlossen', { ...meta, results });
    } catch (error) {
      console.error('[KundenSignal] Unerwarteter Versandfehler', {
        ...meta,
        message: error?.message,
      });
    }

    return null;
  },
);

exports._test = {
  buildCustomerSignal,
  calculateFinalOrderPrice,
  formatPickupWindow,
  normalizePhoneForTwilio,
  createSmtpTransport,
  resolveFromAddress,
  sendCustomerEmail,
  sendCustomerSms,
};
