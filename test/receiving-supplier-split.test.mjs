/**
 * Unit-Tests: Wareneingang Bereichs-Lieferanten (Laden vs. Metzgerei).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  defaultSuppliersForArea,
  deliveryAreaToReceivingMode,
  LADEN_DEFAULT_SUPPLIERS,
  LAST_DELIVERY_AREA_STORAGE_KEY,
  METZ_DEFAULT_SUPPLIERS,
  normalizeDeliveryArea,
  readLastDeliveryArea,
  receivingModeToDeliveryArea,
  writeLastDeliveryArea,
} from '../web/receiving.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexSrc = readFileSync(path.join(root, 'web/index.html'), 'utf8');
const mhdSrc = readFileSync(path.join(root, 'web/mhd.js'), 'utf8');
const swSrc = readFileSync(path.join(root, 'web/sw.js'), 'utf8');
const rulesSrc = readFileSync(path.join(root, 'firebase.rules'), 'utf8');

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

  it('exposes distinct default supplier lists', () => {
    assert.deepEqual(defaultSuppliersForArea('laden'), [...LADEN_DEFAULT_SUPPLIERS]);
    assert.deepEqual(defaultSuppliersForArea('metzgerei'), [...METZ_DEFAULT_SUPPLIERS]);
    assert.ok(LADEN_DEFAULT_SUPPLIERS.includes('Weiling'));
    assert.ok(METZ_DEFAULT_SUPPLIERS.includes('Stautenhof'));
    assert.equal(LADEN_DEFAULT_SUPPLIERS.includes('Stautenhof'), false);
  });

  it('falls back to defaults until Firestore lists exist', async () => {
    ensureDomShims();
    const mod = await import(`${pathToFileURL(path.join(root, 'web/tenant-settings.js')).href}?t=${Date.now()}`);
    await mod.loadTenantShopSettings(null, '');
    assert.deepEqual(mod.getTenantSupplierNames('laden'), [...LADEN_DEFAULT_SUPPLIERS]);
    assert.deepEqual(mod.getTenantSupplierNames('metzgerei'), [...METZ_DEFAULT_SUPPLIERS]);
  });

  it('adds custom supplier into area list and keeps the other area unchanged', async () => {
    ensureDomShims();
    const mod = await import(`${pathToFileURL(path.join(root, 'web/tenant-settings.js')).href}?t=${Date.now() + 1}`);
    mod.applyLocalSupplierLists({
      laden: ['Weiling'],
      metzgerei: ['Stautenhof'],
      tenantId: 'demo',
    });
    const result = await mod.addTenantSupplierName('laden', 'Hof Müller', { tenantId: 'demo' });
    assert.equal(result.ok, true);
    assert.ok(mod.getTenantSupplierNames('laden').includes('Hof Müller'));
    assert.deepEqual(mod.getTenantSupplierNames('metzgerei'), ['Stautenhof']);
  });

  it('wires area switch, custom supplier row and removes footer version badge', () => {
    assert.ok(indexSrc.includes('receiving-area-switch'));
    assert.ok(indexSrc.includes('data-delivery-area="laden"'));
    assert.ok(indexSrc.includes('data-delivery-area="metzgerei"'));
    assert.ok(indexSrc.includes('we-supplier-custom-apply'));
    assert.ok(indexSrc.includes('Name des Lieferanten'));
    assert.equal(indexSrc.includes('app-version-badge-footer'), false);
    assert.ok(indexSrc.includes('app-version-badge-header'));
    assert.ok(mhdSrc.includes('persistSupplierName'));
    assert.ok(mhdSrc.includes('writeLastDeliveryArea'));
    assert.ok(mhdSrc.includes('addTenantSupplierName'));
    assert.match(swSrc, /charculogic-v20261025-packtisch-notes-v1/);
    assert.ok(rulesSrc.includes("'laden'"));
    assert.ok(rulesSrc.includes("'metzgerei'"));
    assert.ok(rulesSrc.includes('isEmployeeOrAdmin(tenantId) && isSupplierSettings(document)'));
  });
});
