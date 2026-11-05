import { describe, expect, test } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { shouldNotifyAppReload, DEFAULT_BODY } = require('../appReloadPush')._test;

describe('appReloadPush', () => {
  test('sendet bei neuer required-Anforderung', () => {
    expect(shouldNotifyAppReload(undefined, {
      required: true,
      requestId: 'reload_1',
      notifyPush: true,
      message: 'Bitte speichern',
    })).toBe(true);
  });

  test('sendet bei neuem requestId während required bleibt', () => {
    expect(shouldNotifyAppReload(
      { required: true, requestId: 'reload_1', notifyPush: true },
      { required: true, requestId: 'reload_2', notifyPush: true },
    )).toBe(true);
  });

  test('sendet nicht bei gleichem requestId', () => {
    expect(shouldNotifyAppReload(
      { required: true, requestId: 'reload_1', notifyPush: true },
      { required: true, requestId: 'reload_1', notifyPush: true, updatedAt: 'later' },
    )).toBe(false);
  });

  test('respektiert notifyPush false und required false', () => {
    expect(shouldNotifyAppReload(undefined, {
      required: true,
      requestId: 'reload_1',
      notifyPush: false,
    })).toBe(false);
    expect(shouldNotifyAppReload(undefined, {
      required: false,
      requestId: 'reload_1',
      notifyPush: true,
    })).toBe(false);
    expect(DEFAULT_BODY).toMatch(/speichern/i);
  });
});
