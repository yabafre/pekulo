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
  - Errors → **GlitchTip** (Sentry-compatible, MIT, self-hosted on Dokploy) via OTLP. PII scrubbing enabled.
  - Logs → structured stdout collected by Vercel logs (`apps/web`) + journald (`apps/prices` + Ollama).
  - Metrics → Prometheus scrape on `apps/prices` ; Vercel native metrics on `apps/web`.
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
