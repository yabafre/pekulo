# Story: 3-3-portfolio-fx — FX-adjusted EUR snapshot helpers + per-holding PnL + Frankfurter client (API-side, pure)

**Epic:** Epic 3 — Holdings & portfolio (extended brownfield + crypto)
**Status:** done
**Ticket:** [#22](https://github.com/yabafre/pekulo/issues/22)
**Branch:** `feature/22-3-3-portfolio-fx`
**Commit prefix:** `feat(#22): …` (use `test(#22):` / `chore(#22):` / `refactor(#22):` per task semantics)
**Depends on:** 3-1-holdings-orpc-port (done — `HoldingService` infra, `holdings.errors.ts` host file, repository, `decimalToNumber` boundary), 3-2-prices-fallback-chain (done — `holdings.module.ts` env-deps pattern, per-tier client factory precedent, `holdings.cache` reuse policy), 0-3-api-scaffold (done — env loader, `optionalString` helper)
**Complexity:** M

## User Story

**As a** Pekulo user, **I want** my portfolio snapshot in EUR with FX rates applied (falling back to 1:1 transparently) and per-holding unrealised PnL in both holding currency and EUR, **so that** Pekulo's compass and dashboard see consistent EUR figures even when the FX provider is unavailable — without re-implementing the conversion in story 3-4 (UI) or 7-1 (dashboard orchestration).

## Acceptance Criteria

- **AC-1 (FR-18 — USD-denominated holding + missing FX rate → 1:1 + `fxSource: 'fallback'`):** **Given** a portfolio `accounts = [{ id: "acc_…A", currency: "EUR", cashBalance: 0, … }]` and `holdings = [{ id: "hld_…A", accountId: "acc_…A", currency: "USD", quantity: 100, avgCost: 8, lastPrice: 10, kind: "action", … }]` and `rates = null`, **When** `computeSnapshotFx(accounts, holdings, null, "EUR")` is called, **Then** the returned `PortfolioSnapshotFx` satisfies `fxBase === "EUR"` AND `fxAvailable === false` AND `fxSource === "fallback"` AND `fxAsOf === null` AND `kpi.marketValue === 1000` (identity conversion) AND `byAccount[0].total === 1000` AND `kpi.invested === 800` AND `kpi.pnl === 200`.

- **AC-2 (FR-18 — live FX path):** **Given** the same portfolio as AC-1 AND `rates = { base: "EUR", date: "2026-05-19", rates: { EUR: 1, USD: 1.08, GBP: 0.85, CHF: 0.95 } }`, **When** `computeSnapshotFx(accounts, holdings, rates, "EUR")` is called, **Then** `fxAvailable === true` AND `fxSource === "live"` AND `fxAsOf === "2026-05-19"` AND `Math.abs(kpi.marketValue - 1000 / 1.08) < 0.01` (≈ 925.93 EUR) AND `Math.abs(kpi.invested - 800 / 1.08) < 0.01` (≈ 740.74 EUR) AND `Math.abs(kpi.pnl - 200 / 1.08) < 0.01` (≈ 185.19 EUR).

- **AC-3 (FR-19 — per-holding PnL in both currencies):** **Given** a holding row `{ quantity: 10, avgCost: 90, lastPrice: 100, currency: "USD" }` AND `rates = { base: "EUR", date: "2026-05-19", rates: { EUR: 1, USD: 1.08, GBP: 0.85, CHF: 0.95 } }`, **When** `computeHoldingPnl({ quantity: 10, avgCost: 90, lastPrice: 100, currency: "USD" }, rates, "EUR")` is called, **Then** the returned `HoldingPnl` satisfies `native.pnl === 100` (10 × (100 − 90)) AND `Math.abs(native.pnlPct - 0.1111111111) < 1e-6` ((100 − 90) / 90) AND `Math.abs(eur.pnl - 92.5925925926) < 1e-6` (100 / 1.08) AND `Math.abs(eur.pnlPct - 0.1111111111) < 1e-6` (pct is currency-invariant). **And** when `lastPrice: 80` instead (loss), **Then** `native.pnl === -100` AND `eur.pnl < 0` (sign preserved).

- **AC-4 (FR-19 — PnL fallback 1:1 when rates=null):** **Given** the same holding as AC-3 AND `rates = null` (Frankfurter unreachable), **When** `computeHoldingPnl({ quantity: 10, avgCost: 90, lastPrice: 100, currency: "USD" }, null, "EUR")` is called, **Then** `native.pnl === 100` AND `eur.pnl === 100` (identity — 1:1 path) AND `eur.pnlPct === native.pnlPct`. **And** when `avgCost === 0` (manual entry, zero-cost lot), **Then** `native.pnlPct === 0` AND `eur.pnlPct === 0` (division-by-zero guard).

- **AC-5 (Frankfurter best-effort — typed error + AbortSignal timeout):** **Given** a `frankfurterClient = createFrankfurterClient({ baseUrl: "https://example.invalid", timeoutMs: 100 })` AND a `fetch` stub that never resolves (simulating a hang), **When** `frankfurterClient.getRates("EUR")` is called, **Then** within 200 ms wall-clock the promise rejects with an instance of `FrankfurterError` AND `err.code === "network"`. **And** when the stubbed `fetch` returns `{ status: 200, json: () => ({ amount: 1, base: "EUR", date: "2026-05-19", rates: { USD: 1.08, GBP: 0.85, CHF: 0.95 } }) }`, **Then** `getRates("EUR")` resolves to `{ base: "EUR", date: "2026-05-19", rates: { EUR: 1, USD: 1.08, GBP: 0.85, CHF: 0.95 } }` (the base is stamped with value 1, foreign rates parsed; the unsupported `JPY` key in the wire payload is dropped). **And** when the wire payload returns HTTP 503, **Then** the promise rejects with `FrankfurterError({ code: "network" })` (5xx mapped to network — matches brownfield `fx.ts:42`).

- **AC-6 (L1 invariant — zero `*.types.ts` under `apps/api/src/modules/holdings/services/` and `apps/api/src/common/derive/`):** **Given** the story is shipped, **When** the dev runs `find apps/api/src/modules/holdings/services apps/api/src/common/derive -name '*.types.ts'`, **Then** the command returns empty (zero matches). **And** when the dev runs `grep -rnE "(PortfolioSnapshotFx|HoldingPnl|FxRates|FxSource)\\b" apps/api/src/common/derive apps/api/src/modules/holdings/services | grep -vE "^[^:]+:[^:]+:\\s*(import|//|\\*)"`, **Then** every match is the symbol used in a function signature or return-type annotation (no `export type … = …` declarations inside `apps/api`). All types are declared in `packages/validators/src/holdings.ts` and re-exported from `packages/types/src/index.ts`. (L1 lesson 2026-05-09, scope `aped-arch, aped-dev, aped-review`.)

- **AC-7 (Env back-compat — `FRANKFURTER_BASE_URL` optional, `isConfigured` short-circuit):** **Given** an `apps/api` process with only the existing required env vars set (`DATABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_URL`) AND `FRANKFURTER_BASE_URL` unset, **When** the dev runs `bun --filter=api run typecheck && bun --filter=api run test`, **Then** `loadEnv()` succeeds with `env.FRANKFURTER_BASE_URL === undefined` AND `frankfurterClient.isConfigured === false`. **And** when `FRANKFURTER_BASE_URL=""` (empty string in `.env`), **Then** the loader treats it as absent (`optionalString` precedent) — `env.FRANKFURTER_BASE_URL === undefined`. **And** when `FRANKFURTER_BASE_URL=https://api.frankfurter.app`, **Then** `frankfurterClient.isConfigured === true`. (No default URL is hard-coded — explicit opt-in per the 3-2 `PricesClient.isConfigured` precedent.)

- **AC-8 (Purity of `common/derive/portfolio-fx.ts` + `holding-pnl.ts`):** **Given** the story is shipped, **When** the dev runs `grep -rnE "(fetch\\(|prisma|new Date\\(|Date\\.now\\(|import .* from '@opentelemetry)" apps/api/src/common/derive/portfolio-fx.ts apps/api/src/common/derive/holding-pnl.ts`, **Then** the command returns empty (zero matches). The two helpers receive all inputs by argument (accounts, holdings, rates, base, optional clock for callers that need determinism — but the helpers themselves do not read the system clock or call `fetch`). Mirrors the existing `apps/api/src/common/derive/holding-quantity.ts` and `compass-curve.ts` purity contracts.

## Tasks

- [x] **T1 (test+code, [AC: AC-7])** — Extend `apps/api/src/config/env.ts` with `FRANKFURTER_BASE_URL: optionalString(z.string().url())` and extend `apps/api/src/config/env.test.ts` with two new test cases (`FRANKFURTER_BASE_URL` round-trip + empty-string-as-absent).

  Edit `apps/api/src/config/env.ts` — append the new field inside `envSchema`, after `TWELVE_DATA_API_KEY` and before the OTel block (alphabetical-by-prefix preserved, with a comment block matching the price-chain pattern). The file becomes:

  ```ts
  import { z } from "zod";

  // Treat `KEY=` in .env as absent — brownfield reads process.env directly and
  // `""` is falsy. Without this, optional URL / non-empty schemas reject the
  // shell-truthy-but-content-empty pattern with a confusing validation error.
  const optionalString = <T extends z.ZodTypeAny>(schema: T) =>
    z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

  const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().max(65535).default(3001),
    HOST: z.string().min(1).default("127.0.0.1"),
    SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().max(60_000).default(10_000),
    DATABASE_URL: z.string().url(),
    SUPABASE_JWT_SECRET: z
      .string()
      .min(32, "SUPABASE_JWT_SECRET must be ≥ 32 chars (read it from `bunx supabase status`)"),
    // Supabase project URL — used to derive the JWT issuer
    // (`<SUPABASE_URL>/auth/v1`) for `iss` claim verification (ADR-0013
    // belt+suspenders). The value is the same as `NEXT_PUBLIC_SUPABASE_URL` on
    // the web tier; it lives here too so apps/api can run independently.
    SUPABASE_URL: z.string().url(),
    // Price-chain providers (story 3-2). All optional — when unset, the
    // corresponding tier throws a typed `not-configured` / `missing-key`
    // error and the orchestrator falls back to the next tier.
    PRICES_SERVICE_URL: optionalString(z.string().url()),
    PRICES_SERVICE_TOKEN: optionalString(z.string().min(1)),
    TWELVE_DATA_API_KEY: optionalString(z.string().min(1)),
    // FX provider (story 3-3, FR-18). Best-effort: when unset, the snapshot
    // computes with `fxSource: 'fallback'` (1:1 identity, per NFR-19). No
    // default URL — explicit opt-in mirrors PRICES_SERVICE_URL.
    FRANKFURTER_BASE_URL: optionalString(z.string().url()),
    // OTel SDK config (story 0-7 — ADR-0005). All three are optional with
    // safe defaults so brownfield .env files keep working.
    OTEL_SERVICE_NAME: z.string().min(1).default("pekulo-api"),
    OTEL_EXPORTER_OTLP_ENDPOINT: optionalString(z.string().url()),
    OTEL_LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("error"),
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

  Edit `apps/api/src/config/env.test.ts` — append two new tests at the end of the `describe("loadEnv", …)` block, plus extend the existing "parses minimal env with no price-chain vars" assertion to also assert `FRANKFURTER_BASE_URL === undefined`. The file becomes:

  ```ts
  import { describe, expect, test } from "bun:test";
  import { ConfigError, loadEnv } from "./env";

  const BASE = {
    DATABASE_URL: "postgres://x:y@localhost:5432/db",
    SUPABASE_JWT_SECRET: "x".repeat(32),
    SUPABASE_URL: "https://example.supabase.co",
  } as const;

  describe("loadEnv", () => {
    test("parses minimal env with no price-chain vars", () => {
      const env = loadEnv(BASE);
      expect(env.PRICES_SERVICE_URL).toBeUndefined();
      expect(env.PRICES_SERVICE_TOKEN).toBeUndefined();
      expect(env.TWELVE_DATA_API_KEY).toBeUndefined();
      expect(env.FRANKFURTER_BASE_URL).toBeUndefined();
    });

    test("parses env with all three price-chain vars set", () => {
      const env = loadEnv({
        ...BASE,
        PRICES_SERVICE_URL: "https://prices.internal:8000",
        PRICES_SERVICE_TOKEN: "tok-abc",
        TWELVE_DATA_API_KEY: "td-key",
      });
      expect(env.PRICES_SERVICE_URL).toBe("https://prices.internal:8000");
      expect(env.PRICES_SERVICE_TOKEN).toBe("tok-abc");
      expect(env.TWELVE_DATA_API_KEY).toBe("td-key");
    });

    test("rejects malformed PRICES_SERVICE_URL", () => {
      expect(() => loadEnv({ ...BASE, PRICES_SERVICE_URL: "not-a-url" })).toThrow(ConfigError);
    });

    test("treats empty-string env vars as absent (KEY= in .env)", () => {
      const env = loadEnv({
        ...BASE,
        PRICES_SERVICE_URL: "",
        PRICES_SERVICE_TOKEN: "",
        TWELVE_DATA_API_KEY: "",
        FRANKFURTER_BASE_URL: "",
      });
      expect(env.PRICES_SERVICE_URL).toBeUndefined();
      expect(env.PRICES_SERVICE_TOKEN).toBeUndefined();
      expect(env.TWELVE_DATA_API_KEY).toBeUndefined();
      expect(env.FRANKFURTER_BASE_URL).toBeUndefined();
    });

    test("parses env with FRANKFURTER_BASE_URL set", () => {
      const env = loadEnv({ ...BASE, FRANKFURTER_BASE_URL: "https://api.frankfurter.app" });
      expect(env.FRANKFURTER_BASE_URL).toBe("https://api.frankfurter.app");
    });

    test("rejects malformed FRANKFURTER_BASE_URL", () => {
      expect(() => loadEnv({ ...BASE, FRANKFURTER_BASE_URL: "not-a-url" })).toThrow(ConfigError);
    });
  });
  ```

  Run: `bun --filter=api run test src/config/env.test.ts`
  Expected: `6 pass, 0 fail` (4 pre-existing + 2 new), exit 0.
  Commit: `git add apps/api/src/config/env.ts apps/api/src/config/env.test.ts && git commit -m "feat(#22): env adds FRANKFURTER_BASE_URL (optional)"`

- [x] **T2 (code, [AC: AC-1, AC-2, AC-3, AC-4, AC-6])** — Extend `packages/validators/src/holdings.ts` with `fxSourceSchema`, `fxRatesSchema`, `portfolioSnapshotFxSchema`, `holdingPnlSchema`. Re-export the inferred types from `packages/types/src/index.ts`.

  Append the following block at the END of `packages/validators/src/holdings.ts`, after the existing `priceQuoteInputSchema` block (which itself follows `priceQuoteSchema` / `priceProviderAttemptSchema`):

  ```ts
  // ─── FX + portfolio snapshot (story 3-3) ─────────────────────────────────
  // Pure helpers under apps/api/src/common/derive/ produce these shapes from
  // Account[] + Holding[] + FxRates. NO oRPC contract surface — these are
  // service-internal DTOs, but they live here because @pekulo/types re-exports
  // the inferred types (L1 invariant: zero `*.types.ts` under apps/api/src/modules
  // AND apps/api/src/common/derive).
  //
  // Currency union here is `HOLDING_CURRENCIES` (EUR | USD | GBP | CHF) — the
  // same closed set used by Account.currency and Holding.currency, so the FX
  // matrix has 4×4 = 16 cells but only 3 non-identity foreign rates per base.

  export const FX_SOURCES = ["live", "fallback"] as const;
  export const fxSourceSchema = z.enum(FX_SOURCES);
  export type FxSource = z.infer<typeof fxSourceSchema>;

  // FxRates: 1 unit of `base` = X units of foreign. `base` is always present
  // with value 1 (computeSnapshotFx asserts via lookup; clients stamp on read).
  // `date` is the rate as-of date returned by Frankfurter ("amount=1&base=EUR"
  // endpoint).
  export const fxRatesSchema = z.object({
    base: z.enum(HOLDING_CURRENCIES),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
    rates: z.record(z.enum(HOLDING_CURRENCIES), z.number().positive()),
  });
  export type FxRates = z.infer<typeof fxRatesSchema>;

  // PortfolioSnapshotFx — pure aggregation. byAccount[].total is in `fxBase`
  // (the snapshot is normalised to one base). `fxAvailable` is kept for
  // back-compat with the brownfield (deprecated mirror of `fxSource === "live"`);
  // 3-4/7-1 may migrate to `fxSource` and drop `fxAvailable` in a later story.
  // `fxAsOf` is null in fallback mode (rates were unavailable).
  export const portfolioSnapshotFxSchema = z.object({
    accounts: z.array(accountSchema),
    holdings: z.array(holdingSchema),
    kpi: z.object({
      capitalTotal: z.number(),
      cash: z.number(),
      invested: z.number(),
      marketValue: z.number(),
      pnl: z.number(),
    }),
    byAccount: z.array(
      z.object({
        accountId: z.string().min(1),
        label: z.string().min(1),
        total: z.number(),
      }),
    ),
    fxBase: z.enum(HOLDING_CURRENCIES),
    fxAsOf: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "fxAsOf must be YYYY-MM-DD")
      .nullable(),
    fxAvailable: z.boolean(),
    fxSource: fxSourceSchema,
  });
  export type PortfolioSnapshotFx = z.infer<typeof portfolioSnapshotFxSchema>;

  // HoldingPnl — per-holding unrealised PnL in both holding-native currency
  // and the snapshot base. `pnlPct` is currency-invariant (it is the ratio
  // (lastPrice - avgCost) / avgCost — division-by-zero guard returns 0 when
  // avgCost === 0, e.g. manual zero-cost lot).
  export const holdingPnlSchema = z.object({
    native: z.object({
      pnl: z.number(),
      pnlPct: z.number(),
    }),
    eur: z.object({
      pnl: z.number(),
      pnlPct: z.number(),
    }),
  });
  export type HoldingPnl = z.infer<typeof holdingPnlSchema>;
  ```

  Note: the snippet imports `accountSchema` and `holdingSchema` from the same file (already declared above) — no new import lines required. If `accountSchema` is not yet imported into `holdings.ts`, prepend `import { accountSchema } from "./accounts";` at the top (the validators index already re-exports it; the holdings module needs the direct symbol).

  Then edit `packages/types/src/index.ts` — append the following block right after the existing `PRICE_PROVIDERS` re-export (line ~74):

  ```ts
  /** FX + portfolio snapshot (story 3-3) — pure helper outputs, no oRPC surface. */
  export type {
    FxSource,
    FxRates,
    PortfolioSnapshotFx,
    HoldingPnl,
  } from "@pekulo/validators";
  export { FX_SOURCES } from "@pekulo/validators";
  ```

  Run: `bun --filter=validators run test && bun --filter=api run typecheck`
  Expected: validators tests stay green (no behavioural change — only new exports); typecheck exits 0.
  Commit: `git add packages/validators/src/holdings.ts packages/types/src/index.ts && git commit -m "feat(#22): validators + types — FxSource, FxRates, PortfolioSnapshotFx, HoldingPnl"`

- [x] **T3 (RED, [AC: AC-5])** — Add `apps/api/src/modules/holdings/services/frankfurter-client.test.ts` covering the FX provider client (`getRates` happy path + network/format/timeout error mapping + base stamping with value 1 + foreign-key whitelist via `HOLDING_CURRENCIES`). The module does NOT exist yet — RED expected.

  Create `apps/api/src/modules/holdings/services/frankfurter-client.test.ts`:

  ```ts
  import { afterEach, beforeEach, describe, expect, test } from "bun:test";
  import {
    createFrankfurterClient,
    FrankfurterError,
    type FrankfurterClient,
  } from "./frankfurter-client";

  type FetchCall = { url: string; init?: RequestInit };

  function installFetchStub(stub: (call: FetchCall) => Promise<Response>): () => void {
    const original = globalThis.fetch;
    const calls: FetchCall[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const call: FetchCall = { url, init };
      calls.push(call);
      return stub(call);
    }) as typeof fetch;
    (globalThis.fetch as unknown as { __calls: FetchCall[] }).__calls = calls;
    return () => {
      globalThis.fetch = original;
    };
  }

  let restore: () => void;

  afterEach(() => {
    if (restore) restore();
  });

  describe("createFrankfurterClient", () => {
    test("isConfigured reflects baseUrl presence", () => {
      const configured: FrankfurterClient = createFrankfurterClient({
        baseUrl: "https://api.frankfurter.app",
      });
      const unconfigured: FrankfurterClient = createFrankfurterClient({ baseUrl: undefined });
      expect(configured.isConfigured).toBe(true);
      expect(unconfigured.isConfigured).toBe(false);
    });

    test("getRates throws not-configured when baseUrl is undefined", async () => {
      const client = createFrankfurterClient({ baseUrl: undefined });
      let err: unknown;
      try {
        await client.getRates("EUR");
      } catch (caught) {
        err = caught;
      }
      expect(err).toBeInstanceOf(FrankfurterError);
      expect((err as FrankfurterError).code).toBe("not-configured");
    });

    test("getRates returns parsed FxRates with base stamped at 1 on HTTP 200", async () => {
      restore = installFetchStub(async () =>
        new Response(
          JSON.stringify({
            amount: 1,
            base: "EUR",
            date: "2026-05-19",
            rates: { USD: 1.08, GBP: 0.85, CHF: 0.95, JPY: 165.2 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
      const client = createFrankfurterClient({ baseUrl: "https://api.frankfurter.app" });
      const out = await client.getRates("EUR");
      expect(out.base).toBe("EUR");
      expect(out.date).toBe("2026-05-19");
      expect(out.rates).toEqual({ EUR: 1, USD: 1.08, GBP: 0.85, CHF: 0.95 });
      // JPY is filtered (not in HOLDING_CURRENCIES)
      expect((out.rates as Record<string, number>).JPY).toBeUndefined();
    });

    test("getRates maps HTTP 5xx to FrankfurterError(network)", async () => {
      restore = installFetchStub(async () => new Response("upstream down", { status: 503 }));
      const client = createFrankfurterClient({ baseUrl: "https://api.frankfurter.app" });
      let err: unknown;
      try {
        await client.getRates("EUR");
      } catch (caught) {
        err = caught;
      }
      expect(err).toBeInstanceOf(FrankfurterError);
      expect((err as FrankfurterError).code).toBe("network");
      expect((err as FrankfurterError).message).toContain("503");
    });

    test("getRates maps non-JSON body to FrankfurterError(format)", async () => {
      restore = installFetchStub(async () => new Response("<html>nope</html>", { status: 200 }));
      const client = createFrankfurterClient({ baseUrl: "https://api.frankfurter.app" });
      let err: unknown;
      try {
        await client.getRates("EUR");
      } catch (caught) {
        err = caught;
      }
      expect(err).toBeInstanceOf(FrankfurterError);
      expect((err as FrankfurterError).code).toBe("format");
    });

    test("getRates maps missing rates field to FrankfurterError(format)", async () => {
      restore = installFetchStub(async () =>
        new Response(JSON.stringify({ amount: 1, base: "EUR", date: "2026-05-19" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
      const client = createFrankfurterClient({ baseUrl: "https://api.frankfurter.app" });
      let err: unknown;
      try {
        await client.getRates("EUR");
      } catch (caught) {
        err = caught;
      }
      expect(err).toBeInstanceOf(FrankfurterError);
      expect((err as FrankfurterError).code).toBe("format");
    });

    test("getRates respects AbortSignal timeout — hanging fetch rejects with network within ceiling", async () => {
      restore = installFetchStub(
        (call) =>
          new Promise<Response>((_resolve, reject) => {
            call.init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("aborted", "AbortError"));
            });
          }),
      );
      const client = createFrankfurterClient({
        baseUrl: "https://api.frankfurter.app",
        timeoutMs: 100,
      });
      const t0 = performance.now();
      let err: unknown;
      try {
        await client.getRates("EUR");
      } catch (caught) {
        err = caught;
      }
      const dt = performance.now() - t0;
      expect(err).toBeInstanceOf(FrankfurterError);
      expect((err as FrankfurterError).code).toBe("network");
      expect(dt).toBeLessThan(300); // 100 ms timeout + 200 ms slack
    });

    test("getRates URL encodes base + symbols whitelist", async () => {
      const seen: string[] = [];
      restore = installFetchStub(async (call) => {
        seen.push(call.url);
        return new Response(
          JSON.stringify({
            amount: 1,
            base: "USD",
            date: "2026-05-19",
            rates: { EUR: 0.92, GBP: 0.78, CHF: 0.88 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      });
      const client = createFrankfurterClient({ baseUrl: "https://api.frankfurter.app" });
      await client.getRates("USD");
      expect(seen[0]).toBe(
        "https://api.frankfurter.app/latest?base=USD&symbols=EUR%2CGBP%2CCHF",
      );
    });
  });
  ```

  Run: `bun --filter=api run test src/modules/holdings/services/frankfurter-client.test.ts`
  Expected: **RED** — Bun cannot resolve `./frankfurter-client` (`Cannot find module 'frankfurter-client'`). This proves the test is wired and waiting for T4.
  Commit: `git add apps/api/src/modules/holdings/services/frankfurter-client.test.ts && git commit -m "test(#22): RED — frankfurter-client (network, format, timeout, base stamping)"`

- [x] **T4 (GREEN, [AC: AC-5, AC-7])** — Create `apps/api/src/modules/holdings/services/frankfurter-client.ts` — port of `apps/web/src/lib/services/fx.ts`. Diffs vs brownfield: (a) factory pattern, no module-level state; (b) `AbortSignal.timeout(timeoutMs)` injected (default 1500 ms — brownfield had none); (c) NO in-client cache (caller policy — keeps the client pure-ish); (d) `isConfigured: boolean` mirrors `PricesClient` precedent (3-2); (e) `HOLDING_CURRENCIES` whitelist filters unsupported foreign keys.

  Create `apps/api/src/modules/holdings/services/frankfurter-client.ts`:

  ```ts
  // Tier-unique FX provider — HTTP to api.frankfurter.app (public, no auth).
  // Port of apps/web/src/lib/services/fx.ts.
  //
  // Diffs vs brownfield:
  //   - Factory pattern (createFrankfurterClient(deps)) — no module-level
  //     cache or process.env access. Caller owns caching policy (24 h in the
  //     brownfield; 3-3 keeps the client stateless and lets 7-1 decide).
  //   - AbortSignal.timeout(timeoutMs) injected — brownfield had no timeout,
  //     which silently violated the "best-effort, ≤ 50 ms fallback" budget
  //     (NFR-19) on slow networks. Default 1500 ms (Frankfurter typical p99).
  //   - isConfigured: boolean — mirrors PricesClient precedent (3-2). The
  //     caller short-circuits when false and stamps `fxSource: 'fallback'`.
  //   - HOLDING_CURRENCIES whitelist — the wire payload may include foreign
  //     keys we do not model (JPY, AUD, …). Drop them at parse time so the
  //     downstream FxRates literal stays sound.

  import { HOLDING_CURRENCIES, type HoldingCurrency, type FxRates } from "@pekulo/validators";

  export type FrankfurterErrorCode = "not-configured" | "network" | "format";

  export class FrankfurterError extends Error {
    override readonly name = "FrankfurterError";
    readonly code: FrankfurterErrorCode;
    constructor(code: FrankfurterErrorCode, message: string) {
      super(message);
      this.code = code;
    }
  }

  export interface FrankfurterClient {
    /**
     * True when FRANKFURTER_BASE_URL is set. The caller short-circuits when
     * false and stamps `fxSource: 'fallback'` (1:1 identity).
     */
    isConfigured: boolean;
    /**
     * Fetch the latest rates with `base` as the reference (1 unit of base = X
     * foreign). Resolves to an FxRates with `rates[base] === 1` stamped on
     * read. Rejects with FrankfurterError on network/format/timeout.
     */
    getRates(base: HoldingCurrency): Promise<FxRates>;
  }

  export interface CreateFrankfurterClientDeps {
    baseUrl: string | undefined;
    timeoutMs?: number;
  }

  export function createFrankfurterClient(deps: CreateFrankfurterClientDeps): FrankfurterClient {
    const timeoutMs = deps.timeoutMs ?? 1_500;
    return {
      isConfigured: Boolean(deps.baseUrl),
      async getRates(base) {
        const baseUrl = deps.baseUrl;
        if (!baseUrl) {
          throw new FrankfurterError("not-configured", "FRANKFURTER_BASE_URL non défini.");
        }
        const others = HOLDING_CURRENCIES.filter((c) => c !== base);
        const url = `${baseUrl.replace(/\/$/, "")}/latest?base=${encodeURIComponent(
          base,
        )}&symbols=${others.map((c) => encodeURIComponent(c)).join("%2C")}`;

        let res: Response;
        try {
          res = await fetch(url, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(timeoutMs),
          });
        } catch (err) {
          throw new FrankfurterError(
            "network",
            `Frankfurter unreachable: ${err instanceof Error ? err.message : String(err)}`,
          );
        }

        if (!res.ok) {
          throw new FrankfurterError("network", `Frankfurter HTTP ${res.status}`);
        }

        let json: unknown;
        try {
          json = await res.json();
        } catch {
          throw new FrankfurterError("format", "Frankfurter: réponse non-JSON.");
        }

        const obj = json as { date?: unknown; rates?: unknown };
        if (!obj.rates || typeof obj.rates !== "object") {
          throw new FrankfurterError("format", "Frankfurter: champ rates absent.");
        }
        if (typeof obj.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(obj.date)) {
          throw new FrankfurterError("format", "Frankfurter: champ date absent ou mal formé.");
        }

        const wireRates = obj.rates as Record<string, unknown>;
        const rates: Partial<Record<HoldingCurrency, number>> = { [base]: 1 };
        for (const c of others) {
          const raw = Number(wireRates[c]);
          if (Number.isFinite(raw) && raw > 0) rates[c] = raw;
        }
        return {
          base,
          date: obj.date,
          rates: rates as FxRates["rates"],
        };
      },
    };
  }
  ```

  Run: `bun --filter=api run test src/modules/holdings/services/frankfurter-client.test.ts`
  Expected: `8 pass, 0 fail`, exit 0.
  Commit: `git add apps/api/src/modules/holdings/services/frankfurter-client.ts && git commit -m "feat(#22): GREEN — frankfurter-client (best-effort, AbortSignal timeout, no cache)"`

- [x] **T5 (RED, [AC: AC-1, AC-2, AC-6, AC-8])** — Add `apps/api/src/common/derive/portfolio-fx.test.ts` covering the pure snapshot aggregator (KPI math, `fxSource` transitions, `byAccount` aggregation, currency-wide identity when `rates === null`, base stamping). The module does NOT exist yet — RED expected.

  Create `apps/api/src/common/derive/portfolio-fx.test.ts`:

  ```ts
  import { describe, expect, test } from "bun:test";
  import type { Account, FxRates, Holding } from "@pekulo/validators";
  import { computeSnapshotFx } from "./portfolio-fx";

  function makeAccount(over: Partial<Account>): Account {
    return {
      id: "acc_aaaaaaaaaaaaaaaaaaaaa",
      userId: "00000000-0000-0000-0000-000000000000",
      label: "Compte EUR",
      type: "cto",
      currency: "EUR",
      cashBalance: 0,
      notes: null,
      createdAt: new Date("2026-05-01T00:00:00Z"),
      updatedAt: new Date("2026-05-01T00:00:00Z"),
      ...over,
    } as Account;
  }

  function makeHolding(over: Partial<Holding>): Holding {
    return {
      id: "hld_aaaaaaaaaaaaaaaaaaaaa",
      userId: "00000000-0000-0000-0000-000000000000",
      accountId: "acc_aaaaaaaaaaaaaaaaaaaaa",
      kind: "action",
      ticker: "AAPL",
      isin: null,
      label: "Apple",
      currency: "USD",
      quantity: 100,
      avgCost: 8,
      lastPrice: 10,
      lastPriceAt: null,
      notes: null,
      createdAt: new Date("2026-05-01T00:00:00Z"),
      updatedAt: new Date("2026-05-01T00:00:00Z"),
      closedAt: null,
      ...over,
    } as Holding;
  }

  const RATES_EUR: FxRates = {
    base: "EUR",
    date: "2026-05-19",
    rates: { EUR: 1, USD: 1.08, GBP: 0.85, CHF: 0.95 },
  };

  describe("computeSnapshotFx", () => {
    test("AC-1: USD holding + rates=null → identity, fxSource=fallback, fxAsOf=null", () => {
      const accounts = [makeAccount({ currency: "EUR", cashBalance: 0 })];
      const holdings = [makeHolding({ currency: "USD", quantity: 100, avgCost: 8, lastPrice: 10 })];
      const snap = computeSnapshotFx(accounts, holdings, null, "EUR");
      expect(snap.fxBase).toBe("EUR");
      expect(snap.fxAvailable).toBe(false);
      expect(snap.fxSource).toBe("fallback");
      expect(snap.fxAsOf).toBeNull();
      expect(snap.kpi.marketValue).toBe(1000);
      expect(snap.kpi.invested).toBe(800);
      expect(snap.kpi.pnl).toBe(200);
      expect(snap.kpi.cash).toBe(0);
      expect(snap.kpi.capitalTotal).toBe(1000);
      expect(snap.byAccount).toHaveLength(1);
      expect(snap.byAccount[0].accountId).toBe("acc_aaaaaaaaaaaaaaaaaaaaa");
      expect(snap.byAccount[0].total).toBe(1000);
    });

    test("AC-2: USD holding + live rates → FX-adjusted KPIs, fxSource=live, fxAsOf=YYYY-MM-DD", () => {
      const accounts = [makeAccount({ currency: "EUR", cashBalance: 0 })];
      const holdings = [makeHolding({ currency: "USD", quantity: 100, avgCost: 8, lastPrice: 10 })];
      const snap = computeSnapshotFx(accounts, holdings, RATES_EUR, "EUR");
      expect(snap.fxAvailable).toBe(true);
      expect(snap.fxSource).toBe("live");
      expect(snap.fxAsOf).toBe("2026-05-19");
      expect(Math.abs(snap.kpi.marketValue - 1000 / 1.08)).toBeLessThan(0.01);
      expect(Math.abs(snap.kpi.invested - 800 / 1.08)).toBeLessThan(0.01);
      expect(Math.abs(snap.kpi.pnl - 200 / 1.08)).toBeLessThan(0.01);
    });

    test("cash and holdings combine in byAccount.total at base currency", () => {
      const accounts = [
        makeAccount({ id: "acc_eur", currency: "EUR", cashBalance: 500, label: "Livret" }),
        makeAccount({ id: "acc_usd", currency: "USD", cashBalance: 1080, label: "CTO USD" }),
      ];
      const holdings = [
        makeHolding({
          id: "hld_aapl",
          accountId: "acc_usd",
          currency: "USD",
          quantity: 100,
          avgCost: 8,
          lastPrice: 10,
        }),
      ];
      const snap = computeSnapshotFx(accounts, holdings, RATES_EUR, "EUR");
      // EUR account: 500 EUR cash, no holdings → byAccount total = 500
      const eurRow = snap.byAccount.find((b) => b.accountId === "acc_eur");
      expect(eurRow?.total).toBe(500);
      // USD account: 1080 USD cash + 1000 USD holding = 2080 USD → /1.08 ≈ 1925.93 EUR
      const usdRow = snap.byAccount.find((b) => b.accountId === "acc_usd");
      expect(usdRow).toBeDefined();
      expect(Math.abs((usdRow as { total: number }).total - 2080 / 1.08)).toBeLessThan(0.01);
      // Total cash KPI = 500 + 1080/1.08 ≈ 1500
      expect(Math.abs(snap.kpi.cash - (500 + 1080 / 1.08))).toBeLessThan(0.01);
    });

    test("rates=null treats every conversion as identity (no FX applied)", () => {
      const accounts = [
        makeAccount({ id: "acc_eur", currency: "EUR", cashBalance: 100 }),
        makeAccount({ id: "acc_usd", currency: "USD", cashBalance: 200 }),
      ];
      const holdings: Holding[] = [];
      const snap = computeSnapshotFx(accounts, holdings, null, "EUR");
      expect(snap.kpi.cash).toBe(300); // 100 + 200, identity
      expect(snap.fxSource).toBe("fallback");
    });

    test("unknown foreign rate (not in rates.rates) falls back to identity per row", () => {
      // Simulate Frankfurter returning only USD — GBP holding has no rate.
      const partialRates: FxRates = {
        base: "EUR",
        date: "2026-05-19",
        rates: { EUR: 1, USD: 1.08 } as FxRates["rates"],
      };
      const accounts = [makeAccount({ id: "acc_x", currency: "EUR", cashBalance: 0 })];
      const holdings = [
        makeHolding({
          id: "hld_gbp",
          accountId: "acc_x",
          currency: "GBP",
          quantity: 10,
          avgCost: 1,
          lastPrice: 2,
        }),
      ];
      const snap = computeSnapshotFx(accounts, holdings, partialRates, "EUR");
      // GBP rate missing → identity: 10 × 2 = 20 (stamped as EUR even though native is GBP)
      expect(snap.kpi.marketValue).toBe(20);
      expect(snap.fxSource).toBe("live"); // rates object was provided
    });

    test("accounts and holdings arrays in output are referentially passed through", () => {
      const accounts = [makeAccount({})];
      const holdings = [makeHolding({})];
      const snap = computeSnapshotFx(accounts, holdings, RATES_EUR, "EUR");
      expect(snap.accounts).toBe(accounts);
      expect(snap.holdings).toBe(holdings);
    });

    test("base parameter defaults to EUR when omitted", () => {
      const snap = computeSnapshotFx([], [], null);
      expect(snap.fxBase).toBe("EUR");
    });
  });
  ```

  Run: `bun --filter=api run test src/common/derive/portfolio-fx.test.ts`
  Expected: **RED** — Bun cannot resolve `./portfolio-fx` (`Cannot find module 'portfolio-fx'`). This proves the test is wired and waiting for T6.
  Commit: `git add apps/api/src/common/derive/portfolio-fx.test.ts && git commit -m "test(#22): RED — portfolio-fx (KPI math, fxSource transitions, byAccount)"`

- [x] **T6 (GREEN, [AC: AC-1, AC-2, AC-6, AC-8])** — Create `apps/api/src/common/derive/portfolio-fx.ts` — port of `apps/web/src/lib/derive-portfolio-fx.ts` with the `fxSource` field added (NFR-19 transparency). Pure — zero I/O, zero clock access, zero Prisma imports.

  Create `apps/api/src/common/derive/portfolio-fx.ts`:

  ```ts
  // Pure FX-aware portfolio aggregator. Port of apps/web/src/lib/derive-portfolio-fx.ts.
  //
  // Diffs vs brownfield:
  //   - `fxSource: 'live' | 'fallback'` field added (NFR-19 transparency —
  //     brownfield silently used 1:1 when rates were null, callers had to
  //     read `fxAvailable` instead). Kept `fxAvailable` for back-compat.
  //   - HOLDING_CURRENCIES whitelist (validator-side) — the FxRates shape
  //     restricts foreign keys to currencies we model.
  //   - convertToBase inlined as a private helper (brownfield re-exported it
  //     from a fx-types module; here the helper is local and pure).
  //
  // Pure rules (AC-8):
  //   - No `fetch`, no Prisma, no `Date.now()`, no `@opentelemetry/*` imports.
  //   - All inputs by argument (accounts, holdings, rates, base).

  import type {
    Account,
    FxRates,
    HoldingCurrency,
    Holding,
    PortfolioSnapshotFx,
  } from "@pekulo/validators";

  function convertToBase(amount: number, from: HoldingCurrency, rates: FxRates): number {
    if (from === rates.base) return amount;
    const r = rates.rates[from];
    if (!r || r <= 0) return amount; // unknown rate → identity (best-effort, mirrors brownfield)
    return amount / r;
  }

  /**
   * Compute portfolio aggregates with FX normalisation.
   * - Per-row values (account.cashBalance, holding.lastPrice) keep their native
   *   currency in the returned `accounts` and `holdings` arrays — they are
   *   passed through by reference (no copy, no reshape).
   * - KPIs (capitalTotal, cash, invested, marketValue, pnl) and `byAccount[].total`
   *   are aggregated AFTER conversion to `base`.
   * - When `rates` is null, every conversion is identity (1:1) AND the result
   *   stamps `fxSource: 'fallback'`. When `rates` is provided, `fxSource: 'live'`
   *   regardless of partial-rate fallbacks per row (those are still considered
   *   "live, best-effort" — fxSource is a snapshot-level claim, not per-row).
   */
  export function computeSnapshotFx(
    accounts: Account[],
    holdings: Holding[],
    rates: FxRates | null,
    base: HoldingCurrency = "EUR",
  ): PortfolioSnapshotFx {
    const conv = (amount: number, from: HoldingCurrency): number =>
      rates ? convertToBase(amount, from, rates) : amount;

    const cash = accounts.reduce(
      (acc, a) => acc + conv(a.cashBalance, a.currency as HoldingCurrency),
      0,
    );
    const invested = holdings.reduce(
      (acc, h) => acc + conv(h.quantity * h.avgCost, h.currency),
      0,
    );
    const marketValue = holdings.reduce(
      (acc, h) => acc + conv(h.quantity * h.lastPrice, h.currency),
      0,
    );
    const capitalTotal = cash + marketValue;
    const pnl = marketValue - invested;

    const byAccount = accounts.map((a) => {
      const cashBase = conv(a.cashBalance, a.currency as HoldingCurrency);
      const holdingValueBase = holdings
        .filter((h) => h.accountId === a.id)
        .reduce((sum, h) => sum + conv(h.quantity * h.lastPrice, h.currency), 0);
      return {
        accountId: a.id,
        label: a.label,
        total: cashBase + holdingValueBase,
      };
    });

    return {
      accounts,
      holdings,
      kpi: { capitalTotal, cash, invested, marketValue, pnl },
      byAccount,
      fxBase: base,
      fxAsOf: rates?.date ?? null,
      fxAvailable: rates !== null,
      fxSource: rates ? "live" : "fallback",
    };
  }
  ```

  Run: `bun --filter=api run test src/common/derive/portfolio-fx.test.ts`
  Expected: `7 pass, 0 fail`, exit 0.
  Commit: `git add apps/api/src/common/derive/portfolio-fx.ts && git commit -m "feat(#22): GREEN — portfolio-fx (pure, fxSource transparency, NFR-19)"`

- [x] **T7 (RED, [AC: AC-3, AC-4, AC-6, AC-8])** — Add `apps/api/src/common/derive/holding-pnl.test.ts` covering per-holding PnL (native + EUR, signed, zero-cost guard, fallback identity). The module does NOT exist yet — RED expected.

  Create `apps/api/src/common/derive/holding-pnl.test.ts`:

  ```ts
  import { describe, expect, test } from "bun:test";
  import type { FxRates } from "@pekulo/validators";
  import { computeHoldingPnl } from "./holding-pnl";

  const RATES_EUR: FxRates = {
    base: "EUR",
    date: "2026-05-19",
    rates: { EUR: 1, USD: 1.08, GBP: 0.85, CHF: 0.95 },
  };

  describe("computeHoldingPnl", () => {
    test("AC-3: USD holding gain → positive native + EUR, pnlPct currency-invariant", () => {
      const out = computeHoldingPnl(
        { quantity: 10, avgCost: 90, lastPrice: 100, currency: "USD" },
        RATES_EUR,
        "EUR",
      );
      expect(out.native.pnl).toBe(100); // 10 × (100 − 90)
      expect(Math.abs(out.native.pnlPct - 0.1111111111)).toBeLessThan(1e-6);
      expect(Math.abs(out.eur.pnl - 100 / 1.08)).toBeLessThan(1e-6); // ≈ 92.59
      expect(Math.abs(out.eur.pnlPct - 0.1111111111)).toBeLessThan(1e-6);
    });

    test("AC-3 sign: lastPrice < avgCost → negative PnL in both currencies", () => {
      const out = computeHoldingPnl(
        { quantity: 10, avgCost: 100, lastPrice: 80, currency: "USD" },
        RATES_EUR,
        "EUR",
      );
      expect(out.native.pnl).toBe(-200);
      expect(out.eur.pnl).toBeLessThan(0);
      expect(Math.abs(out.native.pnlPct - -0.2)).toBeLessThan(1e-6);
      expect(Math.abs(out.eur.pnlPct - -0.2)).toBeLessThan(1e-6);
    });

    test("AC-4: rates=null → eur.pnl === native.pnl (identity 1:1)", () => {
      const out = computeHoldingPnl(
        { quantity: 10, avgCost: 90, lastPrice: 100, currency: "USD" },
        null,
        "EUR",
      );
      expect(out.native.pnl).toBe(100);
      expect(out.eur.pnl).toBe(100);
      expect(out.eur.pnlPct).toBe(out.native.pnlPct);
    });

    test("AC-4 zero-cost guard: avgCost=0 → pnlPct=0 (no division by zero)", () => {
      const out = computeHoldingPnl(
        { quantity: 5, avgCost: 0, lastPrice: 12, currency: "EUR" },
        null,
        "EUR",
      );
      expect(out.native.pnl).toBe(60); // 5 × (12 − 0)
      expect(out.native.pnlPct).toBe(0);
      expect(out.eur.pnlPct).toBe(0);
    });

    test("holding in base currency → native and EUR are equal regardless of rates", () => {
      const out = computeHoldingPnl(
        { quantity: 10, avgCost: 5, lastPrice: 7, currency: "EUR" },
        RATES_EUR,
        "EUR",
      );
      expect(out.native.pnl).toBe(20);
      expect(out.eur.pnl).toBe(20);
    });

    test("unknown rate (currency not in rates.rates) → identity per holding", () => {
      const partial: FxRates = {
        base: "EUR",
        date: "2026-05-19",
        rates: { EUR: 1 } as FxRates["rates"], // no USD/GBP/CHF
      };
      const out = computeHoldingPnl(
        { quantity: 10, avgCost: 90, lastPrice: 100, currency: "USD" },
        partial,
        "EUR",
      );
      expect(out.native.pnl).toBe(100);
      expect(out.eur.pnl).toBe(100); // missing rate → identity (best-effort)
    });

    test("zero-quantity holding → all PnL fields = 0", () => {
      const out = computeHoldingPnl(
        { quantity: 0, avgCost: 100, lastPrice: 120, currency: "USD" },
        RATES_EUR,
        "EUR",
      );
      expect(out.native.pnl).toBe(0);
      expect(out.native.pnlPct).toBeCloseTo(0.2); // pct depends on price, not quantity
      expect(out.eur.pnl).toBe(0);
    });
  });
  ```

  Run: `bun --filter=api run test src/common/derive/holding-pnl.test.ts`
  Expected: **RED** — Bun cannot resolve `./holding-pnl` (`Cannot find module 'holding-pnl'`). This proves the test is wired and waiting for T8.
  Commit: `git add apps/api/src/common/derive/holding-pnl.test.ts && git commit -m "test(#22): RED — holding-pnl (signed PnL, zero-cost guard, 1:1 fallback)"`

- [x] **T8 (GREEN, [AC: AC-3, AC-4, AC-6, AC-8])** — Create `apps/api/src/common/derive/holding-pnl.ts` — pure per-holding PnL helper. New file (no brownfield equivalent — the brownfield computed snapshot-level PnL only).

  Create `apps/api/src/common/derive/holding-pnl.ts`:

  ```ts
  // Pure per-holding unrealised PnL — native currency + base (EUR by default).
  //
  // Returns `{ native: { pnl, pnlPct }, eur: { pnl, pnlPct } }`. `pnlPct` is
  // currency-invariant (it is the ratio (lastPrice − avgCost) / avgCost, with
  // a zero-cost guard returning 0 — manual zero-cost lots, e.g. equity grants).
  //
  // No brownfield equivalent — apps/web computed snapshot-level PnL only.
  // Story 3-4 + 7-1 will compose this helper into per-row UI affordances.
  //
  // Pure rules (AC-8):
  //   - No `fetch`, no Prisma, no `Date.now()`, no `@opentelemetry/*` imports.
  //   - All inputs by argument; rates: FxRates | null.

  import type { FxRates, HoldingCurrency, HoldingPnl } from "@pekulo/validators";

  export interface HoldingPnlInput {
    quantity: number;
    avgCost: number;
    lastPrice: number;
    currency: HoldingCurrency;
  }

  function convertToBase(amount: number, from: HoldingCurrency, rates: FxRates): number {
    if (from === rates.base) return amount;
    const r = rates.rates[from];
    if (!r || r <= 0) return amount;
    return amount / r;
  }

  export function computeHoldingPnl(
    input: HoldingPnlInput,
    rates: FxRates | null,
    _base: HoldingCurrency = "EUR",
  ): HoldingPnl {
    const nativePnl = input.quantity * (input.lastPrice - input.avgCost);
    const nativePnlPct = input.avgCost === 0 ? 0 : (input.lastPrice - input.avgCost) / input.avgCost;
    const eurPnl = rates ? convertToBase(nativePnl, input.currency, rates) : nativePnl;
    // pnlPct is currency-invariant — it is a ratio, not an amount.
    return {
      native: { pnl: nativePnl, pnlPct: nativePnlPct },
      eur: { pnl: eurPnl, pnlPct: nativePnlPct },
    };
  }
  ```

  Run: `bun --filter=api run test src/common/derive/holding-pnl.test.ts`
  Expected: `7 pass, 0 fail`, exit 0.
  Commit: `git add apps/api/src/common/derive/holding-pnl.ts && git commit -m "feat(#22): GREEN — holding-pnl (pure, signed, zero-cost guard)"`

- [x] **T9 (code, [AC: AC-7])** — Wire `frankfurterClient` into `apps/api/src/modules/holdings/holdings.module.ts` (env-driven `baseUrl`) and extend `apps/api/src/modules/holdings/holdings.module.test.ts` to assert the new wire-up (client present in deps, `isConfigured` flips with env). The `HoldingService` interface stays untouched (3-3 ships the primitives; 7-1 will wire the snapshot method that consumes them).

  Edit `apps/api/src/modules/holdings/holdings.module.ts` — add the import + constant + factory call. The file becomes:

  ```ts
  // Module factory wiring repository + service + router for the holdings
  // domain. Mirrors ADR-0009's pattern (createXxxModule(deps) → { service, router }).
  //
  // L8 (story 3-1 explicit): the router type is inferred via
  // ReturnType<typeof createHoldingsRouter>; never annotate as `Elysia` or any
  // concrete oRPC implementation type.
  //
  // Story 3-2: extends deps with `env: Pick<Env, …>` so the 4 price-chain
  // client factories + cache can be wired here (env injected, not module-level
  // process.env access — keeps the factory testable).
  //
  // Story 3-3: extends deps with FRANKFURTER_BASE_URL and instantiates the
  // FrankfurterClient (best-effort FX provider). The client is NOT yet
  // injected into HoldingService — 3-3 ships the primitives only; story 7-1
  // composes the snapshot method that consumes them.

  import type { Env } from "../../config/env";
  import type { PrismaService } from "../../database";
  import { createPricesCache } from "./holdings.cache";
  import { createHoldingsRepository } from "./holdings.repository";
  import { createHoldingsRouter } from "./holdings.routes";
  import { createHoldingsService, type HoldingService } from "./holdings.service";
  import { createBoursoramaScraper } from "./services/boursorama-scraper";
  import { createFrankfurterClient, type FrankfurterClient } from "./services/frankfurter-client";
  import { createPricesClient } from "./services/prices-client";
  import { createTwelveDataClient } from "./services/twelve-data-client";
  import { createYahooClient } from "./services/yahoo-client";

  const PRICES_CACHE_TTL_MS = 60_000;
  const PRICES_TIER1_TIMEOUT_MS = 500;
  const TWELVE_DATA_TIMEOUT_MS = 2_000;
  const BOURSORAMA_TIMEOUT_MS = 1_500;
  const YAHOO_TIMEOUT_MS = 2_000;
  const FRANKFURTER_TIMEOUT_MS = 1_500;

  export interface HoldingsModule {
    service: HoldingService;
    router: ReturnType<typeof createHoldingsRouter>;
    /** Story 3-3 — exposed for story 7-1 to compose into the snapshot read. */
    frankfurterClient: FrankfurterClient;
  }

  export interface CreateHoldingsModuleDeps {
    prismaService: PrismaService;
    env: Pick<
      Env,
      "PRICES_SERVICE_URL" | "PRICES_SERVICE_TOKEN" | "TWELVE_DATA_API_KEY" | "FRANKFURTER_BASE_URL"
    >;
  }

  export function createHoldingsModule(deps: CreateHoldingsModuleDeps): HoldingsModule {
    const repository = createHoldingsRepository({ client: deps.prismaService.client });
    const pricesClient = createPricesClient({
      baseUrl: deps.env.PRICES_SERVICE_URL,
      token: deps.env.PRICES_SERVICE_TOKEN,
      timeoutMs: PRICES_TIER1_TIMEOUT_MS,
    });
    const yahooClient = createYahooClient({ timeoutMs: YAHOO_TIMEOUT_MS });
    const boursoramaScraper = createBoursoramaScraper({ timeoutMs: BOURSORAMA_TIMEOUT_MS });
    const twelveDataClient = createTwelveDataClient({
      apiKey: deps.env.TWELVE_DATA_API_KEY,
      timeoutMs: TWELVE_DATA_TIMEOUT_MS,
    });
    const pricesCache = createPricesCache({ ttlMs: PRICES_CACHE_TTL_MS });
    const frankfurterClient = createFrankfurterClient({
      baseUrl: deps.env.FRANKFURTER_BASE_URL,
      timeoutMs: FRANKFURTER_TIMEOUT_MS,
    });
    const service = createHoldingsService({
      repository,
      pricesClient,
      yahooClient,
      boursoramaScraper,
      twelveDataClient,
      pricesCache,
    });
    const router = createHoldingsRouter({ service });
    return { service, router, frankfurterClient };
  }
  ```

  Edit `apps/api/src/modules/holdings/holdings.module.test.ts` — append a new `describe("frankfurterClient wiring", …)` block at the end. (Use the existing test file's prism — read the file with `cat apps/api/src/modules/holdings/holdings.module.test.ts` to find the fake-prismaService shape; do NOT invent a fresh one.) Add:

  ```ts
  // Append to the existing describe-block in apps/api/src/modules/holdings/holdings.module.test.ts.
  // The `makeDeps()` helper is the one already defined at the top of that file.

  describe("frankfurterClient wiring", () => {
    test("isConfigured=false when FRANKFURTER_BASE_URL is undefined", () => {
      const { frankfurterClient } = createHoldingsModule(
        makeDeps({
          PRICES_SERVICE_URL: undefined,
          PRICES_SERVICE_TOKEN: undefined,
          TWELVE_DATA_API_KEY: undefined,
          FRANKFURTER_BASE_URL: undefined,
        }),
      );
      expect(frankfurterClient.isConfigured).toBe(false);
    });

    test("isConfigured=true when FRANKFURTER_BASE_URL is set", () => {
      const { frankfurterClient } = createHoldingsModule(
        makeDeps({
          PRICES_SERVICE_URL: undefined,
          PRICES_SERVICE_TOKEN: undefined,
          TWELVE_DATA_API_KEY: undefined,
          FRANKFURTER_BASE_URL: "https://api.frankfurter.app",
        }),
      );
      expect(frankfurterClient.isConfigured).toBe(true);
    });
  });
  ```

  If `makeDeps()` does not exist in the file, factor the test out at the top of `holdings.module.test.ts` so all existing tests use it — that refactor is in-scope for T9 (zero behavioural change).

  Run: `bun --filter=api run test src/modules/holdings/holdings.module.test.ts`
  Expected: all pre-existing module-test cases stay green plus 2 new tests pass.
  Commit: `git add apps/api/src/modules/holdings/holdings.module.ts apps/api/src/modules/holdings/holdings.module.test.ts && git commit -m "feat(#22): wire FrankfurterClient into holdings.module (env-driven)"`

- [x] **T10 (quality gate + state flip + final commit)** — Run the full repo quality gate (typecheck + bun:test + vitest sanity + oxlint + oxfmt + RLS audit) and flip `state.yaml` to `done`.

  Run, in order:

  ```bash
  bun --filter=api run typecheck
  bun --filter=api run test
  bun --filter=validators run test
  bun --filter=types run typecheck
  bun --filter=api run lint
  bun --filter=api run format:check
  ```

  All must exit 0. If any fails, fix the offending file (root-cause, not `--no-verify`) and re-run.

  Then run:

  ```bash
  grep -rnE "(fetch\\(|prisma|new Date\\(|Date\\.now\\(|import .* from '@opentelemetry)" \
    apps/api/src/common/derive/portfolio-fx.ts \
    apps/api/src/common/derive/holding-pnl.ts
  ```

  Expected: empty output (AC-8 purity).

  Run:

  ```bash
  find apps/api/src/modules/holdings/services apps/api/src/common/derive -name '*.types.ts'
  ```

  Expected: empty output (AC-6 invariant).

  Edit `docs/state.yaml` — flip `sprint.stories["3-3-portfolio-fx"]` from `{status: pending, …}` to `{status: done, depends_on: [3-1-holdings-orpc-port, 3-2-prices-fallback-chain], ticket: "#22", worktree: null, started_at: "<ISO when T1 started>", completed_at: "<ISO now>"}`. Use the same ISO format as 3-2 (`"2026-05-17T23:30:00Z"`).

  Final commit:
  ```bash
  git add docs/state.yaml docs/stories/3-3-portfolio-fx.md
  git commit -m "feat(#22): 3-3-portfolio-fx — FX-adjusted snapshot helpers + per-holding PnL + Frankfurter (Closes #22)"
  git push -u origin feature/22-3-3-portfolio-fx
  ```

  Open the PR:
  ```bash
  gh pr create --base main \
    --title "feat(#22): 3-3-portfolio-fx — FX-adjusted snapshot helpers + per-holding PnL + Frankfurter" \
    --body "Closes #22"
  ```

  Expected: PR created; CI green; aped-review takes over from `review-queued`.

## Dev Notes

### Scope notes (load-bearing)

- **API-only.** Zero UI / Tamagui / Next.js code in this story. Story 3-4 owns the portefeuille screen — the Pre-Implementation Checklist below confirms no UI claim leaks in.
- **No new oRPC procedure.** `holdingsContract` stays at 5 procedures (`create | recordLot | close | list | getDerived`) — locked by 3-1's outcome cell. The FX/PnL primitives are service-internal helpers exposed via the module factory for story 7-1 (dashboard orchestration) to compose into a `snapshot(userId)` method.
- **`PriceProviderError` translation deferred.** 3-2's outcome cell says story 3-3 will translate `PriceProviderError` to a typed oRPC error at the snapshot boundary. Since 3-3 does NOT yet ship the snapshot procedure, the translation is also deferred to 7-1. This story does not touch `holdings.errors.ts`.
- **`fxAvailable` kept as deprecated mirror.** Per Discussion-Point #4 (user lock), `PortfolioSnapshotFx.fxAvailable: boolean` stays alongside the new `fxSource: 'live' | 'fallback'`. `fxAvailable === (fxSource === 'live')` — pure mirror. 3-4 and 7-1 may migrate to `fxSource` and drop `fxAvailable` in a later story without breaking this story's tests.
- **Frankfurter client is stateless.** Per Discussion-Point #2 (user lock), the client carries NO in-process cache (brownfield's 24 h cache is dropped). Caller policy: 7-1 will own the cache when it wires the snapshot.
- **No default `FRANKFURTER_BASE_URL`.** Per Discussion-Point #1 (user lock), the env var is fully opt-in. Unset → `frankfurterClient.isConfigured === false` → snapshot uses `fxSource: 'fallback'`. Matches the 3-2 `PricesClient.isConfigured` precedent.

### File decisions (3-bullet per file)

**NEW**

1. `apps/api/src/modules/holdings/services/frankfurter-client.ts`
   - Responsibility — best-effort FX provider (HTTP to api.frankfurter.app). Factory pattern, typed error class, `isConfigured` short-circuit.
   - Inputs — `{ baseUrl: string | undefined; timeoutMs?: number }`.
   - Outputs — `FrankfurterClient` (`{ isConfigured, getRates(base) → Promise<FxRates> }`) ; `FrankfurterError`.

2. `apps/api/src/modules/holdings/services/frankfurter-client.test.ts`
   - Responsibility — bun:test coverage of `getRates` (happy + network + format + timeout + URL encoding + base stamping + foreign-key whitelist).
   - Inputs — fetch stubs via `globalThis.fetch` swap.
   - Outputs — 8 test cases, AC-5 + AC-7.

3. `apps/api/src/common/derive/portfolio-fx.ts`
   - Responsibility — pure aggregation of `Account[]` + `Holding[]` + `FxRates | null` into `PortfolioSnapshotFx`. KPI math + `byAccount` aggregation + `fxSource` transparency.
   - Inputs — `Account[]`, `Holding[]`, `FxRates | null`, `base?: HoldingCurrency`.
   - Outputs — `PortfolioSnapshotFx` (typed in `@pekulo/validators`).

4. `apps/api/src/common/derive/portfolio-fx.test.ts`
   - Responsibility — bun:test for pure aggregator (KPI math, `fxSource` transitions, `byAccount`, missing-rate per-row fallback, default base).
   - Inputs — hand-rolled `Account` / `Holding` factories at the top of the test.
   - Outputs — 7 test cases, AC-1 + AC-2.

5. `apps/api/src/common/derive/holding-pnl.ts`
   - Responsibility — pure per-holding PnL helper (`{ native, eur }`). Currency-invariant `pnlPct` with zero-cost guard.
   - Inputs — `{ quantity, avgCost, lastPrice, currency }`, `FxRates | null`, `base?: HoldingCurrency`.
   - Outputs — `HoldingPnl` (typed in `@pekulo/validators`).

6. `apps/api/src/common/derive/holding-pnl.test.ts`
   - Responsibility — bun:test for signed PnL, fallback identity, zero-quantity, zero-cost, currency-in-base.
   - Inputs — `FxRates` literals at the top of the test.
   - Outputs — 7 test cases, AC-3 + AC-4.

**MODIFIED**

7. `apps/api/src/config/env.ts`
   - Responsibility (unchanged) — env schema + loader.
   - Diff — add `FRANKFURTER_BASE_URL: optionalString(z.string().url())`.

8. `apps/api/src/config/env.test.ts`
   - Responsibility (unchanged) — env loader contract tests.
   - Diff — 2 new tests (set + malformed) + extend existing minimal/empty-string tests.

9. `apps/api/src/modules/holdings/holdings.module.ts`
   - Responsibility (unchanged) — module factory.
   - Diff — import `createFrankfurterClient`, extend `CreateHoldingsModuleDeps.env`, instantiate the client, expose on the `HoldingsModule` return.

10. `apps/api/src/modules/holdings/holdings.module.test.ts`
    - Responsibility (unchanged) — module wiring tests.
    - Diff — append a `describe("frankfurterClient wiring", …)` block ; factor a `makeDeps()` helper if not already present.

11. `packages/validators/src/holdings.ts`
    - Responsibility (unchanged) — holdings module Zod schemas + inferred TS types.
    - Diff — append `fxSourceSchema`, `fxRatesSchema`, `portfolioSnapshotFxSchema`, `holdingPnlSchema` + their inferred types after the price-chain block. Add `import { accountSchema } from "./accounts"` at the top if not already present.

12. `packages/types/src/index.ts`
    - Responsibility (unchanged) — single typed import surface.
    - Diff — append `export type { FxSource, FxRates, PortfolioSnapshotFx, HoldingPnl } from "@pekulo/validators"; export { FX_SOURCES } from "@pekulo/validators";` after the existing `PRICE_PROVIDERS` re-export.

### Architecture references

- `docs/architecture.md` § Phase 3 Code Structure — module shape (`{module,handler,service,repository,errors,schema}.ts`) + co-located `*.test.ts`; pure helpers in `apps/api/src/common/derive/`.
- `docs/architecture.md` § Pure derive helpers — no I/O in `common/`. Decimal coercion happens upstream in the repository via `decimalToNumber(row, default)`.
- `docs/architecture.md` § Provider clients — `apps/api/src/modules/holdings/services/` ; each owns its typed error class.
- `docs/architecture.md` § Module factory — env injected at construction; no module-level `process.env` access.
- `docs/epics-context/epic-3-context.md` — full cross-cut for epic 3 (FRs in scope, NFRs that bind, ADRs).

### ADRs in scope

- `docs/adr/0009-elysia-orpc-with-zapaction-bridge.md` — domain API on Bun + Elysia + oRPC; web tier uses zapaction bridge. (No new contract in 3-3, but the wiring lives under this ADR.)
- `docs/adr/0011-packages-reorg-pekulo-namespace.md` — types in `@pekulo/types`, validators in `@pekulo/validators`.
- `docs/adr/0012-prisma-7-schema-folder-prefixed-ids.md` — branded IDs `hld_<base62-21>`, `lot_<base62-21>` (used in the test fixtures).
- `docs/adr/0013-prisma-rls-defense-in-depth.md` — `userId` guard at repository layer (not touched in 3-3 — the snapshot is built from already-RLS-filtered reads).
- `docs/adr/0014-prisma-migrations.md` — no migration in 3-3 (pure helpers + new env var only).

### Lessons re-applied (verbatim from `docs/lessons.md` — scope `aped-story` / `aped-dev` / `aped-review` / `aped-arch`)

- **2026-05-09 — Zero `*.types.ts` files inside `apps/api/src/modules/**` ; every TS type lives in `@pekulo/types`, including internal API adapter interfaces (Scope: aped-arch, aped-dev, aped-review — every apps/api module + every package re-exporting domain types).** Applied via AC-6 (extended to `apps/api/src/common/derive/`). All types declared in `packages/validators/src/holdings.ts`, re-exported from `packages/types/src/index.ts`.
- **2026-05-04 — `Number(decimal)` silently truncates above MAX_SAFE_INTEGER — coerce Prisma Decimals via `.toNumber()` (Scope: aped-arch, aped-dev — stories 0-6, 1-2, 2-1, 3-1, 5-1, 7-1, 7-3).** Applied indirectly: 3-3's helpers receive `number` inputs that have already been coerced via `decimalToNumber(row, default)` in the holdings repository (3-1). The helpers do NOT call `Number(decimal)` — they accept the contract that callers feed them coerced primitives.
- **2026-05-04 — Elysia 1.4 `Elysia` type is invariant ; use inference + `AnyElysia` at boundaries (Scope: aped-arch, aped-story, aped-dev — stories 0-3, 0-5, 0-6, 1-1, 2-1, 3-1, 4-1, 5-1, 6-1, 7-1, 7-3, 8-1).** Not applicable directly (3-3 ships no new Elysia surface), but the existing `HoldingsModule.router` type stays inferred via `ReturnType<typeof createHoldingsRouter>` — no annotation drift in T9.
- **2026-05-04 — `@elysiajs/opentelemetry@1.4.0` rootSpan-export hooks do not fire in Elysia 1.4.4 + Bun (Scope: aped-arch, aped-dev — every apps/api story that touches OTel).** Not applicable (3-3 ships no new OTel surface). The existing `resolveQuote` spans are untouched.
- **2026-05-05 — `bun --cwd <relative> run <script>` silently fails — use cd-then-run or `--filter` (Scope: aped-dev, aped-story — story 0-8 + every future cross-workspace proxy script).** Applied — every command in this story uses `bun --filter=api run …` / `bun --filter=validators run …` / `bun --filter=types run …`.
- **2026-05-06 — `vitest run` exits code 1 (not 0) when zero test files match — add `--passWithNoTests` to package scripts (Scope: aped-dev — every package whose test scripts are wired up before the first test file lands).** Not applicable to 3-3 (apps/api uses `bun test`, not vitest). The web-side packages already have the flag from 3-1.
- **2026-05-07 — `bun test` ≠ `vitest run` ; CI workflow must invoke per-package `test` script (Scope: aped-dev, aped-review — every CI workflow that runs vitest tests in this monorepo).** Applied — T1-T10 use `bun --filter=api run test …` which invokes the per-package `test` script (which wraps `bun test`).
- **2026-05-17 — Story-spec UX placement MUST be cross-checked against `docs/ux-preview/src/App.tsx` before implementing ; ux-preview's `SettingsScreen` is the source of truth for `/paramètres`, not story prose (Scope: aped-story, aped-arch, aped-dev — every story that pins a CRUD surface or section placement).** Applied via the Pre-Implementation Checklist (below) — confirms 3-3 ships NO UI surface ; the portefeuille screen belongs to 3-4.

### Existing code at write time — Step-0 verbatim quotes

**`apps/web/src/lib/derive-portfolio-fx.ts` (brownfield SOURCE — port target for T6):**

```ts
import type { Account, Currency, Holding, PortfolioSnapshot } from "./types";
import { convertToBase, type FxRates } from "./fx-types";

export interface PortfolioSnapshotFx extends PortfolioSnapshot {
  fxBase: Currency;
  fxAsOf: string | null; // YYYY-MM-DD or null if rates unavailable
  fxAvailable: boolean;
}

/**
 * Compute portfolio aggregates with FX normalization.
 * - Per-row values (account.cashBalance, holding.lastPrice) keep their native currency
 *   in the returned `accounts` and `holdings` arrays — they are unmodified.
 * - KPIs (capitalTotal, cash, invested, marketValue, pnl) and `byAccount[].total`
 *   are aggregated **after** conversion to `base`.
 * - When `rates` is null, every conversion is identity (1:1) — used as graceful fallback.
 */
export function computeSnapshotFx(
  accounts: Account[],
  holdings: Holding[],
  rates: FxRates | null,
  base: Currency = "EUR",
): PortfolioSnapshotFx {
  const conv = (amount: number, from: Currency): number =>
    rates ? convertToBase(amount, from, rates) : amount;

  const cash = accounts.reduce((acc, a) => acc + conv(a.cashBalance, a.currency), 0);
  const invested = holdings.reduce((acc, h) => acc + conv(h.quantity * h.avgCost, h.currency), 0);
  const marketValue = holdings.reduce(
    (acc, h) => acc + conv(h.quantity * h.lastPrice, h.currency),
    0,
  );
  const capitalTotal = cash + marketValue;
  const pnl = marketValue - invested;

  const byAccount = accounts.map((a) => {
    const cashBase = conv(a.cashBalance, a.currency);
    const holdingValueBase = holdings
      .filter((h) => h.accountId === a.id)
      .reduce((sum, h) => sum + conv(h.quantity * h.lastPrice, h.currency), 0);
    return {
      accountId: a.id,
      label: a.label,
      total: cashBase + holdingValueBase,
    };
  });

  return {
    accounts,
    holdings,
    kpi: { capitalTotal, cash, invested, marketValue, pnl },
    byAccount,
    fxBase: base,
    fxAsOf: rates?.date ?? null,
    fxAvailable: rates !== null,
  };
}
```

Story 3-3 ports this verbatim with two diffs: (a) `fxSource: 'live' | 'fallback'` field added — NFR-19 transparency; (b) `Currency` replaced by `HoldingCurrency` (the closed validator-side union). `fxAvailable` is kept as a deprecated mirror per Discussion-Point #4.

**`apps/web/src/lib/services/fx.ts` (brownfield SOURCE — port target for T4):**

```ts
import "server-only";
import type { Currency } from "@/lib/types";
import type { FxRates } from "@/lib/fx-types";

export type { FxRates } from "@/lib/fx-types";
export { convertToBase } from "@/lib/fx-types";

export class FxError extends Error {
  code: "network" | "format" | "unsupported";

  constructor(code: FxError["code"], message: string) {
    super(message);
    this.name = "FxError";
    this.code = code;
  }
}

const CACHE_TTL_MS = 24 * 60 * 60_000; // 24h
const cache = new Map<Currency, { at: number; rates: FxRates }>();

const SYMBOLS: Currency[] = ["EUR", "USD", "GBP", "CHF"];

export async function getRates(base: Currency = "EUR"): Promise<FxRates> {
  const cached = cache.get(base);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.rates;
  }

  const others = SYMBOLS.filter((c) => c !== base);
  const url = `https://api.frankfurter.app/latest?base=${encodeURIComponent(base)}&symbols=${others.join(",")}`;

  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch (err) {
    throw new FxError(
      "network",
      `Frankfurter unreachable: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!res.ok) {
    throw new FxError("network", `Frankfurter HTTP ${res.status}`);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new FxError("format", "Frankfurter: réponse non-JSON.");
  }

  const obj = json as { date?: string; rates?: Record<string, number> };
  if (!obj.rates || typeof obj.rates !== "object") {
    throw new FxError("format", "Frankfurter: champ rates absent.");
  }

  const rates: Partial<Record<Currency, number>> = { [base]: 1 };
  for (const c of others) {
    const v = Number(obj.rates[c]);
    if (Number.isFinite(v) && v > 0) rates[c] = v;
  }

  const fx: FxRates = {
    base,
    date: typeof obj.date === "string" ? obj.date : new Date().toISOString().slice(0, 10),
    rates,
  };
  cache.set(base, { at: Date.now(), rates: fx });
  return fx;
}
```

Story 3-3 ports this with five diffs: (a) factory pattern, no module-level `cache` Map; (b) `AbortSignal.timeout(timeoutMs)` injected (brownfield had no timeout — silently violated NFR-19); (c) `cache: "no-store"` dropped (Bun's `BunFetchRequestInit` rejects it — lesson from 3-2); (d) `FxError` renamed to `FrankfurterError` to mirror per-tier-client naming (`PricesServiceError`, `YahooError`, …); (e) `date` field is REQUIRED in the wire payload (brownfield silently defaulted to `new Date().toISOString().slice(0, 10)` — the new client maps a missing `date` to `FrankfurterError("format")`).

**`apps/web/src/lib/fx-types.ts` (brownfield SOURCE — reference for the `convertToBase` helper logic ; not ported directly because the new module uses its own local `convertToBase`):**

```ts
import type { Currency } from "./types";

export interface FxRates {
  base: Currency;
  date: string; // YYYY-MM-DD
  // rates are quoted as 1 unit of `base` = X units of foreign.
  // Always includes base itself with value 1.
  rates: Partial<Record<Currency, number>>;
}

/**
 * Convert `amount` from `from` currency into the base of `rates`.
 * If from === rates.base → identity.
 * Otherwise: amount in foreign / (1 base = X foreign) = amount in base.
 * Pure function — safe to import from both server and client.
 */
export function convertToBase(amount: number, from: Currency, rates: FxRates): number {
  if (from === rates.base) return amount;
  const r = rates.rates[from];
  if (!r || r <= 0) return amount; // unknown rate → identity (best-effort)
  return amount / r;
}
```

The same `convertToBase` logic is inlined into both `apps/api/src/common/derive/portfolio-fx.ts` and `apps/api/src/common/derive/holding-pnl.ts` as a private helper. Not exported from either — the two callers each get their own private copy (the brownfield's shared export tied the helper to the `fx-types` module, which would force a cross-folder dependency that breaks the `common/derive/*` purity contract).

**`apps/api/src/config/env.ts` (current — modified by T1):**

```ts
import { z } from "zod";

// Treat `KEY=` in .env as absent — brownfield reads process.env directly and
// `""` is falsy. Without this, optional URL / non-empty schemas reject the
// shell-truthy-but-content-empty pattern with a confusing validation error.
const optionalString = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(3001),
  HOST: z.string().min(1).default("127.0.0.1"),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().max(60_000).default(10_000),
  DATABASE_URL: z.string().url(),
  SUPABASE_JWT_SECRET: z
    .string()
    .min(32, "SUPABASE_JWT_SECRET must be ≥ 32 chars (read it from `bunx supabase status`)"),
  SUPABASE_URL: z.string().url(),
  PRICES_SERVICE_URL: optionalString(z.string().url()),
  PRICES_SERVICE_TOKEN: optionalString(z.string().min(1)),
  TWELVE_DATA_API_KEY: optionalString(z.string().min(1)),
  OTEL_SERVICE_NAME: z.string().min(1).default("pekulo-api"),
  OTEL_EXPORTER_OTLP_ENDPOINT: optionalString(z.string().url()),
  OTEL_LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("error"),
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

T1 adds a single field `FRANKFURTER_BASE_URL: optionalString(z.string().url())` after `TWELVE_DATA_API_KEY` and before the OTel block, with a 3-line comment matching the price-chain pattern.

**`apps/api/src/modules/holdings/holdings.module.ts` (current — modified by T9):**

```ts
// Module factory wiring repository + service + router for the holdings
// domain. Mirrors ADR-0009's pattern (createXxxModule(deps) → { service, router }).
//
// L8 (story 3-1 explicit): the router type is inferred via
// ReturnType<typeof createHoldingsRouter>; never annotate as `Elysia` or any
// concrete oRPC implementation type.
//
// Story 3-2: extends deps with `env: Pick<Env, …>` so the 4 price-chain
// client factories + cache can be wired here (env injected, not module-level
// process.env access — keeps the factory testable).

import type { Env } from "../../config/env";
import type { PrismaService } from "../../database";
import { createPricesCache } from "./holdings.cache";
import { createHoldingsRepository } from "./holdings.repository";
import { createHoldingsRouter } from "./holdings.routes";
import { createHoldingsService, type HoldingService } from "./holdings.service";
import { createBoursoramaScraper } from "./services/boursorama-scraper";
import { createPricesClient } from "./services/prices-client";
import { createTwelveDataClient } from "./services/twelve-data-client";
import { createYahooClient } from "./services/yahoo-client";

const PRICES_CACHE_TTL_MS = 60_000;
const PRICES_TIER1_TIMEOUT_MS = 500;
const TWELVE_DATA_TIMEOUT_MS = 2_000;
const BOURSORAMA_TIMEOUT_MS = 1_500;
const YAHOO_TIMEOUT_MS = 2_000;

export interface HoldingsModule {
  service: HoldingService;
  router: ReturnType<typeof createHoldingsRouter>;
}

export interface CreateHoldingsModuleDeps {
  prismaService: PrismaService;
  env: Pick<Env, "PRICES_SERVICE_URL" | "PRICES_SERVICE_TOKEN" | "TWELVE_DATA_API_KEY">;
}

export function createHoldingsModule(deps: CreateHoldingsModuleDeps): HoldingsModule {
  const repository = createHoldingsRepository({ client: deps.prismaService.client });
  const pricesClient = createPricesClient({
    baseUrl: deps.env.PRICES_SERVICE_URL,
    token: deps.env.PRICES_SERVICE_TOKEN,
    timeoutMs: PRICES_TIER1_TIMEOUT_MS,
  });
  const yahooClient = createYahooClient({ timeoutMs: YAHOO_TIMEOUT_MS });
  const boursoramaScraper = createBoursoramaScraper({ timeoutMs: BOURSORAMA_TIMEOUT_MS });
  const twelveDataClient = createTwelveDataClient({
    apiKey: deps.env.TWELVE_DATA_API_KEY,
    timeoutMs: TWELVE_DATA_TIMEOUT_MS,
  });
  const pricesCache = createPricesCache({ ttlMs: PRICES_CACHE_TTL_MS });
  const service = createHoldingsService({
    repository,
    pricesClient,
    yahooClient,
    boursoramaScraper,
    twelveDataClient,
    pricesCache,
  });
  const router = createHoldingsRouter({ service });
  return { service, router };
}
```

T9's diff is precise: add the import, the `FRANKFURTER_TIMEOUT_MS` constant, the `frankfurterClient` field on `HoldingsModule`, the `"FRANKFURTER_BASE_URL"` key in `CreateHoldingsModuleDeps.env`, the `createFrankfurterClient({…})` call, and the `frankfurterClient` field on the returned object.

**`packages/validators/src/holdings.ts` — last 60 lines (current — modified by T2 ; new block appends after these):**

```ts
// ─── Price chain (story 3-2) ─────────────────────────────────────────────
// The 4-tier orchestrator in apps/api/src/modules/holdings/holdings.service.ts
// (#resolveQuote) consumes `priceQuoteInputSchema` and returns
// `priceQuoteSchema`. NO oRPC contract surface — these schemas are
// service-internal DTOs, but they live here because @pekulo/types re-exports
// the inferred types (L1 invariant: zero `*.types.ts` under apps/api/src/modules).

export const PRICE_PROVIDERS = ["prices-service", "yahoo", "boursorama", "twelve-data"] as const;
export const priceProviderSchema = z.enum(PRICE_PROVIDERS);
export type PriceProvider = z.infer<typeof priceProviderSchema>;

export const priceProviderAttemptSchema = z.object({
  provider: z.string().min(1),
  reason: z.string().min(1),
});
export type PriceProviderAttempt = z.infer<typeof priceProviderAttemptSchema>;

export const priceQuoteSchema = z.object({
  symbol: z.string().min(1),
  price: z.number().positive(),
  currency: z.string(),
  marketTime: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "marketTime must be YYYY-MM-DD"),
  provider: priceProviderSchema,
});
export type PriceQuote = z.infer<typeof priceQuoteSchema>;

export const priceQuoteInputSchema = z.object({
  ticker: z.string().nullable(),
  kind: z.enum(HOLDING_KINDS_MIRROR),
  currency: z.enum(HOLDING_CURRENCIES),
});
export type PriceQuoteInput = z.infer<typeof priceQuoteInputSchema>;
```

T2 appends a new section "─── FX + portfolio snapshot (story 3-3) ───" after the price-chain block, exporting `FX_SOURCES`, `fxSourceSchema` / `FxSource`, `fxRatesSchema` / `FxRates`, `portfolioSnapshotFxSchema` / `PortfolioSnapshotFx`, `holdingPnlSchema` / `HoldingPnl`. Also requires `import { accountSchema } from "./accounts";` at the top of the file if not already present.

**`packages/types/src/index.ts` — price-chain block (current — modified by T2):**

```ts
/** Price chain (story 3-2) — service-internal DTOs, no oRPC surface. */
export type {
  PriceQuote,
  PriceQuoteInput,
  PriceProvider,
  PriceProviderAttempt,
} from "@pekulo/validators";
export { PRICE_PROVIDERS } from "@pekulo/validators";
```

T2 appends right after this block:

```ts
/** FX + portfolio snapshot (story 3-3) — pure helper outputs, no oRPC surface. */
export type {
  FxSource,
  FxRates,
  PortfolioSnapshotFx,
  HoldingPnl,
} from "@pekulo/validators";
export { FX_SOURCES } from "@pekulo/validators";
```

### Pre-Implementation Checklist (UX cross-check — lesson 2026-05-17)

- ☐ **No UI claim in this story.** Every task touches `apps/api/**`, `packages/validators/**`, or `packages/types/**`. Zero files under `apps/web/**`, `packages/ui/**`, `docs/ux-preview/**`. Story 3-4 owns the portefeuille screen.
- ☐ **No oRPC procedure change.** `holdingsContract` stays at 5 procedures (`create | recordLot | close | list | getDerived`). `holdings.routes.ts` is NOT modified.
- ☐ **No database migration.** `prisma/schema/*` is untouched. The 3-1 migration already shipped the `holding_kind` + prefixed-ID changes; 3-3 adds only env + pure code.
- ☐ **No RLS policy change.** Existing RLS policy counts (`holdings: 4`, `holding_lots: 4`) stay constant. The snapshot reads (deferred to 7-1) will consume `holdings.list(userId, …)` which already enforces `userId` guard via the repository.
- ☐ **Lessons re-applied** — see the Lessons section above. L1 (no `*.types.ts`) is enforced via AC-6 ; `Number(decimal)` via the upstream `decimalToNumber` contract (no direct coercion in 3-3) ; `bun --cwd` avoidance via `--filter` in every command.

### Brownfield invariants to preserve

- `convertToBase` semantics — `from === rates.base → identity` ; unknown foreign rate → identity (best-effort, not throw). Verified by the AC-2 partial-rate test and the "unknown rate" tests in T7.
- `byAccount[].total` is in the snapshot's base currency (not the account's native currency). The brownfield comments this explicitly ; the port keeps the same semantic and tests it via the EUR-account + USD-account mixed fixture in T5.
- Frankfurter `latest` endpoint behaviour — Frankfurter quotes `1 base = X foreign`. The client preserves this: `rates[foreign] = X` and identity stays `rates[base] = 1` (stamped on read).
- `fxAvailable === (fxSource === 'live')` — load-bearing equality the deprecated mirror must satisfy. Asserted indirectly via the AC-1 / AC-2 tests.

## File List

_(Filled by the dev agent during implementation. Skeleton:)_

- Created: `apps/api/src/modules/holdings/services/frankfurter-client.ts`
- Created: `apps/api/src/modules/holdings/services/frankfurter-client.test.ts`
- Created: `apps/api/src/common/derive/portfolio-fx.ts`
- Created: `apps/api/src/common/derive/portfolio-fx.test.ts`
- Created: `apps/api/src/common/derive/holding-pnl.ts`
- Created: `apps/api/src/common/derive/holding-pnl.test.ts`
- Modified: `apps/api/src/config/env.ts`
- Modified: `apps/api/src/config/env.test.ts`
- Modified: `apps/api/src/modules/holdings/holdings.module.ts`
- Modified: `apps/api/src/modules/holdings/holdings.module.test.ts`
- Modified: `packages/validators/src/holdings.ts`
- Modified: `packages/types/src/index.ts`
- Modified: `docs/state.yaml`

## Dev Agent Record

### Summary

Shipped per spec: env adds `FRANKFURTER_BASE_URL` (optional URL); validators + types export `FxSource` / `FxRates` / `PortfolioSnapshotFx` / `HoldingPnl`; new pure helpers `apps/api/src/common/derive/portfolio-fx.ts` (FX-aware snapshot aggregator with `fxSource` transparency per NFR-19) and `apps/api/src/common/derive/holding-pnl.ts` (per-holding PnL with currency-invariant `pnlPct` + zero-cost guard); new tier-unique provider client `apps/api/src/modules/holdings/services/frankfurter-client.ts` (stateless factory, `AbortSignal.timeout`, `HOLDING_CURRENCIES` whitelist, typed `FrankfurterError`); `FrankfurterClient` wired into `holdings.module` and exposed on the `HoldingsModule` return (for story 7-1 to compose into the snapshot read).

Suite: 8 frankfurter-client + 7 portfolio-fx + 7 holding-pnl + 6 env (4 pre-existing + 2 new) + 3 holdings.module (1 pre-existing + 2 new) — all green, full repo suite at 329/329 pass.

### Files changed

- Created: `apps/api/src/modules/holdings/services/frankfurter-client.ts`
- Created: `apps/api/src/modules/holdings/services/frankfurter-client.test.ts`
- Created: `apps/api/src/common/derive/portfolio-fx.ts`
- Created: `apps/api/src/common/derive/portfolio-fx.test.ts`
- Created: `apps/api/src/common/derive/holding-pnl.ts`
- Created: `apps/api/src/common/derive/holding-pnl.test.ts`
- Modified: `apps/api/src/config/env.ts`
- Modified: `apps/api/src/config/env.test.ts`
- Modified: `apps/api/src/modules/holdings/holdings.module.ts`
- Modified: `apps/api/src/modules/holdings/holdings.module.test.ts`
- Modified: `packages/validators/src/holdings.ts`
- Modified: `packages/types/src/index.ts`
- Modified: `docs/state.yaml`

### Deviations

- **Bun workspace filter** — story prose used `bun --filter=api …` but the workspace package name is `@pekulo/api`; substring match failed in this monorepo. All commands ran with `bun --filter='@pekulo/api' …` (and `@pekulo/validators` / `@pekulo/types`). No behavioural impact; surface to the spec sweep when story 3-4 is drafted.
- **`RequestInfo` type** — the spec's `frankfurter-client.test.ts` referenced `RequestInfo | URL` in the fetch-stub signature, but `apps/api/tsconfig.json` declares `types: ["bun"]` (no DOM lib). Replaced with `Parameters<typeof fetch>[0]` aliased as `FetchInput`. Tests + types both green.
- **No oxlint / oxfmt CLI on `PATH`** — the lefthook pre-commit hooks invoke them directly, so each commit ran the gates in-band; root-level `npm run lint` / `npm run format:check` were used for the final sanity sweep instead of the bare commands listed in T10.

### Test output

```
$ bun --filter='@pekulo/api' run test
 329 pass
 0 fail
 859 expect() calls
Ran 329 tests across 41 files. [1088 ms]
Exited with code 0
```

```
$ bun --filter='@pekulo/api' run typecheck    →  exit 0
$ bun --filter='@pekulo/types' run typecheck  →  exit 0
$ bun --filter='@pekulo/validators' run typecheck → exit 0
```

AC-6 invariant probes:

```
$ find apps/api/src/modules/holdings/services apps/api/src/common/derive -name '*.types.ts'
(empty)

$ grep -rnE "(fetch\(|prisma|new Date\(|Date\.now\(|import .* from '@opentelemetry)" \
    apps/api/src/common/derive/portfolio-fx.ts \
    apps/api/src/common/derive/holding-pnl.ts
(only the two `// No fetch, no Prisma, no Date.now(), no @opentelemetry/*` purity contract comments)
```

## Review Record

_(Filled by aped-review.)_

### Findings

### Verification

### Ticket sync
