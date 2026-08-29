const CACHE = 'pwagro-v3';
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

// Network-first, and critically: {cache:'no-store'} bypasses the browser's
// own HTTP cache too, not just the service worker's. Without this, the
// browser can silently serve a stale JS/CSS file even though the service
// worker "asked" the network for a fresh one — which was forcing a manual
// cache-clear after every update. This guarantees every load gets the
// current files from GitHub Pages; the Cache API copy below is purely an
// offline fallback, never a first choice.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request, { cache: 'no-store' })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
