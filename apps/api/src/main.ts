// Boot ordering is load-bearing for AC-1 of story 0-7, extended by 11-6:
//
//   1. loadEnv() — fail fast on bad config (incl. malformed
//      OTEL_EXPORTER_OTLP_ENDPOINT — AC-4).
//   2. await startOtel(env) — the SDK MUST patch Elysia + Prisma BEFORE
//      they load. Static imports are hoisted by ES modules and run before
//      any top-level await; the dynamic import("./app") below sidesteps
//      this so app.ts (which transitively imports Elysia + Prisma) loads
//      AFTER startOtel completes.
//   3. initErrorCapture(env) — installs Sentry's global handlers and the
//      beforeSend scrubber. Safe after startOtel: Sentry is told NOT to
//      create its own OTel provider (enableOpenTelemetrySetup: false), so
//      the NodeSDK remains the single trace authority. No-op when
//      GLITCHTIP_DSN is unset.
//   4. (await import("./app")).startServer() — Elysia + Prisma are now
//      instrumented by OTel and Sentry's error handlers are live.

import { ConfigError, loadEnv } from "./config/env";
import { initErrorCapture, startOtel } from "./platform/observability";

try {
  const env = loadEnv();
  await startOtel(env);
  initErrorCapture(env);
  const { startServer } = await import("./app");
  await startServer();
} catch (err) {
  if (err instanceof ConfigError) {
    console.error("[api] invalid env:", JSON.stringify(err.fieldErrors, null, 2));
    process.exit(1);
  }
  console.error("[api] startup failed:", err);
  process.exit(1);
}
