// apps/web/src/lib/observability/sentry.ts
// GlitchTip error capture for the Next.js tier (NFR-27, story 11-6).
//
// The SDK is used for ERRORS only. Traces stay on the OTel NodeSDK in
// src/instrumentation.node.ts; `enableOpenTelemetrySetup: false` keeps
// @sentry/nextjs from registering a second tracer provider (it defaults to
// true, unlike @sentry/bun). Source-map upload is deliberately out of scope:
// GlitchTip still groups by stacktrace, and a Sentry build plugin would add
// an auth-token dependency to `next build`.

import * as Sentry from "@sentry/nextjs";

import { scrubSentryEvent } from "@pekulo/observability";

export interface RequestErrorRequest {
  path?: string;
  method?: string;
}

export interface RequestErrorContext {
  routerKind?: string;
  routePath?: string;
  routeType?: string;
}

export interface WebErrorCaptureOptions {
  dsn: string;
  environment: string | undefined;
  sendDefaultPii: false;
  enableOpenTelemetrySetup: false;
  beforeSend(event: unknown): unknown;
}

export function buildWebErrorCaptureOptions(
  dsn: string | undefined,
): WebErrorCaptureOptions | undefined {
  const trimmed = dsn?.trim();
  if (!trimmed) return undefined;
  return {
    dsn: trimmed,
    environment: process.env.NODE_ENV,
    sendDefaultPii: false,
    enableOpenTelemetrySetup: false,
    beforeSend(event: unknown) {
      return scrubSentryEvent(event);
    },
  };
}

export function initWebErrorCapture(): boolean {
  const options = buildWebErrorCaptureOptions(process.env.GLITCHTIP_DSN);
  if (!options) return false;
  Sentry.init(options as Parameters<typeof Sentry.init>[0]);
  return true;
}

export function captureRequestError(
  error: unknown,
  request: RequestErrorRequest,
  context: RequestErrorContext,
): void {
  if (!Sentry.getClient()) return;

  // Next passes the request path with the query string attached. Query
  // strings are where tokens leak, so strip before it becomes a tag.
  const path = request.path?.split("?")[0] ?? "<unknown>";
  const route = context.routePath?.trim() || path;

  try {
    Sentry.captureException(error, {
      tags: {
        route,
        router_kind: context.routerKind ?? "unknown",
        route_type: context.routeType ?? "unknown",
      },
      contexts: {
        nextjs: { path, method: request.method ?? "unknown" },
      },
      fingerprint: ["{{ default }}", route],
    });
  } catch (err) {
    console.error("[observability] Failed to capture web error to GlitchTip:", err);
  }
}
