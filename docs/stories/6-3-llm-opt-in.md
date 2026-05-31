# Story: 6-3-llm-opt-in — Third-party LLM opt-in toggle + server-side guard

**Epic:** Epic 6 — LLM auto-categorisation
**Status:** review
**Ticket:** [#34](https://github.com/yabafre/pekulo/issues/34)
**Branch:** feature/34-6-3-llm-opt-in
**Covered FRs:** FR-34 (third-party LLM opt-in toggle, default off)
**Binds:** NFR-13 (0 third-party prompt without opt-in; state surfaced 100 % of the time) · DR-7 (explicit per-user opt-in, server-side)
**Commit prefix:** `feat(#34): …` — the PR (after `aped-review`) carries `Fixes #34` in the body.

## User Story

**As a** Pekulo user, **I want** an opt-in toggle in Settings for the third-party LLM API (default OFF) backed by a server-side guard that prevents any prompt from leaving without my opt-in, **so that** I keep full control over data egress to third-party models.

> **Scope guard (locked at aped-story step 04):** this story ships FR-34 only — the **per-user opt-in write path** (`llm.setOptIn`), its **read** (`llm.getOptIn`), the first **client-facing oRPC procedures** on `/rpc/v1/llm`, and the **Paramètres → Intelligence artificielle** toggle that surfaces the state. The server-side guard (`requireThirdPartyOptIn`) and the opt-in **read** already shipped in story 6-1; this story adds the write + the UI + the build-failing route guard test. It does **NOT** ship: the `ollama → third_party` low-confidence escalation policy that would actually *route* a call to `third_party` (deferred in 6-1 AND 6-2 — see *Out of scope*), the AI transparency notice (FR-33/DR-12 → story 6-4), the LLM activity-log view (FR-36 → story 6-5), or the client-side Zustand opt-in mirror for the route badge (→ story 6-4).

## Acceptance Criteria

- **AC-1 (the router never auto-selects the third-party API — NFR-13 default-deny)** — **Given** any client (iOS-capable or a web client), **When** the system decides which LLM endpoint to use for a categorisation, **Then** it selects on-device FoundationModels for an iOS-capable client and the self-hosted Ollama model otherwise, and **never** the third-party API. A build-failing test asserts the third-party route is never auto-selected for either client.
- **AC-2 (the third-party path is gated by a server-side opt-in check — DR-7)** — **Given** a user who has not opted in, **When** the system is about to send a prompt to the third-party API, **Then** it refuses with an opt-in-required error (HTTP 403) and sends nothing. **Given** the same user after opting in, **When** the same path runs, **Then** it is permitted. The opt-in state is read on the server, never trusted from the client.
- **AC-3 (the opt-in preference persists — write path)** — **Given** the opt-in defaults to off (no stored preference), **When** the user turns it on, **Then** the preference is stored under their account; **When** they turn it off, **Then** the same single per-user preference is updated (not duplicated). Two concurrent first-time changes never surface a server error.
- **AC-4 (Settings surfaces the opt-in 100 % of the time — NFR-13)** — **Given** the Paramètres page, **When** it renders, **Then** an "Intelligence artificielle" section shows a toggle reflecting the stored opt-in (off by default), and toggling it persists the new value so it survives a page reload. Verified visually at GREEN.
- **AC-5 (authenticated, per-user opt-in over the API)** — **Given** the LLM module's opt-in read/write endpoints, **When** a request arrives without a valid session, **Then** it is rejected with 401 within the NFR-9 budget; **When** a signed-in user reads or writes their opt-in, **Then** the operation is scoped to that user's own data only (per-user isolation, ADR-0013).
- **AC-6 (Iron-Law gates)** — **Given** the branch, **When** the full gate set runs, **Then** all pass: lint → 0 ; typecheck (types + validators + contracts + api + web) → 0 ; `bun:test` (api) + `vitest` (web) suites → all pass ; `prisma:check` → valid ; `db:rls-audit` → exit 0 with **every table's policy count unchanged** (this story adds **no** table — `llm_opt_in` already shipped with its full RLS quartet in story 6-1).

> **Ticket #34 AC reconciliation (recorded at step 03/04):** the ticket's AC-2 (*"When the next ambiguous case arises, the router may select `third_party`"*) is satisfied here **at the machinery level**, not by shipping an escalation policy. The `ollama → third_party` low-confidence escalation that would make `decideRoute` ever return `third_party` was explicitly deferred in story 6-1 AND re-deferred in story 6-2 (unreachable until the opt-in write exists — which is *this* story). 6-3 ships the opt-in write + the server-side guard, so the third-party path becomes *permitted* once a user opts in (AC-2: guard resolves on `true`, rejects on `false`); the actual escalation trigger remains a later story. AC-1 (router never auto-returns `third_party`) holds unchanged.

## Tasks

> Every task is self-contained — the full code, the literal run command, the expected output and the literal commit live under **Dev Notes → Task-by-task implementation code**. Run each task on `feature/34-6-3-llm-opt-in`. `apps/api` tests are `bun:test` (NOT vitest); `apps/web` tests are `vitest`. Every workspace command uses the fully-qualified name `bun --filter='@pekulo/<pkg>'` (NEVER `=api`, NEVER `--cwd`).

- [x] **T1** — `llmOptInSchema` + `updateLlmOptInSchema` in `@pekulo/validators/llm` [AC: AC-3, AC-5]
- [x] **T2** — `getOptIn` + `setOptIn` procedures on `llmContract` (`@pekulo/contracts`) [AC: AC-5]
- [x] **T3** — `llm.repository.ts#setThirdPartyOptIn` (P2002-safe upsert) [AC: AC-3]
- [x] **T4** — `llm.service.ts#getThirdPartyOptIn` + `#setThirdPartyOptIn` [AC: AC-2, AC-3]
- [x] **T5** — `llm.routes.ts` client-facing router (`getOptIn`/`setOptIn`) [AC: AC-5]
- [x] **T6** — `llm.module.ts` returns `router` [AC: AC-5]
- [x] **T7** — Mount `llm: llmModule.router` in `runtime-dependencies.ts` [AC: AC-5]
- [x] **T8** — `llm-opt-in.test.ts` — route guard (AC-1) + persistence (AC-3) + opt-in guard (AC-2) [AC: AC-1, AC-2, AC-3]
- [x] **T9** — Web `llmClient` + `llmKeys`/`llmTags` registry [AC: AC-4]
- [x] **T10** — Web actions (`getLlmOptIn`/`setLlmOptIn`) + hooks (`useLlmOptIn`/`useSetLlmOptIn`) + hook test [AC: AC-4]
- [x] **T11** — `llm-opt-in-toggle.tsx` + mount in `parametres/page.tsx` [AC: AC-4]
- [~] **T12** — Visual verification (react-grab-mcp) + full Iron-Law gate + push [AC: AC-4, AC-6] — **Iron-Law gate ✓ + push ✓**; react-grab visual capture **pending** (MCP server not connected this session — see Deviations).

## Dev Notes

### Architecture & decisions

- **PRIMARY ADR — `docs/adr/0008-llm-routing-server-audit-authority-async-attest.md`.** Decision **A\***: opt-in is checked **server-side** before any third-party hit (DR-7), never trusted from the client. The server is the audit/authority surface.
- **Decisions locked at step 04 (this story):**
  - **Q1 — opt-in write + procedures live in the `llm` module** (NOT a new `settings` module). `architecture.md` L1073 maps FR-34 to `settings.service.ts#updateLlmOptIn`, but **no `settings` module exists in `apps/api`** (it is owned by story 8-2, still `pending`), and the `LlmOptIn` table + its read (`isThirdPartyOptedIn`) + the guard (`requireThirdPartyOptIn`) already live in the `llm` module (story 6-1). Shipping the write on `llm` keeps all opt-in logic in one module, uses the `/rpc/v1/llm` contract scaffold that 6-1 explicitly left "for feature stories", and does not pre-empt story 8-2's ownership of the settings surface. **This is a deliberate deviation from the architecture's literal file mapping (`[O]verride` recorded here).**
  - **Q2 — guard-only scope.** 6-3 ships the opt-in write + UI + the server-side guard. It does **not** change `decideRoute` (which never returns `third_party`) and does **not** ship the low-confidence escalation policy (deferred in 6-1 + 6-2 — see *Out of scope*). AC-2 is tested at the guard level: `requireThirdPartyOptIn` rejects on `false`, resolves on `true`.
  - **Q3 — no client-side Zustand mirror.** The server is the single source of truth; the web reads it via `useActionQuery` (oRPC). The `architecture.md` L194 "opt-in mirror for client-only gating" + the global `use-llm-opt-in.ts` are deferred to story 6-4 (which builds the route badge that needs synchronous client-only gating). 6-3's hook lives co-located under `dashboard/_llm/_hooks/`, mirroring the real `_accounts`/`_compass`/`_bank` convention (NOT the older `parametres/_hooks` mapping in architecture.md).
- **No new table, no migration.** Story 6-1 shipped `llm_opt_in` (model + hand-written migration `20260530120000_*`) with the **full RLS quartet** (SELECT/INSERT/UPDATE/DELETE) and the `UNIQUE(user_id)` index. 6-3 only adds a **writer** over that existing table. `db:rls-audit` policy counts MUST stay unchanged (AC-6).
- **Prefixed ids.** `LlmOptIn → "llmo"` is already registered in `id-prefixes.config.ts` (story 0-4). The prefixed-ids Prisma extension injects `llmo_<base62>` at `create` time, so the upsert's `create` block must **not** pass `id` — same `as unknown as …` cast the repository already uses for `llmCallLog.create`.
- **Defense in depth (ADR-0013):** `apps/api` runs the service-role connection that BYPASSES RLS, so per-user isolation on the api path is the explicit `where: { userId }` clause + the `no-prisma-query-without-user-id` lint rule. Every new repository query is keyed on `userId`. RLS on `llm_opt_in` is the safety net for the `apps/web` anon path only.
- **Mutation envelope rule (lessons 2026-05-20):** `setLlmOptIn` returns a **plain** `{ thirdParty }` object (no typed contract error to surface — opt-in cannot 404), so the action **keeps** the `output:` slot (mirrors `createAccount`). The discriminated-union-envelope-without-`output:` rule applies only to actions that branch on a typed `ORPCError` — not relevant here.
- **Tag-registry invalidation (lessons 2026-05-24):** the mutation hook passes `invalidateWithTags: [llmTags.optIn()]` explicitly (the SA boundary strips `action.tags`). Do NOT rely on the server-attached `tags:`.

### Inherited from stories 6-1 (done) / 6-2 (done) — do NOT re-create

- `@pekulo/types#{LlmRoute, LLM_ROUTES, ClientCapabilities}` ; `LlmService.{route, categorise, recordLlmCall, recordLlmCallPair}` ; `LlmRepository.{recordCallEvent, recordCallEvents, isThirdPartyOptedIn, listRecentByUser}` ; `requireThirdPartyOptIn(reader, userId)` + `ThirdPartyOptInReader` (`platform/security/opt-in-guard.ts`) ; the `LlmOptIn` Prisma model + `llm_opt_in` table + RLS quartet ; the empty `llmContract` scaffold (`{} as const`, mount `/rpc/v1/llm`, already aggregated into `pekuloContract` in `@pekulo/contracts`).
- `decideRoute` (private to `llm.service.ts`) returns `foundation_models` for iOS, else `ollama`. The `third_party` branch in `routeDecision` is **wired-but-dormant** (reachable only if `decideRoute` returned `third_party`, which it never does) and is gated by `requireThirdPartyOptIn`. 6-3 does NOT touch `decideRoute`.

### Lessons applied (filtered to this story)

- **2026-05-27 (find-or-create P2002)** — `setThirdPartyOptIn` upserts over the `UNIQUE(user_id)` key; the create-branch race catches the duck-typed `P2002` and re-applies as an update (mirrors `realestate.repository.ts:203` / `transactions.repository.ts:359`).
- **2026-05-27 (route under `(cap)/dashboard/*`)** — the toggle is mounted via `parametres/page.tsx`, which already lives under `(cap)/dashboard/parametres/`; feature code is co-located under `dashboard/_llm/`.
- **2026-05-24 (`defineAction` tags are server-only)** — the mutation hook passes `invalidateWithTags` explicitly.
- **2026-05-24 (TanStack cache vs SSR hydration)** — the toggle component gates its loading branch on a `useEffect` hydration flag (mirrors `compass-history-panel.tsx`).
- **2026-05-19 / 2026-05-07 (`bun --filter='@pekulo/api'`, `bun:test` ≠ vitest)** — every command below uses the quoted workspace name; api tests import from `"bun:test"`, web tests use `vitest`.
- **2026-05-09 (zero `*.types.ts` under `apps/api/src/modules/**`)** — opt-in DTOs live in `@pekulo/validators` (inferred types), not in module-local type files.

### File decision template (3-bullet per created/modified file)

- **`packages/validators/src/llm/llm.schemas.ts`** *(MODIFY)* — append `llmOptInSchema` (read DTO) + `updateLlmOptInSchema` (write input). Imports `z` from `@pekulo/zod` (R1); auto-exported via the existing `@pekulo/validators#./llm` barrel. Single responsibility: the opt-in wire schemas.
- **`packages/contracts/src/llm/llm.contract.ts`** *(MODIFY)* — replace `{}` with `getOptIn`/`setOptIn` via `oc`. Imports the two schemas from `@pekulo/validators`; the contract is already aggregated into `pekuloContract`. Single responsibility: the `llm` oRPC surface.
- **`apps/api/src/modules/llm/llm.repository.ts`** *(MODIFY)* — add `setThirdPartyOptIn(userId, value)` (sole opt-in writer). Imports nothing new; keeps `where: { userId }`. Single responsibility: LLM Prisma persistence.
- **`apps/api/src/modules/llm/llm.service.ts`** *(MODIFY)* — add `getThirdPartyOptIn` (reuses the repository read) + `setThirdPartyOptIn` (delegates to the new writer) to the `LlmService` interface + factory. Single responsibility: LLM routing + audit + opt-in orchestration.
- **`apps/api/src/modules/llm/llm.routes.ts`** *(NEW)* — `createLlmRouter({ service })` implementing `getOptIn`/`setOptIn` from `llmContract`, reading `ctx.userId`. Imports `implement` + `llmContract` + `LlmService`. Single responsibility: bind the `llm` contract to the service.
- **`apps/api/src/modules/llm/llm.module.ts`** *(MODIFY)* — build + return `router: createLlmRouter({ service })` alongside the existing `{ service, repository, attestRouter }`. Single responsibility: LLM composition root.
- **`apps/api/src/bootstrap/runtime-dependencies.ts`** *(MODIFY)* — add `llm: llmModule.router` to the `orpcRouter` literal. Single responsibility: runtime wiring.
- **`apps/api/src/modules/llm/llm-opt-in.test.ts`** *(NEW)* — AC-1 route guard + AC-3 persistence + AC-2 opt-in guard, via a fake Prisma + `createLlmModule`. Single responsibility: opt-in behaviour tests.
- **`apps/web/src/lib/orpc/modules.ts`** *(MODIFY)* — add `llmClient` (now that `/rpc/v1/llm` is mounted). Single responsibility: per-module typed oRPC clients.
- **`apps/web/src/lib/zapaction/keys.ts`** *(MODIFY)* — add `llmKeys`/`llmTags` (`optIn`) + the registry edge. Single responsibility: feature keys + tag invalidation graph.
- **`apps/web/src/app/(cap)/dashboard/_llm/_actions/llm-actions.ts`** *(NEW)* — `getLlmOptIn` (read) + `setLlmOptIn` (mutation). Imports `defineAction`, `llmClient`, the schemas, `ensureRequestContext`. Single responsibility: opt-in server actions.
- **`apps/web/src/app/(cap)/dashboard/_llm/_hooks/use-llm-opt-in.ts`** *(NEW)* — `useLlmOptIn` (query) + `useSetLlmOptIn` (mutation, `invalidateWithTags`). Single responsibility: opt-in client hooks.
- **`apps/web/src/app/(cap)/dashboard/_llm/_hooks/use-llm-opt-in.test.tsx`** *(NEW)* — `useSetLlmOptIn` invalidates `llmKeys.optIn()` (AC-4). Single responsibility: hook test.
- **`apps/web/src/app/(cap)/dashboard/_llm/_components/llm-opt-in-toggle.tsx`** *(NEW)* — the "Intelligence artificielle" section + `PekuloToggleRow` wired to the hooks, hydration-guarded. Single responsibility: the opt-in UI surface.
- **`apps/web/src/app/(cap)/dashboard/parametres/page.tsx`** *(MODIFY)* — mount `<LlmOptInToggle />`. Single responsibility: the Paramètres route shell.

### Existing code at write time (Step-0 verbatim — caught against the live repo, not memory)

**`packages/validators/src/llm/llm.schemas.ts:77-78`** (current tail — T1 appends after these exports; `z` from `@pekulo/zod` is already imported at the top):

```ts
export type RouteIntentInput = z.infer<typeof routeIntentSchema>;
export type AttestLlmCallInput = z.infer<typeof attestLlmCallSchema>;
```

**`packages/contracts/src/llm/llm.contract.ts`** (current — T2 replaces the empty `llmContractV1`):

```ts
export const llmContractV1 = {} as const;
export const llmContract = llmContractV1;
export const llmContractMeta = {
  moduleKey: "llm",
  mountPath: "/rpc/v1/llm",
  version: "v1",
} as const;
```

**`apps/api/src/modules/llm/llm.repository.ts:9-17`** — current `LlmRepository` interface (T3 adds `setThirdPartyOptIn`; the existing `isThirdPartyOptedIn` is the read 6-1 shipped):

```ts
export interface LlmRepository {
  recordCallEvent(userId: string, event: LlmCallEvent): Promise<void>;
  recordCallEvents(userId: string, events: LlmCallEvent[]): Promise<void>;
  isThirdPartyOptedIn(userId: string): Promise<boolean>;
  listRecentByUser(userId: string, since: Date): Promise<LlmCallLogEntry[]>;
}
```

**`apps/api/src/modules/llm/llm.repository.ts:47-53`** — current `isThirdPartyOptedIn` impl (T3 adds the writer right after it; `db = deps.prismaService.client`):

```ts
    async isThirdPartyOptedIn(userId) {
      const row = await db.llmOptIn.findUnique({
        where: { userId },
        select: { thirdParty: true },
      });
      return row?.thirdParty ?? false;
    },
```

**`apps/api/src/modules/llm/llm.service.ts:43-60`** — current `LlmService` interface (T4 adds `getThirdPartyOptIn` + `setThirdPartyOptIn`):

```ts
export interface LlmService {
  route(intent: RouteIntent): Promise<LlmRouteDecision>;
  categorise(intent: RouteIntent): Promise<LlmCategorisation>;
  recordLlmCall(userId: string, event: LlmCallEvent): Promise<void>;
  recordLlmCallPair(userId: string, events: [LlmCallEvent, LlmCallEvent]): Promise<void>;
}
```

**`apps/api/src/modules/llm/llm.service.ts:189-194`** — current factory return (T4 adds the two methods to this object literal):

```ts
  return {
    route: routeDecision,
    categorise: categoriseImpl,
    recordLlmCall: record,
    recordLlmCallPair: recordPair,
  };
```

**`apps/api/src/modules/llm/llm.module.ts:22-34`** — current module factory body + return (T6 adds the router; note `service` is already built above):

```ts
  const repository = createLlmRepository({ prismaService: deps.prismaService });
  const ollamaClient = createOllamaClient({ env: deps.env });
  const thirdPartyClient = createThirdPartyClient({ env: deps.env });
  const service = createLlmService({
    repository,
    ollamaClient,
    thirdPartyClient,
    optInReader: repository,
    generateCallId: () => generateBase62Id(21),
  });
  const attestRouter = createLlmAttestRouter({ jwtVerifier: deps.jwtVerifier, service });
  return { service, repository, attestRouter };
}
```

**`apps/api/src/bootstrap/runtime-dependencies.ts:187-197`** — current `orpcRouter` literal (T7 inserts the `llm` key; `PekuloRpcRouter` is a structural router-record type so the new key needs no type edit):

```ts
  const orpcRouter: PekuloRpcRouter = {
    hypothesis: hypothesisModule.router,
    compass: compassModule.router,
    milestones: milestonesModule.router,
    accounts: accountsModule.router,
    holdings: holdingsModule.router,
    realestate: realestateModule.router,
    transactions: transactionsModule.router,
    monthly: monthlyModule.router,
    bankaggregator: bankAggregatorModule.router,
  };
```

**`apps/web/src/lib/orpc/modules.ts:64-65`** — current tail (T9 adds `llmClient` after `monthlyClient`/`bankAggregatorClient`; mirror the `{ path: ["llm"] }` shape):

```ts
export const transactionsClient: ContractRouterClient<typeof transactionsContract> =
  createORPCClient(orpcLink, { path: ["transactions"] });
```

**`apps/web/src/lib/zapaction/keys.ts:38-43`** — `accounts` block, the closest iso for T9's `llm` block:

```ts
export const accountsKeys = createFeatureKeys("accounts", {
  list: () => ["list"] as const,
});
export const accountsTags = createFeatureTags("accounts", {
  list: () => ["list"] as const,
});
```

**`apps/web/src/lib/zapaction/keys.ts:148-149`** — `accounts` registry edge (T9 adds the `llm` edges next to it):

```ts
  [accountsTags.all()]: [accountsKeys.list()],
  [accountsTags.list()]: [accountsKeys.list()],
```

**`apps/web/src/app/(cap)/dashboard/parametres/page.tsx`** (current — T11 mounts `<LlmOptInToggle />` inside the inner column after `<CompassHistoryPanel />`):

```tsx
import { pekuloSpacing } from "@pekulo/ui";
import { CompassEditForm } from "../_compass/_components/compass-edit-form";
import { CompassHistoryPanel } from "../_compass/_components/compass-history-panel";

export default function ParametresPage() {
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
        <CompassEditForm />
        <CompassHistoryPanel />
      </div>
    </div>
  );
}
```

**New files** (`llm.routes.ts`, `llm-opt-in.test.ts`, `_llm/_actions/llm-actions.ts`, `_llm/_hooks/use-llm-opt-in.ts`, `_llm/_hooks/use-llm-opt-in.test.tsx`, `_llm/_components/llm-opt-in-toggle.tsx`): **Existing code: none — new files.**

### Task-by-task implementation code

#### T1 — `llmOptInSchema` + `updateLlmOptInSchema` [AC: AC-3, AC-5]

Append to `packages/validators/src/llm/llm.schemas.ts` (after the two `export type` lines at the tail):

```ts
// Third-party LLM opt-in (story 6-3, FR-34 / NFR-13 / DR-7). A single boolean
// per user, default false. `llmOptInSchema` is the read DTO returned by
// llm.getOptIn; `updateLlmOptInSchema` is the llm.setOptIn input. No PII — just
// the flag. The inferred type is `LlmOptInState` (NOT `LlmOptIn`) to avoid
// shadowing the Prisma `LlmOptIn` model name in api code that imports both.
export const llmOptInSchema = z.object({
  thirdParty: z.boolean(),
});

export const updateLlmOptInSchema = z.object({
  thirdParty: z.boolean(),
});

export type LlmOptInState = z.infer<typeof llmOptInSchema>;
export type UpdateLlmOptInInput = z.infer<typeof updateLlmOptInSchema>;
```

Run: `bun --filter='@pekulo/validators' run typecheck`
Expected: `tsc` exits 0, no error. (`@pekulo/validators/src/index.ts` already does `export * from "./llm"`, and `./llm/index.ts` does `export * from "./llm.schemas"`, so the new exports surface with no barrel edit.)
Commit: `git add packages/validators/src/llm/llm.schemas.ts && git commit -m "feat(#34): LLM opt-in zod schemas (FR-34)"`

#### T2 — `getOptIn` + `setOptIn` on `llmContract` [AC: AC-5]

Replace the whole `packages/contracts/src/llm/llm.contract.ts` with:

```ts
// packages/contracts/src/llm/llm.contract.ts
// Llm module oRPC contract. Story 6-3 (FR-34) adds the FIRST client-facing
// procedures: getOptIn (read the per-user third-party opt-in flag) + setOptIn
// (write it). Mount under /rpc/v1/llm (ADR-0009). The /internal/llm/attest
// listener (story 6-1) stays Elysia-native and is NOT part of this contract.
import { oc } from "@orpc/contract";
import { llmOptInSchema, updateLlmOptInSchema } from "@pekulo/validators";

export const llmContractV1 = {
  getOptIn: oc.output(llmOptInSchema),
  setOptIn: oc.input(updateLlmOptInSchema).output(llmOptInSchema),
} as const;

export const llmContract = llmContractV1;
export const llmContractMeta = {
  moduleKey: "llm",
  mountPath: "/rpc/v1/llm",
  version: "v1",
} as const;
```

Run: `bun --filter='@pekulo/contracts' run typecheck`
Expected: `tsc` exits 0. (`packages/contracts/src/index.ts` already re-exports `llmContract` and aggregates it into `pekuloContract` — no barrel edit.)
Commit: `git add packages/contracts/src/llm/llm.contract.ts && git commit -m "feat(#34): llm contract — getOptIn + setOptIn procedures"`

#### T3 — `llm.repository.ts#setThirdPartyOptIn` (P2002-safe upsert) [AC: AC-3]

In `apps/api/src/modules/llm/llm.repository.ts`, add `setThirdPartyOptIn` to the `LlmRepository` interface (after `isThirdPartyOptedIn`):

```ts
  isThirdPartyOptedIn(userId: string): Promise<boolean>;
  /** Set the per-user third-party opt-in flag (story 6-3, FR-34). Upserts the
   * single `llm_opt_in` row keyed on the UNIQUE(user_id) index and returns the
   * persisted value. Sole opt-in writer. */
  setThirdPartyOptIn(userId: string, value: boolean): Promise<boolean>;
  listRecentByUser(userId: string, since: Date): Promise<LlmCallLogEntry[]>;
```

In the same file, add the implementation right after the `isThirdPartyOptedIn` method (inside the returned object literal):

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
```

Run: `bun --filter='@pekulo/api' run typecheck`
Expected: `tsc` exits 0.
Commit: `git add apps/api/src/modules/llm/llm.repository.ts && git commit -m "feat(#34): llm.repository setThirdPartyOptIn (P2002-safe upsert)"`

#### T4 — `llm.service.ts#getThirdPartyOptIn` + `#setThirdPartyOptIn` [AC: AC-2, AC-3]

In `apps/api/src/modules/llm/llm.service.ts`, add the two methods to the `LlmService` interface (after `route(...)`):

```ts
export interface LlmService {
  route(intent: RouteIntent): Promise<LlmRouteDecision>;
  /** Read the per-user third-party opt-in flag (story 6-3, FR-34). Default
   * false when no row exists. */
  getThirdPartyOptIn(userId: string): Promise<boolean>;
  /** Set the per-user third-party opt-in flag (story 6-3, FR-34). Returns the
   * persisted value. */
  setThirdPartyOptIn(userId: string, value: boolean): Promise<boolean>;
```

(Leave the rest of the interface — `categorise`, `recordLlmCall`, `recordLlmCallPair` — unchanged.)

In the factory, add the two free functions just before the `return { … }` (alongside `record`/`recordPair`):

```ts
  async function getOptIn(userId: string): Promise<boolean> {
    return deps.repository.isThirdPartyOptedIn(userId);
  }

  async function setOptIn(userId: string, value: boolean): Promise<boolean> {
    return deps.repository.setThirdPartyOptIn(userId, value);
  }
```

Then extend the factory's return object literal to expose them:

```ts
  return {
    route: routeDecision,
    categorise: categoriseImpl,
    getThirdPartyOptIn: getOptIn,
    setThirdPartyOptIn: setOptIn,
    recordLlmCall: record,
    recordLlmCallPair: recordPair,
  };
```

Run: `bun --filter='@pekulo/api' run typecheck`
Expected: `tsc` exits 0.
Commit: `git add apps/api/src/modules/llm/llm.service.ts && git commit -m "feat(#34): llm.service get/setThirdPartyOptIn"`

#### T5 — `llm.routes.ts` client-facing router [AC: AC-5]

Create `apps/api/src/modules/llm/llm.routes.ts`:

```ts
// apps/api/src/modules/llm/llm.routes.ts
// oRPC handlers for the LLM module's client-facing surface (story 6-3, FR-34).
// Two procedures bound to llmContract: getOptIn (read) + setOptIn (write) the
// per-user third-party opt-in flag. Mirrors accounts.routes.ts: each handler
// reads { userId } from the oRPC context (injected by mountOrpc after JWT
// verification) and delegates to the service. Throws PekuloError on missing
// context — the Elysia error mapper translates it to a 401 within NFR-9 (≤100ms).
//
// L8 invariant: the router type is inferred via ReturnType<typeof
// createLlmRouter>; never annotate as `Elysia` or a concrete oRPC type. The
// /internal/llm/attest listener (story 6-1) is a separate Elysia-native router
// and is NOT part of this oRPC tree.
import { implement } from "@orpc/server";
import { llmContract } from "@pekulo/contracts";
import { PekuloError } from "../../common/errors";
import type { LlmService } from "./llm.service";

const impl = implement(llmContract).$context<{
  userId: string;
  email: string | null;
}>();

function requireUserId(userId: string | undefined): asserts userId is string {
  if (!userId || !userId.trim()) {
    throw new PekuloError("UNAUTHORIZED", "user context missing");
  }
}

export function createLlmRouter(deps: { service: LlmService }) {
  return impl.router({
    getOptIn: impl.getOptIn.handler(async ({ context }) => {
      requireUserId(context.userId);
      const thirdParty = await deps.service.getThirdPartyOptIn(context.userId);
      return { thirdParty };
    }),
    setOptIn: impl.setOptIn.handler(async ({ context, input }) => {
      requireUserId(context.userId);
      const thirdParty = await deps.service.setThirdPartyOptIn(context.userId, input.thirdParty);
      return { thirdParty };
    }),
  });
}
```

Run: `bun --filter='@pekulo/api' run typecheck`
Expected: `tsc` exits 0.
Commit: `git add apps/api/src/modules/llm/llm.routes.ts && git commit -m "feat(#34): llm.routes — getOptIn/setOptIn handlers"`

#### T6 — `llm.module.ts` returns `router` [AC: AC-5]

In `apps/api/src/modules/llm/llm.module.ts`, add the import (next to the other module imports):

```ts
import { createLlmRouter } from "./llm.routes";
```

Build the router after `attestRouter` and add it to the return object:

```ts
  const attestRouter = createLlmAttestRouter({ jwtVerifier: deps.jwtVerifier, service });
  const router = createLlmRouter({ service });
  return { service, repository, attestRouter, router };
}
```

Also update the module's header comment first line so it no longer claims "NO oRPC router" — replace the opening comment block's second sentence:

```ts
// Composition root for the LLM module. Returns { service, repository,
// attestRouter, router }. Story 6-1 shipped the service + repository + the
// Elysia-native /internal/llm/attest listener; story 6-3 (FR-34) adds the
// client-facing oRPC router (getOptIn/setOptIn) mounted under /rpc/v1/llm.
// L8: inferred return type, never annotate bare Elysia.
```

Run: `bun --filter='@pekulo/api' run typecheck`
Expected: `tsc` exits 0.
Commit: `git add apps/api/src/modules/llm/llm.module.ts && git commit -m "feat(#34): llm.module exposes the client-facing router"`

#### T7 — Mount `llm: llmModule.router` [AC: AC-5]

In `apps/api/src/bootstrap/runtime-dependencies.ts`, add the `llm` key to the `orpcRouter` literal (after `bankaggregator`):

```ts
  const orpcRouter: PekuloRpcRouter = {
    hypothesis: hypothesisModule.router,
    compass: compassModule.router,
    milestones: milestonesModule.router,
    accounts: accountsModule.router,
    holdings: holdingsModule.router,
    realestate: realestateModule.router,
    transactions: transactionsModule.router,
    monthly: monthlyModule.router,
    bankaggregator: bankAggregatorModule.router,
    llm: llmModule.router,
  };
```

Run: `bun --filter='@pekulo/api' run typecheck`
Expected: `tsc` exits 0.
Commit: `git add apps/api/src/bootstrap/runtime-dependencies.ts && git commit -m "feat(#34): mount llm router under /rpc/v1/llm"`

#### T8 — `llm-opt-in.test.ts` — route guard + persistence + opt-in guard [AC: AC-1, AC-2, AC-3]

Create `apps/api/src/modules/llm/llm-opt-in.test.ts`:

```ts
// bun:test — third-party opt-in (story 6-3, AC-1/AC-2/AC-3). Uses a fake Prisma
// (no Postgres harness in-repo; mirrors llm.module.test.ts) supporting
// llmOptIn.{findUnique,upsert,update} + llmCallLog.create (route() writes an
// intent row). RLS-policy coverage is verified separately by db:rls-audit.
import { expect, test } from "bun:test";
import type { PrismaService } from "../../database";
import type { Env } from "../../config/env";
import type { JwtVerifier } from "../../platform/security";
import { createLlmModule } from "./llm.module";
import { requireThirdPartyOptIn } from "../../platform/security/opt-in-guard";

function makeFakeDb(): PrismaService {
  let optIn: { userId: string; thirdParty: boolean } | null = null;
  let n = 0;
  const client = {
    llmCallLog: {
      create: async () => {
        n++;
        return undefined;
      },
      findMany: async () => [],
    },
    llmOptIn: {
      findUnique: async ({ where }: { where: { userId: string } }) =>
        optIn && optIn.userId === where.userId ? { thirdParty: optIn.thirdParty } : null,
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { userId: string };
        create: { userId: string; thirdParty: boolean };
        update: { thirdParty: boolean };
      }) => {
        optIn =
          optIn && optIn.userId === where.userId
            ? { ...optIn, thirdParty: update.thirdParty }
            : { userId: create.userId, thirdParty: create.thirdParty };
        return { thirdParty: optIn.thirdParty };
      },
      update: async ({
        where,
        data,
      }: {
        where: { userId: string };
        data: { thirdParty: boolean };
      }) => {
        optIn = { userId: where.userId, thirdParty: data.thirdParty };
        return { thirdParty: optIn.thirdParty };
      },
    },
  };
  return { client } as unknown as PrismaService;
}

const fakeJwt = { verify: async () => ({ sub: "u-a", email: null }) } as unknown as JwtVerifier;
const fakeEnv = {} as unknown as Env;

function makeModule() {
  return createLlmModule({ prismaService: makeFakeDb(), env: fakeEnv, jwtVerifier: fakeJwt });
}

const intent = (iosFoundationModels: boolean) => ({
  userId: "user-a",
  clientCapabilities: { iosFoundationModels },
  prompt: { label: "Carrefour", amount: -42.5, currency: "EUR", occurredOn: "2026-05-15" },
});

test("AC-1: route() never returns third_party for any client capability", async () => {
  const mod = makeModule();
  const web = await mod.service.route(intent(false));
  const ios = await mod.service.route(intent(true));
  expect(web.route).toBe("ollama");
  expect(ios.route).toBe("foundation_models");
  expect([web.route, ios.route]).not.toContain("third_party");
});

test("AC-3: setThirdPartyOptIn upserts (create then update); default false", async () => {
  const mod = makeModule();
  expect(await mod.service.getThirdPartyOptIn("user-a")).toBe(false); // no row → false
  expect(await mod.service.setThirdPartyOptIn("user-a", true)).toBe(true); // create branch
  expect(await mod.service.getThirdPartyOptIn("user-a")).toBe(true);
  expect(await mod.service.setThirdPartyOptIn("user-a", false)).toBe(false); // update same row
  expect(await mod.service.getThirdPartyOptIn("user-a")).toBe(false);
});

test("AC-2: guard rejects when opt-in false, resolves once persisted true", async () => {
  const mod = makeModule();
  // The repository is structurally a ThirdPartyOptInReader.
  await expect(requireThirdPartyOptIn(mod.repository, "user-a")).rejects.toMatchObject({
    code: "LLM_OPT_IN_REQUIRED",
  });
  await mod.service.setThirdPartyOptIn("user-a", true);
  await expect(requireThirdPartyOptIn(mod.repository, "user-a")).resolves.toBeUndefined();
});
```

Run: `bun --filter='@pekulo/api' run test apps/api/src/modules/llm/llm-opt-in.test.ts`
Expected: `3 pass`, `0 fail`, exit 0.
Commit: `git add apps/api/src/modules/llm/llm-opt-in.test.ts && git commit -m "feat(#34): opt-in tests — route guard + persistence + DR-7 guard"`

#### T9 — Web `llmClient` + `llmKeys`/`llmTags` registry [AC: AC-4]

**(a)** In `apps/web/src/lib/orpc/modules.ts`, add `llmContract` to the `@pekulo/contracts` import list and export the client after `transactionsClient`/`bankAggregatorClient`:

Add to the import block:

```ts
  bankAggregatorContract,
  llmContract,
} from "@pekulo/contracts";
```

Add the client export (after `bankAggregatorClient`):

```ts
// Story 6-3 — llm opt-in (FR-34). Mount path `/rpc/v1/llm`. First client-facing
// llm procedures (getOptIn / setOptIn); the categorise/route surface stays
// server-internal.
export const llmClient: ContractRouterClient<typeof llmContract> = createORPCClient(orpcLink, {
  path: ["llm"],
});
```

**(b)** In `apps/web/src/lib/zapaction/keys.ts`, add the feature keys/tags after the `accounts` block:

```ts
// Story 6-3 — third-party LLM opt-in (FR-34). Single `optIn` read; the toggle
// mutation invalidates it via the registry edge below.
export const llmKeys = createFeatureKeys("llm", {
  optIn: () => ["optIn"] as const,
});
export const llmTags = createFeatureTags("llm", {
  optIn: () => ["optIn"] as const,
});
```

And add the registry edges inside the `setTagRegistry({ … })` call (next to the `accounts` edges):

```ts
  [llmTags.all()]: [llmKeys.optIn()],
  [llmTags.optIn()]: [llmKeys.optIn()],
```

Run: `bun --filter='@pekulo/web' run typecheck`
Expected: `tsc` exits 0.
Commit: `git add apps/web/src/lib/orpc/modules.ts apps/web/src/lib/zapaction/keys.ts && git commit -m "feat(#34): web llmClient + llm opt-in tag registry"`

#### T10 — Web actions + hooks + hook test [AC: AC-4]

**(a)** Create `apps/web/src/app/(cap)/dashboard/_llm/_actions/llm-actions.ts`:

```ts
"use server";

import { defineAction } from "@zapaction/core";
import { z } from "@pekulo/zod";
import {
  llmOptInSchema,
  updateLlmOptInSchema,
  type LlmOptInState,
  type UpdateLlmOptInInput,
} from "@pekulo/validators";
import { llmClient } from "@/lib/orpc/modules";
import { ensureRequestContext } from "@/lib/orpc/request-context";
import { llmTags } from "@/lib/zapaction/keys";
import type { ActionContext } from "@/lib/zapaction/context";
import "@/lib/zapaction/context";

// Story 6-3 (FR-34) — third-party LLM opt-in. Both procedures return a plain
// { thirdParty } object (no typed contract error to surface — opt-in cannot
// 404), so each KEEPS the `output:` slot (mirrors createAccount; the
// envelope-without-output rule applies only to typed-error branches).

export const getLlmOptIn = defineAction<void, LlmOptInState, ActionContext>({
  name: "getLlmOptIn",
  input: z.void(),
  output: llmOptInSchema,
  handler: async () => {
    await ensureRequestContext();
    return llmClient.getOptIn();
  },
});

export const setLlmOptIn = defineAction<UpdateLlmOptInInput, LlmOptInState, ActionContext>({
  name: "setLlmOptIn",
  input: updateLlmOptInSchema,
  output: llmOptInSchema,
  tags: [llmTags.optIn()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    return llmClient.setOptIn(input);
  },
});
```

**(b)** Create `apps/web/src/app/(cap)/dashboard/_llm/_hooks/use-llm-opt-in.ts`:

```ts
"use client";

import { useActionMutation, useActionQuery } from "@zapaction/query";
import { llmKeys, llmTags } from "@/lib/zapaction/keys";
import { getLlmOptIn, setLlmOptIn } from "../_actions/llm-actions";

export function useLlmOptIn() {
  return useActionQuery(getLlmOptIn, {
    input: undefined,
    queryKey: llmKeys.optIn(),
    readPolicy: "read-only",
    staleTime: 30_000,
  });
}

// invalidateWithTags explicit — the SA boundary strips `action.tags`
// (lessons.md 2026-05-24). The registry maps llmTags.optIn() → llmKeys.optIn().
export function useSetLlmOptIn() {
  return useActionMutation(setLlmOptIn, {
    invalidateWithTags: [llmTags.optIn()],
  });
}
```

**(c)** Create `apps/web/src/app/(cap)/dashboard/_llm/_hooks/use-llm-opt-in.test.tsx` (mirror of `_accounts/_hooks/use-update-account.test.tsx`):

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

Run: `bun --filter='@pekulo/web' run test src/app/\(cap\)/dashboard/_llm/_hooks/use-llm-opt-in.test.tsx`
Expected: `1 passed`, exit 0. (If the shell mangles the parens, run the full suite: `bun --filter='@pekulo/web' run test` — the new test is included.)
Commit: `git add "apps/web/src/app/(cap)/dashboard/_llm/_actions/llm-actions.ts" "apps/web/src/app/(cap)/dashboard/_llm/_hooks/use-llm-opt-in.ts" "apps/web/src/app/(cap)/dashboard/_llm/_hooks/use-llm-opt-in.test.tsx" && git commit -m "feat(#34): web opt-in actions + hooks + hook test"`

#### T11 — `llm-opt-in-toggle.tsx` + mount in `parametres/page.tsx` [AC: AC-4]

**(a)** Create `apps/web/src/app/(cap)/dashboard/_llm/_components/llm-opt-in-toggle.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { PekuloToggleRow, Section } from "@pekulo/ui";
import { useLlmOptIn, useSetLlmOptIn } from "../_hooks/use-llm-opt-in";

// Story 6-3 (FR-34 / NFR-13 / DR-7) — the "Intelligence artificielle" settings
// section. The server is the single source of truth for the opt-in (read via
// useLlmOptIn); the toggle writes via useSetLlmOptIn and the registry
// invalidates the read so the state persists across reloads. Default OFF until
// the read resolves. Hydration-guarded (lessons.md 2026-05-24).
export function LlmOptInToggle() {
  const { data, isLoading, error } = useLlmOptIn();
  const setOptIn = useSetLlmOptIn();
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => setIsHydrated(true), []);
  const showLoading = !isHydrated || isLoading;
  const checked = data?.thirdParty ?? false;
  return (
    <Section
      title="Intelligence artificielle"
      ariaLabel="Paramètres d'intelligence artificielle"
    >
      <PekuloToggleRow
        label="Modèles d'IA tiers"
        sub="Autoriser l'envoi de certaines transactions à une API tierce (Claude / Mistral) pour la catégorisation. Désactivé par défaut."
        checked={checked}
        disabled={showLoading || setOptIn.isPending}
        onChange={(v) => setOptIn.mutate({ thirdParty: v })}
      />
      {error && (
        <span role="alert" style={{ display: "none" }}>
          {error.message}
        </span>
      )}
    </Section>
  );
}
```

**(b)** In `apps/web/src/app/(cap)/dashboard/parametres/page.tsx`, add the import and mount the component after `<CompassHistoryPanel />`:

Add the import (after the existing compass imports):

```tsx
import { LlmOptInToggle } from "../_llm/_components/llm-opt-in-toggle";
```

Add the component inside the inner column, after `<CompassHistoryPanel />`:

```tsx
        <CompassEditForm />
        <CompassHistoryPanel />
        <LlmOptInToggle />
```

Run: `bun --filter='@pekulo/web' run typecheck`
Expected: `tsc` exits 0.
Commit: `git add "apps/web/src/app/(cap)/dashboard/_llm/_components/llm-opt-in-toggle.tsx" "apps/web/src/app/(cap)/dashboard/parametres/page.tsx" && git commit -m "feat(#34): Paramètres IA opt-in toggle (FR-34)"`

#### T12 — Visual verification + full Iron-Law gate + push [AC: AC-4, AC-6]

**(a) Visual verification (frontend GREEN — CLAUDE.md).** With the web dev server running, open `/dashboard/parametres` and capture the toggle:

- Use `mcp__react-grab-mcp__get_element_context` on the "Intelligence artificielle" section's `PekuloToggleRow` (`role="switch"`).
- Confirm: the section renders with the title, the toggle reads `aria-checked="false"` by default, and toggling it flips `aria-checked` to `true` and persists across a reload (the read returns `{ thirdParty: true }`).
- Paste the captured element context into the Dev Agent Record → Completion Notes.

**(b) Full Iron-Law gate** (run from repo root; every command must pass):

```bash
bun run lint
bun --filter='@pekulo/types' run typecheck
bun --filter='@pekulo/validators' run typecheck
bun --filter='@pekulo/contracts' run typecheck
bun --filter='@pekulo/api' run typecheck
bun --filter='@pekulo/web' run typecheck
bun --filter='@pekulo/api' run test
bun --filter='@pekulo/web' run test
bun --filter='@pekulo/api' run prisma:check
bun --filter='@pekulo/api' run db:rls-audit
```

Expected:
- `bun run lint` → 0 errors.
- every `typecheck` → `tsc` exits 0.
- `@pekulo/api` test → all suites pass (incl. `llm-opt-in.test.ts` `3 pass`).
- `@pekulo/web` test → all suites pass (incl. `use-llm-opt-in.test.tsx`).
- `prisma:check` → `prisma format --check` clean + `prisma validate` → `The schema … is valid 🚀`.
- `db:rls-audit` → exit 0, **`llm_opt_in: 4` (quartet unchanged), `llm_call_log: 2` unchanged, every pre-existing table count unchanged** (this story adds no table).

**(c) Push:**

```bash
git push -u origin feature/34-6-3-llm-opt-in
```

Commit (if the visual-verification note is the only working-tree change): `git commit --allow-empty -m "feat(#34): visual verification + Iron-Law gate green"`

### Out of scope (explicitly deferred — do NOT implement here)

- **`ollama → third_party` low-confidence escalation policy** (would make `decideRoute` ever return `third_party`). Deferred in 6-1 AND 6-2; its server-side egress integration test is deferred with it. A later story owns the escalation trigger; 6-3 only makes the third-party path *permitted* once a user opts in.
- **AI transparency notice** (FR-33 / DR-12, re-shown on opt-out → opt-in) → story 6-4.
- **LLM activity-log view** (FR-36, the "journal d'activité" link in the IA section) → story 6-5.
- **Client-side Zustand opt-in mirror + global `use-llm-opt-in.ts`** for the route badge's client-only gating → story 6-4.
- **The full Paramètres screen** (account, theme, language, export, deletion sections) → story 8-2. 6-3 only adds the IA toggle to the interim shell.

## File List

**Created**

- `apps/api/src/modules/llm/llm.routes.ts`
- `apps/api/src/modules/llm/llm-opt-in.test.ts`
- `apps/web/src/app/(cap)/dashboard/_llm/_actions/llm-actions.ts`
- `apps/web/src/app/(cap)/dashboard/_llm/_hooks/use-llm-opt-in.ts`
- `apps/web/src/app/(cap)/dashboard/_llm/_hooks/use-llm-opt-in.test.tsx`
- `apps/web/src/app/(cap)/dashboard/_llm/_components/llm-opt-in-toggle.tsx`

**Modified**

- `packages/validators/src/llm/llm.schemas.ts`
- `packages/contracts/src/llm/llm.contract.ts`
- `apps/api/src/modules/llm/llm.repository.ts`
- `apps/api/src/modules/llm/llm.service.ts`
- `apps/api/src/modules/llm/llm.module.ts`
- `apps/api/src/bootstrap/runtime-dependencies.ts`
- `apps/web/src/lib/orpc/modules.ts`
- `apps/web/src/lib/zapaction/keys.ts`
- `apps/web/src/app/(cap)/dashboard/parametres/page.tsx`
- `docs/state.yaml`

## Dev Agent Record

- **Model:** claude-opus-4-8[1m] (Opus 4.8, 1M context)
- **Started:** 2026-05-31T01:55:50+02:00
- **Completed:** 2026-05-31 (dev phase)

### Summary

Shipped FR-34 third-party LLM opt-in end-to-end: the per-user write path
(`llm.setOptIn`) + read (`llm.getOptIn`) on the first client-facing `/rpc/v1/llm`
oRPC procedures, and the "Intelligence artificielle" toggle in Paramètres that
surfaces the state (default OFF, persists across reload). Scope held to the
guard-level (AC-2 verified via `requireThirdPartyOptIn`); `decideRoute` is
untouched and the escalation policy stays deferred. **Recovery note:** this
session began on a corrupted working tree from an interrupted prior session —
`llm.routes.ts` and the repository writer had been reverted on disk while
T1–T7 were committed, and the T4/T6 commits had landed **incomplete** (the
`LlmService` interface declarations and the `createLlmRouter` import were never
committed, so HEAD did not type-check). Recovered by restoring the working tree
from the index, then completing the interface + propagating the widened
`LlmService`/`LlmRepository` to the existing test fakes.

### Files changed

- `apps/api/src/bootstrap/runtime-dependencies.ts`
- `apps/api/src/modules/llm/llm-categorise.test.ts`
- `apps/api/src/modules/llm/llm-opt-in.test.ts`
- `apps/api/src/modules/llm/llm.attest-router.test.ts`
- `apps/api/src/modules/llm/llm.module.ts`
- `apps/api/src/modules/llm/llm.repository.ts`
- `apps/api/src/modules/llm/llm.routes.ts`
- `apps/api/src/modules/llm/llm.service.test.ts`
- `apps/api/src/modules/llm/llm.service.ts`
- `apps/web/src/app/(cap)/dashboard/_llm/_actions/llm-actions.ts`
- `apps/web/src/app/(cap)/dashboard/_llm/_components/llm-opt-in-toggle.tsx`
- `apps/web/src/app/(cap)/dashboard/_llm/_hooks/use-llm-opt-in.test.tsx`
- `apps/web/src/app/(cap)/dashboard/_llm/_hooks/use-llm-opt-in.ts`
- `apps/web/src/app/(cap)/dashboard/parametres/page.tsx`
- `apps/web/src/lib/orpc/modules.ts`
- `apps/web/src/lib/zapaction/keys.ts`
- `packages/contracts/src/llm/llm.contract.ts`
- `packages/validators/src/llm/llm.schemas.ts`
- `docs/state.yaml`

### Deviations

- **Recovery of an interrupted session.** T4/T6 had been committed incomplete
  (HEAD did not type-check). Completed them in a dedicated repair commit
  (`feat(#34): complete llm opt-in service interface + router import`) and
  updated three pre-existing test fakes (`llm.service.test.ts`,
  `llm.attest-router.test.ts`, `llm-categorise.test.ts`) for the widened
  `LlmService`/`LlmRepository` interfaces — not in the original task list but
  required to keep the suite green.
- **T8 test lint fix.** The story's verbatim T8 fake carried an unused counter
  (`let n = 0; … n++`) flagged by the oxlint pre-commit hook; removed the dead
  counter (behaviour identical, still `3 pass`).
- **T11 error branch.** The story's `<span role="alert" style={{display:"none"}}>`
  is dead/misleading code — a `display:none` `role="alert"` is never announced
  nor seen. Rendered the read-error via the visible, accessible
  `<Text role="alert" color="$danger">` convention from `compass-history-panel`
  (the story's own cited hydration iso) instead.
- **T12 visual verification — NOT performed.** The react-grab-mcp server did not
  connect this session (no tools exposed), and `/dashboard/parametres` is
  auth-gated, so the prescribed `get_element_context` capture could not run. The
  rendered toggle is instead evidenced at the primitive level: `PekuloToggleRow`'s
  own a11y + interaction tests pass (asserting `role="switch"`, `aria-checked`,
  axe-clean, `onChange(true)` on click), the component type-checks, and the full
  `@pekulo/web` vitest suite is green. **Follow-up:** complete the react-grab
  visual capture once the MCP server is connected with an authenticated dev
  session (or at `aped-review`).

### Test output

```
# api (bun:test) — full suite
bun --filter='@pekulo/api' run test
 703 pass / 0 fail / 1672 expect() calls — Ran 703 tests across 83 files. Exited with code 0
# opt-in behaviour (T8): 3 pass / 0 fail (AC-1 route guard, AC-3 persistence, AC-2 DR-7 guard)

# web (vitest) — full suite
bun --filter='@pekulo/web' run test
 Test Files 65 passed (65) / Tests 135 passed (135) — Exited with code 0
# hook test (T10) AC-4: useSetLlmOptIn invalidates llmKeys.optIn() — 1 passed

# Iron-Law gate (AC-6)
bun run lint                              → 0 errors (11 pre-existing warnings)
typecheck types/validators/contracts/api/web → all exit 0
prisma:check                              → "The schemas at prisma/schema are valid 🚀"
db:rls-audit                              → OK, 19 tables; llm_opt_in: 4, llm_call_log: 2 (quartet unchanged), exit 0
# branch touches zero prisma/migration files → RLS policy counts provably unchanged
```
