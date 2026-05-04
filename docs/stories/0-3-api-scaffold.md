# Story: 0-3-api-scaffold — Scaffold `apps/api` on Bun + Elysia

**Epic:** Epic 0 — Foundations (package layout, tooling, runtime substrate)
**Status:** ready-for-dev
**Ticket:** [#3](https://github.com/yabafre/pekulo/issues/3)
**Branch:** `feat/0-3-api-scaffold`
**Commit prefix:** `feat(#3): ...` (or `chore(#3):` / `fix(#3):` per task type)
**Closes:** #3
**Stepscompleted:** 1,2,3,4,5
**Reference ADR:** [ADR-0009 — Domain API on Bun + Elysia + oRPC, web tier keeps zapaction bridge](../adr/0009-elysia-orpc-with-zapaction-bridge.md)

---

## User Story

**As a** Pekulo developer, **I want** an `apps/api` Bun + Elysia entrypoint with the `bootstrap/platform/database/common` skeletons mandated by ADR-0009, a working `health` module exposing `/health` + `/ready`, and a Dokploy-friendly Dockerfile, **so that** every domain module from epics 1–8 (Prisma in 0-4, oRPC contracts in 0-5, zapaction bridge in 0-6, OTel in 0-7, etc.) has a runtime to attach to without re-litigating bootstrap shape, env validation, or container wiring.

---

## Acceptance Criteria

- **AC-1 (dev mode + /health):** **Given** the scaffold, **When** I run `(cd apps/api && bun run dev)` from the repo root and `curl -fsS http://127.0.0.1:3001/health`, **Then** the server binds to `127.0.0.1:3001` within 3 s and `curl` returns HTTP 200 with body `{"status":"ok"}`.

- **AC-2 (typecheck via @pekulo/tsconfig):** **Given** `apps/api/tsconfig.json` extends `@pekulo/tsconfig/apps.json`, **When** I run `(cd apps/api && bun run typecheck)`, **Then** `tsc --noEmit` exits 0 and produces no output.

- **AC-3 (skeleton dirs exist per ADR-0009):** **Given** the scaffold, **When** I list `apps/api/src/` recursively, **Then** the directories `bootstrap/`, `platform/`, `database/`, `common/`, `config/`, `modules/health/` all exist; `platform/index.ts`, `database/index.ts`, `common/index.ts` each contain an `export {}` placeholder plus a comment naming the owning downstream story (0-4 / 0-5 / 0-6 / 0-7).

- **AC-4 (Dockerfile builds + container /health 200):** **Given** the Dockerfile, **When** I run `docker build -f apps/api/Dockerfile -t pekulo-api:dev .` from the repo root, then `docker run --rm -d -p 3001:3001 --name pekulo-api-test pekulo-api:dev`, **Then** the container starts within 10 s, `curl -fsS http://127.0.0.1:3001/health` returns HTTP 200 with body `{"status":"ok"}`, and `docker inspect --format='{{.State.Health.Status}}' pekulo-api-test` reports `healthy` within 60 s.

- **AC-5 (Caddy mount documented):** **Given** the architecture's mount layout (architecture.md L229), **When** I open `apps/api/deploy/Caddyfile.snippet`, **Then** it contains a `reverse_proxy` block routing the five paths `/api/*`, `/health`, `/ready`, `/rpc/v1/*`, `/internal/*` to upstream `pekulo-api:3001` — copy-pastable into the Dokploy Caddy config.

> **Note on the ticket's original AC-2 ("Caddy routes /api/*"):** the Caddy mount lives in operator infrastructure (Dokploy), not in this repo. AC-4 + AC-5 together make the original AC verifiable inside the dev's working tree (image runs locally + the snippet is committed). The actual Caddy production wiring is owned by story 0-8 (CI/CD + deploy hooks).

---

## Dev Notes

### Existing code at write time

This story is **greenfield for `apps/api`** — the directory does NOT exist at write time:

```bash
$ ls apps/
prices  web
```

The `packages/*` workspaces (notably `@pekulo/tsconfig`) already exist (story 0-1, status `done`).

### Existing code: root files referenced by this story (NOT modified)

`package.json` (repo root, current — NOT modified by this story; reproduced for reference):

```json
{
  "name": "test",
  "version": "0.0.1",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "dotenv -c -e .env -e .env.local -- turbo run dev",
    "dev:web": "dotenv -c -e .env -e .env.local -- turbo run dev --filter=web",
    "dev:prices": "dotenv -c -e .env -e .env.local -- bash -lc 'cd apps/prices && uvicorn main:app --reload --port 8000'",
    "build": "dotenv -c -e .env -e .env.local -- turbo run build",
    "lint": "oxlint",
    "lint:fix": "oxlint --fix",
    "typecheck": "turbo run typecheck",
    "format": "oxfmt",
    "format:check": "oxfmt --check"
  },
  "devDependencies": {
    "dotenv-cli": "^8.0.0",
    "oxfmt": "0.47.0",
    "oxlint": "1.62.0",
    "turbo": "^2.9.6"
  },
  "packageManager": "bun@1.3.13"
}
```

> The `workspaces` glob already includes `apps/*` — Bun will pick up `apps/api` automatically once its `package.json` exists. **Do NOT modify root `package.json`.** Adding a `dev:api` script is out of scope for this story (will land in 0-8 alongside the CI matrix).

`packages/tsconfig/apps.json` (current — NOT modified, reproduced for the `apps/api/tsconfig.json` extends):

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["esnext"],
    "noEmit": true
  }
}
```

### File decisions (3-bullet template per file)

#### `apps/api/package.json` — new

- **Single responsibility:** Manifest for `@pekulo/api` declaring runtime deps (`elysia`, `zod`), dev deps (`@pekulo/tsconfig`, `@types/bun`, `typescript`), and the four scripts (`dev`, `start`, `typecheck`, `build`).
- **Inputs:** `dependencies: { "elysia": "1.4.4", "zod": "4.3.6" }` ; `devDependencies: { "@pekulo/tsconfig": "workspace:*", "@types/bun": "1.3.0", "typescript": "^5.6.0" }`.
- **Outputs:** registered as `@pekulo/api@workspace:apps/api` ; `bun run dev` invokes `bun --hot src/main.ts` ; `bun run typecheck` invokes `tsc --noEmit`.

#### `apps/api/tsconfig.json` — new

- **Single responsibility:** Local TS config extending `@pekulo/tsconfig/apps.json` and adding Bun-specific types.
- **Inputs:** `extends "@pekulo/tsconfig/apps.json"`.
- **Outputs:** `compilerOptions: { rootDir: "src", types: ["bun-types"] }` ; `include: ["src/**/*.ts"]`.

#### `apps/api/.gitignore` — new

- **Single responsibility:** Per-app gitignore for build artefacts and local secrets.
- **Inputs:** none.
- **Outputs:** ignores `dist/`, `node_modules/`, `.env.local`, `.env.*.local`.

#### `apps/api/src/main.ts` — new

- **Single responsibility:** Process entry — top-level `await startServer()`. Nothing else.
- **Inputs:** imports `startServer` from `./app`.
- **Outputs:** none (side effect: server bound + signal handlers registered).

#### `apps/api/src/app.ts` — new

- **Single responsibility:** Compose Elysia, load env, wire runtime deps, mount the `health` module, register lifecycle hooks, call `app.listen`.
- **Inputs:** imports `Elysia` from `elysia` ; `loadEnv` from `./config/env` ; `createRuntimeDependencies` from `./bootstrap/runtime-dependencies` ; `registerLifecycle` from `./bootstrap/lifecycle` ; `createHealthModule` from `./modules/health/health.module`.
- **Outputs:** exports `startServer(): Promise<{ stop: () => Promise<void> }>`.

#### `apps/api/src/config/env.ts` — new

- **Single responsibility:** Validate the runtime env vars (`NODE_ENV`, `PORT`, `HOST`) via Zod, exit 1 with a printed error on parse failure.
- **Inputs:** imports `z` from `zod` ; reads `process.env` (or an injected source for tests).
- **Outputs:** exports `Env` type + `loadEnv(source?: NodeJS.ProcessEnv): Env`.

#### `apps/api/src/bootstrap/runtime-dependencies.ts` — new

- **Single responsibility:** Composition root — instantiate the `readiness` registry and bundle it with env into a `RuntimeDeps` object passed to module factories.
- **Inputs:** imports `Env` from `../config/env` ; `createReadiness` from `./readiness`.
- **Outputs:** exports `RuntimeDeps` interface + `createRuntimeDependencies(input: { env: Env }): Promise<RuntimeDeps>`.

#### `apps/api/src/bootstrap/readiness.ts` — new

- **Single responsibility:** In-memory probe registry — modules call `register("name", probe)` ; `/ready` calls `check()` to roll up probe states.
- **Inputs:** none.
- **Outputs:** exports `Readiness` interface + `createReadiness(): Readiness`.

#### `apps/api/src/bootstrap/lifecycle.ts` — new

- **Single responsibility:** Register `SIGTERM` + `SIGINT` handlers that call `app.stop()` and exit cleanly.
- **Inputs:** imports `Elysia` type from `elysia` ; `RuntimeDeps` from `./runtime-dependencies`.
- **Outputs:** exports `registerLifecycle(app: Elysia, deps: RuntimeDeps): Promise<void>`.

#### `apps/api/src/modules/health/health.module.ts` — new

- **Single responsibility:** Health module factory — Trafi pattern. Takes deps, returns `{ routes }`.
- **Inputs:** imports `Readiness` from `../../bootstrap/readiness` ; `healthRoutes` from `./health.routes`.
- **Outputs:** exports `HealthModuleDeps` interface + `createHealthModule(deps: HealthModuleDeps): { routes: Elysia }`.

#### `apps/api/src/modules/health/health.routes.ts` — new

- **Single responsibility:** Elysia plugin exposing two public endpoints — `GET /health` (always 200 `{status:"ok"}`) and `GET /ready` (200 if all probes ok, 503 with probe details otherwise).
- **Inputs:** imports `Elysia` from `elysia` ; `HealthModuleDeps` from `./health.module`.
- **Outputs:** exports `healthRoutes(deps: HealthModuleDeps): Elysia`.

#### `apps/api/src/platform/index.ts` — new (placeholder)

- **Single responsibility:** Dir-marker + comment listing the cross-cutting infra subdirs that downstream stories will populate.
- **Inputs:** none.
- **Outputs:** `export {}` ; comments cite stories 0-5 (http/security), 0-6 (zapaction-bridge security helpers), 0-7 (logging/observability).

#### `apps/api/src/database/index.ts` — new (placeholder)

- **Single responsibility:** Dir-marker + comment pointing to story 0-4 (Prisma 7.8 + prefixed-ids + baseline migration).
- **Inputs:** none.
- **Outputs:** `export {}` ; ADR-0012 + ADR-0014 cited.

#### `apps/api/src/common/index.ts` — new (placeholder)

- **Single responsibility:** Dir-marker + comment listing the pure-utility subdirs (errors / time / security-primitives / ids) that ship in 0-4 → 0-7.
- **Inputs:** none.
- **Outputs:** `export {}` ; story owners cited per subdir.

#### `apps/api/Dockerfile` — new

- **Single responsibility:** Build a runnable container image for `apps/api` based on `oven/bun:1.3.13-slim`, install workspace deps, copy source, expose 3001, declare a HEALTHCHECK on `/health`, run `bun src/main.ts`.
- **Inputs:** repo-root build context ; `bun.lock` + `package.json` + `apps/api/**` + `packages/tsconfig/**`.
- **Outputs:** image tagged via `-t pekulo-api:<tag>` ; container HEALTHCHECK transitions `starting` → `healthy` within 60 s on a working build.

#### `apps/api/.dockerignore` — new

- **Single responsibility:** Exclude irrelevant trees from the Docker build context to keep image size + build time down.
- **Inputs:** none.
- **Outputs:** excludes `node_modules`, `.turbo`, `apps/web`, `apps/prices`, `docs/`, `.env*`, `.git`, `**/*.md`.

#### `apps/api/deploy/Caddyfile.snippet` — new

- **Single responsibility:** Operator reference — Caddy `reverse_proxy` block listing the five upstream paths from architecture L229. Pasted by the operator into the Dokploy Caddy config at deploy time.
- **Inputs:** none.
- **Outputs:** Caddy directive routing `/api/*`, `/health`, `/ready`, `/rpc/v1/*`, `/internal/*` to `pekulo-api:3001`.

#### `apps/api/README.md` — new

- **Single responsibility:** One-page scaffold doc — local dev (`(cd apps/api && bun run dev)`), typecheck, build, Docker build/run, Dokploy deploy notes, link to ADR-0009 + Caddyfile snippet.
- **Inputs:** none.
- **Outputs:** rendered on GitHub when the operator opens `apps/api/`.

### Architecture references

- **ADR-0009** (`docs/adr/0009-elysia-orpc-with-zapaction-bridge.md`) — canonical source for `apps/api`'s shape (Bun + Elysia, module factories, `bootstrap/runtime-dependencies.ts` composition root, mount layout `/rpc/v1/*` + Elysia-native `/health` `/ready` `/internal/llm/attest`).
- **Architecture Phase 4 — Directory Tree** (`docs/architecture.md` L421–465 + L764–847) — concrete `apps/api/src/` shape including `bootstrap/`, `platform/{http,logging,audit,security,observability}/`, `database/`, `common/{errors,time,security-primitives,ids}/`, `config/`, `prisma/`, `test/`. **This story creates the four top-level dirs (`bootstrap/`, `platform/`, `database/`, `common/`, `config/`) but only populates `bootstrap/` + `config/` + `modules/health/` with real code; the rest ship as `index.ts` placeholders.**
- **Architecture Phase 2 — API design / Mount layout** (`docs/architecture.md` L157–164) — `/health`, `/ready` are Elysia-native (not behind oRPC). Public, no auth.
- **Architecture Phase 3 — Caddy mount** (`docs/architecture.md` L229) — `Caddy mounts /rpc/v1/*, /health, /ready, /internal/* to apps/api`. Drives `apps/api/deploy/Caddyfile.snippet`.
- **Epic 0 backlog entry** (`docs/epics.md` Story `0-3-api-scaffold`, L174–192) — original AC formulation; expanded here for testability + lesson-driven AC-1 fix.

### Lesson-driven AC fix

The original ticket AC-1 reads: *"When I run `bun --cwd apps/api dev`, Then Elysia binds and `/health` returns 200."* Per **lesson 2026-05-04** (`docs/lessons.md`, scope `aped-arch, aped-story, aped-dev`), the form `bun --cwd <dir> <script>` (where `<script>` resolves to `bun run <script>`) silently dumps `bun run --help` and exits 0 *without* invoking the script under Bun 1.3.13. AC-1 in this story uses the canonical `(cd apps/api && bun run dev)` form, and every Run line in the Tasks below pins the same form. The Dockerfile's `CMD` uses `bun src/main.ts` directly (no `--cwd`), which is the documented Bun pattern for entrypoints.

### TypeScript pinning

`apps/api` devDeps `typescript@^5.6.0` (matches `@pekulo/*` packages from story 0-1). Bun hoists the workspace TS via the lockfile.

### Bun version

Pinned via `bun:1.3.13-slim` base image (matches root `packageManager: "bun@1.3.13"`). The lockfile guards local installs.

### Elysia version

Pinned to `elysia@1.4.4` (exact). The dev MAY bump to a newer 1.4.x release at install time — if so, capture the bumped version in the Dev Agent Record and confirm `bun run dev` + `bun run typecheck` still pass before commit.

### Out of scope (explicit non-goals — do NOT do these in this story)

- ❌ Do NOT install Prisma / `@prisma/adapter-pg` / `@prisma/client`. Owned by **story 0-4**. The `database/` dir ships an empty `index.ts` placeholder.
- ❌ Do NOT install `@orpc/*` or wire any oRPC handler. Owned by **story 0-5**. The `modules/health/` is Elysia-native — do NOT route it through oRPC.
- ❌ Do NOT install `@opentelemetry/*` or initialise an OTel SDK. Owned by **story 0-7**. The `platform/observability/` dir does NOT exist in this story.
- ❌ Do NOT add Elysia plugins for CORS, bearer, or rate-limit. Owned by **story 0-5** (request auth) and **story 0-6** (zapaction bridge auth path). The `platform/http/` dir does NOT exist in this story.
- ❌ Do NOT implement `requireUserContext`, `jwt-verifier`, or any auth helper. Owned by **story 0-5** / **story 0-6**.
- ❌ Do NOT add a `dev:api` script to the root `package.json` or a Turbo `dev --filter=api` invocation. Owned by **story 0-8** (CI/CD).
- ❌ Do NOT modify `apps/web`, `apps/prices`, or any existing file outside `apps/api/`, except `docs/state.yaml` for the bookkeeping flips.
- ❌ Do NOT pin Elysia behind a caret range (e.g. `^1.4.0`); use exact pin per story 0-2's discipline.
- ❌ Do NOT add `import "server-only"` markers — `apps/api` is server-only by definition (Bun process). The marker is a Next.js convention.

---

## Tasks

> Each task is intended to take 3–5 minutes. Run them in order; each ends with a `git add` + `git commit`. The dev agent can interleave reads/checks but must complete each task's commit before moving on. **Per lesson 2026-05-04, every Run line uses `(cd apps/api && bun run <script>)` — never `bun --cwd apps/api <script>`.**

### Task 1 — Create `apps/api/package.json` + `tsconfig.json` + `.gitignore` + stub `src/main.ts` [AC: AC-2, AC-3]

Create the four manifest / config files plus a one-line `main.ts` stub so `bun install` registers the workspace.

**1a. `apps/api/package.json`** (new):

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
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "elysia": "1.4.4",
    "zod": "4.3.6"
  },
  "devDependencies": {
    "@pekulo/tsconfig": "workspace:*",
    "@types/bun": "1.3.0",
    "typescript": "^5.6.0"
  }
}
```

**1b. `apps/api/tsconfig.json`** (new):

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@pekulo/tsconfig/apps.json",
  "compilerOptions": {
    "rootDir": "src",
    "types": ["bun-types"]
  },
  "include": ["src/**/*.ts"]
}
```

**1c. `apps/api/.gitignore`** (new):

```
node_modules/
dist/
.env.local
.env.*.local
```

**1d. `apps/api/src/main.ts`** (new — stub, replaced in Task 5):

```ts
// Stub — replaced in Task 5 with the real entry that calls startServer().
console.log("[api] stub entry — replaced in Task 5");
```

Run: `bun install`
Expected output: contains `+ @pekulo/api@workspace:apps/api` (or equivalent line registering the workspace) ; `bun pm ls 2>&1 | grep '@pekulo/api'` prints at least one match ; exit 0.

Commit:

```bash
git add apps/api/package.json apps/api/tsconfig.json apps/api/.gitignore apps/api/src/main.ts bun.lock
git commit -m "feat(#3): bootstrap @pekulo/api workspace (package.json + tsconfig + stub main)"
```

---

### Task 2 — Create `src/config/env.ts` (Zod env validation) [AC: AC-1, AC-2]

Add the env loader. Bun loads `.env` automatically — the Zod schema validates whatever Bun puts on `process.env`.

**2a. `apps/api/src/config/env.ts`** (new):

```ts
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(3001),
  HOST: z.string().min(1).default("127.0.0.1"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    console.error("[api] invalid env:", JSON.stringify(fieldErrors, null, 2));
    process.exit(1);
  }
  return parsed.data;
}
```

Run: `(cd apps/api && bun run typecheck)`
Expected output: `tsc --noEmit` exits 0 (no output).

Commit:

```bash
git add apps/api/src/config/env.ts
git commit -m "feat(#3): add Zod env validation (NODE_ENV, PORT, HOST)"
```

---

### Task 3 — Create `bootstrap/{readiness,runtime-dependencies,lifecycle}.ts` [AC: AC-1, AC-3]

Create the three composition-root files in one task (small, related).

**3a. `apps/api/src/bootstrap/readiness.ts`** (new):

```ts
export interface ProbeResult {
  ok: boolean;
  reason?: string;
}

export type ReadinessProbe = () => Promise<ProbeResult>;

export interface ReadinessReport {
  ready: boolean;
  probes: Record<string, ProbeResult>;
}

export interface Readiness {
  register(name: string, probe: ReadinessProbe): void;
  check(): Promise<ReadinessReport>;
}

export function createReadiness(): Readiness {
  const probes = new Map<string, ReadinessProbe>();
  return {
    register(name, probe) {
      probes.set(name, probe);
    },
    async check() {
      const results: Record<string, ProbeResult> = {};
      let allOk = true;
      for (const [name, probe] of probes.entries()) {
        const result = await probe();
        results[name] = result;
        if (!result.ok) {
          allOk = false;
        }
      }
      return { ready: allOk, probes: results };
    },
  };
}
```

**3b. `apps/api/src/bootstrap/runtime-dependencies.ts`** (new):

```ts
import type { Env } from "../config/env";
import { createReadiness, type Readiness } from "./readiness";

export interface RuntimeDeps {
  env: Env;
  readiness: Readiness;
}

export async function createRuntimeDependencies(input: { env: Env }): Promise<RuntimeDeps> {
  const readiness = createReadiness();
  return { env: input.env, readiness };
}
```

**3c. `apps/api/src/bootstrap/lifecycle.ts`** (new):

```ts
import type { Elysia } from "elysia";
import type { RuntimeDeps } from "./runtime-dependencies";

export async function registerLifecycle(app: Elysia, _deps: RuntimeDeps): Promise<void> {
  const onShutdown = async (signal: NodeJS.Signals) => {
    console.log(`[api] received ${signal}, shutting down`);
    try {
      await app.stop();
    } catch (err) {
      console.error("[api] error during shutdown:", err);
    } finally {
      process.exit(0);
    }
  };
  process.once("SIGTERM", () => void onShutdown("SIGTERM"));
  process.once("SIGINT", () => void onShutdown("SIGINT"));
}
```

Run: `(cd apps/api && bun run typecheck)`
Expected output: `tsc --noEmit` exits 0 (no output).

Commit:

```bash
git add apps/api/src/bootstrap/readiness.ts apps/api/src/bootstrap/runtime-dependencies.ts apps/api/src/bootstrap/lifecycle.ts
git commit -m "feat(#3): add bootstrap composition root (readiness, runtime-deps, lifecycle)"
```

---

### Task 4 — Create `modules/health/{health.module,health.routes}.ts` [AC: AC-1]

Create the health module factory + Elysia plugin in one task.

**4a. `apps/api/src/modules/health/health.module.ts`** (new):

```ts
import type { Elysia } from "elysia";
import type { Readiness } from "../../bootstrap/readiness";
import { healthRoutes } from "./health.routes";

export interface HealthModuleDeps {
  readiness: Readiness;
}

export interface HealthModule {
  routes: Elysia;
}

export function createHealthModule(deps: HealthModuleDeps): HealthModule {
  return {
    routes: healthRoutes(deps),
  };
}
```

**4b. `apps/api/src/modules/health/health.routes.ts`** (new):

```ts
import { Elysia } from "elysia";
import type { HealthModuleDeps } from "./health.module";

export function healthRoutes(deps: HealthModuleDeps): Elysia {
  return new Elysia({ name: "health" })
    .get("/health", () => ({ status: "ok" }))
    .get("/ready", async ({ set }) => {
      const report = await deps.readiness.check();
      if (!report.ready) {
        set.status = 503;
        return { ready: false, probes: report.probes };
      }
      return { ready: true, probes: report.probes };
    });
}
```

Run: `(cd apps/api && bun run typecheck)`
Expected output: `tsc --noEmit` exits 0 (no output).

Commit:

```bash
git add apps/api/src/modules/health/health.module.ts apps/api/src/modules/health/health.routes.ts
git commit -m "feat(#3): add health module (Elysia-native /health + /ready)"
```

---

### Task 5 — Wire `app.ts` + replace stub `main.ts` [AC: AC-1, AC-2]

Replace the stub entry with the real bootstrap chain.

**5a. `apps/api/src/app.ts`** (new):

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

  const app = new Elysia()
    .onError(({ code, error, set }) => {
      console.error(`[api] error code=${String(code)}`, error);
      if (set.status === undefined || set.status === 200) {
        set.status = 500;
      }
      return {
        error: {
          code: String(code),
          message: error instanceof Error ? error.message : String(error),
        },
      };
    })
    .use(healthModule.routes);

  await registerLifecycle(app, deps);

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

**5b. `apps/api/src/main.ts`** (REPLACE the Task 1 stub with the real entry):

```ts
import { startServer } from "./app";

await startServer();
```

Run: `(cd apps/api && bun run typecheck)`
Expected output: `tsc --noEmit` exits 0 (no output).

Commit:

```bash
git add apps/api/src/app.ts apps/api/src/main.ts
git commit -m "feat(#3): wire Elysia entry (app.ts + main.ts top-level await)"
```

---

### Task 6 — Create `platform/`, `database/`, `common/` placeholders [AC: AC-3]

Per ADR-0009 + architecture L421–465, these three top-level dirs must exist on the `apps/api` skeleton even though their real surfaces ship in 0-4 (`database/`), 0-5 (`platform/http`, `platform/security`), 0-6 (zapaction bridge security), 0-7 (`platform/observability`, `platform/logging`). Each carries an `index.ts` documenting which downstream story populates which subdir.

**6a. `apps/api/src/platform/index.ts`** (new):

```ts
// Placeholder for apps/api/src/platform/. Cross-cutting infra modules land here:
//
//   - http/                → request-id, error-mapper, cors, bearer, rate-limit
//                             (story 0-5: oRPC contracts scaffold introduces error-mapper +
//                              request-id ; story 0-6: zapaction bridge introduces bearer
//                              auth ; rate-limit pinned to (b) public ramp.)
//   - security/            → jwt-verifier, requireUserContext, opt-in-guard
//                             (story 0-5: jwt-verifier + requireUserContext ;
//                              story 6-3: opt-in-guard for 3rd-party LLM path.)
//   - logging/             → otel-logger wrapper (story 0-7).
//   - audit/               → masked-userId helpers (story 0-5+).
//   - observability/       → @opentelemetry/sdk-node init (story 0-7).
//
// See ADR-0009 + docs/architecture.md L786-796 for the canonical layout.
export {};
```

**6b. `apps/api/src/database/index.ts`** (new):

```ts
// Placeholder for apps/api/src/database/. Prisma 7.8 + extensions land here in
// story 0-4-prisma-setup:
//
//   - prisma.service.ts             Prisma client + extension chain
//   - prefixed-ids.extension.ts     Trafi pattern (ADR-0012)
//   - id-prefixes.config.ts         Record<ModelName, prefix>
//   - prisma-error-mapper.ts        P2025 → RlsViolationError, etc.
//
// See ADR-0012 (prefixed IDs) + ADR-0014 (Prisma migrate, supersedes ADR-0006).
export {};
```

**6c. `apps/api/src/common/index.ts`** (new):

```ts
// Placeholder for apps/api/src/common/. Pure utilities (no I/O) land here:
//
//   - errors/               PekuloError base + factories (story 0-5: surfaced via
//                            error-mapper alongside oRPC contracts).
//   - time/                 Clock interface + FakeClock (story 0-5: needed by
//                            services that timestamp domain events).
//   - security-primitives/  constant-time compare + mask-email (story 0-5+ as
//                            modules introduce identifier surfaces).
//   - ids/                  random base62 (Trafi 21-char) + UUID v7 request-id
//                            (story 0-4 wires base62 into the prefixed-ids
//                            extension ; request-id wires into platform/http
//                            in story 0-5).
//
// See docs/architecture.md L822-834 for the canonical layout.
export {};
```

Run: `(cd apps/api && bun run typecheck)` ; `ls apps/api/src/`
Expected output:
- `tsc --noEmit` exits 0 (no output).
- `ls apps/api/src/` lists at minimum: `app.ts`, `bootstrap`, `common`, `config`, `database`, `main.ts`, `modules`, `platform`.

Commit:

```bash
git add apps/api/src/platform/index.ts apps/api/src/database/index.ts apps/api/src/common/index.ts
git commit -m "feat(#3): add platform/database/common skeleton placeholders (ADR-0009)"
```

---

### Task 7 — Verify AC-1 + AC-2 locally (dev server + curl + typecheck) [AC: AC-1, AC-2]

End-to-end smoke test of the local dev path. No code changes ; this task captures evidence for the PR body.

**7a. Typecheck (AC-2):**

Run: `(cd apps/api && bun run typecheck)`
Expected output: `tsc --noEmit` exits 0 (no output).

**7b. Dev server smoke (AC-1) — start in background, curl, kill:**

Run (paste as a single shell block — the trap kills the bg server even on curl failure):

```bash
set -euo pipefail
LOG="$(mktemp -t pekulo-api-dev.XXXXXX.log)"
( cd apps/api && bun run dev ) >"$LOG" 2>&1 &
PID=$!
trap "kill $PID 2>/dev/null || true; rm -f $LOG" EXIT

# Wait up to 5 s for the server to bind.
for i in $(seq 1 50); do
  if curl -fsS http://127.0.0.1:3001/health >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done

echo "=== /health response ==="
curl -fsS -i http://127.0.0.1:3001/health
echo
echo "=== /ready response ==="
curl -fsS -i http://127.0.0.1:3001/ready
echo
echo "=== server log (head) ==="
head -n 5 "$LOG"
```

Expected output (key lines, in order):

```
=== /health response ===
HTTP/1.1 200 OK
...
{"status":"ok"}
=== /ready response ===
HTTP/1.1 200 OK
...
{"ready":true,"probes":{}}
=== server log (head) ===
[api] listening on http://127.0.0.1:3001
```

> **Note for the dev:** if the curl loop times out, inspect `$LOG` BEFORE the `trap` cleans it up — copy the path printed by `mktemp` and `cat` it manually. The most likely cause is port 3001 already bound (Next dev server is on 3000 normally; check `lsof -i :3001`).

**No file commit for Task 7** — paste the verification block into the PR body as evidence.

---

### Task 8 — Create `Dockerfile` + `.dockerignore` [AC: AC-4]

**8a. `apps/api/Dockerfile`** (new):

```dockerfile
# syntax=docker/dockerfile:1.7
FROM oven/bun:1.3.13-slim

WORKDIR /app

# Install ca-certificates + curl for HEALTHCHECK + outbound TLS to Supabase / Ollama.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# Copy lockfile + manifests first for cache-friendly install.
COPY package.json bun.lock turbo.json ./
COPY packages/tsconfig packages/tsconfig
COPY apps/api/package.json apps/api/

# Install ALL workspace deps (Bun resolves @pekulo/* via workspace:* protocol).
RUN bun install --frozen-lockfile

# Copy app sources.
COPY apps/api/tsconfig.json apps/api/
COPY apps/api/src apps/api/src

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001
EXPOSE 3001

WORKDIR /app/apps/api

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3001/health || exit 1

CMD ["bun", "src/main.ts"]
```

**8b. `apps/api/.dockerignore`** (new):

```
# Per-app .dockerignore. The build context is the repo root (`docker build -f apps/api/Dockerfile .`),
# so this list excludes everything irrelevant to the apps/api image.

.git
.github
.husky
.turbo
.aped
.agents
.claude
.codex
.idea
.vscode

node_modules
**/node_modules
**/.next
**/.turbo
**/dist
**/coverage

apps/web
apps/prices

docs
docs/**
**/*.md

.env
.env.*
!.env.example

bun.build.log
*.log
```

Run: `docker version`
Expected output: server engine version printed (any 24.x or 25.x acceptable). If `docker` is not installed locally, mark Task 10 as deferred and flag in Dev Agent Record — Dokploy CI build is the contractual ground truth.

Commit:

```bash
git add apps/api/Dockerfile apps/api/.dockerignore
git commit -m "feat(#3): add Dockerfile + .dockerignore for Dokploy deploy"
```

---

### Task 9 — Create `deploy/Caddyfile.snippet` + `apps/api/README.md` [AC: AC-5]

**9a. `apps/api/deploy/Caddyfile.snippet`** (new):

```
# Caddyfile snippet — operator reference for Dokploy / Caddy reverse proxy.
#
# Architecture mount layout (docs/architecture.md L229):
#   "Caddy mounts /rpc/v1/*, /health, /ready, /internal/* to apps/api."
#
# Replace `pekulo.example.com` with the production domain and `pekulo-api`
# with the upstream container name resolved by the Dokploy network.
# `apps/prices` is reachable only via internal Docker network (no public port)
# and is NOT mounted on Caddy.

pekulo.example.com {
  encode zstd gzip

  # Public health probes (no auth).
  handle /health {
    reverse_proxy pekulo-api:3001
  }
  handle /ready {
    reverse_proxy pekulo-api:3001
  }

  # Domain API surface.
  handle_path /api/* {
    reverse_proxy pekulo-api:3001
  }
  handle /rpc/v1/* {
    reverse_proxy pekulo-api:3001
  }

  # Private listener for iOS FoundationModels attestation (JWT-verified by apps/api).
  handle /internal/* {
    reverse_proxy pekulo-api:3001
  }

  # Everything else falls through to the Vercel-hosted apps/web upstream
  # (configured separately in the Dokploy Caddy parent block).
}
```

**9b. `apps/api/README.md`** (new):

```markdown
# `@pekulo/api` — Pekulo domain API

Bun + Elysia HTTP service. See [ADR-0009](../../docs/adr/0009-elysia-orpc-with-zapaction-bridge.md) for the architectural rationale.

## Status

This package is the **scaffold from story `0-3-api-scaffold`**. Only the `health` module ships routes (`/health`, `/ready`). Domain modules land in subsequent stories:

| Module    | Story  | Status      |
| --------- | ------ | ----------- |
| Prisma    | `0-4`  | scaffolded  |
| oRPC      | `0-5`  | scaffolded  |
| OTel      | `0-7`  | scaffolded  |
| Compass   | `1-1`  | scaffolded  |
| Accounts  | `2-1`  | scaffolded  |
| Holdings  | `3-1`  | scaffolded  |

(See `docs/epics.md` for the full sprint list.)

## Local development

```bash
# From the repo root:
bun install                                # registers @pekulo/api in the workspace
( cd apps/api && bun run dev )             # bun --hot src/main.ts
curl -fsS http://127.0.0.1:3001/health     # → 200 {"status":"ok"}
( cd apps/api && bun run typecheck )       # → tsc --noEmit (exit 0)
```

> ⚠️ Do NOT use `bun --cwd apps/api dev`. Per `docs/lessons.md` (entry 2026-05-04), Bun 1.3.13 silently drops the script invocation when `--cwd` is placed after `run` (or before a script-name shorthand). Use the `( cd apps/api && bun run <script> )` form everywhere.

## Environment variables

Validated via Zod at boot in `src/config/env.ts`:

| Name       | Required | Default       | Notes                         |
| ---------- | -------- | ------------- | ----------------------------- |
| `NODE_ENV` | no       | `development` | one of `development` / `production` / `test` |
| `PORT`     | no       | `3001`        | 1–65535                       |
| `HOST`     | no       | `127.0.0.1`   | bind interface                |

Future stories will extend the schema (Prisma `DATABASE_URL` in 0-4 ; Supabase JWT secret in 0-5 ; OTel endpoint in 0-7).

## Docker

```bash
# Build (from the repo root — context is the workspace root, not apps/api/):
docker build -f apps/api/Dockerfile -t pekulo-api:dev .

# Run:
docker run --rm -d -p 3001:3001 --name pekulo-api-test pekulo-api:dev
curl -fsS http://127.0.0.1:3001/health     # → 200 {"status":"ok"}
docker inspect --format='{{.State.Health.Status}}' pekulo-api-test  # → healthy

# Cleanup:
docker stop pekulo-api-test
```

## Dokploy deploy

Mount `apps/api` behind the existing Caddy reverse proxy. Operator-applied snippet at [`deploy/Caddyfile.snippet`](./deploy/Caddyfile.snippet) — paste into the Dokploy Caddy config and bind upstream to the `pekulo-api` container on port 3001.

Per architecture (Phase 3 — Deployment topology):

- `apps/api` → Dokploy on the existing VPS, behind Caddy.
- `apps/prices` → reachable only via internal Docker network from `apps/api` (no public port).
- `apps/web` → Vercel.

## Skeleton layout

```
apps/api/
├── Dockerfile
├── README.md
├── deploy/Caddyfile.snippet
├── package.json
├── tsconfig.json
└── src/
    ├── main.ts                          (entry, top-level await)
    ├── app.ts                           (Elysia + module mounts)
    ├── bootstrap/
    │   ├── lifecycle.ts                 (SIGTERM/SIGINT graceful stop)
    │   ├── readiness.ts                 (probe registry consumed by /ready)
    │   └── runtime-dependencies.ts      (composition root)
    ├── common/index.ts                  (placeholder — populated 0-4 → 0-7)
    ├── config/env.ts                    (Zod env schema)
    ├── database/index.ts                (placeholder — populated by story 0-4)
    ├── modules/
    │   └── health/                      (Elysia-native /health + /ready)
    └── platform/index.ts                (placeholder — populated 0-5/0-6/0-7)
```
```

Run: `cat apps/api/deploy/Caddyfile.snippet | head -3`
Expected output: first three lines of the Caddyfile snippet.

Commit:

```bash
git add apps/api/deploy/Caddyfile.snippet apps/api/README.md
git commit -m "docs(#3): add Caddyfile snippet + apps/api README"
```

---

### Task 10 — Verify AC-4 (Docker build + container /health + HEALTHCHECK) [AC: AC-4]

End-to-end Docker smoke test. No code changes.

Run (single block ; the trap stops + removes the test container even on failure):

```bash
set -euo pipefail
docker build -f apps/api/Dockerfile -t pekulo-api:dev .
docker run --rm -d -p 3001:3001 --name pekulo-api-test pekulo-api:dev
trap "docker stop pekulo-api-test >/dev/null 2>&1 || true" EXIT

# Wait up to 10 s for the container's process to bind.
for i in $(seq 1 100); do
  if curl -fsS http://127.0.0.1:3001/health >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done

echo "=== /health response ==="
curl -fsS -i http://127.0.0.1:3001/health
echo

echo "=== container HEALTHCHECK status (poll up to 60 s) ==="
for i in $(seq 1 60); do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' pekulo-api-test 2>/dev/null || echo "unknown")
  echo "t+${i}s: $STATUS"
  if [ "$STATUS" = "healthy" ]; then
    break
  fi
  sleep 1
done

echo "=== final HEALTHCHECK status ==="
docker inspect --format='{{.State.Health.Status}}' pekulo-api-test
```

Expected output (key lines):

```
=== /health response ===
HTTP/1.1 200 OK
...
{"status":"ok"}
=== container HEALTHCHECK status (poll up to 60 s) ===
t+1s: starting
...
t+30s: healthy
=== final HEALTHCHECK status ===
healthy
```

> **If Docker is not installed locally:** mark this task as deferred in the Dev Agent Record, capture `docker version` exit ≠ 0, and rely on Dokploy's CI build as the contractual ground truth. Story 0-8 will wire a CI lane that runs this verification on every PR.

**No file commit for Task 10** — paste the verification block into the PR body as evidence.

---

### Task 11 — Final cross-AC capture (no file commit) [AC: AC-1, AC-2, AC-3, AC-4, AC-5]

Run each verification command and confirm the expected output before pasting the consolidated block into the PR description.

**AC-1 (dev mode + /health):** see Task 7 verification block.

**AC-2 (typecheck):**

```bash
( cd apps/api && bun run typecheck )
echo "exit: $?"
```

Expected output:
```
exit: 0
```

**AC-3 (skeleton dirs + placeholders):**

```bash
echo "--- src/ contents ---"
ls -1 apps/api/src/
echo "--- placeholders carry export {} + comments ---"
for f in apps/api/src/platform/index.ts apps/api/src/database/index.ts apps/api/src/common/index.ts; do
  echo "::: $f :::"
  head -n 3 "$f"
  echo "(.....)"
  grep -c '^export {};$' "$f"
done
```

Expected output (key assertions):

```
--- src/ contents ---
app.ts
bootstrap
common
config
database
main.ts
modules
platform
--- placeholders carry export {} + comments ---
::: apps/api/src/platform/index.ts :::
// Placeholder for apps/api/src/platform/. Cross-cutting infra modules land here:
//
//   - http/                → request-id, error-mapper, cors, bearer, rate-limit
(.....)
1
::: apps/api/src/database/index.ts :::
// Placeholder for apps/api/src/database/. Prisma 7.8 + extensions land here in
// story 0-4-prisma-setup:
//
(.....)
1
::: apps/api/src/common/index.ts :::
// Placeholder for apps/api/src/common/. Pure utilities (no I/O) land here:
//
//   - errors/               PekuloError base + factories (story 0-5: surfaced via
(.....)
1
```

**AC-4 (Docker):** see Task 10 verification block.

**AC-5 (Caddyfile):**

```bash
echo "--- Caddyfile.snippet contains the five paths ---"
for path in '/api/' '/rpc/v1/' '/health' '/ready' '/internal/'; do
  if grep -qE "$path" apps/api/deploy/Caddyfile.snippet; then
    echo "OK: $path"
  else
    echo "MISSING: $path"; exit 1
  fi
done
```

Expected output:
```
--- Caddyfile.snippet contains the five paths ---
OK: /api/
OK: /rpc/v1/
OK: /health
OK: /ready
OK: /internal/
```

**No file commit for Task 11** — paste the four verification blocks into the PR description as evidence. If any assertion fails, fix the relevant file and re-run from the failing task (the prior commits stay).

---

## Dev Agent Record

- **Model:** {{model used}}
- **Started:** {{timestamp}}
- **Completed:** {{timestamp}}

### Debug Log

### Completion Notes

### File List
