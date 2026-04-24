const CACHE = 'harry-notes-v1';

// Assets to pre-cache on install (app shell)
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// On install: pre-cache the app shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => {
      // Pre-cache what we can; ignore individual failures
      return Promise.allSettled(SHELL_ASSETS.map(url => c.add(url)));
    }).then(() => self.skipWaiting())
  );
});

// On activate: delete old cache versions and claim clients
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // ── Supabase / external API: network-first, offline fallback ──────────────
  if (url.hostname.endsWith('supabase.co') || url.origin !== self.location.origin) {
    e.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ offline: true }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    return;
  }

  // ── Navigation (HTML): cache-first, fall back to network then cached root ──
  if (request.mode === 'navigate') {
    e.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          // Serve from cache immediately, update in background
          fetch(request).then((res) => {
            if (res.ok) {
              caches.open(CACHE).then((c) => c.put(request, res));
            }
          }).catch(() => {});
          return cached;
        }
        return fetch(request)
          .then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE).then((c) => c.put(request, clone));
            }
            return res;
          })
          .catch(() =>
            caches.match('/').then((root) => root || new Response('Offline', { status: 503 }))
          );
      })
    );
    return;
  }

  // ── JS / CSS / fonts / images: stale-while-revalidate ──────────────────────
  const isStaticAsset =
    url.pathname.match(/\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|ico|webp)$/i);

  if (isStaticAsset) {
    e.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(request, clone));
          }
          return res;
        }).catch(() => cached); // network failed but we have cache

        // Return cached immediately (if available), update in background
        return cached || networkFetch;
      })
    );
    return;
  }

  // ── Everything else: network-first ────────────────────────────────────────
  e.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request).then((c) => c || new Response('Offline', { status: 503 })))
  );
});
