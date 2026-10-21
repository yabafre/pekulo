# Story: 11-5-ai-transparency-notice — AI Transparency Notice (EU AI Act)

**Epic:** Epic 11 — RGPD, Security & Accessibility Hardening
**Status:** ready-for-dev
**Ticket:** #52
**Branch:** feature/52-11-5-ai-transparency-notice

## User Story

**As a** Pekulo user (Alex), **I want** an AI transparency notice the first time the LLM subsystem produces or auto-applies a user-visible category suggestion (and re-shown on opt-out → opt-in transitions), plus a clear AI transparency explanation in `/dashboard/parametres`, **so that** I am informed of AI involvement and my ability to review and correct any category at any time per EU AI Act transparency obligations (DR-12).

## Acceptance Criteria

- **AC-1 (First-time display, latched visibility & explicit dismissal — DR-12, FR-33):** **Given** I have not yet seen the AI transparency notice and at least one pending AI category suggestion or auto-applied AI categorisation is visible on the Transactions screen, **When** the list renders, **Then** the AI transparency notice appears once, records my seen status on the server, remains visible on screen after the seen status refreshes, and can be explicitly dismissed via a keyboard-accessible control. On subsequent visits (while my seen status remains set), the notice does not appear.
- **AC-2 (Opt-out → opt-in re-trigger — DR-12):** **Given** I have already seen the AI transparency notice, **When** my third-party AI model preference transitions from opted-out to opted-in (including after an opt-in → opt-out → opt-in cycle), **Then** the server resets my AI transparency notice seen status (whereas opting out or repeating an already-enabled opt-in preserves the seen status), the client cache for the AI notice is invalidated, and the notice is re-shown on the next user-visible AI suggestion without requiring a hard page reload.
- **AC-3 (Settings AI transparency surface & `fr`/`en` localisation parity — DR-12):** **Given** I open the Settings screen, **When** the Artificial Intelligence section renders, **Then** it displays an introductory transparency explanation above the third-party AI model toggle informing me that transactions are categorised automatically by default on-device or on the private server and that no data leaves that perimeter unless third-party models are explicitly enabled, and all AI notice and settings copy is localised in both French and English with complete key parity.
- **AC-4 (Multi-tenant isolation & WCAG 2.2 AA accessibility — NFR-7, NFR-12, NFR-15):** **Given** two distinct users User A and User B, **When** User A marks the AI transparency notice as seen or transitions from opt-out to opt-in, **Then** User B's seen status and third-party opt-in preference remain completely unaffected, and automated accessibility checks report zero WCAG 2.2 AA violations on both the AI transparency notice and the Artificial Intelligence settings section.
- **AC-5 (Quality & CI Gates):** **Given** the story implementation is complete, **When** the API test suite, Web test suite, linter, typechecker, and RLS migration audit run, **Then** all checks pass with zero errors.

## Tasks

- [x] Task 1: Reset `aiNoticeSeenAt` on `false → true` opt-in transition in `llm.repository.ts` and cover with unit + two-tenant isolation tests in `llm-ai-notice.test.ts` [AC: AC-2, AC-4]
- [x] Task 2: Wire `llmTags.optIn()` → `llmKeys.aiNotice()` cache invalidation in `keys.ts`, test in `use-llm-opt-in.test.tsx`, and add `fr`/`en` i18n keys in `fr.json` and `en.json` [AC: AC-2, AC-3]
- [x] Task 3: Upgrade `AiTransparencyNotice` (latched visibility, accessible dismiss button, re-trigger reset, i18n) and `LlmOptInToggle` (UX SSOT intro paragraph) with unit + `vitest-axe` tests in `ai-transparency-notice.test.tsx` [AC: AC-1, AC-2, AC-3, AC-4]
- [ ] Task 4: Run full monorepo verification suite (`@pekulo/api` tests, `@pekulo/web` tests, `lint`, `typecheck`, `db:rls-migration-audit`) [AC: AC-5]

## Dev Notes

- **Commit Prefix Convention:** `feat(#52): <summary>` (GitHub Issues integration, branch `feature/52-11-5-ai-transparency-notice`).
- **Architecture & Regulatory Traceability:**
  - **DR-12 (EU AI Act transparency notice):** Surface an AI transparency notice the first time the LLM subsystem produces or auto-applies a user-visible category suggestion, informing the user that an AI categorised their transactions and that any category can be reviewed and corrected at any time; re-show the notice on `opt-out → opt-in` transitions.
  - **UX SSOT (`docs/ux-preview/src/App.tsx:1770-1785` — lesson `2026-05-17`):** In `SettingsScreen`, the `Intelligence artificielle` section includes an introductory transparency paragraph (`"Pekulo catégorise vos transactions automatiquement. Les modèles tournent par défaut sur votre appareil (Apple Intelligence) ou notre serveur privé (Ollama). Aucune donnée ne quitte ce périmètre sauf si vous activez explicitement les modèles tiers ci-dessous."`) above the third-party toggle.
  - **Multi-tenant Isolation (ADR-0013 / lesson `2026-05-27`):** All `llmOptIn` queries in `llm.repository.ts` filter by `where: { userId }`, and `llm-ai-notice.test.ts` includes a two-user (`user-a` vs `user-b`) isolation test proving User A's `opt-out → opt-in` reset and `markAiNoticeSeen` never affect User B.
  - **Hydration & TanStack Query Cache Discipline (lessons `2026-05-20` & `2026-05-24`):** Both `AiTransparencyNotice` and `LlmOptInToggle` stay hydration-guarded (`isHydrated`), and `useSetLlmOptIn` invalidates `llmKeys.aiNotice()` through the central `setTagRegistry` in `apps/web/src/lib/zapaction/keys.ts` — never via raw `queryClient` calls in components.

### Task 1: Reset `aiNoticeSeenAt` on `false → true` opt-in transition in `llm.repository.ts` and cover with unit + two-tenant isolation tests in `llm-ai-notice.test.ts` [AC: AC-2, AC-4]

1. **Files:**
   - Modify `apps/api/src/modules/llm/llm.repository.ts`
   - Modify `apps/api/src/modules/llm/llm-ai-notice.test.ts`

2. **Full Code — `apps/api/src/modules/llm/llm.repository.ts`:**

```ts
// apps/api/src/modules/llm/llm.repository.ts
// Prisma persistence for the LLM module (story 6-1). Append-only writes to
// llm_call_log (NFR-26). Reads llm_opt_in (default false when no row). Every
// query carries `where: { userId }` (ADR-0013 + no-prisma-query-without-user-id).
// This is the ONLY place `llmCallLog.create` may appear (architecture L691).
import type { PrismaService } from "../../database";
import type { LlmCallEvent, LlmCallLogEntry } from "@pekulo/types";

export interface LlmRepository {
  recordCallEvent(userId: string, event: LlmCallEvent): Promise<void>;
  /** Append a set of events as a SINGLE transaction. Used by the attest path
   * (ADR-0008) so an intent+outcome pair can never half-commit (orphan intent
   * row on a crash between the two writes). */
  recordCallEvents(userId: string, events: LlmCallEvent[]): Promise<void>;
  isThirdPartyOptedIn(userId: string): Promise<boolean>;
  /** Set the per-user third-party opt-in flag (story 6-3, FR-34). Upserts the
   * single `llm_opt_in` row keyed on the UNIQUE(user_id) index and returns the
   * persisted value. Sole opt-in writer. Story 11-5 (DR-12 / AC-2): when
   * transitioning from opt-out (`false`) to opt-in (`true`), resets
   * `ai_notice_seen_at` to `null` so the AI transparency notice is re-shown on
   * the next suggestion. */
  setThirdPartyOptIn(userId: string, value: boolean): Promise<boolean>;
  /** Story 6-4 / 11-5 (DR-12) — has the user seen the AI transparency notice? */
  getAiNoticeSeen(userId: string): Promise<boolean>;
  /** Story 6-4 / 11-5 (DR-12) — stamp ai_notice_seen_at = now (P2002-safe upsert). */
  markAiNoticeSeen(userId: string): Promise<void>;
  listRecentByUser(userId: string, since: Date): Promise<LlmCallLogEntry[]>;
  /** Story 6-5 (FR-36) — the 90-day activity log lists COMPLETED calls only.
   * Same keyset window + 200-row cap as listRecentByUser, narrowed to
   * phase "outcome" so every row carries route + latencyMs + outcome (intent
   * rows have null latency/outcome). NEVER returns the prompt body (NFR-26). */
  listRecentOutcomesByUser(userId: string, since: Date): Promise<LlmCallLogEntry[]>;
}

export function createLlmRepository(deps: { prismaService: PrismaService }): LlmRepository {
  const db = deps.prismaService.client;
  // The ONLY `llmCallLog.create` call site (architecture L691). Both the single
  // and the transactional writers funnel through this builder so the single-
  // writer grep gate stays at one create call.
  function createCallEvent(userId: string, event: LlmCallEvent) {
    return db.llmCallLog.create({
      data: {
        userId,
        callId: event.callId,
        phase: event.phase,
        route: event.route,
        labelHash: event.labelHash,
        latencyMs: event.phase === "outcome" ? event.latencyMs : null,
        outcome: event.phase === "outcome" ? event.outcome : null,
        // `id` is injected at create time by the prefixed-ids extension
        // (llm_<base62>), so it is intentionally absent here. The cast mirrors
        // transactions.repository — Prisma's generated type still demands it.
      } as unknown as Parameters<typeof db.llmCallLog.create>[0]["data"],
    });
  }
  return {
    async recordCallEvent(userId, event) {
      await createCallEvent(userId, event);
    },
    async recordCallEvents(userId, events) {
      await db.$transaction(events.map((event) => createCallEvent(userId, event)));
    },
    async isThirdPartyOptedIn(userId) {
      const row = await db.llmOptIn.findUnique({
        where: { userId },
        select: { thirdParty: true },
      });
      return row?.thirdParty ?? false;
    },
    async setThirdPartyOptIn(userId, value) {
      // Story 11-5 (DR-12 / AC-2): re-show the AI transparency notice when
      // transitioning from opt-out (false / absent) to opt-in (true). Idempotent
      // `true -> true` calls and `true -> false` opt-outs preserve aiNoticeSeenAt.
      const existing = await db.llmOptIn.findUnique?.({
        where: { userId },
        select: { thirdParty: true },
      });
      const resetNotice = value && existing?.thirdParty !== true;
      const updateData = resetNotice
        ? { thirdParty: value, aiNoticeSeenAt: null }
        : { thirdParty: value };
      try {
        const row = await db.llmOptIn.upsert({
          where: { userId },
          // `id` is injected by the prefixed-ids extension at create time
          // (llmo_<base62>), so it is intentionally absent here — same cast
          // as createCallEvent. Prisma's generated type still demands it.
          create: {
            userId,
            thirdParty: value,
          } as unknown as Parameters<typeof db.llmOptIn.upsert>[0]["create"],
          update: updateData,
          select: { thirdParty: true },
        });
        return row.thirdParty;
      } catch (err) {
        // Two concurrent first-time opt-ins both find no row and race the
        // create branch; the loser hits the UNIQUE(user_id) index. Re-apply as
        // an update (lesson 2026-05-27 — find-or-create P2002 re-read). Duck-typed
        // code check mirrors realestate.repository.ts:203 / transactions:359.
        if ((err as { code?: string }).code === "P2002") {
          const row = await db.llmOptIn.update({
            where: { userId },
            data: updateData,
            select: { thirdParty: true },
          });
          return row.thirdParty;
        }
        throw err;
      }
    },
    async getAiNoticeSeen(userId) {
      const row = await db.llmOptIn.findUnique({
        where: { userId },
        select: { aiNoticeSeenAt: true },
      });
      return row?.aiNoticeSeenAt != null;
    },
    async markAiNoticeSeen(userId) {
      const now = new Date();
      try {
        await db.llmOptIn.upsert({
          where: { userId },
          create: { userId, aiNoticeSeenAt: now } as unknown as Parameters<
            typeof db.llmOptIn.upsert
          >[0]["create"],
          update: { aiNoticeSeenAt: now },
        });
      } catch (err) {
        if ((err as { code?: string }).code === "P2002") {
          await db.llmOptIn.update({ where: { userId }, data: { aiNoticeSeenAt: now } });
          return;
        }
        throw err;
      }
    },
    async listRecentByUser(userId, since) {
      const rows = await db.llmCallLog.findMany({
        where: { userId, createdAt: { gte: since } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 200,
      });
      return rows.map((r) => ({
        id: r.id as LlmCallLogEntry["id"],
        callId: r.callId,
        phase: r.phase as "intent" | "outcome",
        route: r.route,
        latencyMs: r.latencyMs,
        outcome: (r.outcome as LlmCallLogEntry["outcome"]) ?? null,
        occurredAt: r.occurredAt.toISOString(),
      }));
    },
    async listRecentOutcomesByUser(userId, since) {
      // Keyset order is by createdAt (index-backed: llm_call_log_user_created_idx);
      // the DTO/UI displays occurredAt (AC-1). The single writer (createCallEvent)
      // never sets occurredAt, so both columns default to the same INSERT clock →
      // displayed order == sort order. INVARIANT: if a future writer ever stamps
      // occurredAt ≠ createdAt, switch this orderBy to occurredAt (or surface
      // createdAt in the DTO) so "most-recent-first" still holds on the displayed field.
      const rows = await db.llmCallLog.findMany({
        where: { userId, phase: "outcome", createdAt: { gte: since } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 200,
      });
      return rows.map((r) => ({
        id: r.id as LlmCallLogEntry["id"],
        callId: r.callId,
        phase: r.phase as "intent" | "outcome",
        route: r.route,
        latencyMs: r.latencyMs,
        outcome: (r.outcome as LlmCallLogEntry["outcome"]) ?? null,
        occurredAt: r.occurredAt.toISOString(),
      }));
    },
  };
}
```

3. **Full Code — `apps/api/src/modules/llm/llm-ai-notice.test.ts`:**

```ts
import { describe, expect, test, mock } from "bun:test";
import { createLlmRepository } from "./llm.repository";

interface StoredRow {
  userId: string;
  thirdParty: boolean;
  aiNoticeSeenAt: Date | null;
}

function makeStatefulRepo() {
  const rows = new Map<string, StoredRow>();
  const repo = createLlmRepository({
    prismaService: {
      client: {
        llmOptIn: {
          findUnique: mock(async ({ where }: { where: { userId: string } }) => {
            return rows.get(where.userId) ?? null;
          }),
          upsert: mock(
            async ({
              where,
              create,
              update,
            }: {
              where: { userId: string };
              create: Partial<StoredRow> & { userId: string };
              update: Partial<StoredRow>;
            }) => {
              const current = rows.get(where.userId);
              const next: StoredRow = current
                ? {
                    ...current,
                    ...(update.thirdParty !== undefined ? { thirdParty: update.thirdParty } : {}),
                    ...(update.aiNoticeSeenAt !== undefined
                      ? { aiNoticeSeenAt: update.aiNoticeSeenAt }
                      : {}),
                  }
                : {
                    userId: create.userId,
                    thirdParty: create.thirdParty ?? false,
                    aiNoticeSeenAt: create.aiNoticeSeenAt ?? null,
                  };
              rows.set(where.userId, next);
              return next;
            },
          ),
          update: mock(
            async ({
              where,
              data,
            }: {
              where: { userId: string };
              data: Partial<StoredRow>;
            }) => {
              const current = rows.get(where.userId) ?? {
                userId: where.userId,
                thirdParty: false,
                aiNoticeSeenAt: null,
              };
              const next: StoredRow = {
                ...current,
                ...(data.thirdParty !== undefined ? { thirdParty: data.thirdParty } : {}),
                ...(data.aiNoticeSeenAt !== undefined
                  ? { aiNoticeSeenAt: data.aiNoticeSeenAt }
                  : {}),
              };
              rows.set(where.userId, next);
              return next;
            },
          ),
        },
      },
    },
  } as never);
  return { repo, rows };
}

describe("ai-notice flag (6-4 + 11-5)", () => {
  test("getAiNoticeSeen → false when no row / null timestamp", async () => {
    const findUnique = mock(async () => null);
    const repo = createLlmRepository({
      prismaService: { client: { llmOptIn: { findUnique } } },
    } as never);
    expect(await repo.getAiNoticeSeen("u1")).toBe(false);
  });

  test("getAiNoticeSeen → true when ai_notice_seen_at is set", async () => {
    const findUnique = mock(async () => ({ aiNoticeSeenAt: new Date() }));
    const repo = createLlmRepository({
      prismaService: { client: { llmOptIn: { findUnique } } },
    } as never);
    expect(await repo.getAiNoticeSeen("u1")).toBe(true);
  });

  test("markAiNoticeSeen upserts with ai_notice_seen_at", async () => {
    const upsert = mock(async (_args: { where: unknown; update: Record<string, unknown> }) => ({}));
    const repo = createLlmRepository({
      prismaService: { client: { llmOptIn: { upsert } } },
    } as never);
    await repo.markAiNoticeSeen("u1");
    const [arg] = upsert.mock.calls[0] as [{ where: unknown; update: Record<string, unknown> }];
    expect(arg.where).toMatchObject({ userId: "u1" });
    expect(arg.update.aiNoticeSeenAt).toBeInstanceOf(Date);
  });

  test("11-5 AC-2: opt-in → opt-out → opt-in resets ai_notice_seen_at so the notice is re-shown", async () => {
    const { repo } = makeStatefulRepo();

    // Initial state: user sees first-time notice and opts in
    await repo.setThirdPartyOptIn("u1", true);
    await repo.markAiNoticeSeen("u1");
    expect(await repo.getAiNoticeSeen("u1")).toBe(true);

    // Opt-out (true → false): does NOT reset aiNoticeSeenAt while opted out
    await repo.setThirdPartyOptIn("u1", false);
    expect(await repo.getAiNoticeSeen("u1")).toBe(true);

    // Re-opt-in (false → true): resets aiNoticeSeenAt to null so notice re-triggers
    await repo.setThirdPartyOptIn("u1", true);
    expect(await repo.getAiNoticeSeen("u1")).toBe(false);

    // Once marked seen again, an idempotent setThirdPartyOptIn(true) preserves seen=true
    await repo.markAiNoticeSeen("u1");
    expect(await repo.getAiNoticeSeen("u1")).toBe(true);
    await repo.setThirdPartyOptIn("u1", true);
    expect(await repo.getAiNoticeSeen("u1")).toBe(true);
  });

  test("11-5 AC-4: two-user isolation — user A opt-out → opt-in and markAiNoticeSeen never mutate user B", async () => {
    const { repo } = makeStatefulRepo();

    await repo.setThirdPartyOptIn("user-a", true);
    await repo.markAiNoticeSeen("user-a");
    await repo.setThirdPartyOptIn("user-b", true);
    await repo.markAiNoticeSeen("user-b");

    expect(await repo.getAiNoticeSeen("user-a")).toBe(true);
    expect(await repo.getAiNoticeSeen("user-b")).toBe(true);

    // User A cycles opt-out → opt-in: User A resets to unseen, User B stays seen
    await repo.setThirdPartyOptIn("user-a", false);
    await repo.setThirdPartyOptIn("user-a", true);

    expect(await repo.getAiNoticeSeen("user-a")).toBe(false);
    expect(await repo.getAiNoticeSeen("user-b")).toBe(true);
    expect(await repo.isThirdPartyOptedIn("user-b")).toBe(true);
  });
});
```

4. **Test Command:**

```bash
bun --filter='@pekulo/api' test src/modules/llm/llm-ai-notice.test.ts src/modules/llm/llm-opt-in.test.ts
```

5. **Expected Output:**
   - `11 pass, 0 fail` across `llm-ai-notice.test.ts` (5 tests) and `llm-opt-in.test.ts` (6 tests).

6. **Commit Step:**

```bash
git add apps/api/src/modules/llm/llm.repository.ts apps/api/src/modules/llm/llm-ai-notice.test.ts && git commit -m "feat(#52): reset ai_notice_seen_at on opt-out to opt-in transition"
```

---

### Task 2: Wire `llmTags.optIn()` → `llmKeys.aiNotice()` cache invalidation in `keys.ts`, test in `use-llm-opt-in.test.tsx`, and add `fr`/`en` i18n keys in `fr.json` and `en.json` [AC: AC-2, AC-3]

1. **Files:**
   - Modify `apps/web/src/lib/zapaction/keys.ts`
   - Modify `apps/web/src/app/(cap)/dashboard/_llm/_hooks/use-llm-opt-in.test.tsx`
   - Modify `apps/web/messages/fr.json`
   - Modify `apps/web/messages/en.json`

2. **Full Code — `apps/web/src/lib/zapaction/keys.ts`:**

```ts
import { createFeatureKeys, createFeatureTags } from "@zapaction/core";
import { setTagRegistry } from "@zapaction/query";

// Tag registry — only features whose hooks actually consume the keys live
// here. Forward-pointer features (monthly, transactions, portfolio aggregate,
// lots) were removed during the D3 audit pass: their api routes aren't
// mounted (see lib/orpc/modules.ts), no hook reads from them, and their
// setTagRegistry entries fired no-op invalidations. Each story that adds
// the corresponding read/write path re-introduces its keys + tags + registry
// edges here.

export const hypothesesKeys = createFeatureKeys("hypotheses", {
  current: () => ["current"] as const,
  // Story 7-3 — the projection curve read. currentWealth is part of the key
  // (like milestonesKeys.statuses) so a wealth change refetches naturally.
  projection: (currentWealth: number) => ["projection", currentWealth] as const,
});
export const hypothesesTags = createFeatureTags("hypotheses", {
  current: () => ["current"] as const,
});

export const compassKeys = createFeatureKeys("compass", {
  current: () => ["current"] as const,
  setup: () => ["setup"] as const,
  progress: () => ["progress"] as const,
  curve: () => ["curve"] as const,
  history: (limit?: number) => ["history", limit ?? 50] as const,
});
export const compassTags = createFeatureTags("compass", {
  current: () => ["current"] as const,
});

export const milestonesKeys = createFeatureKeys("milestones", {
  list: () => ["list"] as const,
  statuses: (currentWealth: number) => ["statuses", currentWealth] as const,
});
export const milestonesTags = createFeatureTags("milestones", {
  list: () => ["list"] as const,
});

export const accountsKeys = createFeatureKeys("accounts", {
  list: () => ["list"] as const,
});
export const accountsTags = createFeatureTags("accounts", {
  list: () => ["list"] as const,
});

// Story 6-3 — third-party LLM opt-in (FR-34). Single `optIn` read; the toggle
// mutation invalidates it via the registry edge below. Story 6-5 (FR-36) adds
// `activityLog` — a read-only audit query with NO write path on the web tier
// (categorisation is server-side fire-and-forget), so it needs a key but NO
// tag and NO setTagRegistry edge: it refreshes on staleTime, never on a
// client mutation.
export const llmKeys = createFeatureKeys("llm", {
  optIn: () => ["optIn"] as const,
  aiNotice: () => ["aiNotice"] as const,
  activityLog: () => ["activityLog"] as const,
});
export const llmTags = createFeatureTags("llm", {
  optIn: () => ["optIn"] as const,
  aiNotice: () => ["aiNotice"] as const,
});

const HOLDINGS_KEY = "holdings" as const;
export const holdingsKeys = createFeatureKeys(HOLDINGS_KEY, {
  list: () => ["list"] as const,
  byId: (id: string) => ["byId", id] as const,
  derived: (id: string) => ["derived", id] as const,
});
export const holdingsTags = createFeatureTags(HOLDINGS_KEY, {
  list: () => ["list"] as const,
});

// Story 4-1 forward-pointer — realestate feature key set + tag registry.
// Stories 4-2 (derives) / 4-3 (UI) / 7-1 (dashboard) declare their
// invalidation edges against `realestateTags.list()` so the cache graph
// stays decoupled at the aggregate level.
export const REALESTATE_KEY = "realestate" as const;
export const realestateKeys = createFeatureKeys(REALESTATE_KEY, {
  list: () => ["list"] as const,
  // Story 4-2/4-3: `byId` consumed by `useProperty(id)` in 4-3 ; `valuations`
  // consumed by the cap-history panel in 4-3. Declared here so the
  // consuming hooks share the realestate prefix (review-supp L5).
  byId: (propertyId: string) => ["byId", propertyId] as const,
  valuations: (propertyId: string) => ["valuations", propertyId] as const,
});
export const realestateTags = createFeatureTags(REALESTATE_KEY, {
  list: () => ["list"] as const,
});

// Story 5-1 — transactions feature key set + tag registry. The block was
// removed during the D3 audit pass; re-introduced now that the transactions
// oRPC module is mounted. Stories 5-3 (transfer rule), 5-4 (monthly agg),
// 6-2 (LLM categorise), 7-1 (dashboard) declare their invalidation edges
// against `transactionsTags.list()` without further touching this file.
export const TRANSACTIONS_KEY = "transactions" as const;
export const transactionsKeys = createFeatureKeys(TRANSACTIONS_KEY, {
  // `limit`, `month` AND `page` are part of the queryKey: the Récentes section
  // (10/page, month-scoped, numbered) and any unscoped caller must not collide.
  // month ?? "all" = the pre-6-9 unscoped window; page ?? 1 = cursor mode / first
  // page. Mirrors compassKeys.history(limit?).
  list: (limit?: number, month?: string, page?: number) =>
    ["list", limit ?? 50, month ?? "all", page ?? 1] as const,
  byId: (id: string) => ["byId", id] as const,
  // Story 6-4 — pending-suggestion list. `page` is part of the queryKey so the
  // numbered pages cache independently (same reason as `list(limit)`). No new
  // registry edge needed: the transactionsTags.list() edge invalidates the bare
  // [TRANSACTIONS_KEY] prefix, which covers every ["pending", n] entry (confirming
  // refreshes Suggestions IA + Récentes across all loaded pages).
  // Story 6-9 ext — `month` joins the key so per-month pending caches separately
  // (month ?? "all" = the unscoped backlog). Bare-prefix invalidation unchanged.
  pending: (page?: number, month?: string) => ["pending", page ?? 1, month ?? "all"] as const,
  // Story 6-9 (FR-64) — month-scoped stat-card aggregate. month undefined =
  // the server-resolved default (latest activity month); keyed "default" so it
  // caches separately from explicit months and refreshes when activity changes.
  monthSummary: (month?: string) => ["monthSummary", month ?? "default"] as const,
});
export const transactionsTags = createFeatureTags(TRANSACTIONS_KEY, {
  list: () => ["list"] as const,
});

// Story 5-4 — monthly aggregate (FR-37/38). `get(year, monthNum)` is the
// granular query key. The `get` tag invalidates that exact month; any
// transactions mutation bulk-invalidates every month via the bare prefix
// in the transactions edge below (AC-5).
export const MONTHLY_KEY = "monthly" as const;
export const monthlyKeys = createFeatureKeys(MONTHLY_KEY, {
  get: (year: number, monthNum: number) => ["get", year, monthNum] as const,
  list: (limit: number) => ["list", limit] as const,
});
export const monthlyTags = createFeatureTags(MONTHLY_KEY, {
  all: () => [] as const,
  get: (year: number, monthNum: number) => ["get", year, monthNum] as const,
});

// Story 5-6 — Bridge bank connections list (FR-60). Single read for now
// (listConnections), no byId; 5-7 may add a granular get when the settings UI
// surfaces per-connection details (status badge, lastRefreshedAt, etc.).
export const BANK_CONNECTIONS_KEY = "bankConnections" as const;
export const bankConnectionsKeys = createFeatureKeys(BANK_CONNECTIONS_KEY, {
  list: () => ["list"] as const,
});
export const bankConnectionsTags = createFeatureTags(BANK_CONNECTIONS_KEY, {
  list: () => ["list"] as const,
});

// Story 7-1 (FR-43/FR-44) — dashboard read-aggregator. Read-only feature: it
// has NO write path of its own, so it declares `dashboardKeys` but NO
// `dashboardTags`. `overview` is invalidated BY every wealth-affecting
// feature's list tag via the registry edges below — recording a transaction,
// editing an account / holding / property, or changing the compass objectif
// all refresh the Cap view total wealth. Consumed by useDashboardOverview
// (read-only).
export const DASHBOARD_KEY = "dashboard" as const;
export const dashboardKeys = createFeatureKeys(DASHBOARD_KEY, {
  overview: () => ["overview"] as const,
  // Story 7-4 (FR-59) — the projection-vs-compass gap read. currentWealth is
  // part of the key (like hypothesesKeys.projection) so a wealth change
  // refetches naturally without a registry edge.
  hypothesisGap: (currentWealth: number) => ["hypothesisGap", currentWealth] as const,
});

// Story 7-2 (D6) — the per-user widget layout. Unlike the read-only overview,
// the layout HAS a write path (saveLayout), so it declares both keys AND tags;
// saving the layout invalidates only its own read (the wealth overview is
// untouched by a reorder/visibility change).
export const dashboardLayoutKeys = createFeatureKeys(DASHBOARD_KEY, {
  layout: () => ["layout"] as const,
});
export const dashboardLayoutTags = createFeatureTags(DASHBOARD_KEY, {
  current: () => ["layout"] as const,
});

// Story 8-2 (FR-51/FR-52) — per-user theme/lang preferences. updateTheme /
// updateLang invalidate the single `current` read so a server-persisted change
// survives a reload. The live client mirror is next-theme/next-intl; this key
// covers any RSC/hook that reads the persisted pref.
export const settingsKeys = createFeatureKeys("settings", {
  current: () => ["current"] as const,
});
export const settingsTags = createFeatureTags("settings", {
  current: () => ["current"] as const,
});

setTagRegistry({
  [dashboardLayoutTags.current()]: [dashboardLayoutKeys.layout()],
  [settingsTags.current()]: [settingsKeys.current()],
  [hypothesesTags.all()]: [
    hypothesesKeys.current(),
    ["hypotheses", "projection"],
    ["dashboard", "hypothesisGap"],
  ],
  [hypothesesTags.current()]: [
    hypothesesKeys.current(),
    ["hypotheses", "projection"],
    ["dashboard", "hypothesisGap"],
  ],
  // Compass — `current` invalidates every read of the compass aggregate
  // AND the milestones list (status badges + linear-plan derive depend on
  // the compass objectif / horizonYears ; a compass change ripples through
  // every status row). The edge was carried by manual onSuccess calls in
  // the pre-ZAP-1 hook ; codified here so the registry is the SSOT.
  [compassTags.all()]: [
    compassKeys.current(),
    compassKeys.setup(),
    compassKeys.progress(),
    compassKeys.curve(),
    compassKeys.history(),
    milestonesKeys.list(),
    dashboardKeys.overview(),
    ["dashboard", "hypothesisGap"],
  ],
  [compassTags.current()]: [
    compassKeys.current(),
    compassKeys.setup(),
    compassKeys.progress(),
    compassKeys.curve(),
    compassKeys.history(),
    milestonesKeys.list(),
    dashboardKeys.overview(),
    ["dashboard", "hypothesisGap"],
  ],
  // Milestones — `list` invalidates the milestones list + `compass.setup`
  // (the setup state is derived from "compass row exists AND ≥1 milestone",
  // so adding/removing a milestone flips it). Without this, the dashboard
  // stays on the setup CTA for staleTime (30s) after the first milestone
  // is added, defeating the inline AddMilestoneForm round-trip.
  [milestonesTags.all()]: [milestonesKeys.list(), compassKeys.setup()],
  [milestonesTags.list()]: [milestonesKeys.list(), compassKeys.setup()],
  [accountsTags.all()]: [accountsKeys.list(), dashboardKeys.overview()],
  [accountsTags.list()]: [accountsKeys.list(), dashboardKeys.overview()],
  // Story 6-3 + 11-5 (DR-12 / AC-2) — llm opt-in. The setLlmOptIn mutation
  // invalidates both the optIn read AND aiNotice so an opt-out → opt-in
  // transition immediately re-triggers the AI transparency notice without
  // waiting for useAiNotice's 60s staleTime.
  [llmTags.all()]: [llmKeys.optIn(), llmKeys.aiNotice()],
  [llmTags.optIn()]: [llmKeys.optIn(), llmKeys.aiNotice()],
  // Story 6-4 (DR-12) — markAiNotice invalidates the seen-state read.
  [llmTags.aiNotice()]: [llmKeys.aiNotice()],
  // Holdings — `list` invalidates the holdings list. Once the portfolio
  // aggregate ships its own read path, the cross-feature edge to
  // portfolioKeys.holdings + portfolioKeys.snapshot lands back here.
  [holdingsTags.all()]: [holdingsKeys.list(), dashboardKeys.overview()],
  [holdingsTags.list()]: [holdingsKeys.list(), dashboardKeys.overview()],
  // Realestate (story 4-1 + 4-2 + 4-3) — the `list` tag invalidates the
  // entire realestate read graph via the bare `[REALESTATE_KEY]` prefix.
  // TanStack's `invalidateQueries({queryKey:["realestate"]})` is inclusive
  // prefix-match, so this single edge covers `realestateKeys.list()`,
  // `byId(id)` AND `valuations(id)` in one shot — the 4-3 UI hooks
  // (useProperties / useListPropertyDerives / useProperty /
  // useListValuations) all subscribe to keys under the `realestate`
  // prefix. Surgical edges are not required at V1 scale (NFR-16: 50
  // properties / user). 7-1 dashboard shipped the
  // realestate/accounts/holdings/transactions/compass list →
  // `dashboardKeys.overview()` edges (read-only aggregate).
  //
  // 2026-05-22 aped-review fix — earlier shape mapped to
  // `realestateKeys.list()` only, which silently missed `byId` and
  // `valuations`; the 9 mutation hooks compensated with manual
  // `queryClient.invalidateQueries({queryKey:[REALESTATE_KEY]})` calls
  // that violated R3/R4 + lesson 2026-05-20 ("hooks consume zapaction,
  // never raw @tanstack/react-query"). Fixing the registry restores
  // the SSOT.
  [realestateTags.all()]: [[REALESTATE_KEY], dashboardKeys.overview()],
  [realestateTags.list()]: [[REALESTATE_KEY], dashboardKeys.overview()],
  // Transactions (story 5-1) — `list` invalidates the entire transactions
  // read graph via the bare `[TRANSACTIONS_KEY]` prefix (matches realestate
  // pattern at L130) AND `accountsKeys.list()` since a recorded transaction
  // affects the cash-balance display on the Patrimoine tab. Extended in 5-4
  // (AC-5) with `[MONTHLY_KEY]` so any transaction mutation re-derives the
  // monthly view — TanStack's prefix-match invalidates every monthly entry
  // under any (year, monthNum).
  [transactionsTags.all()]: [
    [TRANSACTIONS_KEY],
    accountsKeys.list(),
    [MONTHLY_KEY],
    dashboardKeys.overview(),
  ],
  [transactionsTags.list()]: [
    [TRANSACTIONS_KEY],
    accountsKeys.list(),
    [MONTHLY_KEY],
    dashboardKeys.overview(),
  ],
  // Monthly (story 5-4 + 5-5). The `get(0, 0)` stand-in carries the
  // structural shape; `all()` is the bulk edge that invalidates every
  // monthlyKeys.* slot via the bare `[MONTHLY_KEY]` prefix. Sign-off / reopen
  // mutations (5-5) pass `monthlyTags.all()` on their useActionMutation
  // invalidate option so both the per-month get cache AND the listMonthly
  // window cache refresh after the mutation resolves.
  [monthlyTags.all()]: [[MONTHLY_KEY]],
  [monthlyTags.get(0, 0)]: [monthlyKeys.get(0, 0)],
  // Story 5-6 — bank connections list. Successful completeConnection /
  // refreshConnection invalidates both the connections list AND the
  // transactions list (a Bridge import lands new transactions that should
  // surface in Récentes + cascade to monthly via the transactions edge).
  [bankConnectionsTags.list()]: [
    bankConnectionsKeys.list(),
    [TRANSACTIONS_KEY],
    accountsKeys.list(),
    [MONTHLY_KEY],
    dashboardKeys.overview(),
  ],
});
```

3. **Full Code — `apps/web/src/app/(cap)/dashboard/_llm/_hooks/use-llm-opt-in.test.tsx`:**

```tsx
import { describe, expect, test, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { llmKeys, llmTags } from "@/lib/zapaction/keys";

const setMock = vi.fn();
// Post-ZAP-1: useActionMutation reads `action.tags` to drive the tag-registry
// invalidation. Attach `.tags` via Object.assign so the registry edge runs.
vi.mock("../_actions/llm-actions", () => ({
  setLlmOptIn: Object.assign((input: { thirdParty: boolean }) => setMock(input), {
    tags: [llmTags.optIn()],
  }),
}));

import { useSetLlmOptIn } from "./use-llm-opt-in";

// AC-4 (story 6-3) + AC-2 (story 11-5):
// Toggling the third-party opt-in invalidates both llmKeys.optIn() AND
// llmKeys.aiNotice() so an opt-out → opt-in transition immediately re-triggers
// the AI transparency notice without waiting for useAiNotice's 60s staleTime.
describe("useSetLlmOptIn (6-3 AC-4 + 11-5 AC-2)", () => {
  test("success → invalidates llmKeys.optIn() and llmKeys.aiNotice()", async () => {
    setMock.mockReset().mockResolvedValueOnce({ thirdParty: true });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(llmKeys.optIn(), { thirdParty: false });
    client.setQueryData(llmKeys.aiNotice(), { seen: true });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useSetLlmOptIn(), { wrapper });
    result.current.mutate({ thirdParty: true });
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: llmKeys.optIn() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: llmKeys.aiNotice() });
  });
});
```

4. **Full Code — `apps/web/messages/fr.json` (`"llm"` namespace block at lines 551–586, replacing lines 551–574 of `apps/web/messages/fr.json`):**

```json
  "llm": {
    "activityLog": {
      "title": "Journal d'activité IA",
      "ariaLabel": "Journal d'activité de l'IA sur 90 jours",
      "loading": "Chargement…",
      "empty": "Aucun appel IA sur les 90 derniers jours.",
      "paginationAriaLabel": "Pagination du journal d'activité IA",
      "outcomeSuccess": "Réussi",
      "outcomeFailure": "Échec",
      "outcomeOverridden": "Modifié"
    },
    "optIn": {
      "title": "Intelligence artificielle",
      "ariaLabel": "Paramètres d'intelligence artificielle",
      "intro": "Pekulo catégorise vos transactions automatiquement. Les modèles tournent par défaut sur votre appareil (Apple Intelligence) ou notre serveur privé (Ollama). Aucune donnée ne quitte ce périmètre sauf si vous activez explicitement les modèles tiers ci-dessous.",
      "toggleLabel": "Modèles d'IA tiers",
      "toggleSub": "Autoriser l'envoi de certaines transactions à une API tierce (Mistral, hébergée en UE) pour la catégorisation. Désactivé par défaut.",
      "loading": "Chargement…"
    },
    "aiNotice": {
      "ariaLabel": "Information sur l'intelligence artificielle",
      "body": "Vos catégories peuvent être suggérées — ou, pour vos imports (CSV / banque), appliquées automatiquement — par un modèle d'IA. Vous gardez le dernier mot : chaque catégorie reste modifiable à tout moment. Aucune donnée n'est envoyée à un modèle tiers sans votre accord (Paramètres → Intelligence artificielle).",
      "dismiss": "Compris",
      "dismissAriaLabel": "Compris — fermer l'information sur l'intelligence artificielle"
    },
    "activityLogLink": {
      "title": "Journal d'activité IA",
      "ariaLabel": "Accès au journal d'activité de l'IA",
      "linkText": "Voir le journal d'activité IA (90 derniers jours) →"
    }
  },
```

5. **Full Code — `apps/web/messages/en.json` (`"llm"` namespace block at lines 551–586, replacing lines 551–574 of `apps/web/messages/en.json`):**

```json
  "llm": {
    "activityLog": {
      "title": "AI activity log",
      "ariaLabel": "90-day AI activity log",
      "loading": "Loading…",
      "empty": "No AI calls in the last 90 days.",
      "paginationAriaLabel": "AI activity log pagination",
      "outcomeSuccess": "Succeeded",
      "outcomeFailure": "Failed",
      "outcomeOverridden": "Overridden"
    },
    "optIn": {
      "title": "Artificial intelligence",
      "ariaLabel": "Artificial intelligence settings",
      "intro": "Pekulo categorizes your transactions automatically. Models run by default on your device (Apple Intelligence) or our private server (Ollama). No data leaves this perimeter unless you explicitly enable third-party models below.",
      "toggleLabel": "Third-party AI models",
      "toggleSub": "Allow sending certain transactions to a third-party API (Mistral, hosted in the EU) for categorization. Off by default.",
      "loading": "Loading…"
    },
    "aiNotice": {
      "ariaLabel": "Information about artificial intelligence",
      "body": "Your categories may be suggested — or, for your imports (CSV / bank), applied automatically — by an AI model. You stay in control: every category remains editable at any time. No data is sent to a third-party model without your consent (Settings → Artificial intelligence).",
      "dismiss": "Got it",
      "dismissAriaLabel": "Got it — dismiss artificial intelligence notice"
    },
    "activityLogLink": {
      "title": "AI activity log",
      "ariaLabel": "Open the AI activity log",
      "linkText": "View the AI activity log (last 90 days) →"
    }
  },
```

6. **Test Command:**

```bash
bun --filter='@pekulo/web' test src/app/\(cap\)/dashboard/_llm/_hooks/use-llm-opt-in.test.tsx
```

7. **Expected Output:**
   - `1 passed (1)` in `use-llm-opt-in.test.tsx`.

8. **Commit Step:**

```bash
git add apps/web/src/lib/zapaction/keys.ts apps/web/src/app/\(cap\)/dashboard/_llm/_hooks/use-llm-opt-in.test.tsx apps/web/messages/fr.json apps/web/messages/en.json && git commit -m "feat(#52): invalidate aiNotice on opt-in change and add AI notice i18n keys"
```

---

### Task 3: Upgrade `AiTransparencyNotice` (latched visibility, accessible dismiss button, re-trigger reset, i18n) and `LlmOptInToggle` (UX SSOT intro paragraph) with unit + `vitest-axe` tests in `ai-transparency-notice.test.tsx` [AC: AC-1, AC-2, AC-3, AC-4]

1. **Files:**
   - Modify `apps/web/src/app/(cap)/dashboard/_llm/_components/ai-transparency-notice.tsx`
   - Modify `apps/web/src/app/(cap)/dashboard/_llm/_components/llm-opt-in-toggle.tsx`
   - Modify `apps/web/src/app/(cap)/dashboard/_llm/_components/ai-transparency-notice.test.tsx`

2. **Full Code — `apps/web/src/app/(cap)/dashboard/_llm/_components/ai-transparency-notice.tsx`:**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Text, View } from "@pekulo/ui/client";
import { PekuloButton } from "@pekulo/ui";
import { Sparkles } from "lucide-react";
import { useAiNotice, useMarkAiNotice } from "../_hooks/use-ai-notice";

// Story 6-4 (DR-12 / AC-3) + 6-7 (FR-33 amended / AC-2) + 11-5 (EU AI Act
// transparency notice lifecycle & opt-out → opt-in re-trigger).
// Shown when the user first encounters AI categorisation (or after an
// opt-out → opt-in transition resets ai_notice_seen_at to null).
// Marks itself seen server-side on first appearance so reloads do not re-show
// it, while latching visibility locally until the user clicks the dismiss
// button (preventing the post-markAiNotice cache refetch from unmounting the
// banner before the user reads or dismisses it).
export function AiTransparencyNotice() {
  const t = useTranslations("llm");
  const { data, isLoading } = useAiNotice();
  const markSeen = useMarkAiNotice();
  const [isHydrated, setIsHydrated] = useState(false);
  const [latchedVisible, setLatchedVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const markedCycleRef = useRef(false);

  useEffect(() => setIsHydrated(true), []);

  // Default to seen until the read resolves → no flash for returning users.
  const seen = data?.seen ?? true;
  const serverUnseen = isHydrated && !isLoading && !seen;

  useEffect(() => {
    if (serverUnseen && !markedCycleRef.current) {
      markedCycleRef.current = true;
      setLatchedVisible(true);
      setDismissed(false);
      if (!markSeen.isPending) {
        markSeen.mutate(undefined);
      }
    } else if (!serverUnseen && dismissed) {
      // Ready to re-arm if a future opt-out → opt-in flips data.seen back to false
      markedCycleRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverUnseen, dismissed]);

  const isVisible = (serverUnseen || latchedVisible) && !dismissed;
  if (!isVisible) return null;

  const handleDismiss = () => {
    setDismissed(true);
    setLatchedVisible(false);
    markedCycleRef.current = false;
  };

  return (
    <View
      role="note"
      aria-label={t("aiNotice.ariaLabel")}
      flexDirection="row"
      gap="$3"
      alignItems="flex-start"
      justifyContent="space-between"
      padding="$3"
      marginBottom="$2"
      borderRadius="$4"
      backgroundColor="$backgroundMuted"
    >
      <View flexDirection="row" gap="$2" alignItems="flex-start" flex={1}>
        <Sparkles size={14} color="var(--colorSecondary)" aria-hidden />
        <Text color="$colorSecondary" fontSize="$xs" flex={1}>
          {t("aiNotice.body")}
        </Text>
      </View>
      <PekuloButton
        variant="ghost"
        size="xs"
        data-testid="ai-transparency-notice-dismiss"
        aria-label={t("aiNotice.dismissAriaLabel")}
        onClick={handleDismiss}
      >
        {t("aiNotice.dismiss")}
      </PekuloButton>
    </View>
  );
}
```

3. **Full Code — `apps/web/src/app/(cap)/dashboard/_llm/_components/llm-opt-in-toggle.tsx`:**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Text, View } from "@pekulo/ui/client";
import { PekuloToggleRow, Section } from "@pekulo/ui";
import { useLlmOptIn, useSetLlmOptIn } from "../_hooks/use-llm-opt-in";

// Story 6-3 (FR-34 / NFR-13 / DR-7) + 11-5 (DR-12 parametres-side surface,
// aligned with docs/ux-preview/src/App.tsx:1771-1775) — the "Intelligence
// artificielle" settings section. The server is the single source of truth for
// the opt-in (read via useLlmOptIn); the toggle writes via useSetLlmOptIn and
// the registry invalidates both optIn and aiNotice reads. Default OFF until
// the read resolves. Hydration-guarded (lessons.md 2026-05-24).
export function LlmOptInToggle() {
  const t = useTranslations("llm");
  const { data, isLoading, error } = useLlmOptIn();
  const setOptIn = useSetLlmOptIn();
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => setIsHydrated(true), []);
  const showLoading = !isHydrated || isLoading;
  const checked = data?.thirdParty ?? false;
  return (
    <Section title={t("optIn.title")} ariaLabel={t("optIn.ariaLabel")}>
      <Text color="$colorSecondary" fontSize="$bodySm" marginBottom="$4">
        {t("optIn.intro")}
      </Text>
      <PekuloToggleRow
        label={t("optIn.toggleLabel")}
        sub={t("optIn.toggleSub")}
        checked={checked}
        disabled={showLoading || setOptIn.isPending}
        onChange={(v) => setOptIn.mutate({ thirdParty: v })}
      />
      {showLoading && (
        // Visually-hidden live region so AT hears why the switch is inert while
        // the server opt-in resolves (mirrors compass-history-panel.tsx).
        <View
          role="status"
          aria-live="polite"
          position="absolute"
          width={1}
          height={1}
          overflow="hidden"
        >
          <Text color="$colorTertiary" fontSize="$caption">
            {t("optIn.loading")}
          </Text>
        </View>
      )}
      {error && !showLoading && (
        <Text role="alert" color="$danger" fontSize="$caption">
          {error.message}
        </Text>
      )}
    </Section>
  );
}
```

4. **Full Code — `apps/web/src/app/(cap)/dashboard/_llm/_components/ai-transparency-notice.test.tsx`:**

```tsx
import { afterEach, describe, expect, test, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import { renderWithTamagui } from "../../../../../../test/setup";
import fr from "../../../../../../messages/fr.json";
import en from "../../../../../../messages/en.json";

const { aiNoticeMock, markMutate, optInMock, setOptInMutate } = vi.hoisted(() => ({
  aiNoticeMock: vi.fn(),
  markMutate: vi.fn(),
  optInMock: vi.fn(),
  setOptInMutate: vi.fn(),
}));
vi.mock("../_hooks/use-ai-notice", () => ({
  useAiNotice: () => aiNoticeMock(),
  useMarkAiNotice: () => ({ mutate: markMutate, isPending: false }),
}));
vi.mock("../_hooks/use-llm-opt-in", () => ({
  useLlmOptIn: () => optInMock(),
  useSetLlmOptIn: () => ({ mutate: setOptInMutate, isPending: false }),
}));

import { AiTransparencyNotice } from "./ai-transparency-notice";
import { LlmOptInToggle } from "./llm-opt-in-toggle";

afterEach(() => {
  aiNoticeMock.mockReset();
  markMutate.mockReset();
  optInMock.mockReset();
  setOptInMutate.mockReset();
});

describe("AiTransparencyNotice (6-4 AC-3 + 6-7 AC-2 + 11-5 AC-1/AC-2/AC-3/AC-4)", () => {
  test("renders nothing when the server flag says it was already seen", () => {
    aiNoticeMock.mockReturnValue({ data: { seen: true }, isLoading: false });
    renderWithTamagui(<AiTransparencyNotice />);
    expect(screen.queryByRole("note")).toBeNull();
    expect(markMutate).not.toHaveBeenCalled();
  });

  test("renders nothing while the read is loading (no flash for returning users)", () => {
    aiNoticeMock.mockReturnValue({ data: undefined, isLoading: true });
    renderWithTamagui(<AiTransparencyNotice />);
    expect(screen.queryByRole("note")).toBeNull();
    expect(markMutate).not.toHaveBeenCalled();
  });

  test("shows the notice and marks it seen exactly once when never seen before", async () => {
    aiNoticeMock.mockReturnValue({ data: { seen: false }, isLoading: false });
    renderWithTamagui(<AiTransparencyNotice />);
    expect(await screen.findByRole("note")).toBeInTheDocument();
    await waitFor(() => expect(markMutate).toHaveBeenCalledTimes(1));
  });

  test("6-7 — the copy states categories can be applied automatically and stay editable (AC-2)", async () => {
    aiNoticeMock.mockReturnValue({ data: { seen: false }, isLoading: false });
    renderWithTamagui(<AiTransparencyNotice />);
    const note = await screen.findByRole("note");
    expect(note.textContent).toContain("appliquées automatiquement");
    expect(note.textContent).toContain("modifiable");
  });

  test("11-5 AC-1 — stays visible after markAiNotice refetch (seen: true) until user clicks dismiss", async () => {
    aiNoticeMock.mockReturnValue({ data: { seen: false }, isLoading: false });
    const { rerender } = renderWithTamagui(<AiTransparencyNotice />);
    expect(await screen.findByRole("note")).toBeInTheDocument();

    // Simulate the query cache refetching `{ seen: true }` after markAiNotice settles
    aiNoticeMock.mockReturnValue({ data: { seen: true }, isLoading: false });
    rerender(<AiTransparencyNotice />);
    expect(screen.getByRole("note")).toBeInTheDocument();

    // Clicking the dismiss button hides the notice
    fireEvent.click(screen.getByTestId("ai-transparency-notice-dismiss"));
    expect(screen.queryByRole("note")).toBeNull();
  });

  test("11-5 AC-2 — re-shows the notice after opt-out → opt-in resets server seen to false", async () => {
    aiNoticeMock.mockReturnValue({ data: { seen: false }, isLoading: false });
    const { rerender } = renderWithTamagui(<AiTransparencyNotice />);
    expect(await screen.findByRole("note")).toBeInTheDocument();
    expect(markMutate).toHaveBeenCalledTimes(1);

    // Server marks seen + user dismisses the banner
    aiNoticeMock.mockReturnValue({ data: { seen: true }, isLoading: false });
    fireEvent.click(screen.getByTestId("ai-transparency-notice-dismiss"));
    expect(screen.queryByRole("note")).toBeNull();

    // User opts out then opts back in → server resets seen to false
    aiNoticeMock.mockReturnValue({ data: { seen: false }, isLoading: false });
    rerender(<AiTransparencyNotice />);
    expect(await screen.findByRole("note")).toBeInTheDocument();
    await waitFor(() => expect(markMutate).toHaveBeenCalledTimes(2));
  });

  test("11-5 AC-3 — LlmOptInToggle renders the AI transparency intro paragraph above the toggle", async () => {
    optInMock.mockReturnValue({ data: { thirdParty: false }, isLoading: false, error: null });
    renderWithTamagui(<LlmOptInToggle />);
    expect(await screen.findByText(fr.llm.optIn.intro)).toBeInTheDocument();
    expect(screen.getByText(fr.llm.optIn.toggleLabel)).toBeInTheDocument();
  });

  test("11-5 AC-3 — ships identical llm.aiNotice and llm.optIn keys in fr and en", () => {
    expect(Object.keys(en.llm.aiNotice).sort()).toEqual(Object.keys(fr.llm.aiNotice).sort());
    expect(Object.keys(en.llm.optIn).sort()).toEqual(Object.keys(fr.llm.optIn).sort());
    for (const key of Object.keys(fr.llm.aiNotice)) {
      expect((en.llm.aiNotice as Record<string, string>)[key]).toBeTruthy();
    }
    for (const key of Object.keys(fr.llm.optIn)) {
      expect((en.llm.optIn as Record<string, string>)[key]).toBeTruthy();
    }
  });

  test("11-5 AC-4 — has zero axe violations on AiTransparencyNotice and LlmOptInToggle", async () => {
    aiNoticeMock.mockReturnValue({ data: { seen: false }, isLoading: false });
    optInMock.mockReturnValue({ data: { thirdParty: false }, isLoading: false, error: null });
    const { container } = renderWithTamagui(
      <div>
        <AiTransparencyNotice />
        <LlmOptInToggle />
      </div>,
    );
    expect(await screen.findByRole("note")).toBeInTheDocument();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
```

5. **Test Command:**

```bash
bun --filter='@pekulo/web' test src/app/\(cap\)/dashboard/_llm/_components/ai-transparency-notice.test.tsx
```

6. **Expected Output:**
   - `9 passed (9)` in `ai-transparency-notice.test.tsx` (including zero `vitest-axe` violations).

7. **Commit Step:**

```bash
git add apps/web/src/app/\(cap\)/dashboard/_llm/_components/ai-transparency-notice.tsx apps/web/src/app/\(cap\)/dashboard/_llm/_components/llm-opt-in-toggle.tsx apps/web/src/app/\(cap\)/dashboard/_llm/_components/ai-transparency-notice.test.tsx && git commit -m "feat(#52): add dismissible AI transparency notice lifecycle and settings intro"
```

---

### Task 4: Run full monorepo verification suite (`@pekulo/api` tests, `@pekulo/web` tests, `lint`, `typecheck`, `db:rls-migration-audit`) [AC: AC-5]

1. **Files:**
   - Verify all modified files across `@pekulo/api` and `@pekulo/web`.

2. **Full Code — Verification Script Execution:**

```bash
bun --filter='@pekulo/api' test src/modules/llm/ && bun --filter='@pekulo/web' test src/app/\(cap\)/dashboard/_llm/ && bun run lint && bun run typecheck && bun run db:rls-migration-audit
```

3. **Test Command:**

```bash
bun --filter='@pekulo/api' test src/modules/llm/ && bun --filter='@pekulo/web' test src/app/\(cap\)/dashboard/_llm/ && bun run lint && bun run typecheck && bun run db:rls-migration-audit
```

4. **Expected Output:**
   - All `@pekulo/api` LLM tests pass (`0 fail`).
   - All `@pekulo/web` `_llm` tests pass (`0 fail`).
   - `bun run lint`, `bun run typecheck`, and `bun run db:rls-migration-audit` exit `0`.

5. **Commit Step:**

```bash
git status --short
```

---

### 3-Bullet File Decision Template

1. **`apps/api/src/modules/llm/llm.repository.ts`**
   - **Path:** `apps/api/src/modules/llm/llm.repository.ts`
   - **Responsibility:** Prisma persistence for `LlmOptIn` and `LlmCallLog`; resets `aiNoticeSeenAt: null` when `setThirdPartyOptIn(userId, true)` transitions from `thirdParty !== true` to `true`.
   - **Interfaces / Collaborators:** Consumed by `createLlmService` (`apps/api/src/modules/llm/llm.service.ts`) and `createLlmRouter` (`apps/api/src/modules/llm/llm.routes.ts`).
2. **`apps/api/src/modules/llm/llm-ai-notice.test.ts`**
   - **Path:** `apps/api/src/modules/llm/llm-ai-notice.test.ts`
   - **Responsibility:** Unit and two-tenant isolation tests for `getAiNoticeSeen`, `markAiNoticeSeen`, and the `opt-in → opt-out → opt-in` re-trigger in `createLlmRepository`.
   - **Interfaces / Collaborators:** Exercises `createLlmRepository` with stateful per-user `Map` storage.
3. **`apps/web/src/lib/zapaction/keys.ts`**
   - **Path:** `apps/web/src/lib/zapaction/keys.ts`
   - **Responsibility:** Central ZapAction query key and tag registry; maps `llmTags.optIn()` and `llmTags.all()` to `[llmKeys.optIn(), llmKeys.aiNotice()]`.
   - **Interfaces / Collaborators:** Consumed by `useSetLlmOptIn` (`apps/web/src/app/(cap)/dashboard/_llm/_hooks/use-llm-opt-in.ts`) and `useAiNotice` (`use-ai-notice.ts`).
4. **`apps/web/src/app/(cap)/dashboard/_llm/_hooks/use-llm-opt-in.test.tsx`**
   - **Path:** `apps/web/src/app/(cap)/dashboard/_llm/_hooks/use-llm-opt-in.test.tsx`
   - **Responsibility:** Verifies that `useSetLlmOptIn` invalidates both `llmKeys.optIn()` and `llmKeys.aiNotice()` via the tag registry.
   - **Interfaces / Collaborators:** Tests `useSetLlmOptIn` with `QueryClientProvider`.
5. **`apps/web/messages/fr.json` & `apps/web/messages/en.json`**
   - **Path:** `apps/web/messages/fr.json`, `apps/web/messages/en.json`
   - **Responsibility:** French and English `next-intl` catalogues for `llm.optIn.intro` and `llm.aiNotice.{ariaLabel,body,dismiss,dismissAriaLabel}`.
   - **Interfaces / Collaborators:** Consumed via `useTranslations("llm")` in `AiTransparencyNotice` and `LlmOptInToggle`.
6. **`apps/web/src/app/(cap)/dashboard/_llm/_components/ai-transparency-notice.tsx`**
   - **Path:** `apps/web/src/app/(cap)/dashboard/_llm/_components/ai-transparency-notice.tsx`
   - **Responsibility:** Renders the dismissible EU AI Act transparency banner (`role="note"`), latches visibility across the post-mount `markAiNotice` refetch, and re-arms when `seen` flips back to `false` on `opt-out → opt-in`.
   - **Interfaces / Collaborators:** Mounted by `TransactionsSuggestionsSection` and `TransactionsRecentSection`; consumes `useAiNotice`, `useMarkAiNotice`, `PekuloButton`, and `useTranslations("llm")`.
7. **`apps/web/src/app/(cap)/dashboard/_llm/_components/llm-opt-in-toggle.tsx`**
   - **Path:** `apps/web/src/app/(cap)/dashboard/_llm/_components/llm-opt-in-toggle.tsx`
   - **Responsibility:** Renders the `/dashboard/parametres` `Intelligence artificielle` section with the UX SSOT intro paragraph (`t("optIn.intro")`) above `PekuloToggleRow`.
   - **Interfaces / Collaborators:** Mounted by `apps/web/src/app/(cap)/dashboard/parametres/page.tsx`.
8. **`apps/web/src/app/(cap)/dashboard/_llm/_components/ai-transparency-notice.test.tsx`**
   - **Path:** `apps/web/src/app/(cap)/dashboard/_llm/_components/ai-transparency-notice.test.tsx`
   - **Responsibility:** Vitest + Testing Library + `vitest-axe` suite covering first-time display, latched visibility, explicit dismiss button, `opt-out → opt-in` re-display, `LlmOptInToggle` intro copy, `fr`/`en` key parity, and zero `axe` violations.
   - **Interfaces / Collaborators:** Tests `AiTransparencyNotice` and `LlmOptInToggle` via `renderWithTamagui`.

### Step-0 Verbatim Quotes of Modified Files

- **`apps/api/src/modules/llm/llm.repository.ts` (L67–L122):**
```ts
    async setThirdPartyOptIn(userId, value) {
      try {
        const row = await db.llmOptIn.upsert({
          where: { userId },
          // `id` is injected by the prefixed-ids extension at create time
          // (llmo_<base62>), so it is intentionally absent here — same cast
          // as createCallEvent. Prisma's generated type still demands it.
          create: {
            userId,
            thirdParty: value,
          } as unknown as Parameters<typeof db.llmOptIn.upsert>[0]["create"],
          update: { thirdParty: value },
          select: { thirdParty: true },
        });
        return row.thirdParty;
      } catch (err) {
        // Two concurrent first-time opt-ins both find no row and race the
        // create branch; the loser hits the UNIQUE(user_id) index. Re-apply as
        // an update (lesson 2026-05-27 — find-or-create P2002 re-read). Duck-typed
        // code check mirrors realestate.repository.ts:203 / transactions:359.
        if ((err as { code?: string }).code === "P2002") {
          const row = await db.llmOptIn.update({
            where: { userId },
            data: { thirdParty: value },
            select: { thirdParty: true },
          });
          return row.thirdParty;
        }
        throw err;
      }
    },
    async getAiNoticeSeen(userId) {
      const row = await db.llmOptIn.findUnique({
        where: { userId },
        select: { aiNoticeSeenAt: true },
      });
      return row?.aiNoticeSeenAt != null;
    },
    async markAiNoticeSeen(userId) {
      const now = new Date();
      try {
        await db.llmOptIn.upsert({
          where: { userId },
          create: { userId, aiNoticeSeenAt: now } as unknown as Parameters<
            typeof db.llmOptIn.upsert
          >[0]["create"],
          update: { aiNoticeSeenAt: now },
        });
      } catch (err) {
        if ((err as { code?: string }).code === "P2002") {
          await db.llmOptIn.update({ where: { userId }, data: { aiNoticeSeenAt: now } });
          return;
        }
        throw err;
      }
    },
```

- **`apps/api/src/modules/llm/llm-ai-notice.test.ts` (L1–L31):**
```ts
import { describe, expect, test, mock } from "bun:test";
import { createLlmRepository } from "./llm.repository";

describe("ai-notice flag (6-4)", () => {
  test("getAiNoticeSeen → false when no row / null timestamp", async () => {
    const findUnique = mock(async () => null);
    const repo = createLlmRepository({
      prismaService: { client: { llmOptIn: { findUnique } } },
    } as never);
    expect(await repo.getAiNoticeSeen("u1")).toBe(false);
  });

  test("getAiNoticeSeen → true when ai_notice_seen_at is set", async () => {
    const findUnique = mock(async () => ({ aiNoticeSeenAt: new Date() }));
    const repo = createLlmRepository({
      prismaService: { client: { llmOptIn: { findUnique } } },
    } as never);
    expect(await repo.getAiNoticeSeen("u1")).toBe(true);
  });

  test("markAiNoticeSeen upserts with ai_notice_seen_at", async () => {
    const upsert = mock(async (_args: { where: unknown; update: Record<string, unknown> }) => ({}));
    const repo = createLlmRepository({
      prismaService: { client: { llmOptIn: { upsert } } },
    } as never);
    await repo.markAiNoticeSeen("u1");
    const [arg] = upsert.mock.calls[0] as [{ where: unknown; update: Record<string, unknown> }];
    expect(arg.where).toMatchObject({ userId: "u1" });
    expect(arg.update.aiNoticeSeenAt).toBeInstanceOf(Date);
  });
});
```

- **`apps/web/src/lib/zapaction/keys.ts` (L234–L240):**
```ts
  // Story 6-3 — llm opt-in. The setLlmOptIn mutation invalidates the single
  // optIn read so the toggle state survives a reload.
  [llmTags.all()]: [llmKeys.optIn()],
  [llmTags.optIn()]: [llmKeys.optIn()],
  // Story 6-4 (DR-12) — markAiNotice invalidates the seen-state read.
  [llmTags.aiNotice()]: [llmKeys.aiNotice()],
```

- **`apps/web/src/app/(cap)/dashboard/_llm/_hooks/use-llm-opt-in.test.tsx` (L25–L39):**
```tsx
describe("useSetLlmOptIn (AC-4)", () => {
  test("success → invalidates llmKeys.optIn()", async () => {
    setMock.mockReset().mockResolvedValueOnce({ thirdParty: true });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(llmKeys.optIn(), { thirdParty: false });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useSetLlmOptIn(), { wrapper });
    result.current.mutate({ thirdParty: true });
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: llmKeys.optIn() });
  });
});
```

- **`apps/web/messages/fr.json` (L562–L568) & `apps/web/messages/en.json` (L562–L568):**
```json
    "optIn": {
      "title": "Intelligence artificielle",
      "ariaLabel": "Paramètres d'intelligence artificielle",
      "toggleLabel": "Modèles d'IA tiers",
      "toggleSub": "Autoriser l'envoi de certaines transactions à une API tierce (Mistral, hébergée en UE) pour la catégorisation. Désactivé par défaut.",
      "loading": "Chargement…"
    },
```

- **`apps/web/src/app/(cap)/dashboard/_llm/_components/ai-transparency-notice.tsx` (L16–L53):**
```tsx
export function AiTransparencyNotice() {
  const { data, isLoading } = useAiNotice();
  const markSeen = useMarkAiNotice();
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => setIsHydrated(true), []);
  // Default to seen until the read resolves → no flash for returning users.
  const seen = data?.seen ?? true;
  const shouldShow = isHydrated && !isLoading && !seen;

  useEffect(() => {
    if (shouldShow && !markSeen.isPending) markSeen.mutate(undefined);
    // Mark on first appearance so AC-3 "appears once" holds across reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldShow]);

  if (!shouldShow) return null;
  return (
    <View
      role="note"
      aria-label="Information sur l'intelligence artificielle"
      flexDirection="row"
      gap="$2"
      alignItems="flex-start"
      padding="$3"
      marginBottom="$2"
      borderRadius="$4"
      backgroundColor="$backgroundMuted"
    >
      <Sparkles size={14} color="var(--colorSecondary)" aria-hidden />
      <Text color="$colorSecondary" fontSize="$xs">
        Vos catégories peuvent être suggérées — ou, pour vos imports (CSV / banque), appliquées
        automatiquement — par un modèle d'IA. Vous gardez le dernier mot : chaque catégorie reste
        modifiable à tout moment. Aucune donnée n'est envoyée à un modèle tiers sans votre accord
        (Paramètres → Intelligence artificielle).
      </Text>
    </View>
  );
}
```

- **`apps/web/src/app/(cap)/dashboard/_llm/_components/llm-opt-in-toggle.tsx` (L14–L31):**
```tsx
export function LlmOptInToggle() {
  const t = useTranslations("llm");
  const { data, isLoading, error } = useLlmOptIn();
  const setOptIn = useSetLlmOptIn();
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => setIsHydrated(true), []);
  const showLoading = !isHydrated || isLoading;
  const checked = data?.thirdParty ?? false;
  return (
    <Section title={t("optIn.title")} ariaLabel={t("optIn.ariaLabel")}>
      <PekuloToggleRow
        label={t("optIn.toggleLabel")}
        sub={t("optIn.toggleSub")}
        checked={checked}
        disabled={showLoading || setOptIn.isPending}
        onChange={(v) => setOptIn.mutate({ thirdParty: v })}
      />
```

- **`apps/web/src/app/(cap)/dashboard/_llm/_components/ai-transparency-notice.test.tsx` (L25–L56):**
```tsx
describe("AiTransparencyNotice (AC-3 — shown exactly once, server-flagged)", () => {
  test("renders nothing when the server flag says it was already seen", () => {
    aiNoticeMock.mockReturnValue({ data: { seen: true }, isLoading: false });
    renderWithTamagui(<AiTransparencyNotice />);
    expect(screen.queryByRole("note")).toBeNull();
    expect(markMutate).not.toHaveBeenCalled();
  });

  test("renders nothing while the read is loading (no flash for returning users)", () => {
    aiNoticeMock.mockReturnValue({ data: undefined, isLoading: true });
    renderWithTamagui(<AiTransparencyNotice />);
    expect(screen.queryByRole("note")).toBeNull();
    expect(markMutate).not.toHaveBeenCalled();
  });

  test("shows the notice and marks it seen exactly once when never seen before", async () => {
    aiNoticeMock.mockReturnValue({ data: { seen: false }, isLoading: false });
    renderWithTamagui(<AiTransparencyNotice />);
    expect(await screen.findByRole("note")).toBeInTheDocument();
    await waitFor(() => expect(markMutate).toHaveBeenCalledTimes(1));
  });

  // AC-2 (story 6-7 / FR-33 amended): the notice now covers BOTH contexts —
  // suggested AND auto-applied-on-import — and states categories stay editable.
  test("6-7 — the copy states categories can be applied automatically and stay editable (AC-2)", async () => {
    aiNoticeMock.mockReturnValue({ data: { seen: false }, isLoading: false });
    renderWithTamagui(<AiTransparencyNotice />);
    const note = await screen.findByRole("note");
    expect(note.textContent).toContain("appliquées automatiquement");
    expect(note.textContent).toContain("modifiable");
  });
});
```

## File List

- `apps/api/src/modules/llm/llm.repository.ts` (modify)
- `apps/api/src/modules/llm/llm-ai-notice.test.ts` (modify)
- `apps/web/src/lib/zapaction/keys.ts` (modify)
- `apps/web/src/app/(cap)/dashboard/_llm/_hooks/use-llm-opt-in.test.tsx` (modify)
- `apps/web/messages/fr.json` (modify)
- `apps/web/messages/en.json` (modify)
- `apps/web/src/app/(cap)/dashboard/_llm/_components/ai-transparency-notice.tsx` (modify)
- `apps/web/src/app/(cap)/dashboard/_llm/_components/llm-opt-in-toggle.tsx` (modify)
- `apps/web/src/app/(cap)/dashboard/_llm/_components/ai-transparency-notice.test.tsx` (modify)

## Dev Agent Record

### Summary

- Pending `aped-dev` execution.

### Files changed

- Pending `aped-dev` execution.

### Deviations

- Pending `aped-dev` execution.

### Test output

- Pending `aped-dev` execution.
