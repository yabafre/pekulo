// apps/web/src/instrumentation.node.ts
// NodeSDK initialization for the Next.js 16 server tier.
//
// Default exporter: ConsoleSpanExporter (stdout) — V1 (a) per ADR-0005.
// Toggle: when OTEL_EXPORTER_OTLP_ENDPOINT is set, replace the console
// exporter with OTLPTraceExporter pointed at that endpoint.
//
// Auto-instrumentations enabled:
//   - @opentelemetry/instrumentation-fetch — captures W3C `traceparent`
//     propagation on fetch() calls (apps/web → apps/api). Required by
//     AC-1 so the api-side server span chains under the web-side client span.
//   - @opentelemetry/instrumentation-undici — same role as above, kept
//     for forward-compat (Next.js may swap fetch impl in a minor bump).

import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ConsoleSpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-node";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
const exporter = otlpEndpoint
  ? new OTLPTraceExporter({ url: otlpEndpoint })
  : new ConsoleSpanExporter();

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? "pekulo-web",
    [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? "0.1.0",
  }),
  spanProcessor: new SimpleSpanProcessor(exporter),
  instrumentations: [
    new FetchInstrumentation({
      // Propagate traceparent on every outgoing fetch (apps/web → apps/api).
      propagateTraceHeaderCorsUrls: [/.*/],
      clearTimingResources: true,
    }),
    new UndiciInstrumentation(),
  ],
});

sdk.start();

// Note: no shutdown hook here — Next.js process lifecycle owns the SDK.
// SimpleSpanProcessor flushes synchronously on every span end, so even an
// abrupt SIGTERM (Vercel deploy rollover) does not lose the in-flight span.
