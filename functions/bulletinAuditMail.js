const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const nodemailer = require('nodemailer');
const { isConfiguredParam, readSmtpConfig, DEFAULT_FROM_EMAIL } = require('./runtimeParams');

const OFFICE_EMAIL = DEFAULT_FROM_EMAIL;

function getSmtpConfig() {
  return readSmtpConfig();
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
  return fromEmail ? { address: fromEmail, name: 'StevesHof Hofladen' } : null;
}

function formatAuditTimestamp(value) {
  if (!value) return '–';
  if (typeof value.toDate === 'function') {
    return value.toDate().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });
  }
  const parsed = Date.parse(String(value));
  if (Number.isNaN(parsed)) return String(value);
  return new Date(parsed).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });
}

function buildAuditEmailBody(data, tenantId) {
  const employeeName = String(data.employeeName || '').trim() || 'Unbekannt';
  const confirmedAt = formatAuditTimestamp(data.confirmedAt);
  const directive = String(data.bulletinMessage || '').trim() || '–';
  const deviceId = String(data.deviceId || '').trim() || '–';

  const text = [
    'Bestätigung: Nachricht des Tages',
    '',
    `Mitarbeiter/in: ${employeeName}`,
    `Zeitpunkt: ${confirmedAt}`,
    `Mandant: ${tenantId}`,
    `Gerät: ${deviceId}`,
    '',
    'Inhalt der bestätigten Anweisung:',
    directive,
    '',
    'Diese E-Mail wurde automatisch als Audit-Nachweis erzeugt.',
  ].join('\n');

  const html = `
    <h2 style="margin:0 0 16px;font-family:Georgia,serif;">Bestätigung: Nachricht des Tages</h2>
    <table style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;border-collapse:collapse;">
      <tr><td style="padding:4px 12px 4px 0;font-weight:600;">Mitarbeiter/in</td><td>${employeeName}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;font-weight:600;">Zeitpunkt</td><td>${confirmedAt}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;font-weight:600;">Mandant</td><td>${tenantId}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;font-weight:600;">Gerät</td><td>${deviceId}</td></tr>
    </table>
    <p style="font-family:Arial,sans-serif;font-size:14px;margin:20px 0 8px;font-weight:600;">Inhalt der bestätigten Anweisung</p>
    <div style="font-family:Georgia,serif;font-size:15px;line-height:1.6;white-space:pre-wrap;border-left:3px solid #5D4037;padding-left:12px;">${directive.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    <p style="font-family:Arial,sans-serif;font-size:12px;color:#666;margin-top:24px;">Automatisch erzeugter Audit-Nachweis.</p>
  `;

  return { text, html };
}

async function sendAuditMail(transport, from, to, subject, body) {
  if (!to) return { skipped: true, to };
  await transport.sendMail({
    from,
    to,
    subject,
    text: body.text,
    html: `<!DOCTYPE html><html lang="de"><body style="color:#2f2a24;max-width:640px;margin:0 auto;padding:24px;">${body.html}</body></html>`,
  });
  return { sent: true, to };
}

exports.onBulletinConfirmationAuditMail = onDocumentCreated(
  {
    document: 'tenants/{tenantId}/bulletinConfirmations/{confirmationId}',
    region: 'europe-west3',
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return null;

    const tenantId = event.params.tenantId;
    if (data.tenantId && data.tenantId !== tenantId) {
      console.warn('[BulletinAudit] Tenant-Abgleich fehlgeschlagen', { tenantId, docTenant: data.tenantId });
      return null;
    }

    const config = getSmtpConfig();
    const smtpUser = String(config.smtpUser || '').trim();
    const smtpPass = String(config.smtpPass || '');
    const from = resolveFromAddress(config);
    if (!isConfiguredParam(smtpUser) || !isConfiguredParam(smtpPass) || !from) {
      console.warn('[BulletinAudit] SMTP nicht konfiguriert — Audit-Mail übersprungen', { tenantId });
      return null;
    }

    const employeeName = String(data.employeeName || '').trim() || 'Mitarbeiter/in';
    const employeeEmail = String(data.profileEmail || '').trim();
    const subject = `Audit: Nachricht des Tages bestätigt — ${employeeName}`;
    const body = buildAuditEmailBody(data, tenantId);
    const transport = createSmtpTransport(config);

    const destinations = [
      { label: 'office', address: OFFICE_EMAIL },
      { label: 'employee', address: employeeEmail },
    ].filter((entry) => entry.address);

    if (!destinations.length) {
      console.warn('[BulletinAudit] Keine Zieladresse hinterlegt', { tenantId, employeeName });
      return null;
    }

    const results = await Promise.all(
      destinations.map(async ({ label, address }) => {
        try {
          await sendAuditMail(transport, from, address, subject, body);
          console.log('[BulletinAudit] Audit-Mail versendet', { tenantId, label, address });
          return { label, sent: true };
        } catch (error) {
          console.error('[BulletinAudit] SMTP-Fehler', {
            tenantId,
            label,
            address,
            message: error?.message,
          });
          return { label, sent: false, error: error?.message || 'send_failed' };
        }
      }),
    );

    return results;
  },
);
