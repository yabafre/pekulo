// apps/web/src/instrumentation.node.ts
// NodeSDK initialization for the Next.js 16 server tier.
//
// Default exporter: ConsoleSpanExporter (stdout) — V1 (a) per ADR-0005.
// Toggle: when OTEL_EXPORTER_OTLP_ENDPOINT is set, replace the console
// exporter with OTLPTraceExporter pointed at that endpoint.
//
// Span processor: BatchSpanProcessor for production-grade throughput.
// SimpleSpanProcessor was previously used here under the (incorrect) claim
// that it survives abrupt SIGTERM by flushing synchronously; in fact
// SimpleSpanProcessor.onEnd() does NOT await the export Promise (see
// @opentelemetry/sdk-trace-base/SimpleSpanProcessor#onEnd), so a process.exit
// after a span.end() can still lose in-flight HTTP/OTLP exports. The
// shutdown hook below addresses durability properly. Story 0-7 review H2.
//
// Auto-instrumentations enabled:
//   - @opentelemetry/instrumentation-fetch — captures W3C `traceparent`
//     propagation on fetch() calls (apps/web → apps/api).
//   - @opentelemetry/instrumentation-undici — instruments Node's undici
//     dispatcher (Node global fetch is undici-backed).
//
// Note (review M2, deferred to story 0-7-bis): Both Fetch and Undici
// instrumentations are kept for forward-compat during V1 (a). Next.js 16
// also emits its own AppRender.fetch span — under load this can produce
// triple span on a single outgoing request. Future work: pick exactly one
// of (Fetch | Undici), and consider NEXT_OTEL_FETCH_DISABLED=1 to silence
// Next.js's own span. Decision deferred until prod traffic patterns are
// observable.
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
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
const exporter = otlpEndpoint
  ? new OTLPTraceExporter({ url: otlpEndpoint })
  : new ConsoleSpanExporter();

// Build the propagation allowlist. Default = local dev hosts only. Override
// with OTEL_PROPAGATE_HOSTS=comma,separated,patterns. Each token is wrapped
// as a substring match anchored on host start unless it contains regex
// metacharacters.
function buildPropagationAllowlist(): RegExp[] {
  const defaults = [
    /^https?:\/\/localhost(:\d+)?(\/|$)/,
    /^https?:\/\/127\.0\.0\.1(:\d+)?(\/|$)/,
    // Internal Pekulo services (apps/api, apps/prices) under any *.pekulo.*
    // domain. Tighten in production once concrete hostnames are pinned.
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
        // Treat as substring match on URL.
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
    new UndiciInstrumentation(),
  ],
});

sdk.start();

// Shutdown hook (review H2): flush BatchSpanProcessor on SIGTERM/SIGINT so
// in-flight exports are not lost on Vercel deploy rollover or local Ctrl-C.
// Listeners are `once` to avoid duplicate flush on a SIGTERM/SIGINT pair.
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
