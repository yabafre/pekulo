# Story: 11-3-rls-audit-and-encryption-doc — RLS audit gate (new-table detection) + at-rest encryption doc + ADR-0013 correction

**Epic:** Epic 11 — Public-ramp readiness
**Status:** ready-for-dev
**Ticket:** #50
**Branch:** feature/50-11-3-rls-audit-and-encryption-doc

## User Story

**As a** Pekulo developer, **I want** a CI gate that fails the build when any user-data table is missing its RLS policies (including a brand-new table), the at-rest encryption posture documented in `docs/security.md`, and the inaccurate "RLS catches the bug" claim corrected in ADR-0013 + architecture.md, **so that** the (b) public ramp opens with verifiable — and accurately documented — security guarantees.

## Acceptance Criteria

- **AC-1** — **Given** a Prisma migration that creates a new public user-data table **without** `ENABLE ROW LEVEL SECURITY` + policies, **When** the RLS audit runs (locally and in CI), **Then** it exits non-zero and surfaces the offending table name. (NFR-8, DR-4)
- **AC-2** — **Given** `docs/security.md`, **When** a reader opens the at-rest encryption section, **Then** the Supabase tier's at-rest mechanism is documented **with concrete verification steps**. (NFR-14, DR-11)
- **AC-3** — **Given** `docs/security.md`, **When** a reader opens the encryption-strategy section, **Then** it records that OPAQUE / zero-knowledge E2E are **rejected** (server-side aggregation + offline Bridge ingestion need plaintext) and that field-level IBAN encryption via the existing Supabase Vault pattern is the recommended future hardening (implementation deferred to a follow-up story).
- **AC-4** — **Given** ADR-0013 and `docs/architecture.md`, **When** a reader reaches the "defense in depth" clause, **Then** it no longer claims "RLS catches the bug" for the `apps/api` path; it states that the service-role connection bypasses RLS, so tenant isolation on that path rests solely on the `no-prisma-query-without-user-id` lint rule + `where: { userId }` discipline.
- **AC-5** — **Given** two users A and B each owning a Bridge `bank_connection`, **When** a webhook `item.refreshed` event arrives for B's `provider_item_id`, **Then** only B's connection status changes and A's connection is never read or mutated (proven with a two-user test, per the 2026-05-27 sandbox-masking lesson). The pre-existing lint-rule unit test (`packages/oxlint-config/tests/no-prisma-query-without-user-id.test.js`, `invalid` block) already proves the rule fires on a userId-less query — reference it, do not duplicate.

## Tasks

- [x] **T1 — Static migration RLS-lint script** [AC: AC-1]
  Create `apps/api/scripts/rls-migration-audit.ts` with the exact content below. It scans every `apps/api/prisma/migrations/**/migration.sql`, aggregates created public tables, RLS-enabled tables, and policy counts across **all** files (a table may be created in one migration and have RLS added in a later one), then fails — naming the table — if any created user-data table lacks `ENABLE ROW LEVEL SECURITY` or has fewer than the minimum policies. Non-user tables must be explicitly allow-listed in `NON_USER_TABLES` (forces a conscious decision when one is added).

  ```ts
  // apps/api/scripts/rls-migration-audit.ts
  // Static RLS gate (story 11-3, AC-1). Parses the committed migration SQL —
  // NO database needed — and fails the build if any public user-data table is
  // created without `ENABLE ROW LEVEL SECURITY` + at least the minimum policy
  // set. Catches the exact mistake the runtime rls-audit.ts cannot: a brand-new
  // table whose RLS DDL was forgotten (RLS DDL is appended MANUALLY to migration
  // SQL — Prisma does not introspect policies; see ADR-0014, architecture.md:128).
  //
  // Runtime/post-deploy drift is still covered by `apps/api/scripts/rls-audit.ts`
  // (DB-backed, exact policy counts). This script is the cheap CI-friendly gate.
  //
  // Usage: `bun run scripts/rls-migration-audit.ts`
  //        (registered as `db:rls-migration-audit` in package.json)

  import { readdirSync, readFileSync, statSync } from "node:fs";
  import { dirname, join, resolve } from "node:path";
  import { fileURLToPath } from "node:url";

  const HERE = dirname(fileURLToPath(import.meta.url));
  const MIGRATIONS_DIR = resolve(HERE, "..", "prisma", "migrations");

  // Public tables that legitimately hold NO user data (no RLS expected).
  // Adding an entry here is a conscious, reviewable decision.
  const NON_USER_TABLES = new Set<string>([]);

  // Minimum policies a user-data table must declare. Audit sister tables
  // (append-only) ship 2 (INSERT+SELECT); CRUD tables ship 4. The static gate
  // asserts the floor (>=2); exact 2-vs-4 counts are the runtime rls-audit's job.
  const MIN_POLICIES = 2;

  function migrationSqlFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        out.push(...migrationSqlFiles(full));
      } else if (entry === "migration.sql") {
        out.push(full);
      }
    }
    return out;
  }

  function main(): number {
    const sql = migrationSqlFiles(MIGRATIONS_DIR)
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");

    // Bare (public-schema) CREATE TABLE only — skip schema-qualified like
    // "vault"."secrets" / "auth"."users" (matched name would contain a dot-quote).
    const created = new Set<string>();
    for (const m of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?"([a-z0-9_]+)"\s*\(/gi)) {
      created.add(m[1]!);
    }
    const rlsEnabled = new Set<string>();
    for (const m of sql.matchAll(/ALTER TABLE "([a-z0-9_]+)"\s+ENABLE ROW LEVEL SECURITY/gi)) {
      rlsEnabled.add(m[1]!);
    }
    const policyCount = new Map<string, number>();
    for (const m of sql.matchAll(/CREATE POLICY [^;]*?\sON "([a-z0-9_]+)"/gi)) {
      policyCount.set(m[1]!, (policyCount.get(m[1]!) ?? 0) + 1);
    }

    const drift: string[] = [];
    for (const table of [...created].sort()) {
      if (NON_USER_TABLES.has(table)) continue;
      if (!rlsEnabled.has(table)) {
        drift.push(`  ${table}: missing ENABLE ROW LEVEL SECURITY`);
        continue;
      }
      const count = policyCount.get(table) ?? 0;
      if (count < MIN_POLICIES) {
        drift.push(`  ${table}: ${count} policies (need >= ${MIN_POLICIES})`);
      }
    }

    if (drift.length > 0) {
      console.error("[rls-migration-audit] DRIFT — user-data tables without RLS:");
      for (const line of drift) console.error(line);
      console.error(
        "\nAppend the RLS DDL to the table's migration.sql (ENABLE ROW LEVEL SECURITY + policies),",
      );
      console.error("or add the table to NON_USER_TABLES with a justification.");
      return 1;
    }
    const checked = [...created].filter((t) => !NON_USER_TABLES.has(t)).length;
    console.log(`[rls-migration-audit] OK — ${checked} user-data tables, all RLS-guarded.`);
    return 0;
  }

  process.exit(main());
  ```

  Then add the script to `apps/api/package.json` `scripts` (alongside `db:rls-audit`):
  ```json
  "db:rls-migration-audit": "bun run scripts/rls-migration-audit.ts",
  ```
  Run: `bun --filter=@pekulo/api run db:rls-migration-audit`
  Expected: `[rls-migration-audit] OK — <N> user-data tables, all RLS-guarded.`, exit 0.
  Commit: `git add apps/api/scripts/rls-migration-audit.ts apps/api/package.json && git commit -m "feat(#50): static migration RLS-lint gate (AC-1)"`

- [x] **T2 — Test the static gate** [AC: AC-1]
  Create `apps/api/scripts/rls-migration-audit.test.ts` with the content below. It writes two throwaway migration dirs to a tmp folder (one clean, one with a table missing RLS) and asserts the audit's drift detection by invoking the parse logic. Because the script `process.exit`s, the test re-implements the assertion against a small fixture string using the same regexes — keeping the test hermetic (no real migrations dependency).

  ```ts
  // apps/api/scripts/rls-migration-audit.test.ts
  import { test, expect, describe } from "bun:test";

  // Mirrors the parser in rls-migration-audit.ts. If you change the regexes
  // there, change them here — this test pins the AC-1 behaviour (a created
  // user-data table without RLS must be flagged by name).
  function auditSql(sql: string, nonUser = new Set<string>(), minPolicies = 2): string[] {
    const created = new Set<string>();
    for (const m of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?"([a-z0-9_]+)"\s*\(/gi))
      created.add(m[1]!);
    const rls = new Set<string>();
    for (const m of sql.matchAll(/ALTER TABLE "([a-z0-9_]+)"\s+ENABLE ROW LEVEL SECURITY/gi))
      rls.add(m[1]!);
    const pol = new Map<string, number>();
    for (const m of sql.matchAll(/CREATE POLICY [^;]*?\sON "([a-z0-9_]+)"/gi))
      pol.set(m[1]!, (pol.get(m[1]!) ?? 0) + 1);
    const drift: string[] = [];
    for (const t of [...created].sort()) {
      if (nonUser.has(t)) continue;
      if (!rls.has(t)) drift.push(t);
      else if ((pol.get(t) ?? 0) < minPolicies) drift.push(t);
    }
    return drift;
  }

  const CLEAN = `
    CREATE TABLE "widgets" ("id" TEXT NOT NULL, "user_id" UUID NOT NULL);
    ALTER TABLE "widgets" ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "sel" ON "widgets" FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY "ins" ON "widgets" FOR INSERT WITH CHECK (auth.uid() = user_id);
  `;
  const FORGOT_RLS = `
    CREATE TABLE "leaky" ("id" TEXT NOT NULL, "user_id" UUID NOT NULL);
  `;

  describe("rls-migration-audit (AC-1)", () => {
    test("clean migration set → no drift", () => {
      expect(auditSql(CLEAN)).toEqual([]);
    });
    test("new table without RLS → flagged by name", () => {
      expect(auditSql(FORGOT_RLS)).toEqual(["leaky"]);
    });
    test("table with too few policies → flagged", () => {
      const oneOnly = `CREATE TABLE "x" ("user_id" UUID);
        ALTER TABLE "x" ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "p" ON "x" FOR SELECT USING (auth.uid() = user_id);`;
      expect(auditSql(oneOnly)).toEqual(["x"]);
    });
    test("non-user table allow-listed → skipped", () => {
      expect(auditSql(FORGOT_RLS, new Set(["leaky"]))).toEqual([]);
    });
  });
  ```
  Run: `bun --filter=@pekulo/api test scripts/rls-migration-audit.test.ts`
  Expected: `4 pass`, `0 fail`, exit 0.
  Commit: `git add apps/api/scripts/rls-migration-audit.test.ts && git commit -m "test(#50): rls-migration-audit AC-1 cases"`

- [x] **T3 — Re-add the rls-audit CI gate (no DB)** [AC: AC-1]
  In `.github/workflows/pr.yml`, replace the removed-job comment block (lines 72-77, the `# rls-audit: removed 2026-05-24 ...` paragraph) with the job below. It runs the static gate — no Postgres, no `RLS_AUDIT_DATABASE_URL` secret, ~no extra quota.
  ```yaml
    rls-audit:
      name: rls-audit
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v5
        - uses: ./.github/actions/setup-bun
        - name: static RLS migration gate
          run: bun --filter=@pekulo/api run db:rls-migration-audit
  ```
  Run (local sanity): `bun --filter=@pekulo/api run db:rls-migration-audit`
  Expected: exit 0 (the committed migrations are all RLS-guarded).
  Commit: `git add .github/workflows/pr.yml && git commit -m "ci(#50): re-add rls-audit as static migration gate (AC-1)"`

- [x] **T4 — Cross-tenant isolation test (webhook path)** [AC: AC-5]
  Append the `describe` block below to the END of `apps/api/src/modules/bank-aggregator/bank-aggregator.integration.test.ts` (after the existing lifecycle `test(...)`). It reuses the in-file fakes `makeInMemoryRepo()`, `makeFakeProvider()`, `makeStubAccountsService()`, `makeStubTransactionsService()` and the exact `createBankAggregatorService({...})` composition the lifecycle test uses (lines 290-303 — quoted in Dev Notes § Step-0). Seed two users with distinct `providerItemId`s, fire a webhook for user B's item, assert A is untouched.
  ```ts
  // Cross-tenant isolation (story 11-3, AC-5). A webhook for B's providerItemId
  // must never read or mutate A's connection. Two-user assertion per the
  // 2026-05-27 sandbox-masking lesson (a single-tenant pass proves nothing).
  describe("cross-tenant isolation (11-3 AC-5)", () => {
    test("webhook item.refreshed(1010) for B's item leaves A's connection active", async () => {
      const repo = makeInMemoryRepo();
      const svc = createBankAggregatorService({
        repository: repo,
        provider: makeFakeProvider(),
        transactionsService: makeStubTransactionsService().service,
        accountsService: makeStubAccountsService(),
        listAllActiveConnections: async () => [],
      });
      const A = "11111111-1111-4111-8111-111111111111";
      const B = "22222222-2222-4222-8222-222222222222";
      const connA = await repo.createConnection({
        userId: A, provider: "bridge", providerItemId: "item-A", displayName: "A bank",
      });
      const connB = await repo.createConnection({
        userId: B, provider: "bridge", providerItemId: "item-B", displayName: "B bank",
      });

      await svc.handleWebhookEvent({
        type: "item.refreshed",
        content: { item_id: "item-B", status_code: 1010 },
      });

      const aAfter = (await repo.listByUser(A)).find((c) => c.id === connA.id);
      const bAfter = (await repo.listByUser(B)).find((c) => c.id === connB.id);
      expect(bAfter?.status).toBe("sca_required"); // B flipped by the webhook
      expect(aAfter?.status).toBe("active"); // A untouched — no cross-tenant leak
    });
  });
  ```
  Run: `bun --filter=@pekulo/api test src/modules/bank-aggregator/bank-aggregator.integration.test.ts`
  Expected: all tests pass (existing + 1 new), `0 fail`, exit 0.
  Commit: `git add apps/api/src/modules/bank-aggregator/bank-aggregator.integration.test.ts && git commit -m "test(#50): cross-tenant isolation on webhook path (AC-5)"`

- [x] **T5 — Correct the "RLS catches the bug" wording** [AC: AC-4]
  In `docs/adr/0013-prisma-rls-defense-in-depth.md`, replace the clause in the "Defense in depth" bullet (currently: _"Rationale: if `apps/web` ever bypasses `apps/api` ... or if an `apps/api` repository accidentally omits the `userId` guard, RLS catches the bug."_) with:
  > Rationale: RLS protects the **`apps/web` direct path only** (the anon/`authenticated` Supabase client used for Auth). It does **NOT** protect `apps/api` queries — that connection uses the **service role, which bypasses RLS** (and no table sets `FORCE ROW LEVEL SECURITY`). On the `apps/api` path, tenant isolation rests **solely** on the `no-prisma-query-without-user-id` lint rule + the `where: { userId }` discipline. RLS is a real safety net for the web-direct path and a documentation-of-intent for the DB, not a second enforcement layer behind Prisma.

  In `docs/architecture.md` line 139 (the "Defense in depth" bullet), replace _"If `apps/web` ever bypasses `apps/api` or a repository accidentally omits the `userId` guard, RLS catches the bug."_ with:
  > RLS is the safety net for the **`apps/web` direct path** (anon key) only; the `apps/api` service-role connection **bypasses RLS**, so a repository that omits the `userId` guard is caught by the `no-prisma-query-without-user-id` lint rule, **not** by RLS. Isolation on the `apps/api` path is single-layer (lint rule + `where: { userId }`), and that layer is the one to protect.

  Run: `bun run format:check` (markdown is oxfmt-checked) — Expected: exit 0.
  Commit: `git add docs/adr/0013-prisma-rls-defense-in-depth.md docs/architecture.md && git commit -m "docs(#50): correct ADR-0013 + architecture RLS wording (AC-4)"`

- [x] **T6 — Write `docs/security.md`** [AC: AC-2, AC-3]
  Create `docs/security.md` with the content below (it documents at-rest encryption + verification steps + the encryption strategy + the corrected RLS reality + the cross-tenant guarantee).
  ```markdown
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
  ```
  Run: `bun run format:check` — Expected: exit 0.
  Commit: `git add docs/security.md && git commit -m "docs(#50): security.md — at-rest encryption + strategy + RLS reality (AC-2, AC-3)"`

## Dev Notes

- **Architecture:** RLS coverage automation = NFR-8 + DR-4 (architecture.md:142, :239, :638). At-rest encryption = NFR-14 + DR-11 (architecture.md:42, prd.md:189/220). RLS DDL is appended manually to migration SQL — Prisma does not introspect policies (ADR-0014, architecture.md:128) — which is exactly why a **static migration-text gate** (T1) catches the forgotten-DDL mistake that the runtime script cannot (the runtime script only checks its hardcoded `EXPECTED_POLICY_COUNTS` list — a new unlisted table slips through).
- **Files:**
  - `apps/api/scripts/rls-migration-audit.ts` (NEW) — single responsibility: statically assert every public user-data table created by a migration has RLS + policies; in = migration SQL files, out = exit 0/1 + table names.
  - `apps/api/scripts/rls-migration-audit.test.ts` (NEW) — pins AC-1 parser behaviour.
  - `apps/api/package.json` (MODIFY) — register `db:rls-migration-audit`.
  - `.github/workflows/pr.yml` (MODIFY) — re-add `rls-audit` job running the static gate (no DB).
  - `apps/api/src/modules/bank-aggregator/bank-aggregator.integration.test.ts` (MODIFY) — add cross-tenant `describe`.
  - `docs/adr/0013-prisma-rls-defense-in-depth.md` (MODIFY) + `docs/architecture.md` (MODIFY) — correct the RLS wording.
  - `docs/security.md` (NEW) — security posture doc.
- **Testing:** `bun test` (Bun runner) for `apps/api`. Use `bun --filter=@pekulo/api` (workspace name, not folder — 2026-05-19 lesson). The cross-tenant test reuses the existing in-file `makeInMemoryRepo()` harness; do NOT spin up a real DB.
- **Lessons applied:** 2026-05-27 sandbox-masking → AC-5 uses TWO users + asserts A untouched (a single-user pass would be a false green). 2026-05-19 → `bun --filter=@pekulo/api`.
- **Dependencies:** none new. No DB required for the CI gate (static text parse). No new npm package.

### Existing code at write time (Step-0 quotes)

`apps/api/scripts/rls-audit.ts` (runtime script — KEPT, not modified): iterates a hardcoded `EXPECTED_POLICY_COUNTS` map of 19 tables; a table absent from the map is never checked → the AC-1 gap T1 fills.

`.github/workflows/pr.yml:72-77` (current — to be replaced by T3):
```yaml
  # rls-audit: removed 2026-05-24 to free Actions quota — the
  # RLS_AUDIT_DATABASE_URL secret was never configured, so this job
  # always immediately skipped while still consuming runner startup
  # time (~10-20s per PR). Re-add when Supabase is provisioned and
  # the secret is set (full job body in git history at chore/
  # tamagui-css-fresh-guard~1).
```

`docs/architecture.md:139` (current — to be corrected by T5):
> If `apps/web` ever bypasses `apps/api` or a repository accidentally omits the `userId` guard, RLS catches the bug.

`apps/api/src/modules/bank-aggregator/bank-aggregator.service.ts` (webhook path, AC-5 target — NOT modified, exercised by T4):
```ts
async handleWebhookEvent(event) {
  // ... evt.type === "item.refreshed", providerItemId, statusCode ...
  if (statusCode === 1010) {
    const owners = await deps.repository.findOwnersByProviderItemId("bridge", providerItemId);
    for (const o of owners) {
      await deps.repository.setStatus(o.userId, o.connectionId, "sca_required");
    }
    return;
  }
  // statusCode === 0 → per-owner refreshConnectionImpl(o.userId, ...)
}
```

`migration.sql` RLS DDL shape (the static parser in T1 must match this — from `20260527120000_create_bank_connections`):
```sql
CREATE TABLE "bank_connections" ( ... );
ALTER TABLE "bank_connections" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own bank connections" ON "bank_connections"
  FOR SELECT USING (auth.uid() = user_id);
-- + INSERT / UPDATE / DELETE policies
```

`bank-aggregator.integration.test.ts:290-303` (the in-file harness T4 reuses — fakes are defined above this in the same file: `makeInMemoryRepo`, `makeFakeProvider`, `makeStubAccountsService`, `makeStubTransactionsService`; the repo fake already implements `createConnection`, `findOwnersByProviderItemId`, `setStatus`, `listByUser`):
```ts
const repo = makeInMemoryRepo();
const provider = makeFakeProvider();
const accountsService = makeStubAccountsService();
const { service: transactionsService, importedTotal } = makeStubTransactionsService();
const allConnections: Array<{ userId: string; connectionId: string }> = [];

const svc = createBankAggregatorService({
  repository: repo,
  provider,
  transactionsService,
  accountsService,
  listAllActiveConnections: async () => allConnections,
});
```

## File List

### New files

- `apps/api/scripts/rls-migration-audit.ts` — static migration RLS-lint (T1)
- `apps/api/scripts/rls-migration-audit.test.ts` — AC-1 parser tests (T2)
- `docs/security.md` — security posture doc (T6)

### Modified files

- `apps/api/package.json` — register `db:rls-migration-audit` (T1)
- `.github/workflows/pr.yml` — re-add the `rls-audit` static gate job (T3)
- `apps/api/src/modules/bank-aggregator/bank-aggregator.integration.test.ts` — cross-tenant `describe` (T4)
- `docs/adr/0013-prisma-rls-defense-in-depth.md` — correct RLS wording (T5)
- `docs/architecture.md` — correct RLS wording at the "defense in depth" bullet (T5)

## Dev Agent Record

- **Model:** claude-opus-4-8 (1M context)
- **Started:** 2026-05-28
- **Completed:** 2026-05-29

### Summary

Shipped the RLS gate as a static migration-SQL check (no DB) wired into CI, the two-user cross-tenant isolation test, `docs/security.md`, and the ADR-0013 wording fix. AC-1, AC-2, AC-3, AC-5 fully met; AC-4 met via ADR-0013 — the `architecture.md:139` mirror was blocked by the upstream-write guard and descoped to an `aped-course` follow-up per decision.

### Files changed

- `apps/api/scripts/rls-migration-audit.ts` (new)
- `apps/api/scripts/rls-migration-audit.test.ts` (new)
- `apps/api/package.json` (registered `db:rls-migration-audit`)
- `.github/workflows/pr.yml` (re-added `rls-audit` static job)
- `apps/api/src/modules/bank-aggregator/bank-aggregator.integration.test.ts` (cross-tenant describe)
- `docs/security.md` (new)
- `docs/adr/0013-prisma-rls-defense-in-depth.md` (RLS wording)

### Deviations

- **Static migration-text gate** instead of a DB-backed CI job — the removed job needed a Supabase `auth` schema + a never-configured secret; the static parse catches the AC-1 case (forgotten RLS DDL on a new table) with zero DB. `rls-audit.ts` kept for post-deploy exact-count checks. (Locked at story design.)
- **Exported pure `auditMigrationSql`** so the test exercises the real code, instead of the story's duplicated-parser-in-test (no drift between two copies).
- **T4 is a characterization test** of already-correct isolation (no new production code) — witnessed teeth by temporarily sharing B's `providerItemId` with A (A flipped → RED), then reverted.
- **AC-4 `architecture.md:139` DEFERRED** — the upstream-write guard blocked the edit mid-dev; descoped to an `aped-course` follow-up per user decision. ADR-0013 (the authoritative record) is corrected.
- T1+T2 committed as one TDD unit (the test imports the script).

### Test output

`cd apps/api && bun test` → **642 pass, 0 fail**, 1549 expect() calls, exit 0. New: `rls-migration-audit.test.ts` (5) + cross-tenant isolation (1).
Static gate: `bun --filter=@pekulo/api run db:rls-migration-audit` → `OK — 17 user-data tables, all RLS-guarded`, exit 0.

## Review Record

**Date:** 2026-05-29
**Auditors:** Spec, Code, Edge & Hallucination (no Aria — backend/infra/docs surface, no preview app)
**Verdict:** done — all findings resolved or dismissed-with-rationale

### Findings

#### Resolved

- [BLOCKER] AC-4 incomplete — `docs/architecture.md:139` still claimed *"RLS catches the bug"* on the `apps/api` path (false on the service-role connection), and the CI-job description (lines 128/142/239/638) still described a `pg_tables` SQL probe as the CI gate. [docs/architecture.md]
  - Source: Spec, Code, Edge (all three) + manual scope audit (architecture.md declared in File List but absent from the diff)
  - Resolution: landed via **aped-course** (the upstream-lock hook blocks architecture.md writes mid-sprint — same guard the dev hit; unlocked through the coordinated scope-change, correction logged in `docs/state-corrections.yaml`). `cf4a78a` — line 139 now states the service-role **bypasses RLS** and isolation is single-layer (lint rule + `where:{userId}`); CI description synced to the static `rls-migration-audit` gate (DB probe = local/post-deploy). ADR-0013's own stale CI sentence also corrected — `864045c`.
- [MINOR] Static gate false-negative — an unquoted `CREATE TABLE leaky (...)` slipped the quote-requiring regex; an empty migrations corpus printed a false green. [apps/api/scripts/rls-migration-audit.ts]
  - Source: Code, Edge
  - Resolution: `92e6a23` — quotes made optional (schema-qualified `"vault"."secrets"` still excluded, verified), empty-dir now fails closed, duplicated scan DRY'd into `createdTables()`. Mutation-verified: reverting the regex turns the new unquoted test RED; live gate still reports exactly 17 tables. `PARTITION OF` / CTAS left documented out-of-scope (Prisma never emits them; DB probe covers them).
- [MINOR] AC-5 cross-tenant test had no teeth on the `where:{userId}` write-guard — distinct providerItemIds isolate by item alone, so the per-owner userId scoping was never exercised. [apps/api/src/modules/bank-aggregator/bank-aggregator.integration.test.ts]
  - Source: Code (raised HIGH; reconciled to MINOR by the Lead — the AC-5 *literal* guarantee was already proven, and Edge confirmed the test goes RED if the providerItemId filter breaks)
  - Resolution: `a0f5bd4` — added a shared-providerItemId multi-owner fan-out test. Mutation-verified: cross-assigning the userId in the production webhook loop (`service.ts handleWebhookEvent`) turns the new test RED while the distinct-item test stays green — the userId scoping is now load-bearing.

#### Dismissed

- [NIT] Empty `NON_USER_TABLES` allow-list + `MIN_POLICIES = 2` floor. [apps/api/scripts/rls-migration-audit.ts]
  - Source: Code, Edge
  - Rationale: by-design — the static gate asserts the *floor*; exact 2-vs-4 counts are the DB-backed runtime probe's job. An empty allow-list forces a conscious, reviewable decision the moment a genuinely non-user table lands.
- [NIT] Story T2 prose (4 tests / duplicated in-test parser) diverges from shipped reality (6 tests / exported pure `auditMigrationSql`). [story Tasks / Dev Agent Record]
  - Source: Spec
  - Rationale: the shipped design is the improvement the story itself warned against (single source of truth for the regex, no drift between two copies); disclosed in the Dev Record. Historical task prose left intact rather than rewritten.

### Verification

- Test command: `cd apps/api && bun test`
- Test output (final pass): **644 pass, 0 fail** across 69 files (rls-migration-audit 6 pass + cross-tenant isolation 2). Static gate: `OK — 17 user-data tables, all RLS-guarded`, exit 0.
- AC-4 at HEAD: `git show HEAD:docs/architecture.md | grep "RLS catches the bug"` → 0 occurrences; corrected clause present; `docs/adr/0013-…` corrected.
- All fix commits adversarially re-verified by the Code + Edge auditors via mutation (RED-on-break, GREEN-on-revert), working tree clean.
- Visual verification: n/a — no frontend surface.
