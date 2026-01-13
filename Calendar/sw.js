const CACHE_VERSION = 'v1';
const CACHE_NAME = `my-calendar-${CACHE_VERSION}`;

// Compute base URL relative to where the service worker file is served.
// This makes the SW work whether it's registered at site root or a subpath.
const BASE = new URL('.', self.location).href;

const ASSETS = [
  new URL('', BASE).href,
  new URL('index.html', BASE).href,
  new URL('calendar.css', BASE).href,
  new URL('calendar.js', BASE).href,
  new URL('add_new_event.js', BASE).href,
  new URL('manifest.json', BASE).href
  ,
  new URL('templates/images/icon-192.png', BASE).href,
  new URL('templates/images/icon-512.png', BASE).href,
  // Absolute fallbacks in case SW is registered from a different path
  new URL('/Calendar/templates/images/icon-192.png', BASE).href,
  new URL('/Calendar/templates/images/icon-512.png', BASE).href
];

self.addEventListener('install', (event) => {
  // Failures to cache individual assets should not abort install.
  event.waitUntil((async () => {
    self.skipWaiting();
    const cache = await caches.open(CACHE_NAME);
    for (const url of ASSETS) {
      try {
        const resp = await fetch(url);
        if (resp && (resp.ok || resp.type === 'opaque')) {
          await cache.put(url, resp.clone());
        } else {
          // log but don't throw
          console.warn('SW: asset fetch not OK:', url, resp && resp.status);
        }
      } catch (err) {
        console.warn('SW: failed to cache asset', url, err);
      }
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Clean up old caches that don't match the current CACHE_NAME
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => { if (k !== CACHE_NAME) return caches.delete(k); }));
    } catch (e) { console.warn('SW: cache cleanup failed', e); }

    // Immediately take control of pages
    try { await self.clients.claim(); } catch (e) { /* ignore */ }

    // Notify clients that a new service worker is active
    try {
      const all = await self.clients.matchAll({ includeUncontrolled: true });
      for (const client of all) {
        client.postMessage({ type: 'SW_ACTIVATED', version: CACHE_VERSION });
      }
    } catch (e) { /* ignore */ }
  })());
});

// Cache-first with background update; fallback to network when missing
self.addEventListener('fetch', (event) => {
  // Treat manifest.json as network-first to avoid stale or empty cached manifest
  try {
    const reqUrl = new URL(event.request.url);
    if (reqUrl.pathname.endsWith('/manifest.json') || reqUrl.pathname.endsWith('manifest.json')) {
      event.respondWith((async () => {
        try {
          const netResp = await fetch(event.request);
          if (netResp && (netResp.ok || netResp.type === 'opaque')) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(event.request, netResp.clone());
          }
          return netResp;
        } catch (e) {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          return new Response('', { status: 503, statusText: 'Service Unavailable' });
        }
      })());
      return;
    }

    event.respondWith((async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(event.request);
        if (cached) {
          // Update cache in background
          event.waitUntil((async () => {
            try {
              const netResp = await fetch(event.request);
              if (netResp && netResp.ok) await cache.put(event.request, netResp.clone());
            } catch (e) {
              // ignore network update failures
            }
          })());
          return cached;
        }

        // Not cached -> try network
        const networkResponse = await fetch(event.request);
        return networkResponse;
      } catch (err) {
        // If both fail, try a sensible fallback (index.html) or an empty Response
        try {
          const fallback = await caches.match(new URL('index.html', BASE).href);
          if (fallback) return fallback;
        } catch (e) {}
        return new Response('', { status: 503, statusText: 'Service Unavailable' });
      }
    })());
  } catch (outerErr) {
    // Fallback: default to network
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
  }
});
