# Story: 2-2-account-balance-history — Manual cash-balance change with date

**Epic:** Epic 2 — Accounts (extended brownfield)
**Status:** ready-for-dev
**Ticket:** [#18](https://github.com/yabafre/pekulo/issues/18)
**Branch:** `feature/18-2-2-account-balance-history`
**Commit prefix:** `feat(#18): …`
**Depends on:** 2-1-accounts-orpc-port (done)
**Complexity:** S

## User Story

**As a** Pekulo user, **I want** to record a manual cash-balance change on an account at a given date, **so that** historical wealth snapshots reflect the timing of cash movements (FR-11) and future stories (compass curve 7-1, hypothesis projections 7-3) can derive my treasury trajectory from an append-only audit trail rather than reconstructing it from current state.

## Acceptance Criteria

- **AC-1 (atomic write — log + parent update):** **Given** an account `acc_<base62-21>` owned by user A with `cashBalance = 1_000`, **When** `accounts.recordBalanceChange({ id, valuedOn: "2026-05-01T00:00:00Z", cashBalance: 1_500 })` is called for user A, **Then** the response `Account.cashBalance` equals `1500`, the `accounts` row's `cash_balance` column is `1500`, and a new `account_balance_log` row exists with `(user_id=userA, account_id=acc_…, cash_balance=1500, valued_on=2026-05-01T00:00:00Z)`. Both writes happen inside a single Prisma `$transaction` (failure of either rolls back the other).
- **AC-2 (append-only audit — RLS quartet is `SELECT + INSERT` only):** **Given** the migration is applied, **When** `bun --filter=api run db:rls-audit` executes, **Then** the script exits `0` AND `account_balance_log` reports exactly `2` policies (mirrors `compass_history: 2` per ADR-0001). No `UPDATE` / `DELETE` policy exists on the table; deletion only happens via FK cascade when the parent `accounts` row is removed (FR-43 trace + DR-5).
- **AC-3 (cross-user isolation — defense in depth):** **Given** user B owns account `acc_xyz…`, **When** user A calls `recordBalanceChange({ id: "acc_xyz…", valuedOn, cashBalance })`, **Then** the service throws `AccountError("ACCOUNT_NOT_FOUND", "account not found")` → HTTP **404**. **And** no `account_balance_log` row is created. **And** user B's `accounts.cash_balance` is unchanged. Mechanism: the repository's pre-flight `findFirst({ where: { id, userId } })` returns `null` before the `$transaction` is opened.
- **AC-4 (validator boundary — non-negative balance):** **Given** the Zod `recordBalanceChangeInputSchema` is invoked with `cashBalance: -1`, **When** parsing runs, **Then** parsing rejects with `ZodError`. Mirrors `createAccountInputSchema`'s `cashBalance.min(0)` and the brownfield `CHECK (cash_balance >= 0)` constraint on the parent column (defense in depth at the validator + DB layers).
- **AC-5 (decimal coercion at row → DTO boundary):** **Given** the migration writes `cash_balance` as `NUMERIC` and Prisma surfaces it as `Decimal`, **When** `recordBalanceChange` returns the updated Account DTO, **Then** the surfaced `Account.cashBalance` is a JS `number` (e.g. `1_500_000.5`) — never a `Prisma.Decimal`. The boundary uses `decimalToNumber(row.cashBalance, 0)` from `apps/api/src/common/derive/decimal-to-number.ts`; no `Number(decimal)` anywhere in the diff (L24).
- **AC-6 (unauthorized handler rejection):** **Given** an oRPC request reaches the new handler with `context.userId` empty / blank / undefined, **When** the `recordBalanceChange` handler runs, **Then** it throws `PekuloError("UNAUTHORIZED", "user context missing")` AND the Elysia error mapper translates it to HTTP **401** within 100 ms (NFR-9). Reuses the existing `requireUserId` helper at `apps/api/src/modules/accounts/accounts.routes.ts:21`.
- **AC-7 (no Prisma query without `userId` guard, lint-enforced):** **Given** the lint config at `.oxlintrc.json` runs `pekulo/no-prisma-query-without-user-id` over `apps/api/**`, **When** the dev runs `bun --filter=api run lint`, **Then** lint exits `0` for the accounts module. The repository's new `recordBalanceChange` carries `where: { id, userId }` on the pre-flight find AND `where: { id, userId }` on the `tx.account.update`; the `tx.accountBalanceLog.create` carries `data: { userId, accountId, … }` (the lint rule's `prismaIdentifier: ["prisma","tx","client"]` covers the tx callback shape — story 2-1 widened the override).
- **AC-8 (no `*.types.ts` inside accounts module — L1 invariant):** **Given** the story is shipped, **When** the dev greps `apps/api/src/modules/accounts/`, **Then** no file named `accounts.types.ts` or `*.types.ts` exists. The new `RecordBalanceChangeOutcome` discriminated union lives **inside** `accounts.repository.ts` as a local exported type, NOT in a sibling types file. Domain entities (`AccountBalanceLog`, `RecordBalanceChangeInput`) are inferred from `@pekulo/validators` Zod schemas.
- **AC-9 (contract surface — 5th procedure mounted at `/rpc/v1/accounts/recordBalanceChange`):** **Given** the typed client `accountsClient.recordBalanceChange({...})` exists in `apps/web` (via the existing oRPC modules barrel), **When** typecheck runs (`bun --filter=api run typecheck` + `bun --filter=web run typecheck`), **Then** both exit `0`. The contract's `recordBalanceChange` accepts `recordBalanceChangeInputSchema` and returns `accountSchema` (full Account row, mirrors `update`).

## Tasks

- [x] **T1** — Write the migration SQL at `apps/api/prisma/migrations/<timestamp>_create_account_balance_log/migration.sql` (replace `<timestamp>` with `date +%Y%m%d%H%M%S`). Manual SQL — same Supabase pooler deviation precedent as story 1-1 T1 and 2-1 T1. Apply via `bun --filter=api run prisma:migrate:deploy` (per story 2-1 T1 codified env workaround: `prisma.config.ts` already exports `DATABASE_URL=$DIRECT_URL` for `migrate deploy`). Full file content:

  ```sql
  -- 2-2-account-balance-history — append-only audit sister of `accounts` per
  -- ADR-0001 (sister-table pattern). One row per recorded balance change.
  -- RLS quartet: INSERT + SELECT only (no UPDATE/DELETE), enforcing append-only.
  -- Deletion happens only via FK cascade when the parent `accounts` row is
  -- removed (ON DELETE CASCADE) — the parent delete is itself gated by the
  -- holdings-FK probe at the service layer (story 2-1 AC-2).
  --
  -- Idempotent via Prisma's _prisma_migrations registry — DO NOT re-run manually.

  BEGIN;

  -- Step 1 — CREATE TABLE. id is TEXT (prefixed-ids policy from the start,
  -- no brownfield UUID legacy to migrate). account_id is TEXT to match the
  -- post-story-2-1 accounts.id column type.
  CREATE TABLE "account_balance_log" (
      "id" TEXT NOT NULL,
      "user_id" UUID NOT NULL,
      "account_id" TEXT NOT NULL,
      "cash_balance" NUMERIC NOT NULL CHECK ("cash_balance" >= 0),
      "valued_on" TIMESTAMPTZ NOT NULL,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "account_balance_log_pkey" PRIMARY KEY ("id")
  );

  -- Step 2 — FK to accounts(id) with ON DELETE CASCADE (DR-5 — when the
  -- parent account is removed the audit log goes with it; aligns with how
  -- holdings.account_id is wired post-2-1 T1).
  ALTER TABLE "account_balance_log"
    ADD CONSTRAINT "account_balance_log_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE;

  -- Step 3 — composite index supporting (a) "history of one account ordered
  -- by date desc" (UI in story 2-3) and (b) "latest balance <= a given date"
  -- (compass curve in story 7-1). Sort = Desc on valued_on so the most-recent
  -- row lands at the index head.
  CREATE INDEX "account_balance_log_user_account_valued_idx"
    ON "account_balance_log" ("user_id", "account_id", "valued_on" DESC);

  -- Step 4 — RLS policies. Audit sister (ADR-0001) → SELECT + INSERT only,
  -- mirrors compass_history (story 1-1 migration). The lack of UPDATE/DELETE
  -- policies enforces append-only writes at the database layer; rls-audit
  -- asserts the count of 2 (AC-2).
  ALTER TABLE "account_balance_log" ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Users can view their own account balance log" ON "account_balance_log"
    FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "Users can insert their own account balance log" ON "account_balance_log"
    FOR INSERT WITH CHECK (auth.uid() = user_id);

  COMMIT;
  ```

  Run: `bun --filter=api run prisma:migrate:deploy` (applies the migration) then `bun --filter=api run db:rls-audit` (proves RLS coverage). Expected outputs:
  - `prisma:migrate:deploy` → `1 migration found in prisma/migrations / Applying migration \`<ts>_create_account_balance_log\` / All migrations have been successfully applied.`
  - `db:rls-audit` → `OK — every brownfield table reports RLS enabled with the expected policy count.` (exit 0).

  Commit: `git add apps/api/prisma/migrations/<ts>_create_account_balance_log/migration.sql && git commit -m "feat(#18): T1 — account_balance_log migration (audit sister)"`. [AC: AC-1, AC-2, AC-4]

- [x] **T2** — Update Prisma schema and id-prefix registry so the generated client knows the new model.

  **2a — Append the `AccountBalanceLog` model and the back-relation on `Account` to `apps/api/prisma/schema/accounts.prisma`.** Append the model below at the end of the file AND add the relation line shown to the `Account` model (current `Account` model is at lines 4-18 — insert `balanceLog AccountBalanceLog[]` right after `holdings Holding[]` on line 15).

  Full content of the new model to append at end of file:

  ```prisma
  // AccountBalanceLog — append-only audit sister of `accounts` (ADR-0001).
  // RLS policies (INSERT + SELECT only — audit variant) are appended manually
  // to the migration SQL (Prisma does not introspect them). One row per
  // recorded balance change. Cascade-deletes with the parent account row.
  model AccountBalanceLog {
    id          String   @id
    userId      String   @map("user_id") @db.Uuid
    accountId   String   @map("account_id")
    cashBalance Decimal  @map("cash_balance") @db.Decimal
    valuedOn    DateTime @map("valued_on") @db.Timestamptz
    createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz

    account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)

    @@index([userId, accountId, valuedOn(sort: Desc)], map: "account_balance_log_user_account_valued_idx")
    @@map("account_balance_log")
  }
  ```

  Edit on the existing `Account` block — change the relations stanza from:

  ```prisma
    holdings Holding[]
  ```

  to:

  ```prisma
    holdings   Holding[]
    balanceLog AccountBalanceLog[]
  ```

  **2b — Register the prefix in `apps/api/src/database/id-prefixes.config.ts`.** Add `AccountBalanceLog: "abl",` to the `ID_PREFIXES` object — place it right after the existing `Account: "acc",` line (line 18, before `Holding`). Final stanza for the Account aggregate looks like:

  ```ts
    // Account aggregate (story 0-4 — this story)
    Account: "acc",
    AccountBalanceLog: "abl",
    Holding: "hld",
    HoldingLot: "lot",
  ```

  Run: `bun --filter=api run prisma:generate && bun --filter=api run typecheck`. Expected: `Prisma schema loaded from prisma/schema / ✔ Generated Prisma Client …` then typecheck exit 0.

  Commit: `git add apps/api/prisma/schema/accounts.prisma apps/api/src/database/id-prefixes.config.ts && git commit -m "feat(#18): T2 — AccountBalanceLog Prisma model + abl prefix"`. [AC: AC-1, AC-5, AC-7]

- [x] **T3** — Extend the RLS-audit script's expected-policy registry. Edit `apps/api/scripts/rls-audit.ts` — current `EXPECTED_POLICY_COUNTS` (lines 35-50) gets one new entry. Replace the existing block with:

  ```ts
  const EXPECTED_POLICY_COUNTS: Record<string, number> = {
    kpis: 3,
    monthly_tracking: 3,
    hypotheses: 3,
    transactions: 4,
    accounts: 4,
    holdings: 4,
    holding_lots: 4,
    // compass_history is an audit sister table per ADR-0001 — INSERT + SELECT
    // only, no UPDATE/DELETE policies. AC-6 of story 1-1 asserts this count.
    compass_history: 2,
    // milestones is a regular CRUD table — full quartet (SELECT/INSERT/UPDATE/DELETE).
    // AC-12 of story 1-2 asserts this count.
    milestones: 4,
    // account_balance_log is an audit sister table per ADR-0001 — INSERT + SELECT
    // only. AC-2 of story 2-2 asserts this count.
    account_balance_log: 2,
  };
  ```

  Run: `bun --filter=api run db:rls-audit`. Expected: `OK — every brownfield table reports RLS enabled with the expected policy count.` (exit 0).

  Commit: `git add apps/api/scripts/rls-audit.ts && git commit -m "feat(#18): T3 — assert account_balance_log RLS quartet=2 in audit probe"`. [AC: AC-2]

- [x] **T4** — Add validator schemas to `packages/validators/src/accounts.ts`. The file already exports `accountSchema`, `createAccountInputSchema`, etc. (current content at lines 1-95). Append the four new exports at the bottom of the file (immediately after `listAccountsOutputSchema`):

  ```ts
  export const ACCOUNT_BALANCE_LOG_ID_PREFIX_RE = /^abl_[0-9A-Za-z]{21}$/;

  export const accountBalanceLogIdSchema = z
    .string()
    .regex(ACCOUNT_BALANCE_LOG_ID_PREFIX_RE, "id must match /^abl_[0-9A-Za-z]{21}$/");

  // Row / DTO shape for a single audit row. Read APIs are NOT shipped in this
  // story (YAGNI — first consumer is story 7-1's compass curve); the schema is
  // declared now so the inferred TS type stays a single source of truth.
  export const accountBalanceLogSchema = z.object({
    id: accountBalanceLogIdSchema,
    userId: z.string().uuid(),
    accountId: accountIdSchema,
    cashBalance: z.number().min(0),
    valuedOn: z.date(),
    createdAt: z.date(),
  });
  export type AccountBalanceLog = z.infer<typeof accountBalanceLogSchema>;

  // Input for accounts.recordBalanceChange.
  //   - id     — account being amended.
  //   - valuedOn — user-supplied date. No upper bound (future dates allowed
  //                so users can pre-record an anticipated transfer).
  //   - cashBalance — new value, must be >= 0 (mirrors createAccount + DB CHECK).
  export const recordBalanceChangeInputSchema = z.object({
    id: accountIdSchema,
    valuedOn: z.coerce.date(),
    cashBalance: z.number().min(0, "cashBalance must be >= 0"),
  });
  export type RecordBalanceChangeInput = z.infer<typeof recordBalanceChangeInputSchema>;

  // Output mirrors `update` — the freshly-updated Account row.
  export const recordBalanceChangeOutputSchema = accountSchema;
  export type RecordBalanceChangeOutput = z.infer<typeof recordBalanceChangeOutputSchema>;
  ```

  No edit needed to `packages/validators/src/index.ts` — it already does `export * from "./accounts";` so the new exports propagate automatically.

  Run: `bun --filter=@pekulo/validators run typecheck`. Expected: exit 0 (the package has a `typecheck` script per story 0-1 reorg).

  Commit: `git add packages/validators/src/accounts.ts && git commit -m "feat(#18): T4 — recordBalanceChange + AccountBalanceLog Zod schemas"`. [AC: AC-4, AC-5, AC-8]

- [x] **T5** — Append the 5th procedure to the oRPC contract at `packages/contracts/src/accounts.contract.ts`. Current file (lines 19-24) declares 4 procedures. Replace the imports block AND the `accountsContractV1` literal as shown:

  Import block (replace the existing block at lines 9-17):

  ```ts
  import { oc } from "@orpc/contract";
  import {
    accountSchema,
    createAccountInputSchema,
    deleteAccountInputSchema,
    deleteAccountOutputSchema,
    listAccountsOutputSchema,
    recordBalanceChangeInputSchema,
    recordBalanceChangeOutputSchema,
    updateAccountInputSchema,
  } from "@pekulo/validators";
  ```

  Contract literal (replace lines 19-24):

  ```ts
  export const accountsContractV1 = {
    create: oc.input(createAccountInputSchema).output(accountSchema),
    update: oc.input(updateAccountInputSchema).output(accountSchema),
    delete: oc.input(deleteAccountInputSchema).output(deleteAccountOutputSchema),
    list: oc.output(listAccountsOutputSchema),
    recordBalanceChange: oc.input(recordBalanceChangeInputSchema).output(recordBalanceChangeOutputSchema),
  } as const;
  ```

  No edit needed to `packages/contracts/src/index.ts` — the barrel re-exports `accountsContractV1` and `pekuloContract.accounts` already.

  Run: `bun --filter=@pekulo/contracts run typecheck && bun --filter=api run typecheck`. Expected: both exit 0.

  Commit: `git add packages/contracts/src/accounts.contract.ts && git commit -m "feat(#18): T5 — accounts.recordBalanceChange oRPC procedure"`. [AC: AC-9]

- [x] **T6** — Add repository tests (TDD RED) at `apps/api/src/modules/accounts/accounts.repository.test.ts`. The file already declares the `fakeClient(seed)` factory (lines 35-…) plus existing `describe` blocks for `create`, `update`, `delete`, etc. Extend the fake client to support `accountBalanceLog.create` AND append one new `describe("recordBalanceChange", …)` block. Patch instructions:

  **6a — Inside `fakeClient`** (just below the existing `holdings: HoldingRow[]` declaration), declare the log store and the create mock. Locate the section that wires the holding mocks and add right after:

  ```ts
    interface BalanceLogRow {
      id: string;
      userId: string;
      accountId: string;
      cashBalance: Prisma.Decimal;
      valuedOn: Date;
      createdAt: Date;
    }
    const balanceLog: BalanceLogRow[] = [];
    let nextLogId = 0;
    const mintLogId = () => `abl_${String(nextLogId++).padStart(21, "0")}`;

    const accountBalanceLogCreate = mock(
      async (args: {
        data: { userId: string; accountId: string; cashBalance: number; valuedOn: Date };
      }) => {
        const row: BalanceLogRow = {
          id: mintLogId(),
          userId: args.data.userId,
          accountId: args.data.accountId,
          cashBalance: new Prisma.Decimal(args.data.cashBalance),
          valuedOn: args.data.valuedOn,
          createdAt: ts(),
        };
        balanceLog.push(row);
        return row;
      },
    );
  ```

  Then locate the `return { ... }` of `fakeClient` and add `accountBalanceLog: { create: accountBalanceLogCreate }` plus expose `balanceLog` (read-only) in the returned object so tests can assert on it. The existing returned object already exposes `account: { ... }` and `holding: { ... }` — append the new keys after them.

  **6b — Append the new `describe` block at the end of the test file:**

  ```ts
  describe("recordBalanceChange", () => {
    test("happy path — account.cashBalance updated AND log row inserted in one $transaction", async () => {
      const fake = fakeClient({
        accounts: [
          {
            id: "acc_seed00000000000000000",
            userId: USER_A,
            label: "Livret A",
            type: "livret",
            currency: "EUR",
            cashBalance: new Prisma.Decimal(1000),
            notes: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });
      const repo = createAccountRepository({ client: fake.client });
      const outcome = await repo.recordBalanceChange(USER_A, {
        id: "acc_seed00000000000000000",
        valuedOn: new Date("2026-05-01T00:00:00Z"),
        cashBalance: 1500,
      });
      expect(outcome.outcome).toBe("updated");
      if (outcome.outcome !== "updated") throw new Error("type narrowing");
      expect(outcome.account.cashBalance).toBe(1500);
      expect(fake.balanceLog).toHaveLength(1);
      expect(fake.balanceLog[0]?.userId).toBe(USER_A);
      expect(fake.balanceLog[0]?.accountId).toBe("acc_seed00000000000000000");
      expect(fake.balanceLog[0]?.valuedOn.toISOString()).toBe("2026-05-01T00:00:00.000Z");
      expect(Number(fake.balanceLog[0]?.cashBalance)).toBe(1500);
    });

    test("cross-user attempt returns outcome:'not-found' and writes nothing", async () => {
      const fake = fakeClient({
        accounts: [
          {
            id: "acc_seed00000000000000001",
            userId: USER_B,
            label: "PEA",
            type: "pea",
            currency: "EUR",
            cashBalance: new Prisma.Decimal(2000),
            notes: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });
      const repo = createAccountRepository({ client: fake.client });
      const outcome = await repo.recordBalanceChange(USER_A, {
        id: "acc_seed00000000000000001",
        valuedOn: new Date("2026-05-01T00:00:00Z"),
        cashBalance: 9999,
      });
      expect(outcome.outcome).toBe("not-found");
      expect(fake.balanceLog).toHaveLength(0);
      // Parent untouched.
      expect(Number(fake.accounts[0]?.cashBalance)).toBe(2000);
    });

    test("Decimal cashBalance returned on the parent DTO is a JS number", async () => {
      const fake = fakeClient({
        accounts: [
          {
            id: "acc_seed00000000000000002",
            userId: USER_A,
            label: "CTO",
            type: "cto",
            currency: "EUR",
            cashBalance: new Prisma.Decimal("1500000.5"),
            notes: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });
      const repo = createAccountRepository({ client: fake.client });
      const outcome = await repo.recordBalanceChange(USER_A, {
        id: "acc_seed00000000000000002",
        valuedOn: new Date("2026-05-01T00:00:00Z"),
        cashBalance: 1_500_000.5,
      });
      if (outcome.outcome !== "updated") throw new Error("expected updated");
      expect(typeof outcome.account.cashBalance).toBe("number");
      expect(outcome.account.cashBalance).toBe(1_500_000.5);
    });
  });
  ```

  Run: `bun --filter=api test src/modules/accounts/accounts.repository.test.ts`. Expected RED: tests fail with `TypeError: repo.recordBalanceChange is not a function` (the method does not yet exist in T7's GREEN).

  Commit: `git add apps/api/src/modules/accounts/accounts.repository.test.ts && git commit -m "test(#18): T6 — RED for recordBalanceChange repo (happy / cross-user / decimal)"`. [AC: AC-1, AC-3, AC-5, AC-7]

- [x] **T7** — Implement `recordBalanceChange` in the repository (TDD GREEN) at `apps/api/src/modules/accounts/accounts.repository.ts`. Three edits in the file:

  **7a — Extend the `AccountRepository` interface (currently lines 47-55).** Add the discriminated outcome type and the method signature. Replace the existing block:

  ```ts
  export type DeleteWithFkProbeOutcome =
    | { outcome: "deleted" }
    | { outcome: "fk-blocked"; holdingCount: number }
    | { outcome: "not-found" };

  export interface AccountRepository {
    create(userId: string, input: CreateAccountInput): Promise<Account>;
    update(userId: string, id: string, patch: UpdateAccountRepoInput): Promise<Account | null>;
    delete(userId: string, id: string): Promise<boolean>;
    deleteWithFkProbe(userId: string, id: string): Promise<DeleteWithFkProbeOutcome>;
    listByUser(userId: string): Promise<Account[]>;
    findByIdForUser(userId: string, id: string): Promise<Account | null>;
    countHoldingsReferencing(userId: string, accountId: string): Promise<number>;
  }
  ```

  with:

  ```ts
  export type DeleteWithFkProbeOutcome =
    | { outcome: "deleted" }
    | { outcome: "fk-blocked"; holdingCount: number }
    | { outcome: "not-found" };

  // Discriminated outcome for recordBalanceChange — mirrors the FK-probe
  // pattern. The pre-flight findFirst is OUTSIDE the $transaction so a
  // cross-user / unknown id short-circuits without opening a tx; the
  // update + log create live inside the tx for atomicity.
  export type RecordBalanceChangeOutcome =
    | { outcome: "updated"; account: Account }
    | { outcome: "not-found" };

  export interface RecordBalanceChangeRepoInput {
    id: string;
    valuedOn: Date;
    cashBalance: number;
  }

  export interface AccountRepository {
    create(userId: string, input: CreateAccountInput): Promise<Account>;
    update(userId: string, id: string, patch: UpdateAccountRepoInput): Promise<Account | null>;
    delete(userId: string, id: string): Promise<boolean>;
    deleteWithFkProbe(userId: string, id: string): Promise<DeleteWithFkProbeOutcome>;
    listByUser(userId: string): Promise<Account[]>;
    findByIdForUser(userId: string, id: string): Promise<Account | null>;
    countHoldingsReferencing(userId: string, accountId: string): Promise<number>;
    recordBalanceChange(
      userId: string,
      input: RecordBalanceChangeRepoInput,
    ): Promise<RecordBalanceChangeOutcome>;
  }
  ```

  **7b — Implement the method inside `createAccountRepository`.** Append the following method to the returned object — place it right after `countHoldingsReferencing` (just before the closing `};`):

  ```ts
      async recordBalanceChange(userId, input) {
        // Pre-flight check OUTSIDE the transaction — cross-user / unknown id
        // returns not-found without opening a tx. Mirrors the deleteWithFkProbe
        // pattern but with one pre-flight (account existence) rather than two
        // (existence + FK probe). Inside the tx we update the parent AND insert
        // the audit row atomically; failure of either rolls both back (DR-5).
        const exists = await deps.client.account.findFirst({
          where: { id: input.id, userId },
          select: { id: true },
        });
        if (!exists) {
          return { outcome: "not-found" } as const;
        }
        const updated = await deps.client.$transaction(async (tx) => {
          // updateMany scoped by { id, userId } so a stale id between the
          // pre-flight and the tx body still surfaces null safely (count=0).
          // Defense in depth: RLS would block it too, but the explicit guard
          // is mandated by ADR-0013 + lint rule 0-12.
          const result = await tx.account.updateMany({
            where: { id: input.id, userId },
            data: {
              cashBalance: input.cashBalance,
              updatedAt: new Date(),
            },
          });
          if (result.count === 0) return null;
          // Audit insert — id is injected by the prefixedIds extension when
          // data.id is undefined (ADR-0012). The `as unknown as …` bridge
          // matches the create() branch above; the generated type still demands
          // `id` because account_balance_log.id has no @default in the schema.
          await tx.accountBalanceLog.create({
            data: {
              userId,
              accountId: input.id,
              cashBalance: input.cashBalance,
              valuedOn: input.valuedOn,
            } as unknown as Parameters<typeof tx.accountBalanceLog.create>[0]["data"],
          });
          const row = await tx.account.findFirst({ where: { id: input.id, userId } });
          return row;
        });
        if (!updated) return { outcome: "not-found" } as const;
        return { outcome: "updated", account: rowToAccount(updated as unknown as AccountRow) } as const;
      },
  ```

  Run: `bun --filter=api test src/modules/accounts/accounts.repository.test.ts`. Expected GREEN: `Tests: 3 passed (new) + existing repository tests still pass / exit 0`. The pre-existing 25-ish repository tests (story 2-1) MUST stay green.

  Commit: `git add apps/api/src/modules/accounts/accounts.repository.ts && git commit -m "feat(#18): T7 — repo.recordBalanceChange (atomic update + audit insert)"`. [AC: AC-1, AC-3, AC-5, AC-7]

- [x] **T8** — Add service tests (TDD RED) to `apps/api/src/modules/accounts/accounts.service.test.ts`. Append a new `describe` block at the end of the file. The existing test scaffold uses a fake `AccountRepository` — use the same shape (look at the existing `delete` tests for the fake pattern). Insert:

  ```ts
  describe("recordBalanceChange", () => {
    test("delegates to repo on 'updated' outcome and returns the Account DTO", async () => {
      const fakeAccount: Account = {
        id: "acc_seed00000000000000000",
        userId: USER_A,
        label: "Livret A",
        type: "livret",
        currency: "EUR",
        cashBalance: 1500,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const repo: AccountRepository = {
        ...stubAccountRepository(),
        recordBalanceChange: async () => ({ outcome: "updated", account: fakeAccount }),
      };
      const service = createAccountService({ repository: repo });
      const result = await service.recordBalanceChange(USER_A, {
        id: "acc_seed00000000000000000",
        valuedOn: new Date("2026-05-01T00:00:00Z"),
        cashBalance: 1500,
      });
      expect(result).toEqual(fakeAccount);
    });

    test("throws AccountError(ACCOUNT_NOT_FOUND) on 'not-found' outcome", async () => {
      const repo: AccountRepository = {
        ...stubAccountRepository(),
        recordBalanceChange: async () => ({ outcome: "not-found" }),
      };
      const service = createAccountService({ repository: repo });
      let caught: unknown = null;
      try {
        await service.recordBalanceChange(USER_A, {
          id: "acc_seed00000000000000001",
          valuedOn: new Date("2026-05-01T00:00:00Z"),
          cashBalance: 1500,
        });
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(AccountError);
      if (!(caught instanceof AccountError)) throw new Error("type narrowing");
      expect(caught.code).toBe("ACCOUNT_NOT_FOUND");
      expect(caught.message).toBe("account not found");
    });
  });
  ```

  If `stubAccountRepository()` does NOT yet exist as a helper at the top of `accounts.service.test.ts`, add it once — function returning a full `AccountRepository` whose methods throw `new Error("not stubbed")`, so each test can override only the methods it cares about. (Pattern mirrors `milestones.service.test.ts`.) Place it right under the imports.

  Run: `bun --filter=api test src/modules/accounts/accounts.service.test.ts`. Expected RED: `recordBalanceChange is not a function on AccountService` (the service method does not yet exist).

  Commit: `git add apps/api/src/modules/accounts/accounts.service.test.ts && git commit -m "test(#18): T8 — RED for service.recordBalanceChange (delegate / 404)"`. [AC: AC-1, AC-3]

- [x] **T9** — Implement `recordBalanceChange` in the service (TDD GREEN) at `apps/api/src/modules/accounts/accounts.service.ts`. Two edits:

  **9a — Extend the `AccountService` interface (currently lines 21-26):**

  Replace:

  ```ts
  export interface AccountService {
    create(userId: string, input: CreateAccountInput): Promise<Account>;
    update(userId: string, input: UpdateAccountInput): Promise<Account>;
    delete(userId: string, input: DeleteAccountInput): Promise<DeleteAccountOutput>;
    list(userId: string): Promise<Account[]>;
  }
  ```

  with:

  ```ts
  export interface AccountService {
    create(userId: string, input: CreateAccountInput): Promise<Account>;
    update(userId: string, input: UpdateAccountInput): Promise<Account>;
    delete(userId: string, input: DeleteAccountInput): Promise<DeleteAccountOutput>;
    list(userId: string): Promise<Account[]>;
    recordBalanceChange(userId: string, input: RecordBalanceChangeInput): Promise<Account>;
  }
  ```

  **9b — Extend the validators import (currently lines 11-17)** to include `RecordBalanceChangeInput`:

  ```ts
  import type {
    Account,
    CreateAccountInput,
    DeleteAccountInput,
    DeleteAccountOutput,
    RecordBalanceChangeInput,
    UpdateAccountInput,
  } from "@pekulo/validators";
  ```

  **9c — Append the method to `createAccountService` (right before the closing `};`, after `list`):**

  ```ts
      async recordBalanceChange(userId, input) {
        const out = await deps.repository.recordBalanceChange(userId, {
          id: input.id,
          valuedOn: input.valuedOn,
          cashBalance: input.cashBalance,
        });
        if (out.outcome === "not-found") throw accountNotFound();
        return out.account;
      },
  ```

  Run: `bun --filter=api test src/modules/accounts/accounts.service.test.ts`. Expected GREEN: all service tests pass, exit 0.

  Commit: `git add apps/api/src/modules/accounts/accounts.service.ts && git commit -m "feat(#18): T9 — service.recordBalanceChange (outcome→error mapping)"`. [AC: AC-1, AC-3]

- [x] **T10** — Wire the oRPC handler at `apps/api/src/modules/accounts/accounts.routes.ts`. The current file ends at line 46 with the closing brace of the router. Insert one handler right before the closing `});` of the router. Modify the `router({ … })` block (currently lines 28-45) to read:

  ```ts
    return impl.router({
      create: impl.create.handler(async ({ context, input }) => {
        requireUserId(context.userId);
        return deps.service.create(context.userId, input);
      }),
      update: impl.update.handler(async ({ context, input }) => {
        requireUserId(context.userId);
        return deps.service.update(context.userId, input);
      }),
      delete: impl.delete.handler(async ({ context, input }) => {
        requireUserId(context.userId);
        return deps.service.delete(context.userId, input);
      }),
      list: impl.list.handler(async ({ context }) => {
        requireUserId(context.userId);
        return deps.service.list(context.userId);
      }),
      recordBalanceChange: impl.recordBalanceChange.handler(async ({ context, input }) => {
        requireUserId(context.userId);
        return deps.service.recordBalanceChange(context.userId, input);
      }),
    });
  ```

  Run: `bun --filter=api run typecheck`. Expected: exit 0 (the `impl.recordBalanceChange` symbol is generated from the contract bump in T5).

  Commit: `git add apps/api/src/modules/accounts/accounts.routes.ts && git commit -m "feat(#18): T10 — routes.recordBalanceChange handler"`. [AC: AC-6, AC-9]

- [x] **T11** — Extend module-level wired test at `apps/api/src/modules/accounts/accounts.module.test.ts`. The existing file fakes a `PrismaService` and exercises create / list / FK-guard / cross-user — append one wired-flow test that exercises `recordBalanceChange` end-to-end through `createAccountsModule`. Patch instructions:

  **11a — Extend `fakePrismaService` to support `accountBalanceLog.create`.** Mirror the same pattern used in T6's `fakeClient` patch (BalanceLogRow store + `accountBalanceLogCreate` mock). The file uses `FakeClient` rather than `fakeClient` — locate the `type FakeClient = { account: { … }, holding: { … } }` declaration and add `accountBalanceLog: { create: (…) => Promise<BalanceLogRow> }`. Also extend the `$transaction` mock to pass the tx-scoped client carrying the new method.

  **11b — Append the new test at end of the file:**

  ```ts
  test("AC-1 — recordBalanceChange updates parent + inserts audit row in one flow", async () => {
    const { service, prismaService } = wiredModule({ seed: { holdings: [] } });
    const created = await service.create(USER_A, {
      label: "Livret A",
      type: "livret",
      currency: "EUR",
      cashBalance: 1000,
      notes: null,
    });
    const updated = await service.recordBalanceChange(USER_A, {
      id: created.id,
      valuedOn: new Date("2026-05-01T00:00:00Z"),
      cashBalance: 1500,
    });
    expect(updated.cashBalance).toBe(1500);
    const listed = await service.list(USER_A);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.cashBalance).toBe(1500);
    // Audit row materialised in the fake's log store (exposed by fakePrismaService).
    expect(prismaService.__seenBalanceLogRows()).toHaveLength(1);
    expect(prismaService.__seenBalanceLogRows()[0]?.accountId).toBe(created.id);
    expect(prismaService.__seenBalanceLogRows()[0]?.valuedOn.toISOString()).toBe("2026-05-01T00:00:00.000Z");
  });
  ```

  `wiredModule(opts)` is the existing helper at the top of the file (look at how other tests instantiate the module); extend it to also return `prismaService` with the `__seenBalanceLogRows()` accessor (returns the log store snapshot).

  Run: `bun --filter=api test src/modules/accounts/accounts.module.test.ts`. Expected GREEN: existing tests still pass + new test passes.

  Commit: `git add apps/api/src/modules/accounts/accounts.module.test.ts && git commit -m "test(#18): T11 — module-level wired flow for recordBalanceChange"`. [AC: AC-1]

- [x] **T12** — Extend HTTP-boundary integration test at `apps/api/src/modules/accounts/accounts.integration.test.ts`. The existing file boots an Elysia app + RPCHandler + does 5 wire-format tests (create / list / list-401 / update / delete-happy). Append two new tests at end of file:

  ```ts
  test("recordBalanceChange happy — 200 with updated Account body", async () => {
    const { handler, userAJwt } = await makeHandler();
    const created = await rpc(handler, userAJwt, "accounts.create", {
      label: "Livret A",
      type: "livret",
      currency: "EUR",
      cashBalance: 1000,
      notes: null,
    });
    const res = await rpc(handler, userAJwt, "accounts.recordBalanceChange", {
      id: created.id,
      valuedOn: "2026-05-01T00:00:00.000Z",
      cashBalance: 1500,
    });
    expect(res.cashBalance).toBe(1500);
    expect(res.id).toBe(created.id);
  });

  test("recordBalanceChange unauthenticated — 401 within NFR-9 budget", async () => {
    const { handler } = await makeHandler();
    const started = performance.now();
    const status = await rpcStatus(handler, /* jwt */ null, "accounts.recordBalanceChange", {
      id: "acc_anyvalueofcorrectshape00",
      valuedOn: "2026-05-01T00:00:00.000Z",
      cashBalance: 1500,
    });
    const elapsed = performance.now() - started;
    expect(status).toBe(401);
    expect(elapsed).toBeLessThan(100);
  });
  ```

  Helpers `makeHandler / rpc / rpcStatus` are already declared at the top of the file (same shape as the existing `update` test). The `acc_anyvalueofcorrectshape00` literal is a 21-char base62 payload — it MUST satisfy `ACCOUNT_ID_PREFIX_RE` so the request reaches the handler (validator passes) and the 401 originates from the missing bearer rather than a 400.

  Run: `bun --filter=api test src/modules/accounts/accounts.integration.test.ts`. Expected GREEN: existing 5 tests + new 2 tests.

  Commit: `git add apps/api/src/modules/accounts/accounts.integration.test.ts && git commit -m "test(#18): T12 — integration tests for recordBalanceChange (happy + 401)"`. [AC: AC-1, AC-6, AC-9]

- [x] **T13** — Full-tree gates. Run the four CI gates locally and confirm each is green before opening the PR:

  ```bash
  bun --filter=api run lint
  bun --filter=api run typecheck
  bun --filter=api test
  bun --filter=api run db:rls-audit
  ```

  Expected:
  - `lint` → exit 0 (rule `pekulo/no-prisma-query-without-user-id` passes on every new query — AC-7).
  - `typecheck` → exit 0 (contract surface compiles, services / routes infer the new procedure).
  - `test` → exit 0, all suites green (existing + new tests from T6 / T8 / T11 / T12).
  - `db:rls-audit` → exit 0, `account_balance_log: 2` line in the OK report (AC-2).

  No commit on this task — it's the local CI dry-run. If any gate fails, fix in place (do NOT commit broken state). After all four are green:

  ```bash
  git push -u origin feature/18-2-2-account-balance-history
  gh pr create --base main --title "feat(#18): 2-2-account-balance-history — record cash-balance change + audit log" --body "Closes #18"
  ```

  [AC: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9]

## Dev Notes

### Architecture references

- **Audit sister table pattern (ADR-0001)** — `account_balance_log` is to `accounts` what `compass_history` is to `hypotheses`: append-only sibling keyed by `(user_id, valued_on desc)`. RLS quartet narrowed to `SELECT + INSERT` only; deletion only via FK cascade from the parent. Single source of truth for the wealth-curve consumers in Epic 7-1.
- **Atomic write (parent + audit) inside `$transaction` (mirrors compass.repository.ts#upsertCompassWithHistory:71-94)** — the parent `account.updateMany` + the `accountBalanceLog.create` MUST share a transaction. Failure of either rolls both back. The pre-flight `findFirst` lives OUTSIDE the tx so a cross-user / unknown id short-circuits without opening a connection (NFR-1 cheap-no-op when the caller is wrong).
- **RLS defense in depth (ADR-0013)** — every Prisma query carries explicit `where: { userId }` or `data: { userId, … }`. Lint rule `pekulo/no-prisma-query-without-user-id` (story 0-12) gates this; the `prismaIdentifier: ["prisma","tx","client"]` override (story 2-1 widened) covers the `$transaction` callback's `tx`.
- **Decimal coercion (L24 — story 2-1 explicit)** — `decimalToNumber()` from `apps/api/src/common/derive/decimal-to-number.ts` is the canonical helper. Apply at the row → DTO boundary for `Account.cashBalance` (re-used from existing `rowToAccount`). `AccountBalanceLog.cashBalance` would use the same helper IF a read API existed in this story — it doesn't (read ships with Epic 7-1), so no new boundary site to defend.
- **Prefixed IDs (ADR-0012)** — `AccountBalanceLog: "abl"` registered in `id-prefixes.config.ts`. The prefixedIds Prisma extension mints `abl_<base62-21>` on every `accountBalanceLog.create` where `data.id` is undefined. No brownfield-UUID legacy here (the table is created fresh by T1).
- **Migration discipline (ADR-0014)** — hand-written SQL under `apps/api/prisma/migrations/<ts>_create_account_balance_log/migration.sql` (Supabase pooler hang on `prisma migrate dev`, story 1-1 + 2-1 deviation). Apply via `bun --filter=api run prisma:migrate:deploy` — `prisma.config.ts` already exports `DATABASE_URL=$DIRECT_URL` for that command (story 2-1 T1 codified workaround).
- **Module factory shape (ADR-0009)** — no new file under `apps/api/src/modules/accounts/`; the new procedure is folded into the existing repository / service / routes / module trio (5th procedure on the same factory). `createAccountsModule({ prismaService })` continues to return `{ service, router }` — `router` type stays inferred via `ReturnType<typeof createAccountsRouter>` (L8 invariant — never annotate `Elysia`).
- **FR-11 traceability (architecture.md:915)** — the table explicitly maps FR-11 to `accounts.service.ts#recordBalanceChange`. UI surface (`account-balance-form.tsx`) ships in story 2-3 — out of scope here.
- **NFR-9 (401 < 100ms)** — the new handler reuses `requireUserId` from the existing routes; the 401 path is identical to the other 4 handlers. AC-6 asserts the budget at the HTTP boundary in T12.

### ADRs in scope

- `docs/adr/0001-audit-history-via-sister-tables.md` — Sister-table pattern (load-bearing for this story).
- `docs/adr/0009-elysia-orpc-with-zapaction-bridge.md` — Module factory + contract mount.
- `docs/adr/0012-prisma-7-schema-folder-prefixed-ids.md` — `abl` prefix registration.
- `docs/adr/0013-prisma-rls-defense-in-depth.md` — Explicit `where: { userId }` clause + lint rule.
- `docs/adr/0014-prisma-migrations.md` — Prisma migrate + manual RLS policy append (the new audit table follows the compass_history precedent — RLS policies are written by hand into the migration SQL).

### Lessons re-applied (verbatim from `docs/lessons.md`)

- **L1 (2026-05-09 — zero `*.types.ts` files inside `apps/api/src/modules/**`)** — `RecordBalanceChangeOutcome` and `RecordBalanceChangeRepoInput` live INSIDE `accounts.repository.ts` (local exported types). Domain `AccountBalanceLog` is Zod-inferred from `@pekulo/validators`. No new file under `apps/api/src/modules/accounts/`.
- **L8 (2026-05-04 — Elysia 1.4 `Elysia` type is invariant — scope list explicitly cites story 2-1)** — propagates here. The router type stays inferred via `ReturnType<typeof createAccountsRouter>`. No annotation change.
- **L24 (2026-05-04 — `Number(decimal)` silently truncates — scope list explicitly cites story 2-1)** — apply `decimalToNumber()` at row → DTO boundary in `rowToAccount` (already in place — no edit needed); the new code path re-uses it via the existing repo method.
- **Story 2-1 outcome — prefixed-IDs override for Account aggregate** — `AccountBalanceLog` is greenfield: TEXT id from day 1, no UUID legacy. The `abl` prefix is registered normally (no `null` like `Hypothesis`). The 2-1 retro's "override stays scoped to Account" note does NOT bind us — but the prefixed-IDs precedent (registered non-null) is what we follow.
- **Story 2-1 outcome — `pekulo/no-prisma-query-without-user-id` covers `deps.client.X.Y`** — the lint rule already trips on the new method's queries; no `.oxlintrc.json` change is required (the `prismaIdentifier: ["prisma","tx","client"]` override is sufficient).
- **2026-05-07 — `bun test` ≠ `vitest run`** — `apps/api`'s `test` script runs `bun test`. New test code uses `import { describe, expect, mock, test } from "bun:test"`.

### Step-0 quotes (verbatim current state at story-write time)

#### `apps/api/prisma/schema/accounts.prisma` (lines 1-18 — Account model only)

```prisma
// accounts.prisma — Account aggregate (Account → Holding → HoldingLot).
// Maps the three brownfield tables `accounts`, `holdings`, `holding_lots`.

model Account {
  id          String      @id
  userId      String      @map("user_id") @db.Uuid
  label       String
  type        AccountType
  currency    String      @default("EUR")
  cashBalance Decimal     @default(0) @map("cash_balance") @db.Decimal
  notes       String?
  createdAt   DateTime?   @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime?   @default(now()) @map("updated_at") @db.Timestamptz

  holdings Holding[]

  @@map("accounts")
}
```

This story adds `balanceLog AccountBalanceLog[]` immediately after `holdings Holding[]` and appends the `AccountBalanceLog` model at the end of the file. No other change.

#### `apps/api/src/database/id-prefixes.config.ts` (lines 16-22 — Account aggregate registration)

```ts
export const ID_PREFIXES = {
  // Account aggregate (story 0-4 — this story)
  Account: "acc",
  Holding: "hld",
  HoldingLot: "lot",
  // … remainder of the registry omitted for brevity
} as const satisfies Record<string, string | null>;
```

This story inserts `AccountBalanceLog: "abl",` between `Account: "acc",` and `Holding: "hld",`. No other change.

#### `apps/api/scripts/rls-audit.ts` (lines 35-50 — `EXPECTED_POLICY_COUNTS`)

```ts
const EXPECTED_POLICY_COUNTS: Record<string, number> = {
  kpis: 3,
  monthly_tracking: 3,
  hypotheses: 3,
  transactions: 4,
  accounts: 4,
  holdings: 4,
  holding_lots: 4,
  // compass_history is an audit sister table per ADR-0001 — INSERT + SELECT
  // only, no UPDATE/DELETE policies. AC-6 of story 1-1 asserts this count.
  compass_history: 2,
  // milestones is a regular CRUD table — full quartet (SELECT/INSERT/UPDATE/DELETE).
  // AC-12 of story 1-2 asserts this count.
  milestones: 4,
};
```

This story appends one entry `account_balance_log: 2` (with a comment citing AC-2 of this story). No other change.

#### `packages/validators/src/accounts.ts` (lines 88-95 — tail of the file)

```ts
export const deleteAccountInputSchema = z.object({ id: accountIdSchema });
export type DeleteAccountInput = z.infer<typeof deleteAccountInputSchema>;

export const deleteAccountOutputSchema = z.object({ ok: z.literal(true) });
export type DeleteAccountOutput = z.infer<typeof deleteAccountOutputSchema>;

export const listAccountsOutputSchema = z.array(accountSchema);
```

This story appends 4 new exports (`accountBalanceLogIdSchema`, `accountBalanceLogSchema`, `recordBalanceChangeInputSchema`, `recordBalanceChangeOutputSchema`) plus their inferred TS types at the end of the file. No other change.

#### `packages/contracts/src/accounts.contract.ts` (lines 19-24 — `accountsContractV1`)

```ts
export const accountsContractV1 = {
  create: oc.input(createAccountInputSchema).output(accountSchema),
  update: oc.input(updateAccountInputSchema).output(accountSchema),
  delete: oc.input(deleteAccountInputSchema).output(deleteAccountOutputSchema),
  list: oc.output(listAccountsOutputSchema),
} as const;
```

This story appends a 5th procedure `recordBalanceChange` and bumps the imports from `@pekulo/validators` to include the new schemas. No other change to `pekuloContract` / mount path.

#### `apps/api/src/modules/accounts/accounts.repository.ts` (lines 42-55 — interface stanza)

```ts
export type DeleteWithFkProbeOutcome =
  | { outcome: "deleted" }
  | { outcome: "fk-blocked"; holdingCount: number }
  | { outcome: "not-found" };

export interface AccountRepository {
  create(userId: string, input: CreateAccountInput): Promise<Account>;
  update(userId: string, id: string, patch: UpdateAccountRepoInput): Promise<Account | null>;
  delete(userId: string, id: string): Promise<boolean>;
  deleteWithFkProbe(userId: string, id: string): Promise<DeleteWithFkProbeOutcome>;
  listByUser(userId: string): Promise<Account[]>;
  findByIdForUser(userId: string, id: string): Promise<Account | null>;
  countHoldingsReferencing(userId: string, accountId: string): Promise<number>;
}
```

This story adds `RecordBalanceChangeOutcome` + `RecordBalanceChangeRepoInput` types and a `recordBalanceChange` method on the interface, then the implementation inside `createAccountRepository`. No other change.

#### `apps/api/src/modules/accounts/accounts.service.ts` (lines 21-26 — `AccountService` interface)

```ts
export interface AccountService {
  create(userId: string, input: CreateAccountInput): Promise<Account>;
  update(userId: string, input: UpdateAccountInput): Promise<Account>;
  delete(userId: string, input: DeleteAccountInput): Promise<DeleteAccountOutput>;
  list(userId: string): Promise<Account[]>;
}
```

This story adds `recordBalanceChange(userId, input)` on the interface and the implementation inside `createAccountService`. No other change.

#### `apps/api/src/modules/accounts/accounts.routes.ts` (lines 27-46 — router body)

```ts
export function createAccountsRouter(deps: { service: AccountService }) {
  return impl.router({
    create: impl.create.handler(async ({ context, input }) => {
      requireUserId(context.userId);
      return deps.service.create(context.userId, input);
    }),
    update: impl.update.handler(async ({ context, input }) => {
      requireUserId(context.userId);
      return deps.service.update(context.userId, input);
    }),
    delete: impl.delete.handler(async ({ context, input }) => {
      requireUserId(context.userId);
      return deps.service.delete(context.userId, input);
    }),
    list: impl.list.handler(async ({ context }) => {
      requireUserId(context.userId);
      return deps.service.list(context.userId);
    }),
  });
}
```

This story appends the 5th handler `recordBalanceChange` inside the `router({ … })` literal. No other change.

## File List

**Created**

- `apps/api/prisma/migrations/<timestamp>_create_account_balance_log/migration.sql`

**Modified**

- `apps/api/prisma/schema/accounts.prisma` — `AccountBalanceLog` model + `balanceLog AccountBalanceLog[]` relation on `Account`.
- `apps/api/src/database/id-prefixes.config.ts` — `AccountBalanceLog: "abl"` registration.
- `apps/api/scripts/rls-audit.ts` — `account_balance_log: 2` entry.
- `packages/validators/src/accounts.ts` — 4 new schemas + types.
- `packages/contracts/src/accounts.contract.ts` — `recordBalanceChange` procedure.
- `apps/api/src/modules/accounts/accounts.repository.ts` — `RecordBalanceChangeOutcome` + `recordBalanceChange` method.
- `apps/api/src/modules/accounts/accounts.service.ts` — `recordBalanceChange` method.
- `apps/api/src/modules/accounts/accounts.routes.ts` — 5th handler.
- `apps/api/src/modules/accounts/accounts.repository.test.ts` — 3 new tests + fake client extension.
- `apps/api/src/modules/accounts/accounts.service.test.ts` — 2 new tests + `stubAccountRepository` helper (if absent).
- `apps/api/src/modules/accounts/accounts.module.test.ts` — 1 new wired-flow test + fake `PrismaService` extension.
- `apps/api/src/modules/accounts/accounts.integration.test.ts` — 2 new HTTP-boundary tests.

## Dev Agent Record

### Summary

Shipped the 5th accounts procedure `recordBalanceChange` end-to-end:
audit-sister `account_balance_log` table (RLS quartet = SELECT + INSERT),
`abl` prefix, Zod schemas, oRPC contract entry, atomic repo write
(parent + audit inside a single `$transaction` with an outside pre-flight),
service outcome → `AccountError("ACCOUNT_NOT_FOUND")` mapping, oRPC
handler wired with `requireUserId`. All 9 ACs traced to passing tests
or structural invariants; 216/216 apps/api tests green; full repo
typecheck green; lint exit 0 (1 expected warning on the test-only
`__seenBalanceLogRows()` accessor); `db:rls-audit` reports 10 tables OK
including `account_balance_log (2 policies)`.

### Files changed

- apps/api/prisma/migrations/20260516180000_create_account_balance_log/migration.sql (created)
- apps/api/prisma/migrations/20260516181000_reenable_rls_drifted_tables/migration.sql (created — sidecar)
- apps/api/prisma/schema/accounts.prisma
- apps/api/scripts/rls-audit.ts
- apps/api/src/database/id-prefixes.config.ts
- apps/api/src/database/id-prefixes.config.test.ts
- apps/api/src/modules/accounts/accounts.repository.ts
- apps/api/src/modules/accounts/accounts.repository.test.ts
- apps/api/src/modules/accounts/accounts.service.ts
- apps/api/src/modules/accounts/accounts.service.test.ts
- apps/api/src/modules/accounts/accounts.routes.ts
- apps/api/src/modules/accounts/accounts.module.test.ts
- apps/api/src/modules/accounts/accounts.integration.test.ts
- packages/contracts/src/accounts.contract.ts
- packages/validators/src/accounts.ts

### Deviations

- **Sidecar migration `20260516181000_reenable_rls_drifted_tables`** — when T1's
  `db:rls-audit` ran, three brownfield tables (`kpis`, `monthly_tracking`,
  `hypotheses`) reported `rowsecurity = false` on the live Supabase even
  though `0_baseline_brownfield/migration.sql:209-211` had set them to `true`.
  Policies were intact (3 each). Out-of-strict-scope environment remediation,
  same precedent as story 2-1 T1's `prisma migrate resolve` sidecar.
- **T5 commit broke `apps/api` typecheck intentionally between T5 and T10**.
  Adding `recordBalanceChange` to the contract demands a router handler that
  only lands in T10. Story 2-1's outcome captured the inverse swap; in 2-2
  the dependency direction made the swap impossible. Documented in the T5
  commit message.
- **T10 commit also touched `accounts.integration.test.ts`** — the
  `inMemoryService()` stub had to gain a `recordBalanceChange` impl to keep
  satisfying the widened `AccountService` interface; T12 then added the
  actual wire tests.
- **T8's `stubAccountRepository()` helper added alongside the existing
  `stubRepo()`** rather than replacing it. The existing `beforeEach`-driven
  tests keep the in-memory `stubRepo`; the new describe block uses the
  throw-everywhere `stubAccountRepository()` + spread-override pattern from
  the story spec.
- **Extra commit `test(#18): close AC-4 trace`** — AC-4 had no Zod-level test
  citing it (the schema's `cashBalance.min(0)` was structurally in place but
  not exercised). Added a wire-format negative test that posts `cashBalance: -1`
  and expects a non-200 — observed `400` from the oRPC Zod boundary.
- **`id-prefixes.config.test.ts` widen landed at T13 (not in T2)** because
  the prior 14-entry invariant only tripped during the full-tree `bun test`
  run.

### Test output

```
$ cd apps/api && bun test
bun test v1.3.13 (bf2e2cec)
...
 216 pass
 0 fail
 549 expect() calls
Ran 216 tests across 26 files. [212.00ms]

$ bun run db:rls-audit
@pekulo/api db:rls-audit: [rls-audit] OK — 10 tables checked: kpis (3 policies),
monthly_tracking (3 policies), hypotheses (3 policies), transactions (4 policies),
accounts (4 policies), holdings (4 policies), holding_lots (4 policies),
compass_history (2 policies), milestones (4 policies), account_balance_log (2 policies)
@pekulo/api db:rls-audit: Exited with code 0

$ bun run typecheck   # full repo turbo
 Tasks:    8 successful, 8 total

$ bun run lint
Found 1 warning and 0 errors.   # expected: no-underscore-dangle on __seenBalanceLogRows
EXIT=0
```
