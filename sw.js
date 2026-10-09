/* ==========================================================================
   Docly — service worker
   --------------------------------------------------------------------------
   Estratégia:
     • Ficheiros próprios (app shell): cache-first, atualizada em segundo plano.
     • Bibliotecas de CDN (jsPDF, OpenCV.js): cache-first permanente — depois
       do primeiro carregamento a app funciona offline.
     • Navegações: devolve o index.html em cache quando não há rede.
   Nenhuma imagem ou PDF do utilizador passa por aqui: o processamento é todo
   feito na página, em memória.
   ========================================================================== */
const VERSION   = 'docly-v1';
const SHELL     = VERSION + '-shell';
const VENDOR    = VERSION + '-vendor';
const SHELL_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];
const VENDOR_HOSTS = ['cdnjs.cloudflare.com', 'docs.opencv.org'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL)
      // addAll falha por completo se um recurso falhar; por isso vamos um a um.
      .then(cache => Promise.all(SHELL_URLS.map(u => cache.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== SHELL && k !== VENDOR).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Bibliotecas externas: cache-first (ficheiros grandes e imutáveis).
  if (VENDOR_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.open(VENDOR).then(async cache => {
        const hit = await cache.match(req, { ignoreVary: true });
        if (hit) return hit;
        const res = await fetch(req);
        // Respostas "opaque" (no-cors) também servem para <script src>.
        if (res && (res.ok || res.type === 'opaque')) {
          cache.put(req, res.clone()).catch(() => {});
        }
        return res;
      }).catch(() => Response.error())
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Navegações: rede primeiro, index.html em cache como alternativa offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          caches.open(SHELL).then(c => c.put('./index.html', res.clone())).catch(() => {});
          return res;
        })
        .catch(async () => (await caches.match('./index.html')) ||
                           (await caches.match('./')) ||
                           new Response('Offline', { status: 503, statusText: 'Offline' }))
    );
    return;
  }

  // Restantes recursos próprios: cache-first com revalidação silenciosa.
  event.respondWith(
    caches.open(SHELL).then(async cache => {
      const hit = await cache.match(req, { ignoreSearch: false });
      if (hit) {
        fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); }).catch(() => {});
        return hit;
      }
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
        return res;
      } catch (err) {
        return new Response('', { status: 504, statusText: 'Sem rede' });
      }
    })
  );
});
