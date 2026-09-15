# Pekulo — Security posture

Status: V1 (a) personal-use. Items marked **(b)** are load-bearing before the public ramp.

## Tenant isolation (authoritative)

- `apps/api` connects to Postgres with the **Supabase service role**, which **bypasses RLS**. No table sets `FORCE ROW LEVEL SECURITY`.
- Therefore tenant isolation on the API path is **single-layer**: the `no-prisma-query-without-user-id` oxlint rule + a mandatory `where: { userId }` on every Prisma query. RLS only guards the `apps/web` direct (anon-key) path, which is limited to Supabase Auth.
- The single layer is well-guarded: no raw user-data SQL (`$queryRaw` is the health-check `SELECT 1` only), and exactly one justified lint exception — the cross-user cron in `bank-aggregator.module.ts` (`listAllActiveConnections`), whose downstream writes are userId-scoped (`findOwnersByProviderItemId` → per-owner `setStatus`). Verified by the cross-tenant test in `bank-aggregator.integration.test.ts` (story 11-3, AC-5).

## RLS coverage gate

- **Static gate (CI, every PR):** `bun run --filter=@pekulo/api db:rls-migration-audit` parses the committed migration SQL and fails if any public user-data table lacks `ENABLE ROW LEVEL SECURITY` + policies. Catches a forgotten RLS DDL on a new table.
- **Runtime gate (local / post-deploy):** `bun run --filter=@pekulo/api db:rls-audit` connects to the live DB and asserts exact policy counts per table.
- Verification: add a `CREATE TABLE "tmp_x" (...)` to a scratch migration without RLS DDL → the static gate must exit 1 naming `tmp_x`.

## Encryption at rest (NFR-14, DR-11)

- **Database:** Supabase Postgres is encrypted at rest by the project tier (AES-256). Verification: Supabase dashboard → Project → Settings → confirm the tier's at-rest encryption; record the tier + date here at each (b) audit.
- **Bridge tokens:** the `supabase_vault` extension is enabled and `bank_connections.{access,refresh}_token_secret_id` reference `vault.secrets`, **but** are vestigial NULL — Bridge v3 keeps OAuth tokens server-side and mints a short-lived user Bearer on demand, so Pekulo persists no bank tokens (ADR-0015). Nothing to decrypt = nothing to leak.
- **Offline PWA cache (b):** encrypted IndexedDB scoped per `user_id`, key derived via Web Crypto `SubtleCrypto.deriveKey`, cleared on sign-out (ADR-0003).

## Account erasure (FR-50, story 11-2)

- **Order is fail-closed and fixed:** Bridge first (revoke each item, then
  `DELETE /v3/aggregation/users/{uuid}`), then every user-scoped Postgres table
  in one transaction, then `auth.admin.deleteUser`. A Bridge failure aborts the
  whole deletion with nothing touched — the user retries with their session
  intact. Erasing locally first would destroy the `bridge_users` mapping any
  later provider-side erasure needs.
- **There is no deferred-erasure queue.** A permanently unreachable Bridge
  blocks the deletion and must be completed by the controller by hand. The
  alternative — retaining an erased user's identifiers in a pending table —
  was rejected for V1 (a) at proches scale.
- **`SUPABASE_SERVICE_ROLE_KEY`** is required by `apps/api` and lives in Dokploy
  env only. It is the Auth Admin API key, distinct from `SUPABASE_JWT_SECRET`
  (verification only) and from the Postgres connection in `DATABASE_URL`. It is
  never read on the web side.
- **Raw SQL exception.** `purgeVaultSecrets` in
  `apps/api/src/modules/settings/settings.deletion.ts` is the ONE `$executeRaw`
  against user data in the codebase — `vault.secrets` lives outside Prisma's
  schema so there is no delegate. The query is parameterised, never
  interpolated. The FK from `bank_connections` is `ON DELETE SET NULL`, so
  without this purge a written vault secret would outlive the account that owned
  it. The columns are vestigial NULL today (ADR-0015).
- **Cascade reachability is gated.** `db:rls-migration-audit` fails the build if
  any user-data table cannot reach `auth.users` through an `ON DELETE CASCADE`
  path, directly or through a cascading parent. Migration
  `20260915120000_add_missing_auth_users_fk` closed the four tables that had no
  path at all (`compass_history`, `milestones`, `user_pref`,
  `dashboard_layout`) — three of which carried a migration comment claiming
  otherwise.
- Verification: add a `CREATE TABLE "tmp_y" ("user_id" UUID NOT NULL)` with RLS
  DDL but no FK to a scratch migration → the gate must exit 1 naming `tmp_y`.

## Encryption strategy — what we deliberately do NOT do

- **Zero-knowledge / end-to-end encryption: rejected.** Pekulo's core (compass, transfer detection, monthly aggregates) computes **server-side**, and Bridge ingestion (cron + webhook) runs while the user is offline. A true ZK model (server holds no key) cannot read the data it must aggregate. Incompatible by architecture, not just cost.
- **OPAQUE (PAKE): rejected.** Auth is delegated to Supabase (bcrypt + TLS); the server already sees all financial data. Hardening the password path while the data path is fully server-visible is an inconsistent threat model.
- **Argon2id:** in scope only for a future device-local lock (PIN encrypting the offline cache — ADR-0003), not for server auth.
- **Recommended future hardening:** field-level encryption of the **IBAN** via the existing Supabase Vault pattern (key separated from the row protects against a logical DB dump). Implementation is a **follow-up story**, not 11-3.

## Web perimeter

See the `fix/security-perimeter-hardening` work (open-redirect guard, security headers + CSP Report-Only, `/openapi` dev-gate). CSP enforce flip is a tracked follow-up.

## Auth flows (story 8-1, FR-45/46/47/48 · NFR-11)

The Supabase **hosted-project** configuration (Dashboard → Authentication) is
load-bearing for NFR-11 and must be set on every environment:

- **Minimum password length = 12** (Auth → Policies). The web tier also guards
  this client-side and in the `signUp` / `updatePassword` server actions via
  `@pekulo/validators` (`PASSWORD_MIN_LENGTH = 12`), but the hosted setting is
  the authoritative server enforcement.
- **Login rate-limit = 10 / IP / hour** (Auth → Rate Limits). The `signIn`
  action surfaces the blocked response as a sanitised generic line and never
  echoes the raw Supabase rate-limit hint (story 11-7).
- **Redirect URL allowlist** (Auth → URL Configuration): add the migrated
  callback path `<origin>/callback` (story 8-1 moved `auth/` → the `(auth)`
  route group, so the URL is `/callback`, not `/auth/callback`). The
  password-reset email links to `<origin>/callback?next=/recover`.
