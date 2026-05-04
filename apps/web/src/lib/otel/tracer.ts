// apps/web/src/lib/otel/tracer.ts
// Tracer accessor for app-code custom spans.
//
// Usage (downstream stories — NOT modified in 0-7):
//
//   import { getTracer } from "@/lib/otel/tracer";
//   import { trace, SpanStatusCode } from "@opentelemetry/api";
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

import "server-only";

import { trace, type Tracer } from "@opentelemetry/api";

const TRACER_NAME = "pekulo-web";

export function getTracer(): Tracer {
  return trace.getTracer(TRACER_NAME);
}
