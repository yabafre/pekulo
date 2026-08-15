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
//
// The cache name is mirrored by SHELL_CACHE_PREFIX in src/lib/offline/cache-db.ts,
// which drops it on sign-out — the cached /dashboard document carries the
// signed-in user's email in its flight payload.
const VERSION = "pekulo-shell-v1";
const SHELL_CACHE = VERSION;
const OFFLINE_ROUTES = ["/dashboard", "/dashboard/portefeuille", "/dashboard/immobilier"];
// Content-hashed chunks are never invalidated by name, so without a ceiling the
// cache keeps every build's assets forever. When an origin blows its storage
// quota the browser evicts the WHOLE bucket — taking pekulo-cache-<userId>, and
// with it the offline data this worker exists to support.
const MAX_STATIC_ENTRIES = 240;

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
      await trimStaticEntries();
      await self.clients.claim();
    })(),
  );
});

async function trimStaticEntries() {
  try {
    const cache = await caches.open(SHELL_CACHE);
    const keys = await cache.keys();
    const stat = keys.filter((request) => request.url.indexOf("/_next/static/") !== -1);
    // cache.keys() answers in insertion order, so the head is the oldest.
    const excess = stat.length - MAX_STATIC_ENTRIES;
    if (excess > 0) await Promise.all(stat.slice(0, excess).map((req) => cache.delete(req)));
  } catch {
    // Storage unavailable — trimming is housekeeping, never a reason to fail
    // activation and leave the page without a worker.
  }
}

function normalisePath(pathname) {
  return pathname.length > 1 && pathname.charAt(pathname.length - 1) === "/"
    ? pathname.slice(0, -1)
    : pathname;
}

function isOfflineRoute(url) {
  return OFFLINE_ROUTES.indexOf(normalisePath(url.pathname)) !== -1;
}

/** Store every query-string variant of a screen under ONE key. `?tab=patrimoine`
 * is a primary in-app URL (cap-shell pushes it), and the Cache API keys on the
 * full URL by default — so a user who had only loaded /dashboard online hit a
 * network-error page offline the moment they tapped Patrimoine. */
function shellKey(url) {
  return url.origin + normalisePath(url.pathname);
}

/** A failed write is never a reason to fail the request: quota exhaustion and
 * partial (206) responses both reject here, and we already hold a good response. */
async function putSafely(cache, key, response) {
  try {
    await cache.put(key, response);
  } catch {
    // Quota exceeded / unsupported response — serve the network result anyway.
  }
}

async function networkFirst(request, key) {
  const cache = await caches.open(SHELL_CACHE);
  let response;
  try {
    // A navigation request carries redirect mode "manual", so a 307 to /login
    // arrives as an opaque redirect with ok === false. This guard is therefore
    // load-bearing: relaxing it to `status < 400` would cache the redirect and
    // let the browser serve a signed-out visitor the previous user's shell.
    response = await fetch(request);
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw error;
  }
  if (response && response.ok) await putSafely(cache, key, response.clone());
  return response;
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) await putSafely(cache, request, response.clone());
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
    event.respondWith(networkFirst(request, shellKey(url)));
  }
});
