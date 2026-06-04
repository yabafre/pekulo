# Story: 7-1-dashboard-orchestration — Dashboard cross-domain aggregator + total wealth + cache invalidation

**Epic:** Epic 7 — Dashboard & projection
**Status:** done
**Ticket:** [#38](https://github.com/yabafre/pekulo/issues/38)
**Branch:** feature/38-7-1-dashboard-orchestration
**Complexity:** M
**Covered FRs:** FR-43, FR-44 · **Binding NFRs:** NFR-1, NFR-16, NFR-18, NFR-19

## User Story

**As a** Pekulo user, **I want** the dashboard to compute total wealth as cash + FX-adjusted holdings + net real-estate equity, and to refresh after any wealth-affecting mutation via the cache invalidation registry, **so that** my dashboard always reflects the current state.

## Acceptance Criteria

- **AC-1 (FR-43 — total wealth):** **Given** 5 accounts (cash balances summing to 20 000 €), 6 holdings (each ticker resolves live to 100 €, quantity 10, EUR), and 1 property (net equity 250 000 €), **When** the dashboard overview computes, **Then** total wealth equals 276 000 € — the explicit sum of the FX-adjusted portfolio capital total (26 000 €) and the net real-estate equity (250 000 €) — matching the hand-computed reference.
- **AC-2 (FR-43 — composition):** **Given** the same fixture, **When** the overview computes, **Then** it exposes a composition of liquid 20 000 €, placements 6 000 €, real-estate 250 000 €, and the three parts sum exactly to total wealth.
- **AC-3 (FR-43 — compass compose):** **Given** a compass target of 800 000 €, **When** the overview computes, **Then** it returns a compass progress of 34.5 % with a 524 000 € gap, derived from the live total wealth against that target; **Given** the user has no compass yet, **Then** the overview returns a null compass and does not error.
- **AC-4 (live-price graceful fallback — NFR-18):** **Given** one holding whose live price lookup fails (all providers down) and one holding with no ticker, **When** the overview computes, **Then** both fall back to their last stored price, the overview still returns a value, and it never errors on a price miss.
- **AC-5 (FR-44 — cache invalidation):** **Given** the dashboard overview is cached, **When** any wealth-affecting mutation fires its invalidation tag (a transaction, account, holding, property, or compass change), **Then** the dashboard overview cache entry is invalidated through the tag registry and refetches.
- **AC-6 (oRPC surface):** **Given** an authenticated request to the dashboard overview endpoint, **When** it is called, **Then** it returns a valid overview payload; **Given** no authentication, **Then** it returns 401.

> **NFR-1 note (documented deviation):** the overview prices holdings live via the 4-tier chain behind the holdings module's 60 s in-memory cache. NFR-1 (compass-progress < 300 ms p95 on `/dashboard`) is met on cache-warm loads. Cold-cache loads (first request after the 60 s TTL elapses) accept the price-chain latency (NFR-2: 1.5 s p95 cached / 4 s p95 cold) as a **known, documented deviation** — chosen over a stored-price fast-path during step-04 collaborative design. Recorded in `docs/architecture.md` (T11).

## Tasks

> Each task carries a full code block, an exact test command, the expected pass line, and a literal commit. The dev agent has **zero inherited context** — copy the blocks verbatim, do not infer. `apps/api` tests use `bun:test`; `apps/web` tests use `vitest`. NEVER `bun --cwd <relative>`; use `bun --filter=@pekulo/<pkg> …` (package name, not folder). NEVER `git add .` / `git add -A` — stage only the listed files. Run the workspace `typecheck` before each commit (`tsc` is not in the pre-commit gate).

- [x] **T1 — `dashboardOverviewSchema` in `@pekulo/validators`** [AC: AC-1, AC-2, AC-3, AC-6]

Create `packages/validators/src/dashboard/dashboard.schemas.ts`:
```ts
// packages/validators/src/dashboard/dashboard.schemas.ts
// Dashboard overview aggregate (story 7-1 / FR-43). The dashboard owns no
// tables — this schema describes the cross-domain OVERVIEW the
// dashboard.service composes from accounts + holdings + realestate + compass.
// `fx.source` mirrors PortfolioSnapshotFx.fxSource (NFR-19 transparency).

import { z } from "@pekulo/zod";
import { fxSourceSchema } from "../holdings";

export const dashboardCompositionSchema = z.object({
  liquideEur: z.number(),
  placementsEur: z.number(),
  immobilierEur: z.number(),
});
export type DashboardComposition = z.infer<typeof dashboardCompositionSchema>;

// Non-null only when the user has a compass row. percent/gap come from the
// pure computeProgress() over the LIVE total wealth; objectif echoes the
// compass target so the page renders without a second compass read.
export const dashboardCompassSchema = z.object({
  percent: z.number(),
  objectif: z.number(),
  gap: z.number(),
});
export type DashboardCompass = z.infer<typeof dashboardCompassSchema>;

export const dashboardOverviewSchema = z.object({
  totalWealthEur: z.number(),
  composition: dashboardCompositionSchema,
  compass: dashboardCompassSchema.nullable(),
  fx: z.object({
    source: fxSourceSchema,
    asOf: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "asOf must be YYYY-MM-DD")
      .nullable(),
  }),
});
export type DashboardOverview = z.infer<typeof dashboardOverviewSchema>;
```
Create `packages/validators/src/dashboard/index.ts`:
```ts
export * from "./dashboard.schemas";
```
Edit `packages/validators/src/index.ts` — add the export next to the other module barrels (after `export * from "./realestate";`):
```ts
export * from "./dashboard";
```
Run: `bun --filter=@pekulo/validators run typecheck`
Expected: no output, exit 0.
Commit: `git add packages/validators/src/dashboard packages/validators/src/index.ts && git commit -m "feat(#38): add dashboardOverviewSchema (FR-43)"`

- [x] **T2 — Populate the dashboard oRPC contract** [AC: AC-6]

Replace the body of `packages/contracts/src/dashboard/dashboard.contract.ts`:
```ts
// packages/contracts/src/dashboard/dashboard.contract.ts
// Dashboard module oRPC contract. One read procedure:
//   - getOverview: cross-domain wealth aggregate (FR-43). No input.
// See ADR-0009 (mount under /rpc/v1/dashboard).

import { oc } from "@orpc/contract";
import { dashboardOverviewSchema } from "@pekulo/validators";

export const dashboardContractV1 = {
  getOverview: oc.output(dashboardOverviewSchema),
} as const;

export const dashboardContract = dashboardContractV1;
export const dashboardContractMeta = {
  moduleKey: "dashboard",
  mountPath: "/rpc/v1/dashboard",
  version: "v1",
} as const;
```
Run: `bun --filter=@pekulo/contracts run typecheck`
Expected: no output, exit 0.
Commit: `git add packages/contracts/src/dashboard/dashboard.contract.ts && git commit -m "feat(#38): declare dashboard.getOverview contract (FR-43)"`

- [x] **T3 — `dashboard.service.ts` + service test** [AC: AC-1, AC-2, AC-3, AC-4]

Create `apps/api/src/modules/dashboard/dashboard.service.ts`:
```ts
// apps/api/src/modules/dashboard/dashboard.service.ts
// Cross-domain dashboard aggregator (story 7-1 / FR-43, FR-44).
//
// The dashboard OWNS NO TABLES. It is a pure COMPOSITION layer over the
// accounts, holdings, realestate and compass modules — wired in
// runtime-dependencies.ts as narrow read ports (no repository, no Prisma,
// no cross-module repository-type leak; mirrors the CompassReader /
// WealthHistoryProvider port shapes — L1 conformance).
//
// total wealth (FR-43) =
//   computeSnapshotFx(accounts, live-priced holdings, rates).kpi.capitalTotal
//   + realestate.getTotalEquity().totalEquityEur
//
// Holdings are priced LIVE through the 4-tier chain (resolveQuote, behind the
// holdings module's 60s in-memory cache). Per-holding resolution failures (all
// tiers down) or null-ticker holdings degrade gracefully to the stored
// lastPrice — getOverview NEVER throws on a price miss (NFR-18 spirit). NFR-1
// (compass-progress < 300ms p95) is met on cache-warm loads; cold-cache loads
// accept the price-chain latency (NFR-2) as a documented deviation (see story
// + architecture.md).

import { computeSnapshotFx } from "../../common/derive/portfolio-fx";
import type {
  ComputeProgressInput,
  ComputeProgressOutput,
} from "../../common/derive/compass-progress";
import type {
  Account,
  DashboardOverview,
  FxRates,
  Holding,
  HoldingCurrency,
  PriceQuote,
  PriceQuoteInput,
} from "@pekulo/validators";

// Narrow read ports — the service depends ONLY on what it consumes. getCompass
// is narrowed to `{ objectif }` (the only field read) so the dashboard never
// imports the full Compass type (L1). The wiring (runtime-dependencies.ts)
// maps them onto the real module services.
export interface DashboardPorts {
  listAccounts: (userId: string) => Promise<Account[]>;
  listHoldings: (userId: string) => Promise<Holding[]>;
  resolveQuote: (input: PriceQuoteInput) => Promise<PriceQuote>;
  getRates: (base: HoldingCurrency) => Promise<FxRates>;
  getTotalEquity: (userId: string) => Promise<{ totalEquityEur: number }>;
  getCompass: (userId: string) => Promise<{ objectif: number } | null>;
  computeProgress: (input: ComputeProgressInput) => ComputeProgressOutput;
}

export interface DashboardService {
  getOverview(userId: string): Promise<DashboardOverview>;
}

export function createDashboardService(deps: DashboardPorts): DashboardService {
  // Enrich each holding with a LIVE price; fall back to the stored lastPrice on
  // a null ticker (manual entry) or any resolveQuote rejection (all tiers
  // failed — NFR-18). Parallel: the holdings module's 60s PricesCache fronts
  // resolveQuote, so steady-state loads are cache hits.
  async function priceHoldings(holdings: Holding[]): Promise<Holding[]> {
    return Promise.all(
      holdings.map(async (h) => {
        if (!h.ticker) return h;
        try {
          const quote = await deps.resolveQuote({
            ticker: h.ticker,
            kind: h.kind,
            currency: h.currency,
          });
          return { ...h, lastPrice: quote.price };
        } catch {
          return h; // graceful fallback to stored lastPrice
        }
      }),
    );
  }

  return {
    async getOverview(userId) {
      const [accounts, holdings, rates, equity, compassRow] = await Promise.all([
        deps.listAccounts(userId),
        deps.listHoldings(userId),
        // FX is best-effort (NFR-19): a frankfurter failure → null → 1:1 fallback.
        deps.getRates("EUR").catch(() => null),
        deps.getTotalEquity(userId),
        deps.getCompass(userId),
      ]);

      const priced = await priceHoldings(holdings);
      const snapshot = computeSnapshotFx(accounts, priced, rates, "EUR");
      const totalWealthEur = snapshot.kpi.capitalTotal + equity.totalEquityEur;

      const compass = compassRow
        ? {
            ...deps.computeProgress({
              currentWealth: totalWealthEur,
              capitalTarget: compassRow.objectif,
            }),
            objectif: compassRow.objectif,
          }
        : null;

      return {
        totalWealthEur,
        composition: {
          liquideEur: snapshot.kpi.cash,
          placementsEur: snapshot.kpi.marketValue,
          immobilierEur: equity.totalEquityEur,
        },
        compass,
        fx: { source: snapshot.fxSource, asOf: snapshot.fxAsOf },
      };
    },
  };
}
```
Create `apps/api/src/modules/dashboard/dashboard.service.test.ts`:
```ts
// apps/api/src/modules/dashboard/dashboard.service.test.ts
// AC-1..AC-4 — composition logic with stub ports + hand-computed reference.
import { describe, expect, test } from "bun:test";
import { computeProgress } from "../../common/derive/compass-progress";
import { createDashboardService, type DashboardPorts } from "./dashboard.service";
import type { Account, Holding } from "@pekulo/validators";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOW = new Date("2026-06-04T00:00:00Z");

function acct(over: Partial<Account>): Account {
  return {
    id: "acc_0000000000000000000001",
    userId: USER,
    label: "Compte",
    type: "livret",
    currency: "EUR",
    cashBalance: 0,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

function hold(over: Partial<Holding>): Holding {
  return {
    id: "hld_0000000000000000000001",
    userId: USER,
    accountId: "acc_0000000000000000000001",
    kind: "etf",
    ticker: "CW8",
    isin: null,
    label: "Holding",
    currency: "EUR",
    quantity: 10,
    avgCost: 80,
    lastPrice: 90,
    lastPriceAt: NOW,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    closedAt: null,
    ...over,
  };
}

// 5 accounts summing to 20 000 € cash; 6 EUR holdings (qty 10) priced live to
// 100 € each → marketValue 6 000 €; property net equity 250 000 €.
// capitalTotal = 20 000 + 6 000 = 26 000 ; totalWealth = 26 000 + 250 000 = 276 000.
function basePorts(over: Partial<DashboardPorts> = {}): DashboardPorts {
  return {
    listAccounts: async () => [
      acct({ id: "acc_1", cashBalance: 10_000 }),
      acct({ id: "acc_2", cashBalance: 5_000 }),
      acct({ id: "acc_3", cashBalance: 2_000 }),
      acct({ id: "acc_4", cashBalance: 3_000 }),
      acct({ id: "acc_5", cashBalance: 0 }),
    ],
    listHoldings: async () =>
      Array.from({ length: 6 }, (_, i) => hold({ id: `hld_${i + 1}`, ticker: `T${i + 1}` })),
    resolveQuote: async ({ ticker }) => ({
      ticker,
      kind: "etf",
      price: 100,
      currency: "EUR",
      provider: "yahoo-finance2",
    }),
    getRates: async () => ({
      base: "EUR",
      date: "2026-06-04",
      rates: { EUR: 1, USD: 1.08, GBP: 0.85, CHF: 0.95 },
    }),
    getTotalEquity: async () => ({ totalEquityEur: 250_000 }),
    getCompass: async () => ({ objectif: 800_000 }),
    computeProgress,
    ...over,
  };
}

describe("dashboard.service.getOverview", () => {
  test("AC-1 — total wealth equals the hand-computed reference", async () => {
    const svc = createDashboardService(basePorts());
    const out = await svc.getOverview(USER);
    expect(out.totalWealthEur).toBe(276_000);
  });

  test("AC-2 — composition sums to total wealth", async () => {
    const svc = createDashboardService(basePorts());
    const out = await svc.getOverview(USER);
    expect(out.composition).toEqual({
      liquideEur: 20_000,
      placementsEur: 6_000,
      immobilierEur: 250_000,
    });
    const { liquideEur, placementsEur, immobilierEur } = out.composition;
    expect(liquideEur + placementsEur + immobilierEur).toBe(out.totalWealthEur);
  });

  test("AC-3 — compass percent/gap derive from the LIVE total wealth", async () => {
    const svc = createDashboardService(basePorts());
    const out = await svc.getOverview(USER);
    expect(out.compass).toEqual({ percent: 34.5, objectif: 800_000, gap: 524_000 });
  });

  test("AC-3 — no compass row → compass:null, no throw", async () => {
    const svc = createDashboardService(basePorts({ getCompass: async () => null }));
    const out = await svc.getOverview(USER);
    expect(out.compass).toBeNull();
    expect(out.totalWealthEur).toBe(276_000);
  });

  test("AC-4 — a rejected resolveQuote falls back to stored lastPrice", async () => {
    // All 6 holdings keep their stored lastPrice (90) → marketValue 6×900 = 5 400.
    const svc = createDashboardService(
      basePorts({
        resolveQuote: async () => {
          throw new Error("all tiers down");
        },
      }),
    );
    const out = await svc.getOverview(USER);
    expect(out.composition.placementsEur).toBe(5_400);
    expect(out.totalWealthEur).toBe(20_000 + 5_400 + 250_000);
  });

  test("AC-4 — a null-ticker holding is never resolved, keeps stored lastPrice", async () => {
    let calls = 0;
    const svc = createDashboardService(
      basePorts({
        listHoldings: async () => [hold({ id: "hld_x", ticker: null, lastPrice: 42, quantity: 1 })],
        resolveQuote: async ({ ticker }) => {
          calls += 1;
          return { ticker, kind: "etf", price: 100, currency: "EUR", provider: "yahoo-finance2" };
        },
      }),
    );
    const out = await svc.getOverview(USER);
    expect(calls).toBe(0);
    expect(out.composition.placementsEur).toBe(42);
  });
});
```
Run: `bun --filter=@pekulo/api run test`
Expected: the `dashboard.service.getOverview` suite passes (6 tests), exit 0.
Commit: `git add apps/api/src/modules/dashboard/dashboard.service.ts apps/api/src/modules/dashboard/dashboard.service.test.ts && git commit -m "feat(#38): dashboard aggregator service + total-wealth tests (FR-43)"`

- [x] **T4 — `dashboard.routes.ts`** [AC: AC-6]

Create `apps/api/src/modules/dashboard/dashboard.routes.ts`:
```ts
// apps/api/src/modules/dashboard/dashboard.routes.ts
// oRPC handler for the dashboard module (story 7-1). Single read procedure
// getOverview. Mirrors compass.routes.ts: router built from the shared
// @pekulo/contracts contract via implement(contract).$context<T>().router(...).
// L669: router type inferred via ReturnType<typeof createDashboardRouter>;
// never annotated as `Elysia`.

import { implement } from "@orpc/server";
import { dashboardContract } from "@pekulo/contracts";
import { PekuloError } from "../../common/errors";
import type { DashboardService } from "./dashboard.service";

const impl = implement(dashboardContract).$context<{
  userId: string;
  email: string | null;
}>();

export function createDashboardRouter(deps: { service: DashboardService }) {
  return impl.router({
    getOverview: impl.getOverview.handler(async ({ context }) => {
      if (!context.userId?.trim()) {
        throw new PekuloError("UNAUTHORIZED", "user context missing");
      }
      return deps.service.getOverview(context.userId);
    }),
  });
}
```
Run: `bun --filter=@pekulo/api run typecheck`
Expected: no output, exit 0.
Commit: `git add apps/api/src/modules/dashboard/dashboard.routes.ts && git commit -m "feat(#38): dashboard.getOverview oRPC route (FR-43)"`

- [x] **T5 — `dashboard.module.ts` + module test** [AC: AC-6]

Create `apps/api/src/modules/dashboard/dashboard.module.ts`:
```ts
// apps/api/src/modules/dashboard/dashboard.module.ts
// Module factory for the dashboard domain (story 7-1). Unlike every other
// module, the dashboard owns NO repository and NO Prisma — it is pure
// composition over narrow read ports supplied by runtime-dependencies.ts
// (accounts / holdings / realestate / compass). Mirrors ADR-0009's
// createXxxModule(deps) → { service, router } shape; router type inferred
// (L669, never annotated as `Elysia`).

import { createDashboardRouter } from "./dashboard.routes";
import {
  createDashboardService,
  type DashboardPorts,
  type DashboardService,
} from "./dashboard.service";

export interface DashboardModule {
  service: DashboardService;
  router: ReturnType<typeof createDashboardRouter>;
}

export function createDashboardModule(deps: DashboardPorts): DashboardModule {
  const service = createDashboardService(deps);
  const router = createDashboardRouter({ service });
  return { service, router };
}
```
Create `apps/api/src/modules/dashboard/dashboard.module.test.ts`:
```ts
// apps/api/src/modules/dashboard/dashboard.module.test.ts
import { describe, expect, test } from "bun:test";
import { computeProgress } from "../../common/derive/compass-progress";
import { createDashboardModule } from "./dashboard.module";

describe("createDashboardModule", () => {
  test("returns a service + router wired over the ports", async () => {
    const mod = createDashboardModule({
      listAccounts: async () => [],
      listHoldings: async () => [],
      resolveQuote: async () => {
        throw new Error("no holdings");
      },
      getRates: async () => ({
        base: "EUR",
        date: "2026-06-04",
        rates: { EUR: 1, USD: 1, GBP: 1, CHF: 1 },
      }),
      getTotalEquity: async () => ({ totalEquityEur: 0 }),
      getCompass: async () => null,
      computeProgress,
    });
    expect(typeof mod.service.getOverview).toBe("function");
    expect(mod.router.getOverview).toBeDefined();
    const out = await mod.service.getOverview("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(out.totalWealthEur).toBe(0);
    expect(out.compass).toBeNull();
  });
});
```
Run: `bun --filter=@pekulo/api run test`
Expected: the `createDashboardModule` suite passes, exit 0.
Commit: `git add apps/api/src/modules/dashboard/dashboard.module.ts apps/api/src/modules/dashboard/dashboard.module.test.ts && git commit -m "feat(#38): dashboard module factory (FR-43)"`

- [x] **T6 — Wire in `runtime-dependencies.ts` + `orpcRouter` + integration test** [AC: AC-6]

Edit `apps/api/src/bootstrap/runtime-dependencies.ts`:

(a) Add the import next to the other module imports (after the `createRealestateModule` import line):
```ts
import { createDashboardModule } from "../modules/dashboard/dashboard.module";
```
(b) Build the module immediately BEFORE the `const orpcRouter: PekuloRpcRouter = {` line:
```ts
  // Story 7-1 (FR-43, FR-44) — dashboard cross-domain aggregator. Pure
  // composition module: no repository, no Prisma. Narrow read ports over the
  // four wealth-bearing modules + compass. Holdings priced live via the
  // holdings 4-tier chain (resolveQuote, 60s cache); FX via the frankfurter
  // client the holdings module exposes for exactly this (holdings.module L39).
  const dashboardModule = createDashboardModule({
    listAccounts: (userId) => accountsModule.service.list(userId),
    listHoldings: (userId) => holdingsModule.service.list(userId, { includeClosed: false }),
    resolveQuote: (input) => holdingsModule.service.resolveQuote(input),
    getRates: (base) => holdingsModule.frankfurterClient.getRates(base),
    getTotalEquity: (userId) => realestateModule.service.getTotalEquity(userId),
    getCompass: (userId) => compassModule.service.getCompass(userId),
    computeProgress: (input) => compassModule.service.computeProgress(input),
  });
```
(c) Add the router key inside the `orpcRouter` object (after `realestate: realestateModule.router,`):
```ts
    dashboard: dashboardModule.router,
```
Create `apps/api/src/modules/dashboard/dashboard.integration.test.ts`:
```ts
// apps/api/src/modules/dashboard/dashboard.integration.test.ts
// AC-6 — oRPC HTTP boundary for getOverview. Boots a real Elysia app with the
// real mountOrpc + RPCHandler + jose HS256 verifier, pointed at the dashboard
// router built from STUB ports (the dashboard owns no Prisma). port:0 → OS
// assigns a free port (avoids cross-suite collisions).
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { SignJWT } from "jose";
import { extractRequestId } from "../../common/errors";
import { mapErrorToOrpcResponse } from "../../platform/http/error-mapper";
import { mountOrpc, type PekuloRpcRouter } from "../../platform/http/orpc-mount";
import { createJwtVerifier } from "../../platform/security";
import { computeProgress } from "../../common/derive/compass-progress";
import { createDashboardModule } from "./dashboard.module";

const SECRET = "integration-secret-at-least-32-chars-long-aaaa";
const ISSUER = "https://integration.supabase.co/auth/v1";
const AUDIENCE = "authenticated";
const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function signFor(userId: string): Promise<string> {
  return new SignJWT({ email: `${userId}@pekulo.local` })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(SECRET));
}

let app: ReturnType<typeof buildApp>;
let baseUrl: string;

function buildApp() {
  const dashboardModule = createDashboardModule({
    listAccounts: async () => [],
    listHoldings: async () => [],
    resolveQuote: async () => {
      throw new Error("no holdings");
    },
    getRates: async () => ({
      base: "EUR",
      date: "2026-06-04",
      rates: { EUR: 1, USD: 1, GBP: 1, CHF: 1 },
    }),
    getTotalEquity: async () => ({ totalEquityEur: 250_000 }),
    getCompass: async () => ({ objectif: 800_000 }),
    computeProgress,
  });
  const orpcRouter = { dashboard: dashboardModule.router } as unknown as PekuloRpcRouter;
  const jwtVerifier = createJwtVerifier({ secret: SECRET, issuer: ISSUER, audience: AUDIENCE });
  const instance = new Elysia().onError(({ error, set }) => {
    const requestId = extractRequestId(error) ?? crypto.randomUUID();
    const mapped = mapErrorToOrpcResponse(error, requestId);
    set.status = mapped.status;
    return mapped.body;
  });
  mountOrpc(instance, { jwtVerifier, orpcRouter });
  return instance;
}

beforeAll(() => {
  app = buildApp();
  app.listen({ port: 0 });
  const port = app.server?.port;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await app.stop();
});

describe("dashboard /rpc/v1/dashboard/getOverview", () => {
  test("AC-6 — 200 + valid overview for an authenticated user", async () => {
    const token = await signFor(USER);
    const res = await fetch(`${baseUrl}/rpc/v1/dashboard/getOverview`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalWealthEur).toBe(250_000);
    expect(body.compass).toEqual({ percent: 31.3, objectif: 800_000, gap: 550_000 });
    expect(body.fx.source).toBe("live");
  });

  test("AC-6 — 401 without a JWT", async () => {
    const res = await fetch(`${baseUrl}/rpc/v1/dashboard/getOverview`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });
});
```
> Dev note: `31.3` = round(250 000 / 800 000 × 100, 1) and `gap = 550 000`. If the real `createJwtVerifier` signature in `platform/security` requires extra fields (e.g. `supabaseUrl`), copy the EXACT `createJwtVerifier({...})` + `onError` lines from `apps/api/src/modules/realestate/realestate.integration.test.ts` (same harness) and keep only the dashboard module + the two assertions above.

Run: `bun --filter=@pekulo/api run test` then `bun --filter=@pekulo/api run typecheck`
Expected: dashboard integration suite passes (2 tests); typecheck exit 0.
Commit: `git add apps/api/src/bootstrap/runtime-dependencies.ts apps/api/src/modules/dashboard/dashboard.integration.test.ts && git commit -m "feat(#38): mount dashboard router + integration test (FR-43)"`

- [x] **T7 — Export `dashboardClient`** [AC: AC-6]

Edit `apps/web/src/lib/orpc/modules.ts`:

(a) Add `dashboardContract` to the `@pekulo/contracts` import list (after `llmContract,`):
```ts
  llmContract,
  dashboardContract,
} from "@pekulo/contracts";
```
(b) Append the client export at the end of the file:
```ts
// Story 7-1 — dashboard read-aggregator (FR-43). Mount path `/rpc/v1/dashboard`.
export const dashboardClient: ContractRouterClient<typeof dashboardContract> = createORPCClient(
  orpcLink,
  { path: ["dashboard"] },
);
```
Run: `bun --filter=@pekulo/web run typecheck`
Expected: no output, exit 0.
Commit: `git add apps/web/src/lib/orpc/modules.ts && git commit -m "feat(#38): export dashboardClient (FR-43)"`

- [x] **T8 — `getDashboardOverview` server action** [AC: AC-6]

Create `apps/web/src/app/(cap)/dashboard/_actions/dashboard-actions.ts`:
```ts
"use server";

import { defineAction } from "@zapaction/core";
import { z } from "@pekulo/zod";
import type { DashboardOverview } from "@pekulo/validators";
import { dashboardClient } from "@/lib/orpc/modules";
import { ensureRequestContext } from "@/lib/orpc/request-context";
import type { ActionContext } from "@/lib/zapaction/context";
import "@/lib/zapaction/context";

// Story 7-1 — thin oRPC delegator (read-only). Zero business logic on the web
// tier (ADR-0010); the aggregation lives in apps/api dashboard.service.
// ensureRequestContext() seeds the AsyncLocalStorage store defensively before
// the oRPC call (lesson L25 — enterWith propagation on Next 16.x).
export const getDashboardOverview = defineAction<void, DashboardOverview, ActionContext>({
  name: "getDashboardOverview",
  input: z.void(),
  handler: async () => {
    await ensureRequestContext();
    return dashboardClient.getOverview();
  },
});
```
Run: `bun --filter=@pekulo/web run typecheck`
Expected: no output, exit 0.
Commit: `git add "apps/web/src/app/(cap)/dashboard/_actions/dashboard-actions.ts" && git commit -m "feat(#38): getDashboardOverview server action (FR-43)"`

- [x] **T9 — `dashboardKeys` + registry edges + registry test** [AC: AC-5]

Edit `apps/web/src/lib/zapaction/keys.ts`:

(a) Add the key block immediately BEFORE the `setTagRegistry({` call (after the `bankConnectionsTags` block):
```ts
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
});
```
(b) Extend the existing registry edges so each wealth-affecting list tag also invalidates `dashboardKeys.overview()`. Apply these exact replacements inside `setTagRegistry({ ... })`.

Compass (objectif change moves `overview.compass.percent/gap`) — append `dashboardKeys.overview(),` as the last element of BOTH the `compassTags.all()` and `compassTags.current()` arrays:
```ts
  [compassTags.all()]: [
    compassKeys.current(),
    compassKeys.setup(),
    compassKeys.progress(),
    compassKeys.curve(),
    compassKeys.history(),
    milestonesKeys.list(),
    dashboardKeys.overview(),
  ],
  [compassTags.current()]: [
    compassKeys.current(),
    compassKeys.setup(),
    compassKeys.progress(),
    compassKeys.curve(),
    compassKeys.history(),
    milestonesKeys.list(),
    dashboardKeys.overview(),
  ],
```
Accounts:
```ts
  [accountsTags.all()]: [accountsKeys.list(), dashboardKeys.overview()],
  [accountsTags.list()]: [accountsKeys.list(), dashboardKeys.overview()],
```
Holdings:
```ts
  [holdingsTags.all()]: [holdingsKeys.list(), dashboardKeys.overview()],
  [holdingsTags.list()]: [holdingsKeys.list(), dashboardKeys.overview()],
```
Realestate:
```ts
  [realestateTags.all()]: [[REALESTATE_KEY], dashboardKeys.overview()],
  [realestateTags.list()]: [[REALESTATE_KEY], dashboardKeys.overview()],
```
Transactions:
```ts
  [transactionsTags.all()]: [[TRANSACTIONS_KEY], accountsKeys.list(), [MONTHLY_KEY], dashboardKeys.overview()],
  [transactionsTags.list()]: [[TRANSACTIONS_KEY], accountsKeys.list(), [MONTHLY_KEY], dashboardKeys.overview()],
```
BankConnections:
```ts
  [bankConnectionsTags.list()]: [
    bankConnectionsKeys.list(),
    [TRANSACTIONS_KEY],
    accountsKeys.list(),
    [MONTHLY_KEY],
    dashboardKeys.overview(),
  ],
```
(c) Update the realestate forward-pointer comment — replace the sentence *"7-1 dashboard will add a dedicated `realestateTags.list → dashboardKeys.cap` edge when it ships."* with *"7-1 dashboard shipped the realestate/accounts/holdings/transactions/compass list → `dashboardKeys.overview()` edges (read-only aggregate)."*

Create `apps/web/src/lib/zapaction/__tests__/dashboard-registry.test.ts`:
```ts
// AC-5 (story 7-1): every wealth-affecting mutation invalidates the dashboard
// overview via the tag-registry edge <feature>Tags.list() -> dashboardKeys.overview().
import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { invalidateTags } from "@zapaction/query";
import {
  accountsTags,
  bankConnectionsTags,
  compassTags,
  dashboardKeys,
  holdingsTags,
  realestateTags,
  transactionsTags,
} from "../keys";

const WEALTH_TAGS = [
  ["transactions", transactionsTags.list()],
  ["accounts", accountsTags.list()],
  ["holdings", holdingsTags.list()],
  ["realestate", realestateTags.list()],
  ["compass", compassTags.current()],
  ["bankConnections", bankConnectionsTags.list()],
] as const;

describe("dashboard tag registry — AC-5", () => {
  for (const [name, tag] of WEALTH_TAGS) {
    it(`invalidateTags(${name}) reaches dashboardKeys.overview()`, async () => {
      const qc = new QueryClient();
      qc.setQueryData(dashboardKeys.overview(), { totalWealthEur: 0 });
      expect(qc.getQueryState(dashboardKeys.overview())?.isInvalidated).toBe(false);

      await invalidateTags(qc, [tag]);

      expect(qc.getQueryState(dashboardKeys.overview())?.isInvalidated).toBe(true);
    });
  }

  it("dashboardKeys.overview() is the stable read key", () => {
    expect(dashboardKeys.overview()[0]).toBe("dashboard");
  });
});
```
Run: `bun --filter=@pekulo/web run test`
Expected: the `dashboard tag registry — AC-5` suite passes (7 tests), exit 0.
Commit: `git add apps/web/src/lib/zapaction/keys.ts apps/web/src/lib/zapaction/__tests__/dashboard-registry.test.ts && git commit -m "feat(#38): wire dashboard cache-invalidation edges (FR-44)"`

- [x] **T10 — `useDashboardOverview` hook** [AC: AC-6]

Create `apps/web/src/app/(cap)/dashboard/_hooks/use-dashboard-overview.ts`:
```ts
"use client";

import { useActionQuery } from "@zapaction/query";
import { dashboardKeys } from "@/lib/zapaction/keys";
import { getDashboardOverview } from "../_actions/dashboard-actions";

// Story 7-1 — Cap view read hook (FR-43). Single read of the cross-domain
// overview aggregate. read-only per R4; invalidated by the registry edges on
// accounts/holdings/realestate/transactions/compass list tags (FR-44).
// Convention: use<Feature><Resource> (architecture L355).
export function useDashboardOverview() {
  return useActionQuery(getDashboardOverview, {
    input: undefined,
    queryKey: dashboardKeys.overview(),
    readPolicy: "read-only",
    staleTime: 30_000,
  });
}
```
Run: `bun --filter=@pekulo/web run typecheck`
Expected: no output, exit 0.
Commit: `git add "apps/web/src/app/(cap)/dashboard/_hooks/use-dashboard-overview.ts" && git commit -m "feat(#38): useDashboardOverview read hook (FR-43)"`

- [x] **T11 — Doc-sync `architecture.md` + final verification** [AC: all] — ⚠️ full-gate verification done & green; the `architecture.md` doc-sync was **DEFERRED** at dev time (upstream-doc write guard blocks it while `in-progress`). ✅ **Doc-sync APPLIED during aped-review** (commit `7d534be`) — see Review Record.

Edit `docs/architecture.md` — replace the FR-44 driver line (the `5. **Cache invalidation graph (setTagRegistry)**` bullet) with:
```
5. **Cache invalidation graph (`setTagRegistry`)** — in place; story 7-1 wired the dashboard read-aggregator (`dashboardKeys.overview()`) so accounts / holdings / realestate / transactions / compass list-tag mutations refresh the Cap view total wealth (FR-44). The dashboard is read-only (no `dashboardTags`). Codified as a Phase 3 hard rule.
```
And append, in the `apps/api` dashboard module description region (the `dashboard/  FR-41-44 (read-aggregator)` line), a one-line NFR note:
```
  - Dashboard `getOverview` (story 7-1) prices holdings LIVE via the holdings 4-tier chain behind the 60s PricesCache; NFR-1 (compass-progress < 300ms p95) holds on cache-warm loads, cold-cache loads accept the NFR-2 price-chain latency as a documented deviation. The module owns no tables/repository — pure composition over accounts/holdings/realestate/compass ports.
```
Run (full gate): `bun --filter=@pekulo/api run typecheck && bun --filter=@pekulo/web run typecheck && bun --filter=@pekulo/api run test && bun --filter=@pekulo/web run test`
Expected: all green, exit 0.
Commit: `git add docs/architecture.md && git commit -m "docs(#38): sync architecture — dashboard aggregator realized (FR-43/FR-44)"`

## Dev Notes

### Existing code at write time (Step-0)

**`packages/contracts/src/dashboard/dashboard.contract.ts` (current — empty scaffold):**
```ts
export const dashboardContractV1 = {} as const;
export const dashboardContract = dashboardContractV1;
export const dashboardContractMeta = {
  moduleKey: "dashboard",
  mountPath: "/rpc/v1/dashboard",
  version: "v1",
} as const;
```
`dashboardContract` is ALREADY exported from `@pekulo/contracts` and registered in `pekuloContract` (`packages/contracts/src/index.ts` L23, L66) — only the procedure object is empty. No contracts-index change needed.

**`packages/validators/src/index.ts` (current barrel — relevant lines):**
```ts
export * from "./holdings";
export * from "./realestate";
```
There is no `./dashboard` folder yet — T1 creates it.

**`apps/api/src/bootstrap/runtime-dependencies.ts` (current `orpcRouter` block):**
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
`PekuloRpcRouter = ConstructorParameters<typeof RPCHandler<…>>[0]` is **inferred from this object literal** (`orpc-mount.ts`), so adding a `dashboard:` key needs NO type edit.

**`apps/web/src/lib/orpc/modules.ts` (current contract import block):**
```ts
import {
  compassContract,
  milestonesContract,
  accountsContract,
  holdingsContract,
  hypothesisContract,
  realestateContract,
  transactionsContract,
  monthlyContract,
  bankAggregatorContract,
  llmContract,
} from "@pekulo/contracts";
```
The file header already lists `dashboard` among "Clients for contracts whose api route hasn't shipped yet … added back as the corresponding story lands them server-side".

**`apps/api/src/modules/holdings/holdings.module.ts` (the port source — story 7-1 was anticipated here):**
```ts
export interface HoldingsModule {
  service: HoldingService;
  router: ReturnType<typeof createHoldingsRouter>;
  /** Story 3-3 — exposed for story 7-1 to compose into the snapshot read. */
  frankfurterClient: FrankfurterClient;
}
```

**`apps/web/src/lib/zapaction/keys.ts` (current realestate forward-pointer comment, to update in T9c):**
> "Surgical edges are not required at V1 scale (NFR-16: 50 properties / user). 7-1 dashboard will add a dedicated `realestateTags.list → dashboardKeys.cap` edge when it ships."

**`docs/architecture.md` (current FR-44 driver line):**
```
5. **Cache invalidation graph (`setTagRegistry`)** — already in place; new tags + new mutation paths for compass / milestones / LLM categorisation / real-estate. Risk of dashboard staleness (FR-44) if not wired. Codified as a Phase 3 hard rule.
```

### File decisions (3-bullet per file)

| File | Action | Single responsibility · I/O |
|---|---|---|
| `packages/validators/src/dashboard/dashboard.schemas.ts` | create | The dashboard overview aggregate schema. Imports `z`, `fxSourceSchema`; exports `dashboardOverviewSchema` + types. |
| `packages/validators/src/dashboard/index.ts` | create | Barrel. Re-exports `./dashboard.schemas`. |
| `packages/validators/src/index.ts` | modify | Add `export * from "./dashboard"`. |
| `packages/contracts/src/dashboard/dashboard.contract.ts` | modify | Declare `getOverview: oc.output(dashboardOverviewSchema)`. |
| `apps/api/src/modules/dashboard/dashboard.service.ts` | create | Compose total wealth + composition + compass% from 7 injected ports. In: `DashboardPorts`. Out: `DashboardService.getOverview`. |
| `apps/api/src/modules/dashboard/dashboard.routes.ts` | create | oRPC handler for `getOverview`. In: `DashboardService`. Out: inferred router. |
| `apps/api/src/modules/dashboard/dashboard.module.ts` | create | Factory `createDashboardModule(ports) → { service, router }`. No repository/Prisma. |
| `apps/api/src/modules/dashboard/dashboard.service.test.ts` | create | AC-1..AC-4 with stub ports + hand-computed reference. |
| `apps/api/src/modules/dashboard/dashboard.module.test.ts` | create | Factory returns `{ service, router }`; router exposes `getOverview`. |
| `apps/api/src/modules/dashboard/dashboard.integration.test.ts` | create | AC-6: real Elysia + mountOrpc + JWT → 200/401. |
| `apps/api/src/bootstrap/runtime-dependencies.ts` | modify | Build the module from ports + add `dashboard:` to `orpcRouter`. |
| `apps/web/src/lib/orpc/modules.ts` | modify | Export `dashboardClient`. |
| `apps/web/src/app/(cap)/dashboard/_actions/dashboard-actions.ts` | create | `'use server'` `getDashboardOverview` oRPC delegator. |
| `apps/web/src/app/(cap)/dashboard/_hooks/use-dashboard-overview.ts` | create | `useDashboardOverview()` read-only query hook. |
| `apps/web/src/lib/zapaction/keys.ts` | modify | `dashboardKeys` + registry edges to dashboard overview. |
| `apps/web/src/lib/zapaction/__tests__/dashboard-registry.test.ts` | create | AC-5 registry-edge proof. |
| `docs/architecture.md` | modify | FR-44 realized + NFR-1 cold-cache deviation note. |

### Architecture & ADRs

- **ADR-0009** (Elysia + oRPC, web keeps the zapaction bridge). Dashboard read-aggregator at `apps/api/src/modules/dashboard/`, mounted `/rpc/v1/dashboard`.
- **ADR-0010** (Component → Hook → Server Action). Page reads via `useDashboardOverview()`; the action is a thin `'use server'` oRPC delegator with zero business logic.
- **The dashboard owns NO tables** — pure composition (`service + routes + module`), NO `repository`, NO Prisma, NO `errors.ts`. Seven narrow injected ports over accounts / holdings / realestate / compass (L1 conformance — no cross-module repository-type leak).
- **Composition formula (FR-43):** `totalWealthEur = computeSnapshotFx(accounts, livePricedHoldings, rates).kpi.capitalTotal + realestate.getTotalEquity().totalEquityEur`. `computeSnapshotFx` (`apps/api/src/common/derive/portfolio-fx.ts`) already returns `kpi.capitalTotal = cash + FX marketValue`, `kpi.cash`, `kpi.marketValue`, `fxSource`, `fxAsOf`.
- **R4 / tag registry SSOT** (architecture L727-731): cross-feature invalidation lives ONLY in `setTagRegistry`. Dashboard is read-only → `dashboardKeys` but NO `dashboardTags`; invalidated BY other features' list tags. No manual `queryClient.invalidateQueries` anywhere (review fail).

### Locked design decisions (validated step 04)

1. **Scope** — `getOverview` returns total wealth + composition + compass % + fx (FR-43 + compass compose). The compass % is derived from the **live** total wealth.
2. **Holdings price source** — **live 4-tier resolution** (`resolveQuote`) in parallel behind the 60 s PricesCache, with a **per-holding graceful fallback** to the stored `lastPrice` on rejection or null ticker.
3. **NFR-1 reconciliation** — met on cache-warm loads; cold-cache deviation documented (story + architecture).
4. **Module shape** — pure composition, no repository / Prisma / errors file.
5. **Invalidation edges** — accounts / holdings / realestate / transactions / compass / bankConnections list tags → `dashboardKeys.overview()`.

### Lessons applied

- **Coerce Prisma `Decimal` via `decimalToNumber`, never `Number(decimal)`** (2026-05-04, lists 7-1). The compose sources return `number` DTOs and `computeSnapshotFx` is pure over numbers — the aggregator MUST NOT reintroduce a raw `Decimal`/`Number()`.
- **Elysia type invariant → infer, never annotate** (2026-05-04, lists 7-1): router types via `ReturnType<typeof createDashboardRouter>`.
- **Registry-SSOT invalidation, no wall-clock promise** (2026-05-25): AC-5 met by the registry edge, NOT a manual invalidate; no "<Xms" claim in any AC.
- **`tsc` is NOT in the commit gate** (2026-06-01): run the workspace `typecheck` before every commit; `bun --filter=@pekulo/<pkg>` needs the package name, not the folder (2026-05-19).
- **Mid-flight scope additions carry doc-debt** (2026-05-31): if scope grows past this file, supersede the scope note + sync `architecture.md` + write a lesson in the SAME commit.

### Testing

- **apps/api** uses `bun:test`; run `bun --filter=@pekulo/api run test`.
- **apps/web** uses `vitest`; run `bun --filter=@pekulo/web run test`.
- **validators / contracts** ship no unit tests — gate on `bun --filter=@pekulo/<pkg> run typecheck`.
- Determinism: the service test pins `getRates` to a fixed `FxRates`, stubs `resolveQuote` to a constant, pins `getCompass`/`getTotalEquity` — the hand-computed reference (276 000 €) is exact.

### Dependencies

- `depends_on`: `1-1-compass-domain` (done), `2-1-accounts-orpc-port` (done), `3-1-holdings-orpc-port` (done), `4-1-realestate-domain` (done) — all `done` in `state.yaml`.
- Implicit: `3-2-prices-fallback-chain` (resolveQuote) + `3-3-portfolio-fx` (computeSnapshotFx + frankfurterClient) + `4-2-realestate-derives` (getTotalEquity) — all done; their primitives are exactly what 7-1 composes.
- No new external libs.

### Out of scope (explicit — deferred)

- The Cap **page UI** (HeroBlock, CompositionSection, RecentActivity, nav) — story **7-2** (consumes `useDashboardOverview`).
- Compass **curve** (FR-7) composition into the overview — already its own `compass.getCompassCurve` read; 7-2 wires it.
- Hypothesis projection gap (FR-59) — stories **7-3 / 7-4**.
- A stored-price fast-path / streamed live refresh — explicitly rejected during step-04 in favour of the documented NFR-1 deviation.

## File List

**Create:**
- `packages/validators/src/dashboard/dashboard.schemas.ts`
- `packages/validators/src/dashboard/index.ts`
- `apps/api/src/modules/dashboard/dashboard.service.ts`
- `apps/api/src/modules/dashboard/dashboard.routes.ts`
- `apps/api/src/modules/dashboard/dashboard.module.ts`
- `apps/api/src/modules/dashboard/dashboard.service.test.ts`
- `apps/api/src/modules/dashboard/dashboard.module.test.ts`
- `apps/api/src/modules/dashboard/dashboard.integration.test.ts`
- `apps/web/src/app/(cap)/dashboard/_actions/dashboard-actions.ts`
- `apps/web/src/app/(cap)/dashboard/_hooks/use-dashboard-overview.ts`
- `apps/web/src/lib/zapaction/__tests__/dashboard-registry.test.ts`

**Modify:**
- `packages/validators/src/index.ts`
- `packages/contracts/src/dashboard/dashboard.contract.ts`
- `apps/api/src/bootstrap/runtime-dependencies.ts`
- `apps/web/src/lib/orpc/modules.ts`
- `apps/web/src/lib/zapaction/keys.ts`
- `docs/architecture.md`

## Dev Agent Record

### Summary

Shipped the dashboard cross-domain read-aggregator (FR-43) and the FR-44 cache-invalidation edges. Pure composition module over 7 narrow read ports — no repository, no Prisma, no tables: `totalWealthEur = computeSnapshotFx(accounts, live-priced holdings, rates).kpi.capitalTotal + realestate.getTotalEquity().totalEquityEur`, holdings priced live through the holdings 4-tier chain with a per-holding graceful fallback to the stored `lastPrice`. All 6 ACs are covered by tests and the full gate is green (api 814 pass, web 195 pass, both typechecks exit 0). Scope honoured — no UI surface (that is 7-2). One late item: the `architecture.md` doc-sync (T11) is **deferred** to the coordinated flow because the upstream-doc write guard blocks it while the story is `in-progress` (user decision); the exact edits are listed under Deviations.

### Files changed

- `packages/validators/src/dashboard/dashboard.schemas.ts`
- `packages/validators/src/dashboard/index.ts`
- `packages/validators/src/index.ts`
- `packages/contracts/src/dashboard/dashboard.contract.ts`
- `apps/api/src/modules/dashboard/dashboard.service.ts`
- `apps/api/src/modules/dashboard/dashboard.service.test.ts`
- `apps/api/src/modules/dashboard/dashboard.routes.ts`
- `apps/api/src/modules/dashboard/dashboard.module.ts`
- `apps/api/src/modules/dashboard/dashboard.module.test.ts`
- `apps/api/src/modules/dashboard/dashboard.integration.test.ts`
- `apps/api/src/bootstrap/runtime-dependencies.ts`
- `apps/web/src/lib/orpc/modules.ts`
- `apps/web/src/app/(cap)/dashboard/_actions/dashboard-actions.ts`
- `apps/web/src/app/(cap)/dashboard/_hooks/use-dashboard-overview.ts`
- `apps/web/src/lib/zapaction/keys.ts`
- `apps/web/src/lib/zapaction/__tests__/dashboard-registry.test.ts`
- `apps/web/src/app/(cap)/dashboard/_compass/_hooks/use-update-compass.test.tsx` _(not in the story File List — see Deviations T9)_

### Deviations

- **T3 fixture — `PriceQuote` shape corrected.** The story's verbatim `resolveQuote` stub returned `{ ticker, kind, provider: "yahoo-finance2" }`, which does not match the real `PriceQuote` (`{ symbol, price, currency, marketTime, provider: prices-service|yahoo|boursorama|twelve-data }`). `bun test` passed (it does not type-check) but `tsc` failed (lesson 2026-06-01). Fixed both stubs to valid `PriceQuote` objects; the service only reads `quote.price`, so the 6 assertions are unchanged.
- **T6 integration test — oRPC RPCHandler envelope.** The story's T6 block sent a bare `{}` body and read `body.totalWealthEur` directly. Every sibling integration suite (all 10 modules) uses the RPCHandler envelope — request `{ json: {} }`, success read `body.json.*`, errors flat `{ code }`. Aligned the test to the envelope; the AC-6 assertions (200 + `totalWealthEur` 250000 + compass `{31.3, 800000, 550000}` + `fx.source` "live"; 401 without JWT) are identical. RED was witnessed by deliberately breaking the route return, then restored.
- **T9 — existing compass test updated (extra file).** Adding `dashboardKeys.overview()` to the `compassTags.all()/current()` edges made `use-update-compass.test.tsx` invalidate 7 keys instead of 6. Updated its count + `arrayContaining` and committed it atomically with the edge change (without it the keys.ts commit would land the suite red). This is the intended FR-44 behaviour — a compass-objectif change now also refreshes the Cap overview.
- **T1 — validators barrel placement.** Added `export * from "./dashboard"` at its alphabetical position (between `compass` and `holdings`) rather than after `realestate` as the story text suggested — the barrel is alphabetically sorted (existing convention).
- **T11 — `architecture.md` doc-sync DEFERRED.** The upstream-doc write guard blocks `docs/architecture.md` edits while a story is `in-progress` and recommends `aped-course`. Per user decision the doc-sync is deferred to the coordinated flow (review/ship). Two pending edits, ready to apply verbatim:
  1. **FR-44 driver bullet** (item 5 "Cache invalidation graph (`setTagRegistry`)"): replace _"already in place; new tags + new mutation paths for compass / milestones / LLM categorisation / real-estate. Risk of dashboard staleness (FR-44) if not wired. Codified as a Phase 3 hard rule."_ with _"in place; story 7-1 wired the dashboard read-aggregator (`dashboardKeys.overview()`) so accounts / holdings / realestate / transactions / compass list-tag mutations refresh the Cap view total wealth (FR-44). The dashboard is read-only (no `dashboardTags`). Codified as a Phase 3 hard rule."_
  2. **Dashboard module note** (near the `dashboard/  FR-41-44 (read-aggregator)` line): add _"story 7-1 `getOverview` prices holdings LIVE via the holdings 4-tier chain behind the 60s PricesCache; NFR-1 (compass-progress < 300ms p95) holds on cache-warm loads, cold-cache loads accept the NFR-2 price-chain latency as a documented deviation. Owns no tables/repository — pure composition over accounts/holdings/realestate/compass ports."_

### Test output

Full gate re-run at completion (verbatim):

```
api typecheck:  exit 0
web typecheck:  exit 0
api test:       814 pass  0 fail  (98 files)
web test:       195 passed (195)  78 files
OVERALL_EXIT=0
```

Per-AC tests: AC-1/2/3/4 → `dashboard.service.test.ts` (6 pass), AC-5 → `dashboard-registry.test.ts` (7 pass), AC-6 → `dashboard.integration.test.ts` (2 pass: 200 + 401).

## Review Record

**Date:** 2026-06-04
**Auditors:** Spec, Code, Edge & Hallucination (Aria n/a — backend orchestration story, no UI surface)
**Verdict:** done — all findings RESOLVED or DISMISSED-with-rationale

### Findings

#### Resolved
- [MAJOR] `getOverview` threw `CompassError INVALID_WEALTH` → HTTP 400 when total net wealth went negative (underwater real-estate) AND a compass row existed — `computeProgress` rejects `currentWealth < 0`, breaking the module's own "never throws" contract (NFR-18). [apps/api/src/modules/dashboard/dashboard.service.ts:91-101]
  - Source: Code + Edge (converged independently; reproduced by the Lead with a throwaway test)
  - Resolution: `150cfed` — clamp `currentWealth: Math.max(0, totalWealthEur)` before `computeProgress`; the RAW `totalWealthEur` is still returned in the payload (underwater user reads 0 % / full gap). Regression test "M1 — negative net wealth + compass" added.
- [MAJOR] Unbounded price fan-out + no in-flight dedup at the NFR-16 500-holding cold-cache cap — `Promise.all` over all holdings could fire up to 500 concurrent provider chains in one tick, repeated tickers undeduped (thundering-herd). [apps/api/src/modules/dashboard/dashboard.service.ts:60-76]
  - Source: Code
  - Resolution: `150cfed` — dedup quotes per `ticker|kind|currency` (N lots → 1 quote) + bounded concurrency (`PRICE_CONCURRENCY = 8`, batches awaited serially). Graceful fallback preserved (rejection → stored `lastPrice`; null ticker never resolved). Regression test "M2 — dedup" added.
- [MAJOR] T11 `docs/architecture.md` doc-sync was deferred at dev time — task read `[x]` but the file was untouched on the branch (traceability gap). [docs/architecture.md]
  - Source: Spec (Code judged the documented deferral acceptable)
  - Resolution: `7d534be` — applied both queued edits: FR-44 driver bullet (dashboard read-aggregator `dashboardKeys.overview()` edges, read-only / no `dashboardTags`) + NFR-1 cache-warm / cold-cache (NFR-2) documented deviation + no-table pure-composition note.
- [MINOR] A transient `getCompass` read failure 500-ed the whole overview. [apps/api/src/modules/dashboard/dashboard.service.ts:80-87]
  - Source: Code
  - Resolution: `150cfed` — `getCompass` degrades to `null` (compass is optional/nullable). The three wealth-bearing reads (accounts/holdings/equity) intentionally still surface loud — a finance dashboard must never silently under-report net wealth. Regression test "M4" added.
- [MINOR] `computeProgress` would also throw `INVALID_TARGET` on `capitalTarget === 0`. [apps/api/src/common/derive/compass-progress.ts:21-23]
  - Source: Edge (defense-in-depth)
  - Resolution: covered by the M1 clamp on the wealth side; `objectif === 0` is unreachable for a persisted compass (`updateCompassInputSchema.objectif` is `.positive()`).

#### Dismissed
- [NIT] A broad-glob `bun test` from the repo root reports 306 files / 283 fail. [n/a]
  - Source: Spec
  - Rationale: those are out-of-scope, DB-less suites outside the `@pekulo/api` package `test` script. The scoped gate `bun --filter=@pekulo/api run test` is 817 pass / 0 fail / 98 files. No code issue.

### Verification
- Test command: `bun --filter=@pekulo/api run typecheck && bun --filter=@pekulo/web run typecheck && bun --filter=@pekulo/api run test && bun --filter=@pekulo/web run test`
- Test output (final pass): api typecheck exit 0 · web typecheck exit 0 · **api test 817 pass / 0 fail / 98 files** (+3 regression vs the 814 baseline) · **web test 195 pass / 78 files**. Focused: `dashboard.service.test.ts` 9 pass / 0 fail. oxlint 0 warnings / 0 errors.
- Visual verification: n/a — backend orchestration story, no UI surface (Aria not dispatched).
- Re-verification: each fix re-dispatched to its auditor (Edge→M1, Code→M2, Spec→M3) → all RESOLVED.
