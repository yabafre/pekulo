# Quick Spec: Security perimeter hardening (red-team fixes)

**Date:** 2026-05-28
**Author:** Alex
**Type:** fix
**Status:** done

## What

Close four isolated web-perimeter findings surfaced by the security stress-test:

1. Open-redirect (CWE-601) in the Supabase auth callback.
2. Missing security headers + CSP at the edge.
3. Public `/openapi` (Scalar) playground exposed in all environments.
4. `ALLOWED_ORIGIN=*` footgun in `.env.example`.

Out of scope (routed to existing Epic 11 stories, NOT this quick):

- Cross-tenant isolation test + ADR-0013 wording correction → **#50 `11-3-rls-audit-and-encryption-doc`** (ADR-0013 §"RLS catches the bug" is false on the service-role path; the lint rule is the sole isolation layer).
- Field-level IBAN encryption → **#50**. RGPD export → **#48**. RGPD erasure → **#49**. Global oRPC rate-limit → public-ramp (no existing story; flag in #50 follow-up).

## Why

The open-redirect is a real (Medium) vulnerability shippable today; the other three are
cheap defense-in-depth that shrink the blast radius of any future XSS/clickjacking and
stop an info-disclosure surface before the public ramp. All four are isolated, need no new
deps, and introduce no new architectural pattern.

## Acceptance Criteria

- [ ] **AC-1 (open-redirect):** `apps/web/src/app/auth/callback/route.ts` only honours a same-origin relative `next` (starts with a single `/`, not `//` or `/\`, not an absolute URL). Hostile values (`//evil.com`, `https://evil.com`, `/\evil.com`, `\\evil.com`) fall back to `/dashboard`. A valid `/dashboard/x` is preserved.
- [ ] **AC-2 (zero-risk headers):** every response from `proxy.ts` (normal, redirect, and pass-through) carries `Strict-Transport-Security` (max-age ≥ 2y, includeSubDomains, preload), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a locked `Permissions-Policy` (camera=(), microphone=(), geolocation=()).
- [ ] **AC-3 (CSP):** a Content-Security-Policy is emitted in **Report-Only** mode first (no UI breakage risk), allowing `'self'`, the Supabase URL, the apps/api origin, the OTel collector, inline styles (Tamagui), the inline theme script in `layout.tsx`, and `unpkg.com` **only** when `NODE_ENV === "development"`. `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'` set. Flip to enforce is a tracked follow-up after a manual smoke test.
- [ ] **AC-4 (openapi gate):** `/openapi` (Scalar UI + JSON) is reachable only when `NODE_ENV === "development"`; in any other env it is not mounted / returns 404. `/health` and `/ready` stay public.
- [ ] **AC-5 (env footgun):** `.env.example` `ALLOWED_ORIGIN` no longer defaults to `*` — placeholder domain + comment making the prod value explicit.

## Files to Change

- `apps/web/src/app/auth/callback/route.ts` — validate `next`; fallback `/dashboard`.
- `apps/web/src/app/auth/callback/route.test.ts` — NEW; open-redirect vectors (AC-1).
- `apps/web/src/proxy.ts` — apply security headers + CSP-Report-Only on all return paths (helper to avoid drift across the 3 returns).
- `apps/web/src/proxy.test.ts` — NEW; assert headers present (AC-2/AC-3).
- `apps/api/src/app.ts` — gate the `openapi()` plugin behind dev (AC-4). Plugin gating mechanism (conditional `.use` vs `enabled` flag) confirmed against the installed `@elysiajs/openapi` version at GREEN, per `node_modules/.../docs` (AGENTS.md) + Context7.
- `.env.example` — `ALLOWED_ORIGIN` placeholder (AC-5).

(6 files incl. 2 new tests — at the edge of quick's 5-file guideline but justified: isolated, no new deps, no new pattern.)

## Test Plan

- Vitest unit: `auth/callback` route returns a `/dashboard` redirect for each hostile `next`, preserves a valid relative path, and still routes to `/auth/auth-code-error` on exchange failure.
- Vitest unit: invoke `proxy(request)` for an authed and an anon request; assert all AC-2 headers + the CSP-Report-Only header on the returned response (and on the redirect path).
- API: assert `/openapi` is absent (404) under a production-like `NODE_ENV` and present under `development` (test the gate predicate, not Scalar internals).
- Manual smoke (dev): load the app, open the console, confirm the Report-Only CSP fires no violation that would break Tamagui styling or the theme script before any future flip-to-enforce.
- Regression: full `bash .aped/aped-dev/scripts/run-tests.sh` green.

## Result

**Implemented 2026-05-28 on branch `fix/security-perimeter-hardening`.**

Files changed (8 — 4 new incl. 2 test files; pure-fn extraction for testability per the `classify-callback` convention pushed this above the 5-file guideline, accepted: isolated, no new deps, no new pattern):

- NEW `apps/web/src/app/auth/callback/safe-redirect.ts` — `sanitizeNext()`.
- NEW `apps/web/src/app/auth/callback/safe-redirect.test.ts` — 6 tests.
- `apps/web/src/app/auth/callback/route.ts` — wired `sanitizeNext()`.
- NEW `apps/web/src/lib/security/headers.ts` — `buildSecurityHeaders()` / `buildContentSecurityPolicy()`.
- NEW `apps/web/src/lib/security/headers.test.ts` — 5 tests.
- `apps/web/src/proxy.ts` — `withSecurity()` on all 3 exit paths.
- `apps/api/src/app.ts` — `enabled: env.NODE_ENV === "development"` on the openapi plugin.
- `.env.example` — restrictive `ALLOWED_ORIGIN`.

AC verification:

- **AC-1** ✅ `safe-redirect.ts` + `route.ts:8`; `safe-redirect.test.ts` covers `//host`, absolute URL, `javascript:`, backslash, CR/LF/control, and valid-path-preserved.
- **AC-2** ✅ `headers.ts:buildSecurityHeaders` + `proxy.ts:withSecurity`; `headers.test.ts` asserts HSTS/XFO/nosniff/Referrer/Permissions.
- **AC-3** ✅ `headers.ts:buildContentSecurityPolicy` ships `Content-Security-Policy-Report-Only` (never enforced); unpkg + `ws:` dev-only; `frame-ancestors 'none'`, `base-uri`, `form-action`, `object-src` locked.
- **AC-4** ⚠️ config gate `app.ts` `enabled` flag (confirmed in `@elysiajs/openapi@1.4.15` types) + `tsc --noEmit` green. NOT covered by an automated test — booting the server to assert `/openapi` → 404 would need an exported app factory (out of quick scope). Recommend a manual `curl` against a prod-env boot during the smoke test.
- **AC-5** ✅ `.env.example` `ALLOWED_ORIGIN=https://app.pekulo.example` + comment.

Evidence: new tests 11/11; full web suite 62 files / 126 tests green; api suite 636 / 0 fail; `tsc --noEmit` green on both web + api. `.aped/.last-test-exit = 0`.

Follow-ups (routed OUT of this quick):

- CSP flip Report-Only → enforce (after dev smoke test, ideally nonce-based) — tracked for a later quick/story.
- Cross-tenant isolation test on cron/webhook path + ADR-0013 "RLS catches the bug" wording correction → story **#50 `11-3-rls-audit-and-encryption-doc`**.
- RGPD export/erasure → **#48 / #49**. Global oRPC rate-limit → flag under public-ramp (no existing story).

Commit + draft PR pending user approval (project rule: commit/push only when asked).
