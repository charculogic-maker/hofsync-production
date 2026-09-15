import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

describe('app-version release notice', () => {
  it('exports v1.4.0 constants and today\'s highlights', async () => {
    const mod = await import(pathToFileURL(path.join(root, 'web/app-version.js')).href);
    assert.equal(mod.APP_VERSION, '1.4.0');
    assert.equal(mod.APP_VERSION_LABEL, 'v1.4.0');
    assert.equal(mod.APP_VERSION_TAG, 'v1.4.0-20260915');
    assert.match(mod.RELEASE_TOAST_MESSAGE, /HofSync aktualisiert/);
    assert.ok(mod.RELEASE_HIGHLIGHTS.length >= 5);
    assert.ok(mod.RELEASE_HIGHLIGHTS.some((item) => /Auto-VPE/i.test(item)));
    assert.ok(mod.RELEASE_HIGHLIGHTS.some((item) => /LIFO/i.test(item)));
    assert.ok(mod.RELEASE_HIGHLIGHTS.some((item) => /2029/.test(item)));
  });

  it('remembers seen release versions in localStorage', async () => {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    };
    globalThis.document = {
      getElementById: () => null,
      createElement: () => ({
        classList: { add() {}, remove() {} },
        setAttribute() {},
        addEventListener() {},
        querySelector() { return null; },
        appendChild() {},
      }),
      querySelectorAll: () => [],
      querySelector: () => null,
      body: { appendChild() {} },
    };
    globalThis.window = globalThis;
    globalThis.requestAnimationFrame = (cb) => cb();

    const mod = await import(`${pathToFileURL(path.join(root, 'web/app-version.js')).href}?t=${Date.now()}`);
    assert.equal(mod.hasSeenReleaseToast('1.4.0'), false);
    mod.markReleaseToastSeen('1.4.0');
    assert.equal(mod.hasSeenReleaseToast('1.4.0'), true);
    assert.equal(store.get('hofsync_seen_release_version'), '1.4.0');
  });

  it('keeps skipWaiting and clientsClaim in the service worker', async () => {
    const swSource = await readFile(path.join(root, 'web/sw.js'), 'utf8');
    assert.match(swSource, /self\.skipWaiting\s*\(/);
    assert.match(swSource, /clients\.claim\s*\(/);
    assert.match(swSource, /charculogic-v20260915-v140-release/);
    assert.match(swSource, /\/app-version\.js/);
  });

  it('wires version badge markup into the app shell', async () => {
    const html = await readFile(path.join(root, 'web/index.html'), 'utf8');
    assert.match(html, /data-app-version-badge/);
    assert.match(html, /id="release-toast"/);
    assert.match(html, /id="version-changelog-modal"/);
    assert.match(html, /Gebindegrößen-Erkennung/);
  });
});
