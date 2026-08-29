const CACHE = 'pwagro-v5';
const SHELL = [
  './index.html', './manifest.json', './css/styles.css',
  './js/core/services.js', './js/core/store.js', './js/core/notifications-biometric.js',
  './js/core/auth.js', './js/core/router.js',
  './js/pages/base.js', './js/pages/dashboard.js', './js/pages/enquiries.js',
  './js/pages/products.js', './js/pages/orders.js', './js/pages/sales.js',
  './js/pages/crm.js', './js/pages/inventory.js', './js/pages/purchases.js',
  './js/pages/users.js', './js/pages/activity.js', './js/pages/reports.js',
  './js/pages/settings.js', './js/firebase-config.js', './js/app.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Deliberately conservative after two rounds of browser-specific fetch()
// quirks (navigation-mode requests, cross-origin CDN scripts): only
// intercept same-origin GET requests, and always re-fetch with the plain
// single-argument form — the one pattern that's safe for every request
// type, navigation included. Firebase/CDN scripts are left completely
// alone and handled natively by the browser.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
