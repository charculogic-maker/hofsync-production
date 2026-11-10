/**
 * Unit-Tests: Wareneingang Bereichs-Lieferanten (Laden vs. Metzgerei) + Multi-Tenant Defaults.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  buildDefaultSupplierSettings,
  defaultSuppliersForArea,
  deliveryAreaToReceivingMode,
  isStevesHofTenantId,
  LADEN_DEFAULT_SUPPLIERS,
  LAST_DELIVERY_AREA_STORAGE_KEY,
  METZ_DEFAULT_SUPPLIERS,
  NEUTRAL_LADEN_SUPPLIERS,
  NEUTRAL_METZ_SUPPLIERS,
  normalizeDeliveryArea,
  readLastDeliveryArea,
  receivingModeToDeliveryArea,
  STEVESHOF_LADEN_SUPPLIERS,
  STEVESHOF_METZ_SUPPLIERS,
  writeLastDeliveryArea,
} from '../web/receiving.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexSrc = readFileSync(path.join(root, 'web/index.html'), 'utf8');
const mhdSrc = readFileSync(path.join(root, 'web/mhd.js'), 'utf8');
const swSrc = readFileSync(path.join(root, 'web/sw.js'), 'utf8');
const rulesSrc = readFileSync(path.join(root, 'firebase.rules'), 'utf8');
const presetsSrc = readFileSync(path.join(root, 'web/tenant-presets.js'), 'utf8');
const functionsPresetsSrc = readFileSync(path.join(root, 'functions/tenantPresets.js'), 'utf8');
const tenantAdminSrc = readFileSync(path.join(root, 'functions/tenantAdmin.js'), 'utf8');

function ensureDomShims() {
  if (!globalThis.CustomEvent) {
    globalThis.CustomEvent = class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    };
  }
  if (!globalThis.window) {
    globalThis.window = globalThis;
  }
  if (typeof globalThis.window.dispatchEvent !== 'function') {
    globalThis.window.dispatchEvent = () => true;
  }
  if (typeof globalThis.window.addEventListener !== 'function') {
    globalThis.window.addEventListener = () => {};
  }
}

function memoryStorage(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
}

describe('Wareneingang supplier split (Laden / Metzgerei)', () => {
  it('normalizes area and maps to receiving mode', () => {
    assert.equal(normalizeDeliveryArea('Laden'), 'laden');
    assert.equal(normalizeDeliveryArea('metz'), 'metzgerei');
    assert.equal(deliveryAreaToReceivingMode('laden'), 'schnell');
    assert.equal(deliveryAreaToReceivingMode('metzgerei'), 'metzgerei');
    assert.equal(receivingModeToDeliveryArea('schnell'), 'laden');
    assert.equal(receivingModeToDeliveryArea('metzgerei'), 'metzgerei');
  });

  it('persists last delivery area in localStorage', () => {
    const storage = memoryStorage();
    assert.equal(readLastDeliveryArea(storage), 'laden');
    assert.equal(writeLastDeliveryArea('metzgerei', storage), 'metzgerei');
    assert.equal(storage.getItem(LAST_DELIVERY_AREA_STORAGE_KEY), 'metzgerei');
    assert.equal(readLastDeliveryArea(storage), 'metzgerei');
  });

  it('uses neutral defaults for new tenants and StevesHof soft-launch lists', () => {
    assert.deepEqual(defaultSuppliersForArea('laden', 'test_auto_seed'), [...NEUTRAL_LADEN_SUPPLIERS]);
    assert.deepEqual(defaultSuppliersForArea('metzgerei', 'test_auto_seed'), [...NEUTRAL_METZ_SUPPLIERS]);
    assert.deepEqual(LADEN_DEFAULT_SUPPLIERS, NEUTRAL_LADEN_SUPPLIERS);
    assert.deepEqual(METZ_DEFAULT_SUPPLIERS, NEUTRAL_METZ_SUPPLIERS);
    assert.equal(LADEN_DEFAULT_SUPPLIERS.includes('Weiling'), false);
    assert.equal(METZ_DEFAULT_SUPPLIERS.includes('Stautenhof'), false);
    assert.ok(NEUTRAL_LADEN_SUPPLIERS.includes('Regionaler Großhandel'));
    assert.ok(NEUTRAL_METZ_SUPPLIERS.includes('Schlachthof / Zerlegebetrieb'));

    assert.ok(isStevesHofTenantId('StevesHof_Hauptbetrieb'));
    assert.deepEqual(
      defaultSuppliersForArea('laden', 'StevesHof_Hauptbetrieb'),
      STEVESHOF_LADEN_SUPPLIERS.filter((name) => !/^sonstig/i.test(name)),
    );
    assert.deepEqual(
      defaultSuppliersForArea('metzgerei', 'StevesHof_Hauptbetrieb'),
      STEVESHOF_METZ_SUPPLIERS.filter((name) => !/^sonstig/i.test(name)),
    );
    assert.ok(defaultSuppliersForArea('laden', 'StevesHof_Hauptbetrieb').includes('Weiling'));
    assert.ok(defaultSuppliersForArea('metzgerei', 'StevesHof_Hauptbetrieb').includes('Stautenhof'));
  });

  it('builds provision payload with Sonstiger Lieferant for new tenants', () => {
    const seed = buildDefaultSupplierSettings('test_auto_seed', { updatedBy: 'test' });
    assert.equal(seed.tenantId, 'test_auto_seed');
    assert.ok(seed.laden.includes('Regionaler Großhandel'));
    assert.ok(seed.laden.some((name) => /^sonstig/i.test(name)));
    assert.ok(seed.metzgerei.includes('Eigene Schlachtung'));
    assert.equal(seed.laden.includes('Weiling'), false);

    const steves = buildDefaultSupplierSettings('StevesHof_Hauptbetrieb');
    assert.ok(steves.laden.includes('Weiling'));
    assert.ok(steves.metzgerei.includes('Naturverbund'));
  });

  it('falls back to defaults until Firestore lists exist', async () => {
    ensureDomShims();
    globalThis.localStorage = memoryStorage({ charculogic_cached_tenant_id: 'test_auto_seed' });
    const mod = await import(`${pathToFileURL(path.join(root, 'web/tenant-settings.js')).href}?t=${Date.now()}`);
    await mod.loadTenantShopSettings(null, 'test_auto_seed');
    assert.deepEqual(mod.getTenantSupplierNames('laden'), [...NEUTRAL_LADEN_SUPPLIERS]);
    assert.deepEqual(mod.getTenantSupplierNames('metzgerei'), [...NEUTRAL_METZ_SUPPLIERS]);
  });

  it('adds custom supplier into area list and keeps the other area unchanged', async () => {
    ensureDomShims();
    const mod = await import(`${pathToFileURL(path.join(root, 'web/tenant-settings.js')).href}?t=${Date.now() + 1}`);
    mod.applyLocalSupplierLists({
      laden: ['Regionaler Großhandel'],
      metzgerei: ['Eigene Schlachtung'],
      tenantId: 'demo',
    });
    const result = await mod.addTenantSupplierName('laden', 'Hof Müller', { tenantId: 'demo' });
    assert.equal(result.ok, true);
    assert.ok(mod.getTenantSupplierNames('laden').includes('Hof Müller'));
    assert.deepEqual(mod.getTenantSupplierNames('metzgerei'), ['Eigene Schlachtung']);
  });

  it('wires area switch, custom supplier row and removes hardcoded StevesHof suppliers from NEU', () => {
    assert.ok(indexSrc.includes('receiving-area-switch'));
    assert.ok(indexSrc.includes('data-delivery-area="laden"'));
    assert.ok(indexSrc.includes('data-delivery-area="metzgerei"'));
    assert.ok(indexSrc.includes('we-supplier-custom-apply'));
    assert.ok(indexSrc.includes('Name des Lieferanten'));
    assert.equal(indexSrc.includes('app-version-badge-footer'), false);
    assert.ok(indexSrc.includes('app-version-badge-header'));
    assert.equal(indexSrc.includes('value="Weiling"'), false);
    assert.equal(indexSrc.includes('data-supplier-pick="Weiling"'), false);
    assert.equal(indexSrc.includes('data-supplier-pick="Rapunzel"'), false);
    assert.equal(indexSrc.includes('data-supplier-pick="Bartke"'), false);
    assert.ok(mhdSrc.includes('persistSupplierName'));
    assert.ok(mhdSrc.includes('writeLastDeliveryArea'));
    assert.ok(mhdSrc.includes('addTenantSupplierName'));
    assert.ok(mhdSrc.includes('Bitte Artikelname und Mindesthaltbarkeit angeben'));
    assert.match(swSrc, /charculogic-v20261110-csv-import-v1/);
    assert.ok(rulesSrc.includes("'laden'"));
    assert.ok(rulesSrc.includes("'metzgerei'"));
    assert.ok(rulesSrc.includes('isEmployeeOrAdmin(tenantId) && isSupplierSettings(document)'));
    assert.ok(rulesSrc.includes("'daysFresh'"));
    assert.ok(presetsSrc.includes('buildDefaultSupplierSettings'));
    assert.ok(presetsSrc.includes('seedSuppliers'));
    assert.ok(functionsPresetsSrc.includes('buildDefaultSupplierSettings'));
    assert.ok(tenantAdminSrc.includes('buildDefaultSupplierSettings'));
    assert.equal(tenantAdminSrc.includes("BASELINE_SUPPLIERS_LADEN = ['Weiling'"), false);
  });
});
