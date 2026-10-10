/* Kølerkildekøbing Destroy – service worker.
   Versionen kommer fra index.html (APP_VERSION sendes med som ?v=...), så den kun skal ændres ét sted.
   Netværket først: er der net, hentes altid den nyeste udgave (og gemmes); uden net bruges den gemte kopi. */
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = 'kkd-' + VERSION;
const FILES = [
  './', 'index.html', 'manifest.json',
  'fonts/saira-stencil.woff2', 'fonts/barlow-500.woff2', 'fonts/barlow-600.woff2', 'fonts/barlow-700.woff2',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-512-maskable.png',
  'render3d.js', 'vendor/three.module.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

/* ny version: slet de gamle kopier og tag over med det samme */
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('kkd-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  /* en navigation (åbning af siden) kan ikke kopieres med nye indstillinger, så den hentes via sin adresse */
  const net = req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache' }) : fetch(req, { cache: 'no-cache' });
  e.respondWith(net
    .then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })
    .catch(() => caches.match(req, { ignoreSearch: true })
      .then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
