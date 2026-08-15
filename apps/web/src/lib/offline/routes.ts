// apps/web/src/lib/offline/routes.ts
// The routes FR-54 makes available offline, for the client bundle.
//
// `public/sw.js` declares the SAME list because it is a raw public/ file served
// verbatim to the browser — it has no module graph to import from. That leaves
// two copies on purpose; `routes.test.ts` reads sw.js and fails the build if
// they ever drift. Anything not listed here is online-only: no cached shell, no
// dehydrated snapshot, and therefore no offline banner.
export const OFFLINE_ROUTES: readonly string[] = [
  "/dashboard",
  "/dashboard/portefeuille",
  "/dashboard/immobilier",
];

/** Drop a trailing slash so `/dashboard/` and `/dashboard` are one route.
 * Online, Next's `trailingSlash: false` redirects the slashed form away and the
 * distinction never surfaces — but offline that redirect never happens, and an
 * exact match would leave the screen with no cached shell and no banner. */
export function normaliseOfflinePath(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

/** Exact match on the normalised path, not a prefix: `/dashboard/transactions`
 * sits under `/dashboard` but is neither cached nor dehydrated. */
export function isOfflineRoute(pathname: string): boolean {
  return OFFLINE_ROUTES.includes(normaliseOfflinePath(pathname));
}
