import assert from 'node:assert/strict';

const noop = () => {};

function createElementStub() {
  return {
    addEventListener: noop,
    appendChild: noop,
    classList: {
      add: noop,
      contains: () => false,
      remove: noop,
      toggle: noop,
    },
    dataset: {},
    focus: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
    remove: noop,
    setAttribute: noop,
    style: {},
  };
}

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    addEventListener: noop,
    dispatchEvent: noop,
    location: { hostname: 'localhost', search: '' },
    showToast: noop,
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
    getElementById: () => null,
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

const { assertRequiredWritesSucceeded } = await import('../web/mhd.js');

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

console.log('MHD required write result guard works');
