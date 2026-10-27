# Observability spine — OpenTelemetry SDK + GlitchTip

**Date:** 2026-05-03
**Status:** accepted
**Decided by:** Alex

## Context

Pekulo currently has no structured observability — `console.error` on the web side, `print(..., file=sys.stderr)` on `apps/prices`. NFR-25/26/27 require structured logs at (b), per-LLM-call audit entries (no prompt content), and Sentry-equivalent unhandled-error capture with PII scrubbing. The architecture must commit to a wire format that survives backend swaps and avoids vendor lock-in.

## Decision

- **Instrumentation: OpenTelemetry SDK** (vendor-neutral) — `@opentelemetry/sdk-node` for `apps/web` ; `opentelemetry-instrumentation-fastapi` for `apps/prices`. Trace + Log + Metric pillars enabled.
- **V1 (a) sink:** stdout via OTLP console exporter — sufficient for personal-use phase.
- **(b)+ sinks:**
  - Errors → **GlitchTip** (Sentry-compatible, MIT, self-hosted on Dokploy) **through the Sentry SDK** (`@sentry/bun` on `apps/api`, `@sentry/nextjs` on `apps/web`). PII scrubbing runs in `beforeSend` via `@pekulo/observability`. **Not OTLP:** GlitchTip 6.2 accepts OTel logs but exposes no OTLP trace/error receiver, so an `OTLPTraceExporter` pointed at it would silently drop every span (amendment 2026-10-23, story 11-6).
  - Traces → **SigNoz** (ClickHouse-backed APM) via OTLP. GlitchTip groups errors; SigNoz answers "which span was slow". They are complementary, not substitutes.
  - Logs → structured stdout collected by Vercel logs (`apps/web`) + journald (`apps/api`/`apps/prices`/Ollama on Dokploy).
  - Metrics → Prometheus scrape on `apps/api` + `apps/prices` ; Vercel native metrics on `apps/web`.
- **LLM call audit (NFR-26)** is a separate domain artefact — table `llm_call_log` (routing target, latency, outcome, _no prompt content_) with 90-day retention, surfaced via FR-36.

## Why

- **NFR-25 / 27** — structured wire format from day 1 means no rewrite when sinks change.
- **Vendor neutrality** — OTel decouples instrumentation from sink ; if GlitchTip is replaced by Sentry, Honeycomb, or Grafana Cloud, instrumentation code stays untouched.
- **B3 (€25/mo target)** — GlitchTip self-hosted on the existing Dokploy VPS adds zero infra cost.

## Considered options

- **Sentry SaaS direct SDK** — rejected: vendor lock, free tier insufficient for full pillar coverage at (b)+, and we already pay for Dokploy.
- **`pino` only, no OTel** — rejected: covers logs but not traces or metrics ; would need a second instrumentation layer later.
- **Grafana Cloud free tier** — rejected: more moving parts than needed at V1 ; revisit at (c).

## Consequences

- Instrumentation overhead in every request handler (acceptable — OTel SDK adds < 5 ms p95 in measured benchmarks for similar Next.js workloads).
- Operational responsibility for GlitchTip uptime falls on Dokploy at (b)+ — restore drill (NFR-21) MUST cover GlitchTip too.

## Amendment — 2026-10-23 (story 11-6)

The original decision said errors reach GlitchTip "via OTLP". That was true of
the intended wire format, not of GlitchTip's shipped capability: as of 6.2 it
ingests OTel logs natively but has **no OTLP trace receiver** — span and
exception ingest is still "coming soon" upstream. Pointing
`OTLPTraceExporter` at GlitchTip therefore delivered nothing.

The split is now explicit and enforced in code:

- **Errors** → Sentry SDK (`@sentry/bun`, `@sentry/nextjs`) → GlitchTip. This
  buys issue grouping, stacktraces, and the `beforeSend` PII gate.
- **Traces** → OTel `NodeSDK` → OTLP → SigNoz. The trace spine is unchanged.
- **Coexistence** → `enableOpenTelemetrySetup: false` on both server Sentry
  inits, so Sentry never registers a second tracer provider on top of the
  NodeSDK. The browser SDK has no provider to collide with.

Vendor neutrality is preserved where it matters: instrumenting with OTel keeps
the trace sink swappable; GlitchTip stays replaceable by any Sentry-compatible
backend without touching call sites.
