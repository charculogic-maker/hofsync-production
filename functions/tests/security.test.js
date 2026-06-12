import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const adminDbMock = require('./mocks/adminDb.cjs');
const mockState = adminDbMock.__mockState();

const CRYPTO_LEAK_PATTERN = /hash|salt|pbkdf2|digest|iteration/i;
const CALLABLE_BASE_URL = process.env.SECURITY_TEST_CALLABLE_BASE_URL || '';

function resetMockState() {
  mockState.priceRunStore = {};
  mockState.fleischpreiseWrites = [];
  mockState.credentialsDoc = null;
  mockState.pinAttemptsDoc = null;
}

function stringifyErrorPayload(error) {
  if (!error) return '';
  const parts = [
    error.message,
    error.code,
    error.details,
    JSON.stringify(error),
  ];
  return parts.filter(Boolean).join(' ');
}

function buildCallableBody(data = {}) {
  return JSON.stringify({ data });
}

async function postCallable(functionName, { headers = {}, body = buildCallableBody() } = {}) {
  const url = `${CALLABLE_BASE_URL.replace(/\/$/, '')}/${functionName}`;
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body,
  });
}

describe('Vector 2 – App Check bypass (staging smoke)', () => {
  const runStaging = CALLABLE_BASE_URL ? test : test.skip;

  runStaging('verifyTerminalPin rejects missing X-Firebase-AppCheck', async () => {
    const response = await postCallable('verifyTerminalPin', {
      body: buildCallableBody({
        mode: 'employee',
        pin: '1234',
        employeeName: 'SmokeTest',
      }),
    });

    expect([401, 403]).toContain(response.status);
    const payload = stringifyErrorPayload(await response.json().catch(() => ({})));
    expect(payload.toLowerCase()).not.toMatch(CRYPTO_LEAK_PATTERN);
  });

  runStaging('verifyTerminalPin rejects forged App Check token', async () => {
    const response = await postCallable('verifyTerminalPin', {
      headers: {
        'X-Firebase-AppCheck': 'forged-invalid-token-smoke-test',
      },
      body: buildCallableBody({
        mode: 'employee',
        pin: '1234',
        employeeName: 'SmokeTest',
      }),
    });

    expect([401, 403]).toContain(response.status);
  });

  runStaging('triggerManualMeatPriceRun rejects missing X-Firebase-AppCheck', async () => {
    const response = await postCallable('triggerManualMeatPriceRun', {
      body: buildCallableBody({}),
    });

    expect([401, 403]).toContain(response.status);
  });

  runStaging('triggerManualMeatPriceRun rejects forged App Check token', async () => {
    const response = await postCallable('triggerManualMeatPriceRun', {
      headers: {
        'X-Firebase-AppCheck': 'forged-invalid-token-smoke-test',
      },
      body: buildCallableBody({}),
    });

    expect([401, 403]).toContain(response.status);
  });

  runStaging('parseDeliveryNote rejects missing X-Firebase-AppCheck', async () => {
    const response = await postCallable('parseDeliveryNote', {
      body: buildCallableBody({
        imageBase64: '',
        mimeType: 'image/jpeg',
      }),
    });

    expect([401, 403]).toContain(response.status);
    const payload = stringifyErrorPayload(await response.json().catch(() => ({})));
    expect(payload.toLowerCase()).not.toMatch(CRYPTO_LEAK_PATTERN);
  });

  runStaging('parseDeliveryNote rejects forged App Check token', async () => {
    const response = await postCallable('parseDeliveryNote', {
      headers: {
        'X-Firebase-AppCheck': 'forged-invalid-token-smoke-test',
      },
      body: buildCallableBody({
        imageBase64: 'dGVzdA==',
        mimeType: 'image/jpeg',
      }),
    });

    expect([401, 403]).toContain(response.status);
  });
});

describe('Vector 4 – PIN leak contract', () => {
  beforeEach(() => {
    resetMockState();
    vi.resetModules();
  });

  test('unknown employee + bad PIN response contains no crypto material', async () => {
    const { createPinRecord } = await import('../pinHash.js');
    mockState.credentialsDoc = {
      employees: {
        KnownUser: createPinRecord('1234'),
      },
      meister: {},
    };

    const { handleVerifyTerminalPin } = await import('../verifyTerminalPinCallable.js');
    const response = await handleVerifyTerminalPin({
      auth: {
        uid: 'uid-contract-1',
        token: { tenantId: 'tenant-a', role: 'employee' },
      },
      data: {
        mode: 'employee',
        employeeName: 'UnknownUser',
        pin: '9999',
      },
    });

    const serialized = JSON.stringify(response);
    expect(serialized).not.toMatch(CRYPTO_LEAK_PATTERN);
    expect(response).toEqual({ ok: false });
  });

  test('known employee + bad PIN response contains no crypto material', async () => {
    const { createPinRecord } = await import('../pinHash.js');
    mockState.credentialsDoc = {
      employees: {
        KnownUser: createPinRecord('1234'),
      },
      meister: {},
    };

    const { handleVerifyTerminalPin } = await import('../verifyTerminalPinCallable.js');
    const response = await handleVerifyTerminalPin({
      auth: {
        uid: 'uid-contract-2',
        token: { tenantId: 'tenant-a', role: 'employee' },
      },
      data: {
        mode: 'employee',
        employeeName: 'KnownUser',
        pin: '9999',
      },
    });

    const serialized = JSON.stringify(response);
    expect(serialized).not.toMatch(CRYPTO_LEAK_PATTERN);
    expect(response.ok).toBe(false);
  });

  test('invalid PIN format error contains no crypto material', async () => {
    mockState.credentialsDoc = { employees: {}, meister: {} };
    const { handleVerifyTerminalPin } = await import('../verifyTerminalPinCallable.js');

    let caught = null;
    try {
      await handleVerifyTerminalPin({
        auth: {
          uid: 'uid-contract-3',
          token: { tenantId: 'tenant-a', role: 'employee' },
        },
        data: {
          mode: 'employee',
          employeeName: 'Anyone',
          pin: '12ab',
        },
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeTruthy();
    expect(stringifyErrorPayload(caught)).not.toMatch(CRYPTO_LEAK_PATTERN);
  });
});

describe('Vector 5 – meat price corruption guard', () => {
  const maliciousFixtures = [
    { name: 'negative price', fixture: [{ category: 'Schwein', cut: 'S-E', price_conv: -5, price_bio: 0 }] },
    { name: 'missing cut', fixture: [{ category: 'Rind', cut: '', price_conv: 2.5, price_bio: 0 }] },
    { name: 'extreme price', fixture: [{ category: 'Lamm', cut: 'Keule', price_conv: 9999, price_bio: 0 }] },
    { name: 'null payload', fixture: null },
    { name: 'insufficient entries', fixture: [{ category: 'X', cut: 'Y', price_conv: 1.2, price_bio: 1.1 }] },
  ];

  let publishSpy;

  beforeEach(() => {
    resetMockState();
    vi.resetModules();
    publishSpy = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const validFixture = [
    { id: 1, category: 'Schwein', cut: 'S-E', price_conv: 2.1, price_bio: 3.2, trend: 'stabil', last_update: '2026-06-03' },
    { id: 2, category: 'Rind', cut: 'R3', price_conv: 5.4, price_bio: 6.1, trend: 'steigend', last_update: '2026-06-03' },
    { id: 3, category: 'Lamm', cut: 'Keule', price_conv: 8.7, price_bio: 10.2, trend: 'stabil', last_update: '2026-06-03' },
  ];

  test('publishes validated prices on happy path', async () => {
    const meatPrices = await import('../meatPrices.js');

    const result = await meatPrices.executeMeatPriceRun({
      tenantId: 'test-tenant',
      initiatedBy: 'vitest',
      deps: {
        fetchMeatPricesFromGemini: async () => ({
          validatedPrices: meatPrices.validateParsedPrices(validFixture),
          modelUsed: 'test-model',
          sourceUrls: ['query:fleischpreise kw'],
          rawEvidence: JSON.stringify(validFixture),
        }),
      },
    });

    expect(result.ok).toBe(true);
    expect(result.priceCount).toBe(3);
    expect(mockState.fleischpreiseWrites).toHaveLength(1);
    expect(mockState.fleischpreiseWrites[0].path).toMatch(/^tenants\/test-tenant\/fleischpreise\//);
    expect(mockState.fleischpreiseWrites[0].data.preise).toHaveLength(3);

    const successfulRun = Object.values(mockState.priceRunStore).find((doc) => doc.status === 'success');
    expect(successfulRun).toBeTruthy();
    expect(successfulRun.priceCount).toBe(3);
    expect(successfulRun.firestorePath).toMatch(/^tenants\/test-tenant\/fleischpreise\//);
  });

  test('accepts markdown-wrapped JSON price arrays', async () => {
    const meatPrices = await import('../meatPrices.js');
    const parsed = meatPrices.extractJsonArray(`\`\`\`json\n${JSON.stringify(validFixture)}\n\`\`\``);
    const validated = meatPrices.validateParsedPrices(parsed);

    expect(validated).toHaveLength(3);
    expect(validated[0]).toMatchObject({ category: 'Schwein', cut: 'S-E', price_conv: 2.1 });
  });

  test('parse failure marks run failed without price mutation', async () => {
    const meatPrices = await import('../meatPrices.js');
    const loggerSpy = vi.spyOn(meatPrices.logger, 'error').mockImplementation(() => {});

    await expect(meatPrices.executeMeatPriceRun({
      tenantId: 'test-tenant',
      initiatedBy: 'vitest',
      deps: {
        fetchMeatPricesFromGemini: async () => {
          meatPrices.extractJsonArray('Gemini lieferte heute nur Fließtext ohne Liste.');
        },
        publishValidatedPrices: publishSpy,
      },
    })).rejects.toThrow();

    expect(publishSpy).not.toHaveBeenCalled();
    expect(mockState.fleischpreiseWrites).toHaveLength(0);

    const failedRun = Object.values(mockState.priceRunStore).find((doc) => doc.status === 'failed');
    expect(failedRun).toBeTruthy();
    expect(failedRun.errorCode).toBe(meatPrices.ERROR_CODES.PARSE);
    expect(failedRun.correlationId).toBeTruthy();

    loggerSpy.mockRestore();
  });

  test.each(maliciousFixtures)('blocks production write for $name', async ({ fixture }) => {
    const meatPrices = await import('../meatPrices.js');
    const { validateParsedPrices, ERROR_CODES } = meatPrices;
    const loggerSpy = vi.spyOn(meatPrices.logger, 'error').mockImplementation(() => {});

    await expect(meatPrices.executeMeatPriceRun({
      tenantId: 'test-tenant',
      initiatedBy: 'vitest',
      deps: {
        fetchMeatPricesFromGemini: async () => {
          validateParsedPrices(Array.isArray(fixture) ? fixture : []);
          return {
            validatedPrices: [],
            modelUsed: 'test-model',
            sourceUrls: [],
            rawEvidence: '',
          };
        },
        publishValidatedPrices: publishSpy,
      },
    })).rejects.toThrow();

    expect(publishSpy).not.toHaveBeenCalled();
    expect(mockState.fleischpreiseWrites).toHaveLength(0);

    const failedRun = Object.values(mockState.priceRunStore).find((doc) => doc.status === 'failed');
    expect(failedRun).toBeTruthy();
    expect(failedRun.correlationId).toBeTruthy();
    expect(failedRun.errorCode).toBeTruthy();
    expect(failedRun.errorCode).toMatch(/^ERR_/);
    expect(JSON.stringify(failedRun)).not.toMatch(/stack|at Object\.|node_modules/i);
    if (fixture === null || (Array.isArray(fixture) && fixture.length < 3)) {
      expect([ERROR_CODES.VALIDATION, ERROR_CODES.PARSE, ERROR_CODES.UNKNOWN]).toContain(failedRun.errorCode);
    } else {
      expect(failedRun.errorCode).toBe(ERROR_CODES.VALIDATION);
    }

    const failureLog = loggerSpy.mock.calls.find(
      (call) => String(call[0]).includes('[FLEISCHPREIS_RUN_FAILED]'),
    );
    expect(failureLog).toBeTruthy();
    expect(String(failureLog[0])).toContain('Correlation ID:');

    loggerSpy.mockRestore();
  });

  test('skips scheduled meat price run on whitelabel test project', async () => {
    const meatPrices = await import('../meatPrices.js');

    expect(meatPrices.shouldSkipScheduledMeatPriceRun('charculogic-whitelabel-test')).toBe(true);
    expect(meatPrices.shouldSkipScheduledMeatPriceRun('hofsync-production')).toBe(false);
    expect(meatPrices.shouldSkipScheduledMeatPriceRun('')).toBe(false);
  });
});
