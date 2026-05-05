// apps/api/src/platform/observability/otel-sdk.ts
// NodeSDK initialization for the Bun + Elysia api tier.
//
// Init order (load-bearing):
//   1. main.ts calls `await startOtel(env)` BEFORE dynamic-importing app.ts
//   2. PrismaInstrumentation is registered HERE so Prisma's
//      `new PrismaClient(...)` (called later by createPrismaService) is
//      patched at construction.
//   3. The custom Elysia plugin (`elysiaOtelHttpPlugin`) is mounted in
//      app.ts. It creates a SpanKind.SERVER span per request via
//      .onRequest and ends it on success in .onAfterHandle. The error
//      path is closed by the app-level .onError calling
//      `endHttpServerSpan(...)` — necessary because Elysia's local
//      .onError (which returns a Response) suppresses downstream
//      plugin .onError hooks.
//
// Package equivalence vs architecture L243:
//   - We do NOT use `@elysiajs/opentelemetry@1.4.0` (the original
//     architecture-suggested option). Its rootSpan-export hooks
//     (event.onStop / .onAfterResponse) do not fire in Elysia 1.4.4 +
//     Bun, so we ship a custom plugin instead. See lessons.md
//     "OTel rootSpan plugin gap (Elysia 1.4.4 + Bun)".
//   - `@prisma/instrumentation` ≡ architecture's
//     `@opentelemetry/instrumentation-prisma` (the Prisma team vendored
//     the package; same OTel SDK contract).
//
// Shutdown order (load-bearing — see § Lifecycle ordering in story file):
//   app.stop() → shutdownOtel() → prismaService.disconnect()
//   Each step is bounded by its own slice of SHUTDOWN_TIMEOUT_MS in
//   bootstrap/lifecycle.ts (see withTimeout helper).
//
// Exporter selection:
//   - OTEL_EXPORTER_OTLP_ENDPOINT set → OTLPTraceExporter
//   - otherwise → ConsoleSpanExporter (V1 (a) default)
//
// OTEL_LOG_LEVEL:
//   - Wired to OTel's internal `diag` logger so SDK warnings (e.g. failed
//     exports) surface at the configured level. Default `error` keeps
//     stdout quiet at V1 (a). `debug` flips the span processor to
//     SimpleSpanProcessor for sync inspection during local dev.

import {
  context,
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
  type Span,
} from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { PrismaInstrumentation } from "@prisma/instrumentation";
import { Elysia } from "elysia";

import type { Env } from "../../config/env";

// L12: pin the active SDK on globalThis so it survives `bun --hot` HMR reloads.
// Module-level state resets when the module re-imports, but OTel's global
// registrations (trace/context/propagation) persist at the process level —
// re-running startOtel against the same process tree triggers "Attempted
// duplicate registration of API". Using globalThis as the source of truth
// lets HMR safely no-op while keeping the original SDK + spans alive.
declare global {
  // eslint-disable-next-line no-var
  var __pekuloOtelSdk: NodeSDK | undefined;
}

function getSdk(): NodeSDK | undefined {
  return globalThis.__pekuloOtelSdk;
}

function setSdk(value: NodeSDK | undefined): void {
  globalThis.__pekuloOtelSdk = value;
}

function diagLogLevelFromEnv(level: Env["OTEL_LOG_LEVEL"]): DiagLogLevel {
  switch (level) {
    case "error":
      return DiagLogLevel.ERROR;
    case "warn":
      return DiagLogLevel.WARN;
    case "info":
      return DiagLogLevel.INFO;
    case "debug":
      return DiagLogLevel.DEBUG;
  }
}

export async function startOtel(env: Env): Promise<void> {
  if (getSdk()) {
    // HMR re-import (`bun --hot`) — the existing process already has an SDK
    // registered globally, with its globals (trace/context/propagation) still
    // active. Re-running NodeSDK.start would throw "Attempted duplicate
    // registration of API". Silent return; the previously-started SDK keeps
    // exporting under the original env config. Restart the process to pick
    // up new env values (OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_LOG_LEVEL, etc.).
    return;
  }

  // Wire OTel's internal diag logger so SDK warnings (failed exports,
  // misconfig) surface at the requested level.
  diag.setLogger(new DiagConsoleLogger(), diagLogLevelFromEnv(env.OTEL_LOG_LEVEL));

  // OTLPTraceExporter() with no `url:` reads OTEL_EXPORTER_OTLP_ENDPOINT
  // from process.env and APPENDS the per-signal path (`/v1/traces`).
  // Passing `url: env.OTEL_EXPORTER_OTLP_ENDPOINT` directly treats it as
  // the *specific* endpoint (equivalent to OTEL_EXPORTER_OTLP_TRACES_ENDPOINT)
  // and skips the path append — POSTs hit the root which returns 404 on
  // most collectors (otel-collector-contrib, SigNoz, GlitchTip). See L10
  // in lessons.md (surfaced live on the SigNoz Dokploy deploy 2026-05-05).
  const exporter = env.OTEL_EXPORTER_OTLP_ENDPOINT
    ? new OTLPTraceExporter()
    : new ConsoleSpanExporter();

  // OTEL_LOG_LEVEL=debug flips to SimpleSpanProcessor for sync dev visibility.
  // Production paths (error/warn/info) use BatchSpanProcessor for throughput.
  // exportTimeoutMillis (2000) is kept under the otel slice of
  // SHUTDOWN_TIMEOUT_MS in lifecycle.ts (50% × 10000ms = 5000ms default) so a
  // stuck export cannot exceed the shutdown budget.
  const spanProcessor: SpanProcessor =
    env.OTEL_LOG_LEVEL === "debug"
      ? new SimpleSpanProcessor(exporter)
      : new BatchSpanProcessor(exporter, {
          maxQueueSize: 2048,
          scheduledDelayMillis: 5000,
          exportTimeoutMillis: 2000,
          maxExportBatchSize: 512,
        });

  const newSdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: env.OTEL_SERVICE_NAME,
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? "0.0.0",
    }),
    spanProcessor,
    instrumentations: [
      new UndiciInstrumentation(),
      // PrismaInstrumentation@7.8.0 dropped its `middleware` config; default
      // behaviour patches the engine RPC layer (the AC-1 path).
      new PrismaInstrumentation(),
    ],
  });

  newSdk.start();
  setSdk(newSdk);
}

export async function shutdownOtel(): Promise<void> {
  const current = getSdk();
  if (!current) return;
  await current.shutdown();
  setSdk(undefined);
}

// Per-request span store. WeakMap keyed by Elysia's incoming Request — GC
// reclaims the entry when the request is done. Module-scoped because the
// `.derive` alternative would leak per-request values into the public Elysia
// type chain, taxing every downstream module.
const requestSpans = new WeakMap<Request, Span>();

const tracerName = "pekulo-api-http";

/**
 * Custom Elysia plugin emitting a SpanKind.SERVER span per request with W3C
 * traceparent extraction and HTTP-semconv attributes. Replaces
 * `@elysiajs/opentelemetry@1.4.0` whose rootSpan-export hooks
 * (event.onStop / .onAfterResponse) do not fire in Elysia 1.4.4 + Bun.
 *
 * Lifecycle:
 *   - .onRequest — extract upstream traceparent, start SERVER span,
 *     stash in requestSpans WeakMap.
 *   - .onAfterHandle (success) — set http.route + http.status_code,
 *     end span.
 *   - error path — closed by app.ts's .onError calling endHttpServerSpan
 *     because Elysia's local .onError returning a Response suppresses
 *     plugin-level .onError hooks (story 0-7 review finding H5).
 *
 * Note on context propagation:
 *   - The SERVER span is NOT made the active context (we cannot wrap
 *     Elysia's handler invocation from a hook). Children produced by
 *     auto-instrumentation (e.g. PrismaInstrumentation) attach to the
 *     active context at their emission point, which inherits from the
 *     extracted parent traceparent. All spans share the same trace ID;
 *     making the SERVER span the active parent of the handler chain is a
 *     follow-up (story 0-7-bis).
 */
export function elysiaOtelHttpPlugin() {
  return new Elysia({ name: "pekulo-otel-http" })
    .onRequest(({ request }) => {
      const headers: Record<string, string> = {};
      request.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
      const parentCtx = propagation.extract(context.active(), headers);
      const url = new URL(request.url);
      const span = trace.getTracer(tracerName).startSpan(
        `${request.method} ${url.pathname}`,
        {
          kind: SpanKind.SERVER,
          attributes: {
            // Dual-emission: new-form (semconv ≥1.23) + old-form (≤1.22).
            // TODO 0-7-bis or 0-8 — drop the old-form pair once the GlitchTip
            // collector pipeline is on a semconv ≥1.23 schema.
            "http.request.method": request.method,
            "http.method": request.method,
            "url.path": url.pathname,
            "url.scheme": url.protocol.slice(0, -1),
            "server.address": url.host,
          },
        },
        parentCtx,
      );
      requestSpans.set(request, span);
    })
    .onAfterHandle({ as: "global" }, ({ request, route, set }) => {
      const span = requestSpans.get(request);
      if (!span) return;
      const status = typeof set.status === "number" ? set.status : 200;
      // semconv MUST: http.route is the matched route template, never the
      // raw path. Sentinel for unmatched routes (404, scanner traffic) bounds
      // trace-storage cardinality (review finding H1).
      span.setAttribute("http.route", route ?? "<unmatched>");
      span.setAttribute("http.response.status_code", status);
      span.setAttribute("http.status_code", status);
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
      requestSpans.delete(request);
    });
}

/**
 * End the SERVER span on the error path — called from app.ts's .onError
 * after the response is mapped. See plugin doc for why we cannot rely on a
 * plugin-level .onError hook.
 */
export function endHttpServerSpan(input: {
  request: Request;
  error: unknown;
  route: string | undefined;
  statusCode: number;
}): void {
  const span = requestSpans.get(input.request);
  if (!span) return;
  span.setAttribute("http.route", input.route ?? "<unmatched>");
  span.setAttribute("http.response.status_code", input.statusCode);
  span.setAttribute("http.status_code", input.statusCode);
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: input.error instanceof Error ? input.error.message : String(input.error),
  });
  if (input.error instanceof Error) {
    span.recordException(input.error);
  }
  span.end();
  requestSpans.delete(input.request);
}
