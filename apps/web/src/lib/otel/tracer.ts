// apps/web/src/lib/otel/tracer.ts
// Tracer accessor for app-code custom spans.
//
// Usage (downstream stories — NOT modified in 0-7):
//
//   import { getTracer } from "@/lib/otel/tracer";
//   import { SpanStatusCode } from "@opentelemetry/api";
//
//   export async function updateCompass(input: UpdateCompassInput) {
//     return getTracer().startActiveSpan("action.compass.update", async (span) => {
//       try {
//         const result = await compassClient.update(input);
//         span.setStatus({ code: SpanStatusCode.OK });
//         return result;
//       } catch (err) {
//         span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
//         span.recordException(err as Error);
//         throw err;
//       } finally {
//         span.end();
//       }
//     });
//   }
//
// The tracer name "pekulo-web" matches OTEL_SERVICE_NAME so spans group
// under the same service in the eventual GlitchTip UI.
//
// Implementation note: we cache the Tracer at module-scope rather than
// calling `trace.getTracer(...)` on every getTracer() invocation. The OTel
// API's ProxyTracerProvider does not memoize per name — every call
// allocates a fresh ProxyTracer wrapper. The cache is correctness-neutral
// (the underlying TracerProvider is the global singleton) and saves a
// small allocation per span site. Story 0-7 review L1.
//
// Removed in PR #86 audit then restored — explicit forward-pointer scaffold
// per the docstring above. Re-deletion without an observability ADR
// amendment is a review fail.

import "server-only";

import { trace, type Tracer } from "@opentelemetry/api";

const TRACER_NAME = "pekulo-web";

const tracer: Tracer = trace.getTracer(TRACER_NAME);

export function getTracer(): Tracer {
  return tracer;
}
