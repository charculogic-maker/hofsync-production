/**
 * Firebase parameterized config for non-interactive deploys.
 *
 * Empty-string defaults are treated as "missing" by the Firebase CLI
 * (`if (param.default)`), which prompts `? Enter a string value for …`.
 * Use a non-empty sentinel (`unset`) plus committed `.env.<project>` files.
 */
const { defineString } = require('firebase-functions/params');

const PARAM_UNSET = 'unset';
const DEFAULT_SMTP_HOST = 'mail.agenturserver.de';
const DEFAULT_SMTP_PORT = '465';
const DEFAULT_FROM_EMAIL = 'bestellung@steveshof-hofladen.de';

function defineOptionalString(name, description) {
  return defineString(name, {
    default: PARAM_UNSET,
    description: description || `${name} (optional; "${PARAM_UNSET}" = nicht konfiguriert)`,
  });
}

function isConfiguredParam(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return Boolean(normalized)
    && normalized !== PARAM_UNSET
    && normalized !== 'disabled'
    && normalized !== 'none';
}

const SMTP_HOST = defineString('SMTP_HOST', { default: DEFAULT_SMTP_HOST });
const SMTP_PORT = defineString('SMTP_PORT', { default: DEFAULT_SMTP_PORT });
const SMTP_USER = defineString('SMTP_USER', { default: DEFAULT_FROM_EMAIL });
const SMTP_PASS = defineOptionalString('SMTP_PASS', 'SMTP-Passwort (optional)');
const FROM_EMAIL = defineString('FROM_EMAIL', { default: DEFAULT_FROM_EMAIL });
const TWILIO_ACCOUNT_SID = defineOptionalString(
  'TWILIO_ACCOUNT_SID',
  'Twilio Account SID (optional, SMS Kunden-Signal)',
);
const TWILIO_AUTH_TOKEN = defineOptionalString(
  'TWILIO_AUTH_TOKEN',
  'Twilio Auth Token (optional, SMS Kunden-Signal)',
);
const FROM_NUMBER = defineOptionalString(
  'FROM_NUMBER',
  'Twilio Absender-Nummer (optional, E.164)',
);

function readSmtpConfig() {
  return {
    smtpHost: String(SMTP_HOST.value() || DEFAULT_SMTP_HOST).trim(),
    smtpPort: String(SMTP_PORT.value() || DEFAULT_SMTP_PORT).trim(),
    smtpUser: String(SMTP_USER.value() || DEFAULT_FROM_EMAIL).trim(),
    smtpPass: String(SMTP_PASS.value() || '').trim(),
    fromEmail: String(FROM_EMAIL.value() || DEFAULT_FROM_EMAIL).trim(),
  };
}

function readTwilioConfig() {
  return {
    twilioAccountSid: String(TWILIO_ACCOUNT_SID.value() || '').trim(),
    twilioAuthToken: String(TWILIO_AUTH_TOKEN.value() || '').trim(),
    fromNumber: String(FROM_NUMBER.value() || '').trim(),
  };
}

module.exports = {
  PARAM_UNSET,
  DEFAULT_SMTP_HOST,
  DEFAULT_SMTP_PORT,
  DEFAULT_FROM_EMAIL,
  defineOptionalString,
  isConfiguredParam,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  FROM_EMAIL,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  FROM_NUMBER,
  readSmtpConfig,
  readTwilioConfig,
};
