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

## Encryption strategy — what we deliberately do NOT do

- **Zero-knowledge / end-to-end encryption: rejected.** Pekulo's core (compass, transfer detection, monthly aggregates) computes **server-side**, and Bridge ingestion (cron + webhook) runs while the user is offline. A true ZK model (server holds no key) cannot read the data it must aggregate. Incompatible by architecture, not just cost.
- **OPAQUE (PAKE): rejected.** Auth is delegated to Supabase (bcrypt + TLS); the server already sees all financial data. Hardening the password path while the data path is fully server-visible is an inconsistent threat model.
- **Argon2id:** in scope only for a future device-local lock (PIN encrypting the offline cache — ADR-0003), not for server auth.
- **Recommended future hardening:** field-level encryption of the **IBAN** via the existing Supabase Vault pattern (key separated from the row protects against a logical DB dump). Implementation is a **follow-up story**, not 11-3.

## Web perimeter

See the `fix/security-perimeter-hardening` work (open-redirect guard, security headers + CSP Report-Only, `/openapi` dev-gate). CSP enforce flip is a tracked follow-up.
