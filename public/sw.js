// Kitaplık service worker: uygulama kabuğunu önbelleğe alır, çevrimdışı açılmayı sağlar.
const VERSION = '__VERSION__';
const SHELL = `kitaplik-shell-${VERSION}`;
const RUNTIME = 'kitaplik-runtime-v1';
const SHELL_FILES = [
  './', './index.html', './app.js', './app.css', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon.svg',
];
// Barkod ve OCR kütüphaneleri ilk kullanımdan sonra çevrimdışı da çalışsın
const RUNTIME_HOSTS = ['cdn.jsdelivr.net', 'tessdata.projectnaptha.com', 'unpkg.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('kitaplik-shell-') && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (RUNTIME_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open(RUNTIME).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return; // API istekleri doğrudan ağa gider

  // Aynı kaynak: önce ağ (güncellemeler hemen gelsin), ağ yoksa önbellek (çevrimdışı)
  e.respondWith(
    caches.open(SHELL).then(async (cache) => {
      try {
        const res = await fetch(req, { cache: 'no-cache' });
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        const hit = await cache.match(req, { ignoreSearch: true });
        if (hit) return hit;
        if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
        return Response.error();
      }
    })
  );
});
