const CACHE_NAME = 'charculogic-v20260611-165-knowledge-tab';
const CACHE_SCHEMA = 'p0-release-hardening-jun2026-ki-wareneingang';

const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/branding.js',
  '/dev-guards.js',
  '/tenant-db.js',
  '/style.css',
  '/libs/firebase-app.js',
  '/libs/firebase-auth.js',
  '/libs/firebase-firestore.js',
  '/libs/firebase-storage.js',
  '/app.js',
  '/app-check.js',
  '/firebase-config.js',
  '/teamboard.js',
  '/team-tab.js',
  '/team-config.js',
  '/team-notify.js',
  '/customer-orders.js',
  '/auth.js',
  '/scanner.js',
  '/mhd.js',
  '/retter-box.js',
  '/date-input.js',
  '/delivery-note.js',
  '/delivery-parser.js',
  '/haccp.js',
  '/production.js',
  '/beffe_calc.js',
  '/cuts.js',
  '/sync.js',
];

const SCANNER_LIBS = [
  '/libs/zxing-browser.min.js',
  '/libs/quagga2.min.js',
  '/libs/html5-qrcode.min.js',
  '/libs/webrtc-adapter.min.js',
];

const OPTIONAL_ASSETS = [
  '/manifest.json',
  '/vpe-master.csv',
  '/data/beffe_data.json',
];

const BYPASS_PATTERNS = [
  /firebasejs/,
  /firestore/,
  /googleapis\.com/,
  /script\.google\.com/,
  /firebaseio\.com/,
  /cloudfunctions\.net/,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(CRITICAL_ASSETS);

      for (const asset of SCANNER_LIBS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn(`[SW] Scanner-Lib optional nicht gecacht: ${asset}`, err);
        }
      }

      for (const asset of OPTIONAL_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn(`[SW] Optionales Asset nicht gecacht: ${asset}`, err);
        }
      }

    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.info(`[SW] Veralteten Cache entfernt: ${key}`);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'GET_SW_VERSION') {
    event.source?.postMessage({ type: 'SW_VERSION', cacheName: CACHE_NAME });
  }

  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data?.type === 'CLEAR_APP_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
    );
  }

  if (event.data?.type === 'SHOW_NOTIFICATION') {
    const payload = event.data.payload || {};
    const title = payload.title || 'CharcuLogic Team';
    const options = {
      body: payload.body || '',
      tag: payload.tag || 'team-entry',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: payload.url || '/' },
    };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url && 'focus' in c);
      if (existing) return existing.focus();
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    }),
  );
});

const OFFLINE_FALLBACK_HTML = [
  '<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1">',
  '<title>HofSync</title>',
  '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;',
  'display:flex;align-items:center;justify-content:center;min-height:100vh;background:#1a1a2e;color:#e0e0e0;',
  'text-align:center;padding:24px}div{max-width:440px}h1{font-size:1.4rem;margin-bottom:12px}',
  'p{font-size:1rem;opacity:.8;margin-bottom:20px}button{padding:14px 28px;font-size:1rem;',
  'border:none;border-radius:8px;background:#4361ee;color:#fff;cursor:pointer;-webkit-tap-highlight-color:transparent}',
  '</style></head><body><div>',
  '<h1>HofSync wird aktualisiert&hellip;</h1>',
  '<p>Die App konnte nicht aus dem Cache geladen werden. Bitte kurz warten und erneut versuchen.</p>',
  '<button onclick="location.reload()">Neu laden</button>',
  '</div></body></html>',
].join('');

async function findCachedIndexHtml(primaryRequest) {
  const direct = await caches.match(primaryRequest);
  if (direct) return direct;

  const relativeHit = await caches.match('./index.html');
  if (relativeHit) return relativeHit;

  const absoluteHit = await caches.match('/index.html', { ignoreSearch: true });
  if (absoluteHit) return absoluteHit;

  const allKeys = await caches.keys();
  for (const name of allKeys) {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    const htmlKey = keys.find((r) => {
      const p = new URL(r.url).pathname;
      return p === '/' || p.endsWith('/index.html');
    });
    if (htmlKey) {
      const hit = await cache.match(htmlKey);
      if (hit) return hit;
    }
  }

  return null;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  if (BYPASS_PATTERNS.some((rx) => rx.test(request.url))) return;

  const url = new URL(request.url);
  const pathname = url.pathname;
  const isOwnOrigin = url.origin === self.location.origin;

  const isStaticAsset = isOwnOrigin && (
    pathname.endsWith('/index.html')
    || pathname.endsWith('.css')
    || pathname.endsWith('.js')
    || pathname.endsWith('/manifest.json')
    || pathname.endsWith('/vpe-master.csv')
    || pathname.endsWith('/data/beffe_data.json')
    || pathname.includes('/libs/')
    || pathname.endsWith('/')
  );

  const isNavigation = request.mode === 'navigate'
    || pathname.endsWith('/')
    || pathname.endsWith('/index.html');

  if (isNavigation && isOwnOrigin) {
    const cleanRequest = new Request(url.pathname + url.hash, {
      headers: request.headers,
      mode: request.mode,
      credentials: request.credentials,
      redirect: request.redirect,
    });

    event.respondWith(
      fetch(cleanRequest)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(cleanRequest, clone));
          }
          return networkResponse;
        })
        .catch(() => findCachedIndexHtml(cleanRequest))
        .then((response) => {
          if (response) return response;
          return new Response(OFFLINE_FALLBACK_HTML, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        })
    );
    return;
  }

  if (isStaticAsset) {
    const cleanRequest = new Request(url.pathname + url.hash, {
      headers: request.headers,
      mode: request.mode,
      credentials: request.credentials,
      redirect: request.redirect,
    });

    event.respondWith(
      fetch(cleanRequest).then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(cleanRequest, clone));
        }
        return networkResponse;
      }).catch(() =>
        caches.match(cleanRequest).then((cached) => {
          if (cached) return cached;
          return fetch(cleanRequest).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(cleanRequest, clone));
          }
          return networkResponse;
          }).catch(() => caches.match(cleanRequest));
        })
      )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
