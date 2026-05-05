// apps/api/src/platform/observability/index.ts
// Barrel for the observability platform module.
// See ADR-0005 + story 0-7.

export { startOtel, shutdownOtel, elysiaOtelHttpPlugin, endHttpServerSpan } from "./otel-sdk";
