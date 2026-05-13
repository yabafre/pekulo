// apps/web/src/lib/orpc/client.ts
// Server-only oRPC HTTP link to apps/api. Auth header forwarding wired in
// story 0-6.
//
// 2026-05-09 — switched the headers thunk from sync `getRequestContext()`
// (reads AsyncLocalStorage) to async `ensureRequestContext()` (idempotent
// resolve + seed). Lesson L25 manifested on Next.js 16.2.4 + Turbopack:
// `requestContextStore.enterWith(...)` set inside an action handler did not
// propagate into the same handler's subsequent oRPC client call (the
// headers thunk fires inside oRPC's prepareRequest async pipeline, which
// appears to exit the ALS frame). Calling ensureRequestContext from inside
// the thunk seeds the store in the thunk's own async chain — so the
// access token is always read fresh, never from a stale or missing frame.
// `ensureRequestContext` is short-circuit on the existing store entry,
// so the resolver-seeded path stays free.

import "server-only";

import { RPCLink } from "@orpc/client/fetch";
import { ensureRequestContext } from "./request-context";

function requireApiBaseUrl(): string {
  const apiBaseUrl = process.env.API_BASE_URL;
  if (!apiBaseUrl || apiBaseUrl.trim().length === 0) {
    throw new Error(
      "API_BASE_URL is not set. Configure it in .env / .env.local " +
        "(set to http://127.0.0.1:3001 for local dev).",
    );
  }
  return apiBaseUrl;
}

export const orpcLink = new RPCLink({
  url: () => `${requireApiBaseUrl()}/rpc/v1`,
  headers: async () => {
    const ctx = await ensureRequestContext();
    return {
      Authorization: `Bearer ${ctx.accessToken}`,
    };
  },
});
