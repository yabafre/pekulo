// apps/api/src/modules/logos/logos.routes.ts
// Story 6-10. PUBLIC-read streaming proxy: GET /v1/logos?ref=<opaque>. The
// browser only ever talks to apps/api (privacy: no merchant-domain/IP leak to
// Brandfetch/Bridge CDN). Elysia-native (NOT oRPC — binary stream). Returns an
// inferred chain (no `: Elysia` annotation — lesson 2026-05-04).
//
// ANTI-SSRF (AC-5): `ref` is an opaque cache index, decoded by the service to a
// SERVER-RESOLVED upstream URL. A url-shaped or garbage ref does not decode →
// 404. The route NEVER fetches a URL taken from the query — it streams the
// native upstream Response through (iso the bridge webhook router's
// `return new Response(...)` shape).

import { Elysia, t } from "elysia";
import type { LogosService } from "./logos.service";

const PROXY_TIMEOUT_MS = 5_000;

// Defense in depth on top of the opaque-ref guard: even though `upstream` is a
// SERVER-stored URL (never client-supplied), a poisoned cache row or a hostile
// upstream response could otherwise point the proxy `fetch` at an arbitrary host
// (incl. internal addresses). Pin the resolved URL to https + the only two CDNs
// that legitimately serve logos (Brandfetch + Bridge bank directory), and only
// relay image bytes — never an HTML error page under an immutable cache header.
const ALLOWED_LOGO_HOSTS = [".brandfetch.io", "web.bridgeapi.io"];

function isAllowedUpstream(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_LOGO_HOSTS.some((h) =>
    h.startsWith(".") ? host === h.slice(1) || host.endsWith(h) : host === h,
  );
}

export function registerLogoRoutes(deps: { service: LogosService }) {
  return new Elysia({ name: "logos" }).get(
    "/v1/logos",
    async ({ query }) => {
      const upstream = await deps.service.refToUpstreamUrl(query.ref);
      // 404 (no fetch) on an unresolvable ref OR a resolved URL outside the
      // logo-CDN allowlist (anti-SSRF — AC-5).
      if (!upstream || !isAllowedUpstream(upstream)) {
        return new Response("logo not found", { status: 404 });
      }
      try {
        const res = await fetch(upstream, { signal: AbortSignal.timeout(PROXY_TIMEOUT_MS) });
        const contentType = res.headers.get("content-type") ?? "application/octet-stream";
        // Relay binary logo bytes only — never an HTML/JSON error page under the
        // immutable cache header. Some logo CDNs mis-serve PNGs as
        // application/octet-stream (web.bridgeapi.io bank logos do), so accept
        // image/* AND octet-stream; a text/* or json body is an error page → 404.
        const servable =
          contentType.startsWith("image/") || contentType.startsWith("application/octet-stream");
        if (!res.ok || !res.body || !servable) {
          return new Response("logo not found", { status: 404 });
        }
        return new Response(res.body, {
          status: 200,
          headers: {
            "content-type": contentType,
            // Reference data — long, immutable cache. The ref already pins the asset.
            "cache-control": "public, max-age=86400, immutable",
          },
        });
      } catch {
        return new Response("logo not found", { status: 404 });
      }
    },
    { query: t.Object({ ref: t.String({ minLength: 1, maxLength: 256 }) }) },
  );
}
