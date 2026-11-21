// Service Worker: macht die App offline nutzbar.
// Bei jeder neuen App-Version CACHE erhöhen (siehe changelog.js).
const CACHE = 'training-v11';
const FILES = [
  './', './index.html', './styles.css', './changelog.js', './app.js', './charts.js', './darts.js', './manifest.json',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(
    FILES.map(f => fetch(f, { cache: 'no-cache' }).then(r => r.ok && c.put(f, r)).catch(() => {}))
  )));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// Netzwerk zuerst – immer beim Server nachfragen (kein veralteter Browser-Cache),
// bei Offline aus dem App-Cache.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req.url, { cache: 'no-cache' })
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
