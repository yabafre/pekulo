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
- **When the identity erase fails** (twice, 250 ms apart) after every row is
  gone, the service answers `ACCOUNT_PARTIALLY_ERASED` (500, declared on the
  contract) and logs `account_deletion.identity_erase_failed` with a
  **hashed** user id (`hashUserId`, SHA-256 prefix) — never the raw UUID
  (architecture.md § Observability). To finish the erasure by hand, hash the
  suspected id and compare. A user Supabase no longer has (404 /
  `user_not_found`) counts as erased, so a second confirmation is a no-op.
- **Time budget (NFR-7):** the revoke pass at Bridge, the local transaction
  and each Admin API attempt carry their own ceiling;
  `settings.deletion-budget.test.ts` adds them up and fails the build past
  60 s.
- **`SUPABASE_SERVICE_ROLE_KEY`** is required by `apps/api` and lives in Dokploy
  env only. At boot it must LOOK like a service-role credential (a JWT whose
  `role` claim is `service_role`, or an `sb_secret_…` key): a pasted anon key
  or JWT secret would otherwise fail only inside `auth.admin.deleteUser`,
  after the Bridge user and every local row are gone. It is the Auth Admin API key, distinct from `SUPABASE_JWT_SECRET`
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
- **Custom SMTP** (Auth → SMTP Settings): required on every environment where
  real users sign up. The built-in sender delivers only to project-organisation
  addresses and is capped at 2 emails/hour — any other signup dies with
  "Email address not authorized". Configure a provider (Brevo / Resend), a
  verified sending domain (SPF + DKIM), FR "Confirm signup" / "Reset password"
  templates, and raise the email rate limit (Auth → Rate Limits; 30/hour
  default once custom SMTP is on). Signup confirmation links return through
  `<origin>/callback` (`emailRedirectTo` in the `signUp` action).
- **Redirect URL allowlist** (Auth → URL Configuration): add the migrated
  callback path `<origin>/callback` (story 8-1 moved `auth/` → the `(auth)`
  route group, so the URL is `/callback`, not `/auth/callback`). The
  password-reset email links to `<origin>/callback?next=/recover`.

## Restore-from-snapshot drill (NFR-21, story 11-6)

**Status:** required before the (b) public ramp, then annually. Story 11-6
stays in `review` until the dated record below is filled.

### Procedure

1. In Supabase, take a snapshot of production (Dashboard → Database →
   Backups) and note its timestamp and size.
2. Create a **staging** project in the same region. Do not reuse the local
   Docker stack: this drill must exercise hosted restore, auth schema
   included.
3. Restore the snapshot into the staging project (Dashboard → Database →
   Backups → Restore, targeting the staging project).
4. Point the root `.env.local` at staging:
   `DATABASE_URL` = staging session-pooler connection, `SUPABASE_URL` =
   `https://<staging-ref>.supabase.co`, `SUPABASE_JWT_SECRET` = staging JWT
   secret, `RESTORE_DRILL_SUPABASE_ANON_KEY` = staging anon key, and
   `RESTORE_DRILL_EMAIL` / `RESTORE_DRILL_PASSWORD` = a real user that
   survived the restore.
5. Apply committed migrations to the restored DB:
   `bun --filter=@pekulo/api prisma:migrate:deploy` (ADR-0014: never
   `migrate dev` against a pooled connection).
6. Boot the API against it: `bun --filter=@pekulo/api dev`.
7. Run the assertions:
   `bun --filter=@pekulo/api db:restore-drill-check`.
8. Record the result below, delete the staging project, and rotate the
   staging credentials.

### What the check proves

| Assertion                            | Failure it catches                                                |
| ------------------------------------ | ----------------------------------------------------------------- |
| committed / applied migration parity | restore replayed an older schema, or `migrate deploy` did not run |
| RLS policy counts on 21 tables       | restore dropped policies, or a migration was skipped              |
| zero `NULL user_id` rows             | partial restore / broken foreign keys                             |
| non-empty `auth.users`               | auth schema restored but identities missing                       |
| Auth password round-trip             | `auth.users` present but `auth.identities` / passwords unusable   |
| `settings.get` returns 200           | API cannot read the restored data with a real JWT                 |

### Record

**Status:** not yet executed. This section is completed by the operator during
story 11-6; the story cannot move to `done` before it holds a date, snapshot
timestamp, RTO, anomalies and cleanup confirmation.
