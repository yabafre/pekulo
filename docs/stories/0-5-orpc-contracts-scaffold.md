# Story: 0-5-orpc-contracts-scaffold — `@pekulo/contracts` oRPC scaffold + web client init + Elysia error-mapper

**Epic:** Epic 0 — Foundations (package layout, tooling, runtime substrate)
**Status:** ready-for-dev
**Ticket:** [#5](https://github.com/yabafre/pekulo/issues/5)
**Branch:** `feat/0-5-orpc-contracts-scaffold`
**Commit prefix:** `feat(#5): ...` (or `chore(#5):` / `fix(#5):` / `test(#5):` per task type)
**Closes:** #5
**Stepscompleted:**
**Reference ADRs:** [ADR-0009 — Domain API on Bun + Elysia + oRPC](../adr/0009-elysia-orpc-with-zapaction-bridge.md), [ADR-0011 — Packages reorg under `@pekulo/*` namespace](../adr/0011-packages-reorg-pekulo-namespace.md)
**Lessons enforced:** **L2** (Elysia 1.4 type invariance — module factories return inferred chains, boundaries use `AnyElysia`, never bare `Elysia`)
**Closes upstream marker:** the deferred-work comment at `apps/api/src/app.ts:16` (left by story 0-3, pointing at this story) is removed by Task 9.

---

## User Story

**As a** Pekulo developer, **I want** one oRPC contract per Elysia module wired under `@pekulo/contracts` with sub-tree versioning, the typed oRPC client initialised on `apps/web/src/lib/orpc/`, and the `PekuloError → oRPC` error-mapper landed on `apps/api/src/platform/http/`, **so that** every feature epic (1 → 8) inherits a typed contract surface to extend, the web tier compiles against `accountsContract` / `compassContract` / etc., the apps/api `/rpc/v1/*` mount returns structured oRPC responses, and the `app.ts:16` deferred-work marker from 0-3 is closed in the same story that introduces oRPC.

---

## Acceptance Criteria

- **AC-1 (web tier infers contract types from `@pekulo/contracts`):** **Given** `@pekulo/contracts` is published as a workspace package and `apps/web/src/lib/orpc/modules.ts` builds per-module typed clients via `createORPCClient<ContractRouterClient<typeof accountsContract>>(orpcLink)`, **When** I run `bun --cwd apps/web run typecheck`, **Then** `tsc --noEmit` exits 0, no `accountsContract`-related symbol resolves to `any` (`grep -nE ': any\b' apps/web/src/lib/orpc/*.ts` returns empty), and `apps/web/src/lib/orpc/modules.ts` exports exactly the 12 module clients listed in `pekuloContract` (auth, compass, milestones, accounts, holdings, realestate, transactions, monthly, dashboard, settings, hypothesis, llm).

- **AC-2 (sub-tree versioning is exemplified and resolves):** **Given** `packages/contracts/VERSIONING.md` documents the bump procedure and `packages/contracts/src/__tests__/version-coexistence.fixture.ts` shadows a hypothetical `compassContractV2` alongside the shipped `compassContractV1` / `compassContract`, **When** I run `bun --cwd packages/contracts run typecheck`, **Then** `tsc --noEmit` exits 0 and the fixture's three `satisfies` assertions hold: (i) `compassContract satisfies typeof compassContractV1` (current default ≡ v1), (ii) `compassContractV2 satisfies Record<string, unknown>` (v2 lives alongside without overwriting), (iii) the named import `import { compassContractV1 } from "../compass.contract"` still resolves after introducing the v2 shadow.

- **AC-3 (PekuloError + error-mapper close the `app.ts:16` deferred-work marker):** **Given** `apps/api/src/common/errors/pekulo-error.ts` exports `PekuloError` (base class) and `apps/api/src/platform/http/error-mapper.ts` exports `mapErrorToOrpcResponse(err: unknown): { status: number; body: { error: { code: string; message: string; requestId?: string } } }`, **When** I run `bun --cwd apps/api test src/platform/http/error-mapper.test.ts`, **Then** all four cases pass with exit 0: (i) `new PekuloError("UNAUTHORIZED", "no session")` → `{ status: 401, body: { error: { code: "UNAUTHORIZED", message: "no session" } } }`, (ii) `new PekuloError("NOT_FOUND", "compass not found")` → `{ status: 404, ... }`, (iii) raw `new Error("boom")` → `{ status: 500, body: { error: { code: "INTERNAL", message: "internal server error", requestId: <uuid-v7> } } }` (message sanitised, requestId present), (iv) thrown non-Error `"oops"` → `{ status: 500, body: { error: { code: "INTERNAL", ... } } }`.

- **AC-4 (oRPC mount returns structured 404 for any unknown procedure):** **Given** `apps/api/src/platform/http/orpc-mount.ts` builds an `RPCHandler` from `@orpc/server/fetch` keyed on the empty `pekuloRouter` and `apps/api/src/app.ts` calls `mountOrpc(app)` after `.use(healthModule.router)`, **When** I run `bun --cwd apps/api run dev` (boot in background) and `curl -sS -o /tmp/orpc-smoke.json -w "%{http_code}\n" -X POST -H "Content-Type: application/json" -d '{}' http://127.0.0.1:3001/rpc/v1/compass/noop`, **Then** the HTTP status is `404`, the body is JSON parseable as `{ "error": { "code": "NOT_FOUND", "message": <string>, "requestId": <uuid-v7-string> } }`, and the same curl against `/rpc/v1/auth/noop`, `/rpc/v1/llm/noop`, `/rpc/v1/holdings/noop` all return 404 with the same shape — proving the mount is keyed on `/rpc/v1/*` and dispatches uniformly across the 12 sub-trees (no hard-coded module list at mount time).

> **AC-4 dev preconditions reminder.** No procedures are defined yet on the empty `pekuloRouter`, so every call is expected to 404. The smoke is verifying the **wiring**, not any behaviour. The error-mapper from AC-3 is what shapes the 404 body — `RPCHandler` returns `matched: false`, the Elysia route falls through to the global `.onError(...)` which returns `mapErrorToOrpcResponse(new PekuloError("NOT_FOUND", ...)).body`. Stop the dev server with `kill %1` after the smoke.

---

## Dev Notes

### Existing code at write time

This story modifies four existing files and creates twenty-one new files. The four existing files are quoted verbatim below so the dev's mental model matches the on-disk reality before any edit. **Do not paraphrase or "improve" the quoted code outside the explicit task instructions** — every byte preserved means one fewer RED cycle for the dev agent.

#### `apps/api/src/app.ts` (current — modified by Task 9)

<!-- aped-lint-disable -->
```ts
import { Elysia } from "elysia";
import { loadEnv } from "./config/env";
import { createRuntimeDependencies } from "./bootstrap/runtime-dependencies";
import { registerLifecycle } from "./bootstrap/lifecycle";
import { createHealthModule } from "./modules/health/health.module";

export interface ServerHandle {
  stop: () => Promise<void>;
}

export async function startServer(): Promise<ServerHandle> {
  const env = loadEnv();
  const deps = await createRuntimeDependencies({ env });
  const healthModule = createHealthModule({ readiness: deps.readiness });

  // TODO(story 0-5): replace with platform/http/error-mapper.ts (PekuloError → oRPC).
  const app = new Elysia()
    .onError(({ code, error, set }) => {
      console.error(`[api] error code=${String(code)}`, error);
      const status =
        set.status === undefined || set.status === 200 ? 500 : Number(set.status);
      set.status = status;
      if (status >= 500) {
        return { error: { code: "INTERNAL", message: "internal server error" } };
      }
      return {
        error: {
          code: String(code),
          message: error instanceof Error ? error.message : String(error),
        },
      };
    })
    .use(healthModule.router);

  await registerLifecycle(
    app,
    { shutdownTimeoutMs: env.SHUTDOWN_TIMEOUT_MS },
    { prismaService: deps.prismaService },
  );

  app.listen({ port: env.PORT, hostname: env.HOST }, (server) => {
    console.log(`[api] listening on http://${server.hostname}:${server.port}`);
  });

  return {
    stop: async () => {
      await app.stop();
    },
  };
}
```
<!-- aped-lint-enable -->

This story removes the deferred-work comment shown verbatim above (line 16 of the quoted block) and the inline `.onError(...)` body, replacing them with `app.onError(({ error, set }) => mapErrorToOrpcResponse(error).body /* with set.status assigned */)` and adds `mountOrpc(app)` after `.use(healthModule.router)`. The chained call must remain inferred — **L2 enforcement: do NOT annotate `const app:` or any return type with bare `Elysia`.**

#### `apps/api/package.json` (current — modified by Task 6, Task 8)

```json
{
  "name": "@pekulo/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "description": "Pekulo domain API — Bun + Elysia + oRPC. See ADR-0009.",
  "main": "./src/main.ts",
  "scripts": {
    "dev": "bun --hot src/main.ts",
    "start": "bun src/main.ts",
    "build": "bun build src/main.ts --target=bun --outdir=dist",
    "typecheck": "tsc --noEmit",
    "prisma:generate": "prisma generate",
    "prisma:migrate:dev": "prisma migrate dev",
    "prisma:migrate:deploy": "prisma migrate deploy",
    "prisma:migrate:status": "prisma migrate status",
    "prisma:format": "prisma format",
    "prisma:validate": "prisma validate",
    "db:rls-audit": "bun run scripts/rls-audit.ts"
  },
  "dependencies": {
    "@prisma/adapter-pg": "7.8.0",
    "@prisma/client": "7.8.0",
    "@prisma/client-runtime-utils": "7.8.0",
    "elysia": "1.4.4",
    "pg": "^8.13.1",
    "zod": "4.3.6"
  },
  "devDependencies": {
    "@pekulo/tsconfig": "workspace:*",
    "@types/bun": "1.3.0",
    "@types/pg": "^8.11.10",
    "dotenv": "^16.4.5",
    "prisma": "7.8.0",
    "typescript": "^5.6.0"
  }
}
```

#### `apps/web/package.json` (current — modified by Task 12)

```json
{
  "name": "web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@base-ui/react": "^1.4.1",
    "@supabase/ssr": "^0.10.2",
    "@supabase/supabase-js": "^2.104.1",
    "@tanstack/react-form": "^1.29.1",
    "@tanstack/react-query": "^5.100.5",
    "@zapaction/core": "^0.2.2",
    "@zapaction/query": "^0.2.2",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^1.11.0",
    "next": "16.2.4",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "recharts": "^3.8.0",
    "shadcn": "^4.5.0",
    "tailwind-merge": "^3.5.0",
    "tailwindcss-animate": "^1.0.7",
    "tw-animate-css": "^1.4.0",
    "yahoo-finance2": "^3.14.0",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "supabase": "^2.95.4",
    "tailwindcss": "^4",
    "typescript": "^5"
  },
  "trustedDependencies": [
    "unrs-resolver"
  ]
}
```

#### `packages/contracts/package.json` (current — modified by Task 1)

```json
{
  "name": "@pekulo/contracts",
  "version": "0.0.0",
  "private": true,
  "description": "Pekulo oRPC contracts — placeholder; real contracts (compassContract, holdingsContract, llmContract, ...) land in story 0-5 per ADR-0011.",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@pekulo/types": "workspace:*",
    "@pekulo/validators": "workspace:*"
  },
  "devDependencies": {
    "@pekulo/tsconfig": "workspace:*",
    "typescript": "^5.6.0"
  }
}
```

#### `packages/contracts/src/index.ts` (current — replaced by Task 3)

```ts
// Placeholder for @pekulo/contracts. Real oRPC contracts (one sub-tree per
// Elysia module) land in story 0-5 per ADR-0011.
export {};
```

### File decisions (3-bullet template per file)

#### `@pekulo/contracts` (CREATE / MODIFY)

- `packages/contracts/package.json` — **Modified.** Single responsibility: declare `@pekulo/contracts` package shape with `@orpc/contract` as the only runtime dep. I/O: consumed by `apps/api` (server-side) and `apps/web` (client-side) at workspace `*` resolution.
- `packages/contracts/src/<module>.contract.ts` × 12 — **Created.** Single responsibility: one empty oRPC contract router per Elysia module + version metadata. I/O: imports `oc` from `@orpc/contract` (and nothing else for the empty scaffold) ; exports `<module>Contract`, `<module>ContractV1`, `<module>ContractMeta`. Modules: `auth`, `compass`, `milestones`, `accounts`, `holdings`, `realestate`, `transactions`, `monthly`, `dashboard`, `settings`, `hypothesis`, `llm`.
- `packages/contracts/src/index.ts` — **Replaced.** Single responsibility: aggregate per-module re-exports + a single top-level `pekuloContract` keyed by module name. I/O: imports the 12 contract files ; exports each module's three symbols + `pekuloContract` + `PEKULO_CONTRACT_VERSION = "v1"`.
- `packages/contracts/src/__tests__/version-coexistence.fixture.ts` — **Created.** Single responsibility: typecheck-only proof that v1 and a hypothetical v2 coexist on the same module without breaking v1 imports (AC-2). I/O: imports `compassContract`, `compassContractV1` ; declares a shadow `compassContractV2` ; runs three `satisfies` assertions. Not executed at runtime — `tsc --noEmit` is the verifier.
- `packages/contracts/VERSIONING.md` — **Created.** Single responsibility: documented procedure for bumping a sub-tree without breaking current consumers. I/O: prose only.

#### `apps/api` (CREATE / MODIFY)

- `apps/api/package.json` — **Modified.** Single responsibility: register `@pekulo/contracts` (workspace) + `@orpc/server` (runtime) deps. I/O: bun resolves both at workspace install.
- `apps/api/src/common/errors/pekulo-error.ts` — **Created.** Single responsibility: domain error base class with stable `code` field + `cause` chain + `isPekuloError(x)` guard. I/O: imports nothing ; exports `PekuloError`, `PekuloErrorCode` (string union for the V1 codes used by 0-5: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_REQUEST`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL`), `isPekuloError`.
- `apps/api/src/common/errors/index.ts` — **Created.** Single responsibility: barrel re-export for `common/errors/*`. I/O: re-exports from `pekulo-error.ts`.
- `apps/api/src/platform/http/error-mapper.ts` — **Created.** Single responsibility: pure mapping `unknown → { status, body: { error: { code, message, requestId? } } }` covering `PekuloError`, native `Error`, and non-Error throws. I/O: imports `PekuloError`, `randomBase62` (for requestId, will be added later) — **for 0-5 we use `crypto.randomUUID()`** since `apps/api/src/common/ids/request-id.ts` is not yet built (architecture lists it but no story has shipped it). Exports `mapErrorToOrpcResponse(err)` and `ORPC_HTTP_STATUS_BY_CODE` lookup.
- `apps/api/src/platform/http/error-mapper.test.ts` — **Created.** Single responsibility: cover the four AC-3 branches with `bun:test`. I/O: imports `bun:test` (built-in, no install) + the SUT.
- `apps/api/src/platform/http/orpc-mount.ts` — **Created.** Single responsibility: build `RPCHandler` from `@orpc/server/fetch` keyed on the empty `pekuloRouter` and expose `mountOrpc(app: AnyElysia)` returning the inferred Elysia chain. I/O: imports `RPCHandler` from `@orpc/server/fetch`, `pekuloContract` (used as the empty router for now — see Dev Notes "Empty router rationale" below), `PekuloError`, `mapErrorToOrpcResponse`, `AnyElysia` from `elysia`. **L2 enforcement: parameter typed `AnyElysia`, return type INFERRED (no annotation).**
- `apps/api/src/app.ts` — **Modified.** Single responsibility unchanged. Diff scope: (1) replace inline `.onError(...)` with the error-mapper call, (2) call `mountOrpc(app)` after `.use(healthModule.router)`, (3) remove the deferred-work comment on line 16 of the current file.

#### `apps/web` (CREATE / MODIFY)

- `apps/web/package.json` — **Modified.** Single responsibility: register `@pekulo/contracts` (workspace) + `@orpc/client` + `@orpc/contract` (runtime types).
- `apps/web/src/lib/orpc/client.ts` — **Created.** Single responsibility: server-only oRPC HTTP link pointing to `${API_BASE_URL}/rpc/v1`. I/O: `import "server-only"` ; reads `process.env.API_BASE_URL` ; exports `orpcLink: RPCLink`. **No auth header forwarding in 0-5** — that lands in 0-6 (zapaction-orpc-bridge).
- `apps/web/src/lib/orpc/modules.ts` — **Created.** Single responsibility: instantiate the 12 per-module typed clients via `createORPCClient<ContractRouterClient<typeof <module>Contract>>(orpcLink)`. I/O: imports `orpcLink`, the 12 module contracts ; exports `authClient`, `compassClient`, …, `llmClient`.
- `apps/web/src/lib/orpc/types.ts` — **Created.** Single responsibility: re-export `ContractRouterClient`, `InferContractRouterInputs`, `InferContractRouterOutputs` type helpers from `@orpc/contract` for downstream feature stories. I/O: type re-exports only.
- `.env.example` (root) — **Modified.** Single responsibility: add the new `API_BASE_URL` line documenting the local default. I/O: documentation only ; loaded at runtime by `dotenv -c -e .env -e .env.local --` per existing root convention.

### Architecture pinning

- **ADR-0009 — oRPC mount layout.** `/rpc/v1/<module>/<method>` ; per-module sub-trees independently bumpable to `v2`, `v3` without forcing siblings. The 12 modules listed in the architecture's mount layout are exactly the 12 contract files this story creates.
- **ADR-0011 — `@pekulo/*` namespace.** `@pekulo/contracts` consumes `@pekulo/types` + `@pekulo/validators` (already wired as workspace deps from story 0-1). The 0-5 contracts are EMPTY — they don't yet import from validators/types because no schemas are defined. Feature epics 1-1, 2-1, …, 8-1 add the procedure-level schemas via `@pekulo/validators`.
- **L2 enforcement (Elysia 1.4 invariant generic).** `apps/api/src/platform/http/orpc-mount.ts` accepts `app: AnyElysia` (imported from `elysia`) and returns the inferred chain. `apps/api/src/app.ts`'s `const app = new Elysia()...` MUST keep its inferred type — no `: Elysia` anywhere. Pre-task gate (Task 15): `grep -nE ': Elysia\\b' apps/api/src` MUST return zero matches across the touched files (matches on `AnyElysia` are fine and expected).
- **Empty router rationale.** RPCHandler in `@orpc/server/fetch` requires a router *with* handlers, not a contract. For the scaffold, we pass an empty object `{}` — `RPCHandler({}).handle(request, { prefix: "/rpc/v1" })` returns `matched: false` for every URL, falling through to the Elysia error handler which returns the `NOT_FOUND` shape from the error-mapper. Feature stories progressively replace `{}` with `os.contract(<module>Contract).router({...handlers...})` — that's where procedures get implementations.

### oRPC API surface used in this story

These are the exact symbols the dev should import. All quoted from the oRPC docs (context7 fetched 2026-05-04). Do not invent additional imports.

| Symbol | Source | Used in |
|---|---|---|
| `oc` (contract builder) | `@orpc/contract` | the 12 `<module>.contract.ts` files (just to attach a `_marker` so types are non-empty if needed — but for the scaffold the empty `{}` router is sufficient) |
| `RPCHandler` (fetch adapter) | `@orpc/server/fetch` | `apps/api/src/platform/http/orpc-mount.ts` |
| `createORPCClient` | `@orpc/client` | `apps/web/src/lib/orpc/modules.ts` |
| `RPCLink` | `@orpc/client/fetch` | `apps/web/src/lib/orpc/client.ts` |
| `ContractRouterClient<T>` | `@orpc/contract` | `apps/web/src/lib/orpc/{modules,types}.ts` |
| `InferContractRouterInputs<T>`, `InferContractRouterOutputs<T>` | `@orpc/contract` | `apps/web/src/lib/orpc/types.ts` (re-exported only) |
| `AnyElysia` | `elysia` | `apps/api/src/platform/http/orpc-mount.ts` (parameter type) |

### Test framework choice

The brownfield project ships no test framework (per `docs/project-context.md`). Story 0-5 introduces one targeted unit test (`apps/api/src/platform/http/error-mapper.test.ts`) covering AC-3. Framework: **`bun:test`** — Bun's built-in runner, **zero install** (it's part of the Bun runtime). This precedes the formal `aped-qa` framework decision but is consistent with apps/api having no `vitest`/`jest` deps. AC-1, AC-2, AC-4 are verified without a test framework: AC-1/AC-2 = `tsc --noEmit`, AC-4 = `curl` smoke.

### Lessons applied

- **L2 (Elysia type invariance).** Applied to Task 8 (`orpc-mount.ts`) and Task 9 (`app.ts` modification). Concrete checks:
  - Task 8: parameter signature is `mountOrpc(app: AnyElysia)`. No `: Elysia` return annotation. The chain `app.all("/rpc/v1/*", ...)` returns the inferred type — let TS infer.
  - Task 9: the `const app = new Elysia()...` chain stays inferred. The result of `.use(healthModule.router)` plus `mountOrpc(...)` is whatever oRPC's chain produces — DO NOT cast to bare `Elysia`.
  - Pre-merge gate (Task 15): `grep -nE ': Elysia\\b' apps/api/src` returns zero matches.

- **L1 (Bun frozen-lockfile workspace coverage in Docker).** Apps/web ships on Vercel (no Docker) and apps/api's Dockerfile already does `COPY packages packages` per the L1 fix from story 0-3. Adding `@pekulo/contracts` as a new dep is automatically covered. No Dockerfile change required.

---

## Tasks

> Each task is sized for ~2-5 minutes of dev time. Tasks reference the AC they satisfy. The dev agent runs `git status` between tasks to confirm only the expected files changed.

- [ ] **Task 1 — Install `@orpc/contract` in `@pekulo/contracts`** [AC: AC-1, AC-2]

  Install `@orpc/contract` as the only new runtime dep, pin EXACT version (no `^`).

  Run from repo root:
  ```bash
  bun add --exact @orpc/contract --cwd packages/contracts
  bun install
  ```

  After install, verify the version pinned in `packages/contracts/package.json` is exact (e.g. `"@orpc/contract": "1.13.0"` — whatever bun resolved). Replace the file's `description` line with the new wording (drop the placeholder mention).

  Replace `packages/contracts/package.json` with the result, ensuring the deps block reads:
  ```json
  "dependencies": {
    "@orpc/contract": "<exact-version-bun-resolved>",
    "@pekulo/types": "workspace:*",
    "@pekulo/validators": "workspace:*"
  }
  ```
  And the `description` reads:
  ```
  "description": "Pekulo oRPC contracts — one sub-tree per Elysia module under @pekulo/contracts. See ADR-0009, ADR-0011."
  ```

  Run: `bun --cwd packages/contracts run typecheck`
  Expected: exit 0, no output (placeholder index.ts still exports `{}` so typecheck passes).
  Commit: `git add packages/contracts/package.json bun.lock && git commit -m "chore(#5): add @orpc/contract to @pekulo/contracts (pinned exact)"`

- [ ] **Task 2 — Write the 12 module contract skeletons** [AC: AC-1]

  Create `packages/contracts/src/<module>.contract.ts` for each of the 12 modules. **Every file uses the identical template below**, only `MODULE_KEY`, `MODULE_PASCAL`, and the file name change.

  Module list (file name → MODULE_KEY → MODULE_PASCAL):
  - `auth.contract.ts` → `auth` → `Auth`
  - `compass.contract.ts` → `compass` → `Compass`
  - `milestones.contract.ts` → `milestones` → `Milestones`
  - `accounts.contract.ts` → `accounts` → `Accounts`
  - `holdings.contract.ts` → `holdings` → `Holdings`
  - `realestate.contract.ts` → `realestate` → `Realestate`
  - `transactions.contract.ts` → `transactions` → `Transactions`
  - `monthly.contract.ts` → `monthly` → `Monthly`
  - `dashboard.contract.ts` → `dashboard` → `Dashboard`
  - `settings.contract.ts` → `settings` → `Settings`
  - `hypothesis.contract.ts` → `hypothesis` → `Hypothesis`
  - `llm.contract.ts` → `llm` → `Llm`

  Template (substitute `MODULE_KEY` and `MODULE_PASCAL` per file):
  ```ts
  // packages/contracts/src/<MODULE_KEY>.contract.ts
  // <MODULE_PASCAL> module oRPC contract — empty scaffold; procedures land
  // with feature stories. See ADR-0009 (mount under /rpc/v1/<MODULE_KEY>).

  /**
   * v1 contract router for the <MODULE_PASCAL> module.
   *
   * The router shape is `Record<procedureName, ContractProcedure | NestedRouter>`.
   * It is empty for the scaffold — feature stories add procedures via
   * `oc.input(...).output(...)` and place them under their procedure name.
   *
   * Sub-tree versioning convention (see VERSIONING.md):
   * - Current default export `<moduleKey>Contract` always points at the latest
   *   non-breaking-evolved version.
   * - Explicit numbered exports (`<moduleKey>ContractV1`, `<moduleKey>ContractV2`, …)
   *   stay frozen at their version's wire shape forever.
   * - On a breaking bump, the next version is created as a parallel constant;
   *   the previous version is NOT mutated.
   */
  export const MODULE_KEYContractV1 = {} as const;

  /**
   * Default export: alias to the current non-breaking version.
   * Imported by `apps/web/src/lib/orpc/modules.ts` and `apps/api/src/platform/http/orpc-mount.ts`.
   */
  export const MODULE_KEYContract = MODULE_KEYContractV1;

  /**
   * Mount metadata. Consumed by future Elysia module factories to know which
   * `/rpc/<version>/<module>` path their handlers attach to.
   */
  export const MODULE_KEYContractMeta = {
    moduleKey: "MODULE_KEY",
    mountPath: "/rpc/v1/MODULE_KEY",
    version: "v1",
  } as const;
  ```

  **Important.** Replace `MODULE_KEY` with the lowercase key (e.g. `auth`, `compass`, …) — it appears in three places: the export name `<moduleKey>ContractV1`, the default alias `<moduleKey>Contract`, and the meta literal's `moduleKey` + `mountPath` string. The PascalCase `<MODULE_PASCAL>` is used only in the comment header.

  Concretely, `auth.contract.ts` reads:
  ```ts
  // packages/contracts/src/auth.contract.ts
  // Auth module oRPC contract — empty scaffold; procedures land with feature
  // stories. See ADR-0009 (mount under /rpc/v1/auth).

  export const authContractV1 = {} as const;
  export const authContract = authContractV1;
  export const authContractMeta = {
    moduleKey: "auth",
    mountPath: "/rpc/v1/auth",
    version: "v1",
  } as const;
  ```

  Repeat the substitution for the other 11 modules.

  Run: `ls packages/contracts/src/*.contract.ts | wc -l`
  Expected: `12` exactly.
  Commit: `git add packages/contracts/src/*.contract.ts && git commit -m "feat(#5): scaffold 12 oRPC contract skeletons under @pekulo/contracts"`

- [ ] **Task 3 — Aggregate `packages/contracts/src/index.ts`** [AC: AC-1]

  Replace the placeholder `export {};` with a barrel re-exporting every module's three symbols + a top-level `pekuloContract` aggregator.

  Replace `packages/contracts/src/index.ts` entirely with:
  ```ts
  // packages/contracts/src/index.ts
  // Aggregate barrel for @pekulo/contracts.
  // Per-module exports stay sovereign so consumers can `import { authContract } from "@pekulo/contracts"`
  // without dragging the full pekuloContract object.
  // The top-level `pekuloContract` is for the apps/api oRPC mount and the apps/web
  // typed client factory — both want the keyed router shape.

  export { authContract, authContractV1, authContractMeta } from "./auth.contract";
  export { compassContract, compassContractV1, compassContractMeta } from "./compass.contract";
  export { milestonesContract, milestonesContractV1, milestonesContractMeta } from "./milestones.contract";
  export { accountsContract, accountsContractV1, accountsContractMeta } from "./accounts.contract";
  export { holdingsContract, holdingsContractV1, holdingsContractMeta } from "./holdings.contract";
  export { realestateContract, realestateContractV1, realestateContractMeta } from "./realestate.contract";
  export { transactionsContract, transactionsContractV1, transactionsContractMeta } from "./transactions.contract";
  export { monthlyContract, monthlyContractV1, monthlyContractMeta } from "./monthly.contract";
  export { dashboardContract, dashboardContractV1, dashboardContractMeta } from "./dashboard.contract";
  export { settingsContract, settingsContractV1, settingsContractMeta } from "./settings.contract";
  export { hypothesisContract, hypothesisContractV1, hypothesisContractMeta } from "./hypothesis.contract";
  export { llmContract, llmContractV1, llmContractMeta } from "./llm.contract";

  import { authContract } from "./auth.contract";
  import { compassContract } from "./compass.contract";
  import { milestonesContract } from "./milestones.contract";
  import { accountsContract } from "./accounts.contract";
  import { holdingsContract } from "./holdings.contract";
  import { realestateContract } from "./realestate.contract";
  import { transactionsContract } from "./transactions.contract";
  import { monthlyContract } from "./monthly.contract";
  import { dashboardContract } from "./dashboard.contract";
  import { settingsContract } from "./settings.contract";
  import { hypothesisContract } from "./hypothesis.contract";
  import { llmContract } from "./llm.contract";

  /**
   * Top-level Pekulo oRPC contract aggregator.
   *
   * Keyed by module name. Used by:
   * - `apps/api/src/platform/http/orpc-mount.ts` to build the RPCHandler router.
   * - `apps/web/src/lib/orpc/modules.ts` to spawn per-module typed clients.
   *
   * Adding a module: add its file under `packages/contracts/src/<module>.contract.ts`,
   * re-export here, and append it to this object literal.
   */
  export const pekuloContract = {
    auth: authContract,
    compass: compassContract,
    milestones: milestonesContract,
    accounts: accountsContract,
    holdings: holdingsContract,
    realestate: realestateContract,
    transactions: transactionsContract,
    monthly: monthlyContract,
    dashboard: dashboardContract,
    settings: settingsContract,
    hypothesis: hypothesisContract,
    llm: llmContract,
  } as const;

  /**
   * Top-level wire version. Increments only when an oRPC-runtime breaking change
   * forces a global bump. Per-module sub-tree bumps stay encoded in each module's
   * `<module>ContractMeta.version` and its `mountPath`.
   */
  export const PEKULO_CONTRACT_VERSION = "v1" as const;
  ```

  Run: `bun --cwd packages/contracts run typecheck`
  Expected: exit 0, no output.
  Commit: `git add packages/contracts/src/index.ts && git commit -m "feat(#5): aggregate pekuloContract barrel + 12 module re-exports"`

- [ ] **Task 4 — Write `VERSIONING.md` + version-coexistence fixture** [AC: AC-2]

  Create `packages/contracts/VERSIONING.md`:
  ```markdown
  # Sub-tree Versioning — `@pekulo/contracts`

  Each module under `src/<module>.contract.ts` exports three symbols at the current major version `vN`:

  - `<moduleKey>ContractVN` — frozen, never mutated after release. Wire-stable.
  - `<moduleKey>Contract` — alias to the latest non-breaking version. The default consumer import.
  - `<moduleKey>ContractMeta` — `{ moduleKey, mountPath, version }` literal. Drives the apps/api mount and the apps/web client.

  ## Bumping a sub-tree (breaking change)

  When a wire-breaking change is required for a single module:

  1. **Do not edit** the existing `<moduleKey>ContractV1`. Treat it as immutable.
  2. Add the new shape at `<moduleKey>ContractV2` next to it (new `export const`).
  3. Update `<moduleKey>Contract` to alias `<moduleKey>ContractV2` (current default).
  4. Update `<moduleKey>ContractMeta.version` to `"v2"` and `mountPath` to `/rpc/v2/<moduleKey>`.
  5. Keep `<moduleKey>ContractV1` exported from `index.ts` so older clients
     (web tier on a delayed deploy, mobile shipping a slightly older bundle)
     still resolve the previous tree.
  6. On the apps/api side, mount BOTH versions: the new RPCHandler is keyed on
     `<moduleKey>ContractV2` (default) AND the old RPCHandler keyed on
     `<moduleKey>ContractV1` stays under `/rpc/v1/<moduleKey>` until traffic
     drains.
  7. Document the bump in `docs/adr/<NNNN>-<module>-contract-v2.md` with the
     migration window.

  ## Bumping non-breaking (additive) changes

  Add the new procedure to the existing `<moduleKey>ContractV1` directly. No
  parallel version is needed. The wire is backward-compatible.

  ## What this is NOT

  - Not for the top-level `PEKULO_CONTRACT_VERSION` — that bumps only on
    oRPC-runtime breaking changes (e.g. `@orpc/contract` major upgrade).
  - Not a `package.json` semver bump trigger — `@pekulo/contracts` is a
    workspace package, version stays `0.0.0`.

  See ADR-0009 (oRPC + Elysia) for the canonical mount layout.
  ```

  Create `packages/contracts/src/__tests__/version-coexistence.fixture.ts`:
  ```ts
  // packages/contracts/src/__tests__/version-coexistence.fixture.ts
  // Typecheck-only proof for AC-2: when a hypothetical compassContractV2 is
  // added next to the shipped compassContractV1, both still resolve and the
  // shipped `compassContract` default still typechecks against V1's shape.
  // This file is NOT executed at runtime — `tsc --noEmit` is the verifier.

  import {
    compassContract,
    compassContractV1,
  } from "../compass.contract";

  // Shadow a hypothetical V2 alongside V1. In a real bump, V2 would land
  // inside `compass.contract.ts` next to V1. Here it lives in the fixture
  // strictly to exercise the typing rule.
  const compassContractV2 = {
    // procedure stub keyed differently from V1; presence of any key in V2
    // proves the fixture has produced a divergent shape.
    breakingProcedure: {} as const,
  } as const;

  // (i) current default ≡ V1 (the shipped invariant).
  const _assertDefaultIsV1: typeof compassContractV1 = compassContract;

  // (ii) V2 lives alongside without overwriting V1.
  const _assertV2IsRecord: Record<string, unknown> = compassContractV2;

  // (iii) the named import compassContractV1 still resolves after introducing
  // the V2 shadow — this is implicit in the import line above; the explicit
  // assignment forces TS to materialise the type.
  const _assertV1NamedImportResolves: typeof compassContractV1 = compassContractV1;

  // Suppress unused-binding lint without exporting fixtures into the bundle.
  void _assertDefaultIsV1;
  void _assertV2IsRecord;
  void _assertV1NamedImportResolves;
  ```

  Run: `bun --cwd packages/contracts run typecheck`
  Expected: exit 0, no output. The three `void` statements consume the
  assertions so TS does not flag them as unused.
  Commit: `git add packages/contracts/VERSIONING.md packages/contracts/src/__tests__/version-coexistence.fixture.ts && git commit -m "docs(#5): document sub-tree versioning + add v1/v2 coexistence fixture"`

- [ ] **Task 5 — Verify `@pekulo/contracts` typecheck (AC-1 + AC-2 cleanup)** [AC: AC-1, AC-2]

  Pure verification — no edits. Confirms Tasks 1-4 produced a clean state.

  Run:
  ```bash
  bun --cwd packages/contracts run typecheck
  ls packages/contracts/src/*.contract.ts | wc -l
  cat packages/contracts/src/index.ts | grep -c "Contract,"
  ```
  Expected:
  - `tsc --noEmit` exit 0, no output.
  - `12` contract files.
  - `36` matches for `Contract,` in index.ts (12 modules × 3 symbols re-exported per `export {…}` line — one comma after each of `<moduleKey>ContractV1`, `<moduleKey>Contract`, `<moduleKey>ContractMeta` per line ; 12 × 3 = 36).

  No commit (verification step).

- [ ] **Task 6 — Add `@pekulo/contracts` + `@orpc/server` to `apps/api`** [AC: AC-4]

  Add the workspace contract dep + oRPC server runtime, both pinned EXACT.

  Run from repo root:
  ```bash
  bun add @pekulo/contracts@workspace:* --cwd apps/api
  bun add --exact @orpc/server --cwd apps/api
  bun install
  ```

  Verify the resulting `apps/api/package.json` `dependencies` block contains the new lines, exact version for `@orpc/server` (e.g. `"@orpc/server": "1.13.0"`):
  ```json
  "dependencies": {
    "@orpc/server": "<exact-version-bun-resolved>",
    "@pekulo/contracts": "workspace:*",
    "@prisma/adapter-pg": "7.8.0",
    "@prisma/client": "7.8.0",
    "@prisma/client-runtime-utils": "7.8.0",
    "elysia": "1.4.4",
    "pg": "^8.13.1",
    "zod": "4.3.6"
  }
  ```

  Run: `bun --cwd apps/api run typecheck`
  Expected: exit 0 (no code changes yet — just deps registered).
  Commit: `git add apps/api/package.json bun.lock && git commit -m "chore(#5): add @pekulo/contracts + @orpc/server to apps/api"`

- [ ] **Task 7 — Create `PekuloError` base class + barrel** [AC: AC-3]

  Create `apps/api/src/common/errors/pekulo-error.ts`:
  ```ts
  // apps/api/src/common/errors/pekulo-error.ts
  // Domain error base class — every typed error thrown by apps/api services
  // (CompassError, LlmRoutingError, …) extends PekuloError. The error-mapper
  // matches on `code` to derive the HTTP status.

  /**
   * Stable error codes for the V1 (a) personal-use phase. The list will grow
   * as feature stories add module-specific errors (e.g. `INVALID_LOT`,
   * `LLM_ROUTE_DOWN`). Keep the union sorted alphabetically for readability.
   */
  export type PekuloErrorCode =
    | "BAD_REQUEST"
    | "CONFLICT"
    | "FORBIDDEN"
    | "INTERNAL"
    | "NOT_FOUND"
    | "RATE_LIMITED"
    | "UNAUTHORIZED";

  export class PekuloError extends Error {
    override readonly name = "PekuloError";
    readonly code: PekuloErrorCode;

    constructor(code: PekuloErrorCode, message: string, options?: { cause?: unknown }) {
      super(message, options);
      this.code = code;
    }
  }

  /**
   * Type guard. Use in `catch` blocks: `if (isPekuloError(err)) ...`.
   * Plays nicely with `instanceof` across realm boundaries (Bun workers, etc.)
   * by checking the `name` field as a fallback.
   */
  export function isPekuloError(err: unknown): err is PekuloError {
    if (err instanceof PekuloError) return true;
    if (
      typeof err === "object" &&
      err !== null &&
      "name" in err &&
      "code" in err &&
      (err as { name: unknown }).name === "PekuloError"
    ) {
      return true;
    }
    return false;
  }
  ```

  Create `apps/api/src/common/errors/index.ts`:
  ```ts
  // apps/api/src/common/errors/index.ts
  // Barrel re-export for common/errors/*. Module factories import from here.

  export { PekuloError, isPekuloError } from "./pekulo-error";
  export type { PekuloErrorCode } from "./pekulo-error";
  ```

  Run: `bun --cwd apps/api run typecheck`
  Expected: exit 0, no output.
  Commit: `git add apps/api/src/common/errors/pekulo-error.ts apps/api/src/common/errors/index.ts && git commit -m "feat(#5): introduce PekuloError base class + isPekuloError guard"`

- [ ] **Task 8 — Create `error-mapper.ts` + `error-mapper.test.ts`** [AC: AC-3]

  Create `apps/api/src/platform/http/error-mapper.ts`:
  ```ts
  // apps/api/src/platform/http/error-mapper.ts
  // Pure mapper: unknown thrown value → oRPC-shaped { status, body }.
  // Consumed by Elysia's .onError(...) in src/app.ts and by the orpc-mount
  // fall-through path. Pure: no I/O, no logger — logging happens at the
  // call site so test fakes can capture it.

  import { isPekuloError, type PekuloError, type PekuloErrorCode } from "../../common/errors";

  export interface OrpcErrorBody {
    error: {
      code: string;
      message: string;
      requestId?: string;
    };
  }

  export interface MappedErrorResponse {
    status: number;
    body: OrpcErrorBody;
  }

  /**
   * Stable `code → HTTP status` lookup. Mirrors typical RPC conventions.
   * UNAUTHORIZED → 401, FORBIDDEN → 403, NOT_FOUND → 404, BAD_REQUEST → 400,
   * CONFLICT → 409, RATE_LIMITED → 429, INTERNAL → 500.
   */
  export const ORPC_HTTP_STATUS_BY_CODE: Record<PekuloErrorCode, number> = {
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    RATE_LIMITED: 429,
    INTERNAL: 500,
  };

  /**
   * Map any thrown value to an oRPC-shaped response.
   * - `PekuloError`: status from the lookup, body carries the error's `code` + `message`.
   * - native `Error`: status 500, message sanitised, body carries `code: "INTERNAL"` + a fresh requestId.
   * - non-Error: status 500, message stringified safely, body carries `code: "INTERNAL"` + a fresh requestId.
   */
  export function mapErrorToOrpcResponse(err: unknown): MappedErrorResponse {
    if (isPekuloError(err)) {
      const pekulo = err as PekuloError;
      return {
        status: ORPC_HTTP_STATUS_BY_CODE[pekulo.code],
        body: {
          error: {
            code: pekulo.code,
            message: pekulo.message,
          },
        },
      };
    }
    // Fallback path — sanitise the message, attach a requestId for forensic
    // cross-reference. Once apps/api/src/common/ids/request-id.ts ships in a
    // future story, swap `crypto.randomUUID()` for the project helper.
    const requestId = crypto.randomUUID();
    return {
      status: 500,
      body: {
        error: {
          code: "INTERNAL",
          message: "internal server error",
          requestId,
        },
      },
    };
  }
  ```

  Create `apps/api/src/platform/http/error-mapper.test.ts`:
  ```ts
  // apps/api/src/platform/http/error-mapper.test.ts
  // Covers AC-3: PekuloError → 4xx, native Error → 500 sanitised, non-Error throw → 500.

  import { describe, expect, test } from "bun:test";

  import { PekuloError } from "../../common/errors";
  import { mapErrorToOrpcResponse } from "./error-mapper";

  describe("mapErrorToOrpcResponse", () => {
    test("PekuloError UNAUTHORIZED → 401 with code+message preserved", () => {
      const result = mapErrorToOrpcResponse(new PekuloError("UNAUTHORIZED", "no session"));
      expect(result.status).toBe(401);
      expect(result.body.error.code).toBe("UNAUTHORIZED");
      expect(result.body.error.message).toBe("no session");
      expect(result.body.error.requestId).toBeUndefined();
    });

    test("PekuloError NOT_FOUND → 404 with code+message preserved", () => {
      const result = mapErrorToOrpcResponse(new PekuloError("NOT_FOUND", "compass not found"));
      expect(result.status).toBe(404);
      expect(result.body.error.code).toBe("NOT_FOUND");
      expect(result.body.error.message).toBe("compass not found");
    });

    test("native Error → 500 with sanitised message + requestId", () => {
      const result = mapErrorToOrpcResponse(new Error("boom"));
      expect(result.status).toBe(500);
      expect(result.body.error.code).toBe("INTERNAL");
      expect(result.body.error.message).toBe("internal server error");
      expect(result.body.error.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    test("non-Error throw (string) → 500 with sanitised message + requestId", () => {
      const result = mapErrorToOrpcResponse("oops");
      expect(result.status).toBe(500);
      expect(result.body.error.code).toBe("INTERNAL");
      expect(result.body.error.message).toBe("internal server error");
      expect(result.body.error.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });
  });
  ```

  Run: `bun --cwd apps/api test src/platform/http/error-mapper.test.ts`
  Expected: `4 pass`, `0 fail`, exit 0.
  Commit: `git add apps/api/src/platform/http/error-mapper.ts apps/api/src/platform/http/error-mapper.test.ts && git commit -m "feat(#5): add error-mapper + bun:test coverage (scaffolds app.ts:16 closure)"`

- [ ] **Task 9 — Create `orpc-mount.ts`** [AC: AC-4]

  Create `apps/api/src/platform/http/orpc-mount.ts`:
  ```ts
  // apps/api/src/platform/http/orpc-mount.ts
  // Mount the oRPC fetch handler at /rpc/v1/* on an Elysia app.
  // The router is empty for the scaffold — every request falls through to
  // matched=false and the global Elysia .onError(...) shapes the 404.
  // Feature stories progressively replace `pekuloRouter` with handlers via
  // `os.contract(<moduleContract>).router({ ... })`.

  import type { AnyElysia } from "elysia";
  import { RPCHandler } from "@orpc/server/fetch";

  /**
   * Empty router for the scaffold. Replaced sub-tree by sub-tree as feature
   * stories land their handlers. Typed as Record<string, unknown> on purpose:
   * RPCHandler accepts any router-shaped object, and the empty-object {} would
   * narrow too aggressively for downstream `Object.assign`-style additions.
   */
  const pekuloRouter: Record<string, unknown> = {};

  /**
   * Build the oRPC RPCHandler ONCE per process. The handler is stateless and
   * shared across requests — RPCHandler internally maps the URL path to the
   * router tree key, regardless of how many concurrent requests are in flight.
   */
  const handler = new RPCHandler(pekuloRouter);

  /**
   * Mount /rpc/v1/* on the provided Elysia app and return the app for chaining.
   *
   * L2 enforcement: `app: AnyElysia` (no bare `Elysia`), return type INFERRED
   * (no annotation). The chain Elysia produces from `.all(...)` carries the
   * route generic and would be rejected by a bare `Elysia` parameter type.
   */
  export function mountOrpc(app: AnyElysia) {
    return app.all("/rpc/v1/*", async ({ request }) => {
      const { matched, response } = await handler.handle(request, {
        prefix: "/rpc/v1",
        context: {},
      });
      if (!matched || response === undefined) {
        // No procedure matched — throw a typed NOT_FOUND so the global
        // Elysia .onError(...) shapes a uniform 404 body via the error-mapper.
        // This is what AC-4 is verifying.
        throw new (await import("../../common/errors")).PekuloError(
          "NOT_FOUND",
          `no oRPC procedure matched ${new URL(request.url).pathname}`,
        );
      }
      return response;
    });
  }
  ```

  > **Why the dynamic `await import(...)`** instead of a top-level static import? The static import works fine and is preferred. Use it:
  > ```ts
  > import { PekuloError } from "../../common/errors";
  > // ...
  > throw new PekuloError("NOT_FOUND", `no oRPC procedure matched ${new URL(request.url).pathname}`);
  > ```
  > Replace the dynamic-import block above with the static import on the dev's first read of the file. The dynamic form is shown here only to make the dependency relationship visually explicit in this story; it adds no value at compile/runtime.

  Run: `bun --cwd apps/api run typecheck`
  Expected: exit 0, no output. **Pre-commit gate (L2 enforcement):** `grep -nE ': Elysia\\b' apps/api/src/platform/http/orpc-mount.ts` MUST return zero matches.
  Commit: `git add apps/api/src/platform/http/orpc-mount.ts && git commit -m "feat(#5): mount oRPC RPCHandler at /rpc/v1/* (empty router for scaffold)"`

- [ ] **Task 10 — Modify `app.ts` to use error-mapper + mountOrpc** [AC: AC-3, AC-4]

  Replace `apps/api/src/app.ts` entirely with:
  ```ts
  import { Elysia } from "elysia";
  import { loadEnv } from "./config/env";
  import { createRuntimeDependencies } from "./bootstrap/runtime-dependencies";
  import { registerLifecycle } from "./bootstrap/lifecycle";
  import { createHealthModule } from "./modules/health/health.module";
  import { mapErrorToOrpcResponse } from "./platform/http/error-mapper";
  import { mountOrpc } from "./platform/http/orpc-mount";

  export interface ServerHandle {
    stop: () => Promise<void>;
  }

  export async function startServer(): Promise<ServerHandle> {
    const env = loadEnv();
    const deps = await createRuntimeDependencies({ env });
    const healthModule = createHealthModule({ readiness: deps.readiness });

    // L2 — let Elysia infer the chained type. Do NOT annotate `const app: Elysia = ...`.
    const app = new Elysia()
      .onError(({ error, set }) => {
        console.error("[api] error", error);
        const mapped = mapErrorToOrpcResponse(error);
        set.status = mapped.status;
        return mapped.body;
      })
      .use(healthModule.router);

    mountOrpc(app);

    await registerLifecycle(
      app,
      { shutdownTimeoutMs: env.SHUTDOWN_TIMEOUT_MS },
      { prismaService: deps.prismaService },
    );

    app.listen({ port: env.PORT, hostname: env.HOST }, (server) => {
      console.log(`[api] listening on http://${server.hostname}:${server.port}`);
    });

    return {
      stop: async () => {
        await app.stop();
      },
    };
  }
  ```

  > **Note.** `mountOrpc(app)` is called for its side effect (registering the `/rpc/v1/*` route on the chained Elysia instance). The return value is discarded. The chain `app.all(...)` mutates the underlying Elysia builder — the same `app` reference picks up the new route. This is the existing pattern for how `healthModule.router` is wired via `.use(...)`.

  Run:
  ```bash
  bun --cwd apps/api run typecheck
  grep -nE ': Elysia\b' apps/api/src/app.ts
  ```
  Expected: typecheck exit 0, no output. The grep MUST return zero matches.
  Commit: `git add apps/api/src/app.ts && git commit -m "feat(#5): wire app.ts to error-mapper + mountOrpc (closes story-0-3 marker)"`

- [ ] **Task 11 — Smoke run + curl `/rpc/v1/*` (AC-4 manual verification)** [AC: AC-4]

  Boot the api in the background, hit four `/rpc/v1/<module>/noop` endpoints, expect uniform 404 + structured error body.

  Run:
  ```bash
  bun --cwd apps/api run dev > /tmp/orpc-smoke-server.log 2>&1 &
  SERVER_PID=$!
  # Wait for the listen line; the project standard is 3001.
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if grep -q "listening on" /tmp/orpc-smoke-server.log; then break; fi
    sleep 0.5
  done

  for module in compass auth llm holdings; do
    echo "--- /rpc/v1/$module/noop ---"
    curl -sS -o /tmp/orpc-smoke-$module.json -w "status=%{http_code}\n" \
      -X POST -H "Content-Type: application/json" -d '{}' \
      "http://127.0.0.1:3001/rpc/v1/$module/noop"
    cat /tmp/orpc-smoke-$module.json
    echo
  done

  kill $SERVER_PID
  wait $SERVER_PID 2>/dev/null || true
  ```
  Expected output (per module): `status=404`, body parses as JSON containing `"error":{"code":"NOT_FOUND","message":"no oRPC procedure matched /rpc/v1/<module>/noop","requestId":"<uuid-v7>"}`. The `requestId` field varies per request — its presence is what's checked, not its value.

  No commit (verification step).

- [ ] **Task 12 — Add `@pekulo/contracts` + `@orpc/client` to `apps/web`** [AC: AC-1]

  Add the workspace contract dep + oRPC client + the shared contract types to `apps/web`. `@orpc/contract` is also added because `apps/web/src/lib/orpc/types.ts` re-exports type helpers from it directly (the alternative is a transitive resolution which works at runtime but trips strict TS in some configurations).

  Run from repo root:
  ```bash
  bun add @pekulo/contracts@workspace:* --cwd apps/web
  bun add --exact @orpc/client @orpc/contract --cwd apps/web
  bun install
  ```

  Verify `apps/web/package.json` `dependencies` block now contains:
  ```json
  "@orpc/client": "<exact-version>",
  "@orpc/contract": "<exact-version>",
  "@pekulo/contracts": "workspace:*",
  ```
  (interleaved alphabetically with the existing entries — keep the file's existing alphabetical order intact).

  Run: `bun --cwd apps/web run typecheck`
  Expected: exit 0 (no source changes yet — just deps).
  Commit: `git add apps/web/package.json bun.lock && git commit -m "chore(#5): add @pekulo/contracts + @orpc/client to apps/web"`

- [ ] **Task 13 — Create `apps/web/src/lib/orpc/{client,modules,types}.ts`** [AC: AC-1]

  First, create the directory:
  ```bash
  mkdir -p apps/web/src/lib/orpc
  ```

  Create `apps/web/src/lib/orpc/client.ts`:
  ```ts
  // apps/web/src/lib/orpc/client.ts
  // Server-only oRPC HTTP link to apps/api. Used by every typed module client
  // in `modules.ts`. Auth header forwarding lands in story 0-6 (zapaction-orpc-bridge).

  import "server-only";

  import { RPCLink } from "@orpc/client/fetch";

  /**
   * Resolve the apps/api base URL at module-load time. We allow `API_BASE_URL`
   * to be undefined in dev (bun --hot reloads will respect a later env push)
   * but throw at first request if missing. Future story 0-8 (CI/CD) wires
   * VERCEL_ENV-aware defaults; story 0-7 (OTel) adds tracing headers here.
   */
  const apiBaseUrl = process.env.API_BASE_URL;

  function requireApiBaseUrl(): string {
    if (!apiBaseUrl || apiBaseUrl.trim().length === 0) {
      throw new Error(
        "API_BASE_URL is not set. Configure it in .env / .env.local " +
          "(local dev default: http://127.0.0.1:3001).",
      );
    }
    return apiBaseUrl;
  }

  export const orpcLink = new RPCLink({
    url: () => `${requireApiBaseUrl()}/rpc/v1`,
    // headers: () => ({}) — auth header forwarding wired in story 0-6.
  });
  ```

  Create `apps/web/src/lib/orpc/modules.ts`:
  ```ts
  // apps/web/src/lib/orpc/modules.ts
  // Per-module typed oRPC clients. Each module's client infers its full
  // request/response surface from the corresponding contract in @pekulo/contracts.
  // Server actions in apps/web (added story by story) call e.g.
  // `accountsClient.list({ ... })` and propagate the typed response.

  import "server-only";

  import { createORPCClient } from "@orpc/client";
  import type { ContractRouterClient } from "@orpc/contract";
  import {
    authContract,
    compassContract,
    milestonesContract,
    accountsContract,
    holdingsContract,
    realestateContract,
    transactionsContract,
    monthlyContract,
    dashboardContract,
    settingsContract,
    hypothesisContract,
    llmContract,
  } from "@pekulo/contracts";

  import { orpcLink } from "./client";

  export const authClient: ContractRouterClient<typeof authContract> = createORPCClient(orpcLink);
  export const compassClient: ContractRouterClient<typeof compassContract> = createORPCClient(orpcLink);
  export const milestonesClient: ContractRouterClient<typeof milestonesContract> = createORPCClient(orpcLink);
  export const accountsClient: ContractRouterClient<typeof accountsContract> = createORPCClient(orpcLink);
  export const holdingsClient: ContractRouterClient<typeof holdingsContract> = createORPCClient(orpcLink);
  export const realestateClient: ContractRouterClient<typeof realestateContract> = createORPCClient(orpcLink);
  export const transactionsClient: ContractRouterClient<typeof transactionsContract> = createORPCClient(orpcLink);
  export const monthlyClient: ContractRouterClient<typeof monthlyContract> = createORPCClient(orpcLink);
  export const dashboardClient: ContractRouterClient<typeof dashboardContract> = createORPCClient(orpcLink);
  export const settingsClient: ContractRouterClient<typeof settingsContract> = createORPCClient(orpcLink);
  export const hypothesisClient: ContractRouterClient<typeof hypothesisContract> = createORPCClient(orpcLink);
  export const llmClient: ContractRouterClient<typeof llmContract> = createORPCClient(orpcLink);
  ```

  Create `apps/web/src/lib/orpc/types.ts`:
  ```ts
  // apps/web/src/lib/orpc/types.ts
  // Re-export oRPC type helpers so feature stories can `import type { … } from "@/lib/orpc/types"`
  // without reaching into @orpc/contract directly.

  export type {
    ContractRouterClient,
    InferContractRouterInputs,
    InferContractRouterOutputs,
  } from "@orpc/contract";
  ```

  Run: `bun --cwd apps/web run typecheck`
  Expected: exit 0, no output. The 12 client exports infer their full types from the contracts.
  Commit: `git add apps/web/src/lib/orpc/client.ts apps/web/src/lib/orpc/modules.ts apps/web/src/lib/orpc/types.ts && git commit -m "feat(#5): scaffold apps/web oRPC client + 12 typed module clients"`

- [ ] **Task 14 — Update root `.env.example`** [AC: AC-1, AC-4]

  Read `.env.example` first:
  ```bash
  cat .env.example
  ```

  Append (or insert in a logical place — preserve the existing structure) the new line:
  ```
  # apps/api base URL — consumed by apps/web's oRPC link (server-side only, never NEXT_PUBLIC_*).
  # Local dev default matches apps/api's PORT=3001 from src/config/env.ts.
  API_BASE_URL=http://127.0.0.1:3001
  ```

  Run: `grep "^API_BASE_URL=" .env.example`
  Expected: one match — `API_BASE_URL=http://127.0.0.1:3001`.
  Commit: `git add .env.example && git commit -m "docs(#5): document API_BASE_URL in .env.example for apps/web oRPC link"`

- [ ] **Task 15 — Final cross-workspace verification (AC-1 + AC-2 + AC-3 + AC-4 ⇒ green)** [AC: AC-1, AC-2, AC-3, AC-4]

  Pure verification — runs every gate this story has produced + the L2 grep guard. No edits.

  Run from repo root:
  ```bash
  # Per-workspace typecheck.
  bun --cwd packages/contracts run typecheck
  bun --cwd apps/api run typecheck
  bun --cwd apps/web run typecheck

  # Targeted unit test (AC-3).
  bun --cwd apps/api test src/platform/http/error-mapper.test.ts

  # Repo-level lint + format check (must stay green).
  bun run lint
  bun run format:check

  # L2 enforcement guard — bare `: Elysia` annotation must not exist anywhere
  # under apps/api/src/. Matches on `AnyElysia` are explicitly excluded.
  ! grep -RnE ': Elysia\b' apps/api/src --include='*.ts' | grep -v 'AnyElysia'
  ```
  Expected:
  - All three `tsc --noEmit` calls exit 0.
  - `bun test` reports `4 pass`, exit 0.
  - `bun run lint` exit 0.
  - `bun run format:check` exit 0.
  - The final `! grep -v` line returns success — meaning the inner `grep` produced no output (no bare `: Elysia` left in apps/api/src).

  No commit (verification step).

- [ ] **Task 16 — Push branch + open PR** [AC: AC-1, AC-2, AC-3, AC-4]

  Push the branch upstream and open a PR linking ticket #5.

  Run:
  ```bash
  git push -u origin feat/0-5-orpc-contracts-scaffold
  gh pr create --base main --title "feat(#5): 0-5 oRPC contracts scaffold + apps/web client + Elysia error-mapper" --body "$(cat <<'EOF'
  ## Summary
  - Scaffolds `@pekulo/contracts` with 12 module contract skeletons (auth, compass, milestones, accounts, holdings, realestate, transactions, monthly, dashboard, settings, hypothesis, llm) and a top-level `pekuloContract` aggregator (ADR-0009, ADR-0011).
  - Documents sub-tree versioning at `packages/contracts/VERSIONING.md` and exemplifies v1/v2 coexistence in a typecheck-only fixture (AC-2).
  - Introduces `PekuloError` + `mapErrorToOrpcResponse` and mounts `RPCHandler` at `/rpc/v1/*` on Elysia, closing the `app.ts:16` deferred-work marker from story 0-3 (AC-3, AC-4).
  - Wires `apps/web/src/lib/orpc/{client,modules,types}.ts` with 12 typed clients inferring their shape from the contracts (AC-1).

  ## Test plan
  - [x] `bun --cwd packages/contracts run typecheck` — exit 0
  - [x] `bun --cwd apps/api run typecheck` — exit 0
  - [x] `bun --cwd apps/web run typecheck` — exit 0
  - [x] `bun --cwd apps/api test src/platform/http/error-mapper.test.ts` — 4 pass, exit 0
  - [x] `curl -sS -X POST http://127.0.0.1:3001/rpc/v1/<any>/noop` returns 404 with `{ error: { code: "NOT_FOUND", ... } }` for compass / auth / llm / holdings
  - [x] `bun run lint && bun run format:check` — exit 0
  - [x] `grep -RnE ': Elysia\b' apps/api/src --include='*.ts' | grep -v AnyElysia` returns no matches (L2 enforcement)

  Closes #5
  EOF
  )"
  ```
  Expected: PR URL printed.

  > **Confirm with the user before pushing.** Pushing creates a public-history artefact. The dev agent should HALT and ask Alex unless the project's autonomy mode explicitly permits unsupervised pushes.

  No commit (push + PR creation).

---

## File List

### Created
- `packages/contracts/src/auth.contract.ts`
- `packages/contracts/src/compass.contract.ts`
- `packages/contracts/src/milestones.contract.ts`
- `packages/contracts/src/accounts.contract.ts`
- `packages/contracts/src/holdings.contract.ts`
- `packages/contracts/src/realestate.contract.ts`
- `packages/contracts/src/transactions.contract.ts`
- `packages/contracts/src/monthly.contract.ts`
- `packages/contracts/src/dashboard.contract.ts`
- `packages/contracts/src/settings.contract.ts`
- `packages/contracts/src/hypothesis.contract.ts`
- `packages/contracts/src/llm.contract.ts`
- `packages/contracts/src/__tests__/version-coexistence.fixture.ts`
- `packages/contracts/VERSIONING.md`
- `apps/api/src/common/errors/pekulo-error.ts`
- `apps/api/src/common/errors/index.ts`
- `apps/api/src/platform/http/error-mapper.ts`
- `apps/api/src/platform/http/error-mapper.test.ts`
- `apps/api/src/platform/http/orpc-mount.ts`
- `apps/web/src/lib/orpc/client.ts`
- `apps/web/src/lib/orpc/modules.ts`
- `apps/web/src/lib/orpc/types.ts`

### Modified
- `packages/contracts/package.json` (Task 1 — add `@orpc/contract`, refresh description)
- `packages/contracts/src/index.ts` (Task 3 — replace placeholder with aggregate barrel)
- `apps/api/package.json` (Task 6 — add `@pekulo/contracts` + `@orpc/server`)
- `apps/api/src/app.ts` (Task 10 — replace inline onError, call mountOrpc, drop the deferred-work comment)
- `apps/web/package.json` (Task 12 — add `@pekulo/contracts` + `@orpc/client` + `@orpc/contract`)
- `.env.example` (Task 14 — add `API_BASE_URL`)
- `bun.lock` (transitive, written by `bun install` in Tasks 1, 6, 12)

---

## Dev Agent Record

- **Model:**
- **Started:**
- **Completed:**

### Debug Log

### Completion Notes

### File List
