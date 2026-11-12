// Offline support: the app opens without signal. Pages load network-first (so updates arrive),
// falling back to the saved copy; app files are cached; Anthropic API calls are never cached.
const CACHE = 'wc-v202611122046';
const SHELL = ['./', './index.html', './shim.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/shopping-96.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'api.anthropic.com') return; // never cache
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => { caches.open(CACHE).then((c) => c.put('./index.html', res.clone())); return res; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  const fonts = url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com');
  if (url.origin === location.origin || fonts) {
    e.respondWith(caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') caches.open(CACHE).then((c) => c.put(req, res.clone())); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
