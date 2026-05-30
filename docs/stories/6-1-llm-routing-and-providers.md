# Story: 6-1-llm-routing-and-providers — LLM routing policy + per-call audit + provider clients

**Epic:** Epic 6 — LLM auto-categorisation
**Status:** done
**Ticket:** [#32](https://github.com/yabafre/pekulo/issues/32)
**Branch:** feature/32-6-1-llm-routing-and-providers
**Covered FRs:** FR-31 (routing policy), FR-35 (per-call audit)
**Commit prefix:** `feat(#32): …`

## User Story

**As a** Pekulo user, **I want** the LLM router to choose the right endpoint per request (Apple FoundationModels on iOS-capable clients, Ollama on the Dokploy VPS by default, third-party only when I've opted in) and to record every call's routing decision, latency and outcome **without persisting prompt content**, **so that** my categorisation is fast, private and auditable.

> **Scope guard (locked at aped-story step 04):** this story ships FR-31 + FR-35 only. It does NOT ship the live `categorise(tx) → {category, confidence}` call (FR-32 → story 6-2), the opt-in toggle UI/write (FR-34 → story 6-3), or the suggestion/activity-log UI (FR-33/36 → 6-4/6-5). It ships the routing policy, the per-call audit authority, the two server provider clients, the zero-PII prompt builder, the third-party opt-in **read** + guard, and the `/internal/llm/attest` listener.

## Acceptance Criteria

- **AC-1** — **Given** a route intent whose `clientCapabilities.iosFoundationModels === true`, **When** the router decides, **Then** the decision selects `foundation_models` with no server-side provider call (the call is client-owned), AND exactly one **intent** audit entry is recorded for that route with no prompt body (only a label digest).
- **AC-2** — **Given** a route intent whose `clientCapabilities.iosFoundationModels === false` and the user is **not** opted into third-party, **When** the router decides, **Then** it selects `ollama` and `third_party` is **never** selected. Any third-party egress is additionally gated server-side: it is refused with an opt-in-required error (403) when the user has not opted in.
- **AC-3** — **Given** the prompt builder, **When** a caller passes an object that also carries a user identifier / account number (or any non-allowlisted key), **Then** the resulting envelope contains only `{label, amount, currency, occurredOn, merchant?}` (the smuggled keys are stripped), and the worst-case maximal envelope serialises to ≤ 2 048 bytes (NFR-12).
- **AC-4** — **Given** the per-call audit recorder is the sole audit writer, **When** an intent then an outcome event is recorded for the same call, **Then** two append-only entries are persisted (intent, then outcome with the actual route, latency and outcome) and **no entry carries prompt content** (NFR-26 / DR-6).
- **AC-5 (Iron-Law gates)** — **Given** the branch, **When** the full gate set runs, **Then** all pass: lint → 0 ; typecheck (api + types + validators) → 0 ; `bun:test` suites → all pass ; `prisma:check` → valid ; `db:rls-audit` → exit 0 with `llm_call_log: 2` (append-only SELECT+INSERT) and `llm_opt_in: 4` (full quartet), every pre-existing table count unchanged.

## Tasks

> Every task is self-contained — the full code, the literal run command, the expected output and the literal commit live under **Dev Notes → Task-by-task implementation code**. Run each task on `feature/32-6-1-llm-routing-and-providers`. `apps/api` tests are `bun:test` (NOT vitest). Every workspace command uses the fully-qualified name `bun --filter='@pekulo/api'` (NEVER `=api`, NEVER `--cwd`).

- [x] **T1** — Shared LLM types (`@pekulo/types/llm`) + Zod validators (`@pekulo/validators/llm`) [AC: AC-1, AC-2, AC-3, AC-4]
- [x] **T2** — Add `LLM_OPT_IN_REQUIRED` / `LLM_PROVIDER_UNAVAILABLE` / `LLM_ROUTING_ERROR` to `PekuloErrorCode` + HTTP status map [AC: AC-2, AC-4]
- [x] **T3** — Prisma `LlmRoute` enum + `LlmCallLog` (append-only) + `LlmOptIn` models [AC: AC-1, AC-4]
- [x] **T4** — Hand-written migration: tables + keyset index + RLS DDL (append-only / quartet) + FKs [AC: AC-1, AC-4, AC-5]
- [x] **T5** — `llm.errors.ts` typed error factories [AC: AC-2, AC-4]
- [x] **T6** — `llm-prompt-builder.ts` zero-PII envelope + label hash (RED→GREEN) [AC: AC-3]
- [x] **T7** — `llm-provider.ts` interface + `services/ollama-client.ts` [AC: AC-2]
- [x] **T8** — `services/third-party-client.ts` [AC: AC-2]
- [x] **T9** — `llm.repository.ts` (sole append-only writer + opt-in read) [AC: AC-4]
- [x] **T10** — `opt-in-guard.ts` server-side third-party gate [AC: AC-2]
- [x] **T11** — `llm.service.ts` routing policy + audit authority [AC: AC-1, AC-2, AC-4]
- [x] **T12** — `/internal/llm/attest` Elysia listener (JWT) [AC: AC-1, AC-4]
- [x] **T13** — `llm.module.ts` composition root + wired module test [AC: AC-1, AC-4]
- [x] **T14** — Env vars + runtime wiring + mount attest listener [AC: AC-1]
- [x] **T15** — Full Iron-Law gate + push [AC: AC-5]

## Dev Notes

### Architecture & decisions

- **PRIMARY ADR — `docs/adr/0008-llm-routing-server-audit-authority-async-attest.md`.** Decision **A\***: the server is the audit authority; iOS renders FoundationModels suggestions immediately and attests async; opt-in is checked server-side; the server returns `route_actual`; intent↔outcome route mismatch is flagged. The durable client IndexedDB retry queue (W3) is **story 6-6** — out of scope here.
- **Scope locked at step 04:** Q1 → ship BOTH tables (`LlmCallLog` + `LlmOptIn` + opt-in read). Q2 → 2 server clients (`ollama`, `third_party`); `foundation_models` is a routing target + attest path, the real FM client is deferred to V1.5 mobile (`apps/mobile`). Q3 → ship `/internal/llm/attest` in 6-1.
- **No client-facing oRPC procedure in 6-1.** `packages/contracts/src/llm/llm.contract.ts` stays the empty `{} as const` scaffold; the `llm` module is NOT added to `orpcRouter`. `route`/`recordLlmCall` are internal service methods consumed by story 6-2. The only HTTP surface is the Elysia-native `/internal/llm/attest` listener.
- **Audit model (ADR-0008 / NFR-26):** `llm_call_log` is append-only — two rows per logical call (`phase: intent | outcome`) correlated by `call_id`. NEVER the prompt body; only a `label_hash` digest. `recordLlmCall` is the sole writer; `llmCallLog.create` appears only in `llm.repository.ts` (grep gate in T9).
- **Routing policy (FR-31):** iOS-capable → `foundation_models`; else `ollama` (default). `third_party` is never auto-selected at V1 (a); the opt-in guard (`requireThirdPartyOptIn`, DR-7) is the second line of defence on the third-party providerCall path. AC-2 is satisfied by the policy returning `ollama`.
- **Defense-in-depth (ADR-0013):** `apps/api` runs the service-role connection that BYPASSES RLS, so per-user isolation on the api path is the `where: { userId }` clause + the `no-prisma-query-without-user-id` lint rule. RLS on `llm_call_log` / `llm_opt_in` is the safety net for the `apps/web` anon path. Every repository query carries `where: { userId }`.
- **Commit prefix:** `feat(#32): …`. The PR (after `aped-review`) carries `Fixes #32` in the body.

### Step-0 quotes (verbatim current state at story-write time)

**`apps/api/prisma/schema/enums.prisma`** — currently has NO `LlmRoute` enum (last enum is `MilestoneStatus`). T3 appends `LlmRoute`, mirroring the snake-name + `@@map` pattern:

```prisma
enum MilestoneStatus {
  ahead
  on_track
  behind

  @@map("milestone_status")
}
```

**`apps/api/src/common/errors/pekulo-error.ts`** — current union (no LLM codes); the discipline comment is binding (every new code updates BOTH `PekuloErrorCode` AND `ORPC_HTTP_STATUS_BY_CODE` in the same commit):

```ts
export type PekuloErrorCode =
  | "ACCOUNT_NOT_FOUND"
  // … INVALID_TARGET, INVALID_WEALTH, MILESTONE_*, MONTHLY_*, … (no LLM_* yet)
  | "UNAUTHORIZED";
```

**`apps/api/src/platform/http/error-mapper.ts`** — `ORPC_HTTP_STATUS_BY_CODE` is `Record<PekuloErrorCode, number>` (compile-time exhaustiveness — the build fails until all codes are present). Wire shape is the flat `{ defined, code, status, message, data: { requestId } }` — do NOT add sibling top-level keys.

**`apps/api/src/config/env.ts`** — declares Bridge + prices + OTel vars via `optionalString(...)`. No `OLLAMA_*` / `THIRD_PARTY_LLM_*` yet. `optionalString` treats `KEY=` as absent.

**`apps/api/src/bootstrap/runtime-dependencies.ts`** — current `orpcRouter` literal (no `llm` key — and 6-1 adds none). `jwtVerifier` is already constructed earlier in this function and is reused by `createLlmModule`:

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

**`apps/api/src/app.ts`** — current mount chain; T14 chains `.use(deps.llmModule.attestRouter)` right after the webhook router, before `mountOrpc`:

```ts
    .use(healthModule.router)
    .use(deps.bankAggregatorModule.webhookRouter);

  mountOrpc(app, { jwtVerifier: deps.jwtVerifier, orpcRouter: deps.orpcRouter });
```

**`apps/api/src/database/id-prefixes.config.ts`** — already registers the LLM prefixes (story 0-4, "registered upfront for story 6-1"); **NOT modified** by 6-1. The prefixed-ids extension injects `llm_<base62>` / `llmo_<base62>` at `create` time:

```ts
  // LLM (story 6-1 — registered upfront)
  LlmCallLog: "llm",
  LlmOptIn: "llmo",
```

**`packages/contracts/src/llm/llm.contract.ts`** — empty scaffold; **NOT modified** by 6-1:

```ts
export const llmContractV1 = {} as const;
export const llmContract = llmContractV1;
export const llmContractMeta = { moduleKey: "llm", mountPath: "/rpc/v1/llm", version: "v1" } as const;
```

**`apps/api/src/common/errors/pekulo-error.ts` — `isPekuloError` cross-realm guard** already gates on `PEKULO_ERROR_CODES.has(code)`, so the new codes MUST be added to the Set (T2), not only the union.

**`apps/api/prisma/migrations/20260509150000_create_compass_history/migration.sql`** — the append-only audit-table RLS shape T4 mirrors (SELECT + INSERT only, no UPDATE/DELETE):

```sql
ALTER TABLE "compass_history" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own compass history" ON "compass_history"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own compass history" ON "compass_history"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### File decision template (3-bullet per created/modified file)

- **`packages/types/src/llm/llm.types.ts`** *(NEW)* — single source for `LLM_ROUTES`/`LlmRoute`, prompt/decision/audit DTOs, branded IDs. Imports `Id` from `../shared`; exported via the package barrel.
- **`packages/validators/src/llm/llm.schemas.ts`** *(NEW)* — Zod guards (envelope `.strict()` allowlist, attest body). Imports `z` from `@pekulo/zod` (R1) + the const arrays from `@pekulo/types`.
- **`apps/api/prisma/schema/{enums,llm}.prisma`** *(NEW/MODIFY)* — `LlmRoute` enum + `LlmCallLog` (append-only) + `LlmOptIn` models. No `*.types.ts`; consumed by the generated Prisma client.
- **`apps/api/prisma/migrations/20260530120000_*/migration.sql`** *(NEW)* — tables + keyset index + RLS DDL (append-only / quartet) + FKs. Applied via `prisma:migrate:deploy`.
- **`apps/api/src/modules/llm/llm-prompt-builder.ts`** *(NEW)* — pure NFR-12 envelope builder + label hash. Imports the envelope schema + `LlmError`; exports `buildPromptEnvelope`/`hashLabel`. Zero IO.
- **`apps/api/src/modules/llm/llm-provider.ts` + `services/{ollama,third-party}-client.ts`** *(NEW)* — transport abstraction + two server clients. Import `Env` + types + `LlmError`; export the `LlmProvider` impls. Network-only (no DB).
- **`apps/api/src/modules/llm/llm.repository.ts`** *(NEW)* — sole `llmCallLog.create` site + opt-in read. Imports `PrismaService`; every query `where: { userId }`.
- **`apps/api/src/platform/security/opt-in-guard.ts`** *(NEW)* — DR-7 gate over an injected reader (no `modules/` import). Throws `LLM_OPT_IN_REQUIRED`.
- **`apps/api/src/modules/llm/llm.service.ts`** *(NEW)* — routing policy + audit authority. Composes repository + clients + opt-in reader + prompt builder; exports `route`/`recordLlmCall`.
- **`apps/api/src/modules/llm/llm.attest-router.ts`** *(NEW)* — Elysia-native `/internal/llm/attest`, JWT-verified, writes the intent→outcome pair. Inferred return type (L8).
- **`apps/api/src/modules/llm/llm.module.ts`** *(NEW)* — composition root → `{ service, repository, attestRouter }`. No oRPC router.
- **MODIFY** `apps/api/src/{config/env,bootstrap/runtime-dependencies,app}.ts` + `common/errors/pekulo-error.ts` + `platform/http/error-mapper.ts` + `platform/security/index.ts` + `packages/{types,validators}/src/index.ts` — env vars, wiring, attest mount, error codes, barrel exports.

### Task-by-task implementation code

#### T1 — Shared LLM types + Zod validators [AC: AC-1, AC-2, AC-3, AC-4]

Create `packages/types/src/llm/llm.types.ts`:

```ts
// packages/types/src/llm/llm.types.ts
// LLM auto-categorisation domain types (Epic 6). Owned by story 6-1.
// LLM_ROUTES is the single source for the routing-target literal union; the
// Prisma enum `LlmRoute` (apps/api/prisma/schema/enums.prisma) and the Zod
// `llmRouteSchema` (@pekulo/validators) MUST stay iso with this list.

import type { Id } from "../shared";

export const LLM_ROUTES = ["foundation_models", "ollama", "third_party"] as const;
export type LlmRoute = (typeof LLM_ROUTES)[number];

export const LLM_OUTCOMES = ["success", "failure"] as const;
export type LlmOutcome = (typeof LLM_OUTCOMES)[number];

export type LlmCallLogId = Id<"LlmCallLogId">;
export type LlmOptInId = Id<"LlmOptInId">;

/** Client-capability signal driving the routing policy (FR-31). iOS ≥ 15 Pro
 * reports `iosFoundationModels: true`; web/Android always false at V1 (a). */
export interface ClientCapabilities {
  iosFoundationModels: boolean;
}

/** Zero-PII prompt envelope (NFR-12). The ONLY shape the prompt builder emits;
 * ≤ 2 kb once serialised. No userId, no account number, no compass amounts. */
export interface LlmPromptEnvelope {
  label: string;
  amount: number;
  currency: string;
  occurredOn: string; // ISO date YYYY-MM-DD
  merchant?: string;
}

/** Low-level provider completion. Story 6-1 ships the transport (raw text +
 * latency); the {category, confidence} parsing lands in story 6-2. */
export interface LlmProviderCompletion {
  raw: string;
  latencyMs: number;
}

/** Routing decision returned by llm.service.route (FR-31). `providerCall` is a
 * thunk the categorisation pipeline (story 6-2) invokes for server routes;
 * null for foundation_models (the call is client-owned, attested async). */
export interface LlmRouteDecision {
  callId: string;
  route: LlmRoute;
  providerCall: (() => Promise<LlmProviderCompletion>) | null;
}

/** Audit events — the two phases of one logical LLM call (ADR-0008), both
 * written via llm.service.recordLlmCall (the sole writer), correlated by
 * callId. Append-only (NFR-26 / DR-6): never the prompt body, only a short
 * label hash for de-dup. */
export interface LlmCallIntent {
  phase: "intent";
  callId: string;
  route: LlmRoute;
  labelHash: string;
}

export interface LlmCallOutcomeEvent {
  phase: "outcome";
  callId: string;
  route: LlmRoute;
  labelHash: string;
  latencyMs: number;
  outcome: LlmOutcome;
}

export type LlmCallEvent = LlmCallIntent | LlmCallOutcomeEvent;

/** DTO surfaced by the 90-day activity log (story 6-5). No prompt content. */
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

Create `packages/types/src/llm/index.ts`:

```ts
// packages/types/src/llm/index.ts
export * from "./llm.types";
```

Add to `packages/types/src/index.ts` (after the `export * from "./compass";` line):

```ts
export * from "./llm";
```

Create `packages/validators/src/llm/llm.schemas.ts`:

```ts
// packages/validators/src/llm/llm.schemas.ts
// Zod schemas for the LLM module (Epic 6, story 6-1). @pekulo/zod is the SOLE
// zod entry point (R1). llmPromptEnvelopeSchema is the runtime guard behind
// NFR-12 (allowlist via .strict()); attestLlmCallSchema validates the client
// attestation POST to /internal/llm/attest.

import { z } from "@pekulo/zod";
import { LLM_OUTCOMES, LLM_ROUTES } from "@pekulo/types";

export const llmRouteSchema = z.enum(LLM_ROUTES);
export const llmOutcomeSchema = z.enum(LLM_OUTCOMES);

export const clientCapabilitiesSchema = z.object({
  iosFoundationModels: z.boolean(),
});

// NFR-12 — strict allowlist. `.strict()` rejects any extra key (a smuggled
// userId / accountNumber) at parse time. The byte cap is enforced separately
// in the prompt builder (Zod sizes fields, not the serialized blob).
export const llmPromptEnvelopeSchema = z
  .object({
    label: z.string().min(1).max(512),
    amount: z.number().finite(),
    currency: z.string().length(3),
    occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "occurredOn must be ISO date YYYY-MM-DD"),
    merchant: z.string().max(256).optional(),
  })
  .strict();

export const routeIntentSchema = z.object({
  clientCapabilities: clientCapabilitiesSchema,
  envelope: llmPromptEnvelopeSchema,
});

// Client attestation body (/internal/llm/attest). The client reports the
// on-device FoundationModels outcome; the server is the audit authority and
// writes the intent + outcome pair (ADR-0008).
export const attestLlmCallSchema = z.object({
  callId: z.string().min(1).max(64),
  route: llmRouteSchema,
  latencyMs: z.number().int().nonnegative().max(120_000),
  outcome: llmOutcomeSchema,
  labelHash: z.string().min(1).max(128),
});

export type RouteIntentInput = z.infer<typeof routeIntentSchema>;
export type AttestLlmCallInput = z.infer<typeof attestLlmCallSchema>;
```

Create `packages/validators/src/llm/index.ts`:

```ts
// packages/validators/src/llm/index.ts
export * from "./llm.schemas";
```

Add to `packages/validators/src/index.ts` (after `export * from "./holdings";`, keeping alphabetical order):

```ts
export * from "./llm";
```

Run: `bun --filter='@pekulo/types' run typecheck && bun --filter='@pekulo/validators' run typecheck`
Expected: `tsc` exits 0 for both, no error.
Commit: `git add packages/types/src/llm packages/types/src/index.ts packages/validators/src/llm packages/validators/src/index.ts && git commit -m "feat(#32): LLM domain types + Zod validators (FR-31/FR-35)"`

#### T2 — Add the three LLM error codes [AC: AC-2, AC-4]

In `apps/api/src/common/errors/pekulo-error.ts`, add three members to the `PekuloErrorCode` union (insert alphabetically, after `"INVALID_WEALTH"`):

```ts
  | "LLM_OPT_IN_REQUIRED"
  | "LLM_PROVIDER_UNAVAILABLE"
  | "LLM_ROUTING_ERROR"
```

In the same file, add the same three strings to the `PEKULO_ERROR_CODES` Set (after `"INVALID_WEALTH",`):

```ts
  "LLM_OPT_IN_REQUIRED",
  "LLM_PROVIDER_UNAVAILABLE",
  "LLM_ROUTING_ERROR",
```

In `apps/api/src/platform/http/error-mapper.ts`, add the three codes to `ORPC_HTTP_STATUS_BY_CODE` (the `Record<PekuloErrorCode, number>` is a compile-time exhaustiveness guard). Insert after the `INVALID_CSV: 400,` block:

```ts
  // LLM module (story 6-1, FR-31/35 + DR-7).
  // _OPT_IN_REQUIRED → 403 (third-party egress attempted without consent).
  // _PROVIDER_UNAVAILABLE → 503 (Ollama/third-party upstream down or timeout).
  // _ROUTING_ERROR → 502 (bad gateway: malformed route / prompt-cap breach).
  LLM_OPT_IN_REQUIRED: 403,
  LLM_PROVIDER_UNAVAILABLE: 503,
  LLM_ROUTING_ERROR: 502,
```

Run: `bun --filter='@pekulo/api' run typecheck`
Expected: `tsc` exits 0 (the `Record<PekuloErrorCode, number>` resolves; omitting any code errors `TS2741`).
Commit: `git add apps/api/src/common/errors/pekulo-error.ts apps/api/src/platform/http/error-mapper.ts && git commit -m "feat(#32): add LLM error codes + HTTP status mapping"`

#### T3 — Prisma `LlmRoute` enum + `LlmCallLog`/`LlmOptIn` models [AC: AC-1, AC-4]

Append to `apps/api/prisma/schema/enums.prisma` (after the `MilestoneStatus` enum):

```prisma
// LlmRoute — LLM routing target (story 6-1, FR-31). Iso with LLM_ROUTES in
// @pekulo/types and llmRouteSchema in @pekulo/validators. All values are
// already snake_case (Postgres enum identifiers reject hyphens).
enum LlmRoute {
  foundation_models
  ollama
  third_party

  @@map("llm_route")
}
```

Create `apps/api/prisma/schema/llm.prisma`:

```prisma
// llm.prisma — LLM auto-categorisation domain (Epic 6, story 6-1).
//   - LlmCallLog: APPEND-ONLY audit (NFR-26 / DR-6). One row per call phase
//     (intent | outcome), correlated by callId. NEVER stores prompt content —
//     only a short labelHash for de-dup. RLS = SELECT + INSERT only (no
//     UPDATE/DELETE), mirroring compass_history (ADR-0001).
//   - LlmOptIn: per-user third-party opt-in flag (default false). Full RLS
//     quartet. The write/toggle UI ships in story 6-3; story 6-1 reads it.
// Prefixes already registered in id-prefixes.config.ts: LlmCallLog→"llm",
// LlmOptIn→"llmo" (story 0-4, "registered upfront for story 6-1").

model LlmCallLog {
  id         String   @id
  callId     String   @map("call_id")
  userId     String   @map("user_id") @db.Uuid
  phase      String
  route      LlmRoute
  labelHash  String   @map("label_hash")
  latencyMs  Int?     @map("latency_ms")
  outcome    String?
  occurredAt DateTime @default(now()) @map("occurred_at") @db.Timestamptz
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz

  @@index([userId, createdAt(sort: Desc), id(sort: Desc)], map: "llm_call_log_user_created_idx")
  @@index([userId, callId], map: "llm_call_log_user_call_idx")
  @@map("llm_call_log")
}

model LlmOptIn {
  id         String   @id
  userId     String   @unique @map("user_id") @db.Uuid
  thirdParty Boolean  @default(false) @map("third_party")
  updatedAt  DateTime @updatedAt @map("updated_at") @db.Timestamptz
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz

  @@map("llm_opt_in")
}
```

Run: `bun --filter='@pekulo/api' run prisma:check && bun --filter='@pekulo/api' run prisma:generate`
Expected: `prisma format --check` clean, `prisma validate` → `The schema … is valid 🚀`, then `✔ Generated Prisma Client`. Exit 0. (If `prisma format --check` reports drift, run `bun --filter='@pekulo/api' run prisma:format` and re-stage.)
Commit: `git add apps/api/prisma/schema/enums.prisma apps/api/prisma/schema/llm.prisma && git commit -m "feat(#32): LlmRoute enum + LlmCallLog/LlmOptIn Prisma models"`

#### T4 — Hand-written migration (tables + indexes + RLS) [AC: AC-1, AC-4, AC-5]

Create `apps/api/prisma/migrations/20260530120000_create_llm_call_log_and_opt_in/migration.sql`:

```sql
-- Hand-written migration (ADR-0014 + 2026-05-05 lesson — no `prisma migrate
-- dev` against the Supabase pooler). Apply via
-- `bun --filter='@pekulo/api' run prisma:migrate:deploy`. Idempotent.
-- Story 6-1: LlmRoute enum + llm_call_log (append-only audit) + llm_opt_in.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "llm_route" AS ENUM ('foundation_models', 'ollama', 'third_party');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateTable: llm_call_log (append-only audit — NFR-26 / DR-6)
CREATE TABLE IF NOT EXISTS "llm_call_log" (
    "id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "phase" TEXT NOT NULL,
    "route" "llm_route" NOT NULL,
    "label_hash" TEXT NOT NULL,
    "latency_ms" INTEGER,
    "outcome" TEXT,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "llm_call_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "llm_call_log_user_created_idx"
  ON "llm_call_log"("user_id", "created_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "llm_call_log_user_call_idx"
  ON "llm_call_log"("user_id", "call_id");

-- CreateTable: llm_opt_in (per-user third-party opt-in, default false)
CREATE TABLE IF NOT EXISTS "llm_opt_in" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "third_party" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "llm_opt_in_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "llm_opt_in_user_id_key" ON "llm_opt_in"("user_id");

-- FK to auth.users with cascade (matches every Pekulo user-data table).
DO $$ BEGIN
  ALTER TABLE "llm_call_log"
    ADD CONSTRAINT "llm_call_log_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "llm_opt_in"
    ADD CONSTRAINT "llm_opt_in_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- RLS — manually appended (Prisma does not introspect policies).
-- llm_call_log is an append-only audit sister table (ADR-0001 shape):
--   SELECT + INSERT only. No UPDATE/DELETE policy → append-only enforced.
--   Deletion only via cascade from auth.users (story 11-2).
ALTER TABLE "llm_call_log" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own llm call log" ON "llm_call_log";
CREATE POLICY "Users can view their own llm call log" ON "llm_call_log"
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own llm call log" ON "llm_call_log";
CREATE POLICY "Users can insert their own llm call log" ON "llm_call_log"
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- llm_opt_in is mutable per-user state → full RLS quartet.
ALTER TABLE "llm_opt_in" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own llm opt-in" ON "llm_opt_in";
CREATE POLICY "Users can view their own llm opt-in" ON "llm_opt_in"
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own llm opt-in" ON "llm_opt_in";
CREATE POLICY "Users can insert their own llm opt-in" ON "llm_opt_in"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own llm opt-in" ON "llm_opt_in";
CREATE POLICY "Users can update their own llm opt-in" ON "llm_opt_in"
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own llm opt-in" ON "llm_opt_in";
CREATE POLICY "Users can delete their own llm opt-in" ON "llm_opt_in"
  FOR DELETE USING (auth.uid() = user_id);
```

Run: `bun --filter='@pekulo/api' run prisma:migrate:deploy`
Expected: prisma logs `Applying migration 20260530120000_create_llm_call_log_and_opt_in`, then `1 migration applied`. Exit 0.
Verify: `bun --filter='@pekulo/api' run db:rls-audit`
Expected: exit 0; the audit lists `llm_call_log: 2` (SELECT + INSERT only — append-only) and `llm_opt_in: 4` (full quartet). Also run `bun --filter='@pekulo/api' run db:rls-migration-audit` → exit 0 (the static check confirms both new tables ship their RLS DDL).
Commit: `git add apps/api/prisma/migrations/20260530120000_create_llm_call_log_and_opt_in && git commit -m "feat(#32): migration — llm_call_log (append-only) + llm_opt_in + RLS"`

#### T5 — `llm.errors.ts` typed error factories [AC: AC-2, AC-4]

Create `apps/api/src/modules/llm/llm.errors.ts`:

```ts
// apps/api/src/modules/llm/llm.errors.ts
// Typed error class + factories for the LLM domain (story 6-1). Extends
// PekuloError so the Elysia error-mapper translates instances to oRPC
// responses with stable { code, message } per ORPC_HTTP_STATUS_BY_CODE:
//   LLM_OPT_IN_REQUIRED      → 403 (DR-7 — third-party egress without consent)
//   LLM_PROVIDER_UNAVAILABLE → 503 (Ollama / third-party down or timeout)
//   LLM_ROUTING_ERROR        → 502 (malformed route / prompt-cap breach)

import { PekuloError } from "../../common/errors";

export type LlmErrorCode = "LLM_OPT_IN_REQUIRED" | "LLM_PROVIDER_UNAVAILABLE" | "LLM_ROUTING_ERROR";

export class LlmError extends PekuloError {
  override readonly name = "LlmError";
  // Forwarding constructor narrows `code` from PekuloErrorCode to LlmErrorCode —
  // mirrors BankAggregatorError / RealestateError.
  // oxlint-disable-next-line no-useless-constructor -- narrows code union
  constructor(code: LlmErrorCode, message: string, options?: { cause?: unknown }) {
    super(code, message, options);
  }
}

export function llmOptInRequired(): LlmError {
  return new LlmError("LLM_OPT_IN_REQUIRED", "third-party LLM requires explicit user opt-in (DR-7)");
}

export function llmProviderUnavailable(route: string, reason: string): LlmError {
  return new LlmError("LLM_PROVIDER_UNAVAILABLE", `LLM provider ${route} unavailable: ${reason}`);
}

export function llmRoutingError(reason: string): LlmError {
  return new LlmError("LLM_ROUTING_ERROR", `LLM routing failed: ${reason}`);
}
```

Run: `bun --filter='@pekulo/api' run typecheck`
Expected: `tsc` exits 0.
Commit: `git add apps/api/src/modules/llm/llm.errors.ts && git commit -m "feat(#32): LlmError typed factories"`

#### T6 — `llm-prompt-builder.ts` zero-PII envelope (RED→GREEN) [AC: AC-3]

Create `apps/api/src/modules/llm/llm-prompt-builder.ts`:

```ts
// apps/api/src/modules/llm/llm-prompt-builder.ts
// NFR-12 — the SOLE construction site for any LLM prompt envelope. Strips to
// the {label, amount, currency, occurredOn, merchant?} allowlist and enforces
// the ≤ 2 kb serialized cap. Prompt construction anywhere else is forbidden
// (architecture L690 + review). Pure: no I/O, no logger, no clock, no env.

import { llmPromptEnvelopeSchema } from "@pekulo/validators";
import type { LlmPromptEnvelope } from "@pekulo/types";
import { llmRoutingError } from "./llm.errors";

const MAX_ENVELOPE_BYTES = 2_048;

export interface PromptBuilderInput {
  label: string;
  amount: number;
  currency: string;
  occurredOn: string;
  merchant?: string;
  // Any extra field a caller might smuggle (userId, accountNumber, …) is
  // dropped by the explicit allowlist pick below.
  [extra: string]: unknown;
}

export function buildPromptEnvelope(input: PromptBuilderInput): LlmPromptEnvelope {
  // 1. Explicit allowlist pick — extra keys never reach the parser.
  const picked = {
    label: input.label,
    amount: input.amount,
    currency: input.currency,
    occurredOn: input.occurredOn,
    ...(input.merchant !== undefined ? { merchant: input.merchant } : {}),
  };
  // 2. Strict parse — .strict() rejects any leftover non-allowlisted key.
  const envelope = llmPromptEnvelopeSchema.parse(picked) as LlmPromptEnvelope;
  // 3. Hard byte cap on the serialized blob (NFR-12).
  const bytes = new TextEncoder().encode(JSON.stringify(envelope)).byteLength;
  if (bytes > MAX_ENVELOPE_BYTES) {
    throw llmRoutingError(`prompt envelope ${bytes}B exceeds ${MAX_ENVELOPE_BYTES}B cap`);
  }
  return envelope;
}

/** Short, stable, non-reversible digest of the label for audit de-dup. NEVER
 * the prompt body — only a digest (NFR-26). djb2 is enough for de-dup. */
export function hashLabel(label: string): string {
  let h = 5381;
  for (let i = 0; i < label.length; i++) {
    h = ((h << 5) + h + label.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
```

Create `apps/api/src/modules/llm/llm-prompt-builder.test.ts`:

```ts
// bun:test — NFR-12 prompt-builder guard (story 6-1, AC-3).
import { test, expect } from "bun:test";
import { llmPromptEnvelopeSchema } from "@pekulo/validators";
import { buildPromptEnvelope, hashLabel } from "./llm-prompt-builder";

test("strips a smuggled user identifier + account number (AC-3)", () => {
  const env = buildPromptEnvelope({
    label: "Carrefour",
    amount: -42.5,
    currency: "EUR",
    occurredOn: "2026-05-15",
    userId: "u_secret",
    accountNumber: "FR761234",
  });
  expect(env).toEqual({
    label: "Carrefour",
    amount: -42.5,
    currency: "EUR",
    occurredOn: "2026-05-15",
  });
  expect(Object.keys(env)).not.toContain("userId");
  expect(Object.keys(env)).not.toContain("accountNumber");
});

test("keeps the optional merchant when present", () => {
  const env = buildPromptEnvelope({
    label: "Billet",
    amount: 19.9,
    currency: "EUR",
    occurredOn: "2026-05-15",
    merchant: "SNCF",
  });
  expect(env.merchant).toBe("SNCF");
});

test("the worst-case maximal envelope stays within the 2 kb cap (NFR-12)", () => {
  const env = buildPromptEnvelope({
    label: "a".repeat(512),
    amount: -999999.99,
    currency: "EUR",
    occurredOn: "2026-05-15",
    merchant: "m".repeat(256),
  });
  const bytes = new TextEncoder().encode(JSON.stringify(env)).byteLength;
  expect(bytes).toBeLessThanOrEqual(2048);
});

test("the schema strictly rejects a non-allowlisted key (NFR-12)", () => {
  expect(() =>
    llmPromptEnvelopeSchema.parse({
      label: "x",
      amount: 1,
      currency: "EUR",
      occurredOn: "2026-05-15",
      userId: "u",
    }),
  ).toThrow();
});

test("hashLabel is stable and reveals no body", () => {
  expect(hashLabel("Carrefour")).toBe(hashLabel("Carrefour"));
  expect(hashLabel("Carrefour")).not.toContain("Carrefour");
});
```

Run: `bun --filter='@pekulo/api' run test apps/api/src/modules/llm/llm-prompt-builder.test.ts`
Expected: `5 pass`, `0 fail`, exit 0.
Verify zero-IO (pure module): `grep -nE "(prisma|fetch|http|setTimeout|setInterval|Date\.now|new Date|process\.env|console\.|opentelemetry)" apps/api/src/modules/llm/llm-prompt-builder.ts`
Expected: empty output, exit 1 (grep returns 1 on no match — that's the green signal).
Commit: `git add apps/api/src/modules/llm/llm-prompt-builder.ts apps/api/src/modules/llm/llm-prompt-builder.test.ts && git commit -m "feat(#32): zero-PII prompt builder + 2kb cap (NFR-12)"`

#### T7 — `LlmProvider` interface + Ollama client [AC: AC-2]

Create `apps/api/src/modules/llm/llm-provider.ts`:

```ts
// apps/api/src/modules/llm/llm-provider.ts
// Provider abstraction for the LLM transport tier (Epic 6, story 6-1).
// Iso-pattern with bank-aggregator/bank-provider.ts. OllamaClient +
// ThirdPartyClient implement it under services/. FoundationModels is NOT a
// server provider — it runs on-device (apps/mobile, V1.5) and is attested via
// /internal/llm/attest; story 6-1 ships only the two server-callable clients.
import type { LlmPromptEnvelope, LlmProviderCompletion } from "@pekulo/types";

export interface LlmProvider {
  /** The route this client serves — 'ollama' or 'third_party'. */
  readonly route: "ollama" | "third_party";
  /** Low-level completion. Story 6-1 ships the transport (raw text + latency);
   * the {category, confidence} parsing lands in story 6-2. Throws
   * LlmError(LLM_PROVIDER_UNAVAILABLE) on transport failure / timeout. */
  complete(envelope: LlmPromptEnvelope): Promise<LlmProviderCompletion>;
}
```

Create `apps/api/src/modules/llm/services/ollama-client.ts`:

```ts
// apps/api/src/modules/llm/services/ollama-client.ts
// Ollama transport (FR-31 default server route). Localhost-bound on the
// Dokploy VPS, NOT publicly exposed; proxied through apps/api exclusively
// (architecture L232). Hard 5 s timeout as the failure boundary (NFR-5: Ollama
// p95 ≤ 1.5 s). Iso-pattern with holdings price clients.
import type { Env } from "../../../config/env";
import type { LlmPromptEnvelope, LlmProviderCompletion } from "@pekulo/types";
import type { LlmProvider } from "../llm-provider";
import { LlmError, llmProviderUnavailable } from "../llm.errors";

const OLLAMA_TIMEOUT_MS = 5_000;

export function createOllamaClient(deps: { env: Env }): LlmProvider {
  const baseUrl = deps.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
  const model = deps.env.OLLAMA_MODEL ?? "llama3.2:3b";
  return {
    route: "ollama",
    async complete(envelope: LlmPromptEnvelope): Promise<LlmProviderCompletion> {
      const startedAt = performance.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
      try {
        const res = await fetch(`${baseUrl}/api/generate`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ model, prompt: JSON.stringify(envelope), stream: false }),
          signal: controller.signal,
        });
        if (!res.ok) {
          throw llmProviderUnavailable("ollama", `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { response?: string };
        return { raw: data.response ?? "", latencyMs: Math.round(performance.now() - startedAt) };
      } catch (err) {
        if (err instanceof LlmError) throw err;
        if (err instanceof Error && err.name === "AbortError") {
          throw llmProviderUnavailable("ollama", `timeout after ${OLLAMA_TIMEOUT_MS}ms`);
        }
        throw llmProviderUnavailable("ollama", err instanceof Error ? err.message : String(err));
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
```

Create `apps/api/src/modules/llm/services/ollama-client.test.ts`:

```ts
// bun:test — Ollama transport client (story 6-1).
import { test, expect, mock, afterEach } from "bun:test";
import type { Env } from "../../../config/env";
import type { LlmPromptEnvelope } from "@pekulo/types";
import { createOllamaClient } from "./ollama-client";
import { isPekuloError } from "../../../common/errors";

const fakeEnv = { OLLAMA_BASE_URL: "http://ollama.test", OLLAMA_MODEL: "test-model" } as unknown as Env;
const envelope: LlmPromptEnvelope = {
  label: "Carrefour",
  amount: -42.5,
  currency: "EUR",
  occurredOn: "2026-05-15",
};
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("returns raw text + latency on a 200 response", async () => {
  globalThis.fetch = mock(async () =>
    new Response(JSON.stringify({ response: "alimentation" }), { status: 200 }),
  ) as typeof fetch;
  const client = createOllamaClient({ env: fakeEnv });
  const out = await client.complete(envelope);
  expect(out.raw).toBe("alimentation");
  expect(out.latencyMs).toBeGreaterThanOrEqual(0);
});

test("throws LLM_PROVIDER_UNAVAILABLE on a non-2xx response", async () => {
  globalThis.fetch = mock(async () => new Response(null, { status: 502 })) as typeof fetch;
  const client = createOllamaClient({ env: fakeEnv });
  try {
    await client.complete(envelope);
    throw new Error("expected throw");
  } catch (err) {
    expect(isPekuloError(err) && err.code === "LLM_PROVIDER_UNAVAILABLE").toBe(true);
  }
});
```

Run: `bun --filter='@pekulo/api' run test apps/api/src/modules/llm/services/ollama-client.test.ts`
Expected: `2 pass`, `0 fail`, exit 0.
Commit: `git add apps/api/src/modules/llm/llm-provider.ts apps/api/src/modules/llm/services/ollama-client.ts apps/api/src/modules/llm/services/ollama-client.test.ts && git commit -m "feat(#32): LlmProvider interface + Ollama client"`

#### T8 — Third-party LLM client [AC: AC-2]

Create `apps/api/src/modules/llm/services/third-party-client.ts`:

```ts
// apps/api/src/modules/llm/services/third-party-client.ts
// Third-party LLM transport (FR-31 opt-in route — Claude Haiku 4.5 / Mistral
// Small per architecture L70). Opt-in is enforced UPSTREAM in the service
// (requireThirdPartyOptIn) before this client is ever called — the client
// itself only owns the transport. THIRD_PARTY_LLM_API_KEY lives ONLY in
// Dokploy env. Hard 10 s timeout (NFR-5: third-party p95 ≤ 3 s).
import type { Env } from "../../../config/env";
import type { LlmPromptEnvelope, LlmProviderCompletion } from "@pekulo/types";
import type { LlmProvider } from "../llm-provider";
import { LlmError, llmProviderUnavailable } from "../llm.errors";

const THIRD_PARTY_TIMEOUT_MS = 10_000;

export function createThirdPartyClient(deps: { env: Env }): LlmProvider {
  const apiKey = deps.env.THIRD_PARTY_LLM_API_KEY;
  const baseUrl = deps.env.THIRD_PARTY_LLM_BASE_URL ?? "https://api.anthropic.com/v1/messages";
  const model = deps.env.THIRD_PARTY_LLM_MODEL ?? "claude-haiku-4-5";
  return {
    route: "third_party",
    async complete(envelope: LlmPromptEnvelope): Promise<LlmProviderCompletion> {
      if (!apiKey) {
        throw llmProviderUnavailable("third_party", "THIRD_PARTY_LLM_API_KEY not configured");
      }
      const startedAt = performance.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), THIRD_PARTY_TIMEOUT_MS);
      try {
        const res = await fetch(baseUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            max_tokens: 64,
            messages: [{ role: "user", content: JSON.stringify(envelope) }],
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          throw llmProviderUnavailable("third_party", `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { content?: Array<{ text?: string }> };
        return {
          raw: data.content?.[0]?.text ?? "",
          latencyMs: Math.round(performance.now() - startedAt),
        };
      } catch (err) {
        if (err instanceof LlmError) throw err;
        if (err instanceof Error && err.name === "AbortError") {
          throw llmProviderUnavailable("third_party", `timeout after ${THIRD_PARTY_TIMEOUT_MS}ms`);
        }
        throw llmProviderUnavailable("third_party", err instanceof Error ? err.message : String(err));
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
```

Create `apps/api/src/modules/llm/services/third-party-client.test.ts`:

```ts
// bun:test — third-party transport client (story 6-1).
import { test, expect, mock, afterEach } from "bun:test";
import type { Env } from "../../../config/env";
import type { LlmPromptEnvelope } from "@pekulo/types";
import { createThirdPartyClient } from "./third-party-client";
import { isPekuloError } from "../../../common/errors";

const envelope: LlmPromptEnvelope = {
  label: "Carrefour",
  amount: -42.5,
  currency: "EUR",
  occurredOn: "2026-05-15",
};
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("throws LLM_PROVIDER_UNAVAILABLE when no API key is configured", async () => {
  const client = createThirdPartyClient({ env: {} as unknown as Env });
  try {
    await client.complete(envelope);
    throw new Error("expected throw");
  } catch (err) {
    expect(isPekuloError(err) && err.code === "LLM_PROVIDER_UNAVAILABLE").toBe(true);
  }
});

test("returns raw text on a 200 response when keyed", async () => {
  globalThis.fetch = mock(async () =>
    new Response(JSON.stringify({ content: [{ text: "transport" }] }), { status: 200 }),
  ) as typeof fetch;
  const client = createThirdPartyClient({
    env: { THIRD_PARTY_LLM_API_KEY: "sk-test" } as unknown as Env,
  });
  const out = await client.complete(envelope);
  expect(out.raw).toBe("transport");
});
```

Run: `bun --filter='@pekulo/api' run test apps/api/src/modules/llm/services/third-party-client.test.ts`
Expected: `2 pass`, `0 fail`, exit 0.
Commit: `git add apps/api/src/modules/llm/services/third-party-client.ts apps/api/src/modules/llm/services/third-party-client.test.ts && git commit -m "feat(#32): third-party LLM transport client"`

#### T9 — `llm.repository.ts` (append-only writes + opt-in read) [AC: AC-4]

Create `apps/api/src/modules/llm/llm.repository.ts`:

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
  isThirdPartyOptedIn(userId: string): Promise<boolean>;
  listRecentByUser(userId: string, since: Date): Promise<LlmCallLogEntry[]>;
}

export function createLlmRepository(deps: { prismaService: PrismaService }): LlmRepository {
  const db = deps.prismaService.client;
  return {
    async recordCallEvent(userId, event) {
      await db.llmCallLog.create({
        data: {
          userId,
          callId: event.callId,
          phase: event.phase,
          route: event.route,
          labelHash: event.labelHash,
          latencyMs: event.phase === "outcome" ? event.latencyMs : null,
          outcome: event.phase === "outcome" ? event.outcome : null,
        },
      });
    },
    async isThirdPartyOptedIn(userId) {
      const row = await db.llmOptIn.findUnique({
        where: { userId },
        select: { thirdParty: true },
      });
      return row?.thirdParty ?? false;
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
  };
}
```

Create `apps/api/src/modules/llm/llm.repository.test.ts`:

```ts
// bun:test — LLM repository (story 6-1). Uses a mock Prisma client to assert
// the create payload shape + the opt-in default. The RLS-isolation check runs
// against the real test DB in llm.module.test.ts (T13).
import { test, expect, mock } from "bun:test";
import type { PrismaService } from "../../database";
import { createLlmRepository } from "./llm.repository";

function makePrismaMock(optInRow: { thirdParty: boolean } | null) {
  const create = mock(async (_args: unknown) => undefined);
  const findUnique = mock(async () => optInRow);
  const prismaService = {
    client: { llmCallLog: { create }, llmOptIn: { findUnique } },
  } as unknown as PrismaService;
  return { prismaService, create, findUnique };
}

test("recordCallEvent writes an intent row with null latency/outcome", async () => {
  const { prismaService, create } = makePrismaMock(null);
  const repo = createLlmRepository({ prismaService });
  await repo.recordCallEvent("u1", {
    phase: "intent",
    callId: "c1",
    route: "ollama",
    labelHash: "abcd1234",
  });
  expect(create).toHaveBeenCalledTimes(1);
  const arg = create.mock.calls[0]![0] as { data: Record<string, unknown> };
  expect(arg.data).toMatchObject({
    userId: "u1",
    callId: "c1",
    phase: "intent",
    route: "ollama",
    labelHash: "abcd1234",
    latencyMs: null,
    outcome: null,
  });
});

test("recordCallEvent writes an outcome row with latency + outcome", async () => {
  const { prismaService, create } = makePrismaMock(null);
  const repo = createLlmRepository({ prismaService });
  await repo.recordCallEvent("u1", {
    phase: "outcome",
    callId: "c1",
    route: "ollama",
    labelHash: "abcd1234",
    latencyMs: 240,
    outcome: "success",
  });
  const arg = create.mock.calls[0]![0] as { data: Record<string, unknown> };
  expect(arg.data).toMatchObject({ phase: "outcome", latencyMs: 240, outcome: "success" });
});

test("isThirdPartyOptedIn defaults to false when no row exists", async () => {
  const { prismaService } = makePrismaMock(null);
  const repo = createLlmRepository({ prismaService });
  expect(await repo.isThirdPartyOptedIn("u1")).toBe(false);
});

test("isThirdPartyOptedIn returns the stored flag", async () => {
  const { prismaService } = makePrismaMock({ thirdParty: true });
  const repo = createLlmRepository({ prismaService });
  expect(await repo.isThirdPartyOptedIn("u1")).toBe(true);
});
```

Run: `bun --filter='@pekulo/api' run test apps/api/src/modules/llm/llm.repository.test.ts`
Expected: `4 pass`, `0 fail`, exit 0.
Verify single-writer: `grep -rn "llmCallLog.create" apps/api/src`
Expected: exactly one match — `apps/api/src/modules/llm/llm.repository.ts`.
Commit: `git add apps/api/src/modules/llm/llm.repository.ts apps/api/src/modules/llm/llm.repository.test.ts && git commit -m "feat(#32): LLM repository — append-only writes + opt-in read"`

#### T10 — `opt-in-guard.ts` server-side third-party gate [AC: AC-2]

Create `apps/api/src/platform/security/opt-in-guard.ts`:

```ts
// apps/api/src/platform/security/opt-in-guard.ts
// DR-7 / NFR-13 — third-party LLM opt-in gate (cross-cutting infra; consumed by
// the LLM module's service). Takes an injected reader so platform/ does NOT
// import modules/ (one-way layering). The LLM repository satisfies
// ThirdPartyOptInReader structurally. The client opt-in state is NEVER trusted.
import { PekuloError } from "../../common/errors";

export interface ThirdPartyOptInReader {
  isThirdPartyOptedIn(userId: string): Promise<boolean>;
}

export async function requireThirdPartyOptIn(
  reader: ThirdPartyOptInReader,
  userId: string,
): Promise<void> {
  const ok = await reader.isThirdPartyOptedIn(userId);
  if (!ok) {
    throw new PekuloError(
      "LLM_OPT_IN_REQUIRED",
      "third-party LLM requires explicit user opt-in (DR-7)",
    );
  }
}
```

Add to `apps/api/src/platform/security/index.ts` (append after the existing exports):

```ts
export * from "./opt-in-guard";
```

Create `apps/api/src/platform/security/opt-in-guard.test.ts`:

```ts
// bun:test — third-party opt-in gate (story 6-1, AC-2 / DR-7).
import { test, expect } from "bun:test";
import { requireThirdPartyOptIn, type ThirdPartyOptInReader } from "./opt-in-guard";
import { isPekuloError } from "../../common/errors";

const reader = (optedIn: boolean): ThirdPartyOptInReader => ({
  isThirdPartyOptedIn: async () => optedIn,
});

test("resolves when the user is opted in", async () => {
  await requireThirdPartyOptIn(reader(true), "u1");
});

test("throws LLM_OPT_IN_REQUIRED when not opted in (DR-7)", async () => {
  try {
    await requireThirdPartyOptIn(reader(false), "u1");
    throw new Error("expected throw");
  } catch (err) {
    expect(isPekuloError(err) && err.code === "LLM_OPT_IN_REQUIRED").toBe(true);
  }
});
```

Run: `bun --filter='@pekulo/api' run test apps/api/src/platform/security/opt-in-guard.test.ts`
Expected: `2 pass`, `0 fail`, exit 0.
Commit: `git add apps/api/src/platform/security/opt-in-guard.ts apps/api/src/platform/security/opt-in-guard.test.ts apps/api/src/platform/security/index.ts && git commit -m "feat(#32): server-side third-party opt-in guard (DR-7)"`

#### T11 — `llm.service.ts` routing policy + audit authority [AC: AC-1, AC-2, AC-4]

Create `apps/api/src/modules/llm/llm.service.ts`:

```ts
// apps/api/src/modules/llm/llm.service.ts
// LLM routing policy (FR-31) + per-call audit authority (FR-35 / ADR-0008).
// route(intent) decides the endpoint and writes the INTENT audit row, then
// returns a providerCall thunk the categorise pipeline (story 6-2) invokes.
// recordLlmCall is the SOLE writer of llm_call_log (direct llmCallLog.create
// outside the repository is forbidden — architecture L691). callId is injected
// for deterministic tests (no PEKULO_DEV_NOW_ISO env seam — factory dep only).
import type {
  ClientCapabilities,
  LlmCallEvent,
  LlmPromptEnvelope,
  LlmRoute,
  LlmRouteDecision,
} from "@pekulo/types";
import type { LlmProvider } from "./llm-provider";
import type { LlmRepository } from "./llm.repository";
import {
  requireThirdPartyOptIn,
  type ThirdPartyOptInReader,
} from "../../platform/security/opt-in-guard";
import { buildPromptEnvelope, hashLabel, type PromptBuilderInput } from "./llm-prompt-builder";
import { llmRoutingError } from "./llm.errors";

export interface RouteIntent {
  userId: string;
  clientCapabilities: ClientCapabilities;
  prompt: PromptBuilderInput;
}

export interface LlmService {
  route(intent: RouteIntent): Promise<LlmRouteDecision>;
  recordLlmCall(userId: string, event: LlmCallEvent): Promise<void>;
}

const VALID_ROUTES: ReadonlySet<LlmRoute> = new Set<LlmRoute>([
  "foundation_models",
  "ollama",
  "third_party",
]);

export function createLlmService(deps: {
  repository: LlmRepository;
  ollamaClient: LlmProvider;
  thirdPartyClient: LlmProvider;
  optInReader: ThirdPartyOptInReader;
  generateCallId: () => string;
}): LlmService {
  // Free helper avoids `this`-binding fragility (lesson 5-3).
  async function record(userId: string, event: LlmCallEvent): Promise<void> {
    if (!VALID_ROUTES.has(event.route)) {
      throw llmRoutingError(`unknown route ${String(event.route)}`);
    }
    await deps.repository.recordCallEvent(userId, event);
  }

  // FR-31 routing policy. iOS-capable → on-device FoundationModels. Otherwise
  // Ollama is the default server route. third_party is NEVER auto-selected at
  // V1 (a) — an ambiguity-escalation policy (story 6-2+) is the only thing that
  // would return it, and even then the providerCall is opt-in-gated below.
  function decideRoute(caps: ClientCapabilities): LlmRoute {
    if (caps.iosFoundationModels) return "foundation_models";
    return "ollama";
  }

  return {
    async route(intent) {
      const envelope: LlmPromptEnvelope = buildPromptEnvelope(intent.prompt);
      const labelHash = hashLabel(envelope.label);
      const route = decideRoute(intent.clientCapabilities);
      const callId = deps.generateCallId();
      // Intent row written BEFORE the call (ADR-0008).
      await record(intent.userId, { phase: "intent", callId, route, labelHash });

      let providerCall: LlmRouteDecision["providerCall"] = null;
      if (route === "ollama") {
        providerCall = () => deps.ollamaClient.complete(envelope);
      } else if (route === "third_party") {
        providerCall = async () => {
          // DR-7 — server-side opt-in gate before any third-party egress.
          await requireThirdPartyOptIn(deps.optInReader, intent.userId);
          return deps.thirdPartyClient.complete(envelope);
        };
      }
      // foundation_models → providerCall stays null (client-owned, attested).
      return { callId, route, providerCall };
    },

    recordLlmCall: record,
  };
}
```

Create `apps/api/src/modules/llm/llm.service.test.ts`:

```ts
// bun:test — LLM routing policy + audit authority (story 6-1, AC-1/2/4).
import { test, expect, mock } from "bun:test";
import type { LlmCallEvent } from "@pekulo/types";
import type { LlmProvider } from "./llm-provider";
import type { LlmRepository } from "./llm.repository";
import { createLlmService, type RouteIntent } from "./llm.service";

function makeService(overrides?: { optedIn?: boolean }) {
  const events: Array<{ userId: string; event: LlmCallEvent }> = [];
  const repository: LlmRepository = {
    recordCallEvent: async (userId, event) => {
      events.push({ userId, event });
    },
    isThirdPartyOptedIn: async () => overrides?.optedIn ?? false,
    listRecentByUser: async () => [],
  };
  const ollamaClient: LlmProvider = {
    route: "ollama",
    complete: mock(async () => ({ raw: "ollama", latencyMs: 1 })),
  };
  const thirdPartyClient: LlmProvider = {
    route: "third_party",
    complete: mock(async () => ({ raw: "cloud", latencyMs: 1 })),
  };
  let n = 0;
  const service = createLlmService({
    repository,
    ollamaClient,
    thirdPartyClient,
    optInReader: repository,
    generateCallId: () => `call_${++n}`,
  });
  return { service, events, ollamaClient, thirdPartyClient };
}

const baseIntent = (iosFoundationModels: boolean): RouteIntent => ({
  userId: "u1",
  clientCapabilities: { iosFoundationModels },
  prompt: { label: "Carrefour", amount: -42.5, currency: "EUR", occurredOn: "2026-05-15" },
});

test("AC-1: iOS-capable → foundation_models + null providerCall + intent row", async () => {
  const { service, events } = makeService();
  const decision = await service.route(baseIntent(true));
  expect(decision.route).toBe("foundation_models");
  expect(decision.providerCall).toBeNull();
  expect(events).toHaveLength(1);
  expect(events[0]!.event).toMatchObject({ phase: "intent", route: "foundation_models" });
  // No prompt body in the audit event — only a label hash.
  expect(JSON.stringify(events[0]!.event)).not.toContain("Carrefour");
});

test("AC-2: non-iOS + optIn:false → ollama, third_party never returned", async () => {
  const { service } = makeService({ optedIn: false });
  const decision = await service.route(baseIntent(false));
  expect(decision.route).toBe("ollama");
  expect(decision.route).not.toBe("third_party");
  expect(typeof decision.providerCall).toBe("function");
});

test("AC-4: recordLlmCall writes the intent → outcome pair, no prompt body", async () => {
  const { service, events } = makeService();
  await service.recordLlmCall("u1", { phase: "intent", callId: "c9", route: "ollama", labelHash: "h" });
  await service.recordLlmCall("u1", {
    phase: "outcome",
    callId: "c9",
    route: "ollama",
    labelHash: "h",
    latencyMs: 250,
    outcome: "success",
  });
  expect(events.map((e) => e.event.phase)).toEqual(["intent", "outcome"]);
  expect(JSON.stringify(events)).not.toContain("Carrefour");
});

test("recordLlmCall rejects an unknown route", async () => {
  const { service } = makeService();
  await expect(
    service.recordLlmCall("u1", {
      phase: "intent",
      callId: "c1",
      route: "gpt" as never,
      labelHash: "h",
    }),
  ).rejects.toThrow(/unknown route/);
});
```

Run: `bun --filter='@pekulo/api' run test apps/api/src/modules/llm/llm.service.test.ts`
Expected: `4 pass`, `0 fail`, exit 0.
Commit: `git add apps/api/src/modules/llm/llm.service.ts apps/api/src/modules/llm/llm.service.test.ts && git commit -m "feat(#32): LLM routing policy + audit authority (FR-31/35)"`

#### T12 — `/internal/llm/attest` Elysia listener [AC: AC-1, AC-4]

Create `apps/api/src/modules/llm/llm.attest-router.ts`:

```ts
// apps/api/src/modules/llm/llm.attest-router.ts
// Elysia-native private listener for iOS FoundationModels attestation
// (ADR-0008). JWT-verified (NOT oRPC). The server is the audit authority: it
// writes BOTH the intent and outcome rows for client-initiated FM calls. The
// durable client-side retry queue ships in story 6-6. Mounted in app.ts BEFORE
// mountOrpc (parity with the Bridge webhook). L8: inferred return type.
import { Elysia } from "elysia";
import { attestLlmCallSchema } from "@pekulo/validators";
import { requireUserContext, type JwtVerifier } from "../../platform/security";
import type { LlmService } from "./llm.service";

export function createLlmAttestRouter(deps: { jwtVerifier: JwtVerifier; service: LlmService }) {
  return new Elysia({ name: "llm-attest" }).post(
    "/internal/llm/attest",
    async ({ request, body, set }) => {
      let ctx;
      try {
        ctx = await requireUserContext(request.headers, deps.jwtVerifier);
      } catch {
        set.status = 401;
        return new Response(null, { status: 401 });
      }
      const parsed = attestLlmCallSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return new Response(null, { status: 400 });
      }
      const { callId, route, latencyMs, outcome, labelHash } = parsed.data;
      // FM is client-owned: emit the intent + outcome pair together (ADR-0008).
      await deps.service.recordLlmCall(ctx.userId, { phase: "intent", callId, route, labelHash });
      await deps.service.recordLlmCall(ctx.userId, {
        phase: "outcome",
        callId,
        route,
        labelHash,
        latencyMs,
        outcome,
      });
      set.status = 204;
      return new Response(null, { status: 204 });
    },
  );
}
```

Create `apps/api/src/modules/llm/llm.attest-router.test.ts`:

```ts
// bun:test — /internal/llm/attest listener (story 6-1, AC-1/AC-4).
import { test, expect } from "bun:test";
import type { JwtVerifier } from "../../platform/security";
import type { LlmCallEvent } from "@pekulo/types";
import type { LlmService } from "./llm.service";
import { createLlmAttestRouter } from "./llm.attest-router";

const okVerifier: JwtVerifier = {
  verify: async () => ({ sub: "u1", email: "f@bonjour.email" }),
} as unknown as JwtVerifier;
const failVerifier: JwtVerifier = {
  verify: async () => {
    throw new Error("bad token");
  },
} as unknown as JwtVerifier;

function makeService() {
  const events: Array<{ userId: string; event: LlmCallEvent }> = [];
  const service: LlmService = {
    route: async () => ({ callId: "x", route: "ollama", providerCall: null }),
    recordLlmCall: async (userId, event) => {
      events.push({ userId, event });
    },
  };
  return { service, events };
}

const validBody = {
  callId: "call_1",
  route: "foundation_models",
  latencyMs: 480,
  outcome: "success",
  labelHash: "abcd1234",
};

test("401 when the JWT is missing/invalid", async () => {
  const { service } = makeService();
  const app = createLlmAttestRouter({ jwtVerifier: failVerifier, service });
  const res = await app.handle(
    new Request("http://x/internal/llm/attest", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer bad" },
      body: JSON.stringify(validBody),
    }),
  );
  expect(res.status).toBe(401);
});

test("204 + writes the intent→outcome pair on a valid attestation (AC-4)", async () => {
  const { service, events } = makeService();
  const app = createLlmAttestRouter({ jwtVerifier: okVerifier, service });
  const res = await app.handle(
    new Request("http://x/internal/llm/attest", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer good" },
      body: JSON.stringify(validBody),
    }),
  );
  expect(res.status).toBe(204);
  expect(events.map((e) => e.event.phase)).toEqual(["intent", "outcome"]);
  expect(events[0]!.event.route).toBe("foundation_models");
});

test("400 on a malformed attestation body", async () => {
  const { service } = makeService();
  const app = createLlmAttestRouter({ jwtVerifier: okVerifier, service });
  const res = await app.handle(
    new Request("http://x/internal/llm/attest", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer good" },
      body: JSON.stringify({ callId: "c1" }),
    }),
  );
  expect(res.status).toBe(400);
});
```

Run: `bun --filter='@pekulo/api' run test apps/api/src/modules/llm/llm.attest-router.test.ts`
Expected: `3 pass`, `0 fail`, exit 0.
Commit: `git add apps/api/src/modules/llm/llm.attest-router.ts apps/api/src/modules/llm/llm.attest-router.test.ts && git commit -m "feat(#32): /internal/llm/attest listener (ADR-0008)"`

#### T13 — `llm.module.ts` composition root + wired module test [AC: AC-1, AC-4]

Create `apps/api/src/modules/llm/llm.module.ts`:

```ts
// apps/api/src/modules/llm/llm.module.ts
// Composition root for the LLM module (story 6-1). Returns { service,
// repository, attestRouter }. NO oRPC router — story 6-1 exposes no
// client-facing oRPC procedure (route/recordLlmCall are internal, consumed by
// story 6-2's categorise pipeline; the only HTTP surface is the Elysia-native
// attest listener). L8: inferred return type, never annotate bare Elysia.
import type { Env } from "../../config/env";
import type { PrismaService } from "../../database";
import type { JwtVerifier } from "../../platform/security";
import { generateBase62Id } from "../../database/base62";
import { createLlmRepository } from "./llm.repository";
import { createLlmService } from "./llm.service";
import { createOllamaClient } from "./services/ollama-client";
import { createThirdPartyClient } from "./services/third-party-client";
import { createLlmAttestRouter } from "./llm.attest-router";

export function createLlmModule(deps: {
  prismaService: PrismaService;
  env: Env;
  jwtVerifier: JwtVerifier;
}) {
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

> **Dev note for T13:** `generateBase62Id` lives at `apps/api/src/database/base62.ts` (story 5-3 precedent — `generateBase62Id(21)`). Confirm the exact export with `grep -n "export" apps/api/src/database/base62.ts` before running; if named differently, import the actual symbol. (The prefixed-ids extension owns model row IDs — `llm_<base62>` is injected at `create` time via the `LlmCallLog: "llm"` registration; `generateCallId` is the SEPARATE `call_id` correlation string, not a model id.)

Create `apps/api/src/modules/llm/llm.module.test.ts`:

```ts
// bun:test — whole-module wired against the real test DB (story 6-1, AC-1/AC-4
// + RLS isolation). Uses the shared Postgres-in-Docker helper.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { createTestDb, type TestDb } from "../../test/helpers/test-db";
import type { JwtVerifier } from "../../platform/security";
import type { Env } from "../../config/env";
import { createLlmModule } from "./llm.module";

let db: TestDb;
const fakeJwt = { verify: async () => ({ sub: "u-a", email: null }) } as unknown as JwtVerifier;
const fakeEnv = {} as unknown as Env;

beforeAll(async () => {
  db = await createTestDb();
});
afterAll(async () => {
  await db.close();
});

test("route writes an intent row for the owning user (AC-1)", async () => {
  const userA = await db.seedUser();
  const mod = createLlmModule({ prismaService: db.prismaService, env: fakeEnv, jwtVerifier: fakeJwt });
  const decision = await mod.service.route({
    userId: userA.id,
    clientCapabilities: { iosFoundationModels: false },
    prompt: { label: "Carrefour", amount: -42.5, currency: "EUR", occurredOn: "2026-05-15" },
  });
  expect(decision.route).toBe("ollama");

  const rows = await mod.repository.listRecentByUser(userA.id, new Date(0));
  expect(rows.length).toBe(1);
  expect(rows[0]!.phase).toBe("intent");
  expect(rows[0]!.route).toBe("ollama");
});

test("recordLlmCall rows are isolated per user (RLS / userId guard)", async () => {
  const userA = await db.seedUser();
  const userB = await db.seedUser();
  const mod = createLlmModule({ prismaService: db.prismaService, env: fakeEnv, jwtVerifier: fakeJwt });
  await mod.service.recordLlmCall(userA.id, {
    phase: "outcome",
    callId: "cz",
    route: "ollama",
    labelHash: "h",
    latencyMs: 100,
    outcome: "success",
  });
  const bRows = await mod.repository.listRecentByUser(userB.id, new Date(0));
  expect(bRows.length).toBe(0);
});
```

> **Dev note for T13 test:** confirm the test-DB helper API with `sed -n '1,40p' apps/api/src/test/helpers/test-db.ts`. If `createTestDb` / `seedUser` / `prismaService` differ, adapt to the actual helper surface used by `transactions.module.test.ts` / `bank-aggregator.module.test.ts` — do NOT change production code to fit a guessed harness.

Run: `bun --filter='@pekulo/api' run test apps/api/src/modules/llm/llm.module.test.ts`
Expected: `2 pass`, `0 fail`, exit 0 (requires the Postgres test DB the other `*.module.test.ts` suites use).
Commit: `git add apps/api/src/modules/llm/llm.module.ts apps/api/src/modules/llm/llm.module.test.ts && git commit -m "feat(#32): LLM module composition root + wired module test"`

#### T14 — Env vars + runtime wiring + mount attest listener [AC: AC-1]

In `apps/api/src/config/env.ts`, add LLM provider env vars to `envSchema` (after the `FRANKFURTER_BASE_URL` block, before the OTel block). All optional:

```ts
  // LLM providers (story 6-1, FR-31). All optional — Ollama defaults to the
  // localhost Dokploy bind; the third-party key lives ONLY in Dokploy env and
  // when unset the third-party route throws LLM_PROVIDER_UNAVAILABLE.
  OLLAMA_BASE_URL: optionalString(z.string().url()),
  OLLAMA_MODEL: optionalString(z.string().min(1)),
  THIRD_PARTY_LLM_API_KEY: optionalString(z.string().min(1)),
  THIRD_PARTY_LLM_BASE_URL: optionalString(z.string().url()),
  THIRD_PARTY_LLM_MODEL: optionalString(z.string().min(1)),
```

In `apps/api/src/bootstrap/runtime-dependencies.ts`:

1. Add the import (after the `createBankAggregatorModule` import line):

```ts
import { createLlmModule } from "../modules/llm/llm.module";
```

2. Add `llmModule` to the `RuntimeDeps` interface (after `bankAggregatorModule`):

```ts
  llmModule: ReturnType<typeof createLlmModule>;
```

3. Build the module (after the `bankAggregatorModule` construction, before the `orpcRouter` literal — it is NOT added to `orpcRouter`):

```ts
  // Story 6-1 — LLM routing + audit module. No oRPC router (no client-facing
  // procedure in 6-1); the only HTTP surface is the /internal/llm/attest
  // Elysia listener mounted in app.ts. The service is consumed server-side by
  // story 6-2's categorise pipeline (wired then).
  const llmModule = createLlmModule({
    prismaService,
    env: input.env,
    jwtVerifier,
  });
```

4. Add `llmModule` to the returned object (after `bankAggregatorModule,`):

```ts
    llmModule,
```

In `apps/api/src/app.ts`, mount the attest listener before `mountOrpc` (chain it onto the existing `.use(deps.bankAggregatorModule.webhookRouter)` line):

```ts
    .use(deps.bankAggregatorModule.webhookRouter)
    // Story 6-1 — /internal/llm/attest listener mounted BEFORE mountOrpc so the
    // internal path resolves before the oRPC catch-all (parity with the Bridge
    // webhook). JWT-verified inside the router (ADR-0008).
    .use(deps.llmModule.attestRouter);
```

Run: `bun --filter='@pekulo/api' run typecheck`
Expected: `tsc` exits 0.
Verify the mount is present: `grep -n "llmModule.attestRouter" apps/api/src/app.ts`
Expected: exactly one match.
Commit: `git add apps/api/src/config/env.ts apps/api/src/bootstrap/runtime-dependencies.ts apps/api/src/app.ts && git commit -m "feat(#32): wire LLM module + mount /internal/llm/attest"`

#### T15 — Full Iron-Law gate + push [AC: AC-5]

Run, in order (each must exit 0):

```
bun --filter='@pekulo/api' run lint
bun --filter='@pekulo/api' run typecheck
bun --filter='@pekulo/api' run test
bun --filter='@pekulo/api' run prisma:check
bun --filter='@pekulo/api' run db:rls-audit
bun --filter='@pekulo/types' run typecheck
bun --filter='@pekulo/validators' run typecheck
```

Expected:
- `lint` → `Found 0 warnings and 0 errors`.
- `typecheck` (×3) → exit 0.
- `test` → every `bun:test` suite passes, including the new LLM suites; exit 0.
- `prisma:check` → schema valid; exit 0.
- `db:rls-audit` → exit 0; `llm_call_log: 2`, `llm_opt_in: 4`; every pre-existing table count unchanged.

Then push the branch:

```
git push -u origin feature/32-6-1-llm-routing-and-providers
```

Commit (only if the gate produced format/lint fixups): `git add -A && git commit -m "chore(#32): gate fixups"` — otherwise skip (no-op).

### Testing

- **`apps/api` tests are `bun:test`** (`import { test, expect, mock } from "bun:test"`) — NOT vitest. The repository/service/client tests use in-memory stubs/mocks; `llm.module.test.ts` is the only suite needing the real Postgres test DB (`apps/api/src/test/helpers/test-db.ts`, same as `transactions.module.test.ts`).
- **Coverage rules (architecture L616-624):** `llm.service.ts` + the pure prompt builder → 100 % branch; `llm.repository.ts` → ≥ 1 happy + 1 RLS-isolation; the attest router → 1 happy + 1 unauthorised.
- **Grep gates:** prompt builder is zero-IO; `llmCallLog.create` appears only in the repository.

### Dependencies

- No new npm dependency. Uses Bun's built-in `fetch` + a djb2 label hash. Ollama (Dokploy, localhost) + the third-party LLM API are runtime services reached via `fetch`; both are optional at build/test time (clients fail typed when unconfigured).

### Lessons applied (binding)

- **2026-05-04 (cites story 6-1) — Elysia `Elysia` type is invariant.** `llm.module.ts` + `llm.attest-router.ts` use INFERRED return types; never annotate bare `Elysia`. Pre-impl check: `grep -rn ': Elysia\b' apps/api/src` surfaces only already-constrained shapes.
- **2026-05-19 — `bun --filter='@pekulo/api'` (NOT `=api`).** Every command above uses the quoted namespace.
- **2026-05-05 — `bun --cwd <relative>` silently fails;** manual SQL migrations preferred over `prisma migrate dev` (Supabase pooler hang). T4 hand-writes the SQL, applied via `prisma:migrate:deploy`; idempotent.
- **2026-05-09 — Zero `*.types.ts` inside `apps/api/src/modules/**`.** All LLM domain types live in `@pekulo/types/llm/`.
- **2026-05-07 — `bun test` (apps/api) ≠ `vitest` (apps/web).** All new suites here import from `"bun:test"`.
- **2026-05-20 — `defineAction` envelope omits `output:`** — not exercised in 6-1 (no apps/web server action); flagged for the downstream 6-3/6-4 UI stories.

## File List

_Populated by aped-dev at implementation time. Expected creates/modifies:_

- **NEW** `packages/types/src/llm/llm.types.ts`, `packages/types/src/llm/index.ts`
- **NEW** `packages/validators/src/llm/llm.schemas.ts`, `packages/validators/src/llm/index.ts`
- **NEW** `apps/api/prisma/schema/llm.prisma`
- **NEW** `apps/api/prisma/migrations/20260530120000_create_llm_call_log_and_opt_in/migration.sql`
- **NEW** `apps/api/src/modules/llm/{llm-provider,llm-prompt-builder,llm.errors,llm.repository,llm.service,llm.attest-router,llm.module}.ts` + co-located `*.test.ts`
- **NEW** `apps/api/src/modules/llm/services/{ollama-client,third-party-client}.ts` + `*.test.ts`
- **NEW** `apps/api/src/platform/security/opt-in-guard.ts` + `opt-in-guard.test.ts`
- **MODIFY** `packages/types/src/index.ts`, `packages/validators/src/index.ts`
- **MODIFY** `apps/api/prisma/schema/enums.prisma`
- **MODIFY** `apps/api/src/common/errors/pekulo-error.ts`, `apps/api/src/platform/http/error-mapper.ts`
- **MODIFY** `apps/api/src/config/env.ts`, `apps/api/src/bootstrap/runtime-dependencies.ts`, `apps/api/src/app.ts`, `apps/api/src/platform/security/index.ts`

## Dev Agent Record

- **Model:** claude-opus-4-8 (1M context)
- **Started:** 2026-05-30
- **Completed:** 2026-05-30

### Summary

Shipped FR-31 (routing policy) + FR-35 (per-call audit) backend-only: the LLM
routing service (iOS→`foundation_models`, else `ollama`; `third_party` never
auto-selected and opt-in-gated server-side), the sole append-only `llm_call_log`
audit writer, the two server provider clients (Ollama, third-party), the
zero-PII prompt builder (≤2 kb), the third-party opt-in read + DR-7 guard, and
the JWT-verified `/internal/llm/attest` listener. No client-facing oRPC
procedure and no UI — scope held exactly as locked at aped-story step 04.

### Files changed

- apps/api/prisma/migrations/20260530120000_create_llm_call_log_and_opt_in/migration.sql
- apps/api/prisma/schema/enums.prisma
- apps/api/prisma/schema/llm.prisma
- apps/api/scripts/rls-audit.ts
- apps/api/src/app.ts
- apps/api/src/bootstrap/runtime-dependencies.ts
- apps/api/src/common/errors/pekulo-error.ts
- apps/api/src/config/env.ts
- apps/api/src/modules/llm/llm-prompt-builder.ts (+ .test.ts)
- apps/api/src/modules/llm/llm-provider.ts
- apps/api/src/modules/llm/llm.attest-router.ts (+ .test.ts)
- apps/api/src/modules/llm/llm.errors.ts
- apps/api/src/modules/llm/llm.module.ts (+ .test.ts)
- apps/api/src/modules/llm/llm.repository.ts (+ .test.ts)
- apps/api/src/modules/llm/llm.service.ts (+ .test.ts)
- apps/api/src/modules/llm/services/ollama-client.ts (+ .test.ts)
- apps/api/src/modules/llm/services/third-party-client.ts (+ .test.ts)
- apps/api/src/platform/http/error-mapper.ts
- apps/api/src/platform/security/index.ts
- apps/api/src/platform/security/opt-in-guard.ts (+ .test.ts)
- packages/types/src/index.ts, packages/types/src/llm/{llm.types,index}.ts
- packages/types/src/transaction/transaction.types.ts (LlmRouteBadge rename)
- packages/ui/src/components/PekuloSuggestionRow/PekuloSuggestionRow.tsx (LlmRouteBadge rename)
- packages/validators/src/index.ts, packages/validators/src/llm/{llm.schemas,index}.ts

### Deviations

- **`LlmRoute` name collision (user decision — Option A).** `@pekulo/types/transaction`
  already exported `LLM_ROUTES`/`LlmRoute` as the UI badge variant (`ios|ollama|cloud`),
  colliding with 6-1's backend enum. Per Alex: backend `LlmRoute` becomes canonical; the
  UI variant was renamed `LlmRouteBadge`/`LLM_ROUTE_BADGES` (values unchanged). Touched 2
  files outside the story File List (transaction.types.ts, PekuloSuggestionRow.tsx).
- **validators→types TDZ cycle.** The story's T1 had `llm.schemas.ts` import `LLM_ROUTES`/
  `LLM_OUTCOMES` from `@pekulo/types`; validators may not import types (R1 one-way layering),
  and the runtime import broke 28 suites with "Cannot access 'LLM_ROUTES' before
  initialization". Fixed by inline `*_MIRROR` literals (the `accounts.schemas.ts` pattern).
- **T13 module test uses a fake Prisma, not a Postgres harness.** `apps/api/src/test/helpers/test-db.ts`
  does not exist — every `*.module.test.ts` wires a duck-typed fake. Per-user isolation
  asserts the `where:{userId}` guard (the single-layer api defence, ADR-0013); RLS-policy
  coverage is verified by `db:rls-audit` instead.
- **`rls-audit.ts` expected-counts map extended.** AC-5 requires the audit to report
  `llm_call_log:2` / `llm_opt_in:4`, but the script uses a curated table list (not
  auto-discovery), so the two tables were added to it.
- **Attest-router test host.** The story's `http://x/...` does not route through Elysia
  `.handle()`; switched to `http://localhost/...` (the bridge-webhook test pattern).
- **Two `fix(#32)` commits.** A prefixed-id create cast + fetch-mock casts surfaced only at
  the first full `typecheck` (T7-T9 per-task gates run `bun test`, which strips types). The
  env-var declarations land in T14 per the story ordering, so `typecheck` is transiently red
  on `OLLAMA_*`/`THIRD_PARTY_LLM_*` between T7 and T14 — green from T14 onward.
- **Lint.** `apps/api` lint exits 0 with 11 warnings, all pre-existing in unrelated files;
  the new LLM files add zero. (Story expected "0 warnings" — repo baseline already carries 11.)

### Test output

```
$ bun --filter='@pekulo/api' run lint          → 0 errors (11 pre-existing warnings)
$ bun --filter='@pekulo/api' run typecheck     → exit 0
$ bun --filter='@pekulo/types' run typecheck   → exit 0
$ bun --filter='@pekulo/validators' run typecheck → exit 0
$ bun --filter='@pekulo/api' run test          → 668 pass, 0 fail (1592 expect, 77 files)
$ bun --filter='@pekulo/api' run prisma:check  → schemas valid, exit 0
$ bun --filter='@pekulo/api' run db:rls-audit  → exit 0; llm_call_log:2, llm_opt_in:4, 19 tables
```

## Review Record

**Date:** 2026-05-30
**Auditors:** Spec, Code, Edge & Hallucination (backend surface — Aria not dispatched, no preview app surface)
**Verdict:** done — all findings resolved inline (commit `d7bbcb7`) and adversarially re-verified; story flipped to `done` on Alex's go-ahead.

> **Override:** Spec AC gap accepted — reason: "AC-2/AC-4 PARTIALs are consequences of the locked 6-1/6-2 scope split (step 04); the real defects are fixed inline and the story stays in review rather than bouncing to dev."

### Findings

#### Resolved (commit `d7bbcb7` — `fix(#32): harden /internal/llm/attest + LLM review findings [aped-review]`)

- **[MAJOR] Forged route on `/internal/llm/attest`** — the attest body accepted the full `LlmRoute` enum, so an authenticated client could POST `route:"ollama"|"third_party"` and inject forged rows into the append-only audit, defeating ADR-0008 / architecture L307 ("client cannot forge FoundationModels to hide a 3rd-party call"). [`packages/validators/src/llm/llm.schemas.ts:60`, `apps/api/src/modules/llm/llm.attest-router.ts:28`]
  - Source: Code + Edge (independent convergence)
  - Resolution: `attestLlmCallSchema.route` pinned to `z.literal("foundation_models")`; non-FM bodies rejected `400` before any write. New negative test asserts forged `ollama`/`third_party` → 400 and zero rows written.
- **[MEDIUM] Non-atomic attest double-write** — intent + outcome were two independent `await`s → orphan-intent row possible on a crash between them. [`apps/api/src/modules/llm/llm.attest-router.ts:30`]
  - Source: Edge
  - Resolution: new `repository.recordCallEvents()` (`$transaction`) + `service.recordLlmCallPair()` (validates both routes); attest router writes the pair atomically in one call. Single `llmCallLog.create` site preserved (`createCallEvent` helper).
- **[MEDIUM] `occurredOn` accepted unreal dates** (`2026-13-45`, `2026-02-30`, non-leap `2026-02-29`). [`packages/validators/src/llm/llm.schemas.ts:33`]
  - Source: Edge
  - Resolution: `.refine` round-trips through `Date` with a NaN guard before `toISOString()` (so an Invalid Date yields a clean `ZodError`, not a `RangeError`/500). Tests cover reject + leap-year accept.
- **[MEDIUM] Byte-cap vs char-cap mismatch** — the `.max(512)/.max(256)` char caps don't bound UTF-8 bytes; a multibyte envelope serialises to 2393 B > 2048 and is rejected at runtime, but the "worst-case" test only used ASCII. [`apps/api/src/modules/llm/llm-prompt-builder.ts:35`]
  - Source: Edge
  - Resolution: documented the UTF-8 byte cap as the authoritative NFR-12 guard; added the true multibyte (`中`×512+×256) worst-case test asserting it throws `/exceeds 2048B cap/`.
- **[MINOR] Unguarded enum mirror drift** — `LLM_ROUTES_MIRROR`/`LLM_OUTCOMES_MIRROR` (validators) vs `@pekulo/types` source, no drift test. [`packages/validators/src/llm/llm.schemas.ts:15`]
  - Source: Spec
  - Resolution: new `llm-enum-iso.test.ts` asserts `llmRouteSchema.options`/`llmOutcomeSchema.options` equal `@pekulo/types#LLM_ROUTES`/`#LLM_OUTCOMES`.
- **[MINOR] Dead `llmOptInRequired()` factory** duplicating the guard's error message. [`apps/api/src/modules/llm/llm.errors.ts:23`]
  - Source: Code
  - Resolution: factory removed; the opt-in guard's direct `PekuloError` is the single source.
- **[MINOR] Stale test comment** claiming `llm.module.test.ts` runs real-DB RLS isolation. [`apps/api/src/modules/llm/llm.repository.test.ts:1`]
  - Source: Code
  - Resolution: comment corrected to state the fake-Prisma reality (RLS coverage is `db:rls-audit`).
- **[MINOR] Attest test missing no-prompt-body assertion.** [`apps/api/src/modules/llm/llm.attest-router.test.ts`]
  - Source: Spec
  - Resolution: 204 test now asserts no `label`/`merchant`/`envelope` key reaches the recorded events.

#### Dismissed

- **[MINOR] `listRecentByUser` has no non-test caller in 6-1** [`apps/api/src/modules/llm/llm.repository.ts`]
  - Source: Code
  - Rationale: intentional forward-scaffold for the FR-36 activity log (story 6-5); the supporting keyset index (`llm_call_log_user_created_idx`) is already aligned. Removing it would force 6-5 to re-add it. Kept as a documented hook.

#### Unresolved

- None. All findings resolved or dismissed-with-rationale.

### Scope annotations (6-1 / 6-2 split — recorded so 6-2 inherits them)

- **AC-2 server-side third-party egress (403):** the DR-7 opt-in guard is unit-tested (`opt-in-guard.test.ts`) but is unreachable through `route()` because `decideRoute` never returns `third_party` at V1(a). The third-party-selecting policy + the integration test that drives the gated `providerCall()` land in **story 6-2**.
- **AC-4 server-route outcome row:** `route()` writes only the `intent` row for `ollama`/`third_party`; the matching `outcome` row is written by 6-2's categorise pipeline via `recordLlmCall`. The end-to-end pair is fully exercised in 6-1 only for the FM/attest path. `recordLlmCall` is proven capable of both phases.
- **ADR-0008 intent↔outcome route-mismatch flagging (F5):** forensic/OTel monitoring, deferred to 6-2+. The primary forge vector it guarded against is now closed at the schema layer (forged routes rejected 400).

### Verification

- Test command: `bun --filter='@pekulo/api' run test`
- Test output (final pass): **676 pass / 0 fail** (1613 expect, 78 files); LLM-scoped: 32 pass / 0 fail (9 files).
- Typecheck: `@pekulo/api` + `@pekulo/types` + `@pekulo/validators` → exit 0.
- Lint: `@pekulo/api` → 0 errors, 11 pre-existing warnings (all in unrelated `bank-aggregator`/auth files; the LLM changes add 0).
- Grep gates: `db.llmCallLog.create(` → 1 site (`llm.repository.ts`); prompt-builder zero-IO → clean.
- `prisma:check` / `db:rls-audit`: untouched by the review fixes (no schema/migration/rls-audit file changed); last green in the Dev Agent Record (`llm_call_log:2`, `llm_opt_in:4`).
- Visual verification: N/A — backend-only story, no preview-app surface.

### Ticket sync

- Ticket comment (#32): posted — https://github.com/yabafre/pekulo/issues/32#issuecomment-4583235204
- PR: draft #108 → base `main` (sprint `umbrella_branch`) — https://github.com/yabafre/pekulo/pull/108. `aped-lead` owns the merge; mark ready after the human-validation gate re-runs green.
