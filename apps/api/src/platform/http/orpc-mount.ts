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
 * Constructor parameter accepted by `RPCHandler`. Re-exported as a Pekulo
 * type so feature stories import a single, named handle rather than digging
 * into `@orpc/server/fetch`'s internals.
 */
type PekuloRpcRouter = ConstructorParameters<typeof RPCHandler<object>>[0];

/**
 * Build the oRPC RPCHandler for the Pekulo router. Feature stories should
 * call this rather than instantiating `RPCHandler` directly so the
 * convention lives in one place (review F5).
 *
 * **DX trap warning** — pass the result of
 * `os.contract(<moduleContract>).router({ ...handlers })`, NOT a raw
 * contract object. Both type-check against RPCHandler's permissive
 * `Router<any, T>`, but a contract object dispatches on no handler at
 * runtime and 404s every well-formed call. If you find yourself passing
 * `pekuloContract.compass` here, you want `os.contract(pekuloContract.compass).router({...})`.
 */
function createPekuloRpcHandler(router: PekuloRpcRouter): RPCHandler<object> {
  return new RPCHandler(router);
}

const pekuloRouter = {} satisfies PekuloRpcRouter;

/**
 * Build the oRPC RPCHandler ONCE per process. The handler is stateless and
 * shared across requests — RPCHandler internally maps the URL path to the
 * router tree key, regardless of how many concurrent requests are in flight.
 */
const handler = createPekuloRpcHandler(pekuloRouter);

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
    if (!matched) {
      // No procedure matched — throw a typed NOT_FOUND so the global
      // Elysia .onError(...) shapes a uniform 404 body via the error-mapper.
      // This is what AC-4 is verifying. The discriminated FetchHandleResult
      // from @orpc/server/fetch guarantees `response: Response` whenever
      // `matched: true`, so we don't need a defensive `response === undefined`
      // branch (review F11a).
      throw new PekuloError(
        "NOT_FOUND",
        `no oRPC procedure matched ${new URL(request.url).pathname}`,
      );
    }
    return response;
  });
}
