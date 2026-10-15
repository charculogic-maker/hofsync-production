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
const SMTP_USER = defineOptionalString('SMTP_USER', 'SMTP-Benutzer (optional)');
const SMTP_PASS = defineOptionalString('SMTP_PASS', 'SMTP-Passwort (optional)');
const FROM_EMAIL = defineOptionalString('FROM_EMAIL', 'Absender-Adresse (optional; sonst Profil oder FROM_EMAIL-Env)');
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

function readConfigured(paramValue) {
  const value = String(paramValue || process.env.FROM_EMAIL || '').trim();
  return isConfiguredParam(value) ? value : '';
}

function readSmtpConfig() {
  const smtpUser = String(SMTP_USER.value() || '').trim();
  const fromEmail = String(FROM_EMAIL.value() || '').trim();
  return {
    smtpHost: String(SMTP_HOST.value() || DEFAULT_SMTP_HOST).trim(),
    smtpPort: String(SMTP_PORT.value() || DEFAULT_SMTP_PORT).trim(),
    smtpUser: isConfiguredParam(smtpUser) ? smtpUser : '',
    smtpPass: String(SMTP_PASS.value() || '').trim(),
    fromEmail: isConfiguredParam(fromEmail) ? fromEmail : readConfigured(process.env.FROM_EMAIL),
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
