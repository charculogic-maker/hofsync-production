const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { ensureAdminApp, getAdminDb } = require('./firebaseAdmin');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const { isConfiguredParam, readSmtpConfig, readTwilioConfig } = require('./runtimeParams');

function getNotificationConfig() {
  return {
    ...readSmtpConfig(),
    ...readTwilioConfig(),
  };
}

function pickConfiguredValue(...candidates) {
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim();
    if (isConfiguredParam(value)) return value;
  }
  return '';
}

/**
 * Mandanten-SMTP aus settings/profile mit Fallback auf globale Env/Params.
 * HOST/PORT/USER/PASS/FROM = settings.* || process.env.*
 */
function resolveTenantSmtpConfig(tenantSettings = {}, globalConfig = {}) {
  const smtpHost = pickConfiguredValue(
    tenantSettings.smtpHost,
    globalConfig.smtpHost,
    process.env.SMTP_HOST,
  ) || 'mail.agenturserver.de';
  const smtpPort = pickConfiguredValue(
    tenantSettings.smtpPort,
    globalConfig.smtpPort,
    process.env.SMTP_PORT,
  ) || '465';
  const smtpUser = pickConfiguredValue(
    tenantSettings.smtpUser,
    globalConfig.smtpUser,
    process.env.SMTP_USER,
  );
  const smtpPass = pickConfiguredValue(
    tenantSettings.smtpPass,
    globalConfig.smtpPass,
    process.env.SMTP_PASS,
  );
  const fromEmail = pickConfiguredValue(
    tenantSettings.smtpFromEmail,
    tenantSettings.fromEmail,
    globalConfig.fromEmail,
    process.env.FROM_EMAIL,
    smtpUser,
  );
  const tenantComplete = Boolean(
    pickConfiguredValue(tenantSettings.smtpHost)
    && pickConfiguredValue(tenantSettings.smtpUser)
    && pickConfiguredValue(tenantSettings.smtpPass),
  );
  return {
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    fromEmail,
    source: tenantComplete ? 'tenant' : 'global_fallback',
  };
}

function createSmtpTransport(config) {
  const nodemailer = require('nodemailer');
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

function shopLabel(profile = {}) {
  return String(profile.betriebsName || profile.name || 'Hofladen').trim() || 'Hofladen';
}

function configuredEmail(...candidates) {
  return candidates
    .map((value) => String(value || '').trim())
    .find((value) => value.includes('@') && value.toLowerCase() !== 'unset')
    || '';
}

function parseFromEmailField(value, defaultName) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const angled = raw.match(/^(.*)<([^>]+)>\s*$/);
  if (angled) {
    const address = String(angled[2] || '').trim();
    const name = String(angled[1] || '').trim().replace(/^["']|["']$/g, '') || defaultName;
    if (address.includes('@')) return { address, name };
  }
  if (raw.includes('@') && !raw.includes('<')) {
    return { address: raw, name: defaultName };
  }
  return null;
}

function resolveFromAddress(config, profile = {}) {
  const shop = shopLabel(profile);
  const parsed = parseFromEmailField(config?.fromEmail, shop)
    || parseFromEmailField(profile?.smtpFromEmail, shop);
  if (parsed) return parsed;

  const fromEmail = configuredEmail(
    config?.fromEmail,
    profile.smtpFromEmail,
    profile.supportEmail,
    profile.terminalUser,
    process.env.FROM_EMAIL,
    config?.smtpUser,
  );
  return fromEmail ? { address: fromEmail, name: shop } : null;
}

/**
 * Lädt Mandanten-Settings für SMTP/Branding.
 * Persistenz: tenants/{tenantId}/settings/profile (Dev-Dashboard „Mein Betrieb“).
 */
async function loadTenantProfile(tenantId) {
  if (!tenantId) return {};
  const snap = await getAdminDb().doc(`tenants/${tenantId}/settings/profile`).get();
  return snap.exists ? (snap.data() || {}) : {};
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
  const dayMonth = date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
  });
  const time = date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
  // „ab“ (nicht „um“): Abholung ist ab diesem Zeitpunkt möglich.
  return `${weekday}, ${dayMonth} ab ${time} Uhr`;
}

function timestampKey(value) {
  if (!value) return '';
  if (typeof value?.toMillis === 'function') {
    const ms = value.toMillis();
    return Number.isFinite(ms) ? String(ms) : '';
  }
  if (typeof value?.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? String(date.getTime()) : '';
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : String(value.getTime());
  }
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return '';
}

function normalizeNotifyChannels(raw) {
  if (!raw || typeof raw !== 'object') {
    return { email: true, sms: true, whatsapp: false };
  }
  const hasKey = ('email' in raw) || ('sms' in raw) || ('whatsapp' in raw);
  if (!hasKey) {
    return { email: true, sms: true, whatsapp: false };
  }
  return {
    email: raw.email !== false && raw.email !== 0 && raw.email !== '0',
    sms: raw.sms === true || raw.sms === 1 || raw.sms === '1',
    whatsapp: raw.whatsapp === true || raw.whatsapp === 1 || raw.whatsapp === '1',
  };
}

function wantsAnyReadyNotify(order = {}) {
  if (order.skipNotify === true || order.notifySkipped === true) return false;
  const channels = normalizeNotifyChannels(order.notifyChannels);
  return Boolean(channels.email || channels.sms || channels.whatsapp);
}

function wantsNotifyChannel(order = {}, channel = 'email') {
  if (!wantsAnyReadyNotify(order)) return false;
  const channels = normalizeNotifyChannels(order.notifyChannels);
  if (channel === 'email') return channels.email;
  if (channel === 'sms') return channels.sms;
  if (channel === 'whatsapp') return channels.whatsapp;
  return false;
}

function shouldSendReadySignal(before = {}, after = {}) {
  // Explizit abgewählt (Sicherheitsnetz „ohne Nachricht“) → kein Kunden-Signal.
  if (!wantsAnyReadyNotify(after)) {
    return { send: false, kind: null, skipped: true };
  }
  const becameReady = before.status !== 'ready' && after.status === 'ready';
  if (becameReady) return { send: true, kind: 'initial' };
  if (after.status !== 'ready') return { send: false, kind: null };
  const beforeKey = timestampKey(before.readyNotifyAt);
  const afterKey = timestampKey(after.readyNotifyAt);
  if (afterKey && afterKey !== beforeKey) {
    return { send: true, kind: 'update' };
  }
  return { send: false, kind: null };
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

function operatorLabel(order = {}) {
  const name = String(
    order.readyNotifyBy
    || order.readyMarkedBy
    || order.packedBy
    || order.readyBy
    || order.preparedBy
    || order.updatedBy
    || '',
  ).trim();
  return name || 'Das Team';
}

function buildCustomerSignal(order, profile = {}, options = {}) {
  const customerName = String(order?.customerName || 'lieber Hofladen-Gast').trim();
  const pickupWindow = formatPickupWindow(order?.readyAt);
  const finalPrice = formatMoneyValue(calculateFinalOrderPrice(order));
  const shop = shopLabel(profile);
  const operator = operatorLabel(order);
  const isUpdate = options.kind === 'update';
  const lead = isUpdate
    ? `Hallo ${customerName}, kurzes Update zu deinem Genuss-Paket:`
    : `Hallo ${customerName}, dein Genuss-Paket ist fertig gepackt!`;
  const htmlLead = isUpdate
    ? `<p>Hallo ${escapeHtml(customerName)},</p>\n<p>kurzes <strong>Update</strong> zu deinem Genuss-Paket:</p>`
    : `<p>Hallo ${escapeHtml(customerName)},</p>\n<p>dein <strong>Genuss-Paket</strong> ist fertig gepackt!</p>`;
  const message = [
    lead,
    `${operator} hat alles frisch vorbereitet.`,
    `Der genaue Waagen-Endpreis beträgt ${finalPrice} €.`,
    `Du kannst es ${pickupWindow} abholen.`,
    'Wir freuen uns auf dich!',
    `Dein ${shop}-Team.`,
  ].join(' ');

  const htmlMessage = [
    htmlLead,
    `<p>${escapeHtml(operator)} hat alles frisch vorbereitet.</p>`,
    `<p>Der genaue Waagen-Endpreis beträgt <strong>${escapeHtml(finalPrice)}&nbsp;€</strong>.</p>`,
    `<p>Du kannst es ${escapeHtml(pickupWindow)} abholen.</p>`,
    '<p>Wir freuen uns auf dich!</p>',
    `<p>Dein ${escapeHtml(shop)}-Team.</p>`,
  ].join('\n');

  return {
    to: {
      name: customerName,
      email: order?.customerEmail || null,
      phone: order?.callbackPhone || null,
    },
    message,
    htmlMessage,
    subject: isUpdate
      ? 'Update: Dein Genuss-Paket ist abholbereit'
      : 'Dein Genuss-Paket ist abholbereit',
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
    return { channel: 'email', skipped: true, reason: 'no_recipient' };
  }

  const smtpUser = String(config.smtpUser || '').trim();
  const smtpPass = String(config.smtpPass || '');
  const from = resolveFromAddress(config, meta?.profile || {});
  if (!isConfiguredParam(smtpUser) || !isConfiguredParam(smtpPass) || !from) {
    console.warn('[KundenSignal] SMTP nicht konfiguriert, E-Mail uebersprungen', {
      tenantId: meta?.tenantId,
      orderId: meta?.orderId,
      smtpSource: config.source || null,
      smtpHost: config.smtpHost || null,
      smtpUserConfigured: isConfiguredParam(smtpUser),
      smtpPassConfigured: isConfiguredParam(smtpPass),
      fromConfigured: Boolean(from),
    });
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
    console.log('[KundenSignal] E-Mail versendet', {
      tenantId: meta?.tenantId,
      orderId: meta?.orderId,
      email: signal.to.email,
      smtpSource: config.source || null,
    });
    return { channel: 'email', sent: true, source: config.source || null };
  } catch (error) {
    console.error('[KundenSignal] SMTP-Fehler', {
      tenantId: meta?.tenantId,
      orderId: meta?.orderId,
      email: signal.to.email,
      smtpSource: config.source || null,
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
    const twilio = require('twilio');
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

async function dispatchCustomerSignal(signal, meta, order = {}) {
  const globalConfig = getNotificationConfig();
  const smtpConfig = resolveTenantSmtpConfig(meta?.profile || {}, globalConfig);
  const config = {
    ...globalConfig,
    ...smtpConfig,
  };
  const channels = normalizeNotifyChannels(order?.notifyChannels);

  console.log('[KundenSignal] SMTP-Aufloesung', {
    tenantId: meta?.tenantId,
    orderId: meta?.orderId,
    smtpSource: smtpConfig.source,
    smtpHost: smtpConfig.smtpHost,
    smtpPort: smtpConfig.smtpPort,
    smtpUserConfigured: isConfiguredParam(smtpConfig.smtpUser),
    smtpPassConfigured: isConfiguredParam(smtpConfig.smtpPass),
    fromConfigured: Boolean(smtpConfig.fromEmail),
    notifyChannels: channels,
    skipNotify: Boolean(order?.skipNotify || order?.notifySkipped),
  });

  const tasks = [];

  if (signal.to.email && wantsNotifyChannel(order, 'email')) {
    tasks.push(sendCustomerEmail(signal, config, meta));
  } else if (signal.to.email) {
    tasks.push(Promise.resolve({ channel: 'email', skipped: true, reason: 'channel_disabled' }));
  }

  if (signal.to.phone && wantsNotifyChannel(order, 'sms')) {
    tasks.push(sendCustomerSms(signal, config, meta));
  } else if (signal.to.phone && channels.sms) {
    tasks.push(Promise.resolve({ channel: 'sms', skipped: true, reason: 'channel_disabled' }));
  }

  if (channels.whatsapp) {
    tasks.push(Promise.resolve({
      channel: 'whatsapp',
      skipped: true,
      reason: 'not_implemented',
    }));
  }

  if (!tasks.length) {
    console.log('[KundenSignal] Kein Kundenkanal hinterlegt, Versand uebersprungen', {
      tenantId: meta?.tenantId,
      orderId: meta?.orderId,
    });
    return [];
  }

  return Promise.all(tasks);
}

async function handleOrderReadySendSignal(event) {
  const tenantId = event.params?.tenantId || null;
  const orderId = event.params?.orderId || null;
  console.log('[KundenSignal] Trigger gefeuert', {
    tenantId,
    orderId,
    beforeStatus: event.data?.before?.data()?.status ?? null,
    afterStatus: event.data?.after?.data()?.status ?? null,
  });

  ensureAdminApp();
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!before || !after) {
    console.warn('[KundenSignal] Abbruch: before/after fehlt', { tenantId, orderId });
    return null;
  }
  const readySignal = shouldSendReadySignal(before, after);
  if (!readySignal.send) {
    console.log('[KundenSignal] Abbruch: kein Ready-Signal', {
      tenantId,
      orderId,
      beforeStatus: before.status,
      afterStatus: after.status,
      beforeReadyNotifyAt: timestampKey(before.readyNotifyAt) || null,
      afterReadyNotifyAt: timestampKey(after.readyNotifyAt) || null,
      skipNotify: Boolean(after.skipNotify || after.notifySkipped),
      skippedByPreference: Boolean(readySignal.skipped),
    });
    return null;
  }

  if (after.tenantId && after.tenantId !== tenantId) {
    console.warn('[KundenSignal] Tenant-Abgleich uebersprungen', { tenantId, orderId });
    return null;
  }

  console.log('[KundenSignal] Lade Mandanten-Settings', {
    tenantId,
    path: `tenants/${tenantId}/settings/profile`,
    signalKind: readySignal.kind,
  });
  const profile = await loadTenantProfile(tenantId);
  const meta = { tenantId, orderId, customerName: after.customerName || null, profile };
  const signal = buildCustomerSignal(after, profile, { kind: readySignal.kind });

  console.log('[KundenSignal] Abhol-Nachricht vorbereitet', {
    tenantId,
    orderId,
    customerName: meta.customerName,
    hasEmail: Boolean(signal.to.email),
    hasPhone: Boolean(signal.to.phone),
    finalPrice: formatMoneyValue(calculateFinalOrderPrice(after)),
    pickupWindow: formatPickupWindow(after.readyAt),
    tenantSmtpHost: profile.smtpHost || null,
    tenantSmtpUserSet: Boolean(String(profile.smtpUser || '').trim()),
  });

  try {
    const results = await dispatchCustomerSignal(signal, meta, after);
    console.log('[KundenSignal] Versand abgeschlossen', { tenantId, orderId, results });
  } catch (error) {
    console.error('[KundenSignal] Unerwarteter Versandfehler', {
      tenantId,
      orderId,
      message: error?.message,
    });
  }

  return null;
}

exports.handleOrderReadySendSignal = handleOrderReadySendSignal;
exports.onOrderReadySendSignal = onDocumentUpdated(
  {
    document: 'tenants/{tenantId}/customerOrders/{orderId}',
    region: 'europe-west3',
  },
  handleOrderReadySendSignal,
);

exports._test = {
  buildCustomerSignal,
  calculateFinalOrderPrice,
  formatPickupWindow,
  shouldSendReadySignal,
  wantsAnyReadyNotify,
  wantsNotifyChannel,
  normalizeNotifyChannels,
  timestampKey,
  normalizePhoneForTwilio,
  createSmtpTransport,
  resolveFromAddress,
  resolveTenantSmtpConfig,
  parseFromEmailField,
  sendCustomerEmail,
  sendCustomerSms,
  dispatchCustomerSignal,
};
