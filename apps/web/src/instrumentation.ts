// apps/web/src/instrumentation.ts
// Next.js 16 instrumentation hook — invoked once per server runtime instance
// (Node and Edge each call register() in their own runtime).
//
// Two responsibilities, in order:
//   1. GlitchTip error capture (story 11-6) — init is a no-op without
//      GLITCHTIP_DSN, and Sentry is told NOT to create an OTel provider.
//   2. OTel NodeSDK (story 0-7) — traces only, opt-in in dev.
//
// onRequestError is exported for Next's server-error hook. No edge route
// exists at V1 (a); if one lands, it must get its own Sentry init branch
// (the SDK no-ops without a client, so this stays safe meanwhile).

import { captureRequestError, initWebErrorCapture } from "./lib/observability/sentry";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  initWebErrorCapture();

  // Dev gate (L11). Without this, BatchSpanProcessor + FetchInstrumentation +
  // require-in-the-middle's dynamic-require patching compound with Next 16
  // Turbopack HMR + RSC's internal fetches (the framework fires dozens per
  // second) and the ConsoleSpanExporter pegs the CPU — fan-noise loud on
  // Apple Silicon. In dev, OTel is opt-in: load only when an OTLP endpoint
  // is configured (the developer is actively shipping spans somewhere).
  const isDev = process.env.NODE_ENV === "development";
  const hasOtlp = !!process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  if (isDev && !hasOtlp) return;

  await import("./instrumentation.node");
}

export function onRequestError(
  error: unknown,
  request: { path?: string; method?: string },
  context: { routerKind?: string; routePath?: string; routeType?: string },
): void {
  captureRequestError(error, request, context);
}
