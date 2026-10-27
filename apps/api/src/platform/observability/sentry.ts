// apps/api/src/platform/observability/sentry.ts
// GlitchTip error capture for the api tier (NFR-27, story 11-6).
//
// GlitchTip 6.2 is Sentry-compatible for *errors* but has no raw OTLP trace
// receiver — an OTLPTraceExporter pointed at it delivers nothing and fails
// silently. So the split is: OTel stays the trace spine (otel-sdk.ts), the
// Sentry SDK ships error events. `enableOpenTelemetrySetup: false` is
// load-bearing: @sentry/nextjs defaults it to true and would register a
// second tracer provider on top of our NodeSDK.
//
// Capture policy: 5xx only, and typed PekuloErrors are skipped entirely
// except ACCOUNT_PARTIALLY_ERASED. A typed 4xx is a contract outcome, not an
// incident; a typed 5xx (e.g. BANK_PROVIDER_UNAVAILABLE) already has a
// structured log line and an OTel span, and paging on it would train the
// controller to ignore GlitchTip. ACCOUNT_PARTIALLY_ERASED is the exception
// because it needs a human to finish a GDPR erasure by hand.

import * as Sentry from "@sentry/bun";

import { scrubSentryEvent } from "@pekulo/observability";
import { isPekuloError } from "../../common/errors";
import type { Env } from "../../config/env";

export interface CaptureApiErrorInput {
  error: unknown;
  request: Request;
  route: string | undefined;
  statusCode: number;
  requestId: string;
}

export interface ApiErrorContext {
  tags: Record<string, string>;
  contexts: Record<string, Record<string, unknown>>;
  fingerprint: string[];
}

export type CaptureExceptionFn = (error: unknown, context: ApiErrorContext) => unknown;

export interface ErrorCaptureOptions {
  dsn: string;
  environment: Env["NODE_ENV"];
  release: string;
  sendDefaultPii: false;
  enableOpenTelemetrySetup: false;
  beforeSend(event: unknown): unknown;
}

export function buildErrorCaptureOptions(
  env: Pick<Env, "GLITCHTIP_DSN" | "NODE_ENV">,
): ErrorCaptureOptions | undefined {
  const dsn = env.GLITCHTIP_DSN?.trim();
  if (!dsn) return undefined;
  return {
    dsn,
    environment: env.NODE_ENV,
    release: process.env.npm_package_version ?? "0.0.0",
    sendDefaultPii: false,
    enableOpenTelemetrySetup: false,
    beforeSend(event: unknown) {
      return scrubSentryEvent(event);
    },
  };
}

export function initErrorCapture(
  env: Pick<Env, "GLITCHTIP_DSN" | "NODE_ENV">,
  init: (options: ErrorCaptureOptions) => unknown = Sentry.init as unknown as (
    options: ErrorCaptureOptions,
  ) => unknown,
): boolean {
  const options = buildErrorCaptureOptions(env);
  if (!options) return false;
  init(options);
  return true;
}

function safePathname(request: Request): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "<unparseable-url>";
  }
}

export function createCaptureApiError(
  captureException: CaptureExceptionFn,
  isEnabled: () => boolean,
): (input: CaptureApiErrorInput) => void {
  return (input) => {
    if (!isEnabled()) return;
    if (input.statusCode < 500) return;
    if (isPekuloError(input.error) && input.error.code !== "ACCOUNT_PARTIALLY_ERASED") return;

    const route = input.route?.trim() || "<unmatched>";
    const path = safePathname(input.request);

    try {
      captureException(input.error, {
        tags: {
          route,
          status_code: String(input.statusCode),
          request_id: input.requestId,
          method: input.request.method,
        },
        contexts: {
          pekulo: {
            route,
            statusCode: input.statusCode,
            requestId: input.requestId,
            method: input.request.method,
            path,
          },
        },
        fingerprint: ["{{ default }}", route],
      });
    } catch (captureErr) {
      console.error("[observability] Failed to capture error to GlitchTip:", captureErr);
    }
  };
}

export const captureApiError = createCaptureApiError(
  (error, context) =>
    Sentry.captureException(error, context as Parameters<typeof Sentry.captureException>[1]),
  () => Sentry.getClient() !== undefined,
);
