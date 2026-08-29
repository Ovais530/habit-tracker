// Execution OS — service worker
// Cache-first strategy for the app's own static files only.
// App DATA lives in IndexedDB (see index.html), which this file never
// touches — this only makes the app shell load with no network connection.

const CACHE_VERSION = 'v1';
const CACHE_NAME = 'execution-os-' + CACHE_VERSION;

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle simple same-origin GET requests. Never intercept anything
  // else (POST, cross-origin, etc.) — let the browser handle those normally.
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Cache-first: return immediately, then quietly refresh the cache
        // in the background for next time (stale-while-revalidate).
        event.waitUntil(
          fetch(req).then((fresh) => {
            if (fresh && fresh.ok) {
              return caches.open(CACHE_NAME).then((cache) => cache.put(req, fresh));
            }
          }).catch(() => { /* offline — keep serving the cached copy */ })
        );
        return cached;
      }

      // Not cached yet — try the network, and cache a copy for next time.
      return fetch(req).then((fresh) => {
        if (fresh && fresh.ok) {
          const copy = fresh.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return fresh;
      }).catch(() => {
        // Fully offline and nothing cached for this request — for page
        // navigations, fall back to the app shell rather than failing.
        if (req.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
