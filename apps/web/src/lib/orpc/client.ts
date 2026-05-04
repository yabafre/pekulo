// apps/web/src/lib/orpc/client.ts
// Server-only oRPC HTTP link to apps/api. Auth header forwarding wired in
// story 0-6 — the headers thunk reads the per-request access token from the
// AsyncLocalStorage `requestContextStore`. Story 0-7 (OTel) will append
// tracing headers here.

import "server-only";

import { RPCLink } from "@orpc/client/fetch";
import { getRequestContext } from "./request-context";

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
  headers: () => ({
    Authorization: `Bearer ${getRequestContext().accessToken}`,
  }),
});
