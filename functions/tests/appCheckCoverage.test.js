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
  { id: 'reprocessDeliveryNoteDraft', file: 'parseDeliveryNoteCallable.js', anchor: 'exports.reprocessDeliveryNoteDraft' },
  { id: 'saveReconciledItems', file: 'parseDeliveryNoteCallable.js', anchor: 'exports.saveReconciledItems' },
  { id: 'parseMeatLabel', file: 'parseMeatLabelCallable.js', anchor: 'exports.parseMeatLabel' },
  { id: 'verifyTerminalPin', file: 'verifyTerminalPinCallable.js', anchor: 'exports.verifyTerminalPin' },
  { id: 'triggerManualMeatPriceRun', file: 'meatPrices.js', anchor: 'triggerManualMeatPriceRun' },
  { id: 'createTenantEmployee', file: 'createTenantEmployee.js', anchor: 'exports.createTenantEmployee' },
  { id: 'manageTenantEmployees', file: 'manageTenantEmployees.js', anchor: 'exports.manageTenantEmployees' },
  { id: 'provisionDemoTenant', file: 'tenantAdmin.js', anchor: 'exports.provisionDemoTenant' },
  { id: 'archiveZeroStockBatches', file: 'mhdArchive.js', anchor: 'exports.archiveZeroStockBatches' },
];

const ON_CALL_SOURCE_FILES = [
  'parseDeliveryNoteCallable.js',
  'parseMeatLabelCallable.js',
  'verifyTerminalPinCallable.js',
  'meatPrices.js',
  'createTenantEmployee.js',
  'manageTenantEmployees.js',
  'tenantAdmin.js',
  'mhdArchive.js',
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
    expect(APP_CHECK_CALLABLES).toHaveLength(10);
  });

  test.each(APP_CHECK_CALLABLES.filter((entry) => entry.id !== 'provisionDemoTenant' && entry.id !== 'manageTenantEmployees' && entry.id !== 'parseDeliveryNote' && entry.id !== 'reprocessDeliveryNoteDraft' && entry.id !== 'saveReconciledItems'))(
    '$id configures enforceAppCheck: true',
    ({ file, anchor }) => {
      const source = readFunctionSource(file);
      assertCallableEnforcesAppCheck(source, anchor || file);
    },
  );

  test('parseDeliveryNote skips App Check and still requires Firebase Auth', () => {
    const source = readFunctionSource('parseDeliveryNoteCallable.js');
    const block = onCallOptionsSlice(source, 'exports.parseDeliveryNote');
    expect(block).toMatch(/region:\s*REGION/);
    expect(block).toMatch(/enforceAppCheck:\s*false/);
    expect(block).not.toMatch(/enforceAppCheck:\s*true/);
    expect(source).toMatch(/Keine aktive HofSync-Sitzung gefunden/);

    const index = readFunctionSource('index.js');
    const exportAt = index.indexOf("lazyExport('parseDeliveryNote'");
    expect(exportAt).toBeGreaterThanOrEqual(0);
    const exportBlock = index.slice(exportAt, exportAt + 700);
    expect(exportBlock).toMatch(/enforceAppCheck:\s*false/);
    expect(exportBlock).toMatch(/assertDeliveryNoteCaller/);
  });

  test('reprocessDeliveryNoteDraft skips App Check and stays inside the signed-in tenant', () => {
    const source = readFunctionSource('parseDeliveryNoteCallable.js');
    const block = onCallOptionsSlice(source, 'exports.reprocessDeliveryNoteDraft');
    expect(block).toMatch(/region:\s*REGION/);
    expect(block).toMatch(/enforceAppCheck:\s*false/);
    expect(block).toMatch(/handleReprocessDeliveryNoteDraft/);
    expect(block).toMatch(/assertDeliveryNoteCaller\(request\)/);
    expect(source).not.toMatch(/StevesHof_Hauptbetrieb/);

    const index = readFunctionSource('index.js');
    const exportAt = index.indexOf("lazyExport('reprocessDeliveryNoteDraft'");
    expect(exportAt).toBeGreaterThanOrEqual(0);
    const exportBlock = index.slice(exportAt, exportAt + 800);
    expect(exportBlock).toMatch(/enforceAppCheck:\s*false/);
    expect(exportBlock).toMatch(/assertDeliveryNoteCaller/);
    expect(exportBlock).not.toMatch(/onDocumentUpdated/);
  });

  test('saveReconciledItems skips App Check and writes only the signed-in tenant', () => {
    const source = readFunctionSource('parseDeliveryNoteCallable.js');
    const block = onCallOptionsSlice(source, 'exports.saveReconciledItems');
    expect(block).toMatch(/region:\s*REGION/);
    expect(block).toMatch(/enforceAppCheck:\s*false/);
    expect(block).toMatch(/handleSaveReconciledItems/);
    expect(source).toMatch(/assertDeliveryNoteCaller\(request\)/);
    expect(source).not.toMatch(/StevesHof_Hauptbetrieb/);

    const index = readFunctionSource('index.js');
    const exportAt = index.indexOf("lazyExport('saveReconciledItems'");
    expect(exportAt).toBeGreaterThanOrEqual(0);
    const exportBlock = index.slice(exportAt, exportAt + 700);
    expect(exportBlock).toMatch(/enforceAppCheck:\s*false/);
    expect(exportBlock).toMatch(/handleSaveReconciledItems/);
  });

  test('manageTenantEmployees allows Vercel hosts and still requires auth', () => {
    const source = readFunctionSource('manageTenantEmployees.js');
    const block = onCallOptionsSlice(source, 'exports.manageTenantEmployees');
    expect(block).toMatch(/cors:\s*true/);
    expect(block).toMatch(/enforceAppCheck:\s*false/);
    expect(source).toMatch(/Anmeldung erforderlich/);

    const index = readFunctionSource('index.js');
    const exportAt = index.indexOf("lazyExport('manageTenantEmployees'");
    expect(exportAt).toBeGreaterThanOrEqual(0);
    const exportBlock = index.slice(exportAt, exportAt + 700);
    expect(exportBlock).toMatch(/cors:\s*true/);
    expect(exportBlock).toMatch(/enforceAppCheck:\s*false/);
    expect(exportBlock).toMatch(/handleManageTenantEmployees/);
  });

  test('provisionDemoTenant allows Vercel hosts without App Check enforcement', () => {
    const source = readFunctionSource('tenantAdmin.js');
    const block = onCallOptionsSlice(source, 'exports.provisionDemoTenant');
    expect(block).toMatch(/cors:\s*true/);
    expect(block).toMatch(/enforceAppCheck:\s*false/);
    expect(block).not.toMatch(/enforceAppCheck:\s*true/);

    const index = readFunctionSource('index.js');
    const exportAt = index.indexOf("lazyExport('provisionDemoTenant'");
    expect(exportAt).toBeGreaterThanOrEqual(0);
    const exportBlock = index.slice(exportAt, exportAt + 600);
    expect(exportBlock).toMatch(/cors:\s*true/);
    expect(exportBlock).toMatch(/enforceAppCheck:\s*false/);
  });

  test('index.js exports every App-Check-protected callable', () => {
    const index = readFunctionSource('index.js');
    // Discovery-safe: Admin init only inside ensureAdminApp, never at module top-level.
    const beforeEnsure = index.split('function ensureAdminApp')[0] || index;
    expect(beforeEnsure).not.toMatch(/initializeApp\s*\(/);
    expect(index).toMatch(/function ensureAdminApp/);
    for (const { id } of APP_CHECK_CALLABLES) {
      const direct = new RegExp(`exports\\.${id}\\s*=\\s*onCall`);
      const lazy = new RegExp(`lazyExport\\(\\s*['"]${id}['"]`);
      expect(direct.test(index) || lazy.test(index)).toBe(true);
    }
  });
});