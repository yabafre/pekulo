# Prisma + RLS — defense in depth via service-role bypass + explicit user_id guard

**Date:** 2026-05-03
**Status:** accepted
**Decided by:** Alex

## Context

NFR-8 + DR-4 + ADR-0006-superseded prescribed RLS as "the only authorisation surface". With Prisma adopted in `apps/api` (ADR-0012), the question is how to combine Prisma's connection model with Supabase Postgres RLS so that authorisation guarantees survive without forcing every Prisma query through a JWT-injection ceremony.

## Decision

- **`apps/api` connects with the Supabase service role** key (bypasses RLS) via `PrismaPg`. Connection string lives only on Dokploy ; never appears in `apps/web` env or the public surface.
- **Authorisation is enforced in the service layer** via a mandatory `requireUserContext()` helper (Trafi pattern, adapted):
  - Reads the JWT from the incoming Elysia request (via `@elysiajs/bearer` + Supabase JWT verification using `SUPABASE_JWT_SECRET`).
  - Returns `{ userId: 'usr_...', email, jwtClaims }` or throws `UnauthorizedError`.
  - **Every Prisma query that touches a user-scoped table MUST include `where: { userId: ctx.userId, ... }`** — no exceptions outside explicit cross-user admin paths (none planned at V1 / V1.5).
- **A custom oxlint rule** `no-prisma-query-without-user-id` (in `@pekulo/oxlint-config`) flags any `prisma.<model>.{findMany,findFirst,findUnique,update,delete,deleteMany,updateMany}` call inside `apps/api/src/modules/**/*.repository.ts` whose `where` clause does not destructure `userId` from a context binding. Edge cases (e.g. global lookup tables) handled via explicit-allow comments.
- **RLS stays active on every user-scoped table** as defense in depth. The `rls-audit` CI probe still asserts every user-scoped table has 4 RLS policies ; build fails if any table is unprotected. Rationale (corrected 2026-05-29, story 11-3): RLS protects the **`apps/web` direct path only** (the anon / `authenticated` Supabase client used for Auth flows). It does **NOT** protect `apps/api` queries — that connection uses the **service role, which bypasses RLS** (and no table sets `FORCE ROW LEVEL SECURITY`). On the `apps/api` path, tenant isolation rests **solely** on the `no-prisma-query-without-user-id` lint rule + the `where: { userId }` discipline. RLS is a real safety net for the web-direct path and a documentation-of-intent for the DB — not a second enforcement layer behind Prisma. (The earlier wording claimed "RLS catches the bug" for an omitted `apps/api` guard; that was false on the service-role path.)
- **`apps/web` direct queries** are limited to Supabase Auth API only ; any data read or write goes through `apps/api` via oRPC. The Supabase anon key (currently in `NEXT_PUBLIC_*` env) talks to RLS-protected endpoints, so even if a misuse landed it would be RLS-bounded.

## Why

- **Operational simplicity** — service-role + explicit guard avoids the per-query JWT-injection ceremony (`SET LOCAL request.jwt.claims = $1` inside every transaction) that would slow Prisma queries and complicate connection-pool reasoning.
- **Enforceability** — explicit `userId` in every `where` clause is reviewable, lintable, testable. Implicit JWT propagation is hard to audit.
- **Defense in depth** — two layers (server-role guard + RLS-active fallback) cover both the common case (developer mistake) and the rare case (web-tier bypass).
- **Trafi pattern alignment** — Alex carries forward the proven `requireTenantContext` analogue ; lint rule + service-layer helper + DB-level fallback worked on a multi-tenant SaaS, single-user RLS is a strict subset.

## Considered options

- **JWT forwarding per query** — rejected: every Prisma call wraps in `$transaction` to set `request.jwt.claims` ; meaningful per-query overhead, harder to test, conflicts with the `prefixed-ids` extension.
- **RLS-only enforcement (no service-role bypass)** — rejected: forces JWT plumbing in every request ; `apps/api` would essentially proxy the user's JWT for every query without adding centralised orchestration value.
- **Drop RLS entirely** — rejected: removes the safety net the brownfield architecture invested in ; weakens defence at zero gain.

## Consequences

- **`requireUserContext()` helper is non-optional** — every Elysia handler binds `const ctx = requireUserContext(request)` before any service call. Service constructors do not receive context ; handlers pass it explicitly to service methods.
- **`SUPABASE_JWT_SECRET`** in Dokploy env (used to verify JWT issued by Supabase Auth on the web tier).
- **`SUPABASE_SERVICE_ROLE_KEY`** in Dokploy env ONLY. Never in `apps/web`. Listed in the security checklist before (b) flip.
- **NFR-8 wording amended** in `architecture.md` Phase 2 — Authentication & Security: "RLS active on 100 % of user-scoped tables as defense in depth ; primary enforcement via `apps/api`'s `requireUserContext()` helper + lint rule + service-layer `where: { userId }` discipline."
- **Audit-trail tables (`compass_history`, `real_estate_valuations`, `llm_call_log`)** — same rule applies ; even though they're append-only via the application layer, RLS still allows the `INSERT` policy `auth.uid() = user_id` and rejects all `UPDATE`/`DELETE`.
- **`/internal/llm/attest`** uses the JWT (not service-role) for verifying iOS attestation claims ; the audit log row carries the verified `userId` from the JWT.
