---
concept: rls-per-request-api
rejected_at: 2026-11-27
decided_by: Fred (aped-triage — 9-agent audit)
---

# Triage: Non-privileged Postgres role + per-request RLS enforcement on apps/api

- **Date**: 2026-11-27
- **Classification**: FEATURE
- **Reporter**: Identity & Access Engineer agent (9-agent audit)
- **Evidence**: `apps/api` connects via Supabase service-role (bypassing RLS), relying on `where: { userId }` + custom oxlint rule `no-prisma-query-without-user-id` (explicitly accepted in `docs/adr/0013-prisma-rls-defense-in-depth.md:19` and `docs/security.md:7-9`).
- **Reason deferred**: Explicitly settled by ADR-0013; immediate IDOR risk is mitigated via automated cross-tenant integration tests on every oRPC route (Epic 13 story 13-16) per `docs/spikes/2026-11-26-securite-chiffrement-rust.md:102,120`.
- **Reconsider when**: After 50 paying clients, if team size grows beyond solo founder, or if automated IDOR tests (13-16) uncover a structural gap.

## Why this is out of scope

ADR-0013 evaluated per-query `SET LOCAL request.jwt.claims` inside Prisma `$transaction` wrappers and rejected it for V1/V1.5 due to query/pool overhead and incompatibility with the `prefixed-ids` extension. Defense is strengthened first via automated cross-tenant tests (13-16) before revisiting DB-level enforcement.

## Prior requests

- 2026-11-27 -- 9-agent audit (Identity & Access Engineer) -- flagged single-layer tenant isolation on `apps/api`; kept ADR-0013 decision, routed IDOR test suite to Epic 13 (13-16), deferred RLS-per-request to P2.
