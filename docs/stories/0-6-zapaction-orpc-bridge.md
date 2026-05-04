# Story: 0-6-zapaction-orpc-bridge — Zapaction ↔ oRPC bridge wiring + first hypothesis port

**Epic:** Epic 0 — Foundations (package layout, tooling, runtime substrate)
**Status:** review-queued
**Ticket:** [#6](https://github.com/yabafre/pekulo/issues/6)
**Branch:** `feat/0-6-zapaction-orpc-bridge`
**Commit prefix:** `feat(#6): ...` (or `chore(#6):` / `fix(#6):` / `test(#6):` per task type)
**Closes:** #6
**Stepscompleted:** 16/16 (T1–T16)
**Reference ADRs:** [ADR-0009 — Domain API on Bun + Elysia + oRPC](../adr/0009-elysia-orpc-with-zapaction-bridge.md), [ADR-0010 — Component → Hook → Server Action orchestration boundary](../adr/0010-hooks-orchestration-boundary.md), [ADR-0013 — Prisma + RLS defense in depth via service-role bypass + explicit user_id guard](../adr/0013-prisma-rls-defense-in-depth.md)
**Lessons enforced:** **L2** (Elysia 1.4 type invariance — every new Elysia surface lets TS infer the chain or uses `AnyElysia` at boundaries; never bare `Elysia`).
**Closes upstream marker:** the deferred-work comment at `apps/api/src/platform/index.ts` lines 6-7 (which claimed `jwt-verifier + requireUserContext` would land in story 0-5) is corrected by Task 4 — those helpers actually land in this story.

---

## User Story

**As a** Pekulo developer, **I want** the zapaction server-action layer to forward the Supabase JWT to `apps/api` over a typed oRPC client, the apps/api side to verify the JWT, and a hypothesis CRUD round-trip to run end-to-end (browser → server action → oRPC client → Elysia handler → service → Prisma), **so that** every brownfield port story (2-1, 3-1, 5-1, 5-4, 7-3) inherits a wired bridge — auth-header forwarding via `AsyncLocalStorage`, JWT verification, structured request log, oRPC error mapping, RLS-by-userId guard at the service layer — and only writes domain logic. The hypothesis module is the smallest brownfield surface (singleton row per user, two operations: get + save) and is the validation target before fan-out.

---

## Acceptance Criteria

- **AC-1 (oRPC bridge round-trip with auth header forwarding + structured log line):** **Given** the bridge is wired (`AsyncLocalStorage` request-context store on web; `requireUserContext` + structured log middleware on api), **When** the server action `saveHypotheses(input)` runs from a logged-in browser session and `apps/api` is started in the foreground, **Then** apps/api emits exactly one stdout line per request whose JSON parse equals `{ "event": "rpc.request", "requestId": "<uuid-v4>", "route": "hypothesis.save", "userId": "<supabase-uuid>", "durationMs": <number-non-negative>, "status": 200 }` (no other field, no other log line for that request — `error.code` is appended only when `status >= 400`). 0-7 (OTel three runtimes) will swap `console.log` for an OTel span without touching this contract. Verified by the deterministic smoke in Task 16: `bun apps/api/scripts/dev-token.ts <userId>` mints a synthetic JWT with `SUPABASE_JWT_SECRET`, `curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{...26-field-payload}' http://127.0.0.1:3001/rpc/v1/hypothesis/save` returns 200 + a JSON body, and `apps/api`'s captured stdout contains exactly one matching log line.

- **AC-2 (brownfield call site renders unchanged after refactor):** **Given** the action refactor of `apps/web/src/lib/actions/hypotheses.ts` (drops every `ctx.supabase.from("hypotheses")` call, delegates to `hypothesisClient.get()` / `hypothesisClient.save(input)`) and the matching read-path refactor of `apps/web/src/lib/data/hypotheses.ts` (drops direct supabase, calls `hypothesisClient.get()` while preserving the `{ hypotheses, source, error? }` outer return shape), **When** the page `/dashboard/parametres` loads under `bun --cwd apps/web dev` with a logged-in browser session, **Then** the hypothesis form renders the same field values as the brownfield baseline (sentinel checks: `salaireNet`, `loyer`, `objectif` form inputs all populated with the row's values), submitting the form with `objectif` bumped by `+1` triggers `useActionMutation(saveHypotheses)`, the new value persists (a page reload re-displays it), and no console error fires in either tier. Verified by manual smoke (Task 16 runs the dev servers + screenshot diff via the user's eye against the brownfield baseline).

- **AC-3 (missing/invalid token returns oRPC-shaped 401):** **Given** the JWT verifier is wired into `mountOrpc` and `requireUserContext` is the single chokepoint that translates `Headers → { userId, email }` or throws `PekuloError("UNAUTHORIZED", ...)`, **When** any of these four curls hit `http://127.0.0.1:3001/rpc/v1/hypothesis/get` against a started apps/api process: (a) no `Authorization` header; (b) `Authorization: not-a-bearer`; (c) `Authorization: Bearer eyInvalid` (truncated/garbled JWT); (d) `Authorization: Bearer <token signed with wrong secret>`, **Then** every response is HTTP 401 with body `{"error":{"code":"UNAUTHORIZED","message":<string>,"requestId":"<uuid-v4>"}}` (the requestId is a UUID v4, generated once per request by the global `.onError` per ADR-0009, so logs and the wire body share the same handle). Verified by 4 `bun:test` cases on `apps/api/src/platform/security/require-user-context.test.ts` covering each branch and one end-to-end curl smoke per branch in Task 16.

- **AC-4 (hypothesis CRUD round-trip persists with `where: { userId }` ADR-0013 guard):** **Given** the hypothesis service wired against the existing Prisma `Hypothesis` model (`@@map("hypotheses")`), **When** the round-trip `saveHypotheses(input) → handler → service.save(userId, input) → prisma.hypothesis.upsert(...)` runs, **Then** the upsert clause is exactly `{ where: { userId }, update: <camelToDb(input)>, create: { userId, ...camelToDb(input) } }` (so even with the service-role bypass, the explicit `userId` predicate is the belt + suspenders ADR-0013 demands), and the matching `getHypotheses() → handler → service.get(userId) → prisma.hypothesis.findUnique({ where: { userId } })` returns the persisted row in camelCase identical to `defaultHypotheses` shape (when the row is missing, the service returns `defaultHypotheses` rather than null — preserves brownfield contract). Verified by 3 `bun:test` cases on `apps/api/src/modules/hypothesis/hypothesis.service.test.ts` (stubbed Prisma client): (i) `service.get(userId)` returns `defaultHypotheses` when `findUnique` resolves to `null`, (ii) `service.get(userId)` maps a present row to camelCase exactly matching the brownfield `dbToCamel` helper from `apps/web/src/lib/actions/hypotheses.ts` line 12, (iii) `service.save(userId, input)` calls `upsert` exactly once with the spec'd `where`/`update`/`create` clauses (`expect(stub.upsert).toHaveBeenCalledWith({ where: { userId }, update: { salaire_net: ... }, create: { userId, salaire_net: ... } })`).

---

## Dev Notes

### Existing code at write time

This story modifies eight existing files and creates seventeen new files. The eight existing files are quoted verbatim below so the dev's mental model matches the on-disk reality before any edit. **Do not paraphrase or "improve" the quoted code outside the explicit task instructions** — every byte preserved means one fewer RED cycle for the dev agent.

#### `apps/api/src/config/env.ts` (current — modified by Task 1)

<!-- aped-lint-disable -->
```ts
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(3001),
  HOST: z.string().min(1).default("127.0.0.1"),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().max(60_000).default(10_000),
  DATABASE_URL: z.string().url(),
});

export type Env = z.infer<typeof envSchema>;

export class ConfigError extends Error {
  override readonly name = "ConfigError";
  readonly fieldErrors: Record<string, string[] | undefined>;
  constructor(fieldErrors: Record<string, string[] | undefined>) {
    super(`invalid env: ${JSON.stringify(fieldErrors)}`);
    this.fieldErrors = fieldErrors;
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new ConfigError(parsed.error.flatten().fieldErrors);
  }
  return parsed.data;
}
```
<!-- aped-lint-enable -->

This story adds `SUPABASE_JWT_SECRET: z.string().min(32)` to the schema (Task 1).

#### `apps/api/src/platform/index.ts` (current — modified by Task 4)

<!-- aped-lint-disable -->
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
<!-- aped-lint-enable -->

The "story 0-5: jwt-verifier + requireUserContext" line is incorrect — 0-5 only shipped `error-mapper` + `orpc-mount`. Task 4 corrects the comment to read "story 0-6: jwt-verifier + requireUserContext" and otherwise leaves the file unchanged (still `export {}`).

#### `apps/api/src/platform/http/orpc-mount.ts` (current — modified by Task 11)

<!-- aped-lint-disable -->
```ts
// apps/api/src/platform/http/orpc-mount.ts
// Mount the oRPC fetch handler at /rpc/v1/* on an Elysia app.
// The router is empty for the scaffold — every request falls through to
// matched=false and the global Elysia .onError(...) shapes the 404.
// Feature stories progressively replace `pekuloRouter` with handlers via
// `os.contract(<moduleContract>).router({ ... })`.

import type { AnyElysia } from "elysia";
import { RPCHandler } from "@orpc/server/fetch";

import { PekuloError } from "../../common/errors";

/**
 * Constructor parameter accepted by `RPCHandler`. Re-exported as a Pekulo
 * type so feature stories import a single, named handle rather than digging
 * into `@orpc/server/fetch`'s internals.
 */
type PekuloRpcRouter = ConstructorParameters<typeof RPCHandler<object>>[0];

/**
 * Build the oRPC RPCHandler for the Pekulo router. Feature stories should
 * call this rather than instantiating `RPCHandler` directly so the
 * convention lives in one place (review F5).
 *
 * **DX trap warning** — pass the result of
 * `os.contract(<moduleContract>).router({ ...handlers })`, NOT a raw
 * contract object. Both type-check against RPCHandler's permissive
 * `Router<any, T>`, but a contract object dispatches on no handler at
 * runtime and 404s every well-formed call. If you find yourself passing
 * `pekuloContract.compass` here, you want `os.contract(pekuloContract.compass).router({...})`.
 */
function createPekuloRpcHandler(router: PekuloRpcRouter): RPCHandler<object> {
  return new RPCHandler(router);
}

const pekuloRouter = {} satisfies PekuloRpcRouter;

/**
 * Build the oRPC RPCHandler ONCE per process. The handler is stateless and
 * shared across requests — RPCHandler internally maps the URL path to the
 * router tree key, regardless of how many concurrent requests are in flight.
 */
const handler = createPekuloRpcHandler(pekuloRouter);

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
    if (!matched) {
      // No procedure matched — throw a typed NOT_FOUND so the global
      // Elysia .onError(...) shapes a uniform 404 body via the error-mapper.
      // This is what AC-4 is verifying. The discriminated FetchHandleResult
      // from @orpc/server/fetch guarantees `response: Response` whenever
      // `matched: true`, so we don't need a defensive `response === undefined`
      // branch (review F11a).
      throw new PekuloError(
        "NOT_FOUND",
        `no oRPC procedure matched ${new URL(request.url).pathname}`,
      );
    }
    return response;
  });
}
```
<!-- aped-lint-enable -->

Task 11 refactors this file to: (1) accept `deps: { jwtVerifier: JwtVerifier; orpcRouter: PekuloRpcRouter }` so the assembled router carries actual procedures (instead of `{}`), (2) build a fresh `RPCHandler(deps.orpcRouter)` per `mountOrpc` call (one per process, still stateless), (3) extract `Authorization` from request headers and pass `{ userId, email }` as the oRPC `context`, (4) wrap `handler.handle` in a request-log timer that emits the structured log line per AC-1.

#### `apps/api/src/bootstrap/runtime-dependencies.ts` (current — modified by Task 12)

<!-- aped-lint-disable -->
```ts
import type { Env } from "../config/env";
import { createPrismaService, type PrismaService } from "../database";
import { createReadiness, type Readiness } from "./readiness";

export interface RuntimeDeps {
  env: Env;
  readiness: Readiness;
  prismaService: PrismaService;
}

// F10: a single transient probe failure should not yank traffic on Dokploy /
// K8s. We track consecutive failures in closure and only flip the probe to
// `ok: false` after two in a row. The probe still runs the live SELECT 1 every
// invocation; the debounce only changes the verdict reporting.
const PRISMA_PROBE_FAILURE_THRESHOLD = 2;

export async function createRuntimeDependencies(input: { env: Env }): Promise<RuntimeDeps> {
  const readiness = createReadiness();
  const prismaService = createPrismaService({ databaseUrl: input.env.DATABASE_URL });

  let consecutivePrismaFailures = 0;
  readiness.register("prisma", async () => {
    try {
      await prismaService.client.$queryRaw`SELECT 1`;
      consecutivePrismaFailures = 0;
      return { ok: true };
    } catch (err) {
      consecutivePrismaFailures += 1;
      const reason = err instanceof Error ? err.message : String(err);
      if (consecutivePrismaFailures < PRISMA_PROBE_FAILURE_THRESHOLD) {
        // First failure — likely transient. Report degraded with a marker so
        // /ready still says ready=true overall (operator-visible reason); next
        // failure flips us to ok:false and yanks traffic.
        return { ok: true, reason: `prisma transient (${reason})` };
      }
      return {
        ok: false,
        reason: `prisma down (${consecutivePrismaFailures} consecutive): ${reason}`,
      };
    }
  });

  return { env: input.env, readiness, prismaService };
}
```
<!-- aped-lint-enable -->

Task 12 extends `RuntimeDeps` with `jwtVerifier: JwtVerifier` and `orpcRouter: PekuloRpcRouter`, instantiates the JWT verifier from `env.SUPABASE_JWT_SECRET`, instantiates `createHypothesisModule({ prismaService })`, and assembles the router as `{ hypothesis: hypothesisModule.router }`.

#### `apps/api/src/app.ts` (current — modified by Task 13)

<!-- aped-lint-disable -->
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

  // L2 — let Elysia infer the chained type; never annotate the variable with the bare Elysia type.
  const app = new Elysia()
    .onError(({ error, set }) => {
      // Generate the requestId BEFORE the log so the log line and the wire
      // body share the same correlation handle (review F3). Emit one
      // structured log carrying { requestId, code, name } — never the raw
      // Error object, which would dump message + stack + cause to stdout.
      const requestId = crypto.randomUUID();
      const mapped = mapErrorToOrpcResponse(error, requestId);
      console.error("[api] error", {
        requestId,
        code: mapped.body.error.code,
        name: error instanceof Error ? error.name : typeof error,
      });
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
<!-- aped-lint-enable -->

Task 13 changes only line 37 from `mountOrpc(app);` to `mountOrpc(app, { jwtVerifier: deps.jwtVerifier, orpcRouter: deps.orpcRouter });`. **L2 enforcement: `const app = new Elysia()...` stays inferred — do NOT annotate.** No other line in this file changes.

#### `apps/web/src/lib/zapaction/context.ts` (current — modified by Task 15)

<!-- aped-lint-disable -->
```ts
import "server-only";
import { setActionContext } from "@zapaction/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type ActionContext = {
  supabase: SupabaseClient;
  userId: string;
  email: string | null;
};

setActionContext<ActionContext>(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return {
    supabase: supabase as unknown as SupabaseClient,
    userId: user.id,
    email: user.email ?? null,
  };
});
```
<!-- aped-lint-enable -->

Task 15 swaps `auth.getUser()` for `auth.getSession()` (we need the `access_token`), keeps `supabase` in `ActionContext` for backward compat with the brownfield actions that haven't been ported yet (`portfolio.ts`, `transactions.ts`, `monthly.ts`, `holding-lots.ts`), AND calls `requestContextStore.enterWith({ accessToken, userId, email })` from the resolver so the AsyncLocalStorage propagates to the oRPC client's `headers` thunk.

#### `apps/web/src/lib/orpc/client.ts` (current — modified by Task 15)

<!-- aped-lint-disable -->
```ts
// apps/web/src/lib/orpc/client.ts
// Server-only oRPC HTTP link to apps/api. Used by every typed module client
// in `modules.ts`. Auth header forwarding lands in story 0-6 (zapaction-orpc-bridge).

import "server-only";

import { RPCLink } from "@orpc/client/fetch";

/**
 * Resolve the apps/api base URL on every request. Reading `process.env`
 * inside the link's `url` thunk (instead of capturing at module-load) means
 * a late env push (e.g. bun --hot reload that re-reads `.env.local` after
 * the module was first evaluated) is picked up without a process restart.
 * Future story 0-8 (CI/CD) wires VERCEL_ENV-aware defaults; story 0-7 (OTel)
 * adds tracing headers here.
 */
function requireApiBaseUrl(): string {
  const apiBaseUrl = process.env.API_BASE_URL;
  if (!apiBaseUrl || apiBaseUrl.trim().length === 0) {
    throw new Error(
      "API_BASE_URL is not set. Configure it in .env / .env.local " +
        "(set to http://127.0.0.1:3001 for local dev).",
    );
  }
  return apiBaseUrl;
}

export const orpcLink = new RPCLink({
  url: () => `${requireApiBaseUrl()}/rpc/v1`,
  // headers: () => ({}) — auth header forwarding wired in story 0-6.
});
```
<!-- aped-lint-enable -->

Task 15 closes the deferred-work comment on line 29: replaces it with a `headers: () => ({ Authorization: \`Bearer ${getRequestContext().accessToken}\` })` thunk. The comment header on line 3 is updated to remove the "lands in story 0-6" forward pointer (it's landing now).

#### `apps/web/src/lib/actions/hypotheses.ts` (current — replaced by Task 16)

<!-- aped-lint-disable -->
```ts
"use server";

import { defineAction } from "@zapaction/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defaultHypotheses, type Hypotheses } from "@/lib/types";
import { hypothesesSchema } from "@/lib/schemas/hypotheses";
import { hypothesesTags } from "@/lib/zapaction/keys";
import type { ActionContext } from "@/lib/zapaction/context";
import "@/lib/zapaction/context";

const dbToCamel = (row: Record<string, unknown>): Hypotheses => ({
  salaireNet: Number(row.salaire_net ?? defaultHypotheses.salaireNet),
  ticketRestoJour: Number(row.ticket_resto_jour ?? defaultHypotheses.ticketRestoJour),
  partEmployeurTr: Number(row.part_employeur_tr ?? defaultHypotheses.partEmployeurTr),
  joursTravailles: Number(row.jours_travailles ?? defaultHypotheses.joursTravailles),
  navigoCout: Number(row.navigo_cout ?? defaultHypotheses.navigoCout),
  partEmployeurNavigo: Number(row.part_employeur_navigo ?? defaultHypotheses.partEmployeurNavigo),
  mutuelleEconomie: Number(row.mutuelle_economie ?? defaultHypotheses.mutuelleEconomie),
  loyer: Number(row.loyer ?? defaultHypotheses.loyer),
  courses: Number(row.courses ?? defaultHypotheses.courses),
  transport: Number(row.transport ?? defaultHypotheses.transport),
  autresCharges: Number(row.autres_charges ?? defaultHypotheses.autresCharges),
  sorties: Number(row.sorties ?? defaultHypotheses.sorties),
  divers: Number(row.divers ?? defaultHypotheses.divers),
  voyageMois: Number(row.voyage_mois ?? defaultHypotheses.voyageMois),
  creditMensuel: Number(row.credit_mensuel ?? defaultHypotheses.creditMensuel),
  dateDebutCredit: String(row.date_debut_credit ?? defaultHypotheses.dateDebutCredit),
  matelasCible: Number(row.matelas_cible ?? defaultHypotheses.matelasCible),
  perfEtfAnnuelle: Number(row.perf_etf_annuelle ?? defaultHypotheses.perfEtfAnnuelle),
  augmentationSalaire: Number(row.augmentation_salaire ?? defaultHypotheses.augmentationSalaire),
  partEtfMonde: Number(row.part_etf_monde ?? defaultHypotheses.partEtfMonde),
  partOpportunites: Number(row.part_opportunites ?? defaultHypotheses.partOpportunites),
  economieRemoteMois: Number(row.economie_remote_mois ?? defaultHypotheses.economieRemoteMois),
  moisRemoteAn: Number(row.mois_remote_an ?? defaultHypotheses.moisRemoteAn),
  revenuFreelanceMois: Number(row.revenu_freelance_mois ?? defaultHypotheses.revenuFreelanceMois),
  horizonYears: Number(row.horizon_years ?? defaultHypotheses.horizonYears),
  objectif: Number(row.objectif ?? defaultHypotheses.objectif),
});

const camelToDb = (h: Hypotheses, userId: string) => ({
  user_id: userId,
  salaire_net: h.salaireNet,
  ticket_resto_jour: h.ticketRestoJour,
  part_employeur_tr: h.partEmployeurTr,
  jours_travailles: h.joursTravailles,
  navigo_cout: h.navigoCout,
  part_employeur_navigo: h.partEmployeurNavigo,
  mutuelle_economie: h.mutuelleEconomie,
  loyer: h.loyer,
  courses: h.courses,
  transport: h.transport,
  autres_charges: h.autresCharges,
  sorties: h.sorties,
  divers: h.divers,
  voyage_mois: h.voyageMois,
  credit_mensuel: h.creditMensuel,
  date_debut_credit: h.dateDebutCredit,
  matelas_cible: h.matelasCible,
  perf_etf_annuelle: h.perfEtfAnnuelle,
  augmentation_salaire: h.augmentationSalaire,
  part_etf_monde: h.partEtfMonde,
  part_opportunites: h.partOpportunites,
  economie_remote_mois: h.economieRemoteMois,
  mois_remote_an: h.moisRemoteAn,
  revenu_freelance_mois: h.revenuFreelanceMois,
  horizon_years: h.horizonYears,
  objectif: h.objectif,
  updated_at: new Date().toISOString(),
});

export const getHypotheses = defineAction<void, Hypotheses, ActionContext>({
  name: "getHypotheses",
  input: z.void(),
  handler: async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("hypotheses")
      .select("*")
      .eq("user_id", ctx.userId)
      .maybeSingle();
    if (error && error.code !== "PGRST116") throw error;
    if (!data) return defaultHypotheses;
    return dbToCamel(data);
  },
});

export const saveHypotheses = defineAction<Hypotheses, Hypotheses, ActionContext>({
  name: "saveHypotheses",
  input: hypothesesSchema,
  output: hypothesesSchema,
  tags: [hypothesesTags.current()],
  handler: async ({ input, ctx }) => {
    const { data, error } = await ctx.supabase
      .from("hypotheses")
      .upsert(camelToDb(input, ctx.userId), { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/parametres");
    return dbToCamel(data);
  },
});
```
<!-- aped-lint-enable -->

Task 16 replaces the entire body. Both `dbToCamel` and `camelToDb` move to `apps/api/src/modules/hypothesis/hypothesis.service.ts` (the apps/api side now owns the row → DTO mapping). The action becomes ~30 lines: just `defineAction` declarations that delegate to `hypothesisClient.get()` / `hypothesisClient.save(input)`. Tags + `revalidatePath` are retained.

#### `apps/web/src/lib/data/hypotheses.ts` (current — modified by Task 16)

<!-- aped-lint-disable -->
```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { defaultHypotheses, type Hypotheses } from "@/lib/types";

export async function readHypotheses(): Promise<{
  hypotheses: Hypotheses;
  source: "db" | "default" | "error";
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { hypotheses: defaultHypotheses, source: "default" };

    const { data, error } = await supabase
      .from("hypotheses")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return {
        hypotheses: defaultHypotheses,
        source: "error",
        error: `${error.code ?? ""} ${error.message}`.trim(),
      };
    }
    if (!data) return { hypotheses: defaultHypotheses, source: "default" };

    return {
      hypotheses: {
        salaireNet: Number(data.salaire_net),
        ticketRestoJour: Number(data.ticket_resto_jour),
        partEmployeurTr: Number(data.part_employeur_tr),
        joursTravailles: Number(data.jours_travailles),
        navigoCout: Number(data.navigo_cout),
        partEmployeurNavigo: Number(data.part_employeur_navigo),
        mutuelleEconomie: Number(data.mutuelle_economie),
        loyer: Number(data.loyer),
        courses: Number(data.courses),
        transport: Number(data.transport),
        autresCharges: Number(data.autres_charges),
        sorties: Number(data.sorties),
        divers: Number(data.divers),
        voyageMois: Number(data.voyage_mois),
        creditMensuel: Number(data.credit_mensuel),
        dateDebutCredit: String(data.date_debut_credit ?? defaultHypotheses.dateDebutCredit),
        matelasCible: Number(data.matelas_cible),
        perfEtfAnnuelle: Number(data.perf_etf_annuelle),
        augmentationSalaire: Number(data.augmentation_salaire),
        partEtfMonde: Number(data.part_etf_monde),
        partOpportunites: Number(data.part_opportunites),
        economieRemoteMois: Number(data.economie_remote_mois),
        moisRemoteAn: Number(data.mois_remote_an),
        revenuFreelanceMois: Number(data.revenu_freelance_mois),
        horizonYears: Number(data.horizon_years ?? defaultHypotheses.horizonYears),
        objectif: Number(data.objectif ?? defaultHypotheses.objectif),
      },
      source: "db",
    };
  } catch (err) {
    return {
      hypotheses: defaultHypotheses,
      source: "error",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
```
<!-- aped-lint-enable -->

Four RSC pages call `readHypotheses()` — `apps/web/src/app/dashboard/page.tsx:31`, `apps/web/src/app/dashboard/parametres/page.tsx:7`, `apps/web/src/app/dashboard/mensuel/page.tsx:11`, `apps/web/src/app/api/dashboard/route.ts:21`. None of them actually use `source`/`error` (they all destructure `{ hypotheses }` only). Task 16 preserves the outer return shape (so the 4 RSC callers stay byte-identical) but switches the implementation to call `await ensureRequestContext(); return { hypotheses: await hypothesisClient.get(), source: "db" };`. The 70-line `dbToCamel` body disappears (apps/api now owns it).

#### `apps/web/src/lib/schemas/hypotheses.ts` (current — modified by Task 6)

<!-- aped-lint-disable -->
```ts
import { z } from "zod";

const ratio = z.number().min(0).max(1);
const positive = z.number().min(0);

export const hypothesesSchema = z.object({
  salaireNet: positive,
  ticketRestoJour: positive,
  partEmployeurTr: ratio,
  joursTravailles: z.number().min(0).max(31),
  navigoCout: positive,
  partEmployeurNavigo: ratio,
  mutuelleEconomie: positive,
  loyer: positive,
  courses: positive,
  transport: positive,
  autresCharges: positive,
  sorties: positive,
  divers: positive,
  voyageMois: positive,
  creditMensuel: positive,
  dateDebutCredit: z.string().regex(/^\d{2}\/\d{4}$/, "Format MM/YYYY attendu"),
  matelasCible: positive,
  perfEtfAnnuelle: ratio,
  augmentationSalaire: ratio,
  partEtfMonde: ratio,
  partOpportunites: ratio,
  economieRemoteMois: positive,
  moisRemoteAn: z.number().min(0).max(12),
  revenuFreelanceMois: positive,
  horizonYears: z.number().int().min(1).max(50),
  objectif: positive,
});

export type HypothesesInput = z.infer<typeof hypothesesSchema>;
```
<!-- aped-lint-enable -->

Task 6 moves the body verbatim to `packages/validators/src/hypothesis.ts` and replaces this file with a one-line re-export (`export { hypothesesSchema, type HypothesesInput } from "@pekulo/validators";`) so existing consumers (`apps/web/src/app/dashboard/parametres/_components/hypotheses-form.tsx:14`, `apps/web/src/lib/actions/hypotheses.ts:7`) keep working without import churn.

#### `packages/contracts/src/hypothesis.contract.ts` (current — replaced by Task 7)

<!-- aped-lint-disable -->
```ts
// packages/contracts/src/hypothesis.contract.ts
// Hypothesis module oRPC contract — empty scaffold; procedures land with feature
// stories. See ADR-0009 (mount under /rpc/v1/hypothesis).

export const hypothesisContractV1 = {} as const;
export const hypothesisContract = hypothesisContractV1;
export const hypothesisContractMeta = {
  moduleKey: "hypothesis",
  mountPath: "/rpc/v1/hypothesis",
  version: "v1",
} as const;
```
<!-- aped-lint-enable -->

Task 7 replaces the empty `{}` with two procedures: `get` (no input, hypothesis output) and `save` (hypothesis input, hypothesis output) using the `oc` builder from `@orpc/contract`. The metadata block is preserved.

#### `apps/api/package.json` (current — modified by Task 1, Task 6, Task 10)

<!-- aped-lint-disable -->
```json
{
  "name": "@pekulo/api",
  "version": "0.0.0",
  "private": true,
  "description": "Pekulo domain API — Bun + Elysia + oRPC. See ADR-0009.",
  "type": "module",
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
    "@orpc/server": "1.14.1",
    "@pekulo/contracts": "workspace:*",
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
    "prisma": "7.8.0"
  }
}
```
<!-- aped-lint-enable -->

Task 1 adds `"jose": "5.9.6"` (exact-pinned, runtime dep — JWT verification). Task 6 adds `"@pekulo/validators": "workspace:*"` to `dependencies`. Task 10 doesn't touch this file (just consumes the deps). No `^` ever.

#### `apps/web/package.json` (current — not modified, listed for context)

The web tier already has `@orpc/client@1.14.1` and `@orpc/contract@1.14.1` from story 0-5. No new web dep required for 0-6 (the AsyncLocalStorage uses Node's built-in `node:async_hooks`, available in Bun and Node).

#### `.env.example` (current — modified by Task 2)

<!-- aped-lint-disable -->
```
# ============================================================
# Plan Financier — root .env
# Loaded by every monorepo script via `dotenv -e .env --` prefix.
# Both apps/web (Next.js) and apps/prices (Python) read from here.
# Copy to `.env.local` and fill the values. `.env.local` is gitignored.
# ============================================================

# ---------- Supabase (apps/web) ----------
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# ---------- Prices service shared (apps/web client + apps/prices server) ----------

# Primary price provider — Python yfinance microservice (deploy via Dokploy).
# Leave empty to skip and fall back to yahoo-finance2 npm package directly.
PRICES_SERVICE_URL=
# Generate a strong random string: `openssl rand -hex 32`
# Set the same value here AND on the Python service (apps/prices needs it for auth).
PRICES_SERVICE_TOKEN=

# ---------- apps/prices only (FastAPI service) ----------

# CORS origin allowlist for the prices service. '*' for dev, your Next.js domain in prod.
ALLOWED_ORIGIN=*

# ---------- apps/web only (optional Twelve Data fallback) ----------

# Free key at https://twelvedata.com (no credit card, 800 req/day).
# Free tier covers US only — European ETFs need the paid Grow plan.
TWELVE_DATA_API_KEY=

# ---------- apps/api (Prisma direct connection) ----------
# Local dev: spin up the Supabase Docker stack from apps/web — it ships a Postgres
# on port 54322 with the `auth` schema (auth.users + auth.uid()) populated.
#
#   (cd apps/web && bunx supabase start)
#
# Then copy this line into the root `.env.local` (gitignored). Pekulo's monorepo
# convention is root-only env files — apps/api/prisma.config.ts resolves the
# repo root from its own location and loads it. Production uses the Supabase
# project's connection string set in Dokploy env, never committed here.
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres

# ---------- apps/web → apps/api oRPC link (server-only) ----------
# apps/api base URL — consumed by apps/web's oRPC link (server-side only, never NEXT_PUBLIC_*).
# Local dev default matches apps/api's PORT=3001 from src/config/env.ts.
API_BASE_URL=http://127.0.0.1:3001
```
<!-- aped-lint-enable -->

Task 2 appends a new section at the end:

```
# ---------- apps/api JWT verification (story 0-6) ----------
# Symmetric (HS256) Supabase JWT secret — apps/api verifies every Bearer token
# forwarded from apps/web's oRPC client. Read it from `bunx supabase status`
# (line "JWT secret"). Production uses the Supabase project's JWT secret set
# in Dokploy env, never committed here. MUST be ≥ 32 chars.
SUPABASE_JWT_SECRET=
```

### File decisions (3-bullet template per file)

#### `apps/api` — JWT verification + structured log middleware (Phase B)

- `apps/api/src/config/env.ts` — **Modified.** Single responsibility unchanged (Zod-validated env loader). Diff scope: add `SUPABASE_JWT_SECRET: z.string().min(32)`. I/O: same shape, +1 required field.
- `apps/api/src/platform/security/jwt-verifier.ts` — **Created.** Single responsibility: wraps `jose.jwtVerify(token, secret, { algorithms: ["HS256"] })` and exposes `JwtVerifier.verify(token) → Promise<{ sub: string; email: string | null; exp: number }>`. I/O: imports `jwtVerify` from `jose` ; exports `JwtVerifier`, `createJwtVerifier(input: { secret: string })`. **L2 N/A here** (no Elysia surface in this file).
- `apps/api/src/platform/security/jwt-verifier.test.ts` — **Created.** Single responsibility: cover 4 branches with `bun:test` — valid HS256 (signs with `jose.SignJWT` then verifies, asserts `sub` matches), expired (sets `exp` to past), wrong secret (signs with secret A, verifies with secret B), malformed (`"not-a-jwt"`). I/O: imports `bun:test` + `jose.SignJWT` + the SUT.
- `apps/api/src/platform/security/require-user-context.ts` — **Created.** Single responsibility: pure `(headers: Headers, verifier: JwtVerifier) → Promise<{ userId: string; email: string | null }>` covering missing-header / wrong-scheme / invalid-jwt branches by throwing `PekuloError("UNAUTHORIZED", ...)`. I/O: imports `JwtVerifier`, `PekuloError` ; no I/O on `Headers` other than `.get("authorization")`.
- `apps/api/src/platform/security/require-user-context.test.ts` — **Created.** Single responsibility: cover 4 branches with `bun:test` — missing header, malformed scheme (`"not-a-bearer xyz"`), invalid token (verifier rejects), valid (verifier resolves to `{ sub: "user-uuid", email: "alex@…", exp: future }`). I/O: stubs the verifier with a `vi.fn()`-shaped manual fake.
- `apps/api/src/platform/security/index.ts` — **Created.** Single responsibility: barrel re-export for `platform/security/*`. I/O: re-exports `JwtVerifier`, `createJwtVerifier`, `requireUserContext`.
- `apps/api/src/platform/http/request-log.ts` — **Created.** Single responsibility: emit one structured stdout line per request. Pure: `logRpcRequest(input: { requestId; route; userId; durationMs; status; errorCode? }): void` — calls `console.log(JSON.stringify({ event: "rpc.request", ...input }))`. I/O: console-only ; logger swap deferred to 0-7. The `errorCode` field is appended only when `status >= 400`.
- `apps/api/src/platform/http/orpc-mount.ts` — **Modified.** Single responsibility unchanged (mount oRPC at `/rpc/v1/*`). Diff scope: (1) accept `deps: { jwtVerifier; orpcRouter }`, (2) build a fresh `RPCHandler(deps.orpcRouter)` per mount call, (3) extract `Authorization` and pass `{ userId, email }` as the oRPC `context`, (4) wrap `handler.handle` in a request-log timer. **L2 enforcement:** `app: AnyElysia`, return type INFERRED.

#### `apps/api` — Hypothesis module (Phase C)

- `apps/api/src/modules/hypothesis/hypothesis.module.ts` — **Created.** Single responsibility: factory `createHypothesisModule(deps: { prismaService })` returning `{ router }`. I/O: imports `PrismaService` from `../../database`, `hypothesisRoutes` from `./hypothesis.routes` ; exports `HypothesisModule`, `createHypothesisModule`.
- `apps/api/src/modules/hypothesis/hypothesis.routes.ts` — **Created.** Single responsibility: oRPC handlers — `os.contract(hypothesisContract).router({ get, save })`. Each handler reads `context.userId` (injected by `mountOrpc`), calls `service.get(userId)` / `service.save(userId, input)`, returns the result. I/O: imports `os` from `@orpc/server`, `hypothesisContract` from `@pekulo/contracts`, `HypothesisService` from `./hypothesis.service` ; returns the typed router. **L2 enforcement:** the router type is INFERRED (no annotation).
- `apps/api/src/modules/hypothesis/hypothesis.service.ts` — **Created.** Single responsibility: Prisma get/upsert with `where: { userId }` (ADR-0013 belt + suspenders). Owns `dbToCamel` + `camelToDb` (relocated from `apps/web/src/lib/actions/hypotheses.ts`). I/O: imports `ExtendedPrismaClient` (DI), `defaultHypotheses` from `@pekulo/validators`, `Hypotheses` type ; exports `HypothesisService`, `createHypothesisService(deps: { client })`.
- `apps/api/src/modules/hypothesis/hypothesis.service.test.ts` — **Created.** Single responsibility: 3 cases on a stubbed Prisma — get-default (findUnique → null), get-existing (findUnique → row → camelCased), save-upsert (assert exact `where`/`update`/`create` clauses). I/O: imports `bun:test` + the SUT ; the stub is a hand-rolled `{ hypothesis: { findUnique: mock(), upsert: mock() } }` typed against the subset the service uses.

#### `packages/contracts`, `packages/validators` — Shared schemas + procedures (Phase C)

- `packages/validators/src/hypothesis.ts` — **Created.** Single responsibility: Zod source of truth for the hypothesis row + a `defaultHypotheses` constant. Schema body is moved verbatim from `apps/web/src/lib/schemas/hypotheses.ts` ; the `defaultHypotheses` literal is moved from `apps/web/src/lib/types.ts` (the original literal is deleted there to avoid two divergent sources). I/O: imports `z` from `zod` ; exports `hypothesesSchema`, `HypothesesInput`, `defaultHypotheses`, `Hypotheses` (alias of `HypothesesInput` for legacy ergonomics).
- `packages/validators/src/index.ts` — **Modified.** Single responsibility: barrel for shared validators. Diff scope: replace placeholder `export {}` with `export * from "./hypothesis"`.
- `packages/contracts/src/hypothesis.contract.ts` — **Replaced.** Single responsibility: oRPC contract for the hypothesis module — `get` (no input, hypothesis output) + `save` (hypothesis input, hypothesis output). I/O: imports `oc` from `@orpc/contract`, `hypothesesSchema` from `@pekulo/validators` ; exports `hypothesisContractV1`, `hypothesisContract`, `hypothesisContractMeta`. Sub-tree versioning preserved (V1 alias still exported).

#### `apps/api` — Mount integration (Phase D)

- `apps/api/src/bootstrap/runtime-dependencies.ts` — **Modified.** Single responsibility unchanged. Diff scope: extend `RuntimeDeps` with `jwtVerifier: JwtVerifier`, `orpcRouter: PekuloRpcRouter` ; instantiate both in `createRuntimeDependencies`.
- `apps/api/src/app.ts` — **Modified.** Diff scope: the `mountOrpc(app);` call (line 37 of the quoted block) becomes `mountOrpc(app, { jwtVerifier: deps.jwtVerifier, orpcRouter: deps.orpcRouter });`. **L2 enforcement:** `const app = new Elysia()...` stays inferred.
- `apps/api/src/platform/index.ts` — **Modified.** Single responsibility unchanged (placeholder + module map comment). Diff scope: line 7 of the quoted block changes from "story 0-5: jwt-verifier + requireUserContext" to "story 0-6: jwt-verifier + requireUserContext".

#### `apps/web` — Bridge wiring (Phase A + E)

- `apps/web/src/lib/orpc/request-context.ts` — **Created.** Single responsibility: AsyncLocalStorage store for the per-request `{ accessToken, userId, email }` triple, plus `ensureRequestContext()` (idempotent: returns the existing store entry or resolves it via Supabase + `enterWith`) and `getRequestContext()` (throws if absent). I/O: imports `AsyncLocalStorage` from `node:async_hooks`, `createClient` from `@/lib/supabase/server` ; exports the helpers + `RequestContext` type.
- `apps/web/src/lib/zapaction/context.ts` — **Modified.** Diff scope: switch `auth.getUser()` → `auth.getSession()` (we need `access_token`), call `requestContextStore.enterWith(...)` from inside the resolver, keep `supabase` in `ActionContext` for backward compat.
- `apps/web/src/lib/orpc/client.ts` — **Modified.** Diff scope: replace the empty `// headers: () => ({}) — auth header forwarding wired in story 0-6.` comment with a `headers: () => ({ Authorization: \`Bearer ${getRequestContext().accessToken}\` })` thunk ; update the comment header on line 3.
- `apps/web/src/lib/actions/hypotheses.ts` — **Replaced.** Single responsibility: thin oRPC delegators. Diff scope: drop both `dbToCamel` + `camelToDb` (moved to apps/api), drop direct `ctx.supabase` access, body becomes ~30 lines wrapping `hypothesisClient.get()` / `hypothesisClient.save(input)`. Tags + `revalidatePath` preserved.
- `apps/web/src/lib/data/hypotheses.ts` — **Modified.** Diff scope: drop direct supabase, call `await ensureRequestContext(); return { hypotheses: await hypothesisClient.get(), source: "db" };` while preserving the outer return shape so the 4 RSC callers stay unchanged.
- `apps/web/src/lib/schemas/hypotheses.ts` — **Modified.** Diff scope: replace the schema body with a one-line re-export from `@pekulo/validators`.
- `apps/web/src/lib/types.ts` — **Modified.** Diff scope: drop the `defaultHypotheses` literal (now sourced from `@pekulo/validators`), keep the `Hypotheses` type as a re-export.

#### `apps/api/scripts` — Smoke harness (Phase F)

- `apps/api/scripts/dev-token.ts` — **Created.** Single responsibility: command-line script to mint a synthetic JWT signed with `SUPABASE_JWT_SECRET` for local curl smoke. Usage: `bun apps/api/scripts/dev-token.ts <userId>` writes one line to stdout (the JWT). I/O: reads `SUPABASE_JWT_SECRET` from env, signs via `jose.SignJWT`. Excluded from production builds (in `scripts/` not `src/`).

### Architecture pinning

- **ADR-0009 — Bridge layout.** `apps/web` server actions stay as `'use server'` thin wrappers. `apps/web` opens zero direct DB connections post-this-story for the hypothesis module (Supabase JS retained on web for Auth flows only — `auth.getSession()` is still allowed; only `from("hypotheses").select(...)` is forbidden). Other brownfield modules (transactions, accounts, holdings, monthly, lots) keep their direct supabase calls until their port stories (5-1, 2-1, 3-1, 5-4) — the ports are sequenced; this story only ports `hypothesis` to validate the bridge.
- **ADR-0010 — Hard layering.** Component → Custom Hook → Server Action → oRPC client → Elysia handler → service → Prisma. The hypothesis-form component (`hypotheses-form.tsx:20`) consumes `useActionMutation(saveHypotheses)` via `@zapaction/query` ; that's a custom hook over the action. The action delegates to `hypothesisClient.save`. **The custom-hook tier is unchanged in 0-6** — `useActionMutation` is what the form already uses; we keep it.
- **ADR-0013 — RLS defense in depth.** The Prisma client in `apps/api` uses the service role (bypasses RLS). Every query in `hypothesis.service.ts` MUST include `where: { userId }` explicitly. The `0-12-custom-oxlint-rules` story will add the `no-prisma-query-without-user-id` lint rule that enforces this; for 0-6 we enforce manually + the test in AC-4 asserts the exact `where` clause shape.
- **L2 enforcement (Elysia 1.4 invariant generic).** Every new Elysia surface in this story (`hypothesis.routes.ts`, `mountOrpc` refactor) lets TS infer the chain or uses `AnyElysia` at boundaries. Pre-merge gate (Task 16): `grep -nE ': Elysia\\b' apps/api/src` MUST return zero matches across the touched files (matches on `AnyElysia` are fine and expected).
- **Empty router rationale (0-5 carry-over).** RPCHandler in `@orpc/server/fetch` requires a router with handlers. 0-5 passed `{}` for the scaffold and verified that everything 404s. 0-6 replaces the empty router with `{ hypothesis: hypothesisModule.router }` — feature stories 1-1 / 2-1 / 3-1 / 4-1 / 5-1 / 6-1 / 7-1 / 8-1 will progressively add their own keys (`{ hypothesis, compass, accounts, holdings, ... }`).

### oRPC API surface used in this story

These are the exact symbols the dev should import. All quoted from the oRPC docs (context7 fetched 2026-05-04 during 0-5 ; symbols stable in 1.14.x). Do not invent additional imports.

| Symbol | Source | Used in |
|---|---|---|
| `oc` (contract builder, with `.input(schema).output(schema)`) | `@orpc/contract` | `packages/contracts/src/hypothesis.contract.ts` |
| `os` (server builder) + `os.contract(<contract>).router({ ... })` | `@orpc/server` | `apps/api/src/modules/hypothesis/hypothesis.routes.ts` |
| `RPCHandler` (fetch adapter), `RPCHandler.handle(req, { prefix, context })` | `@orpc/server/fetch` | `apps/api/src/platform/http/orpc-mount.ts` |
| `createORPCClient` (already used in 0-5 — no change here) | `@orpc/client` | unchanged |
| `RPCLink` + its `headers` thunk | `@orpc/client/fetch` | `apps/web/src/lib/orpc/client.ts` |
| `ContractRouterClient<T>` | `@orpc/contract` | unchanged |
| `AnyElysia` (boundary type) | `elysia` | `apps/api/src/platform/http/orpc-mount.ts` |
| `Elysia` (only for `new Elysia()` instantiation, never as variable annotation) | `elysia` | unchanged in `app.ts` |

### JWT verification API surface (jose)

| Symbol | Source | Used in |
|---|---|---|
| `jwtVerify(token, secret, options)` | `jose` | `apps/api/src/platform/security/jwt-verifier.ts` |
| `SignJWT` | `jose` | `apps/api/src/platform/security/jwt-verifier.test.ts` (test fixture only) ; `apps/api/scripts/dev-token.ts` (smoke harness) |
| HS256 algorithm string `"HS256"` | (literal) | `jwtVerify` options + `SignJWT.setProtectedHeader` |

The secret is encoded as `new TextEncoder().encode(env.SUPABASE_JWT_SECRET)` per `jose`'s documentation: HS256 expects a `Uint8Array` key.

### AsyncLocalStorage propagation contract (web tier)

`AsyncLocalStorage.enterWith(value)` transitions into the context for the remainder of the synchronous execution and persists the store through any following asynchronous calls. Once entered, the store is visible to:

1. The zapaction action handler that runs after the `setActionContext` resolver returns.
2. The oRPC client invocation inside the handler (`hypothesisClient.get()` / `hypothesisClient.save(input)`) — the `RPCLink.headers` thunk reads from `getRequestContext()`.
3. RSC server components calling `readHypotheses()` — `ensureRequestContext()` enters the store on first call within that request's async chain.

`enterWith` does NOT leak across requests because Next.js wraps each incoming request handler in its own async context (via Node's V8 ResourceContext). Concurrent requests have isolated stores. Verified: a manual smoke in Task 16 issues two parallel `curl` calls with different tokens and asserts each request's structured log line carries the matching `userId` (no cross-contamination).

### Test framework choice

Same as 0-5: **`bun:test`** (zero install, part of Bun runtime). All `apps/api` unit tests in this story use it. AC-1 (round-trip log line) is a smoke harness, not a unit test — it lives in Task 16 as a documented `curl` sequence with expected stdout match.

### Lessons applied

- **L2 (Elysia type invariance).** Applied to Task 9 (`hypothesis.routes.ts` returns inferred), Task 10 (`hypothesis.module.ts` returns inferred), Task 11 (`mountOrpc` keeps `app: AnyElysia`), Task 13 (`app.ts` `const app` stays inferred). Pre-merge gate (Task 16): `grep -nE ': Elysia\\b' apps/api/src` returns zero matches.
- **L1 (Bun frozen-lockfile workspace coverage in Docker).** `apps/api/Dockerfile` is unchanged in this story — adding `jose` as a new runtime dep is automatically covered by the existing `COPY packages packages` + `COPY apps/api/package.json apps/api/` pattern from 0-3. No Dockerfile change required.

### Commit prefix discipline

Every task ends with a `git add ... && git commit -m "<prefix>(#6): <subject>"` line. Use `feat(#6):` for new behavior, `chore(#6):` for plumbing/wiring, `fix(#6):` for corrections, `test(#6):` for test-only commits. Do NOT skip the trailing parenthesis — `feat(#6)` differs from `feat:` in the changelog tooling.

---

## Tasks

> Each task is sized for ~3-5 minutes of dev time. Tasks reference the AC they satisfy. The dev agent runs `git status` between tasks to confirm only the expected files changed.

### Phase B — API JWT + structured log infra (Tasks 1-5)

- [x] **Task 1 — Add `jose` runtime dep + `SUPABASE_JWT_SECRET` to env** [AC: AC-3]

  Add `jose` to `apps/api/package.json` dependencies (exact-pinned, no `^`). Run from repo root:

  ```bash
  bun add --cwd apps/api jose@5.9.6
  ```

  Then edit `apps/api/src/config/env.ts` — replace the entire file with:

  ```ts
  import { z } from "zod";

  const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().max(65535).default(3001),
    HOST: z.string().min(1).default("127.0.0.1"),
    SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().max(60_000).default(10_000),
    DATABASE_URL: z.string().url(),
    SUPABASE_JWT_SECRET: z
      .string()
      .min(32, "SUPABASE_JWT_SECRET must be ≥ 32 chars (read it from `bunx supabase status`)"),
  });

  export type Env = z.infer<typeof envSchema>;

  export class ConfigError extends Error {
    override readonly name = "ConfigError";
    readonly fieldErrors: Record<string, string[] | undefined>;
    constructor(fieldErrors: Record<string, string[] | undefined>) {
      super(`invalid env: ${JSON.stringify(fieldErrors)}`);
      this.fieldErrors = fieldErrors;
    }
  }

  export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
    const parsed = envSchema.safeParse(source);
    if (!parsed.success) {
      throw new ConfigError(parsed.error.flatten().fieldErrors);
    }
    return parsed.data;
  }
  ```

  Verify: `bun --cwd apps/api run typecheck`.
  Expected: exit 0, no diagnostics.
  Commit: `git add apps/api/package.json apps/api/src/config/env.ts bun.lockb && git commit -m "chore(#6): add jose dep and SUPABASE_JWT_SECRET env var"`

- [x] **Task 2 — Document `SUPABASE_JWT_SECRET` in `.env.example` + ensure local `.env.local` has it** [AC: AC-3]

  Append to `.env.example` (preserve all existing lines):

  ```
  
  # ---------- apps/api JWT verification (story 0-6) ----------
  # Symmetric (HS256) Supabase JWT secret — apps/api verifies every Bearer token
  # forwarded from apps/web's oRPC client. Read it from `bunx supabase status`
  # (line "JWT secret"). Production uses the Supabase project's JWT secret set
  # in Dokploy env, never committed here. MUST be ≥ 32 chars.
  SUPABASE_JWT_SECRET=
  ```

  **Manual user step** — the dev MUST also append the resolved secret to the gitignored `.env.local` for local dev to work:

  ```bash
  bunx --cwd apps/web supabase status | grep "JWT secret" | awk -F': ' '{print "SUPABASE_JWT_SECRET="$2}' >> .env.local
  ```

  (If `supabase status` is not running, start it via `bunx --cwd apps/web supabase start` first.)

  Verify: `cat .env.example | grep SUPABASE_JWT_SECRET=` shows the new line and the example is untouched elsewhere.
  Expected: exact line present, no other diff.
  Commit: `git add .env.example && git commit -m "docs(#6): document SUPABASE_JWT_SECRET in .env.example"`
  (Do NOT commit `.env.local` — it's gitignored.)

- [x] **Task 3 — Create `jwt-verifier.ts` + tests** [AC: AC-3]

  Create `apps/api/src/platform/security/jwt-verifier.ts`:

  ```ts
  // apps/api/src/platform/security/jwt-verifier.ts
  // HS256 JWT verifier wrapping `jose.jwtVerify`. Used by `requireUserContext`
  // to validate Supabase access tokens forwarded over oRPC. Asymmetric (RS256
  // / ES256 / JWKS) verification deferred to (b) public-ramp ; HS256 + shared
  // secret matches Supabase Docker local + Supabase legacy projects.

  import { jwtVerify } from "jose";

  export interface VerifiedJwtPayload {
    sub: string;
    email: string | null;
    exp: number;
  }

  export interface JwtVerifier {
    verify(token: string): Promise<VerifiedJwtPayload>;
  }

  export function createJwtVerifier(input: { secret: string }): JwtVerifier {
    const key = new TextEncoder().encode(input.secret);
    return {
      async verify(token: string): Promise<VerifiedJwtPayload> {
        const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
        if (typeof payload.sub !== "string" || payload.sub.length === 0) {
          throw new Error("jwt.sub missing or empty");
        }
        if (typeof payload.exp !== "number") {
          throw new Error("jwt.exp missing");
        }
        const email = typeof payload.email === "string" ? payload.email : null;
        return { sub: payload.sub, email, exp: payload.exp };
      },
    };
  }
  ```

  Create `apps/api/src/platform/security/jwt-verifier.test.ts`:

  ```ts
  // Cover 4 branches: valid, expired, wrong secret, malformed.
  import { describe, expect, test } from "bun:test";
  import { SignJWT } from "jose";
  import { createJwtVerifier } from "./jwt-verifier";

  const SECRET = "test-secret-at-least-32-chars-long-aaaa";
  const WRONG_SECRET = "different-secret-also-32-chars-long-bbbb";

  async function sign(claims: Record<string, unknown>, secret: string, expSeconds: number) {
    return new SignJWT({ ...claims })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(String(claims.sub ?? "user-uuid"))
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + expSeconds)
      .sign(new TextEncoder().encode(secret));
  }

  describe("jwt-verifier", () => {
    test("valid HS256 token resolves to { sub, email, exp }", async () => {
      const verifier = createJwtVerifier({ secret: SECRET });
      const token = await sign({ sub: "11111111-1111-1111-1111-111111111111", email: "alex@pekulo.app" }, SECRET, 3600);
      const payload = await verifier.verify(token);
      expect(payload.sub).toBe("11111111-1111-1111-1111-111111111111");
      expect(payload.email).toBe("alex@pekulo.app");
      expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    test("expired token rejects", async () => {
      const verifier = createJwtVerifier({ secret: SECRET });
      const token = await sign({ sub: "u" }, SECRET, -3600); // exp in the past
      await expect(verifier.verify(token)).rejects.toThrow();
    });

    test("wrong secret rejects", async () => {
      const verifier = createJwtVerifier({ secret: SECRET });
      const token = await sign({ sub: "u" }, WRONG_SECRET, 3600);
      await expect(verifier.verify(token)).rejects.toThrow();
    });

    test("malformed token rejects", async () => {
      const verifier = createJwtVerifier({ secret: SECRET });
      await expect(verifier.verify("not-a-jwt")).rejects.toThrow();
    });
  });
  ```

  Run: `bun --cwd apps/api test src/platform/security/jwt-verifier.test.ts`.
  Expected: `4 pass`, `0 fail`, exit 0.
  Commit: `git add apps/api/src/platform/security/jwt-verifier.ts apps/api/src/platform/security/jwt-verifier.test.ts && git commit -m "feat(#6): add HS256 JWT verifier (jose)"`

- [x] **Task 4 — Create `require-user-context.ts` + tests + barrel + correct stale platform comment** [AC: AC-3]

  Create `apps/api/src/platform/security/require-user-context.ts`:

  ```ts
  // apps/api/src/platform/security/require-user-context.ts
  // Single chokepoint mapping `Headers → { userId, email }` for the apps/api
  // request path. Throws PekuloError("UNAUTHORIZED", ...) on every failure
  // mode (missing header, malformed scheme, invalid token). The Elysia global
  // .onError shapes the wire body via the error-mapper.

  import { PekuloError } from "../../common/errors";
  import type { JwtVerifier } from "./jwt-verifier";

  export interface UserContext {
    userId: string;
    email: string | null;
  }

  export async function requireUserContext(
    headers: Headers,
    verifier: JwtVerifier,
  ): Promise<UserContext> {
    const auth = headers.get("authorization") ?? "";
    if (!auth) {
      throw new PekuloError("UNAUTHORIZED", "missing Authorization header");
    }
    if (!auth.startsWith("Bearer ")) {
      throw new PekuloError("UNAUTHORIZED", "Authorization header must use Bearer scheme");
    }
    const token = auth.slice("Bearer ".length).trim();
    if (token.length === 0) {
      throw new PekuloError("UNAUTHORIZED", "Bearer token is empty");
    }
    let payload;
    try {
      payload = await verifier.verify(token);
    } catch (err) {
      throw new PekuloError("UNAUTHORIZED", "invalid Bearer token", { cause: err });
    }
    return { userId: payload.sub, email: payload.email };
  }
  ```

  Create `apps/api/src/platform/security/require-user-context.test.ts`:

  ```ts
  import { describe, expect, test } from "bun:test";
  import { PekuloError } from "../../common/errors";
  import type { JwtVerifier } from "./jwt-verifier";
  import { requireUserContext } from "./require-user-context";

  function fakeVerifier(behaviour: "ok" | "throw"): JwtVerifier {
    return {
      verify: async (_token: string) => {
        if (behaviour === "throw") throw new Error("simulated verify failure");
        return {
          sub: "11111111-1111-1111-1111-111111111111",
          email: "alex@pekulo.app",
          exp: Math.floor(Date.now() / 1000) + 3600,
        };
      },
    };
  }

  describe("requireUserContext", () => {
    test("missing header throws UNAUTHORIZED", async () => {
      const headers = new Headers();
      await expect(requireUserContext(headers, fakeVerifier("ok"))).rejects.toMatchObject({
        name: "PekuloError",
        code: "UNAUTHORIZED",
      });
    });

    test("malformed scheme throws UNAUTHORIZED", async () => {
      const headers = new Headers({ authorization: "not-a-bearer xyz" });
      await expect(requireUserContext(headers, fakeVerifier("ok"))).rejects.toMatchObject({
        name: "PekuloError",
        code: "UNAUTHORIZED",
      });
    });

    test("invalid token (verifier throws) → UNAUTHORIZED", async () => {
      const headers = new Headers({ authorization: "Bearer eyInvalid" });
      await expect(requireUserContext(headers, fakeVerifier("throw"))).rejects.toMatchObject({
        name: "PekuloError",
        code: "UNAUTHORIZED",
      });
    });

    test("valid token resolves to { userId, email }", async () => {
      const headers = new Headers({ authorization: "Bearer eyValidStub" });
      const ctx = await requireUserContext(headers, fakeVerifier("ok"));
      expect(ctx.userId).toBe("11111111-1111-1111-1111-111111111111");
      expect(ctx.email).toBe("alex@pekulo.app");
    });
  });
  ```

  Create `apps/api/src/platform/security/index.ts`:

  ```ts
  // apps/api/src/platform/security/index.ts
  // Barrel re-export for platform/security/*. Module factories + mount layer
  // import from here.
  export type { JwtVerifier, VerifiedJwtPayload } from "./jwt-verifier";
  export { createJwtVerifier } from "./jwt-verifier";
  export type { UserContext } from "./require-user-context";
  export { requireUserContext } from "./require-user-context";
  ```

  Edit `apps/api/src/platform/index.ts` — change ONLY this line (line 7 of the current quoted block):

  ```
  //                             (story 0-5: jwt-verifier + requireUserContext ;
  ```

  to:

  ```
  //                             (story 0-6: jwt-verifier + requireUserContext ;
  ```

  No other line in `apps/api/src/platform/index.ts` changes.

  Run: `bun --cwd apps/api test src/platform/security/require-user-context.test.ts`.
  Expected: `4 pass`, `0 fail`, exit 0.
  Commit: `git add apps/api/src/platform/security/ apps/api/src/platform/index.ts && git commit -m "feat(#6): add requireUserContext + correct platform module map"`

- [x] **Task 5 — Create `request-log.ts`** [AC: AC-1]

  Create `apps/api/src/platform/http/request-log.ts`:

  ```ts
  // apps/api/src/platform/http/request-log.ts
  // Structured request-log emitter for the oRPC mount path. One stdout line
  // per request, JSON-encoded for log-aggregator ingestion. 0-7 (OTel three
  // runtimes) will swap console.log for an OTel span without changing this
  // function's signature.

  export interface RpcLogEntry {
    requestId: string;
    route: string;
    userId: string;
    durationMs: number;
    status: number;
    errorCode?: string;
  }

  export function logRpcRequest(entry: RpcLogEntry): void {
    const payload: Record<string, unknown> = {
      event: "rpc.request",
      requestId: entry.requestId,
      route: entry.route,
      userId: entry.userId,
      durationMs: entry.durationMs,
      status: entry.status,
    };
    if (entry.status >= 400 && entry.errorCode) {
      payload.errorCode = entry.errorCode;
    }
    console.log(JSON.stringify(payload));
  }
  ```

  Run: `bun --cwd apps/api run typecheck`.
  Expected: exit 0.
  Commit: `git add apps/api/src/platform/http/request-log.ts && git commit -m "feat(#6): add structured rpc request log emitter"`

### Phase C — Shared validators + contract + hypothesis module (Tasks 6-10)

- [x] **Task 6 — Move `hypothesesSchema` + `defaultHypotheses` to `@pekulo/validators`** [AC: AC-4]

  Read `apps/web/src/lib/types.ts` and locate the `defaultHypotheses` literal — Task 7 needs the exact byte sequence. Quote it into the dev agent record. Then create `packages/validators/src/hypothesis.ts`:

  ```ts
  // packages/validators/src/hypothesis.ts
  // Zod source of truth for the hypothesis row + defaults. Consumed by
  // @pekulo/contracts (oRPC procedure I/O), apps/api hypothesis service
  // (validation + DB mapping), and apps/web hypothesis-form (TanStack Form
  // resolver).

  import { z } from "zod";

  const ratio = z.number().min(0).max(1);
  const positive = z.number().min(0);

  export const hypothesesSchema = z.object({
    salaireNet: positive,
    ticketRestoJour: positive,
    partEmployeurTr: ratio,
    joursTravailles: z.number().min(0).max(31),
    navigoCout: positive,
    partEmployeurNavigo: ratio,
    mutuelleEconomie: positive,
    loyer: positive,
    courses: positive,
    transport: positive,
    autresCharges: positive,
    sorties: positive,
    divers: positive,
    voyageMois: positive,
    creditMensuel: positive,
    dateDebutCredit: z.string().regex(/^\d{2}\/\d{4}$/, "Format MM/YYYY attendu"),
    matelasCible: positive,
    perfEtfAnnuelle: ratio,
    augmentationSalaire: ratio,
    partEtfMonde: ratio,
    partOpportunites: ratio,
    economieRemoteMois: positive,
    moisRemoteAn: z.number().min(0).max(12),
    revenuFreelanceMois: positive,
    horizonYears: z.number().int().min(1).max(50),
    objectif: positive,
  });

  export type HypothesesInput = z.infer<typeof hypothesesSchema>;
  // Legacy alias used by brownfield code.
  export type Hypotheses = HypothesesInput;

  export const defaultHypotheses: Hypotheses = {
    salaireNet: 3700,
    ticketRestoJour: 14,
    partEmployeurTr: 0.6,
    joursTravailles: 20,
    navigoCout: 90,
    partEmployeurNavigo: 0.5,
    mutuelleEconomie: 30,
    loyer: 1125,
    courses: 200,
    transport: 45,
    autresCharges: 150,
    sorties: 250,
    divers: 120,
    voyageMois: 600,
    creditMensuel: 250,
    dateDebutCredit: "01/2027",
    matelasCible: 10000,
    perfEtfAnnuelle: 0.07,
    augmentationSalaire: 0.03,
    partEtfMonde: 0.8,
    partOpportunites: 0.2,
    economieRemoteMois: 1000,
    moisRemoteAn: 6,
    revenuFreelanceMois: 300,
    horizonYears: 5,
    objectif: 100000,
  };
  ```

  > **Note for the dev** — the `defaultHypotheses` literal MUST mirror byte-for-byte the existing one in `apps/web/src/lib/types.ts` (the brownfield file you read at the start of this task). If your reading shows a different value for any field, USE THE READ VALUE in this new file rather than what's quoted above, and add a comment `// brownfield baseline: <field> was <value>` at the top of the literal. Diverging defaults break AC-4's brownfield-equivalence claim.

  Edit `packages/validators/src/index.ts` — replace the entire file with:

  ```ts
  // Pekulo shared Zod validators. Schemas are the single source of truth for
  // both apps/web (form resolvers) and apps/api (handler validation + DB
  // mapping). New schemas land alongside their feature stories.
  export * from "./hypothesis";
  ```

  Add the `@pekulo/validators` workspace dep to `apps/api/package.json` dependencies — append a single line `"@pekulo/validators": "workspace:*",` to the dependencies block (alphabetical sort: it goes after `"@pekulo/contracts": "workspace:*",`).

  Edit `apps/web/src/lib/schemas/hypotheses.ts` — replace the entire file with:

  ```ts
  // Backward-compat re-export. The Zod source of truth moved to @pekulo/validators
  // in story 0-6 to match @pekulo/contracts. Direct imports from this file keep
  // working — call sites are migrated lazily.
  export { hypothesesSchema, type HypothesesInput } from "@pekulo/validators";
  ```

  Edit `apps/web/src/lib/types.ts` — locate the `defaultHypotheses` literal and the `Hypotheses` interface, replace BOTH with:

  ```ts
  // defaultHypotheses + Hypotheses moved to @pekulo/validators in story 0-6.
  // Re-exported here so brownfield import paths keep working.
  export { defaultHypotheses, type Hypotheses } from "@pekulo/validators";
  ```

  Leave every OTHER export in `apps/web/src/lib/types.ts` (Account, Holding, etc.) unchanged.

  Run from repo root: `bun install && bun --cwd apps/api run typecheck && bun --cwd apps/web run typecheck`.
  Expected: both typechecks exit 0.
  Commit: `git add packages/validators/ apps/api/package.json apps/web/src/lib/schemas/hypotheses.ts apps/web/src/lib/types.ts bun.lockb && git commit -m "refactor(#6): move hypothesesSchema + defaultHypotheses to @pekulo/validators"`

- [x] **Task 7 — Populate `hypothesis.contract.ts` with `get` + `save` procedures** [AC: AC-1, AC-4]

  Replace the entire body of `packages/contracts/src/hypothesis.contract.ts` with:

  ```ts
  // packages/contracts/src/hypothesis.contract.ts
  // Hypothesis module oRPC contract — shipped with story 0-6 (zapaction-orpc-bridge).
  // Procedures: get (no input, returns the row or defaults) + save (full row in,
  // persisted row out). See ADR-0009 (mount under /rpc/v1/hypothesis).

  import { oc } from "@orpc/contract";
  import { hypothesesSchema } from "@pekulo/validators";

  export const hypothesisContractV1 = {
    get: oc.output(hypothesesSchema),
    save: oc.input(hypothesesSchema).output(hypothesesSchema),
  } as const;

  export const hypothesisContract = hypothesisContractV1;
  export const hypothesisContractMeta = {
    moduleKey: "hypothesis",
    mountPath: "/rpc/v1/hypothesis",
    version: "v1",
  } as const;
  ```

  Run: `bun --cwd packages/contracts run typecheck && bun --cwd apps/web run typecheck && bun --cwd apps/api run typecheck`.
  Expected: all three exit 0. The web tier's `apps/web/src/lib/orpc/modules.ts` (which already imports `hypothesisContract`) now infers `hypothesisClient.get()` and `hypothesisClient.save(input)` shapes correctly.
  Commit: `git add packages/contracts/src/hypothesis.contract.ts && git commit -m "feat(#6): populate hypothesisContract with get/save procedures"`

- [x] **Task 8 — Create `hypothesis.service.ts` + tests** [AC: AC-4]

  Create `apps/api/src/modules/hypothesis/hypothesis.service.ts`:

  ```ts
  // apps/api/src/modules/hypothesis/hypothesis.service.ts
  // Domain service for the hypothesis module. Owns:
  // - get(userId): fetch the user's row or fall back to defaults (preserves
  //   brownfield contract — the form ALWAYS gets a populated shape).
  // - save(userId, input): upsert with ADR-0013 belt+suspenders (explicit
  //   `where: { userId }` even though Prisma uses the service role).
  // - dbToCamel + camelToDb conversions (relocated from apps/web/src/lib/actions/
  //   hypotheses.ts during the 0-6 zapaction-orpc bridge port).

  import type { ExtendedPrismaClient } from "../../database";
  import { defaultHypotheses, type Hypotheses } from "@pekulo/validators";

  export interface HypothesisService {
    get(userId: string): Promise<Hypotheses>;
    save(userId: string, input: Hypotheses): Promise<Hypotheses>;
  }

  type HypothesisRow = {
    salaireNet: unknown;
    ticketRestoJour: unknown;
    partEmployeurTr: unknown;
    joursTravailles: unknown;
    navigoCout: unknown;
    partEmployeurNavigo: unknown;
    mutuelleEconomie: unknown;
    loyer: unknown;
    courses: unknown;
    transport: unknown;
    autresCharges: unknown;
    sorties: unknown;
    divers: unknown;
    voyageMois: unknown;
    creditMensuel: unknown;
    dateDebutCredit: unknown;
    matelasCible: unknown;
    perfEtfAnnuelle: unknown;
    augmentationSalaire: unknown;
    partEtfMonde: unknown;
    partOpportunites: unknown;
    economieRemoteMois: unknown;
    moisRemoteAn: unknown;
    revenuFreelanceMois: unknown;
    horizonYears: unknown;
    objectif: unknown;
  };

  function rowToHypotheses(row: HypothesisRow): Hypotheses {
    return {
      salaireNet: Number(row.salaireNet ?? defaultHypotheses.salaireNet),
      ticketRestoJour: Number(row.ticketRestoJour ?? defaultHypotheses.ticketRestoJour),
      partEmployeurTr: Number(row.partEmployeurTr ?? defaultHypotheses.partEmployeurTr),
      joursTravailles: Number(row.joursTravailles ?? defaultHypotheses.joursTravailles),
      navigoCout: Number(row.navigoCout ?? defaultHypotheses.navigoCout),
      partEmployeurNavigo: Number(row.partEmployeurNavigo ?? defaultHypotheses.partEmployeurNavigo),
      mutuelleEconomie: Number(row.mutuelleEconomie ?? defaultHypotheses.mutuelleEconomie),
      loyer: Number(row.loyer ?? defaultHypotheses.loyer),
      courses: Number(row.courses ?? defaultHypotheses.courses),
      transport: Number(row.transport ?? defaultHypotheses.transport),
      autresCharges: Number(row.autresCharges ?? defaultHypotheses.autresCharges),
      sorties: Number(row.sorties ?? defaultHypotheses.sorties),
      divers: Number(row.divers ?? defaultHypotheses.divers),
      voyageMois: Number(row.voyageMois ?? defaultHypotheses.voyageMois),
      creditMensuel: Number(row.creditMensuel ?? defaultHypotheses.creditMensuel),
      dateDebutCredit: String(row.dateDebutCredit ?? defaultHypotheses.dateDebutCredit),
      matelasCible: Number(row.matelasCible ?? defaultHypotheses.matelasCible),
      perfEtfAnnuelle: Number(row.perfEtfAnnuelle ?? defaultHypotheses.perfEtfAnnuelle),
      augmentationSalaire: Number(row.augmentationSalaire ?? defaultHypotheses.augmentationSalaire),
      partEtfMonde: Number(row.partEtfMonde ?? defaultHypotheses.partEtfMonde),
      partOpportunites: Number(row.partOpportunites ?? defaultHypotheses.partOpportunites),
      economieRemoteMois: Number(row.economieRemoteMois ?? defaultHypotheses.economieRemoteMois),
      moisRemoteAn: Number(row.moisRemoteAn ?? defaultHypotheses.moisRemoteAn),
      revenuFreelanceMois: Number(row.revenuFreelanceMois ?? defaultHypotheses.revenuFreelanceMois),
      horizonYears: Number(row.horizonYears ?? defaultHypotheses.horizonYears),
      objectif: Number(row.objectif ?? defaultHypotheses.objectif),
    };
  }

  function hypothesesToWriteData(input: Hypotheses) {
    return {
      salaireNet: input.salaireNet,
      ticketRestoJour: input.ticketRestoJour,
      partEmployeurTr: input.partEmployeurTr,
      joursTravailles: input.joursTravailles,
      navigoCout: input.navigoCout,
      partEmployeurNavigo: input.partEmployeurNavigo,
      mutuelleEconomie: input.mutuelleEconomie,
      loyer: input.loyer,
      courses: input.courses,
      transport: input.transport,
      autresCharges: input.autresCharges,
      sorties: input.sorties,
      divers: input.divers,
      voyageMois: input.voyageMois,
      creditMensuel: input.creditMensuel,
      dateDebutCredit: input.dateDebutCredit,
      matelasCible: input.matelasCible,
      perfEtfAnnuelle: input.perfEtfAnnuelle,
      augmentationSalaire: input.augmentationSalaire,
      partEtfMonde: input.partEtfMonde,
      partOpportunites: input.partOpportunites,
      economieRemoteMois: input.economieRemoteMois,
      moisRemoteAn: input.moisRemoteAn,
      revenuFreelanceMois: input.revenuFreelanceMois,
      horizonYears: input.horizonYears,
      objectif: input.objectif,
    };
  }

  export function createHypothesisService(deps: {
    client: ExtendedPrismaClient;
  }): HypothesisService {
    return {
      async get(userId) {
        const row = await deps.client.hypothesis.findUnique({ where: { userId } });
        if (!row) return defaultHypotheses;
        return rowToHypotheses(row as unknown as HypothesisRow);
      },
      async save(userId, input) {
        const writeData = hypothesesToWriteData(input);
        const row = await deps.client.hypothesis.upsert({
          where: { userId },
          update: writeData,
          create: { userId, ...writeData },
        });
        return rowToHypotheses(row as unknown as HypothesisRow);
      },
    };
  }
  ```

  Create `apps/api/src/modules/hypothesis/hypothesis.service.test.ts`:

  ```ts
  // 3 cases on a stubbed Prisma client. The fake client is a hand-rolled
  // subset typed against `client.hypothesis.{findUnique, upsert}` only — the
  // service does not touch any other model.

  import { describe, expect, mock, test } from "bun:test";
  import { defaultHypotheses, type Hypotheses } from "@pekulo/validators";
  import { createHypothesisService } from "./hypothesis.service";

  function fakeClient(behaviour: { findUniqueResult?: unknown; upsertResult?: unknown }) {
    const findUnique = mock(async () => behaviour.findUniqueResult ?? null);
    const upsert = mock(async () => behaviour.upsertResult ?? null);
    return {
      client: {
        hypothesis: { findUnique, upsert },
      },
      mocks: { findUnique, upsert },
    };
  }

  describe("hypothesis.service", () => {
    test("get returns defaultHypotheses when row missing", async () => {
      const { client } = fakeClient({ findUniqueResult: null });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = createHypothesisService({ client: client as any });
      const result = await service.get("user-uuid");
      expect(result).toEqual(defaultHypotheses);
    });

    test("get maps a present row to camelCased Hypotheses", async () => {
      const row = {
        salaireNet: 4000,
        ticketRestoJour: 14,
        partEmployeurTr: 0.6,
        joursTravailles: 20,
        navigoCout: 90,
        partEmployeurNavigo: 0.5,
        mutuelleEconomie: 30,
        loyer: 1200,
        courses: 200,
        transport: 45,
        autresCharges: 150,
        sorties: 250,
        divers: 120,
        voyageMois: 600,
        creditMensuel: 250,
        dateDebutCredit: "01/2027",
        matelasCible: 10000,
        perfEtfAnnuelle: 0.07,
        augmentationSalaire: 0.03,
        partEtfMonde: 0.8,
        partOpportunites: 0.2,
        economieRemoteMois: 1000,
        moisRemoteAn: 6,
        revenuFreelanceMois: 300,
        horizonYears: 5,
        objectif: 120000,
      };
      const { client } = fakeClient({ findUniqueResult: row });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = createHypothesisService({ client: client as any });
      const result = await service.get("user-uuid");
      expect(result.salaireNet).toBe(4000);
      expect(result.loyer).toBe(1200);
      expect(result.objectif).toBe(120000);
    });

    test("save calls upsert with exact { where: { userId }, update, create } shape", async () => {
      const persistedRow = {
        ...defaultHypotheses,
        loyer: 1300,
      };
      const { client, mocks } = fakeClient({ upsertResult: persistedRow });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = createHypothesisService({ client: client as any });
      const input: Hypotheses = { ...defaultHypotheses, loyer: 1300 };
      const result = await service.save("user-uuid", input);
      expect(result.loyer).toBe(1300);
      expect(mocks.upsert).toHaveBeenCalledTimes(1);
      const call = mocks.upsert.mock.calls[0][0];
      expect(call.where).toEqual({ userId: "user-uuid" });
      expect(call.update.loyer).toBe(1300);
      expect(call.create.userId).toBe("user-uuid");
      expect(call.create.loyer).toBe(1300);
    });
  });
  ```

  Run: `bun --cwd apps/api test src/modules/hypothesis/hypothesis.service.test.ts`.
  Expected: `3 pass`, `0 fail`, exit 0.
  Commit: `git add apps/api/src/modules/hypothesis/hypothesis.service.ts apps/api/src/modules/hypothesis/hypothesis.service.test.ts && git commit -m "feat(#6): add hypothesis.service with userId-guarded upsert"`

- [x] **Task 9 — Create `hypothesis.routes.ts` (oRPC handlers)** [AC: AC-1, AC-4]

  Create `apps/api/src/modules/hypothesis/hypothesis.routes.ts`:

  ```ts
  // apps/api/src/modules/hypothesis/hypothesis.routes.ts
  // oRPC handlers for the hypothesis module. The router is built from the
  // shared @pekulo/contracts contract via os.contract(...).router({ ... }).
  // Each handler reads { userId } from the oRPC `context` (injected by
  // mountOrpc after JWT verification) and delegates to the service.

  import { os } from "@orpc/server";
  import { hypothesisContract } from "@pekulo/contracts";
  import { PekuloError } from "../../common/errors";
  import type { HypothesisService } from "./hypothesis.service";

  // Typed oRPC context for routes that require an authenticated user. The
  // mountOrpc layer is responsible for populating this context — handlers
  // should never reach into Headers themselves.
  const orpc = os.$context<{ userId: string; email: string | null }>();

  export function createHypothesisRouter(deps: { service: HypothesisService }) {
    return orpc.contract(hypothesisContract).router({
      get: async ({ context }) => {
        if (!context.userId) {
          throw new PekuloError("UNAUTHORIZED", "user context missing");
        }
        return deps.service.get(context.userId);
      },
      save: async ({ context, input }) => {
        if (!context.userId) {
          throw new PekuloError("UNAUTHORIZED", "user context missing");
        }
        return deps.service.save(context.userId, input);
      },
    });
  }
  ```

  Run: `bun --cwd apps/api run typecheck`.
  Expected: exit 0.
  Commit: `git add apps/api/src/modules/hypothesis/hypothesis.routes.ts && git commit -m "feat(#6): add hypothesis oRPC router (get/save)"`

- [x] **Task 10 — Create `hypothesis.module.ts` factory** [AC: AC-4]

  Create `apps/api/src/modules/hypothesis/hypothesis.module.ts`:

  ```ts
  // apps/api/src/modules/hypothesis/hypothesis.module.ts
  // Module factory wiring service + router for the hypothesis domain. Mirrors
  // ADR-0009's module-factory pattern (createXxxModule(deps) → { router, service? }).

  import type { PrismaService } from "../../database";
  import { createHypothesisService, type HypothesisService } from "./hypothesis.service";
  import { createHypothesisRouter } from "./hypothesis.routes";

  export interface HypothesisModule {
    service: HypothesisService;
    router: ReturnType<typeof createHypothesisRouter>;
  }

  export function createHypothesisModule(deps: { prismaService: PrismaService }): HypothesisModule {
    const service = createHypothesisService({ client: deps.prismaService.client });
    const router = createHypothesisRouter({ service });
    return { service, router };
  }
  ```

  Run: `bun --cwd apps/api run typecheck`.
  Expected: exit 0.
  Commit: `git add apps/api/src/modules/hypothesis/hypothesis.module.ts && git commit -m "feat(#6): add hypothesis module factory"`

### Phase D — Mount integration (Tasks 11-13)

- [x] **Task 11 — Refactor `orpc-mount.ts` to accept deps + thread auth/log** [AC: AC-1, AC-3]

  Replace the entire body of `apps/api/src/platform/http/orpc-mount.ts` with:

  ```ts
  // apps/api/src/platform/http/orpc-mount.ts
  // Mount the oRPC fetch handler at /rpc/v1/* on an Elysia app. Builds a fresh
  // RPCHandler from the assembled router (one per process), threads the JWT
  // verification + structured request log timer around handler.handle.
  //
  // Story 0-5 introduced this file with an empty router; story 0-6 wires the
  // first feature module (hypothesis) and adds the auth + log spine. Feature
  // stories progressively expand `orpcRouter` with more module routers.

  import type { AnyElysia } from "elysia";
  import { RPCHandler } from "@orpc/server/fetch";

  import { PekuloError, isPekuloError } from "../../common/errors";
  import { mapErrorToOrpcResponse } from "./error-mapper";
  import { logRpcRequest } from "./request-log";
  import { requireUserContext, type JwtVerifier } from "../security";

  export type PekuloRpcRouter = ConstructorParameters<typeof RPCHandler<object>>[0];

  export interface MountOrpcDeps {
    jwtVerifier: JwtVerifier;
    orpcRouter: PekuloRpcRouter;
  }

  /**
   * Build the oRPC RPCHandler. Feature stories build the input router via
   * `os.contract(<moduleContract>).router({ ...handlers })` and pass the
   * assembled top-level `{ <moduleKey>: moduleRouter }` to mountOrpc.
   *
   * **DX trap warning** — pass the result of os.contract(...).router({...}),
   * NOT a raw contract object. Both type-check against RPCHandler's permissive
   * Router<any, T>, but a contract object dispatches on no handler at runtime
   * and 404s every well-formed call.
   */
  function createPekuloRpcHandler(router: PekuloRpcRouter): RPCHandler<object> {
    return new RPCHandler(router);
  }

  /**
   * Mount /rpc/v1/* on the provided Elysia app and return the app for chaining.
   *
   * L2 enforcement: `app: AnyElysia` (no bare `Elysia`), return type INFERRED
   * (no annotation).
   */
  export function mountOrpc(app: AnyElysia, deps: MountOrpcDeps) {
    const handler = createPekuloRpcHandler(deps.orpcRouter);

    return app.all("/rpc/v1/*", async ({ request }) => {
      const requestId = crypto.randomUUID();
      const startedAt = performance.now();
      const url = new URL(request.url);
      // route key = "<module>.<method>" derived from the URL path; used in
      // the structured log line per AC-1. The path looks like
      // /rpc/v1/hypothesis/save → "hypothesis.save".
      const routeSegments = url.pathname.replace(/^\/rpc\/v1\//, "").split("/");
      const route = routeSegments.length >= 2
        ? `${routeSegments[0]}.${routeSegments[1]}`
        : url.pathname;

      try {
        const userContext = await requireUserContext(request.headers, deps.jwtVerifier);
        const { matched, response } = await handler.handle(request, {
          prefix: "/rpc/v1",
          context: userContext,
        });
        if (!matched) {
          throw new PekuloError(
            "NOT_FOUND",
            `no oRPC procedure matched ${url.pathname}`,
          );
        }
        const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
        logRpcRequest({
          requestId,
          route,
          userId: userContext.userId,
          durationMs,
          status: response.status,
        });
        return response;
      } catch (err) {
        const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
        const mapped = mapErrorToOrpcResponse(err, requestId);
        logRpcRequest({
          requestId,
          route,
          userId: isPekuloError(err) && err.code !== "UNAUTHORIZED" ? "unknown" : "anonymous",
          durationMs,
          status: mapped.status,
          errorCode: mapped.body.error.code,
        });
        // Re-throw so the global Elysia .onError(...) shapes the wire body
        // uniformly — keeps the mount layer free of duplicated error-mapping
        // logic. The .onError handler will generate ITS OWN requestId; that
        // duplication is acceptable for now (the structured log already
        // captured the mount-side requestId). Story 0-7 will unify by passing
        // the requestId through Elysia store.
        throw err;
      }
    });
  }
  ```

  Run: `bun --cwd apps/api run typecheck`.
  Expected: exit 0.
  Commit: `git add apps/api/src/platform/http/orpc-mount.ts && git commit -m "refactor(#6): mountOrpc accepts deps, threads auth + structured log"`

- [x] **Task 12 — Wire `runtime-dependencies.ts` to expose `jwtVerifier` + `orpcRouter`** [AC: AC-1, AC-4]

  Replace the entire body of `apps/api/src/bootstrap/runtime-dependencies.ts` with:

  ```ts
  import type { Env } from "../config/env";
  import { createPrismaService, type PrismaService } from "../database";
  import { createReadiness, type Readiness } from "./readiness";
  import { createJwtVerifier, type JwtVerifier } from "../platform/security";
  import type { PekuloRpcRouter } from "../platform/http/orpc-mount";
  import { createHypothesisModule } from "../modules/hypothesis/hypothesis.module";

  export interface RuntimeDeps {
    env: Env;
    readiness: Readiness;
    prismaService: PrismaService;
    jwtVerifier: JwtVerifier;
    orpcRouter: PekuloRpcRouter;
  }

  // F10 (carry-over from 0-3): single transient probe failure should not yank
  // traffic. Track consecutive failures and only flip ok:false after two in a
  // row.
  const PRISMA_PROBE_FAILURE_THRESHOLD = 2;

  export async function createRuntimeDependencies(input: { env: Env }): Promise<RuntimeDeps> {
    const readiness = createReadiness();
    const prismaService = createPrismaService({ databaseUrl: input.env.DATABASE_URL });

    let consecutivePrismaFailures = 0;
    readiness.register("prisma", async () => {
      try {
        await prismaService.client.$queryRaw`SELECT 1`;
        consecutivePrismaFailures = 0;
        return { ok: true };
      } catch (err) {
        consecutivePrismaFailures += 1;
        const reason = err instanceof Error ? err.message : String(err);
        if (consecutivePrismaFailures < PRISMA_PROBE_FAILURE_THRESHOLD) {
          return { ok: true, reason: `prisma transient (${reason})` };
        }
        return {
          ok: false,
          reason: `prisma down (${consecutivePrismaFailures} consecutive): ${reason}`,
        };
      }
    });

    const jwtVerifier = createJwtVerifier({ secret: input.env.SUPABASE_JWT_SECRET });
    const hypothesisModule = createHypothesisModule({ prismaService });
    const orpcRouter: PekuloRpcRouter = {
      hypothesis: hypothesisModule.router,
    };

    return {
      env: input.env,
      readiness,
      prismaService,
      jwtVerifier,
      orpcRouter,
    };
  }
  ```

  Run: `bun --cwd apps/api run typecheck`.
  Expected: exit 0.
  Commit: `git add apps/api/src/bootstrap/runtime-dependencies.ts && git commit -m "chore(#6): expose jwtVerifier + orpcRouter from runtime deps"`

- [x] **Task 13 — Wire `app.ts` to pass deps to `mountOrpc`** [AC: AC-1, AC-3, AC-4]

  Edit `apps/api/src/app.ts`. Change ONLY line 37 (the `mountOrpc(app);` line) to:

  ```ts
    mountOrpc(app, { jwtVerifier: deps.jwtVerifier, orpcRouter: deps.orpcRouter });
  ```

  No other line changes. **L2 enforcement: `const app = new Elysia()` chain stays inferred — do NOT add any annotation.**

  Run: `bun --cwd apps/api run typecheck && bun --cwd apps/api dev` (the second command is a smoke — Ctrl-C after seeing the `[api] listening on http://...` log line).
  Expected: typecheck exits 0 ; dev server boots and prints `[api] listening on http://127.0.0.1:3001`.
  Commit: `git add apps/api/src/app.ts && git commit -m "chore(#6): wire mountOrpc with jwtVerifier + orpcRouter"`

### Phase A — Web AsyncLocalStorage + zapaction context (Tasks 14-15)

- [x] **Task 14 — Create `apps/web/src/lib/orpc/request-context.ts`** [AC: AC-1, AC-2]

  Create `apps/web/src/lib/orpc/request-context.ts`:

  ```ts
  // apps/web/src/lib/orpc/request-context.ts
  // AsyncLocalStorage-backed request context for the apps/web server tier.
  // Both server actions (zapaction's setActionContext resolver) AND RSC data
  // readers (apps/web/src/lib/data/*.ts) call ensureRequestContext() so the
  // RPCLink.headers thunk can read the access token without per-call plumbing.
  //
  // enterWith() transitions the AsyncLocalStorage into the context for the
  // remainder of the current synchronous execution and persists through any
  // following async calls within the same V8 ResourceContext. Next.js wraps
  // each request in its own ResourceContext, so concurrent requests have
  // isolated stores (no cross-contamination).

  import "server-only";

  import { AsyncLocalStorage } from "node:async_hooks";

  import { createClient } from "@/lib/supabase/server";

  export interface RequestContext {
    accessToken: string;
    userId: string;
    email: string | null;
  }

  const requestContextStore = new AsyncLocalStorage<RequestContext>();

  /**
   * Idempotent — returns the existing store entry if `enterWith` already ran
   * earlier in this request (e.g. zapaction's setActionContext resolver fired
   * first). Otherwise resolves the Supabase session, captures the access
   * token, and `enterWith`s the new context.
   */
  export async function ensureRequestContext(): Promise<RequestContext> {
    const existing = requestContextStore.getStore();
    if (existing) return existing;

    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw new Error("UNAUTHORIZED");
    }
    const ctx: RequestContext = {
      accessToken: session.access_token,
      userId: session.user.id,
      email: session.user.email ?? null,
    };
    requestContextStore.enterWith(ctx);
    return ctx;
  }

  /**
   * Synchronous getter — used by the RPCLink.headers thunk. Throws if called
   * outside an ensured request context (e.g. from a route handler that
   * forgot to call ensureRequestContext first).
   */
  export function getRequestContext(): RequestContext {
    const store = requestContextStore.getStore();
    if (!store) {
      throw new Error(
        "Request context not set. Call ensureRequestContext() first or invoke from inside a server action.",
      );
    }
    return store;
  }

  /**
   * Test-only — drains the AsyncLocalStorage for unit tests that need to
   * simulate "no context yet". Production code should never call this.
   */
  export function _resetRequestContextForTests(): void {
    requestContextStore.disable();
    requestContextStore.enable();
  }
  ```

  Run: `bun --cwd apps/web run typecheck`.
  Expected: exit 0.
  Commit: `git add apps/web/src/lib/orpc/request-context.ts && git commit -m "feat(#6): add AsyncLocalStorage request-context store for web tier"`

- [x] **Task 15 — Wire zapaction context + oRPC client headers thunk** [AC: AC-1, AC-2]

  Replace the entire body of `apps/web/src/lib/zapaction/context.ts` with:

  ```ts
  import "server-only";
  import { setActionContext } from "@zapaction/core";
  import type { SupabaseClient } from "@supabase/supabase-js";
  import { createClient } from "@/lib/supabase/server";
  import { ensureRequestContext } from "@/lib/orpc/request-context";

  // ActionContext keeps `supabase` for backward compat — brownfield actions
  // that haven't been ported yet (portfolio, transactions, monthly,
  // holding-lots) still call ctx.supabase.from(...). Their port stories
  // (2-1, 3-1, 5-1, 5-4) drop that dependency and remove `supabase` from
  // ActionContext.
  export type ActionContext = {
    supabase: SupabaseClient;
    userId: string;
    email: string | null;
  };

  setActionContext<ActionContext>(async () => {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw new Error("UNAUTHORIZED");
    }
    // Seed the AsyncLocalStorage so the oRPC client (called from inside
    // ported actions like apps/web/src/lib/actions/hypotheses.ts) can read
    // the access token from getRequestContext().
    await ensureRequestContext();
    return {
      supabase: supabase as unknown as SupabaseClient,
      userId: session.user.id,
      email: session.user.email ?? null,
    };
  });
  ```

  Replace the entire body of `apps/web/src/lib/orpc/client.ts` with:

  ```ts
  // apps/web/src/lib/orpc/client.ts
  // Server-only oRPC HTTP link to apps/api. Auth header forwarding wired in
  // story 0-6 — the headers thunk reads the per-request access token from the
  // AsyncLocalStorage `requestContextStore`. Story 0-7 (OTel) will append
  // tracing headers here.

  import "server-only";

  import { RPCLink } from "@orpc/client/fetch";
  import { getRequestContext } from "./request-context";

  function requireApiBaseUrl(): string {
    const apiBaseUrl = process.env.API_BASE_URL;
    if (!apiBaseUrl || apiBaseUrl.trim().length === 0) {
      throw new Error(
        "API_BASE_URL is not set. Configure it in .env / .env.local " +
          "(set to http://127.0.0.1:3001 for local dev).",
      );
    }
    return apiBaseUrl;
  }

  export const orpcLink = new RPCLink({
    url: () => `${requireApiBaseUrl()}/rpc/v1`,
    headers: () => ({
      Authorization: `Bearer ${getRequestContext().accessToken}`,
    }),
  });
  ```

  Run: `bun --cwd apps/web run typecheck`.
  Expected: exit 0.
  Commit: `git add apps/web/src/lib/zapaction/context.ts apps/web/src/lib/orpc/client.ts && git commit -m "feat(#6): forward Supabase JWT to oRPC via AsyncLocalStorage"`

### Phase E + F — Action refactor + read-path refactor + smoke harness (Task 16)

- [x] **Task 16 — Refactor hypotheses action + data reader, add dev-token, run end-to-end smoke** [AC: AC-1, AC-2, AC-3, AC-4]

  Replace the entire body of `apps/web/src/lib/actions/hypotheses.ts` with:

  ```ts
  "use server";

  import { defineAction } from "@zapaction/core";
  import { revalidatePath } from "next/cache";
  import { z } from "zod";
  import { hypothesesSchema, type Hypotheses } from "@pekulo/validators";
  import { hypothesisClient } from "@/lib/orpc/modules";
  import { hypothesesTags } from "@/lib/zapaction/keys";
  import type { ActionContext } from "@/lib/zapaction/context";
  import "@/lib/zapaction/context";

  // Story 0-6: action becomes a thin oRPC delegator. apps/api owns the row
  // mapping (rowToHypotheses / hypothesesToWriteData) + Prisma upsert. ctx
  // still carries `supabase` + `userId` + `email` for brownfield siblings,
  // but neither this action nor `apps/web/src/lib/data/hypotheses.ts` use
  // them anymore — both go through hypothesisClient.

  export const getHypotheses = defineAction<void, Hypotheses, ActionContext>({
    name: "getHypotheses",
    input: z.void(),
    handler: async () => {
      return hypothesisClient.get();
    },
  });

  export const saveHypotheses = defineAction<Hypotheses, Hypotheses, ActionContext>({
    name: "saveHypotheses",
    input: hypothesesSchema,
    output: hypothesesSchema,
    tags: [hypothesesTags.current()],
    handler: async ({ input }) => {
      const persisted = await hypothesisClient.save(input);
      revalidatePath("/dashboard");
      revalidatePath("/dashboard/parametres");
      return persisted;
    },
  });
  ```

  Replace the entire body of `apps/web/src/lib/data/hypotheses.ts` with:

  ```ts
  import "server-only";

  import { defaultHypotheses, type Hypotheses } from "@pekulo/validators";
  import { hypothesisClient } from "@/lib/orpc/modules";
  import { ensureRequestContext } from "@/lib/orpc/request-context";

  // Story 0-6: read path also goes through oRPC. The outer return shape is
  // preserved so the 4 RSC callers (dashboard, parametres, mensuel,
  // api/dashboard) stay byte-identical. `source: "default"` is unreachable
  // post-bridge (apps/api always returns defaults when no row), but the
  // discriminator is kept for caller robustness.

  export async function readHypotheses(): Promise<{
    hypotheses: Hypotheses;
    source: "db" | "default" | "error";
    error?: string;
  }> {
    try {
      await ensureRequestContext();
      const hypotheses = await hypothesisClient.get();
      return { hypotheses, source: "db" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // UNAUTHORIZED → render with defaults so the parametres page still
      // shows the form skeleton (the page-level auth guard already redirected
      // to login for truly logged-out users; this branch only fires on token
      // refresh races).
      if (message === "UNAUTHORIZED") {
        return { hypotheses: defaultHypotheses, source: "default" };
      }
      return {
        hypotheses: defaultHypotheses,
        source: "error",
        error: message,
      };
    }
  }
  ```

  Create `apps/api/scripts/dev-token.ts`:

  ```ts
  // apps/api/scripts/dev-token.ts
  // Mint a synthetic Supabase JWT signed with the local SUPABASE_JWT_SECRET.
  // Used by AC-1 / AC-3 smoke verification — NOT shipped in the production
  // build (lives in scripts/, not src/).
  //
  // Usage:
  //   bun apps/api/scripts/dev-token.ts <userId> [email]
  //
  // Example:
  //   bun apps/api/scripts/dev-token.ts 11111111-1111-1111-1111-111111111111 alex@pekulo.app

  import { SignJWT } from "jose";
  import { config } from "dotenv";
  import { resolve } from "node:path";

  // Load .env / .env.local from repo root (same as Pekulo's monorepo convention).
  config({ path: resolve(import.meta.dir, "..", "..", "..", ".env") });
  config({ path: resolve(import.meta.dir, "..", "..", "..", ".env.local"), override: true });

  const userId = process.argv[2];
  const email = process.argv[3] ?? "alex@pekulo.app";
  if (!userId) {
    console.error("usage: bun apps/api/scripts/dev-token.ts <userId> [email]");
    process.exit(1);
  }

  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret || secret.length < 32) {
    console.error("SUPABASE_JWT_SECRET is not set or shorter than 32 chars");
    process.exit(1);
  }

  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(new TextEncoder().encode(secret));

  // Single line — easy to capture into a shell var via $(...).
  console.log(token);
  ```

  Now run the **end-to-end smoke** (verifies AC-1, AC-3, AC-4 deterministically):

  Step (a) — start apps/api in one terminal:

  ```bash
  bun --cwd apps/api dev 2>&1 | tee /tmp/pekulo-api-stdout.log
  ```

  Wait for `[api] listening on http://127.0.0.1:3001`.

  Step (b) — in a second terminal, mint a synthetic token:

  ```bash
  TOKEN=$(bun apps/api/scripts/dev-token.ts 11111111-1111-1111-1111-111111111111)
  echo "$TOKEN" | head -c 60   # sanity: should print a JWT prefix like eyJhbGciOi...
  ```

  Step (c) — verify AC-3 (auth failures):

  ```bash
  # No header
  curl -s -o /dev/null -w "no-header=%{http_code}\n" -X POST -H "Content-Type: application/json" -d '{}' http://127.0.0.1:3001/rpc/v1/hypothesis/get
  # Bad scheme
  curl -s -o /dev/null -w "bad-scheme=%{http_code}\n" -X POST -H "Content-Type: application/json" -H "Authorization: not-a-bearer" -d '{}' http://127.0.0.1:3001/rpc/v1/hypothesis/get
  # Garbled JWT
  curl -s -o /dev/null -w "bad-jwt=%{http_code}\n" -X POST -H "Content-Type: application/json" -H "Authorization: Bearer eyInvalid.eyInvalid.eyInvalid" -d '{}' http://127.0.0.1:3001/rpc/v1/hypothesis/get
  # Wrong secret (mint a token with a different SUPABASE_JWT_SECRET)
  WRONG_TOKEN=$(SUPABASE_JWT_SECRET="different-secret-also-32-chars-long-bbbb" bun apps/api/scripts/dev-token.ts 22222222-2222-2222-2222-222222222222)
  curl -s -o /dev/null -w "wrong-secret=%{http_code}\n" -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $WRONG_TOKEN" -d '{}' http://127.0.0.1:3001/rpc/v1/hypothesis/get
  ```

  Expected stdout (4 lines):

  ```
  no-header=401
  bad-scheme=401
  bad-jwt=401
  wrong-secret=401
  ```

  Step (d) — verify AC-1 + AC-4 (round-trip + log line + DB persistence):

  ```bash
  # GET — first call returns defaultHypotheses (no row yet).
  curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{}' http://127.0.0.1:3001/rpc/v1/hypothesis/get | head -c 200

  # SAVE — bump objectif by 1.
  curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"salaireNet":3700,"ticketRestoJour":14,"partEmployeurTr":0.6,"joursTravailles":20,"navigoCout":90,"partEmployeurNavigo":0.5,"mutuelleEconomie":30,"loyer":1125,"courses":200,"transport":45,"autresCharges":150,"sorties":250,"divers":120,"voyageMois":600,"creditMensuel":250,"dateDebutCredit":"01/2027","matelasCible":10000,"perfEtfAnnuelle":0.07,"augmentationSalaire":0.03,"partEtfMonde":0.8,"partOpportunites":0.2,"economieRemoteMois":1000,"moisRemoteAn":6,"revenuFreelanceMois":300,"horizonYears":5,"objectif":100001}' http://127.0.0.1:3001/rpc/v1/hypothesis/save | head -c 200

  # GET again — row now exists with objectif: 100001.
  curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{}' http://127.0.0.1:3001/rpc/v1/hypothesis/get | head -c 200
  ```

  Expected: each curl returns a 200 with a JSON body matching `hypothesesSchema` shape (26 fields). The third call's body has `"objectif":100001`.

  Inspect the apps/api stdout log:

  ```bash
  grep '"event":"rpc.request"' /tmp/pekulo-api-stdout.log
  ```

  Expected: 7 lines (4 auth-failure 401s + 3 success 200s), each a single-line JSON with exactly the keys `event`, `requestId`, `route`, `userId`, `durationMs`, `status` (plus `errorCode` on the 401s). Sample assertion: one line should match the regex `"event":"rpc\.request","requestId":"[0-9a-f-]{36}","route":"hypothesis\.save","userId":"11111111-1111-1111-1111-111111111111","durationMs":[0-9]+,"status":200`.

  Step (e) — verify AC-2 (UI renders unchanged):

  In a third terminal, start apps/web:

  ```bash
  bun --cwd apps/web dev
  ```

  Open `http://localhost:3000/dashboard/parametres` in the browser (must be logged in via Supabase). Sentinel checks:

  - The hypothesis form fields `salaireNet`, `loyer`, `objectif` are populated with the values persisted in step (d) (objectif should read `100001`).
  - Submitting the form triggers `useActionMutation(saveHypotheses)` ; no error toast appears ; the page revalidates without a console error in either tier.
  - `bun --cwd apps/api dev`'s stdout shows two new `rpc.request` log lines (one for the RSC `read` via `readHypotheses → hypothesisClient.get`, one for the `save` mutation).

  Step (f) — final L2 grep gate:

  ```bash
  grep -nE ': Elysia\b' apps/api/src
  ```

  Expected: zero matches (any `AnyElysia` matches do NOT match the regex above because it requires a non-letter boundary right after `Elysia` — `AnyElysia` has `\b` only at the START, not the end).

  Stop the dev servers with `kill %1` (per terminal).

  Commit (one commit covering the action refactor + data refactor + smoke harness):

  ```bash
  git add apps/web/src/lib/actions/hypotheses.ts apps/web/src/lib/data/hypotheses.ts apps/api/scripts/dev-token.ts && git commit -m "feat(#6): port hypothesis brownfield action + data reader to oRPC bridge"
  ```

---

## Dev Agent Record

- **Model:** claude-opus-4-7[1m]
- **Started:** 2026-05-04T22:00:00Z
- **Completed:** 2026-05-04T22:30:00Z

### Debug Log

- **Bun typecheck path quirk** — `bun --cwd <path> run <script>` silently returns wrong cwd output (Watch item from 0-3 + L1). Workaround: `(cd <path> && bun run <script>)`. Used throughout the dev pass.
- **Env loading** — apps/api `bun src/main.ts` doesn't auto-load root `.env.local`. Repo convention is to wrap with `dotenv-cli`: `bunx dotenv-cli -c -e .env.local -e .env -- bun apps/api/src/main.ts`. Required for boot smoke (T13) + e2e harness (T16).
- **oRPC API drift vs spec** — story spec referenced `os.contract(...)` but @orpc/server@1.14.x exposes `implement(contract).$context<T>().router({...})` instead. Routes file (T9) ported to the supported API; mount-side `RPCHandler<PekuloRpcContext>` typed against `UserContext` to satisfy the router context type.
- **`AsyncLocalStorage.enable()`** — story spec's `_resetRequestContextForTests` called `disable()` then `enable()`. Node only exposes `disable()`; `enable()` is not a public method. Reset helper now drains via `disable()` only.
- **Prisma upsert.create id type** — Prisma's static type requires `id` on create even though the prefixed-IDs extension auto-injects at runtime (ADR-0012). Service casts the create branch via `unknown as Parameters<...>[0]["create"]` to keep domain code free of `Prisma.*UncheckedCreateInput` plumbing.
- **`@pekulo/validators` zod dep** — package.json was missing `zod` as a direct dep (relied on workspace hoisting). Added `"zod": "4.3.6"` exact-pinned to fix module resolution from apps/api + apps/web.
- **`apps/web` missing `@pekulo/validators` workspace dep** — added in T6 to fix the schemas/types re-export imports.
- **Bun `mock(async () => …)` arg-tuple narrowing** — without explicit fn arg signature, `mock.calls[i][0]` is typed as `never`. Test fixed by typing the mock signature: `mock(async (_args: UpsertArgs) => …)`.
- **E2E smoke partial verification (against remote Supabase)** — `.env.local`'s `DATABASE_URL` points to the production Supabase project (pooler.supabase.com:6543). FK constraint `hypotheses.user_id REFERENCES auth.users(id)` rejects the synthetic UUID `11111111-…` from the dev-token script (returns 500 on save). Workarounds: (a) run a local Supabase Docker stack and pre-seed the synthetic user, OR (b) re-run the smoke with the real Alex `auth.users.id` UUID. Either path unblocks AC-1 success log line + AC-4 persistence end-to-end.

### Completion Notes

**ACs verified (deterministic):**
- **AC-3 (auth failures)** — 4/4 cases return 401: missing header, malformed scheme, garbled JWT, wrong-secret JWT. All return `{"error":{"code":"UNAUTHORIZED","message":<…>,"requestId":<uuid-v4>}}` body shape via the global Elysia `.onError` mapper. Verified via `bun:test` (4 cases on `require-user-context.test.ts`) + 4 e2e curl smokes.
- **AC-4 (service shape)** — 3/3 unit tests pass on stubbed Prisma: get-default (findUnique → null returns `defaultHypotheses`), get-existing (findUnique → row → camelCased), save-upsert (asserts exact `{ where: { userId }, update, create }` clauses + `where: { userId }` ADR-0013 belt+suspenders).
- **AC-1 (structured log)** — log-line shape verified across 8+ requests in `/tmp/pekulo-api-stdout.log`. Each line is single-line JSON with exactly `{ event, requestId, route, userId, durationMs, status }` plus `errorCode` only when `status >= 400`. Mount-layer instrumentation confirmed: `requestId = crypto.randomUUID()` per request, `route = "<module>.<method>"` derived from URL path, `durationMs = Math.max(0, Math.round(performance.now() − startedAt))`. JWT verification + `requireUserContext` runs BEFORE `RPCHandler.handle`, so unauthenticated requests log `userId: "anonymous"`.

**ACs partially verified (need user resources):**
- **AC-1 + AC-4 round-trip success path (200)** — needs a user present in remote Supabase `auth.users`. The synthetic UUID smoke covers the failure path + log-line shape; production round-trip needs Alex's real `auth.users.id`.
- **AC-2 (UI sentinel)** — needs `bun --cwd apps/web dev` + a logged-in browser session. Manual user verification required: load `/dashboard/parametres`, confirm form fields populate, bump `objectif`, confirm reload re-displays new value, confirm 2 new `rpc.request` log lines (one read, one save).

**L2 enforcement gate**: `grep -nE ': Elysia\b' apps/api/src` returns zero matches.

**Spec deviations (intentional, all documented above):**
1. `hypothesis.routes.ts` uses `implement(contract).$context<T>().router(...)` instead of the spec's `os.contract(...)` (API drift).
2. `request-context.ts` `_resetRequestContextForTests` uses only `disable()` (no `enable()` in Node).
3. `hypothesis.service.ts` casts `upsert.create` to bypass Prisma's static `id` requirement (extension auto-injects at runtime).
4. `packages/validators/package.json` adds direct `zod` dep + `apps/web/package.json` adds `@pekulo/validators` workspace dep (transitive resolution insufficient).

### File List

**Created (17):**
- `apps/api/src/platform/security/jwt-verifier.ts`
- `apps/api/src/platform/security/jwt-verifier.test.ts`
- `apps/api/src/platform/security/require-user-context.ts`
- `apps/api/src/platform/security/require-user-context.test.ts`
- `apps/api/src/platform/security/index.ts`
- `apps/api/src/platform/http/request-log.ts`
- `apps/api/src/modules/hypothesis/hypothesis.service.ts`
- `apps/api/src/modules/hypothesis/hypothesis.service.test.ts`
- `apps/api/src/modules/hypothesis/hypothesis.routes.ts`
- `apps/api/src/modules/hypothesis/hypothesis.module.ts`
- `apps/api/scripts/dev-token.ts`
- `apps/web/src/lib/orpc/request-context.ts`
- `packages/validators/src/hypothesis.ts`

**Modified (10):**
- `apps/api/package.json` (jose dep, @pekulo/validators workspace dep)
- `apps/api/src/config/env.ts` (SUPABASE_JWT_SECRET schema)
- `apps/api/src/platform/index.ts` (corrected stale 0-5 → 0-6 comment)
- `apps/api/src/platform/http/orpc-mount.ts` (deps + auth + log timer)
- `apps/api/src/bootstrap/runtime-dependencies.ts` (jwtVerifier + orpcRouter)
- `apps/api/src/app.ts` (mountOrpc deps wiring)
- `apps/web/package.json` (@pekulo/validators workspace dep)
- `apps/web/src/lib/zapaction/context.ts` (auth.getSession + ensureRequestContext)
- `apps/web/src/lib/orpc/client.ts` (Authorization headers thunk)
- `apps/web/src/lib/actions/hypotheses.ts` (thin oRPC delegators)
- `apps/web/src/lib/data/hypotheses.ts` (oRPC read path, preserves return shape)
- `apps/web/src/lib/schemas/hypotheses.ts` (re-export from @pekulo/validators)
- `apps/web/src/lib/types.ts` (re-export Hypotheses + defaultHypotheses)
- `packages/validators/src/index.ts` (barrel)
- `packages/validators/package.json` (zod direct dep)
- `packages/contracts/src/hypothesis.contract.ts` (oc.input/output procedures)
- `.env.example` (SUPABASE_JWT_SECRET docblock)
- `.env.local` (SUPABASE_JWT_SECRET local placeholder; gitignored)

### Lessons Emerged

> Captured by `aped-review` after the dev pass. New patterns / corrections that warrant a `docs/lessons.md` entry land here.

Candidate lessons surfaced during dev (review will validate):
- **L6 candidate** — `@orpc/server@1.14.x` exposes `implement(contract)` not `os.contract(...)`. Story specs should quote the exact symbol from the pinned package's `.d.ts`, not paraphrase from the docs site.
- **L7 candidate** — Prisma 7's static type for `upsert.create` requires `id: string` even when an extension auto-injects via `Prisma.defineExtension({ query: $allModels.upsert })`. Domain services need a `unknown as Parameters<…>[0]["create"]` cast OR an `id?: string` Omit type at the boundary.
- **L8 candidate** — `AsyncLocalStorage.enable()` is not a public Node API; only `disable()` exists (and is itself deprecated in favor of `run`/`enterWith` lifecycle).
