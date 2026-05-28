// apps/api/src/platform/observability/otel-sdk.test.ts
// Tests for story 0-7 SDK init module.
//
// Coverage:
//   - startOtel boots without throwing on a valid Env
//   - startOtel is HMR-safe: a second call without shutdown silently no-ops
//     (was a hard throw before L12 — see lessons.md). Shielded from
//     `bun --hot` re-imports re-running NodeSDK.start against an already-
//     registered process global.
//   - shutdownOtel is idempotent
//   - loadEnv rejects malformed OTEL_EXPORTER_OTLP_ENDPOINT (AC-4)
//   - elysiaOtelHttpPlugin emits a SpanKind.SERVER span with HTTP semconv
//     attrs and inherits the upstream traceparent (AC-1)
//   - endHttpServerSpan closes the span on the error path with semconv
//     status + recordException
//   - BatchSpanProcessor.forceFlush drains pending spans (AC-5)

import { afterEach, describe, expect, test } from "bun:test";
import { context, propagation, SpanKind, trace } from "@opentelemetry/api";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { BatchSpanProcessor, InMemorySpanExporter } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { Elysia } from "elysia";

import { ConfigError, loadEnv } from "../../config/env";
import type { Env } from "../../config/env";
import { elysiaOtelHttpPlugin, endHttpServerSpan, shutdownOtel, startOtel } from "./otel-sdk";

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: "test",
    PORT: 3001,
    HOST: "127.0.0.1",
    SHUTDOWN_TIMEOUT_MS: 10_000,
    DATABASE_URL: "postgres://stub:stub@127.0.0.1:5432/stub",
    SUPABASE_JWT_SECRET: "x".repeat(64),
    SUPABASE_URL: "http://127.0.0.1:54321",
    OTEL_SERVICE_NAME: "pekulo-api-test",
    OTEL_EXPORTER_OTLP_ENDPOINT: undefined,
    OTEL_LOG_LEVEL: "error",
    // Bridge defaults match envSchema (story 5-6, post-review aped-review).
    // The three core keys are required at boot — test fixtures populate them
    // with placeholder values. PREVIOUS_SECRET stays undefined (24h rotation
    // overlap is optional).
    BRIDGE_CLIENT_ID: "test-bridge-client-id",
    BRIDGE_CLIENT_SECRET: "test-bridge-client-secret",
    BRIDGE_WEBHOOK_SIGNING_SECRET: "test-bridge-webhook-secret",
    BRIDGE_WEBHOOK_SIGNING_SECRET_PREVIOUS: undefined,
    BRIDGE_API_BASE: "https://api.bridgeapi.io",
    BRIDGE_API_VERSION: "2025-01-15",
    BRIDGE_REFRESH_CRON_HOURS: 6,
    ...overrides,
  };
}

// NodeSDK.shutdown() does NOT unregister from @opentelemetry/api globals; we
// must clear them explicitly between tests so each describe block starts with
// a clean slate (otherwise NodeTracerProvider.register() throws on duplicate
// registration).
function clearOtelGlobals(): void {
  trace.disable();
  context.disable();
  propagation.disable();
}

describe("startOtel / shutdownOtel", () => {
  afterEach(async () => {
    await shutdownOtel();
    clearOtelGlobals();
  });

  test("boots and shuts down on a valid Env", async () => {
    await startOtel(makeEnv());
    const tracer = trace.getTracer("pekulo-api-test");
    const span = tracer.startSpan("smoke");
    expect(span.spanContext().traceId).toMatch(/^[0-9a-f]{32}$/);
    span.end();
    await shutdownOtel();
  });

  test("startOtel is HMR-safe — second call without shutdown silently no-ops (L12)", async () => {
    // Reproduces the `bun --hot` HMR scenario: when the api source changes,
    // bun re-imports main.ts which re-calls startOtel. The OTel global
    // registrations (trace/context/propagation) survive the module reload, so
    // re-running NodeSDK.start would throw "Attempted duplicate registration
    // of API". The fix: guard on globalThis.__pekuloOtelSdk and silently
    // return on the second call.
    await startOtel(makeEnv());
    await expect(startOtel(makeEnv())).resolves.toBeUndefined();
    // The previously-started SDK keeps working — verify we can still get a
    // tracer with a valid trace id format.
    const tracer = trace.getTracer("pekulo-api-test");
    const span = tracer.startSpan("post-hmr");
    expect(span.spanContext().traceId).toMatch(/^[0-9a-f]{32}$/);
    span.end();
  });

  test("shutdownOtel is safe to call before startOtel", async () => {
    await shutdownOtel();
  });
});

describe("loadEnv with malformed OTEL_EXPORTER_OTLP_ENDPOINT (AC-4)", () => {
  // AC-4: "Given OTEL_EXPORTER_OTLP_ENDPOINT is set to a value that does not
  // parse as a URL (e.g. `not-a-url`), When the api process boots, Then the
  // process exits within 1 second with a non-zero exit code, prints a
  // structured error message naming the offending env var, AND emits zero
  // span lines on stdout before exit."
  //
  // The Zod `.url()` constraint at config/env.ts produces ConfigError with
  // OTEL_EXPORTER_OTLP_ENDPOINT in fieldErrors. main.ts's catch-block then
  // prints the structured error and process.exit(1)s — all BEFORE
  // startOtel() is reached, so zero spans can be emitted.

  const validBase: Record<string, string> = {
    NODE_ENV: "test",
    PORT: "3001",
    HOST: "127.0.0.1",
    SHUTDOWN_TIMEOUT_MS: "10000",
    DATABASE_URL: "postgres://stub:stub@127.0.0.1:5432/stub",
    SUPABASE_JWT_SECRET: "x".repeat(64),
    SUPABASE_URL: "http://127.0.0.1:54321",
    OTEL_SERVICE_NAME: "pekulo-api-test",
    OTEL_LOG_LEVEL: "error",
    // Story 5-6 post-review aped-review: BRIDGE_* triple now required at boot.
    BRIDGE_CLIENT_ID: "test-bridge-client-id",
    BRIDGE_CLIENT_SECRET: "test-bridge-client-secret",
    BRIDGE_WEBHOOK_SIGNING_SECRET: "test-bridge-webhook-secret",
  };

  test("rejects a non-URL string with ConfigError naming the offending field", () => {
    expect(() => loadEnv({ ...validBase, OTEL_EXPORTER_OTLP_ENDPOINT: "not-a-url" })).toThrow(
      ConfigError,
    );

    try {
      loadEnv({ ...validBase, OTEL_EXPORTER_OTLP_ENDPOINT: "not-a-url" });
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      const fieldErrors = (err as ConfigError).fieldErrors;
      expect(fieldErrors.OTEL_EXPORTER_OTLP_ENDPOINT).toBeDefined();
      expect(fieldErrors.OTEL_EXPORTER_OTLP_ENDPOINT?.length ?? 0).toBeGreaterThan(0);
    }
  });

  test("accepts an absent OTEL_EXPORTER_OTLP_ENDPOINT (optional field)", () => {
    expect(() => loadEnv(validBase)).not.toThrow();
  });

  test("accepts a well-formed http URL", () => {
    expect(() =>
      loadEnv({ ...validBase, OTEL_EXPORTER_OTLP_ENDPOINT: "http://127.0.0.1:4318/v1/traces" }),
    ).not.toThrow();
  });
});

describe("elysiaOtelHttpPlugin (AC-1)", () => {
  // AC-1 verbatim: "the api-tier stderr contains both an HTTP-server span
  // (with the matched route as its `http.route` attribute) and a database
  // span (...) AND the api-tier HTTP-server span carries a non-empty
  // `parentSpanId` (proving the trace was inherited from upstream rather
  // than started fresh on the api side)."

  test("emits a SpanKind.SERVER span with http.route + http.method + http.status_code on success", async () => {
    const exporter = new InMemorySpanExporter();
    const provider = new NodeTracerProvider({
      spanProcessors: [new BatchSpanProcessor(exporter)],
    });
    provider.register();
    try {
      const app = new Elysia()
        .use(elysiaOtelHttpPlugin())
        .get("/quote/:symbol", ({ params }) => ({ symbol: params.symbol }));

      const req = new Request("http://localhost/quote/AAPL");
      await app.handle(req);

      await provider.forceFlush();
      const spans = exporter.getFinishedSpans();
      const serverSpan = spans.find((s) => s.kind === SpanKind.SERVER);
      expect(serverSpan).toBeDefined();
      expect(serverSpan?.kind).toBe(SpanKind.SERVER);
      expect(serverSpan?.name).toBe("GET /quote/AAPL");
      expect(serverSpan?.attributes["http.method"]).toBe("GET");
      expect(serverSpan?.attributes["http.request.method"]).toBe("GET");
      expect(serverSpan?.attributes["http.route"]).toBe("/quote/:symbol");
      expect(serverSpan?.attributes["http.status_code"]).toBe(200);
      expect(serverSpan?.attributes["http.response.status_code"]).toBe(200);
      expect(serverSpan?.attributes["url.path"]).toBe("/quote/AAPL");
      expect(serverSpan?.attributes["url.scheme"]).toBe("http");
    } finally {
      await provider.shutdown();
      clearOtelGlobals();
    }
  });

  // M7 — cross-runtime nesting / W3C traceparent propagation regression
  // guard. With @opentelemetry/core wired (W3CTraceContextPropagator), we
  // can now assert that a synthetic upstream `traceparent` header is
  // extracted and the SERVER span chains under it (non-empty parentSpanId,
  // shared traceId).
  test("inherits the upstream W3C traceparent (non-empty parentSpanId, same traceId)", async () => {
    const exporter = new InMemorySpanExporter();
    const provider = new NodeTracerProvider({
      spanProcessors: [new BatchSpanProcessor(exporter)],
    });
    provider.register({ propagator: new W3CTraceContextPropagator() });
    try {
      const app = new Elysia().use(elysiaOtelHttpPlugin()).get("/ready", () => ({ ok: true }));

      const upstreamTraceId = "4bf92f3577b34da6a3ce929d0e0e4736";
      const upstreamSpanId = "00f067aa0ba902b7";
      const traceparent = `00-${upstreamTraceId}-${upstreamSpanId}-01`;

      const req = new Request("http://localhost/ready", {
        headers: { traceparent },
      });
      await app.handle(req);

      await provider.forceFlush();
      const spans = exporter.getFinishedSpans();
      const serverSpan = spans.find((s) => s.kind === SpanKind.SERVER);
      expect(serverSpan).toBeDefined();
      // Same traceId as upstream → propagation worked
      expect(serverSpan?.spanContext().traceId).toBe(upstreamTraceId);
      // Non-empty parentSpanId, equal to the upstream span id → AC-1 strict
      expect(serverSpan?.parentSpanContext?.spanId).toBe(upstreamSpanId);
    } finally {
      await provider.shutdown();
      clearOtelGlobals();
    }
  });

  test("uses '<unmatched>' sentinel for routes that do not match (cardinality bound — H1)", async () => {
    const exporter = new InMemorySpanExporter();
    const provider = new NodeTracerProvider({
      spanProcessors: [new BatchSpanProcessor(exporter)],
    });
    provider.register();
    try {
      // App with .onError that simulates the production app-level handler
      // (returns a Response, suppressing plugin .onError) — and ends the
      // span via endHttpServerSpan (story 0-7 review finding H5 path).
      const app = new Elysia()
        .use(elysiaOtelHttpPlugin())
        .onError(({ error, set, request, route }) => {
          set.status = 404;
          endHttpServerSpan({
            request,
            error,
            route,
            statusCode: 404,
          });
          return { error: "not found" };
        });

      const req = new Request("http://localhost/admin/.env");
      await app.handle(req);

      await provider.forceFlush();
      const spans = exporter.getFinishedSpans();
      const serverSpan = spans.find((s) => s.kind === SpanKind.SERVER);
      expect(serverSpan).toBeDefined();
      // Bounded cardinality: the literal "<unmatched>" sentinel rather than
      // the raw `/admin/.env` path. Scanner traffic with arbitrary suffixes
      // collapses to a single http.route value in the trace store index.
      expect(serverSpan?.attributes["http.route"]).toBe("<unmatched>");
      expect(serverSpan?.attributes["http.status_code"]).toBe(404);
      expect(serverSpan?.attributes["http.response.status_code"]).toBe(404);
    } finally {
      await provider.shutdown();
      clearOtelGlobals();
    }
  });
});

describe("endHttpServerSpan (error path — H5 workaround + M4 status mapping)", () => {
  test("closes the SERVER span with ERROR status + recordException + status_code === 500", async () => {
    const exporter = new InMemorySpanExporter();
    const provider = new NodeTracerProvider({
      spanProcessors: [new BatchSpanProcessor(exporter)],
    });
    provider.register();
    try {
      const app = new Elysia()
        .use(elysiaOtelHttpPlugin())
        .onError(({ error, set, request, route }) => {
          set.status = 500;
          endHttpServerSpan({
            request,
            error,
            route,
            statusCode: 500,
          });
          return { error: "internal" };
        })
        .get("/boom/:id", () => {
          throw new Error("synthetic-failure");
        });

      const req = new Request("http://localhost/boom/42");
      await app.handle(req);

      await provider.forceFlush();
      const spans = exporter.getFinishedSpans();
      const serverSpan = spans.find((s) => s.kind === SpanKind.SERVER);
      expect(serverSpan).toBeDefined();
      expect(serverSpan?.attributes["http.route"]).toBe("/boom/:id");
      expect(serverSpan?.attributes["http.status_code"]).toBe(500);
      expect(serverSpan?.attributes["http.response.status_code"]).toBe(500);
      expect(serverSpan?.status.code).toBe(2 /* ERROR */);
      expect(serverSpan?.events.some((e) => e.name === "exception")).toBe(true);
    } finally {
      await provider.shutdown();
      clearOtelGlobals();
    }
  });

  test("captures the exact mapped status code (e.g. 422 validation) — M4 strict", async () => {
    // M4 — Diego flagged that the plugin's previous .onError snapshot of
    // set.status could capture the pre-mapping value. With the new design
    // (app-level .onError calls endHttpServerSpan with the mapped status),
    // the captured status_code reflects post-mapping. This test pins that
    // contract: when the .onError maps a validation error to 422, the
    // SERVER span MUST carry http.status_code === 422 (not the default 500).
    const exporter = new InMemorySpanExporter();
    const provider = new NodeTracerProvider({
      spanProcessors: [new BatchSpanProcessor(exporter)],
    });
    provider.register();
    try {
      const app = new Elysia()
        .use(elysiaOtelHttpPlugin())
        .onError(({ error, set, request, route }) => {
          // Simulate a validation-error → 422 mapping (the production app's
          // mapErrorToOrpcResponse does similar shape-dependent mapping).
          set.status = 422;
          endHttpServerSpan({
            request,
            error,
            route,
            statusCode: 422,
          });
          return { error: "validation_failed" };
        })
        .get("/validate", () => {
          throw new Error("synthetic-validation-failure");
        });

      const req = new Request("http://localhost/validate");
      await app.handle(req);

      await provider.forceFlush();
      const spans = exporter.getFinishedSpans();
      const serverSpan = spans.find((s) => s.kind === SpanKind.SERVER);
      expect(serverSpan).toBeDefined();
      expect(serverSpan?.attributes["http.route"]).toBe("/validate");
      // The exact mapped value, not a default 500 fallback.
      expect(serverSpan?.attributes["http.status_code"]).toBe(422);
      expect(serverSpan?.attributes["http.response.status_code"]).toBe(422);
      expect(serverSpan?.status.code).toBe(2 /* ERROR */);
    } finally {
      await provider.shutdown();
      clearOtelGlobals();
    }
  });
});

describe("BatchSpanProcessor flush via shutdownOtel (AC-5)", () => {
  afterEach(async () => {
    await shutdownOtel();
    clearOtelGlobals();
  });

  test("forceFlush drains pending spans (BatchSpanProcessor → InMemorySpanExporter)", async () => {
    // BatchSpanProcessor.shutdown() calls forceFlush() internally; this test
    // exercises the AC-5-load-bearing primitive. Note: InMemorySpanExporter
    // .shutdown() resets _finishedSpans to [] (a feature mirroring a real
    // exporter's "stopped" state) — assertions go BEFORE shutdown.
    const exporter = new InMemorySpanExporter();
    const provider = new NodeTracerProvider({
      spanProcessors: [new BatchSpanProcessor(exporter)],
    });
    const tracer = provider.getTracer("pekulo-api-flush-test");
    const span = tracer.startSpan("flushable");
    span.end();
    await provider.forceFlush();
    const finished = exporter.getFinishedSpans();
    expect(finished.length).toBe(1);
    expect(finished[0]?.name).toBe("flushable");
    await provider.shutdown();
  });
});
