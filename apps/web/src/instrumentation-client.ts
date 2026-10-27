// apps/web/src/instrumentation-client.ts
// Browser-side Sentry init (Next.js 16 loads this before hydration).
// Errors only: no browser OTLP exporter ships at V1 (a), so traces stay on
// the server NodeSDK. The OTel auto-setup flag is a server-only concern; the
// browser SDK has no NodeSDK to collide with. The DSN is a NEXT_PUBLIC_* value on purpose — Sentry
// DSNs are ingest keys, not secrets; use a separate GlitchTip project from
// the server-side DSN so browser noise does not drown api incidents.

import * as Sentry from "@sentry/nextjs";

import { scrubSentryEvent } from "@pekulo/observability";

const dsn = process.env.NEXT_PUBLIC_GLITCHTIP_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    sendDefaultPii: false,
    beforeSend(event) {
      return scrubSentryEvent(event);
    },
  } as Parameters<typeof Sentry.init>[0]);
}
