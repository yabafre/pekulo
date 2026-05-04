// apps/api/src/platform/http/orpc-mount.ts
// Mount the oRPC fetch handler at /rpc/v1/* on an Elysia app. Builds a fresh
// RPCHandler from the assembled router (one per process), threads the JWT
// verification + structured request log timer around handler.handle.
//
// Story 0-5 introduced this file with an empty router; story 0-6 wires the
// first feature module (hypothesis) and adds the auth + log spine. Feature
// stories progressively expand `orpcRouter` with more module routers.

import type { AnyElysia } from "elysia";
import { RPCHandler } from "@orpc/server/fetch";

import { PekuloError, isPekuloError } from "../../common/errors";
import { mapErrorToOrpcResponse } from "./error-mapper";
import { logRpcRequest } from "./request-log";
import { requireUserContext, type JwtVerifier, type UserContext } from "../security";

export type PekuloRpcContext = UserContext;
export type PekuloRpcRouter = ConstructorParameters<typeof RPCHandler<PekuloRpcContext>>[0];

export interface MountOrpcDeps {
  jwtVerifier: JwtVerifier;
  orpcRouter: PekuloRpcRouter;
}

/**
 * Build the oRPC RPCHandler. Feature stories build the input router via
 * `implement(<moduleContract>).router({ ...handlers })` and pass the
 * assembled top-level `{ <moduleKey>: moduleRouter }` to mountOrpc.
 *
 * **DX trap warning** — pass the result of implement(...).router({...}),
 * NOT a raw contract object. Both type-check against RPCHandler's permissive
 * Router<any, T>, but a contract object dispatches on no handler at runtime
 * and 404s every well-formed call.
 */
function createPekuloRpcHandler(router: PekuloRpcRouter): RPCHandler<PekuloRpcContext> {
  return new RPCHandler(router);
}

/**
 * Mount /rpc/v1/* on the provided Elysia app and return the app for chaining.
 *
 * L2 enforcement: `app: AnyElysia` (no bare `Elysia`), return type INFERRED
 * (no annotation).
 */
export function mountOrpc(app: AnyElysia, deps: MountOrpcDeps) {
  const handler = createPekuloRpcHandler(deps.orpcRouter);

  return app.all("/rpc/v1/*", async ({ request }) => {
    const requestId = crypto.randomUUID();
    const startedAt = performance.now();
    const url = new URL(request.url);
    // route key = "<module>.<method>" derived from the URL path; used in
    // the structured log line per AC-1. The path looks like
    // /rpc/v1/hypothesis/save → "hypothesis.save".
    const routeSegments = url.pathname.replace(/^\/rpc\/v1\//, "").split("/");
    const route =
      routeSegments.length >= 2 ? `${routeSegments[0]}.${routeSegments[1]}` : url.pathname;

    try {
      const userContext = await requireUserContext(request.headers, deps.jwtVerifier);
      const { matched, response } = await handler.handle(request, {
        prefix: "/rpc/v1",
        context: userContext,
      });
      if (!matched) {
        throw new PekuloError("NOT_FOUND", `no oRPC procedure matched ${url.pathname}`);
      }
      const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
      logRpcRequest({
        requestId,
        route,
        userId: userContext.userId,
        durationMs,
        status: response.status,
      });
      return response;
    } catch (err) {
      const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
      const mapped = mapErrorToOrpcResponse(err, requestId);
      logRpcRequest({
        requestId,
        route,
        userId: isPekuloError(err) && err.code !== "UNAUTHORIZED" ? "unknown" : "anonymous",
        durationMs,
        status: mapped.status,
        errorCode: mapped.body.error.code,
      });
      // Re-throw so the global Elysia .onError(...) shapes the wire body
      // uniformly — keeps the mount layer free of duplicated error-mapping
      // logic. The .onError handler will generate ITS OWN requestId; that
      // duplication is acceptable for now (the structured log already
      // captured the mount-side requestId). Story 0-7 will unify by passing
      // the requestId through Elysia store.
      throw err;
    }
  });
}
