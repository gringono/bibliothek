/* Bibliothek – Service Worker: App offline, Cover zwischenspeichern. API-Abfragen gehen immer ins Netz. */
const VERSION = 'bib-v0.1.1';
const SHELL = [
  './', 'index.html', 'styles.css', 'app.js', 'lib.js', 'db.js', 'manifest.webmanifest',
  'vendor/zxing.min.js', 'vendor/qrcode.js',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'fonts/lora-latin-500-normal.woff2', 'fonts/lora-latin-600-normal.woff2',
  'fonts/nunito-sans-latin-400-normal.woff2', 'fonts/nunito-sans-latin-600-normal.woff2', 'fonts/nunito-sans-latin-700-normal.woff2',
  'fonts/creepster-latin-400-normal.woff2', 'fonts/crimson-pro-latin-500-normal.woff2', 'fonts/crimson-pro-latin-600-normal.woff2',
  'fonts/great-vibes-latin-400-normal.woff2', 'fonts/cormorant-garamond-latin-600-normal.woff2', 'fonts/cormorant-garamond-latin-700-normal.woff2',
  'fonts/cinzel-latin-500-normal.woff2', 'fonts/cinzel-latin-700-normal.woff2'
];
const COVER_CACHE = 'bib-covers';
const COVER_HOSTS = ['books.google.com', 'books.googleusercontent.com', 'covers.openlibrary.org', 'archive.org'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== COVER_CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
    return;
  }
  if (req.destination === 'image' && COVER_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith('.' + h))) {
    e.respondWith(caches.open(COVER_CACHE).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') c.put(req, res.clone());
        return res;
      } catch (err) {
        return hit || Response.error();
      }
    }));
  }
});
