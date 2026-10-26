// packages/observability/src/scrub-sentry-event.ts
// The single PII gate in front of GlitchTip. Runs inside Sentry's beforeSend
// hook on both tiers, AFTER the SDK assembled the event and BEFORE it hits
// the network. Mutates the event in place and returns the same reference so
// it can be wired as `beforeSend(event) { return scrubSentryEvent(event); }`.
//
// What survives, deliberately:
//   - stacktraces (file paths + line numbers) — they carry no financial data
//     and are the whole point of error capture.
//   - error types, tags, fingerprints, contexts (scrubbed value-by-value).
//   - user.id ONLY when it is a 16-hex hashUserId digest (architecture.md
//     § Observability discipline: never the raw UUID).
//
// What never leaves the process:
//   - request headers / cookies / query string / body.
//   - any email, IBAN, UUID, JWT, opaque Supabase secret or Bearer token.
//   - values under a sensitive key, even when the value is not a string.

export const REDACTED = "[redacted]";

const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const SUPABASE_SECRET = /\bsb_secret_[A-Za-z0-9_-]+\b/g;
const JWT = /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const IBAN = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}(?:[ ]?[A-Z0-9]{1,4})?\b/g;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const HASHED_USER_ID = /^[0-9a-f]{16}$/;

const SENSITIVE_KEY =
  /(password|passwd|secret|token|authorization|cookie|api[_-]?key|apikey|dsn|email|iban|jwt)/i;

// Correlation identifiers are not PII and must survive: incident triage joins
// the GlitchTip event to the structured log line on request_id.
const PRESERVE_KEYS = new Set([
  "request_id",
  "requestId",
  "trace_id",
  "traceId",
  "span_id",
  "spanId",
  "parent_span_id",
  "parentSpanId",
]);

const MAX_DEPTH = 8;

export interface SentryRequestLike {
  url?: string;
  query_string?: unknown;
  headers?: unknown;
  cookies?: unknown;
  data?: unknown;
}

export interface SentryUserLike {
  id?: string;
  email?: string;
  username?: string;
  ip_address?: string;
  [key: string]: unknown;
}

export interface SentryBreadcrumbLike {
  message?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SentryExceptionValueLike {
  value?: string;
  stacktrace?: unknown;
  [key: string]: unknown;
}

export interface SentryEventLike {
  message?: string;
  transaction?: string;
  request?: SentryRequestLike;
  user?: SentryUserLike;
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  breadcrumbs?: SentryBreadcrumbLike[] | { values?: SentryBreadcrumbLike[] };
  exception?: { values?: SentryExceptionValueLike[] };
  [key: string]: unknown;
}

export function scrubString(value: string): string {
  return value
    .replace(BEARER_TOKEN, "Bearer [redacted:token]")
    .replace(SUPABASE_SECRET, "[redacted:token]")
    .replace(JWT, "[redacted:jwt]")
    .replace(EMAIL, "[redacted:email]")
    .replace(IBAN, "[redacted:iban]")
    .replace(UUID, "[redacted:uuid]");
}

function stripQueryAndFragment(raw: string): string {
  const cut = raw.search(/[?#]/);
  return cut === -1 ? scrubString(raw) : scrubString(raw.slice(0, cut));
}

function scrubValue(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (typeof value === "string") return scrubString(value);
  if (Array.isArray(value)) {
    return value.map((entry) => scrubValue(entry, seen, depth + 1));
  }
  if (value !== null && typeof value === "object") {
    if (seen.has(value)) return REDACTED;
    seen.add(value);
    if (value instanceof Date) return value.toISOString();
    if (depth >= MAX_DEPTH) return REDACTED;
    scrubRecord(value as Record<string, unknown>, seen, depth);
    return value;
  }
  return value;
}

function scrubRecord(record: Record<string, unknown>, seen: WeakSet<object>, depth: number): void {
  for (const key of Object.keys(record)) {
    if (PRESERVE_KEYS.has(key)) continue;
    if (SENSITIVE_KEY.test(key)) {
      record[key] = REDACTED;
      continue;
    }
    record[key] = scrubValue(record[key], seen, depth + 1);
  }
}

function scrubBreadcrumbs(event: SentryEventLike, seen: WeakSet<object>): void {
  const crumbs = Array.isArray(event.breadcrumbs) ? event.breadcrumbs : event.breadcrumbs?.values;
  if (!crumbs) return;
  for (const crumb of crumbs) {
    if (typeof crumb.message === "string") crumb.message = scrubString(crumb.message);
    if (crumb.data) scrubRecord(crumb.data, seen, 0);
  }
}

function scrubUser(event: SentryEventLike): void {
  if (!event.user) return;
  const id = event.user.id;
  if (typeof id === "string" && HASHED_USER_ID.test(id)) {
    event.user = { id };
    return;
  }
  delete event.user;
}

export function scrubSentryEvent<T>(event: T): T {
  const e = event as unknown as SentryEventLike;
  const seen = new WeakSet<object>();

  if (typeof e.message === "string") e.message = scrubString(e.message);
  if (typeof e.transaction === "string") e.transaction = scrubString(e.transaction);

  if (e.request) {
    if (typeof e.request.url === "string") {
      e.request.url = stripQueryAndFragment(e.request.url);
    }
    delete e.request.query_string;
    delete e.request.headers;
    delete e.request.cookies;
    delete e.request.data;
  }

  scrubUser(e);

  if (e.extra) scrubRecord(e.extra, seen, 0);
  if (e.contexts) scrubRecord(e.contexts, seen, 0);
  if (e.tags) scrubRecord(e.tags, seen, 0);
  scrubBreadcrumbs(e, seen);

  for (const value of e.exception?.values ?? []) {
    if (typeof value.value === "string") value.value = scrubString(value.value);
  }

  return event;
}
