# Per-user envelope encryption of free-text fields, with crypto-shredding

**Date:** 2026-11-27
**Status:** accepted
**Decided by:** Alex (Architecture Council C3: Winston, Raj, Nina, Maya — unanimous on B, B1 variant)
**Source:** `docs/spikes/2026-11-26-securite-chiffrement-rust.md` · `docs/architecture.md` § Amendment 2026-11-27
**Supersedes:** the `pgcrypto` prescription of NFR-31 (Bridge tokens are not stored by Pekulo since ADR-0015) and the service-role-derived key of `advisory-encryption.ts` (story 12-3)

## Context

Supabase disk encryption (DR-11 / NFR-14) only protects against stolen disks: a database dump, a leaked `DATABASE_URL`, a backup or a provider insider reads every row in clear. The sensitive data includes raw IBANs currently persisted in `accounts.provider_account_key` (`bridge-client.ts:148` writes `iban:${iban}`) and free text — transaction labels carry counterparty names, notes are arbitrary, a property label may carry an address. In addition, an audit found two immediate defects in `advisory` (hardcoded fallback key in `advisory.module.ts:51` and `SUPABASE_SERVICE_ROLE_KEY` reuse in `runtime-dependencies.ts:318`) and a latent bug in `settings.export.ts:179-182` that exports `advisory_sessions.encrypted_payload` as raw ciphertext rather than decrypted JSON. Full end-to-end encryption is excluded because the server writes and computes while the user is offline (Bridge sync FR-60 → FR-63, LLM categorisation FR-31 → FR-34, monthly digest, export FR-49).

## Decision

**Two-step per-user envelope encryption (option B1) applied through an explicit repository-boundary `UserCryptoService` (never a blanket Prisma `$extends` interceptor):**

- **Step 1 — Immediate pre-sale hardening (Epic 13, stories `13-1` and `13-2`):**
  - Replace plaintext `iban:<IBAN>` values in `accounts.provider_account_key` with a **user-scoped HMAC-SHA-256 blind index** (`iban_hmac:<hex>` computed as `HMAC-SHA256(IBAN_HMAC_KEY, "${userId}:${normalizedIban}")` where normalization is `trim().toUpperCase().replace(/\s+/g, "")`) after backfilling `accounts.providerId`, eliminating cross-user joint-account correlation while preserving `@@unique([userId, provider, providerAccountKey])`.
  - Remove the hardcoded fallback in `advisory.module.ts:51` and stop deriving the advisory key from `SUPABASE_SERVICE_ROLE_KEY` (`runtime-dependencies.ts:318`), replacing both with a dedicated fail-closed `ADVISORY_ENCRYPTION_KEY` validated at boot in `env.ts` (dual-read versioned migration for existing rows).
  - Fix `settings.export.ts:179-182` so `advisory_sessions` payloads are decrypted before streaming in GDPR Art. 20 exports (FR-49, NFR-6).
- **Step 2 — Per-user envelope encryption & crypto-shredding (Epic 14, story `14-16`):**
  - One random 32-byte **DEK** per user, stored wrapped in a `user_keys` table (`user_id` PK → `auth.users(id) ON DELETE CASCADE`, `wrapped_dek`, `kek_version`, RLS enabled with **0 policies** deny-all to PostgREST, delete-only and excluded from `EXPORT_NODES` and `id-prefixes.config.ts`), wrapped by a **versioned KEK held outside Postgres** — a Dokploy environment variable for now (`PEKULO_KEK_V1`, …), behind a `KeyProvider` interface ready for an EU-hosted KMS.
  - **AES-256-GCM** via `node:crypto` (with HKDF-SHA-256 subkey derivation for blind indexes), applied **explicitly by `UserCryptoService` at the repository/export boundary** to the explicit field list: `transactions.label`, `transactions.notes`, the `notes` columns of accounts and holdings, `real_estate.label`, `bank_connections.display_name`, `milestones.label`, and `advisory_sessions.encrypted_payload`. Amounts, dates, categories, technical ids, and `accounts.label` (required for CSV `findAccountIdByLabelForUser`) stay in clear for SQL aggregation and deduplication.
  - **No blanket Prisma `$extends` `$allModels` interceptor:** existing queries rely on SQL `distinct: ["label"]` without `userId` (`transactions.repository.ts:721-730`), nested `account` selects (`transactions.repository.ts:706`), and 5 s interactive bulk `$transaction` blocks (`transactions.repository.ts:424-443`). `UserCryptoService` provisions DEKs outside interactive transactions, caches DEKs in a bounded LRU (evicted unconditionally on `deleteAccount`), validates the user's DEK before `streamUserDataExport` emits its first HTTP 200 chunk, and replaces SQL `distinct: ["label"]` with bounded-window in-memory deduplication / `label_bidx`.
  - **Crypto-shredding**: account deletion destroys the user's DEK inside the existing fail-closed deletion transaction.

Mandatory controls (each one is a review gate for the implementing story):

1. **KEK custody** — versioned, never stored in Postgres, Vault or pgsodium; escrowed offline before the first real row is encrypted; the NFR-21 restore drill decrypts sample rows with the **escrowed** KEK.
2. **Boot canary** — the API decrypts a canary value at startup and refuses to start if it fails or if any `kek_version` referenced in `user_keys` has no loaded key.
3. **AAD binding** — every ciphertext is bound to `table|column|rowId|userId|formatVersion`, so a ciphertext cannot be moved to another row or user. Row ids must exist before encryption (the `prefixed-ids` extension already assigns them client-side). The KEK version is deliberately **not** part of the AAD: a KEK rotation re-wraps DEKs only, without re-encrypting any field.
4. **Versioned envelope** — each ciphertext carries a format-version prefix (`pk1.<iv>.<tag>.<ct>`) so plaintext and ciphertext rows can coexist during the backfill.
5. **Per-user blind index** — equality and `distinct` use an HMAC-SHA-256 index keyed by an HKDF-derived subkey from the user's DEK (shredded with it, no cross-user linkage). `llm_call_log.label_hash` (unkeyed djb2 today) moves to the same keyed HMAC.
6. **Explicit user context & boundary** — repositories and `streamUserDataExport` invoke `UserCryptoService` with an explicit `userId` (never guessing tenant context from generic Prisma `where` clauses; cross-user Bridge cron resolves each user explicitly), with a bounded per-user LRU DEK cache; any write whose user cannot be resolved fails closed.
7. **Erasure ledger outside Postgres** — deletion appends a hashed user id (`hashUserId`, as in `docs/security.md`) to an append-only ledger stored outside the database; every restore replays it to destroy the DEKs of users deleted after the snapshot. Without it, a restore resurrects deleted users.
8. **Advisory migration** — Step 1 (`13-1`) eliminates the hardcoded fallback and `SUPABASE_SERVICE_ROLE_KEY` derivation immediately via `ADVISORY_ENCRYPTION_KEY`; Step 2 (`14-16`) migrates advisory payloads onto the per-user DEK.
9. **KMS trigger** — move the KEK to an EU KMS (B2) when a second person gains infrastructure access, at 1 000 users, or after the first security incident, whichever comes first.

## Why

Only per-user envelope encryption makes a stolen dump or backup unreadable **and** lets erasure reach backups (GDPR art. 17, art. 32), while keeping every server-side feature (FR-31 → FR-34, FR-49, FR-60 → FR-63). The cost is negligible against the latency budgets (NFR-1, NFR-15, NFR-16): 0.7 µs per field and 35 ms for 50 000 labels, measured. Doing it now, with a handful of users, is far cheaper than re-encrypting thousands of accounts after the public ramp.

## Considered options

- **A — disk encryption only** — rejected: stops none of the realistic threats (dump, leaked `DATABASE_URL`, backup exposure, insider).
- **B2 — EU KMS from day one** — rejected for now: adds a network dependency and a vendor outage mode on the request path with no extra protection at this size; moving later only re-wraps one 32-byte DEK per user. Minority view (Raj): move to B2 at the public ramp.
- **C — single global application key** — rejected: no crypto-shredding, and today's advisory variant shares its secret with the service role. Kept as the **fallback** if B1 threatens the 2027-01-31 launch goal, with a dedicated versioned key.
- **D — client-side E2EE** — rejected: breaks offline Bridge sync, server categorisation, the monthly digest and password recovery. An optional client-side "private vault" stays a V2 residual gap.

## Consequences

- **What we may claim:** "data encrypted in transit and at rest; sensitive fields encrypted with a key unique to your account". "Deleted even in our backups" is allowed only once control 7 ships **and** the Supabase backup retention is known. We do **not** claim end-to-end encryption, nor the art. 34(3)(a) notification exemption (amounts, dates and categories stay in clear next to emails).
- Losing every copy of the KEK loses all encrypted data: escrow and the restore drill are not optional.
- Derived plaintext copies must not reappear: the shared `merchant_logo_cache.merchant_key` (built from labels) must never be fed a person-to-person transfer label — decided in the implementing story.
- No `contains`, sorting or full-text search on encrypted fields. A future feature needing it reopens this ADR.
- Every new free-text column must be classified (encrypted or justified clear) in its story; `docs/security.md` carries the field list.
- Signed-off months are only protected by RLS against rewrites; the backfill must not alter their content beyond the envelope.
