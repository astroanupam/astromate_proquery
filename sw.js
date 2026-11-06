/* ASTROMATE service worker: makes the app installable and fully usable offline.
   Strategy: network first (so an updated copy on the web host is picked up at once) with a 4-second timeout, falling back to the cached copy.
   Every app file is pre-cached at install. Bump CACHE_VERSION whenever any file changes so old caches are removed. */
const CACHE_VERSION = 'astromate-1.0.0-r4';
const FILES = [
  './', 'index.html', 'config.js', 'styles.css', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-180.png', 'icon-512-maskable.png',
  'am-core.js', 'am-ephem.js', 'am-ephem-corr.js', 'am-vedic.js', 'am-rules.js', 'am-cities.js', 'am-sheets.js', 'am-predict.js', 'am-store.js', 'am-store-remote.js',
  'am-bank.js', 'am-charts.js', 'am-ui.js', 'am-ui-user.js', 'am-ui-astro.js', 'am-ui-admin.js', 'am-main.js', 'tests.html', 'am-tests.js', 'am-testdata.js',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_VERSION).then((c) => Promise.all(FILES.map((f) => c.add(new Request(f, { cache: 'reload' })).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.indexOf('astromate-') === 0 && k !== CACHE_VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; /* never touch cross-origin calls (the optional place lookup) */
  if (url.pathname.indexOf('/api/') !== -1) return; /* the server API (server edition) is never cached: it carries accounts and encrypted data */
  e.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    try {
      const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 4000);
      const res = await fetch(req, { signal: ctl.signal, cache: 'no-cache' });
      clearTimeout(timer);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') { const idx = await cache.match('index.html'); if (idx) return idx; }
      return Response.error();
    }
  })());
});
