const CACHE = 'harry-notes-v1';

// On install: cache the root shell immediately
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.add('/')).then(() => self.skipWaiting())
  );
});

// On activate: delete old cache versions
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

  // Only handle same-origin requests — let Supabase calls go straight to network
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // Navigation (HTML): network-first so the app always updates, falls back to cache for offline
    e.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/'))
        )
    );
  } else {
    // Static assets (JS, CSS, fonts, images): cache-first
    // Expo generates hashed filenames so cached files are always valid
    e.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(request, clone));
          }
          return res;
        });
      })
    );
  }
});
