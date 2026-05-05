// apps/web/src/instrumentation.node.ts
// NodeSDK initialization for the Next.js 16 server tier.
//
// Default exporter: ConsoleSpanExporter (stdout) — V1 (a) per ADR-0005.
// Toggle: when OTEL_EXPORTER_OTLP_ENDPOINT is set, replace the console
// exporter with OTLPTraceExporter pointed at that endpoint. The endpoint
// URL is validated at boot — a malformed value fails loud (not silent at
// runtime), parity with apps/api's Zod gate (review M3).
//
// Span processor: BatchSpanProcessor for production-grade throughput.
// SimpleSpanProcessor was previously used here under the (incorrect) claim
// that it survives abrupt SIGTERM by flushing synchronously; in fact
// SimpleSpanProcessor.onEnd() does NOT await the export Promise (see
// @opentelemetry/sdk-trace-base/SimpleSpanProcessor#onEnd), so a process.exit
// after a span.end() can still lose in-flight HTTP/OTLP exports. The
// shutdown hook below addresses durability properly. Story 0-7 review H2.
//
// Auto-instrumentation: ONE choice — `@opentelemetry/instrumentation-fetch`.
// Lucas's review noted that Node 18+ global fetch is undici-backed, so
// `instrumentation-undici` would also work; we picked Fetch because it
// exposes the `propagateTraceHeaderCorsUrls` allowlist API, which we need
// to enforce H3 (no wildcard `traceparent` propagation to third parties).
// Undici does not expose an equivalent allowlist surface in 0.13.0, so
// migrating away from Fetch would regress H3. Story 0-7 review M2.
// Note (M2 follow-up): if Next.js's own AppRender.fetch span ends up
// duplicating ours under prod load, set `NEXT_OTEL_FETCH_DISABLED=1` to
// silence Next's emitted span.
//
// traceparent propagation (review H3):
//   By default, OUTBOUND fetch() calls only carry `traceparent` for hosts
//   matching the allowlist below. To extend the allowlist (e.g. add a new
//   internal service), set OTEL_PROPAGATE_HOSTS to a comma-separated list
//   of host substrings or regex sources. Wildcard propagation leaks trace
//   IDs to third parties (Supabase, Yahoo, Anthropic, …) — never use `.*`
//   in production.

import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

// M3 — env validation parity with apps/api's Zod schema. Fail loud at boot
// so a malformed OTEL_EXPORTER_OTLP_ENDPOINT (or OTEL_PROPAGATE_HOSTS regex)
// does not silently fall back at runtime.
function validateUrlOrThrow(name: string, value: string): string {
  try {
    new URL(value);
    return value;
  } catch {
    throw new Error(`[web] invalid ${name}: ${JSON.stringify(value)} is not a parseable URL`);
  }
}

const otlpRaw = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
const otlpEndpoint = otlpRaw
  ? validateUrlOrThrow("OTEL_EXPORTER_OTLP_ENDPOINT", otlpRaw)
  : undefined;

const exporter = otlpEndpoint
  ? new OTLPTraceExporter({ url: otlpEndpoint })
  : new ConsoleSpanExporter();

// Build the propagation allowlist. Default = local dev hosts + *.pekulo.*.
// Override with OTEL_PROPAGATE_HOSTS=comma,separated,patterns. Each token
// is wrapped as a substring match unless it parses as a valid regex.
function buildPropagationAllowlist(): RegExp[] {
  const defaults = [
    /^https?:\/\/localhost(:\d+)?(\/|$)/,
    /^https?:\/\/127\.0\.0\.1(:\d+)?(\/|$)/,
    /^https?:\/\/[^/]+\.pekulo\.[a-z]+(:\d+)?(\/|$)/,
  ];
  const env = process.env.OTEL_PROPAGATE_HOSTS?.trim();
  if (!env) return defaults;
  const extras = env
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((token) => {
      try {
        return new RegExp(token);
      } catch {
        return new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      }
    });
  return [...defaults, ...extras];
}

const propagationAllowlist = buildPropagationAllowlist();

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? "pekulo-web",
    [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? "0.1.0",
  }),
  spanProcessor: new BatchSpanProcessor(exporter, {
    maxQueueSize: 2048,
    scheduledDelayMillis: 5000,
    exportTimeoutMillis: 2000,
    maxExportBatchSize: 512,
  }),
  instrumentations: [
    new FetchInstrumentation({
      // Allowlist (NOT wildcard) — see H3 above.
      propagateTraceHeaderCorsUrls: propagationAllowlist,
      clearTimingResources: true,
    }),
  ],
});

sdk.start();

// Shutdown hook (review H2): flush BatchSpanProcessor on SIGTERM/SIGINT so
// in-flight exports are not lost on Vercel deploy rollover or local Ctrl-C.
const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  console.log(`[web] received ${signal}, flushing OTel SDK`);
  try {
    await sdk.shutdown();
  } catch (err) {
    console.error("[web] otel.shutdown failed:", err);
  }
};
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
