// Offline app shell for the harry-notes PWA.
//
// Registered from scripts/inject-pwa-head.js (NOT app/+html.tsx — that file is
// dead code under web.output:"single"). Between the SPA switch and 2026-08-28
// nothing registered this worker at all, so none of the below ever ran.
const CACHE = 'harry-notes-v3';

// Assets to pre-cache on install (app shell)
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

/**
 * The JS bundle and stylesheet that index.html actually depends on, discovered
 * by reading index.html rather than hard-coded.
 *
 * They have to be pre-cached, and their names cannot be written down here:
 * `expo export` content-hashes them (entry-6623b385….js), so the filename
 * changes on every build. Without this the app was offline-capable in the most
 * useless possible way — the shell HTML came back from cache, referenced a
 * bundle that had never been cached, and painted a blank page. Relying on the
 * fetch handler to catch them instead does not work either: on the very first
 * load the worker is still installing and controls nothing, so it never sees
 * those requests.
 */
async function shellSubresources() {
  try {
    const res = await fetch('/index.html', { cache: 'reload' });
    if (!res.ok) return [];
    const html = await res.text();
    const urls = [];
    const re = /(?:src|href)="(\/_expo\/static\/[^"]+\.(?:js|css))"/g;
    let m;
    while ((m = re.exec(html)) !== null) urls.push(m[1]);
    return urls;
  } catch {
    return [];
  }
}

// On install: pre-cache the app shell, including the hashed bundle it needs.
self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const c = await caches.open(CACHE);
      const extra = await shellSubresources();
      // allSettled: one 404 must not abort the install and leave the worker
      // permanently un-activated.
      await Promise.allSettled([...SHELL_ASSETS, ...extra].map(url => c.add(url)));
      await self.skipWaiting();
    })()
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

  // Only GET is cacheable; a POST/PATCH must never be served from the cache.
  if (request.method !== 'GET') return;

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

  // ── Navigation (HTML): network-first, falling back to the cached shell ─────
  //
  // Deliberately NOT cache-first. This is a single-page app: index.html is a
  // tiny stub whose only real content is a <script src> at a content-hashed
  // URL. Serving it from cache first meant every deploy was invisible until a
  // second load — the first load painted the old shell and only then fetched
  // the new one in the background.
  //
  // The fallback matches '/' rather than the request, because the cache keys on
  // the full URL including the query string: a share-target navigation to
  // /share?text=… could never hit a cached entry, so an offline share landed on
  // a bare "Offline" response. Every route is the same SPA stub anyway
  // (public/_redirects rewrites /* → /index.html 200), so '/' is always the
  // right document to hand back.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put('/', clone));
          }
          return res;
        })
        .catch(() =>
          caches.match('/')
            .then((root) => root || caches.match('/index.html'))
            .then((doc) => doc || new Response('Offline', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            }))
        )
    );
    return;
  }

  // ── JS / CSS / fonts / images: stale-while-revalidate ──────────────────────
  //
  // Safe to serve stale: expo export gives every bundle and stylesheet a
  // content-hashed filename, so a changed file is a different URL and can never
  // be shadowed by an old cache entry.
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
