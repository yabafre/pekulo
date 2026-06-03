# Story: 6-5-llm-activity-log — 90-day LLM activity log in settings

**Epic:** Epic 6 — LLM auto-categorisation
**Status:** done
**Ticket:** [#36](https://github.com/yabafre/pekulo/issues/36)
**Branch:** feature/36-6-5-llm-activity-log
**Commit prefix:** `feat(#36): …` · close with `Closes #36` in the PR body
**Covered FRs:** FR-36 · **Depends on:** 6-1-llm-routing-and-providers (audit repository), 0-10-pekulo-ui-migration (Tamagui DS)
**Complexity:** S

## User Story

**As a** Pekulo user, **I want** to view the LLM activity log for the last 90 days from settings, **so that** I have an auditable record of routing decisions and outcomes.

## Acceptance Criteria

- **AC-1** — **Given** ≥200 completed LLM calls in the last 90 days, **When** I open the activity log, **Then** the calls render paginated (10 per page) and each row shows the route (iOS / Ollama / Cloud), the latency in ms, the outcome (Réussi / Échec / Modifié) and the date-time, ordered most-recent-first. [AC: AC-1]
- **AC-2** — **Given** any row in the log, **When** I inspect the rendered DOM and the raw API response, **Then** no prompt content is present — no transaction label, amount, currency, merchant, or `prompt*` field — only route, latency, outcome, timestamp and opaque ids (NFR-26). [AC: AC-2]
- **AC-3** — **Given** LLM calls older than 90 days exist in `llm_call_log`, **When** I open the log, **Then** only calls from the last 90 days appear (server-side `createdAt >= now − 90 days` filter; no purge job is assumed to exist). [AC: AC-3]
- **AC-4** — **Given** there are no completed LLM calls in the 90-day window, **When** I open the log, **Then** an explicit empty state renders ("Aucun appel IA sur les 90 derniers jours."), not a blank/broken list. [AC: AC-4]
- **AC-5** — **Given** a request to the activity-log endpoint without a valid JWT, **When** it reaches the API, **Then** it returns 401 in < 100 ms (NFR-9) and no read reaches the service. [AC: AC-5]
- **AC-6** — **Given** the rendered log, **When** I read the route + outcome labels, **Then** they are grayscale text (no emerald / green / red — `$accent`/`$success`/`$danger` are reserved for ± monetary deltas, lesson 2026-05-07); the list is hydration-guarded (R13) and the loading state is announced via an `aria-live` region. [AC: AC-6]

## Tasks

> Each task is a full code block, an exact test command, the expected pass line, and a commit. The dev agent has **zero inherited context** — do not infer, copy the blocks verbatim. `bun --filter='@pekulo/api'` (NEVER `bun --filter=api`); `apps/api` tests import from `"bun:test"`, `apps/web` tests use `vitest`.

- [x] **T1 — Add the activity-log Zod schemas to `packages/validators/src/llm/llm.schemas.ts`** [AC: AC-1, AC-2]
  In `packages/validators/src/llm/llm.schemas.ts`, **after** the existing final block:
  ```ts
  // Story 6-4 (DR-12 / AC-3) — AI transparency notice "seen" state.
  export const aiNoticeStateSchema = z.object({ seen: z.boolean() });
  export type AiNoticeState = z.infer<typeof aiNoticeStateSchema>;
  ```
  append:
  ```ts
  // Story 6-5 (FR-36) — 90-day LLM activity-log read DTO. Mirrors
  // @pekulo/types#LlmCallLogEntry (the type 6-1 declared for this story). One
  // entry per COMPLETED call (phase "outcome"): route + latency + outcome +
  // timestamp. NEVER prompt content (NFR-26 / AC-2) — id/callId are opaque, no
  // label/amount/merchant ever enters the audit row, so none can leak here.
  // latencyMs/outcome stay nullable to match the DTO type; the service filters to
  // outcome rows, so both are non-null at runtime. Reuses llmRouteSchema /
  // llmOutcomeSchema (the iso mirrors already in this file).
  export const llmCallLogEntrySchema = z.object({
    id: z.string().min(1),
    callId: z.string().min(1),
    phase: z.enum(["intent", "outcome"]),
    route: llmRouteSchema,
    latencyMs: z.number().int().nonnegative().nullable(),
    outcome: llmOutcomeSchema.nullable(),
    occurredAt: z.string(),
  });

  export const llmActivityLogSchema = z.object({
    items: z.array(llmCallLogEntrySchema),
  });

  export type LlmCallLogEntryDto = z.infer<typeof llmCallLogEntrySchema>;
  export type LlmActivityLog = z.infer<typeof llmActivityLogSchema>;
  ```
  Run: `bun --filter='@pekulo/validators' run typecheck`
  Expected: exit 0, no output.
  Commit: `git add packages/validators/src/llm/llm.schemas.ts && git commit -m "feat(#36): add LLM activity-log read schemas (FR-36)"`

- [x] **T2 — Add `listRecentOutcomesByUser` to `apps/api/src/modules/llm/llm.repository.ts`** [AC: AC-1, AC-3]
  In `apps/api/src/modules/llm/llm.repository.ts`, add the method to the `LlmRepository` interface, **after** the existing line:
  ```ts
    listRecentByUser(userId: string, since: Date): Promise<LlmCallLogEntry[]>;
  ```
  insert:
  ```ts
    /** Story 6-5 (FR-36) — the 90-day activity log lists COMPLETED calls only.
     * Same keyset window + 200-row cap as listRecentByUser, narrowed to
     * phase "outcome" so every row carries route + latencyMs + outcome (intent
     * rows have null latency/outcome). NEVER returns the prompt body (NFR-26). */
    listRecentOutcomesByUser(userId: string, since: Date): Promise<LlmCallLogEntry[]>;
  ```
  Then, inside `createLlmRepository`'s returned object, **after** the existing `listRecentByUser` implementation block (which ends with the `};` of its `.map`), add:
  ```ts
      async listRecentOutcomesByUser(userId, since) {
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
  ```
  Run: `bun --filter='@pekulo/api' run typecheck`
  Expected: exit 0, no output.
  Commit: `git add apps/api/src/modules/llm/llm.repository.ts && git commit -m "feat(#36): add listRecentOutcomesByUser audit reader (FR-36)"`

- [x] **T3 — Cover `listRecentOutcomesByUser` in `apps/api/src/modules/llm/llm.repository.test.ts`** [AC: AC-1, AC-3]
  In `apps/api/src/modules/llm/llm.repository.test.ts`, extend `makePrismaMock` so the `llmCallLog` client also exposes `findMany`. **Replace** the existing `makePrismaMock` function:
  ```ts
  function makePrismaMock(optInRow: { thirdParty: boolean } | null) {
    const create = mock(async (_args: unknown) => undefined);
    const findUnique = mock(async () => optInRow);
    const $transaction = mock(async (ops: Promise<unknown>[]) => Promise.all(ops));
    const prismaService = {
      client: { llmCallLog: { create }, llmOptIn: { findUnique }, $transaction },
    } as unknown as PrismaService;
    return { prismaService, create, findUnique, $transaction };
  }
  ```
  with:
  ```ts
  function makePrismaMock(optInRow: { thirdParty: boolean } | null) {
    const create = mock(async (_args: unknown) => undefined);
    const findUnique = mock(async () => optInRow);
    const $transaction = mock(async (ops: Promise<unknown>[]) => Promise.all(ops));
    const findMany = mock(async (_args: unknown) => [
      {
        id: "llm_abc123",
        callId: "c1",
        userId: "u1",
        phase: "outcome",
        route: "ollama",
        labelHash: "h",
        latencyMs: 240,
        outcome: "success",
        occurredAt: new Date("2026-06-01T08:00:00.000Z"),
        createdAt: new Date("2026-06-01T08:00:00.000Z"),
      },
    ]);
    const prismaService = {
      client: { llmCallLog: { create, findMany }, llmOptIn: { findUnique }, $transaction },
    } as unknown as PrismaService;
    return { prismaService, create, findUnique, $transaction, findMany };
  }
  ```
  Then add these two tests at the end of the file:
  ```ts
  test("listRecentOutcomesByUser filters to phase outcome + the since window, keyset-ordered", async () => {
    const { prismaService, findMany } = makePrismaMock(null);
    const repo = createLlmRepository({ prismaService });
    const since = new Date("2026-03-05T00:00:00.000Z");
    const entries = await repo.listRecentOutcomesByUser("u1", since);
    expect(findMany).toHaveBeenCalledTimes(1);
    const arg = findMany.mock.calls[0]![0] as {
      where: { userId: string; phase: string; createdAt: { gte: Date } };
      orderBy: unknown;
      take: number;
    };
    expect(arg.where).toMatchObject({ userId: "u1", phase: "outcome" });
    expect(arg.where.createdAt.gte).toBe(since);
    expect(arg.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
    expect(arg.take).toBe(200);
    expect(entries[0]).toMatchObject({ route: "ollama", latencyMs: 240, outcome: "success" });
  });

  test("listRecentOutcomesByUser maps rows to the DTO without any prompt field (NFR-26)", async () => {
    const { prismaService } = makePrismaMock(null);
    const repo = createLlmRepository({ prismaService });
    const [entry] = await repo.listRecentOutcomesByUser("u1", new Date(0));
    expect(Object.keys(entry!).sort()).toEqual(
      ["callId", "id", "latencyMs", "occurredAt", "outcome", "phase", "route"].sort(),
    );
    expect(entry).not.toHaveProperty("labelHash");
  });
  ```
  Run: `bun --filter='@pekulo/api' run test src/modules/llm/llm.repository.test.ts`
  Expected: all tests pass, the new lines include `✓ listRecentOutcomesByUser filters to phase outcome + the since window, keyset-ordered` and `✓ listRecentOutcomesByUser maps rows to the DTO without any prompt field (NFR-26)`; `0 fail`.
  Commit: `git add apps/api/src/modules/llm/llm.repository.test.ts && git commit -m "test(#36): cover listRecentOutcomesByUser filter + DTO shape"`

- [x] **T4 — Add `listActivityLog` to `apps/api/src/modules/llm/llm.service.ts`** [AC: AC-1, AC-3]
  In `apps/api/src/modules/llm/llm.service.ts`, first widen the imported types. **Replace** the import:
  ```ts
  import type {
    ClientCapabilities,
    LlmCallEvent,
    LlmCategorisation,
    LlmPromptEnvelope,
    LlmRoute,
    LlmRouteDecision,
  } from "@pekulo/types";
  ```
  with:
  ```ts
  import type {
    ClientCapabilities,
    LlmCallEvent,
    LlmCallLogEntry,
    LlmCategorisation,
    LlmPromptEnvelope,
    LlmRoute,
    LlmRouteDecision,
  } from "@pekulo/types";
  ```
  Add the method to the `LlmService` interface, **after** the existing line:
  ```ts
    recordLlmCallPair(userId: string, events: [LlmCallEvent, LlmCallEvent]): Promise<void>;
  ```
  insert:
  ```ts
    /** Story 6-5 (FR-36) — the 90-day LLM activity log. Resolves the rolling
     * 90-day floor and delegates to the audit repository's outcome-only reader.
     * No purge job exists, so this `since` filter is what bounds FR-36 to 90 days
     * (NFR-26 retention is enforced at read time here). NEVER returns prompt
     * content — the DTO carries route/latency/outcome/timestamp only. */
    listActivityLog(userId: string): Promise<LlmCallLogEntry[]>;
  ```
  Add the free helper, **after** the existing `markAiNotice` helper:
  ```ts
    async function markAiNotice(userId: string): Promise<void> {
      return deps.repository.markAiNoticeSeen(userId);
    }
  ```
  insert:
  ```ts
    // Story 6-5 (FR-36). 90 days in ms; `new Date()` is server-side only (no
    // hydration concern — this runs in the Elysia handler, never the client).
    const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
    async function listActivity(userId: string): Promise<LlmCallLogEntry[]> {
      const since = new Date(Date.now() - NINETY_DAYS_MS);
      return deps.repository.listRecentOutcomesByUser(userId, since);
    }
  ```
  Finally, in the returned object literal, **after** the existing line:
  ```ts
      recordLlmCallPair: recordPair,
  ```
  add:
  ```ts
      listActivityLog: listActivity,
  ```
  Run: `bun --filter='@pekulo/api' run typecheck`
  Expected: exit 0, no output.
  Commit: `git add apps/api/src/modules/llm/llm.service.ts && git commit -m "feat(#36): listActivityLog with 90-day floor (FR-36)"`

- [x] **T5 — Unit-test `listActivityLog` in `apps/api/src/modules/llm/llm.service.test.ts`** [AC: AC-1, AC-3]
  Append this test at the end of `apps/api/src/modules/llm/llm.service.test.ts`. It builds the service with a fake repository that captures the `since` argument and stubs every other dependency (the categorise path is untouched here).
  ```ts
  test("listActivityLog reads outcome rows since ~90 days ago and returns them verbatim", async () => {
    let capturedSince: Date | undefined;
    const entry = {
      id: "llm_1" as never,
      callId: "c1",
      phase: "outcome" as const,
      route: "ollama" as const,
      latencyMs: 240,
      outcome: "success" as const,
      occurredAt: "2026-06-01T08:00:00.000Z",
    };
    const repository = {
      route: async () => undefined,
      recordCallEvent: async () => undefined,
      recordCallEvents: async () => undefined,
      isThirdPartyOptedIn: async () => false,
      setThirdPartyOptIn: async () => false,
      getAiNoticeSeen: async () => false,
      markAiNoticeSeen: async () => undefined,
      listRecentByUser: async () => [],
      listRecentOutcomesByUser: async (_userId: string, since: Date) => {
        capturedSince = since;
        return [entry];
      },
    } as unknown as Parameters<typeof createLlmService>[0]["repository"];

    const service = createLlmService({
      repository,
      ollamaClient: { complete: async () => ({ raw: "", latencyMs: 0 }) },
      thirdPartyClient: { complete: async () => ({ raw: "", latencyMs: 0 }) },
      optInReader: { isThirdPartyOptedIn: async () => false },
      generateCallId: () => "c1",
    });

    const entries = await service.listActivityLog("u1");
    expect(entries).toEqual([entry]);
    const ageDays = (Date.now() - capturedSince!.getTime()) / 86_400_000;
    expect(ageDays).toBeGreaterThan(89.9);
    expect(ageDays).toBeLessThan(90.1);
  });
  ```
  > If `createLlmService` and `test`/`expect` are not already imported at the top of this file, add `import { createLlmService } from "./llm.service";` and `import { test, expect } from "bun:test";` — check the existing imports first and only add what's missing.
  Run: `bun --filter='@pekulo/api' run test src/modules/llm/llm.service.test.ts`
  Expected: all tests pass including `✓ listActivityLog reads outcome rows since ~90 days ago and returns them verbatim`; `0 fail`.
  Commit: `git add apps/api/src/modules/llm/llm.service.test.ts && git commit -m "test(#36): listActivityLog 90-day floor + passthrough"`

- [x] **T6 — Add the `getActivityLog` procedure to `packages/contracts/src/llm/llm.contract.ts`** [AC: AC-1, AC-5]
  **Replace** the whole file `packages/contracts/src/llm/llm.contract.ts` with:
  ```ts
  // packages/contracts/src/llm/llm.contract.ts
  // Llm module oRPC contract. Story 6-3 (FR-34) adds the FIRST client-facing
  // procedures: getOptIn (read the per-user third-party opt-in flag) + setOptIn
  // (write it). Story 6-4 (DR-12) adds the AI-notice "seen" pair. Story 6-5
  // (FR-36) adds getActivityLog — the 90-day audit read. Mount under /rpc/v1/llm
  // (ADR-0009). The /internal/llm/attest listener (story 6-1) stays Elysia-native
  // and is NOT part of this contract.
  import { oc } from "@orpc/contract";
  import {
    aiNoticeStateSchema,
    llmActivityLogSchema,
    llmOptInSchema,
    updateLlmOptInSchema,
  } from "@pekulo/validators";

  export const llmContractV1 = {
    getOptIn: oc.output(llmOptInSchema),
    setOptIn: oc.input(updateLlmOptInSchema).output(llmOptInSchema),
    // Story 6-4 (DR-12 / AC-3) — AI transparency notice "seen once" flag.
    getAiNotice: oc.output(aiNoticeStateSchema),
    markAiNotice: oc.output(aiNoticeStateSchema),
    // Story 6-5 (FR-36) — 90-day LLM activity log read. No input (the userId is
    // taken from the verified JWT context server-side, never the client).
    getActivityLog: oc.output(llmActivityLogSchema),
  } as const;

  export const llmContract = llmContractV1;
  export const llmContractMeta = {
    moduleKey: "llm",
    mountPath: "/rpc/v1/llm",
    version: "v1",
  } as const;
  ```
  Run: `bun --filter='@pekulo/contracts' run typecheck`
  Expected: exit 0, no output.
  Commit: `git add packages/contracts/src/llm/llm.contract.ts && git commit -m "feat(#36): add llm.getActivityLog contract procedure (FR-36)"`

- [x] **T7 — Bind the `getActivityLog` handler in `apps/api/src/modules/llm/llm.routes.ts`** [AC: AC-1, AC-5]
  In `apps/api/src/modules/llm/llm.routes.ts`, inside the `impl.router({ ... })` object, **after** the existing `markAiNotice` handler block:
  ```ts
      markAiNotice: impl.markAiNotice.handler(async ({ context }) => {
        requireUserId(context.userId);
        await deps.service.markAiNoticeSeen(context.userId);
        return { seen: true };
      }),
  ```
  add:
  ```ts
      // Story 6-5 (FR-36) — 90-day activity log. requireUserId throws UNAUTHORIZED
      // (→ 401 < 100 ms, NFR-9 / AC-5) before any read when context is missing.
      getActivityLog: impl.getActivityLog.handler(async ({ context }) => {
        requireUserId(context.userId);
        return { items: await deps.service.listActivityLog(context.userId) };
      }),
  ```
  Run: `bun --filter='@pekulo/api' run typecheck`
  Expected: exit 0, no output.
  Commit: `git add apps/api/src/modules/llm/llm.routes.ts && git commit -m "feat(#36): bind llm.getActivityLog handler (FR-36)"`

- [x] **T8 — HTTP-boundary tests in `apps/api/src/modules/llm/llm.integration.test.ts`** [AC: AC-1, AC-2, AC-5]
  In `apps/api/src/modules/llm/llm.integration.test.ts`, first make the fake Prisma return an outcome row for the activity-log read. **Replace** the `llmCallLog` block inside `makeFakeDb`:
  ```ts
      llmCallLog: {
        create: async () => undefined,
        findMany: async () => [],
      },
  ```
  with:
  ```ts
      llmCallLog: {
        create: async () => undefined,
        // Story 6-5 — the activity-log read filters phase:"outcome". Return one
        // completed call so the 200-branch asserts the rendered shape; any other
        // (intent) query stays empty.
        findMany: async ({ where }: { where: { userId: string; phase?: string } }) =>
          where.phase === "outcome"
            ? [
                {
                  id: "llm_x1",
                  callId: "c1",
                  userId: where.userId,
                  phase: "outcome",
                  route: "ollama",
                  labelHash: "h",
                  latencyMs: 240,
                  outcome: "success",
                  occurredAt: new Date("2026-06-01T08:00:00.000Z"),
                  createdAt: new Date("2026-06-01T08:00:00.000Z"),
                },
              ]
            : [],
      },
  ```
  Then add this `describe` block at the end of the file (after the existing `describe("llm opt-in HTTP boundary (AC-5)", …)` closes):
  ```ts
  describe("llm activity log HTTP boundary (story 6-5, AC-1/AC-2/AC-5)", () => {
    test("getActivityLog with a valid JWT returns 200 + outcome rows (route+latency+outcome, AC-1)", async () => {
      const token = await signFor(USER_A);
      const res = await fetch(`${baseUrl}/rpc/v1/llm/getActivityLog`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ json: {} }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { json: { items: Array<Record<string, unknown>> } };
      expect(Array.isArray(body.json.items)).toBe(true);
      expect(body.json.items[0]).toMatchObject({ route: "ollama", latencyMs: 240, outcome: "success" });
    });

    test("getActivityLog response exposes NO prompt content (AC-2 / NFR-26)", async () => {
      const token = await signFor(USER_A);
      const res = await fetch(`${baseUrl}/rpc/v1/llm/getActivityLog`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ json: {} }),
      });
      const raw = await res.text();
      for (const banned of ['"label"', '"labelHash"', '"amount"', '"merchant"', '"prompt"']) {
        expect(raw).not.toContain(banned);
      }
    });

    test("getActivityLog without JWT returns 401 < 100 ms (NFR-9 / AC-5)", async () => {
      const t0 = performance.now();
      const res = await fetch(`${baseUrl}/rpc/v1/llm/getActivityLog`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: {} }),
      });
      const elapsed = performance.now() - t0;
      expect(res.status).toBe(401);
      expect(elapsed).toBeLessThan(100);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe("UNAUTHORIZED");
    });
  });
  ```
  Run: `bun --filter='@pekulo/api' run test src/modules/llm/llm.integration.test.ts`
  Expected: all tests pass including the three new `✓ getActivityLog …` lines; `0 fail`.
  Commit: `git add apps/api/src/modules/llm/llm.integration.test.ts && git commit -m "test(#36): llm.getActivityLog 200/no-PII/401 boundary (AC-1/AC-2/AC-5)"`

- [x] **T9 — Register the read key in `apps/web/src/lib/zapaction/keys.ts`** [AC: AC-1]
  In `apps/web/src/lib/zapaction/keys.ts`, **replace** the `llmKeys` block:
  ```ts
  // Story 6-3 — third-party LLM opt-in (FR-34). Single `optIn` read; the toggle
  // mutation invalidates it via the registry edge below.
  export const llmKeys = createFeatureKeys("llm", {
    optIn: () => ["optIn"] as const,
    aiNotice: () => ["aiNotice"] as const,
  });
  ```
  with:
  ```ts
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
  ```
  Run: `bun --filter='@pekulo/web' run typecheck`
  Expected: exit 0, no output.
  Commit: `git add apps/web/src/lib/zapaction/keys.ts && git commit -m "feat(#36): register llmKeys.activityLog read key (FR-36)"`

- [x] **T10 — Add the `getLlmActivityLog` server action to `apps/web/src/app/(cap)/dashboard/_llm/_actions/llm-actions.ts`** [AC: AC-1, AC-2]
  In `apps/web/src/app/(cap)/dashboard/_llm/_actions/llm-actions.ts`, **replace** the import of validators:
  ```ts
  import {
    aiNoticeStateSchema,
    llmOptInSchema,
    updateLlmOptInSchema,
    type AiNoticeState,
    type LlmOptInState,
    type UpdateLlmOptInInput,
  } from "@pekulo/validators";
  ```
  with:
  ```ts
  import {
    aiNoticeStateSchema,
    llmActivityLogSchema,
    llmOptInSchema,
    updateLlmOptInSchema,
    type AiNoticeState,
    type LlmActivityLog,
    type LlmOptInState,
    type UpdateLlmOptInInput,
  } from "@pekulo/validators";
  ```
  Then append this action at the end of the file:
  ```ts
  // Story 6-5 (FR-36) — 90-day LLM activity log read. KEEPS `output:` (no typed
  // error branch to surface — the read cannot 404). No tags: read-only, nothing
  // on the web tier writes the audit log, so there is no invalidation edge.
  export const getLlmActivityLog = defineAction<void, LlmActivityLog, ActionContext>({
    name: "getLlmActivityLog",
    input: z.void(),
    output: llmActivityLogSchema,
    handler: async () => {
      await ensureRequestContext();
      return llmClient.getActivityLog();
    },
  });
  ```
  Run: `bun --filter='@pekulo/web' run typecheck`
  Expected: exit 0, no output.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_llm/_actions/llm-actions.ts" && git commit -m "feat(#36): getLlmActivityLog server action (FR-36)"`

- [x] **T11 — Create the read hook `apps/web/src/app/(cap)/dashboard/_llm/_hooks/use-llm-activity-log.ts`** [AC: AC-1]
  Create the new file `apps/web/src/app/(cap)/dashboard/_llm/_hooks/use-llm-activity-log.ts`:
  ```ts
  "use client";

  import { useActionQuery } from "@zapaction/query";
  import { llmKeys } from "@/lib/zapaction/keys";
  import { getLlmActivityLog } from "../_actions/llm-actions";

  // Story 6-5 (FR-36) — read-only 90-day activity log. No mutation pairs with it
  // (the web tier never writes llm_call_log), so there is no useActionMutation
  // sibling and no invalidateWithTags edge — it refreshes on staleTime. Mirrors
  // useLlmOptIn's read shape.
  export function useLlmActivityLog() {
    return useActionQuery(getLlmActivityLog, {
      input: undefined,
      queryKey: llmKeys.activityLog(),
      readPolicy: "read-only",
      staleTime: 30_000,
    });
  }
  ```
  Run: `bun --filter='@pekulo/web' run typecheck`
  Expected: exit 0, no output.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_llm/_hooks/use-llm-activity-log.ts" && git commit -m "feat(#36): useLlmActivityLog read hook (FR-36)"`

- [x] **T12 — Create the list component `apps/web/src/app/(cap)/dashboard/_llm/_components/llm-activity-log.tsx`** [AC: AC-1, AC-2, AC-4, AC-6]
  Create the new file `apps/web/src/app/(cap)/dashboard/_llm/_components/llm-activity-log.tsx`:
  ```tsx
  "use client";

  import { useEffect, useMemo, useState } from "react";
  import type { LlmOutcome, LlmRoute } from "@pekulo/types";
  import { Text, View } from "@pekulo/ui/client";
  import { PekuloPagination, Section } from "@pekulo/ui";
  import { useLlmActivityLog } from "../_hooks/use-llm-activity-log";

  // Story 6-5 (FR-36) — the 90-day LLM activity log. Read-only paginated list of
  // COMPLETED calls (route + latency + outcome + time). NEVER renders prompt
  // content (NFR-26 / AC-2) — the DTO carries none. Pagination is CLIENT-side over
  // the bounded server window (≤200 rows, 90-day filter): the list cannot grow
  // unbounded, so no offset/cursor round-trip is needed (decision step-04).
  const PAGE_SIZE = 10;

  // Domain route enum (foundation_models | ollama | third_party) → user label.
  // NOT @pekulo/types#LlmRouteBadge (ios|ollama|cloud) — that DS variant is the
  // suggestion-row badge; the audit log stores the domain enum. Grayscale text
  // only (lesson 2026-05-07: $accent/$success/$danger reserved for ± € deltas,
  // AC-6).
  const ROUTE_LABEL: Record<LlmRoute, string> = {
    foundation_models: "iOS",
    ollama: "Ollama",
    third_party: "Cloud",
  };
  const OUTCOME_LABEL: Record<LlmOutcome, string> = {
    success: "Réussi",
    failure: "Échec",
    overridden: "Modifié",
  };
  const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

  export function LlmActivityLog() {
    const { data, isLoading, error } = useLlmActivityLog();
    const [isHydrated, setIsHydrated] = useState(false);
    useEffect(() => setIsHydrated(true), []);
    const [page, setPage] = useState(1);
    // R13 (lesson 2026-05-24): gate the time-dependent date format + the
    // list/skeleton branch on a hydration flag so SSR and the first client paint
    // render the SAME tree (the loading branch) — the list (with locale-tz dates)
    // only mounts after the effect, never during hydration.
    const showLoading = !isHydrated || isLoading;

    const items = useMemo(() => data?.items ?? [], [data]);
    const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    const safePage = Math.min(page, pageCount);
    const pageItems = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    return (
      <Section title="Journal d'activité IA" ariaLabel="Journal d'activité de l'IA sur 90 jours">
        {showLoading && (
          // Visually-hidden live region so AT hears the load (mirrors
          // llm-opt-in-toggle.tsx). No <Suspense> here — useActionQuery surfaces
          // loading via isLoading and never throws (lesson 2026-05-26).
          <View
            role="status"
            aria-live="polite"
            position="absolute"
            width={1}
            height={1}
            overflow="hidden"
          >
            <Text color="$colorTertiary" fontSize="$caption">
              Chargement…
            </Text>
          </View>
        )}
        {error && !showLoading && (
          <Text role="alert" color="$danger" fontSize="$caption">
            {error.message}
          </Text>
        )}
        {!showLoading && !error && items.length === 0 && (
          <Text color="$colorTertiary" fontSize="$caption">
            Aucun appel IA sur les 90 derniers jours.
          </Text>
        )}
        {!showLoading && !error && items.length > 0 && (
          <View role="list" flexDirection="column" gap="$2">
            {pageItems.map((entry) => (
              <View
                key={entry.id}
                role="listitem"
                flexDirection="row"
                alignItems="center"
                justifyContent="space-between"
                gap="$3"
                paddingVertical="$2"
              >
                <Text color="$color" fontSize="$caption">
                  {ROUTE_LABEL[entry.route]}
                </Text>
                <Text color="$colorSecondary" fontSize="$caption">
                  {entry.latencyMs == null ? "—" : `${entry.latencyMs} ms`}
                </Text>
                <Text color="$colorSecondary" fontSize="$caption">
                  {entry.outcome == null ? "—" : OUTCOME_LABEL[entry.outcome]}
                </Text>
                <Text color="$colorTertiary" fontSize="$caption">
                  {dateTimeFmt.format(new Date(entry.occurredAt))}
                </Text>
              </View>
            ))}
          </View>
        )}
        {!showLoading && !error && pageCount > 1 && (
          <PekuloPagination
            page={safePage}
            pageCount={pageCount}
            onPageChange={(p) => setPage(p)}
            ariaLabel="Pagination du journal d'activité IA"
          />
        )}
      </Section>
    );
  }
  ```
  Run: `bun --filter='@pekulo/web' run typecheck`
  Expected: exit 0, no output.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_llm/_components/llm-activity-log.tsx" && git commit -m "feat(#36): LlmActivityLog paginated list (FR-36)"`

- [x] **T13 — Test the list component in `apps/web/src/app/(cap)/dashboard/_llm/_components/llm-activity-log.test.tsx`** [AC: AC-1, AC-2, AC-4, AC-6]
  Create the new file `apps/web/src/app/(cap)/dashboard/_llm/_components/llm-activity-log.test.tsx` (mirrors `ai-transparency-notice.test.tsx`: `vi.hoisted` + `vi.mock` of the hook, `renderWithTamagui` from `test/setup`):
  ```tsx
  import { afterEach, describe, expect, test, vi } from "vitest";
  import { screen } from "@testing-library/react";
  import { renderWithTamagui } from "../../../../../../test/setup";

  // Story 6-5 (FR-36). Mock the read hook so the list renders deterministically.
  const { activityMock } = vi.hoisted(() => ({ activityMock: vi.fn() }));
  vi.mock("../_hooks/use-llm-activity-log", () => ({
    useLlmActivityLog: () => activityMock(),
  }));

  import { LlmActivityLog } from "./llm-activity-log";

  function entry(over: Partial<Record<string, unknown>> = {}) {
    return {
      id: "llm_1",
      callId: "c1",
      phase: "outcome",
      route: "ollama",
      latencyMs: 240,
      outcome: "success",
      occurredAt: "2026-06-01T08:00:00.000Z",
      ...over,
    };
  }

  afterEach(() => activityMock.mockReset());

  describe("LlmActivityLog (story 6-5)", () => {
    test("AC-1 — renders route, latency and outcome labels for each call", async () => {
      activityMock.mockReturnValue({ data: { items: [entry()] }, isLoading: false });
      renderWithTamagui(<LlmActivityLog />);
      expect(await screen.findByText("Ollama")).toBeInTheDocument();
      expect(screen.getByText("240 ms")).toBeInTheDocument();
      expect(screen.getByText("Réussi")).toBeInTheDocument();
    });

    test("AC-4 — renders the empty state when there are no calls", async () => {
      activityMock.mockReturnValue({ data: { items: [] }, isLoading: false });
      renderWithTamagui(<LlmActivityLog />);
      expect(
        await screen.findByText("Aucun appel IA sur les 90 derniers jours."),
      ).toBeInTheDocument();
    });

    test("AC-1 — paginates: page 1 shows 10 of 12 rows", async () => {
      const items = Array.from({ length: 12 }, (_, i) => entry({ id: `llm_${i}`, callId: `c${i}` }));
      activityMock.mockReturnValue({ data: { items }, isLoading: false });
      renderWithTamagui(<LlmActivityLog />);
      // 12 rows → 2 pages; page 1 renders exactly 10 list items.
      expect(await screen.findAllByRole("listitem")).toHaveLength(10);
    });

    test("AC-2 — never renders prompt content (no label/amount/merchant in the DOM)", async () => {
      activityMock.mockReturnValue({ data: { items: [entry()] }, isLoading: false });
      const { container } = renderWithTamagui(<LlmActivityLog />);
      const text = container.textContent ?? "";
      expect(text).not.toMatch(/label|montant|merchant|prompt/i);
    });
  });
  ```
  Run: `bun --filter='@pekulo/web' run test "src/app/\(cap\)/dashboard/_llm/_components/llm-activity-log.test.tsx"`
  Expected: `Test Files  1 passed`, `Tests  4 passed`.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_llm/_components/llm-activity-log.test.tsx" && git commit -m "test(#36): LlmActivityLog render/pagination/empty/no-PII (AC-1/AC-2/AC-4)"`

- [x] **T14 — Create the settings entry link `apps/web/src/app/(cap)/dashboard/_llm/_components/llm-activity-log-link.tsx`** [AC: AC-6]
  Create the new file `apps/web/src/app/(cap)/dashboard/_llm/_components/llm-activity-log-link.tsx`. (The "Intelligence artificielle" Section is owned by 6-3's `LlmOptInToggle`; rather than edit a done story's component, 6-5 adds its own labelled entry section — cross-checked against `docs/ux-preview/src/App.tsx` `SettingsScreen` L1783, lesson 2026-05-17.)
  ```tsx
  "use client";

  import Link from "next/link";
  import { Text } from "@pekulo/ui/client";
  import { Section } from "@pekulo/ui";

  // Story 6-5 (FR-36) — navigation entry from settings into the 90-day activity
  // log. Grayscale text link (AC-6); the "→" affordance mirrors the ux-preview
  // SettingsScreen mock. Routes to /dashboard/parametres/journal-ia (under
  // (cap)/dashboard/* so the CapShell layout wraps it, lesson 2026-05-27).
  export function LlmActivityLogLink() {
    return (
      <Section title="Journal d'activité IA" ariaLabel="Accès au journal d'activité de l'IA">
        <Link href="/dashboard/parametres/journal-ia" style={{ textDecoration: "none" }}>
          <Text color="$colorSecondary" fontSize="$caption" hoverStyle={{ color: "$color" }}>
            Voir le journal d'activité IA (90 derniers jours) →
          </Text>
        </Link>
      </Section>
    );
  }
  ```
  Run: `bun --filter='@pekulo/web' run typecheck`
  Expected: exit 0, no output.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_llm/_components/llm-activity-log-link.tsx" && git commit -m "feat(#36): settings entry link to the activity log (FR-36)"`

- [x] **T15 — Create the route shell `apps/web/src/app/(cap)/dashboard/parametres/journal-ia/page.tsx`** [AC: AC-1]
  > Next.js 16 in `apps/web` has breaking changes vs older versions — per `apps/web/AGENTS.md`, skim `apps/web/node_modules/next/dist/docs/` for any `page.tsx` / route deprecation notice before relying on a remembered API. This shell uses no async params or `searchParams`, so it is low-risk, but confirm the default-export page signature against the installed docs.
  Create the new file `apps/web/src/app/(cap)/dashboard/parametres/journal-ia/page.tsx` (a server-component shell — mirror of `parametres/page.tsx`: no oRPC `await`, no props; the Client `<LlmActivityLog/>` subscribes to its own query):
  ```tsx
  // apps/web/src/app/(cap)/dashboard/parametres/journal-ia/page.tsx
  // RSC shell for the 90-day LLM activity log (story 6-5, FR-36). Mirror of
  // parametres/page.tsx. Lives under (cap)/dashboard/* so the CapShell layout
  // (dashboard/layout.tsx) wraps it with the cap-view nav (lesson 2026-05-27 —
  // routes under (cap)/anything-but-dashboard render bare).
  import { pekuloSpacing } from "@pekulo/ui";
  import { LlmActivityLog } from "../../_llm/_components/llm-activity-log";

  export default function JournalIaPage() {
    return (
      <div
        style={{
          display: "flex",
          padding: pekuloSpacing[4],
          alignItems: "center",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 720,
            display: "flex",
            flexDirection: "column",
            gap: pekuloSpacing[6],
          }}
        >
          <LlmActivityLog />
        </div>
      </div>
    );
  }
  ```
  Run: `bun --filter='@pekulo/web' run typecheck`
  Expected: exit 0, no output.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/parametres/journal-ia/page.tsx" && git commit -m "feat(#36): /parametres/journal-ia route shell (FR-36)"`

- [x] **T16 — Wire the entry link into `apps/web/src/app/(cap)/dashboard/parametres/page.tsx`** [AC: AC-6]
  In `apps/web/src/app/(cap)/dashboard/parametres/page.tsx`, **replace** the import line:
  ```ts
  import { LlmOptInToggle } from "../_llm/_components/llm-opt-in-toggle";
  ```
  with:
  ```ts
  import { LlmOptInToggle } from "../_llm/_components/llm-opt-in-toggle";
  import { LlmActivityLogLink } from "../_llm/_components/llm-activity-log-link";
  ```
  and **replace** the render line:
  ```tsx
          <LlmOptInToggle />
  ```
  with:
  ```tsx
          <LlmOptInToggle />
          <LlmActivityLogLink />
  ```
  Run: `bun --filter='@pekulo/web' run typecheck`
  Expected: exit 0, no output.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/parametres/page.tsx" && git commit -m "feat(#36): surface the activity-log link in settings (FR-36)"`

- [x] **T17 — Full-suite gate + visual verification** [AC: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6]
  Run the package suites end-to-end:
  ```bash
  bun --filter='@pekulo/validators' run typecheck
  bun --filter='@pekulo/contracts' run typecheck
  bun --filter='@pekulo/api' run typecheck
  bun --filter='@pekulo/api' run test
  bun --filter='@pekulo/web' run typecheck
  bun --filter='@pekulo/web' run test "src/app/\(cap\)/dashboard/_llm/_components/llm-activity-log.test.tsx"
  ```
  Expected: every command exits 0; the api suite ends `… pass, 0 fail`; the web suite ends `Test Files  1 passed`, `Tests  4 passed`.
  Then **visual verification (GREEN gate, CLAUDE.md frontend rule):** start the web dev server, navigate to `/dashboard/parametres`, click "Voir le journal d'activité IA →", and capture the rendered list with `mcp__react-grab-mcp__get_element_context` on the `Journal d'activité IA` Section. Confirm: grayscale route/outcome labels (no emerald/red), rows aligned route · latency · outcome · date, the empty state when the DB has no calls, and `PekuloPagination` when > 10 rows. **If `react-grab-mcp` is offline** (it has been for stories 6-3/6-4/6-8/6-9/6-10), record the waiver in the Completion Notes and confirm the static design-law pass instead (TR-strict grayscale + `aria-live` loading region + `role="list"`/`listitem`).
  No commit — this task is a gate, not a code change.

## Dev Notes

### Locked decisions (step-04 gate, user-validated)

1. **Surface = dedicated route** `(cap)/dashboard/parametres/journal-ia` (T15), reached from a settings entry link (T14). Survives the story-8-2 Settings refactor; inherits the CapShell layout. (Alternative inline-section rejected.)
2. **API read = outcome-only** — new `listRecentOutcomesByUser` (T2) returns up to 200 **completed** calls (phase `"outcome"`), so every row carries route + latency + outcome (AC-1). Reusing the mixed-phase `listRecentByUser` would surface ~100 calls + null-latency intent rows — rejected.
3. **Pagination = client-side** over the bounded server window (≤200 rows × 90-day filter), 10/page via `PekuloPagination` (T12). No server offset/cursor round-trip — the window cannot grow unbounded. Escalate to a server `page?` offset only if the window cap is ever raised past Persona-#1 scale (NFR-16 50k).

### Reconciliations vs the epic / mock (verified against live code)

- **`epics.md` says `llm.repository.findByUserSince(90 days)`** — the equivalent reader **already exists** as `LlmRepository.listRecentByUser(userId, since)` (6-1). 6-5 adds the **outcome-only** sibling `listRecentOutcomesByUser` rather than a `findByUserSince` synonym.
- **The ux-preview mock (`data/mock.ts` L564) types `outcome: "success" | "fallback" | "error"` and carries `inputBytes`** — both are WRONG vs the shipped domain. Render the REAL enum `LLM_OUTCOMES = ["success","failure","overridden"]` (`@pekulo/types`); there is no `inputBytes` column (the audit row stores only a `labelHash`, never persisted to the DTO). Cross-check code over mock prose (lesson 2026-05-17).
- **The mock shows only the entry-point link** ("Voir le journal d'activité IA →"), no log screen — 6-5 designs the view.
- **`@pekulo/types#LlmCallLogEntry` already declares "DTO surfaced by the 90-day activity log (story 6-5)"** — 6-5 reuses it (no new type), with `phase`/`latencyMs`/`outcome` present; the UI shows route/latency/outcome/time and ignores `phase`.

### Lessons applied to this draft

- **2026-05-07 ($accent grayscale)** — route + outcome labels are grayscale (`$color`/`$colorSecondary`/`$colorTertiary`); NO emerald/green/red (AC-6). The route badge variant (`LlmRouteBadge` ios/ollama/cloud) is NOT reused — the log stores the domain `LlmRoute` enum.
- **2026-05-24 (R13 hydration guard)** — `LlmActivityLog` gates the list + the locale/tz `Intl.DateTimeFormat` behind `isHydrated`; SSR and first client paint both render the loading branch (identical trees), the dated list mounts only post-effect.
- **2026-05-26 (no `<Suspense>` around `useActionQuery`)** — loading surfaces via `isLoading`; the component uses an `aria-live` region, never a Suspense boundary.
- **2026-05-24 (`defineAction.tags` is server-only)** — `getLlmActivityLog` is read-only with no tags and no `setTagRegistry` edge; it refreshes on `staleTime` (no web-tier writer exists).
- **2026-05-19 (`bun --filter='@pekulo/api'`)** — every api task uses the full quoted workspace name.
- **2026-05-20 (vitest `vi.hoisted`)** — T13 mocks the hook via `vi.hoisted` (factory is hoisted).
- **2026-05-27 (routes under `(cap)/dashboard/*`)** — the new route lives under `dashboard/` so the CapShell wraps it.
- **2026-05-31 / 2026-06-02 (doc-sync is part of the work)** — this story has no post-lock scope additions; if the dev adds any (e.g. server-side pagination), update this file + `epic-6-context.md` + (if behaviour/columns change) the architecture/ADR in the SAME change.

### File map (3-bullet decision per file)

**`packages/validators/src/llm/llm.schemas.ts`** (M) · responsibility: Zod schemas for the LLM module; add the activity-log read DTO. · in: `@pekulo/zod`, the existing `llmRouteSchema`/`llmOutcomeSchema` mirrors; out: `llmCallLogEntrySchema`, `llmActivityLogSchema`, types.
**`apps/api/src/modules/llm/llm.repository.ts`** (M) · responsibility: Prisma persistence/reads for the LLM module; add the outcome-only audit reader. · in: `PrismaService`, `LlmCallLogEntry`; out: `listRecentOutcomesByUser`.
**`apps/api/src/modules/llm/llm.service.ts`** (M) · responsibility: LLM routing + audit authority + categorisation; add the 90-day-floor activity read. · in: `LlmRepository`, `LlmCallLogEntry`; out: `listActivityLog`.
**`packages/contracts/src/llm/llm.contract.ts`** (M) · responsibility: the `/rpc/v1/llm` oRPC contract; add `getActivityLog`. · in: validators schemas; out: `llmContractV1.getActivityLog`.
**`apps/api/src/modules/llm/llm.routes.ts`** (M) · responsibility: oRPC handlers for the client-facing llm surface; bind `getActivityLog`. · in: `LlmService`, `requireUserId`; out: the router with the new handler.
**`apps/web/src/lib/zapaction/keys.ts`** (M) · responsibility: the feature key/tag registry; register the read key. · in: `createFeatureKeys`; out: `llmKeys.activityLog()`.
**`apps/web/src/app/(cap)/dashboard/_llm/_actions/llm-actions.ts`** (M) · responsibility: server actions bridging web → `llmClient`; add the activity-log read action. · in: `llmClient`, validators; out: `getLlmActivityLog`.
**`apps/web/src/app/(cap)/dashboard/_llm/_hooks/use-llm-activity-log.ts`** (C) · responsibility: the read hook for the activity log. · in: `useActionQuery`, `getLlmActivityLog`, `llmKeys`; out: `useLlmActivityLog`.
**`apps/web/src/app/(cap)/dashboard/_llm/_components/llm-activity-log.tsx`** (C) · responsibility: render the paginated activity list (grayscale, R13, empty state). · in: `useLlmActivityLog`, `@pekulo/ui` `Section`/`PekuloPagination`; out: `<LlmActivityLog/>`.
**`apps/web/src/app/(cap)/dashboard/_llm/_components/llm-activity-log-link.tsx`** (C) · responsibility: the settings entry link to the log. · in: `next/link`, `@pekulo/ui`; out: `<LlmActivityLogLink/>`.
**`apps/web/src/app/(cap)/dashboard/parametres/journal-ia/page.tsx`** (C) · responsibility: the route shell hosting `<LlmActivityLog/>`. · in: `LlmActivityLog`, `pekuloSpacing`; out: default page export.
**`apps/web/src/app/(cap)/dashboard/parametres/page.tsx`** (M) · responsibility: the settings shell; render the new entry link. · in: `LlmActivityLogLink`; out: the updated shell.

### Existing code at write time (Step-0 verbatim quotes)

`apps/api/src/modules/llm/llm.repository.ts` — interface tail + `listRecentByUser` impl (T2 adds the outcome sibling alongside these):
```ts
  getAiNoticeSeen(userId: string): Promise<boolean>;
  markAiNoticeSeen(userId: string): Promise<void>;
  listRecentByUser(userId: string, since: Date): Promise<LlmCallLogEntry[]>;
}
```
```ts
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
```

`apps/api/src/modules/llm/llm.service.ts` — interface tail, `markAiNotice` helper, returned object literal (T4 inserts around these):
```ts
  recordLlmCall(userId: string, event: LlmCallEvent): Promise<void>;
  recordLlmCallPair(userId: string, events: [LlmCallEvent, LlmCallEvent]): Promise<void>;
}
```
```ts
  async function markAiNotice(userId: string): Promise<void> {
    return deps.repository.markAiNoticeSeen(userId);
  }
```
```ts
  return {
    route: routeDecision,
    categorise: categoriseImpl,
    getThirdPartyOptIn: getOptIn,
    setThirdPartyOptIn: setOptIn,
    getAiNoticeSeen: getAiNotice,
    markAiNoticeSeen: markAiNotice,
    recordLlmCall: record,
    recordLlmCallPair: recordPair,
  };
```

`packages/contracts/src/llm/llm.contract.ts` — full current file (T6 replaces it):
```ts
import { oc } from "@orpc/contract";
import { aiNoticeStateSchema, llmOptInSchema, updateLlmOptInSchema } from "@pekulo/validators";

export const llmContractV1 = {
  getOptIn: oc.output(llmOptInSchema),
  setOptIn: oc.input(updateLlmOptInSchema).output(llmOptInSchema),
  getAiNotice: oc.output(aiNoticeStateSchema),
  markAiNotice: oc.output(aiNoticeStateSchema),
} as const;
```

`apps/api/src/modules/llm/llm.routes.ts` — `markAiNotice` handler (T7 inserts `getActivityLog` after it):
```ts
    markAiNotice: impl.markAiNotice.handler(async ({ context }) => {
      requireUserId(context.userId);
      await deps.service.markAiNoticeSeen(context.userId);
      return { seen: true };
    }),
```

`packages/validators/src/llm/llm.schemas.ts` — tail (T1 appends after this); note `llmRouteSchema` / `llmOutcomeSchema` already exist above:
```ts
export const aiNoticeStateSchema = z.object({ seen: z.boolean() });
export type AiNoticeState = z.infer<typeof aiNoticeStateSchema>;
```

`apps/web/src/lib/zapaction/keys.ts` — current `llmKeys`/`llmTags` (T9 extends `llmKeys`; NO new tag/edge):
```ts
export const llmKeys = createFeatureKeys("llm", {
  optIn: () => ["optIn"] as const,
  aiNotice: () => ["aiNotice"] as const,
});
export const llmTags = createFeatureTags("llm", {
  optIn: () => ["optIn"] as const,
  aiNotice: () => ["aiNotice"] as const,
});
```

`apps/web/src/app/(cap)/dashboard/parametres/page.tsx` — current shell (T16 adds the link import + render):
```tsx
import { LlmOptInToggle } from "../_llm/_components/llm-opt-in-toggle";
// …
        <CompassEditForm />
        <CompassHistoryPanel />
        <LlmOptInToggle />
```

`apps/api/src/modules/llm/llm.integration.test.ts` — fake `llmCallLog` block (T8 replaces it) + the existing `describe` it appends after:
```ts
    llmCallLog: {
      create: async () => undefined,
      findMany: async () => [],
    },
```

`@pekulo/types#LlmCallLogEntry` (reused as the DTO — no change needed):
```ts
export interface LlmCallLogEntry {
  id: LlmCallLogId;
  callId: string;
  phase: "intent" | "outcome";
  route: LlmRoute;
  latencyMs: number | null;
  outcome: LlmOutcome | null;
  occurredAt: string;
}
```

### Testing

- **api** — `bun:test`. New/extended: `llm.repository.test.ts` (T3), `llm.service.test.ts` (T5), `llm.integration.test.ts` (T8 — real Elysia + JWT + fake Prisma, the AC-5 401 and AC-1/AC-2 200 boundary). Run targeted with `bun --filter='@pekulo/api' run test <relative-path>`, full with `bun --filter='@pekulo/api' run test`.
- **web** — `vitest`. New: `llm-activity-log.test.tsx` (T13) via `renderWithTamagui` + `vi.hoisted`/`vi.mock` of the hook. Run with `bun --filter='@pekulo/web' run test "<path-with-escaped-parens>"`.
- **No real Postgres harness** — RLS-policy coverage is verified separately by `db:rls-audit` (`llm_call_log`: SELECT+INSERT only, append-only); no schema/migration change in this story, so RLS is untouched.

### Dependencies

- No new packages. Reuses: `@pekulo/types#{LlmCallLogEntry, LlmRoute, LlmOutcome}`, `@pekulo/validators#{llmRouteSchema, llmOutcomeSchema}`, `@pekulo/ui#{Section, PekuloPagination}` + `@pekulo/ui/client#{Text, View}`, `@zapaction/{core,query}`, `next/link`. No Prisma schema/migration change. `llmClient` (apps/web) already infers `getActivityLog` from the contract — `lib/orpc/modules.ts` needs NO edit.

## File List

Expected files (C = create, M = modify):

- M `packages/validators/src/llm/llm.schemas.ts` — activity-log read schemas (T1)
- M `apps/api/src/modules/llm/llm.repository.ts` — `listRecentOutcomesByUser` (T2)
- M `apps/api/src/modules/llm/llm.repository.test.ts` — reader tests (T3)
- M `apps/api/src/modules/llm/llm.service.ts` — `listActivityLog` 90-day floor (T4)
- M `apps/api/src/modules/llm/llm.service.test.ts` — service test (T5)
- M `packages/contracts/src/llm/llm.contract.ts` — `getActivityLog` procedure (T6)
- M `apps/api/src/modules/llm/llm.routes.ts` — `getActivityLog` handler (T7)
- M `apps/api/src/modules/llm/llm.integration.test.ts` — 200/no-PII/401 boundary (T8)
- M `apps/web/src/lib/zapaction/keys.ts` — `llmKeys.activityLog()` (T9)
- M `apps/web/src/app/(cap)/dashboard/_llm/_actions/llm-actions.ts` — `getLlmActivityLog` (T10)
- C `apps/web/src/app/(cap)/dashboard/_llm/_hooks/use-llm-activity-log.ts` — read hook (T11)
- C `apps/web/src/app/(cap)/dashboard/_llm/_components/llm-activity-log.tsx` — paginated list (T12)
- C `apps/web/src/app/(cap)/dashboard/_llm/_components/llm-activity-log.test.tsx` — list tests (T13)
- C `apps/web/src/app/(cap)/dashboard/_llm/_components/llm-activity-log-link.tsx` — settings entry link (T14)
- C `apps/web/src/app/(cap)/dashboard/parametres/journal-ia/page.tsx` — route shell (T15)
- M `apps/web/src/app/(cap)/dashboard/parametres/page.tsx` — render the link (T16)

## Dev Agent Record

- **Model:** claude-opus-4-8[1m] (Opus 4.8, 1M context)
- **Started:** 2026-06-03T13:01:09Z
- **Completed:** 2026-06-03T13:23:20Z

### Summary

Shipped FR-36 end-to-end as scoped: an outcome-only audit reader
(`listRecentOutcomesByUser`, 200-row keyset window) → a 90-day-floor service
read (`listActivityLog`) → the `llm.getActivityLog` oRPC procedure + handler →
a read-only web action/hook → a grayscale, R13-guarded, client-paginated
`LlmActivityLog` list reached from a settings entry link at its own
`(cap)/dashboard/parametres/journal-ia` route. No prompt content ever crosses
the boundary (NFR-26): the DTO carries only route/latency/outcome/timestamp +
opaque ids, asserted at the repository (DTO keys), HTTP (raw-body scan) and DOM
(textContent) layers. All 17 tasks passed their GATE; no scope was added beyond
the step-04 lock, so no doc-sync debt was incurred.

### Files changed

- packages/validators/src/llm/llm.schemas.ts
- apps/api/src/modules/llm/llm.repository.ts
- apps/api/src/modules/llm/llm.repository.test.ts
- apps/api/src/modules/llm/llm.service.ts
- apps/api/src/modules/llm/llm.service.test.ts
- apps/api/src/modules/llm/llm-categorise.test.ts
- apps/api/src/modules/llm/llm.attest-router.test.ts
- packages/contracts/src/llm/llm.contract.ts
- apps/api/src/modules/llm/llm.routes.ts
- apps/api/src/modules/llm/llm.integration.test.ts
- apps/web/src/lib/zapaction/keys.ts
- apps/web/src/app/(cap)/dashboard/_llm/_actions/llm-actions.ts
- apps/web/src/app/(cap)/dashboard/_llm/_hooks/use-llm-activity-log.ts
- apps/web/src/app/(cap)/dashboard/_llm/_components/llm-activity-log.tsx
- apps/web/src/app/(cap)/dashboard/_llm/_components/llm-activity-log.test.tsx
- apps/web/src/app/(cap)/dashboard/_llm/_components/llm-activity-log-link.tsx
- apps/web/src/app/(cap)/dashboard/parametres/journal-ia/page.tsx
- apps/web/src/app/(cap)/dashboard/parametres/page.tsx

### Deviations

- **Widened three pre-existing fakes** (`llm-categorise.test.ts`,
  `llm.service.test.ts`, `llm.attest-router.test.ts`) the story's verbatim
  `git add` lists omit: adding `listRecentOutcomesByUser` to `LlmRepository`
  (T2) and `listActivityLog` to `LlmService` (T4) breaks every structural fake
  of those interfaces. Folded into the T2/T4 commits to keep each commit
  typecheck-green (established 6-2/6-3 "widen fakes" pattern).
- **T5 snippet tsc-only bug** — the story's verbatim T5 provider stubs
  (`{ complete }`) lacked `LlmProvider.route`, which passes `bun test` (loose
  transpile) but fails `tsc`. The branch was briefly tsc-red after the T5
  commit because the per-task gate ran `bun test` only; fixed by adding
  `route` to both stubs, folded into the T7 commit (which also surfaces the
  api typecheck via the contract↔handler coupling). Same class 6-2/6-9
  corrected. Going forward I ran `typecheck` after every test task (lesson
  2026-06-01).
- **Visual verification WAIVED** — `react-grab-mcp` is not connected this
  session (offline for 6-3/6-4/6-8/6-9/6-10 too). Confirmed the static
  design-law pass instead: TR-strict grayscale on every route/outcome label
  (`$color`/`$colorSecondary`/`$colorTertiary`; no `$accent`/`$success`/
  `$danger` except the error-alert text), R13 hydration guard, visually-hidden
  `aria-live="polite"` loading region, `role="list"`/`"listitem"`, explicit
  empty state, conditional `PekuloPagination`.
- **Test-filter form** — the story's escaped-parens vitest filter
  (`"src/app/\(cap\)/…"`) resolves to "No test files found" under the Bash
  tool; a paren-free filename filter (`llm-activity-log.test.tsx`) is the
  reliable form.

### Test output

```
# api — full suite
bun --filter='@pekulo/api' run test    → 805 pass, 0 fail (95 files)
# web — full suite
bun --filter='@pekulo/web' run test    → Test Files 76 passed, Tests 172 passed
# web — story component (T13)
bun --filter='@pekulo/web' run test llm-activity-log.test.tsx → Tests 4 passed
# typecheck — all packages exit 0
@pekulo/{validators,contracts,api,web} typecheck → Exited with code 0
```

RED witnesses captured this session: T3 (`db.llmCallLog.findMany is not a
function`), T5 (90→9-day floor → `ageDays ≈ 9` fails `>89.9`), T8 (empty
`items` → `items[0]` undefined), T13 (broken `ollama` label → `findByText("Ollama")`
not found).

## Review Record

**Date:** 2026-06-03
**Auditors:** Spec, Code, Edge & Hallucination
**Verdict:** done
**Override:** Spec AC gap accepted — reason: "AC gaps were test-coverage only on code the Code + Edge auditors verified correct; fixed the assertions in-place in-review rather than bouncing the whole story to dev."

Code + Edge auditors APPROVED on the first pass (PII drop airtight across repository→contract→action→DOM; per-user JWT scoping sound; 401-before-read proven; 0 hallucinated identifiers / 30 verified). Spec returned CHANGES_REQUESTED on AC test coverage; all findings fixed in-review and re-verified APPROVED by both Spec and Code.

### Findings

#### Resolved
- [MAJOR] AC-6 — grayscale labels / R13 hydration guard / `aria-live` region were present in code but asserted by no test [llm-activity-log.tsx:42,51-67,90-100]
  - Source: Spec
  - Resolution: `ac0c7e0` — added a loading test (`role="status"` + `aria-live="polite"` + no list mounts while loading = R13 gate) and a grayscale test (no `_col-(danger|success|accent)` atomic class on any label; route label carries `_col-color`).
- [MINOR] AC-1 — order asserted on `createdAt` while the UI displays `occurredAt`; no DOM render-order test [llm.repository.ts:142 / llm-activity-log.tsx:100]
  - Source: Spec + Edge & Hallucination (converged)
  - Resolution: `ac0c7e0` + `aa37d0a` — added a 2-row DOM render-order test (component preserves server order, no client re-sort) and froze the `occurredAt == createdAt` invariant in `listRecentOutcomesByUser` (sole writer never sets `occurredAt`; switch `orderBy` if that ever diverges).
- [MINOR] AC-1 — the "≥200 calls" / page-2 pagination scenario was untested (coverage stopped at 12 rows → page 1) [llm-activity-log.test.tsx]
  - Source: Spec
  - Resolution: `ac0c7e0` — 200-item test asserting 20 pages (a "Page 20" control) + a page-2 click proving the second 10-row slice (latency 10..19 ms).
- [MINOR] AC-5 — "no read reaches the service" was true structurally but not asserted (no spy) [llm.integration.test.ts]
  - Source: Spec
  - Resolution: `aa37d0a` — module-scope `activityLogReads` counter; the 401 test asserts a zero-read delta, proving `requireUserId` short-circuits before any `llm_call_log` read.
- [MINOR] AC-3 — the >90-day exclusion behaviour was never exercised (the fake `findMany` ignores `gte`) [llm.repository.test.ts]
  - Source: Spec
  - Resolution: `aa37d0a` — documented the `createdAt >= since` predicate as the unit-scope exclusion contract; real >90-day row exclusion is Prisma's, covered by the DB-backed `db:rls-audit` (no Postgres test harness in-repo). Accepted resolution.
- [NIT] Doc-sync — the bounded-200 activity read was absent from the architecture D2 pagination-exception ledger [docs/architecture.md:132]
  - Source: Code
  - Resolution: `a064fdb` — recorded `llm_call_log`'s activity read as a third, distinct D2 deviation (keyset ordering, 200-row cap, no `nextCursor`, client-paginated).
- [NIT] `OUTCOME_LABEL[entry.outcome]` is an object-index on a free-form `String` column → could render `undefined` on an out-of-band DB write [llm-activity-log.tsx:96]
  - Source: Edge & Hallucination
  - Resolution: `ac0c7e0` — belt-and-suspenders `?? "—"` fallback (unreachable via the validated pipeline; guards a manual-SQL / bad-migration write).

#### Dismissed
- [NIT] `NINETY_DAYS_MS` is a fixed-ms window (±1h across a DST transition) rather than a calendar 90 days [llm.service.ts:113]
  - Source: Edge & Hallucination
  - Rationale: AC-3 specifies "createdAt >= now − 90 days", which a fixed-ms window satisfies exactly; the ±1h DST drift is immaterial to a 90-day audit floor and the value runs server-side only (no hydration concern). Intended behaviour.

#### Unresolved
- none

### Verification
- Test command: `bun --filter='@pekulo/api' run test` · `bun --filter='@pekulo/web' run test llm-activity-log.test.tsx` · `bun --filter='@pekulo/{validators,contracts,api,web}' run typecheck`
- Test output (final pass): api **805 pass, 0 fail** (1948 expect() calls, 95 files); web component **8 passed**; all 4 package typechecks exit 0.
- Visual verification: deferred — `react-grab-mcp` unavailable at 2026-06-03T16:00Z (offline for 6-3/6-4/6-8/6-9/6-10 too); static design-law pass clean (TR-strict grayscale, `aria-live` loading region, R13 guard, `role="list"`/`"listitem"`), now also backed by the AC-6 unit assertions added in `ac0c7e0`.

### Ticket sync
- Ticket comment posted: https://github.com/yabafre/pekulo/issues/36#issuecomment-4613413145
- PR opened/updated: https://github.com/yabafre/pekulo/pull/121 (base `main` = `umbrella_branch`; marked ready for review)
