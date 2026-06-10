# Quick Spec: Bank connection — true "last synced" separate from the incremental cursor

**Date:** 2026-06-10
**Author:** Alex
**Type:** fix
**Status:** done

## What

The "Synchronisée le …" line on a bank connection currently shows `last_refreshed_at`,
which is **dual-purposed**: it is the incremental `since` cursor (stamped to the
`updated_at` of the most recent transaction Bridge returned) AND the user-facing
"last synced" date. Add a dedicated `last_synced_at` column, stamp it to `now()` on
**every successful poll** (even when Bridge returns zero new transactions), keep
`last_refreshed_at` as the `since` cursor, and display `last_synced_at`.

## Why

A healthy connection that polls daily but has no new transactions shows a frozen,
misleading date (reported: "Synchronisée le 28 mai" on 10 June — the Bridge demo
bank has no transactions after 28 May, so the watermark never advances). The user
reads this as "sync is broken." "Last synced" must reflect the last successful poll,
not the last transaction.

## Acceptance Criteria

- [ ] **AC-1** — `bank_connections` has a nullable `last_synced_at TIMESTAMPTZ`; existing rows are backfilled to their `last_refreshed_at` so no connection regresses to "Jamais synchronisée".
- [ ] **AC-2** — On every successful `refreshConnection` poll, `last_synced_at` is stamped to `now()` — including the empty-response, non-first-poll case (`transactions=[]`, `since != null`).
- [ ] **AC-3** — `last_refreshed_at` (the `since` cursor) keeps its existing semantics unchanged: advanced only when Bridge returns data (or the first-ever empty poll). No regression to incremental fetch.
- [ ] **AC-4** — A failed poll (provider throws) does **not** stamp `last_synced_at`.
- [ ] **AC-5** — The web row displays `last_synced_at` ("Synchronisée le …"), falling back to "Jamais synchronisée" when null.
- [ ] **AC-6** — `BankConnection` DTO carries `lastSyncedAt: string | null`; secret-id columns stay stripped (NFR-31).

## Files to Change

1. `apps/api/prisma/schema/bank_aggregator.prisma` — add `lastSyncedAt DateTime? @map("last_synced_at") @db.Timestamptz` to `BankConnection`.
2. `apps/api/prisma/migrations/20260610120000_bank_connection_last_synced_at/migration.sql` — **new**, hand-written: `ADD COLUMN last_synced_at` + backfill `= last_refreshed_at`.
3. `apps/api/src/modules/bank-aggregator/bank-aggregator.repository.ts` — add column to row shapes + DTO mappers; new `setLastSyncedAt(userId, connectionId, at)` method.
4. `apps/api/src/modules/bank-aggregator/bank-aggregator.service.ts` — in `refreshConnectionImpl`, after a successful import, stamp `setLastSyncedAt(now())` unconditionally (cursor logic untouched).
5. `packages/validators/src/bank-aggregator/bank-aggregator.schemas.ts` — add `lastSyncedAt: z.string().datetime().nullable()` to `bankConnectionSchema`.
6. `apps/web/src/app/(cap)/dashboard/_bank/_components/bank-connection-row.tsx` — read `connection.lastSyncedAt` instead of `lastRefreshedAt`.
7. `apps/api/src/modules/bank-aggregator/bank-aggregator.service.test.ts` — **regression test** (AC-2/AC-3/AC-4).

> **Scope note:** 6 source files + 1 test — just over the aped-quick 5-file guideline. It is a single cohesive DB→API→web change (one column, no new patterns, no new deps, one session). If you'd rather route it through aped-story, say so; otherwise I treat it as a quick fix.

## Test Plan

- **RED→GREEN (service, mocked repo):**
  - Empty non-first poll (`transactions=[]`, `latestUpdatedAt=null`, `since != null`) → `setLastSyncedAt` called with a fresh `now()`; `setLastRefreshedAt` **not** called (AC-2, AC-3).
  - Poll with data (`latestUpdatedAt` set) → both `setLastSyncedAt(now())` and `setLastRefreshedAt(watermark)` called (AC-2, AC-3).
  - Provider throws → `setLastSyncedAt` **not** called (AC-4).
- **Mapping:** repository `toDto` surfaces `lastSyncedAt` as ISO string / null; secret ids absent (existing AC-4 sentinel still green).
- **Regressions:** full `bank-aggregator` suite + `bank-connection-row` web suite green; `prisma validate` passes.

## Result

**Done 2026-06-10.** Added `last_synced_at` (user-facing "last synced"), stamped to
`now()` on every successful poll, decoupled from the `last_refreshed_at` incremental
cursor.

- Migration `20260610120000_bank_connection_last_synced_at` applied to dev (ADD COLUMN
  - backfill `= last_refreshed_at`; `migrate status` → up to date).
- `bank-aggregator.service.ts:216` stamps `setLastSyncedAt(now())` after a successful
  import; cursor logic (`last_refreshed_at`) unchanged.
- DTO + repo mappers + `bank-connection-row.tsx` display wired; secret-strip key
  contract bumped 8→9 keys (runtime + type-guard sentinels).
- **Tests:** api `bank-aggregator` 74/74 (2 new regression tests — empty-poll stamps
  now()/cursor untouched, throw → no stamp); web `_bank` 8/8; `tsc` api+web clean;
  oxlint 0/0.
- **Note:** the user-visible date refreshes to "today" on the next _successful_ poll
  (cron every `BRIDGE_REFRESH_CRON_HOURS=6`h, or a manual refresh). Existing rows show
  their old `last_refreshed_at` until then (backfill), never "Jamais synchronisée".
