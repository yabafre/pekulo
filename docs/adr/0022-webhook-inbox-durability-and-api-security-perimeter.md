# Postgres webhook inbox durability and single-container API security perimeter (CORS, rate limiting, JWT revocation)

**Date:** 2026-11-27
**Status:** accepted
**Decided by:** Alex (Council C5 — Winston, Raj, Nina, Maya, 4–0 unanimous)
**Amends:** `docs/architecture.md` § Authentication & Security (CORS / rate-limiting, JWT revocation), § Infrastructure (background schedulers)
**Relates:** ADR-0009 (Elysia + oRPC), ADR-0013 (Prisma + RLS), ADR-0015 (Bridge webhooks), ADR-0021 (Stripe webhooks)

## Context

Code verification and the C5 Architecture Council confirmed four live reliability and security gaps in `apps/api`:

1. **Non-durable Bridge webhooks & replay/coalescing bugs:** `bridge-webhook-router.ts:75-82` returns HTTP `204` before persisting the event, running `void service.handleWebhookEvent(event)` in memory — silently dropping events on Dokploy deploys or crashes (`lifecycle.ts` gives only a 10 s shutdown window). Furthermore, `webhook-verifier.ts:51-63` checks header `t=` freshness, but Bridge's HMAC signs only `rawBody` (allowing infinite `t=` replay), and `bank-aggregator.service.ts:594-598` coalesces in-flight events per item in a way that can silently drop an incoming `status_code=1010` (`sca_required`) during a `status_code=0` refresh.
2. **Missing CORS and global rate limiting:** `apps/api/src/app.ts` mounts neither `@elysiajs/cors` nor global rate limiting despite `docs/architecture.md:165-168` specifying both; only `bankAggregator.refreshConnection` enforces a local limit.
3. **Raw `userId` in stdout request logs:** `apps/api/src/platform/http/request-log.ts:28` / `orpc-mount.ts:74` logs the raw UUID instead of `hashUserId`, violating **NFR-25**.
4. **Stateless JWT revocation & mobile 401 trap:** `jwt-verifier.ts:19-86` does not extract `iat` and performs stateless verification only — stolen 1-hour access tokens remain valid at `apps/api` after `signOut()` or "sign out all devices" (weakening **FR-47**). Meanwhile, `apps/mobile/lib/auth/auth-context.tsx:38-58` immediately calls `signOut()` + Keychain purge on any single `401` without retry, so shortening JWT TTL without fixing mobile first would multiply abrupt mobile logouts by 4–6×.

## Decision

Adopt **Option A\*** — **reusable Postgres `webhook_inbox` + Elysia in-process security perimeter + write-through cached `tokens_revoked_before` revocation + mandatory mobile 401 refresh-retry**:

1. **Durable Postgres Webhook Inbox (`webhook_inbox`, shared by Bridge & Stripe):**
   - Webhook handlers run the 256 KB body cap and HMAC signature verification **first** — preserving **NFR-33** (0 DB writes, 401 < 100 ms on invalid signature).
   - On valid signature + JSON parse, persist a minimal non-PII event envelope (`id`, `provider`, `dedup_key`, `event_type`, `resource_key`, `payload_minimal`, `status: 'pending' | 'processing' | 'done' | 'dead_letter'`, `attempts`, `next_retry_at`, `locked_until`, `created_at`) via idempotent `INSERT ... ON CONFLICT (provider, dedup_key) DO NOTHING` **before** returning HTTP `204` (< 15 ms).
   - **Replay protection:** Derive `dedup_key` strictly from verified body event identity (`provider_event_id` for Stripe; `(event_id)` or `(type, item_id, body_timestamp)` / time-bucketed payload hash for Bridge) — **never** from the unsigned `t=` header.
   - **Drainer & serialization:** Run through `apps/api/src/bootstrap/schedulers.ts` (immediate kick on insert + startup recovery + periodic poll) using `FOR UPDATE SKIP LOCKED`, a `locked_until` crash-recovery lease (> 10 s `SHUTDOWN_TIMEOUT_MS`), bounded concurrency (3–5 workers to protect the `pg` pool), **per-`providerItemId` serialization preserving every distinct status transition** (never dropping `1010/sca_required`), exponential backoff, dead-letter capture to GlitchTip after max attempts, and 14–30 day auto-pruning of processed rows.
   - Enable RLS with **0 policies** (deny-all to PostgREST, mirroring `merchant_logo_cache`); register in `ID_PREFIXES`, `NON_USER_MODELS`, and `rls-migration-audit.ts#NON_USER_TABLES`.
2. **API Perimeter (`@elysiajs/cors`, rate limiting, hashed logs):**
   - Mount `@elysiajs/cors` in `apps/api/src/app.ts` with a strict origin allowlist (`apps/web` Vercel production + local dev origins, `credentials: false`), permitting requests with **no `Origin` header** (server-to-server Next.js Server Actions, native mobile `fetch`, Bridge/Stripe webhooks) and verifying zero interference with `bridge-webhook-router.ts`'s `onParse` raw `Uint8Array` body capture.
   - Enforce **bounded-memory (LRU-capped) per-`userId` rate limiting inside `requireUserContext`** so all three authenticated entry points (`orpc-mount.ts`, `settings.export-routes.ts`, `llm.attest-router.ts`) are uniformly protected without throttling shared Vercel serverless NAT IPs; apply stricter per-user budgets on sensitive endpoints (`/v1/export`, `bankAggregator.refreshConnection`, `advisory.*`). Apply a separate bounded-LRU IP rate limit **only** to unauthenticated public routes (`/v1/logos`, `/health` abuse protection), reading exclusively the Caddy-overwritten client IP header (never trusting spoofable client `X-Forwarded-For`). Exempt HMAC-verified webhooks from user/IP caps.
   - Hash `userId` via `hashUserId()` (`apps/api/src/common/security-primitives/hash-user-id.ts`) in `request-log.ts` / `orpc-mount.ts` to restore full **NFR-25** compliance.
3. **Short-TTL JWT + `tokens_revoked_before` revocation (FR-47 & story `14-14`):**
   - **Mandatory prerequisite before lowering Supabase JWT TTL:** Update `apps/mobile/lib/auth/auth-context.tsx` to proactively refresh access tokens when `exp - now < 60 s` and attempt **one silent refresh + retry on 401** before invoking `signOut()`, and ensure `apps/web` Server Actions handle near-expiry session refresh cleanly. Only after this ships, lower Supabase Dashboard access-token TTL from 60 min to **10–15 min**.
   - Extend `jwt-verifier.ts` to extract and require a finite integer `iat` claim (and disable legacy HS256 in production once ES256 JWKS is authoritative).
   - Introduce `tokens_revoked_before` (`user_id` PK → `auth.users(id) ON DELETE CASCADE`, `revoked_before_sec BIGINT`, RLS enabled + policies, registered in `DELETION_NODES` and excluded from `EXPORT_NODES`). Stamped on web/mobile `signOut`, password reset, "sign out all devices" (story `14-14`), and account deletion (FR-50).
   - Compare whole seconds using strict **`iat < revoked_before_sec`** (avoiding same-second truncation and 1–2 s clock-skew self-lockout loops). Maintain a bounded in-memory cache (15–30 s TTL) with **synchronous write-through invalidation** on local revoke, and **bypass cache (direct indexed PK lookup, fail-closed)** on high-risk routes (`/v1/export`, `settings.deleteAccount`, `bankAggregator.*`, `advisory.*`).

## Why

- Reuses existing Supabase Postgres and the single Dokploy Bun container at **€0/month incremental infrastructure cost** (**PRD B3 < €25/mo**, **NFR-15 ≤ 100 concurrent users**).
- Closes three concrete live bugs (webhook crash loss, `t=` replay amplification, dropped `1010/sca_required`) while satisfying **NFR-9** (< 100 ms 401), **NFR-25** (hashed `userId` logs), **NFR-33** (HMAC-first zero-DB-write 401), and **FR-47** (immediate session invalidation).
- Avoids Option B's operational traps: no extra Redis container crowding the Dokploy VPS, and no per-request Supabase Auth `getUser()` round-trips that would exhaust GoTrue's per-IP egress rate limit (causing a global 429 outage) and violate NFR-1/NFR-9 latency budgets.

## Considered options

- **Option B — External Redis/BullMQ + Caddy CORS/rate-limit + per-request Supabase `getUser()`:** Unanimously rejected (4–0) — per-request `getUser()` adds 50–150 ms RTT, introduces a hard Auth availability SPOF, and hits Supabase GoTrue per-IP rate limits from a single Dokploy egress IP; Redis adds memory/backup/ops overhead disproportionate to ~2k–4k webhooks/day.
- **Option C — Synchronous webhook processing + Caddy-only CORS + pure stateless 5-min JWT:** Unanimously rejected (4–0) — synchronous Bridge refreshes already caused timeouts and retry storms (2026-06-12 audit), Caddy-only CORS drifts outside `bun test`, and pure stateless tokens leave a 5-minute window to call `/v1/export` or `deleteAccount` after revocation.

## Consequences

- Single-container Dokploy deployment is a binding architectural assumption for the in-memory rate-limiter and `tokens_revoked_before` cache.
- Per-user `tokens_revoked_before` invalidates all active sessions of that user on revocation (ideal for "sign out all devices" and security events; single-device logout without affecting other devices would later require per-`session_id` tracking).
- Caddy production config must overwrite (not append to) the trusted client-IP header forwarded to `apps/api`.

## Pivot conditions

- **Horizontal scaling (≥ 2 `apps/api` replicas) or > 50 webhooks/sec:** Immediately disqualifies process-local rate-limit and revocation caches → introduce shared Redis/Valkey for rate-limiting, revocation cache, and queue workers (still **never** per-request Supabase `getUser()`).
- **Clock skew > 3 s between Dokploy VPS and Supabase Auth:** Replace timestamp-based `tokens_revoked_before` with a short-TTL `revoked_session_ids` denylist keyed by the JWT `session_id` (`sid`) claim.
- **Independent multi-device logout UX demand:** Extend revocation with a `revoked_session_ids` table alongside `tokens_revoked_before`.

## References

- `docs/triage-decision.md` (Lot A items A1, A5, A6; Lot B B5)
- `.aped/.out-of-scope/2026-11-27-durable-job-queue.md`
- `docs/architecture.md` § Phase 2b — Council Dispatch C5
