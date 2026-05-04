// apps/web/src/lib/orpc/client.ts
// Server-only oRPC HTTP link to apps/api. Used by every typed module client
// in `modules.ts`. Auth header forwarding lands in story 0-6 (zapaction-orpc-bridge).

import "server-only";

import { RPCLink } from "@orpc/client/fetch";

/**
 * Resolve the apps/api base URL on every request. Reading `process.env`
 * inside the link's `url` thunk (instead of capturing at module-load) means
 * a late env push (e.g. bun --hot reload that re-reads `.env.local` after
 * the module was first evaluated) is picked up without a process restart.
 * Future story 0-8 (CI/CD) wires VERCEL_ENV-aware defaults; story 0-7 (OTel)
 * adds tracing headers here.
 */
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
  // headers: () => ({}) — auth header forwarding wired in story 0-6.
});
