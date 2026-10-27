// packages/observability/src/index.ts
// Shared observability helpers. The package is deliberately dependency-free:
// it knows the shape of a Sentry event, not the Sentry SDK, so apps/api
// (@sentry/bun) and apps/web (@sentry/nextjs) can both consume it without
// dragging a runtime SDK into the other tier's bundle.

export { REDACTED, scrubSentryEvent, scrubString } from "./scrub-sentry-event";
export type { SentryEventLike } from "./scrub-sentry-event";
