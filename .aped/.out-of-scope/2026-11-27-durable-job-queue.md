---
concept: durable-job-queue
rejected_at: 2026-11-27
decided_by: Fred (aped-triage — 9-agent audit)
---

# Triage: Durable background job queue for periodic schedulers

- **Date**: 2026-11-27
- **Classification**: FEATURE
- **Reporter**: Backend Architect agent (9-agent audit)
- **Evidence**: `apps/api/src/bootstrap/schedulers.ts` and `apps/api/src/modules/bank-aggregator/services/refresh-scheduler.ts:22` use in-process `setInterval` timers (documented single-process V1 choice in `docs/architecture.md:269`).
- **Reason deferred**: Single-instance Dokploy deployment with ≤ 100 users (NFR-15) and idempotent periodic sweeps; Bridge webhook durability is addressed separately via a lightweight DB inbox/outbox before HTTP 204 (Lot A, A6).
- **Reconsider when**: Scaling `apps/api` to multiple replicas or exceeding 100 synced users / needing distributed retry orchestration.

## Why this is out of scope

Introducing Redis/BullMQ or an external queue infra increases operational footprint and violates the V1/pre-sale infra cost target (< €25/month, PRD B3) while `apps/api` runs as a single container. Periodic sweeps are already idempotent, and webhook durability is solved at the DB boundary (A6).

## Prior requests

- 2026-11-27 -- 9-agent audit (Backend Architect) -- flagged in-memory schedulers lacking durable queue; deferred for periodic jobs while Bridge webhook persistence is promoted to Lot A.
