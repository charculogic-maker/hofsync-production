import { describe, expect, test } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  resolveTenantSmtpConfig,
  parseFromEmailField,
  resolveFromAddress,
  stripSecretProfileFields,
} = require('../orderNotifications')._test;

describe('orderNotifications mandanten SMTP', () => {
  test('nutzt Tenant-SMTP vor globalem Fallback', () => {
    const resolved = resolveTenantSmtpConfig(
      {
        smtpHost: 'smtp.hof.de',
        smtpPort: '587',
        smtpUser: 'mail@hof.de',
        smtpPass: 'secret-tenant',
        smtpFromEmail: 'Hofladen <mail@hof.de>',
      },
      {
        smtpHost: 'mail.agenturserver.de',
        smtpPort: '465',
        smtpUser: 'global@example.com',
        smtpPass: 'global-secret',
        fromEmail: 'global@example.com',
      },
    );
    expect(resolved.smtpHost).toBe('smtp.hof.de');
    expect(resolved.smtpPort).toBe('587');
    expect(resolved.smtpUser).toBe('mail@hof.de');
    expect(resolved.smtpPass).toBe('secret-tenant');
    expect(resolved.fromEmail).toBe('Hofladen <mail@hof.de>');
    expect(resolved.source).toBe('tenant');
  });

  test('fällt auf Env/Global zurück wenn Tenant leer', () => {
    const resolved = resolveTenantSmtpConfig(
      {},
      {
        smtpHost: 'mail.agenturserver.de',
        smtpPort: '465',
        smtpUser: 'global@example.com',
        smtpPass: 'global-secret',
        fromEmail: 'global@example.com',
      },
    );
    expect(resolved.smtpHost).toBe('mail.agenturserver.de');
    expect(resolved.smtpUser).toBe('global@example.com');
    expect(resolved.source).toBe('global_fallback');
  });

  test('parst Absender mit Anzeigename', () => {
    expect(parseFromEmailField('Hofladen <info@hof.de>', 'Shop')).toEqual({
      address: 'info@hof.de',
      name: 'Hofladen',
    });
  });

  test('resolveFromAddress bevorzugt config.fromEmail', () => {
    const from = resolveFromAddress(
      { fromEmail: 'Mein Hof <bestellung@hof.de>', smtpUser: 'bestellung@hof.de' },
      { betriebsName: 'StevesHof' },
    );
    expect(from).toEqual({ address: 'bestellung@hof.de', name: 'Mein Hof' });
  });

  test('entfernt SMTP-Passwort aus öffentlichem Profil für Logs', () => {
    expect(stripSecretProfileFields({
      betriebsName: 'StevesHof',
      smtpUser: 'mail@hof.de',
      smtpPass: 'secret-tenant',
    })).toEqual({
      betriebsName: 'StevesHof',
      smtpUser: 'mail@hof.de',
    });
  });
});
