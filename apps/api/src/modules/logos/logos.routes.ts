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

export function registerLogoRoutes(deps: { service: LogosService }) {
  return new Elysia({ name: "logos" }).get(
    "/v1/logos",
    async ({ query }) => {
      const upstream = await deps.service.refToUpstreamUrl(query.ref);
      if (!upstream) return new Response("logo not found", { status: 404 });
      try {
        const res = await fetch(upstream, { signal: AbortSignal.timeout(PROXY_TIMEOUT_MS) });
        if (!res.ok || !res.body) return new Response("logo not found", { status: 404 });
        return new Response(res.body, {
          status: 200,
          headers: {
            "content-type": res.headers.get("content-type") ?? "image/png",
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
