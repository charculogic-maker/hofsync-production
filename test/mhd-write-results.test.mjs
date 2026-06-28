import assert from 'node:assert/strict';

const noop = () => {};
const elements = new Map();
const toasts = [];

function createElementStub(id = '') {
  const listeners = new Map();
  return {
    id,
    disabled: false,
    hidden: false,
    innerHTML: '',
    inputMode: '',
    min: '',
    placeholder: '',
    required: false,
    step: '',
    textContent: '',
    value: '',
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    appendChild: noop,
    classList: {
      add: noop,
      contains: () => false,
      remove: noop,
      toggle: noop,
    },
    dataset: {},
    dispatch(type) {
      return listeners.get(type)?.({ target: this, preventDefault: noop });
    },
    focus: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
    remove: noop,
    setAttribute: noop,
    style: {},
  };
}

function element(id) {
  if (!elements.has(id)) elements.set(id, createElementStub(id));
  return elements.get(id);
}

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    addEventListener: noop,
    dispatchEvent: noop,
    location: { hostname: 'localhost', search: '' },
    showToast: (message, type) => toasts.push({ message, type }),
  },
});
Object.defineProperty(globalThis, 'self', { configurable: true, value: globalThis.window });
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: {
    addEventListener: noop,
    body: createElementStub(),
    createElement: createElementStub,
    documentElement: createElementStub(),
    getElementById: (id) => elements.get(id) || null,
    querySelector: () => null,
    querySelectorAll: () => [],
  },
});
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: () => null,
    removeItem: noop,
    setItem: noop,
  },
});
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    onLine: true,
    sendBeacon: () => false,
  },
});
Object.defineProperty(globalThis, 'CustomEvent', {
  configurable: true,
  value: class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  },
});
Object.defineProperty(globalThis, 'crypto', {
  configurable: true,
  value: { randomUUID: () => '11111111-2222-4333-8444-555555555555' },
});
Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  value: async () => ({ ok: true, text: async () => '' }),
});

[
  'we-add-item-btn',
  'we-save-delivery-btn',
  'we-supplier',
  'we-category-quick',
  'we-category',
  'we-temperature',
  'we-ean',
  'we-product-name',
  'we-hersteller-zusatz',
  'we-product-manual',
  'we-qty',
  'we-mhd',
  'receiving-item-count',
  'receiving-status',
  'we-current-items-table',
  'we-product-manual-wrap',
  'we-qty-label',
  'we-temperature-quick-wrap',
].forEach(element);

const {
  assertRequiredWritesSucceeded,
  finalizeDelivery,
  initMhdModule,
} = await import('../web/mhd.js');

assert.doesNotThrow(() => assertRequiredWritesSucceeded([
  { status: 'fulfilled', value: 'written' },
  { status: 'fulfilled', value: 'queued' },
], 'Required write failed'));

const writeFailure = new Error('permission denied');
const settledResults = await Promise.allSettled([
  Promise.resolve('written'),
  Promise.reject(writeFailure),
]);

assert.throws(
  () => assertRequiredWritesSucceeded(settledResults, 'Required write failed'),
  (err) => err.message === 'Required write failed' && err.cause === writeFailure,
);

element('we-supplier').value = 'Test Lieferant';
element('we-category-quick').value = 'Trockenware';
element('we-category').value = 'Fremdfleisch';
element('we-ean').value = '1234567890123';
element('we-product-name').value = 'Test Artikel';
element('we-qty').value = '2';
element('we-mhd').value = '31.12.2026';

let writeCount = 0;
initMhdModule(
  null,
  {
    writeOrQueueFirestore: async () => {
      writeCount += 1;
      if (writeCount === 2) throw writeFailure;
      return 'written';
    },
  },
  { playClickSound: noop },
  {
    onFormSaved: noop,
    restoreDraftFields: noop,
    showHUD: noop,
    tenantId: 'StevesHof_Hauptbetrieb',
  },
);

element('we-add-item-btn').dispatch('click');
await finalizeDelivery();

assert.equal(writeCount, 2);
assert.equal(element('receiving-item-count').textContent, '1');
assert.equal(
  toasts.some((toast) => toast.message === 'Gesamte Lieferung erfolgreich gebucht!'),
  false,
);
assert.equal(
  toasts.some((toast) => toast.message === 'Speichern fehlgeschlagen. Bitte erneut versuchen.' && toast.type === 'error'),
  true,
);

console.log('MHD required write result guard and finalizeDelivery failure path work');
