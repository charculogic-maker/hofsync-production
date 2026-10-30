import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

describe('app-version release notice', () => {
  it('exports current version and latest five highlights', async () => {
    const mod = await import(`${pathToFileURL(path.join(root, 'web/app-version.js')).href}?t=${Date.now()}`);
    assert.equal(mod.APP_VERSION, '1.5.1');
    assert.equal(mod.APP_VERSION_LABEL, 'v1.5.1');
    assert.equal(mod.APP_VERSION_TAG, 'v1.5.1-20261030');
    assert.equal(mod.APP_RELEASE_DATE, '2026-10-30');
    assert.match(mod.RELEASE_TOAST_MESSAGE, /HofSync aktualisiert/);
    assert.ok(Array.isArray(mod.RELEASE_NOTES));
    assert.ok(mod.RELEASE_NOTES.length >= 5);
    const latest = mod.getLatestReleaseHighlights(5);
    assert.equal(latest.length, 5);
    assert.deepEqual(latest, mod.RELEASE_NOTES.slice(0, 5));
    assert.ok(latest.some((item) => /Banner/i.test(item)));
    assert.ok(latest.some((item) => /geladen/i.test(item)));
    assert.ok(latest.some((item) => /fünf Änderungen|letzten fünf/i.test(item) || /Versionshinweis/i.test(item)));
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

    const mod = await import(`${pathToFileURL(path.join(root, 'web/app-version.js')).href}?t=${Date.now()}-seen`);
    assert.equal(mod.hasSeenReleaseToast('1.5.1'), false);
    mod.markReleaseToastSeen('1.5.1');
    assert.equal(mod.hasSeenReleaseToast('1.5.1'), true);
    assert.equal(store.get('hofsync_seen_release_version'), '1.5.1');
  });

  it('keeps skipWaiting and clientsClaim in the service worker', async () => {
    const swSource = await readFile(path.join(root, 'web/sw.js'), 'utf8');
    assert.match(swSource, /self\.skipWaiting\s*\(/);
    assert.match(swSource, /clients\.claim\s*\(/);
    assert.match(swSource, /sync-version-hint/);
    assert.match(swSource, /isStandaloneHtmlDoc/);
    assert.match(swSource, /\/app-version\.js/);
  });

  it('wires version badge and live changelog into the app shell', async () => {
    const html = await readFile(path.join(root, 'web/index.html'), 'utf8');
    assert.match(html, /data-app-version-badge/);
    assert.match(html, /id="release-toast"/);
    assert.match(html, /id="version-changelog-modal"/);
    assert.match(html, /id="mhd-server-sync-hint"/);
    assert.match(html, /v1\.5\.1/);
    assert.match(html, /Kritische-MHD-Banner/);
  });
});
