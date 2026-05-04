// apps/web/src/lib/orpc/request-context.ts
// AsyncLocalStorage-backed request context for the apps/web server tier.
// Both server actions (zapaction's setActionContext resolver) AND RSC data
// readers (apps/web/src/lib/data/*.ts) call ensureRequestContext() so the
// RPCLink.headers thunk can read the access token without per-call plumbing.
//
// enterWith() transitions the AsyncLocalStorage into the context for the
// remainder of the current synchronous execution and persists through any
// following async calls within the same V8 ResourceContext. Next.js wraps
// each request in its own ResourceContext, so concurrent requests have
// isolated stores (no cross-contamination).

import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

import { createClient } from "@/lib/supabase/server";

export interface RequestContext {
  accessToken: string;
  userId: string;
  email: string | null;
}

const requestContextStore = new AsyncLocalStorage<RequestContext>();

/**
 * Idempotent — returns the existing store entry if `enterWith` already ran
 * earlier in this request (e.g. zapaction's setActionContext resolver fired
 * first). Otherwise resolves the Supabase session, captures the access
 * token, and `enterWith`s the new context.
 */
export async function ensureRequestContext(): Promise<RequestContext> {
  const existing = requestContextStore.getStore();
  if (existing) return existing;

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  const ctx: RequestContext = {
    accessToken: session.access_token,
    userId: session.user.id,
    email: session.user.email ?? null,
  };
  requestContextStore.enterWith(ctx);
  return ctx;
}

/**
 * Synchronous getter — used by the RPCLink.headers thunk. Throws if called
 * outside an ensured request context (e.g. from a route handler that
 * forgot to call ensureRequestContext first).
 */
export function getRequestContext(): RequestContext {
  const store = requestContextStore.getStore();
  if (!store) {
    throw new Error(
      "Request context not set. Call ensureRequestContext() first or invoke from inside a server action.",
    );
  }
  return store;
}

/**
 * Test-only — drains the AsyncLocalStorage for unit tests that need to
 * simulate "no context yet". Production code should never call this.
 */
export function _resetRequestContextForTests(): void {
  requestContextStore.disable();
}
