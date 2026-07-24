/**
 * App Check enforcement contract for all HTTPS Callable exports.
 * Complements staging smoke tests in security.test.js (Vector 2).
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const FUNCTIONS_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** @type {{ id: string, file: string, anchor?: string }[]} */
const APP_CHECK_CALLABLES = [
  { id: 'parseDeliveryNote', file: 'parseDeliveryNoteCallable.js', anchor: 'exports.parseDeliveryNote' },
  { id: 'parseMeatLabel', file: 'parseMeatLabelCallable.js', anchor: 'exports.parseMeatLabel' },
  { id: 'verifyTerminalPin', file: 'verifyTerminalPinCallable.js', anchor: 'exports.verifyTerminalPin' },
  { id: 'triggerManualMeatPriceRun', file: 'meatPrices.js', anchor: 'triggerManualMeatPriceRun' },
  { id: 'createTenantEmployee', file: 'createTenantEmployee.js', anchor: 'exports.createTenantEmployee' },
  { id: 'manageTenantEmployees', file: 'manageTenantEmployees.js', anchor: 'exports.manageTenantEmployees' },
];

const ON_CALL_SOURCE_FILES = [
  'parseDeliveryNoteCallable.js',
  'parseMeatLabelCallable.js',
  'verifyTerminalPinCallable.js',
  'meatPrices.js',
  'createTenantEmployee.js',
  'manageTenantEmployees.js',
];

function readFunctionSource(file) {
  return readFileSync(join(FUNCTIONS_ROOT, file), 'utf8');
}

function onCallOptionsSlice(source, anchor) {
  const start = anchor ? source.indexOf(anchor) : 0;
  expect(start).toBeGreaterThanOrEqual(0);
  return source.slice(start, start + 900);
}

function assertCallableEnforcesAppCheck(source, anchor) {
  const block = onCallOptionsSlice(source, anchor);
  if (/\.\.\.CALLABLE_BASE_OPTIONS/.test(block) || /CALLABLE_BASE_OPTIONS\s*,/.test(block) || /onCall\(\s*\n?\s*CALLABLE_BASE_OPTIONS/.test(block.slice(0, 200))) {
    expect(source).toMatch(/CALLABLE_BASE_OPTIONS\s*=\s*\{[\s\S]*?enforceAppCheck:\s*true/);
    return;
  }
  // Prefer checking nearby options object when onCall(CALLABLE_BASE_OPTIONS, handler)
  if (/onCall\(\s*CALLABLE_BASE_OPTIONS/.test(source) && /CALLABLE_BASE_OPTIONS\s*=\s*\{[\s\S]*?enforceAppCheck:\s*true/.test(source)) {
    return;
  }
  expect(block).toMatch(/enforceAppCheck:\s*true/);
  expect(block).not.toMatch(/enforceAppCheck:\s*false/);
}

describe('App Check coverage – Callable registration contract', () => {
  test('inventory matches all onCall() registrations in functions/', () => {
    const onCallCount = ON_CALL_SOURCE_FILES.reduce((sum, file) => {
      const matches = readFunctionSource(file).match(/\bonCall\s*\(/g);
      return sum + (matches?.length || 0);
    }, 0);
    expect(onCallCount).toBe(APP_CHECK_CALLABLES.length);
    expect(APP_CHECK_CALLABLES).toHaveLength(6);
  });

  test.each(APP_CHECK_CALLABLES)('$id configures enforceAppCheck: true', ({ file, anchor }) => {
    const source = readFunctionSource(file);
    assertCallableEnforcesAppCheck(source, anchor || file);
  });

  test('index.js exports every App-Check-protected callable', () => {
    const index = readFunctionSource('index.js');
    for (const { id } of APP_CHECK_CALLABLES) {
      expect(index).toMatch(new RegExp(`exports\\.${id}\\s*=`));
    }
  });
});
