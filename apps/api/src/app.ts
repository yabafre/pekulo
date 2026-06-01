import { trace } from "@opentelemetry/api";
import { openapi } from "@elysiajs/openapi";
import { Elysia } from "elysia";
import { loadEnv } from "./config/env";
import { createRuntimeDependencies } from "./bootstrap/runtime-dependencies";
import { registerLifecycle } from "./bootstrap/lifecycle";
import { startSchedulers, stopSchedulers } from "./bootstrap/schedulers";
import { createHealthModule } from "./modules/health/health.module";
import { mapErrorToOrpcResponse } from "./platform/http/error-mapper";
import { mountOrpc } from "./platform/http/orpc-mount";
import { extractRequestId } from "./common/errors";
import { elysiaOtelHttpPlugin, endHttpServerSpan, shutdownOtel } from "./platform/observability";

export interface ServerHandle {
  stop: () => Promise<void>;
}

export async function startServer(): Promise<ServerHandle> {
  const env = loadEnv();
  const deps = await createRuntimeDependencies({ env });
  const healthModule = createHealthModule({ readiness: deps.readiness });

  // L2 — let Elysia infer the chained type; never annotate the variable with the bare Elysia type.
  // OTel plugin is mounted FIRST so .onRequest fires before any other hook,
  // starting the SERVER span. .onAfterHandle ends the span on success; the
  // error path is closed inside the .onError below via endHttpServerSpan
  // (plugin-level .onError would be suppressed once this local .onError
  // returns a Response — story 0-7 review finding H5).
  const app = new Elysia()
    // OpenAPI / Scalar UI — auto-scrapes Elysia-native routes (e.g. /health, /ready).
    // The oRPC mount at /rpc/v1/* appears as a single wildcard route here ; per-procedure
    // documentation would require either (a) declaring procedures in @pekulo/contracts with
    // .route({ method, path }) annotations and switching to oRPC's OpenAPIHandler, or
    // (b) emitting a sister spec from the contracts at codegen time. Both are deferred.
    // security-perimeter-hardening — the Scalar/OpenAPI playground is an
    // info-disclosure surface (enumerates routes + error shapes), so it is
    // gated to local dev via the plugin's own `enabled` flag (confirmed on
    // @elysiajs/openapi@1.4.15). Non-dev envs (Dokploy prod, test) expose no
    // /openapi route at all. Revisit when the (b) public ramp wants an
    // authenticated playground.
    .use(
      openapi({
        enabled: env.NODE_ENV === "development",
        path: "/openapi",
        provider: "scalar",
        documentation: {
          info: {
            title: "Pekulo API",
            version: "v1",
            description:
              "Pekulo domain API — Bun + Elysia + oRPC. Direct REST routes documented here ; per-procedure oRPC docs via /rpc/v1/* not yet generated (see ADR-0009).",
          },
          // No `servers:` block — Scalar / the OpenAPI plugin auto-infer the
          // server URL from the page origin where the spec is fetched. Local
          // dev → `http://127.0.0.1:3001`, Dokploy prod → `https://pekulo-api.dkp.trafijs.com`.
          // Hard-coding `http://${env.HOST}:${env.PORT}` was wrong: in a
          // container `env.HOST = "0.0.0.0"` (the BIND address), not the
          // public URL clients should hit. Surfaced live on the prod Scalar
          // UI which shipped `http://0.0.0.0:3001` as the test target.
        },
        exclude: { methods: ["options", "head"] },
      }),
    )
    .use(elysiaOtelHttpPlugin())
    .onError(({ error, set, request, route }) => {
      // requestId correlation: prefer the requestId attached by mountOrpc;
      // fall back to the active OTel trace_id (architecture L573 contract:
      // "5xx errors carry code + requestId (the OTel trace_id, for forensic
      // cross-reference)"); last-resort a fresh UUID for paths with no OTel
      // span context. Story 0-7 review finding H6.
      const requestId =
        extractRequestId(error) ??
        trace.getActiveSpan()?.spanContext().traceId ??
        crypto.randomUUID();
      const mapped = mapErrorToOrpcResponse(error, requestId);
      // Log only 5xx (server-side faults that need attention). 4xx are
      // client-driven (404 scanner traffic, 401 missing token, 400 bad
      // payload) and would flood the log with noise — full context for
      // those still flows through the OTel span via endHttpServerSpan
      // below (recordException + span.setStatus ERROR), so SigNoz remains
      // the source of truth for forensic debugging. Lesson L11 sub-rule.
      const status = typeof mapped.status === "number" ? mapped.status : 500;
      if (status >= 500) {
        console.error("[api] error", {
          requestId,
          code: mapped.body.code,
          name: error instanceof Error ? error.name : typeof error,
          message: error instanceof Error ? error.message : String(error),
        });
      }
      set.status = mapped.status;
      // Close the OTel SERVER span with error semconv + recordException —
      // handled HERE (not in the plugin) because plugin's .onError is
      // suppressed once this local hook returns a Response.
      endHttpServerSpan({
        request,
        error,
        route,
        statusCode: status,
      });
      return mapped.body;
    })
    .use(healthModule.router)
    // Story 5-6 — Bridge webhook receiver mounted BEFORE mountOrpc so the
    // /internal/bridge/webhook path resolves before the oRPC catch-all.
    // Raw body capture happens inside the router (onParse) ; HMAC verification
    // gates every dispatch (NFR-33).
    .use(deps.bankAggregatorModule.webhookRouter)
    // Story 6-1 — /internal/llm/attest listener mounted BEFORE mountOrpc so the
    // internal path resolves before the oRPC catch-all (parity with the Bridge
    // webhook). JWT-verified inside the router (ADR-0008).
    .use(deps.llmModule.attestRouter);

  mountOrpc(app, { jwtVerifier: deps.jwtVerifier, orpcRouter: deps.orpcRouter });

  // Start background schedulers after Elysia is wired but before listen()
  // returns: the 5-6 bank-refresh cron AND the 6-4 suggestion-backfill sweep.
  // Stop is registered on lifecycle teardown below. (Wiring extracted to a
  // unit-tested helper — aped-review 6-4 caught the backfill sweep never being
  // started when it lived inline here.)
  startSchedulers(deps);

  await registerLifecycle(
    app,
    { shutdownTimeoutMs: env.SHUTDOWN_TIMEOUT_MS },
    {
      prismaService: deps.prismaService,
      shutdownOtel,
      onShutdown: async () => {
        stopSchedulers(deps);
      },
    },
  );

  app.listen({ port: env.PORT, hostname: env.HOST }, (server) => {
    console.log(`[api] listening on http://${server.hostname}:${server.port}`);
  });

  return {
    stop: async () => {
      await app.stop();
    },
  };
}
