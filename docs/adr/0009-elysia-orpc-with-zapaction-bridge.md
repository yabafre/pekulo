# Domain API on Bun + Elysia + oRPC, web tier keeps zapaction bridge

**Date:** 2026-05-03
**Status:** accepted
**Decided by:** Alex

## Context

The brownfield architecture put all server logic inside Next.js server actions in `apps/web` (zapaction `defineAction` + Supabase JS SDK v2). Alex's directive after Phase 3 review: pull domain logic out of the client tier, adopt the patterns proven on his Bonjour project — a dedicated Bun + Elysia API service exposing **oRPC** as the wire format. Web client stays Next.js but consumes the oRPC contract through `'use server'` thin wrappers (zapaction retained for the React Query bridge).

## Decision

- **`apps/api`** is a new Bun + ElysiaJS service exposing every domain operation as an oRPC route under `/rpc/v1/*`. Each domain is a self-contained module factory (handler + service + repository + schema + errors + types), composed in `apps/api/src/bootstrap/runtime-dependencies.ts`.
- **`apps/web`** server actions stay as **thin `'use server'` wrappers** (`<feature>-actions.ts`, single file per feature, multiple verbs co-located). Each action calls the oRPC client and returns the typed response.
- **`zapaction` is retained** on the web tier as the React Query bridge: server actions are still declared via `defineAction` and consumed via custom hooks built on `@zapaction/query`. Cache invalidation graph (`setTagRegistry`) stays.
- **Hard layering** (lint-enforced — see ADR-0010): `Component → Custom Hook → Server Action → oRPC client → Elysia handler → service → Prisma`.
- **Mount layout on Elysia**: `/rpc/v1/<module>/<method>` for oRPC ; `/health`, `/ready` Elysia-native ; `/internal/llm/attest` Elysia-native private listener for iOS FoundationModels attestation (ADR-0008).
- **`apps/prices`** stays as the standalone FastAPI service ; `apps/api` calls it via internal HTTP for quote orchestration.

## Why

- **Logic centralisation** — domain code lives in one runtime (`apps/api`), reusable from `apps/web`, `apps/mobile` (V1.5), and any future surface (CLI, scheduled jobs).
- **Contract-first type safety** — oRPC propagates Zod-validated types end-to-end (DB → repository → service → handler → contract → client → component) without a code-gen step at the boundary.
- **`zapaction` retention preserves brownfield ergonomics** — React Query keys, tag registry, optimistic updates already wired ; the web tier doesn't lose its mutation orchestration.
- **Modular shape** — each Elysia module is a factory `createXxxModule(deps)` returning `{ router, service }`, composed at the bootstrap layer ; matches the test pyramid (handler-level, service-level, repository-level, whole-module wired) prescribed in ADR-0002.

## Considered options

- **Stay zapaction-only inside `apps/web`** — rejected: violates Alex's directive to pull logic out of the client tier ; mobile (V1.5) would have to re-implement every server action against a separate API.
- **tRPC instead of oRPC** — rejected: oRPC contract-first model + Elysia's first-class Bun support align better with the Trafi-proven pattern.
- **NestJS as the API framework** — rejected: heavier than needed at V1 (a) personal-use phase ; Elysia + module factories give the same composition discipline with less ceremony.

## Consequences

- **Two-tier deployment**: `apps/web` on Vercel ; `apps/api` on Dokploy VPS alongside `apps/prices` (same Caddy reverse proxy, mounted at `/rpc/*`, `/health`, `/ready`, `/internal/*`).
- **Vercel ↔ Dokploy network hop** between web server actions and `apps/api`. Mitigation: keep Dokploy near Vercel's EU edge ; cache Prisma queries via React Query (web) + service-layer memoisation (Elysia) where appropriate.
- **Breaking change to NFR-28** — the original wording "Supabase JS SDK v2 only" applied to the _web tier_ only. Amended in `architecture.md` Phase 2 — Data Layer to: "web tier opens zero direct DB connections ; `apps/api` talks to Postgres via Prisma ; Supabase JS SDK retained on web for Auth flows only."
- **Build/deploy complexity** — two CI pipelines (Vercel + Dokploy), versioned independently. `oRPC` contract version (`@pekulo/contracts` package) gates compatibility.
- **`apps/web/src/lib/llm/`** moves to `apps/api/src/modules/llm/` ; `/api/llm/attest` becomes `/internal/llm/attest` Elysia-native (private listener, not behind oRPC).

## Amendments

### 2026-05-20 — PR #86 (archi-deadcode audit)

The original Decision retained `zapaction` "as the React Query bridge" on the web tier without specifying that the bridge MUST be the hook layer's only entry point. Sub-agents interpreted "zapaction is retained" as "zapaction is allowed alongside raw TanStack" — leading to 18 hooks bypassing `useActionQuery` / `useActionMutation` and calling raw `useQuery` / `useMutation` from `@tanstack/react-query` directly (PR #86 ZAP-1 finding).

Cross-link: **see ADR-0010 amendment for R3 / R4 / R9** — the hook-layer enforcement rules (ZapAction-only consumption, tag-registry-centralised invalidation, optimistic-update recipe). The wire-level decision in this ADR is unchanged ; the bridge IS the only mechanism for the React-Query bridge, by amendment.
