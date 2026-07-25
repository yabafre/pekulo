// apps/web/public/sw.js
// Pekulo PWA app shell (FR-54, ADR-0018). Hand-written on purpose: Next 16 has
// NO native `app/sw.ts` convention (its PWA guide prescribes public/sw.js +
// manual registration), and Serwist needs a webpack config this Turbopack app
// does not have.
//
// Runtime caching only — nothing is precached at install. That keeps the cached
// document and the cached /_next/static chunks from the SAME build: a
// hand-versioned precache list would serve an HTML file pointing at chunk
// hashes that no longer exist after the next deploy.
//
// This worker caches the SHELL, never the DATA: the cap screens read through
// Server Actions (POST) that the Cache API cannot store. Data lives encrypted
// in IndexedDB via src/lib/offline/*.
const VERSION = "pekulo-shell-v1";
const SHELL_CACHE = VERSION;
const OFFLINE_ROUTES = ["/dashboard", "/dashboard/portefeuille", "/dashboard/immobilier"];

self.addEventListener("install", () => {
  // Take over as soon as the new worker is ready — an old shell serving a new
  // build's HTML is exactly the mismatch we are avoiding.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name !== VERSION).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

function isOfflineRoute(url) {
  return OFFLINE_ROUTES.indexOf(url.pathname) !== -1;
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  // AC-5 — every mutation (Server Actions are POST) goes straight to the
  // network. Returning without respondWith hands the request back to the browser.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Cross-origin (Supabase auth, logo upstreams) is never intercepted.
  if (url.origin !== self.location.origin) return;
  // Build assets are content-hashed and immutable.
  if (url.pathname.indexOf("/_next/static/") === 0) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (request.mode === "navigate" && isOfflineRoute(url)) {
    event.respondWith(networkFirst(request));
  }
});
