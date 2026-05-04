// Boot ordering is load-bearing for AC-1 of story 0-7:
//
//   1. loadEnv() — fail fast on bad config (incl. malformed
//      OTEL_EXPORTER_OTLP_ENDPOINT — AC-4).
//   2. await startOtel(env) — the SDK MUST patch Elysia + Prisma BEFORE
//      they load. Static imports are hoisted by ES modules and run before
//      any top-level await; the dynamic import("./app") below sidesteps
//      this so app.ts (which transitively imports Elysia + Prisma) loads
//      AFTER startOtel completes.
//   3. (await import("./app")).startServer() — Elysia + Prisma are now
//      auto-instrumented; the rest of the boot proceeds as before.

import { ConfigError, loadEnv } from "./config/env";
import { startOtel } from "./platform/observability";

try {
  const env = loadEnv();
  await startOtel(env);
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
