// apps/web/src/lib/orpc/client.ts
// Server-only oRPC HTTP link to apps/api. Used by every typed module client
// in `modules.ts`. Auth header forwarding lands in story 0-6 (zapaction-orpc-bridge).

import "server-only";

import { RPCLink } from "@orpc/client/fetch";

/**
 * Resolve the apps/api base URL at module-load time. We allow `API_BASE_URL`
 * to be undefined in dev (bun --hot reloads will respect a later env push)
 * but throw at first request if missing. Future story 0-8 (CI/CD) wires
 * VERCEL_ENV-aware defaults; story 0-7 (OTel) adds tracing headers here.
 */
const apiBaseUrl = process.env.API_BASE_URL;

function requireApiBaseUrl(): string {
  if (!apiBaseUrl || apiBaseUrl.trim().length === 0) {
    throw new Error(
      "API_BASE_URL is not set. Configure it in .env / .env.local " +
        "(local dev default: http://127.0.0.1:3001).",
    );
  }
  return apiBaseUrl;
}

export const orpcLink = new RPCLink({
  url: () => `${requireApiBaseUrl()}/rpc/v1`,
  // headers: () => ({}) — auth header forwarding wired in story 0-6.
});
