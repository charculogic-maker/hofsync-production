import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const ORIGIN = 'https://hofsync.test';

class MockRequest {
  constructor(input, init = {}) {
    if (input instanceof MockRequest) {
      this.url = input.url;
      this.headers = init.headers || input.headers || new Headers();
      this.mode = init.mode || input.mode || 'same-origin';
      this.credentials = init.credentials || input.credentials || 'same-origin';
      this.redirect = init.redirect || input.redirect || 'follow';
      this.method = init.method || input.method || 'GET';
      return;
    }

    const raw = String(input);
    this.url = raw.startsWith('http')
      ? raw
      : `${ORIGIN}${raw.startsWith('/') ? raw : `/${raw}`}`;
    this.headers = init.headers || new Headers();
    this.mode = init.mode || 'same-origin';
    this.credentials = init.credentials || 'same-origin';
    this.redirect = init.redirect || 'follow';
    this.method = init.method || 'GET';
  }
}

class MockResponse {
  constructor(body = '', init = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.headers = init.headers || {};
    this.ok = this.status >= 200 && this.status < 300;
  }

  clone() {
    return new MockResponse(this.body, { status: this.status, headers: this.headers });
  }
}

async function runFetch(pathname, mode = 'navigate') {
  const listeners = {};
  const fetchedUrls = [];
  const cache = {
    addAll: async () => undefined,
    add: async () => undefined,
    put: async () => undefined,
    match: async () => null,
    keys: async () => [],
  };
  const caches = {
    open: async () => cache,
    keys: async () => [],
    match: async () => null,
    delete: async () => true,
  };
  const self = {
    location: { origin: ORIGIN },
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    skipWaiting: async () => undefined,
    clients: {
      claim: async () => undefined,
      matchAll: async () => [],
      openWindow: async () => undefined,
    },
    registration: {
      showNotification: async () => undefined,
    },
  };
  const sandbox = {
    Headers,
    Promise,
    Request: MockRequest,
    Response: MockResponse,
    URL,
    caches,
    console,
    fetch: async (request) => {
      fetchedUrls.push(request.url || String(request));
      return new MockResponse('ok');
    },
    self,
  };

  const code = await readFile(new URL('../web/sw.js', import.meta.url), 'utf8');
  vm.runInNewContext(code, sandbox, { filename: 'web/sw.js' });
  assert.equal(typeof listeners.fetch, 'function', 'service worker fetch handler must be registered');

  let responsePromise = null;
  listeners.fetch({
    request: new MockRequest(`${ORIGIN}${pathname}`, { mode }),
    respondWith(promise) {
      responsePromise = Promise.resolve(promise);
    },
  });

  assert.ok(responsePromise, `fetch handler should respond to ${pathname}`);
  await responsePromise;
  return fetchedUrls;
}

const preorderFetches = await runFetch('/bestellen.html?admin=1');
assert.equal(preorderFetches[0], `${ORIGIN}/bestellen.html`);

const privacyFetches = await runFetch('/datenschutz.html');
assert.equal(privacyFetches[0], `${ORIGIN}/datenschutz.html`);

const dashboardFetches = await runFetch('/dev-dashboard');
assert.equal(dashboardFetches[0], `${ORIGIN}/index.html`);

console.log('service worker routing tests ok');
