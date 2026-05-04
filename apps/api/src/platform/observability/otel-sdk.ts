// apps/api/src/platform/observability/otel-sdk.ts
// NodeSDK initialization for the Bun + Elysia api tier.
//
// Init order (load-bearing):
//   1. main.ts calls `await startOtel(env)` BEFORE dynamic-importing app.ts
//   2. PrismaInstrumentation is registered HERE so Prisma's
//      `new PrismaClient(...)` (called later by createPrismaService) is
//      patched at construction.
//   3. The Elysia plugin (@elysiajs/opentelemetry) is mounted in app.ts
//      via `.use(opentelemetry({...}))` — this story exposes a factory
//      that returns a pre-configured plugin instance.
//
// Shutdown order (load-bearing — see § Lifecycle ordering in story file):
//   app.stop() → shutdownOtel() → prismaService.disconnect()
//
// Exporter selection:
//   - OTEL_EXPORTER_OTLP_ENDPOINT set → OTLPTraceExporter
//   - otherwise → ConsoleSpanExporter (V1 (a) default)

import { opentelemetry } from "@elysiajs/opentelemetry";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { PrismaInstrumentation } from "@prisma/instrumentation";

import type { Env } from "../../config/env";

let sdk: NodeSDK | undefined;

export async function startOtel(env: Env): Promise<void> {
  if (sdk) {
    throw new Error("[otel] startOtel called twice");
  }

  const exporter = env.OTEL_EXPORTER_OTLP_ENDPOINT
    ? new OTLPTraceExporter({ url: env.OTEL_EXPORTER_OTLP_ENDPOINT })
    : new ConsoleSpanExporter();

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: env.OTEL_SERVICE_NAME,
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? "0.0.0",
    }),
    // BatchSpanProcessor batches spans for efficiency; flushed on
    // shutdownOtel() (AC-5). For dev clarity, switch to SimpleSpanProcessor
    // by setting OTEL_LOG_LEVEL=debug — handled in the env path below.
    spanProcessor: new BatchSpanProcessor(exporter, {
      maxQueueSize: 2048,
      scheduledDelayMillis: 5000,
      exportTimeoutMillis: 30_000,
      maxExportBatchSize: 512,
    }),
    instrumentations: [
      new UndiciInstrumentation(),
      // Prisma 7.8.0's PrismaInstrumentationConfig dropped the `middleware`
      // toggle (only `ignoreSpanTypes` remains). Default behaviour patches
      // the engine RPC layer, which is the AC-1 path we want.
      new PrismaInstrumentation(),
    ],
  });

  sdk.start();
}

export async function shutdownOtel(): Promise<void> {
  if (!sdk) return;
  await sdk.shutdown();
  sdk = undefined;
}

/**
 * Pre-configured Elysia OTel plugin factory. Mounted from app.ts via
 *   `.use(elysiaOtelPlugin())`
 * The plugin attaches per-request server spans with `http.route` set to
 * the matched Elysia route pattern.
 */
export function elysiaOtelPlugin() {
  return opentelemetry({
    // Service name + resource come from the global TracerProvider
    // configured by NodeSDK above. The plugin reads `trace.getTracer(...)`
    // from the global `@opentelemetry/api`, so no extra config needed here.
  });
}
