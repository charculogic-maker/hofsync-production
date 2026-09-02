import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, test } from 'vitest';
import {
  PARAM_UNSET,
  isConfiguredParam,
} from '../runtimeParams.js';

const FUNCTIONS_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REQUIRED_PARAM_KEYS = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'FROM_EMAIL',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'FROM_NUMBER',
];

function readEnvKeys(fileName) {
  const raw = readFileSync(join(FUNCTIONS_ROOT, fileName), 'utf8');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => line.slice(0, line.indexOf('=')));
}

describe('runtimeParams – optional Firebase params', () => {
  test('treats unset / empty / disabled as not configured', () => {
    expect(isConfiguredParam('')).toBe(false);
    expect(isConfiguredParam('   ')).toBe(false);
    expect(isConfiguredParam(PARAM_UNSET)).toBe(false);
    expect(isConfiguredParam('UNSET')).toBe(false);
    expect(isConfiguredParam('disabled')).toBe(false);
    expect(isConfiguredParam('none')).toBe(false);
    expect(isConfiguredParam(null)).toBe(false);
  });

  test('treats real Twilio / SMTP values as configured', () => {
    expect(isConfiguredParam('ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')).toBe(true);
    expect(isConfiguredParam('smtp-secret')).toBe(true);
    expect(isConfiguredParam('+491701234567')).toBe(true);
  });

  test.each([
    '.env.example',
    '.env.hofsync-production',
    '.env.whitelabel',
    '.env.charculogic-whitelabel-test',
  ])('%s lists every deploy param so CLI will not prompt', (fileName) => {
    const keys = readEnvKeys(fileName);
    for (const key of REQUIRED_PARAM_KEYS) {
      expect(keys).toContain(key);
    }
    expect(keys).toContain('TWILIO_ACCOUNT_SID');
  });
});
