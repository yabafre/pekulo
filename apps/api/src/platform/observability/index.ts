// apps/api/src/platform/observability/index.ts
// Barrel for the observability platform module.
// See ADR-0005 + story 0-7 (OTel) and story 11-6 (GlitchTip error capture).

export { startOtel, shutdownOtel, elysiaOtelHttpPlugin, endHttpServerSpan } from "./otel-sdk";
export { captureApiError, initErrorCapture } from "./sentry";
export type { CaptureApiErrorInput } from "./sentry";
