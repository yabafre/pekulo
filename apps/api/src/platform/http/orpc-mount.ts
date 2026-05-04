// apps/api/src/platform/http/orpc-mount.ts
// Mount the oRPC fetch handler at /rpc/v1/* on an Elysia app.
// The router is empty for the scaffold — every request falls through to
// matched=false and the global Elysia .onError(...) shapes the 404.
// Feature stories progressively replace `pekuloRouter` with handlers via
// `os.contract(<moduleContract>).router({ ... })`.

import type { AnyElysia } from "elysia";
import { RPCHandler } from "@orpc/server/fetch";

import { PekuloError } from "../../common/errors";

/**
 * Build the oRPC RPCHandler ONCE per process. The handler is stateless and
 * shared across requests — RPCHandler internally maps the URL path to the
 * router tree key, regardless of how many concurrent requests are in flight.
 *
 * The router is empty for the scaffold; feature stories REPLACE this file
 * with `os.contract(<moduleContract>).router({ ...handlers })` rather than
 * extending the literal at runtime, so the `{}` narrowing is safe.
 */
const handler = new RPCHandler({});

/**
 * Mount /rpc/v1/* on the provided Elysia app and return the app for chaining.
 *
 * L2 enforcement: `app: AnyElysia` (no bare `Elysia`), return type INFERRED
 * (no annotation). The chain Elysia produces from `.all(...)` carries the
 * route generic and would be rejected by a bare `Elysia` parameter type.
 */
export function mountOrpc(app: AnyElysia) {
  return app.all("/rpc/v1/*", async ({ request }) => {
    const { matched, response } = await handler.handle(request, {
      prefix: "/rpc/v1",
      context: {},
    });
    if (!matched || response === undefined) {
      // No procedure matched — throw a typed NOT_FOUND so the global
      // Elysia .onError(...) shapes a uniform 404 body via the error-mapper.
      // This is what AC-4 is verifying.
      throw new PekuloError(
        "NOT_FOUND",
        `no oRPC procedure matched ${new URL(request.url).pathname}`,
      );
    }
    return response;
  });
}
