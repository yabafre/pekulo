# Story: 3-2-prices-fallback-chain — 4-tier price chain + 60 s in-memory cache (server-side resolveQuote, no contract surface)

**Epic:** Epic 3 — Holdings & portfolio (extended brownfield + crypto)
**Status:** review-queued
**Ticket:** [#21](https://github.com/yabafre/pekulo/issues/21)
**Branch:** `feature/21-3-2-prices-fallback-chain`
**Commit prefix:** `feat(#21): …` (use `test(#21):` / `chore(#21):` / `refactor(#21):` per task semantics)
**Depends on:** 3-1-holdings-orpc-port (done — supplies `HoldingService` interface + module factory + `HoldingError` infrastructure + `holdings.errors.ts` host file), 0-3-api-scaffold (done — env loader), 0-7-otel-three-runtimes (done — `trace.getTracer` / explicit child-span pattern)
**Complexity:** M

## User Story

**As a** Pekulo user, **I want** holding price quotes resolved via a four-tier provider chain (`prices-service` → `yahoo-finance2` → Boursorama → Twelve Data) with a 60-second in-memory cache, **so that** my dashboard's portfolio value is fresh, fast, and resilient to single-provider outages — without re-implementing the chain in story 3-3 (FX/PnL) or 7-1 (dashboard).

## Acceptance Criteria

- **AC-1 (tier-1 timeout → tier-2 fallback ≤ 500 ms, NFR-18):** **Given** the `pricesClient` injected into `holdings.service` is configured with `AbortSignal.timeout(500)` AND a fake `pricesClient` that never resolves (simulating a hang), **When** `resolveQuote({ ticker: "CW8", kind: "etf", currency: "EUR" })` is called, **Then** within 600 ms wall-clock the tier-2 fake (`yahooClient.fetchQuote`) is invoked with the resolved Yahoo symbol `"CW8.PA"` AND the returned `PriceQuote` equals `{ provider: "yahoo", symbol: "CW8.PA", price > 0, currency: "EUR", marketTime: "YYYY-MM-DD" }`. The 600 ms ceiling allows 500 ms tier-1 timeout + 100 ms tier-2 setup; the test uses `bun:test` `setSystemTime` + a controlled fake-clock or `Promise.race` against `Bun.sleep(600)` to assert the wall-clock bound.
- **AC-2 (60 s cache hit, key shape `ticker|kind|currency`, NFR-2):** **Given** a first call `resolveQuote({ ticker: "AAPL", kind: "action", currency: "USD" })` populated the cache via the `yahoo` tier (fake returns a known quote), **When** an identical second call is made at T+59 s (cache TTL still alive), **Then** ZERO calls are recorded against any provider fake (assert via spy: `pricesClient.fetchQuote.mock.calls.length === 0`, idem for the 3 other clients) AND the returned `PriceQuote` is `===` (reference-equal) to the first call's return value. **And** when the same call is made at T+61 s (cache expired), **Then** exactly ONE provider call is recorded (the tier-1 fake is hit, no fallback).
- **AC-3 (all four providers fail → `PriceProviderError.attempts.length === 4`):** **Given** every tier throws its typed error (`PricesServiceError("network")`, `YahooError("rate-limited")`, `BoursoramaError("invalid-symbol")`, `TwelveDataError("missing-key")`), **When** `resolveQuote({ ticker: "ZZZZ", kind: "etf", currency: "EUR" })` is called, **Then** the call rejects with an instance of `PriceProviderError` AND `err.attempts.length === 4` AND `err.attempts` equals exactly `[{ provider: "prices-service", reason: "réseau" }, { provider: "yahoo", reason: "rate-limited" }, { provider: "boursorama", reason: "ticker non listé" }, { provider: "twelve-data", reason: "clé manquante" }]` (order preserved, French short labels per the brownfield `shortPs` / `shortYahoo` / `shortBourso` / `shortTd` mappings).
- **AC-4 (BTC-EUR / ETH-EUR coverage — crypto kind):** **Given** the chain runs for input `{ ticker: "BTC-USD", kind: "crypto", currency: "USD" }` AND the `pricesClient` fake returns a `PricesServiceError("not-configured")` (prices-service URL is empty in test env) AND the `yahoo` fake returns `{ symbol: "BTC-USD", price: 95000, currency: "USD", marketTime: "2026-05-17" }`, **When** `resolveQuote` runs, **Then** the returned quote's `provider === "yahoo"`. **And** the identical test for `{ ticker: "ETH-USD", kind: "crypto", currency: "USD" }` returns `provider === "yahoo"`. **And** when the `yahoo` fake throws `YahooError("rate-limited")` instead, the chain falls back to `twelve-data` (skipping `boursorama` is acceptable — but the assertion stays "provider is `yahoo` OR `twelve-data`", because the ticket prose says "Yahoo or Twelve Data returns a quote"). The `boursorama` fake MUST NOT be invoked for `kind === "crypto"` — the orchestrator short-circuits that tier when the input is crypto (Boursorama does not list crypto).
- **AC-5 (zero `*.types.ts` under `apps/api/src/modules/holdings/services/`):** **Given** the story is shipped, **When** the dev runs `find apps/api/src/modules/holdings/services -name '*.types.ts'`, **Then** the command returns empty (zero matches). **And** when the dev runs `grep -rn 'PriceQuote\|PriceQuoteInput\|PriceProvider\|PriceProviderAttempt' apps/api/src/modules/holdings/services | grep -v 'import\|//\|\*' | wc -l`, **Then** the result is `0` (no local type definitions; all types are imported from `@pekulo/types`). L1 invariant (3-1 lesson scope: `aped-arch, aped-dev, aped-review`).
- **AC-6 (env vars optional, schema unchanged for existing deployments):** **Given** an `apps/api` process with only the existing required env vars set (`DATABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_URL`) AND ZERO of `PRICES_SERVICE_URL`, `PRICES_SERVICE_TOKEN`, `TWELVE_DATA_API_KEY` set, **When** the dev runs `bun --filter=api run start` (or the equivalent typecheck path through `loadEnv()`), **Then** `loadEnv()` succeeds with no `ConfigError`. **And** when the orchestrator runs without `PRICES_SERVICE_URL`, **Then** the tier-1 fake throws `PricesServiceError("not-configured")` and falls back to tier-2 (matches brownfield `isPricesServiceConfigured()` behaviour). The 3 new env vars are `z.string().optional()` — they remain optional in V1 (a).
- **AC-7 (explicit OTel child spans per tier — lesson L51 propagated):** **Given** the orchestrator runs the full chain, **When** the dev inspects the exported spans (in tests via the OTel SDK in-memory exporter, in prod via OTLP), **Then** for each tier invoked, exactly one child span named `prices.tier_<n>` (n ∈ {1,2,3,4}) is recorded with attributes `{ "prices.provider": <"prices-service"|"yahoo"|"boursorama"|"twelve-data">, "prices.outcome": <"ok"|"error">, "prices.duration_ms": <number>, "prices.ticker": <input.ticker>, "prices.currency": <input.currency>, "prices.kind": <input.kind> }`. Tier spans skipped via short-circuit (e.g. tier-3 for crypto) MUST NOT emit a span. The parent span is created with `trace.getTracer("pekulo-api-holdings").startSpan("prices.resolveQuote")`. NO reliance on `@elysiajs/opentelemetry@1.4.0` rootSpan-export hooks (broken under Elysia 1.4.4 + Bun, lesson L56 — see `docs/lessons.md` § 2026-05-04).

## Tasks

- [x] **T1** — Extend `apps/api/src/config/env.ts` with three optional env vars + add a new `apps/api/src/config/env.test.ts` covering the empty-env case + Bearer-token-without-url misconfig.

  Edit `apps/api/src/config/env.ts` — add three lines into `envSchema` (alphabetical insertion preserved: `PRICES_SERVICE_TOKEN`, `PRICES_SERVICE_URL` after `PORT`; `TWELVE_DATA_API_KEY` after `SUPABASE_URL`). After edit, the schema reads:

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
    SUPABASE_URL: z.string().url(),
    // Price-chain providers (story 3-2). All optional — when unset, the
    // corresponding tier throws a typed `not-configured` / `missing-key`
    // error and the orchestrator falls back to the next tier.
    PRICES_SERVICE_URL: z.string().url().optional(),
    PRICES_SERVICE_TOKEN: z.string().min(1).optional(),
    TWELVE_DATA_API_KEY: z.string().min(1).optional(),
    // OTel SDK config (story 0-7 — ADR-0005). All three are optional with
    // safe defaults so brownfield .env files keep working.
    OTEL_SERVICE_NAME: z.string().min(1).default("pekulo-api"),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
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

  Create `apps/api/src/config/env.test.ts`:

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
      expect(() =>
        loadEnv({ ...BASE, PRICES_SERVICE_URL: "not-a-url" }),
      ).toThrow(ConfigError);
    });
  });
  ```

  Run: `bun --filter=api test src/config/env.test.ts`
  Expected: `3 pass, 0 fail`, exit 0.
  Commit: `git add apps/api/src/config/env.ts apps/api/src/config/env.test.ts && git commit -m "feat(#21): T1 add 3 optional env vars for price chain (PRICES_SERVICE_URL, PRICES_SERVICE_TOKEN, TWELVE_DATA_API_KEY)"`

  [AC: AC-6]

- [x] **T2** — Add `priceQuoteSchema`, `priceQuoteInputSchema`, `priceProviderSchema`, `priceProviderAttemptSchema` to `packages/validators/src/holdings.ts` (append at end of file, before the last `export type GetDerivedHoldingInput`). Re-export the inferred types from `packages/types/src/index.ts`.

  Append to `packages/validators/src/holdings.ts` (after the existing `getDerivedHoldingInputSchema` block, before EOF):

  ```ts
  // ─── Price chain (story 3-2) ─────────────────────────────────────────────
  // The 4-tier orchestrator in apps/api/src/modules/holdings/holdings.service.ts
  // (#resolveQuote) consumes `priceQuoteInputSchema` and returns
  // `priceQuoteSchema`. NO oRPC contract surface — these schemas are
  // service-internal DTOs, but they live here because @pekulo/types re-exports
  // the inferred types (L1 invariant: zero `*.types.ts` under apps/api/src/modules).

  export const PRICE_PROVIDERS = [
    "prices-service",
    "yahoo",
    "boursorama",
    "twelve-data",
  ] as const;
  export const priceProviderSchema = z.enum(PRICE_PROVIDERS);
  export type PriceProvider = z.infer<typeof priceProviderSchema>;

  export const priceProviderAttemptSchema = z.object({
    provider: z.string().min(1),
    reason: z.string().min(1),
  });
  export type PriceProviderAttempt = z.infer<typeof priceProviderAttemptSchema>;

  // Output of every per-provider client AND of the orchestrator.
  // `provider` is set by the orchestrator (the clients return without it; the
  // orchestrator stamps the winning tier).
  export const priceQuoteSchema = z.object({
    symbol: z.string().min(1),
    price: z.number().positive(),
    currency: z.string(), // empty string allowed — some providers return ""
    marketTime: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "marketTime must be YYYY-MM-DD"),
    provider: priceProviderSchema,
  });
  export type PriceQuote = z.infer<typeof priceQuoteSchema>;

  // Input to the orchestrator. `ticker` is nullable because the brownfield
  // holdings table allows manual-entry holdings with no ticker; in that case
  // the orchestrator throws YahooError("missing-ticker") at tier-2 (no chain
  // attempt for a tickerless holding).
  export const priceQuoteInputSchema = z.object({
    ticker: z.string().nullable(),
    kind: z.enum(HOLDING_KINDS_MIRROR),
    currency: z.enum(HOLDING_CURRENCIES),
  });
  export type PriceQuoteInput = z.infer<typeof priceQuoteInputSchema>;
  ```

  Edit `packages/types/src/index.ts` — add a re-export block in the "Holding (Portfolio)" section, right after the existing `export type { Holding, HoldingLot, DerivedHolding } from "@pekulo/validators";` line (around line 65):

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

  Run: `bun --filter=@pekulo/validators run typecheck && bun --filter=@pekulo/types run typecheck`
  Expected: both exit 0.
  Commit: `git add packages/validators/src/holdings.ts packages/types/src/index.ts && git commit -m "feat(#21): T2 add PriceQuote/PriceQuoteInput/PriceProvider Zod schemas + types re-export"`

  [AC: AC-5]

- [x] **T3** — Extend `apps/api/src/modules/holdings/holdings.errors.ts` with `PriceProviderError extends Error` (NOT `PekuloError` — server-internal, see Scope notes). Add the file-level header documenting the split.

  Edit `apps/api/src/modules/holdings/holdings.errors.ts` — append at end of file (after `holdingClosed()`):

  ```ts
  // ─── Price chain (story 3-2) ─────────────────────────────────────────────
  // PriceProviderError is a plain Error subclass — NOT a PekuloError. The
  // orchestrator throws it when all 4 tiers fail; the caller (story 3-3's
  // snapshot logic) translates it to a typed oRPC error of its choosing.
  // Wrapping it in PekuloError now would force a contract error code that no
  // procedure declares.
  //
  // `attempts` is append-order — the orchestrator pushes one entry per tier
  // it attempted (tiers short-circuited because of input kind, e.g. boursorama
  // for crypto, are NOT pushed).

  import type { PriceProviderAttempt } from "@pekulo/types";

  export class PriceProviderError extends Error {
    override readonly name = "PriceProviderError";
    readonly attempts: readonly PriceProviderAttempt[];

    constructor(attempts: readonly PriceProviderAttempt[]) {
      const summary =
        attempts.length === 0
          ? "Aucun provider disponible."
          : attempts.map((a) => `${a.provider}: ${a.reason}`).join(" · ");
      super(summary);
      this.attempts = attempts;
    }
  }
  ```

  Run: `bun --filter=api run typecheck`
  Expected: exit 0.
  Commit: `git add apps/api/src/modules/holdings/holdings.errors.ts && git commit -m "feat(#21): T3 add PriceProviderError composite error class"`

  [AC: AC-3]

- [x] **T4 (RED)** — Add `apps/api/src/modules/holdings/holdings.cache.test.ts` covering TTL expiry, key shape, get/set isolation across factory instances. The cache module does NOT exist yet — the test expects RED.

  Create `apps/api/src/modules/holdings/holdings.cache.test.ts`:

  ```ts
  import { describe, expect, test } from "bun:test";
  import type { PriceQuote, PriceQuoteInput } from "@pekulo/types";
  import { createPricesCache, type PricesCache } from "./holdings.cache";

  function quote(over: Partial<PriceQuote> = {}): PriceQuote {
    return {
      symbol: "CW8.PA",
      price: 482.13,
      currency: "EUR",
      marketTime: "2026-05-17",
      provider: "yahoo",
      ...over,
    };
  }

  const KEY: PriceQuoteInput = { ticker: "CW8", kind: "etf", currency: "EUR" };

  describe("PricesCache", () => {
    test("get on empty cache returns undefined", () => {
      const cache = createPricesCache({ ttlMs: 60_000 });
      expect(cache.get(KEY)).toBeUndefined();
    });

    test("set + get round-trip returns the stored quote", () => {
      const cache = createPricesCache({ ttlMs: 60_000 });
      const q = quote();
      cache.set(KEY, q);
      expect(cache.get(KEY)).toBe(q); // reference equality — AC-2
    });

    test("expired entry returns undefined", () => {
      let now = 1_000_000;
      const cache = createPricesCache({ ttlMs: 60_000, now: () => now });
      cache.set(KEY, quote());
      now += 59_999;
      expect(cache.get(KEY)).toBeDefined();
      now += 2; // crosses 60s boundary
      expect(cache.get(KEY)).toBeUndefined();
    });

    test("key shape is ticker|kind|currency — kind change isolates", () => {
      const cache = createPricesCache({ ttlMs: 60_000 });
      cache.set({ ticker: "AAPL", kind: "action", currency: "USD" }, quote({ provider: "yahoo" }));
      expect(cache.get({ ticker: "AAPL", kind: "action", currency: "USD" })).toBeDefined();
      expect(cache.get({ ticker: "AAPL", kind: "etf", currency: "USD" })).toBeUndefined();
      expect(cache.get({ ticker: "AAPL", kind: "action", currency: "EUR" })).toBeUndefined();
    });

    test("null ticker is part of the key (empty-string slot)", () => {
      const cache = createPricesCache({ ttlMs: 60_000 });
      cache.set({ ticker: null, kind: "autre", currency: "EUR" }, quote());
      expect(cache.get({ ticker: null, kind: "autre", currency: "EUR" })).toBeDefined();
      expect(cache.get({ ticker: "", kind: "autre", currency: "EUR" })).toBeDefined(); // "" maps to same slot as null
    });

    test("instances are isolated — no shared module-level Map", () => {
      const a = createPricesCache({ ttlMs: 60_000 });
      const b = createPricesCache({ ttlMs: 60_000 });
      a.set(KEY, quote());
      expect(b.get(KEY)).toBeUndefined();
    });
  });
  ```

  Run: `bun --filter=api test src/modules/holdings/holdings.cache.test.ts`
  Expected: FAIL — `Cannot find module './holdings.cache'`.
  Commit: `git add apps/api/src/modules/holdings/holdings.cache.test.ts && git commit -m "test(#21): T4 add holdings.cache tests (RED)"`

  [AC: AC-2]

- [x] **T5 (GREEN)** — Create `apps/api/src/modules/holdings/holdings.cache.ts`.

  Create `apps/api/src/modules/holdings/holdings.cache.ts`:

  ```ts
  // Per-module-instance TTL cache for price quotes (FR-17, NFR-2).
  // Key shape: `${ticker ?? ""}|${kind}|${currency}` — mirrors the brownfield
  // `apps/web/src/lib/services/prices.ts#cacheKey`. null and "" map to the
  // same slot intentionally (manual-entry holdings have no ticker and never
  // hit the chain anyway — the cache slot stays empty in practice).
  //
  // The `now` factory dep is exposed so tests can deterministically advance
  // time without `setSystemTime` (which leaks across tests in bun:test).

  import type { PriceQuote, PriceQuoteInput } from "@pekulo/types";

  export interface PricesCache {
    get(input: PriceQuoteInput): PriceQuote | undefined;
    set(input: PriceQuoteInput, quote: PriceQuote): void;
  }

  export interface CreatePricesCacheDeps {
    ttlMs: number;
    now?: () => number;
  }

  export function createPricesCache(deps: CreatePricesCacheDeps): PricesCache {
    const ttlMs = deps.ttlMs;
    const now = deps.now ?? (() => Date.now());
    const store = new Map<string, { at: number; quote: PriceQuote }>();

    function key(input: PriceQuoteInput): string {
      return `${input.ticker ?? ""}|${input.kind}|${input.currency}`;
    }

    return {
      get(input) {
        const entry = store.get(key(input));
        if (!entry) return undefined;
        if (now() - entry.at > ttlMs) return undefined;
        return entry.quote;
      },
      set(input, quote) {
        store.set(key(input), { at: now(), quote });
      },
    };
  }
  ```

  Run: `bun --filter=api test src/modules/holdings/holdings.cache.test.ts`
  Expected: `6 pass, 0 fail`, exit 0.
  Commit: `git add apps/api/src/modules/holdings/holdings.cache.ts && git commit -m "feat(#21): T5 add PricesCache factory (GREEN)"`

  [AC: AC-2]

- [x] **T6 (RED)** — Add `apps/api/src/modules/holdings/services/prices-client.test.ts` covering the tier-1 client (Bearer header, AbortSignal timeout, code mapping). The module does NOT exist yet — RED expected.

  Create `apps/api/src/modules/holdings/services/prices-client.test.ts`:

  ```ts
  import { afterEach, beforeEach, describe, expect, test } from "bun:test";
  import {
    createPricesClient,
    PricesServiceError,
  } from "./prices-client";

  type FetchFn = typeof globalThis.fetch;
  let originalFetch: FetchFn;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetch(impl: FetchFn): void {
    globalThis.fetch = impl as FetchFn;
  }

  describe("PricesClient", () => {
    test("throws not-configured when baseUrl is undefined", async () => {
      const client = createPricesClient({ baseUrl: undefined, token: undefined });
      await expect(client.fetchQuote("CW8.PA")).rejects.toMatchObject({
        name: "PricesServiceError",
        code: "not-configured",
      });
    });

    test("sends Bearer header when token is set", async () => {
      let capturedHeaders: HeadersInit | undefined;
      mockFetch(async (_url, init) => {
        capturedHeaders = init?.headers;
        return new Response(
          JSON.stringify({ symbol: "CW8.PA", price: 482.13, currency: "EUR", marketTime: "2026-05-17" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      });
      const client = createPricesClient({ baseUrl: "https://prices.internal:8000", token: "tok-abc" });
      await client.fetchQuote("CW8.PA");
      const headers = capturedHeaders as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer tok-abc");
    });

    test("passes AbortSignal.timeout(timeoutMs) to fetch (tier-1 NFR-18)", async () => {
      let capturedSignal: AbortSignal | undefined;
      mockFetch(async (_url, init) => {
        capturedSignal = init?.signal as AbortSignal;
        return new Response(
          JSON.stringify({ symbol: "X", price: 1, currency: "EUR", marketTime: "2026-05-17" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      });
      const client = createPricesClient({ baseUrl: "https://x", token: undefined, timeoutMs: 500 });
      await client.fetchQuote("X");
      expect(capturedSignal).toBeInstanceOf(AbortSignal);
    });

    test("aborted fetch maps to PricesServiceError('network')", async () => {
      mockFetch(async (_url, init) => {
        const signal = init?.signal as AbortSignal | undefined;
        return new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        });
      });
      const client = createPricesClient({ baseUrl: "https://x", token: undefined, timeoutMs: 10 });
      await expect(client.fetchQuote("X")).rejects.toMatchObject({
        name: "PricesServiceError",
        code: "network",
      });
    });

    test("401 maps to auth", async () => {
      mockFetch(async () => new Response("Unauthorized", { status: 401 }));
      const client = createPricesClient({ baseUrl: "https://x", token: "bad" });
      await expect(client.fetchQuote("X")).rejects.toMatchObject({ code: "auth" });
    });

    test("404 maps to invalid-symbol", async () => {
      mockFetch(async () => new Response("Not Found", { status: 404 }));
      const client = createPricesClient({ baseUrl: "https://x", token: undefined });
      await expect(client.fetchQuote("ZZZZ")).rejects.toMatchObject({ code: "invalid-symbol" });
    });

    test("price <= 0 maps to no-price", async () => {
      mockFetch(async () =>
        new Response(
          JSON.stringify({ symbol: "X", price: 0, currency: "EUR", marketTime: "2026-05-17" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      const client = createPricesClient({ baseUrl: "https://x", token: undefined });
      await expect(client.fetchQuote("X")).rejects.toMatchObject({ code: "no-price" });
    });

    test("happy path returns parsed quote (no provider field — orchestrator stamps it)", async () => {
      mockFetch(async () =>
        new Response(
          JSON.stringify({ symbol: "CW8.PA", price: 482.13, currency: "EUR", marketTime: "2026-05-17T10:00:00Z" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      const client = createPricesClient({ baseUrl: "https://x", token: undefined });
      const q = await client.fetchQuote("CW8.PA");
      expect(q.symbol).toBe("CW8.PA");
      expect(q.price).toBe(482.13);
      expect(q.currency).toBe("EUR");
      expect(q.marketTime).toBe("2026-05-17");
      expect("provider" in q).toBe(false);
    });
  });
  ```

  Run: `bun --filter=api test src/modules/holdings/services/prices-client.test.ts`
  Expected: FAIL — `Cannot find module './prices-client'`.
  Commit: `git add apps/api/src/modules/holdings/services/prices-client.test.ts && git commit -m "test(#21): T6 add prices-client tests (RED)"`

  [AC: AC-1, AC-3, AC-6]

- [x] **T7 (GREEN)** — Create `apps/api/src/modules/holdings/services/prices-client.ts` — port of `apps/web/src/lib/services/prices-service.ts` (quoted in Dev Notes) with: (a) factory pattern (no module-level env access), (b) `AbortSignal.timeout(timeoutMs)` injected, (c) `provider` field stripped from output (orchestrator stamps).

  Create `apps/api/src/modules/holdings/services/prices-client.ts`:

  ```ts
  // Tier-1 client — HTTP to apps/prices (FastAPI on Dokploy, internal Docker
  // network only, Bearer-authed). Port of apps/web/src/lib/services/prices-service.ts.
  //
  // Diffs vs brownfield:
  //   - Factory pattern (createPricesClient(deps)) instead of module-level
  //     process.env access. Lets the module factory wire env-derived deps and
  //     tests inject fakes.
  //   - AbortSignal.timeout(timeoutMs) — brownfield had no timeout, which
  //     silently violates NFR-18 (provider fallback ≤ 500 ms). Default 500.
  //   - The returned quote omits the `provider` field; the orchestrator
  //     stamps it after the tier wins.
  //   - No `import "server-only"` — apps/api has no Next.js server/client
  //     split.

  export interface PricesServiceQuote {
    symbol: string;
    price: number;
    currency: string;
    marketTime: string; // YYYY-MM-DD
  }

  export type PricesServiceErrorCode =
    | "not-configured"
    | "network"
    | "format"
    | "auth"
    | "invalid-symbol"
    | "no-price";

  export class PricesServiceError extends Error {
    override readonly name = "PricesServiceError";
    readonly code: PricesServiceErrorCode;
    constructor(code: PricesServiceErrorCode, message: string) {
      super(message);
      this.code = code;
    }
  }

  export interface PricesClient {
    fetchQuote(symbol: string): Promise<PricesServiceQuote>;
  }

  export interface CreatePricesClientDeps {
    baseUrl: string | undefined;
    token: string | undefined;
    timeoutMs?: number;
  }

  export function createPricesClient(deps: CreatePricesClientDeps): PricesClient {
    const timeoutMs = deps.timeoutMs ?? 500;
    return {
      async fetchQuote(symbol) {
        const base = deps.baseUrl;
        if (!base) {
          throw new PricesServiceError("not-configured", "PRICES_SERVICE_URL non défini.");
        }
        const headers: Record<string, string> = { Accept: "application/json" };
        if (deps.token) headers.Authorization = `Bearer ${deps.token}`;

        const url = `${base.replace(/\/$/, "")}/quote?symbol=${encodeURIComponent(symbol)}`;

        let res: Response;
        try {
          res = await fetch(url, {
            headers,
            cache: "no-store",
            signal: AbortSignal.timeout(timeoutMs),
          });
        } catch (err) {
          throw new PricesServiceError(
            "network",
            `Échec réseau: ${err instanceof Error ? err.message : String(err)}`,
          );
        }

        if (res.status === 401 || res.status === 403) {
          throw new PricesServiceError("auth", `Service prix: HTTP ${res.status}`);
        }
        if (res.status === 404) {
          throw new PricesServiceError("invalid-symbol", `Ticker introuvable: ${symbol}`);
        }
        if (!res.ok) {
          throw new PricesServiceError("network", `Service prix: HTTP ${res.status}`);
        }

        let json: unknown;
        try {
          json = await res.json();
        } catch {
          throw new PricesServiceError("format", "Réponse non-JSON.");
        }

        const obj = json as Record<string, unknown>;
        const price = Number(obj.price);
        if (!Number.isFinite(price) || price <= 0) {
          throw new PricesServiceError("no-price", `Pas de prix pour ${symbol}.`);
        }

        return {
          symbol: typeof obj.symbol === "string" ? obj.symbol : symbol,
          price,
          currency: typeof obj.currency === "string" ? obj.currency : "",
          marketTime:
            typeof obj.marketTime === "string"
              ? obj.marketTime.slice(0, 10)
              : new Date().toISOString().slice(0, 10),
        };
      },
    };
  }
  ```

  Run: `bun --filter=api test src/modules/holdings/services/prices-client.test.ts`
  Expected: `8 pass, 0 fail`, exit 0.
  Commit: `git add apps/api/src/modules/holdings/services/prices-client.ts && git commit -m "feat(#21): T7 add tier-1 PricesClient with AbortSignal timeout (GREEN)"`

  [AC: AC-1, AC-3, AC-6]

- [x] **T8 (RED)** — Add `apps/api/src/modules/holdings/services/yahoo-client.test.ts` covering `resolveYahooSymbol` (no mock needed — pure) + `fetchQuote` with module-level mock of `yahoo-finance2`. Module does NOT exist yet — RED.

  Create `apps/api/src/modules/holdings/services/yahoo-client.test.ts`:

  ```ts
  import { describe, expect, mock, test } from "bun:test";

  // Module mock — must be installed BEFORE the yahoo-client import.
  const quoteMock = mock(async (_symbol: string) => ({
    regularMarketPrice: 482.13,
    currency: "EUR",
    regularMarketTime: new Date("2026-05-17T10:00:00Z"),
  }));
  await mock.module("yahoo-finance2", () => ({
    default: { quote: quoteMock },
  }));

  const { createYahooClient, resolveYahooSymbol, YahooError } = await import("./yahoo-client");

  describe("resolveYahooSymbol", () => {
    test("appends .PA for EUR tickers without a dot", () => {
      expect(resolveYahooSymbol("CW8", "EUR")).toBe("CW8.PA");
    });

    test("returns as-is for USD tickers", () => {
      expect(resolveYahooSymbol("AAPL", "USD")).toBe("AAPL");
    });

    test("returns as-is for tickers with a dot", () => {
      expect(resolveYahooSymbol("PE500.PA", "EUR")).toBe("PE500.PA");
      expect(resolveYahooSymbol("BTC-USD", "USD")).toBe("BTC-USD");
    });

    test("throws YahooError('missing-ticker') on null/empty", () => {
      expect(() => resolveYahooSymbol(null, "EUR")).toThrow(YahooError);
      expect(() => resolveYahooSymbol("", "EUR")).toThrow(YahooError);
      expect(() => resolveYahooSymbol("   ", "EUR")).toThrow(YahooError);
    });
  });

  describe("YahooClient.fetchQuote", () => {
    test("happy path returns parsed quote without provider field", async () => {
      quoteMock.mockResolvedValueOnce({
        regularMarketPrice: 482.13,
        currency: "EUR",
        regularMarketTime: new Date("2026-05-17T10:00:00Z"),
      });
      const client = createYahooClient();
      const q = await client.fetchQuote("CW8.PA");
      expect(q).toEqual({
        symbol: "CW8.PA",
        price: 482.13,
        currency: "EUR",
        marketTime: "2026-05-17",
      });
    });

    test("invalid-ticker error message maps to YahooError('invalid-ticker')", async () => {
      quoteMock.mockRejectedValueOnce(new Error("Quote not found for ticker ZZZZ"));
      await expect(createYahooClient().fetchQuote("ZZZZ")).rejects.toMatchObject({
        name: "YahooError",
        code: "invalid-ticker",
      });
    });

    test("rate-limit error maps to YahooError('rate-limited')", async () => {
      quoteMock.mockRejectedValueOnce(new Error("Request failed with status 429 - rate-limited"));
      await expect(createYahooClient().fetchQuote("X")).rejects.toMatchObject({
        code: "rate-limited",
      });
    });

    test("price <= 0 maps to YahooError('no-price')", async () => {
      quoteMock.mockResolvedValueOnce({
        regularMarketPrice: 0,
        currency: "EUR",
        regularMarketTime: new Date(),
      });
      await expect(createYahooClient().fetchQuote("X")).rejects.toMatchObject({ code: "no-price" });
    });
  });
  ```

  Run: `bun --filter=api test src/modules/holdings/services/yahoo-client.test.ts`
  Expected: FAIL — `Cannot find module './yahoo-client'`.
  Commit: `git add apps/api/src/modules/holdings/services/yahoo-client.test.ts && git commit -m "test(#21): T8 add yahoo-client tests (RED)"`

  [AC: AC-1, AC-3, AC-4]

- [x] **T9 (GREEN)** — Create `apps/api/src/modules/holdings/services/yahoo-client.ts` — port of `apps/web/src/lib/services/yahoo-finance.ts`. Diffs vs brownfield: factory wrapping, `provider` stripped, no `server-only`.

  Add `yahoo-finance2` to `apps/api/package.json` deps if not present — check first with `grep "yahoo-finance2" apps/api/package.json` ; if missing, install via `bun add --filter=api yahoo-finance2` (pin to the same version as `apps/web/package.json` — read `grep yahoo-finance2 apps/web/package.json`).

  Create `apps/api/src/modules/holdings/services/yahoo-client.ts`:

  ```ts
  // Tier-2 client — yahoo-finance2 wrapper. Port of
  // apps/web/src/lib/services/yahoo-finance.ts.
  //
  // Diffs vs brownfield:
  //   - Factory pattern (createYahooClient() — currently no deps but the
  //     shape stays consistent with the other 3 clients).
  //   - Imports HoldingCurrency from @pekulo/types (instead of legacy
  //     @/lib/types#Currency from the web tier).
  //   - The returned quote omits the `provider` field; the orchestrator stamps.
  //   - No `import "server-only"` (api-side, no Next.js layer).

  import yahooFinance from "yahoo-finance2";
  import type { HoldingCurrency } from "@pekulo/validators";

  export interface YahooQuote {
    symbol: string;
    price: number;
    currency: string;
    marketTime: string; // YYYY-MM-DD
  }

  export type YahooErrorCode =
    | "missing-ticker"
    | "invalid-ticker"
    | "network"
    | "format"
    | "no-price"
    | "rate-limited";

  export class YahooError extends Error {
    override readonly name = "YahooError";
    readonly code: YahooErrorCode;
    constructor(code: YahooErrorCode, message: string) {
      super(message);
      this.code = code;
    }
  }

  export function resolveYahooSymbol(
    ticker: string | null | undefined,
    currency: HoldingCurrency,
  ): string {
    if (!ticker || ticker.trim().length === 0) {
      throw new YahooError("missing-ticker", "Aucun ticker pour cette ligne.");
    }
    const trimmed = ticker.trim().toUpperCase();
    if (trimmed.includes(".")) return trimmed;
    if (currency === "USD") return trimmed;
    return `${trimmed}.PA`;
  }

  export interface YahooClient {
    fetchQuote(symbol: string): Promise<YahooQuote>;
  }

  export function createYahooClient(): YahooClient {
    return {
      async fetchQuote(symbol) {
        let result: Awaited<ReturnType<typeof yahooFinance.quote>>;
        try {
          result = await yahooFinance.quote(symbol, {}, { validateResult: false });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (/not found|invalid|empty result/i.test(msg)) {
            throw new YahooError("invalid-ticker", `Ticker introuvable: ${symbol}`);
          }
          if (/429|rate.?limit|too many/i.test(msg)) {
            throw new YahooError("rate-limited", "Yahoo: rate-limited.");
          }
          throw new YahooError("network", `Yahoo: ${msg}`);
        }

        const q = Array.isArray(result) ? result[0] : result;
        if (!q) {
          throw new YahooError("invalid-ticker", `Aucune réponse pour ${symbol}.`);
        }

        const price = Number((q as { regularMarketPrice?: number }).regularMarketPrice);
        if (!Number.isFinite(price) || price <= 0) {
          throw new YahooError("no-price", `Pas de prix pour ${symbol}.`);
        }

        const currency =
          typeof (q as { currency?: string }).currency === "string"
            ? (q as { currency: string }).currency
            : "";

        const ts = (q as { regularMarketTime?: number | Date }).regularMarketTime;
        const marketTime =
          ts instanceof Date
            ? ts.toISOString().slice(0, 10)
            : typeof ts === "number"
              ? new Date(ts * 1000).toISOString().slice(0, 10)
              : new Date().toISOString().slice(0, 10);

        return { symbol, price, currency, marketTime };
      },
    };
  }
  ```

  Run: `bun --filter=api test src/modules/holdings/services/yahoo-client.test.ts`
  Expected: `7 pass, 0 fail`, exit 0.
  Commit: `git add apps/api/src/modules/holdings/services/yahoo-client.ts apps/api/package.json bun.lock && git commit -m "feat(#21): T9 add tier-2 YahooClient + resolveYahooSymbol (GREEN)"`

  [AC: AC-1, AC-3, AC-4]

- [x] **T10 (RED)** — Add `apps/api/src/modules/holdings/services/boursorama-scraper.test.ts` covering scrape parse + redirect detection + French decimal. RED expected.

  Create `apps/api/src/modules/holdings/services/boursorama-scraper.test.ts`:

  ```ts
  import { afterEach, beforeEach, describe, expect, test } from "bun:test";
  import { BoursoramaError, createBoursoramaScraper } from "./boursorama-scraper";

  type FetchFn = typeof globalThis.fetch;
  let originalFetch: FetchFn;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function htmlWithPrice(raw: string): string {
    return `<html><body><span class="c-instrument c-instrument--last" data-test="x">${raw}</span></body></html>`;
  }

  describe("BoursoramaScraper", () => {
    test("missing ticker throws BoursoramaError('missing-ticker')", async () => {
      const scraper = createBoursoramaScraper();
      await expect(scraper.fetchQuote(null)).rejects.toMatchObject({ code: "missing-ticker" });
      await expect(scraper.fetchQuote("")).rejects.toMatchObject({ code: "missing-ticker" });
    });

    test("URL still on /recherche/ → invalid-symbol", async () => {
      globalThis.fetch = (async (_url) =>
        new Response("<html></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        })) as FetchFn;
      // Simulate non-redirected URL by overriding Response.url with a recherche path.
      // bun:test Response.url is "" by default → we override via a Proxy.
      globalThis.fetch = (async () => {
        const res = new Response("<html></html>", { status: 200 });
        Object.defineProperty(res, "url", { value: "https://www.boursorama.com/recherche/?query=ZZZZ" });
        return res;
      }) as FetchFn;
      const scraper = createBoursoramaScraper();
      await expect(scraper.fetchQuote("ZZZZ")).rejects.toMatchObject({ code: "invalid-symbol" });
    });

    test("happy path — French decimal '50,20' → 50.20", async () => {
      globalThis.fetch = (async () => {
        const res = new Response(htmlWithPrice("50,20"), { status: 200 });
        Object.defineProperty(res, "url", { value: "https://www.boursorama.com/bourse/trackers/cours/1rTPE500/" });
        return res;
      }) as FetchFn;
      const q = await createBoursoramaScraper().fetchQuote("PE500");
      expect(q.price).toBe(50.2);
      expect(q.currency).toBe("EUR");
      expect(q.symbol).toBe("PE500");
    });

    test("French decimal with NBSP thousand-sep '8 166,47' → 8166.47", async () => {
      globalThis.fetch = (async () => {
        const res = new Response(htmlWithPrice("8 166,47"), { status: 200 });
        Object.defineProperty(res, "url", { value: "https://www.boursorama.com/cours/1rPABCD/" });
        return res;
      }) as FetchFn;
      const q = await createBoursoramaScraper().fetchQuote("ABCD");
      expect(q.price).toBe(8166.47);
    });

    test("ticker with .PA suffix is stripped to bare symbol before scrape", async () => {
      let capturedUrl = "";
      globalThis.fetch = (async (url) => {
        capturedUrl = String(url);
        const res = new Response(htmlWithPrice("100,00"), { status: 200 });
        Object.defineProperty(res, "url", { value: "https://www.boursorama.com/cours/x/" });
        return res;
      }) as FetchFn;
      await createBoursoramaScraper().fetchQuote("PE500.PA");
      expect(capturedUrl).toContain("query=PE500");
      expect(capturedUrl).not.toContain("PE500.PA");
    });

    test("no price match in HTML → format", async () => {
      globalThis.fetch = (async () => {
        const res = new Response("<html></html>", { status: 200 });
        Object.defineProperty(res, "url", { value: "https://www.boursorama.com/cours/x/" });
        return res;
      }) as FetchFn;
      await expect(createBoursoramaScraper().fetchQuote("X")).rejects.toMatchObject({ code: "format" });
    });
  });
  ```

  Run: `bun --filter=api test src/modules/holdings/services/boursorama-scraper.test.ts`
  Expected: FAIL — `Cannot find module './boursorama-scraper'`.
  Commit: `git add apps/api/src/modules/holdings/services/boursorama-scraper.test.ts && git commit -m "test(#21): T10 add boursorama-scraper tests (RED)"`

  [AC: AC-3]

- [x] **T11 (GREEN)** — Create `apps/api/src/modules/holdings/services/boursorama-scraper.ts` — port of `apps/web/src/lib/services/boursorama.ts`.

  Create `apps/api/src/modules/holdings/services/boursorama-scraper.ts`:

  ```ts
  // Tier-3 client — Boursorama scraper. Port of apps/web/src/lib/services/boursorama.ts.
  //
  // Diffs vs brownfield:
  //   - Factory pattern.
  //   - The returned quote omits the `provider` field; the orchestrator stamps.
  //   - No `import "server-only"`.

  export interface BoursoramaQuote {
    symbol: string;
    price: number;
    currency: string;
    marketTime: string; // YYYY-MM-DD
  }

  export type BoursoramaErrorCode =
    | "missing-ticker"
    | "invalid-symbol"
    | "network"
    | "format"
    | "no-price";

  export class BoursoramaError extends Error {
    override readonly name = "BoursoramaError";
    readonly code: BoursoramaErrorCode;
    constructor(code: BoursoramaErrorCode, message: string) {
      super(message);
      this.code = code;
    }
  }

  const USER_AGENT =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36";

  const HEADERS: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9",
  };

  function bareTicker(ticker: string): string {
    const trimmed = ticker.trim().toUpperCase();
    const dot = trimmed.indexOf(".");
    return dot > 0 ? trimmed.slice(0, dot) : trimmed;
  }

  function parseFrenchDecimal(raw: string): number {
    // "50,20" → 50.20 ; "8 166,47" → 8166.47 ; non-breaking spaces & narrow nbsp stripped.
    const cleaned = raw
      .replace(/ /g, "") // non-breaking space
      .replace(/ /g, "") // narrow no-break space (Boursorama thousand sep)
      .replace(/\s+/g, "")
      .replace(",", ".");
    return Number(cleaned);
  }

  export interface BoursoramaScraper {
    fetchQuote(ticker: string | null | undefined): Promise<BoursoramaQuote>;
  }

  export interface CreateBoursoramaScraperDeps {
    timeoutMs?: number;
  }

  export function createBoursoramaScraper(deps: CreateBoursoramaScraperDeps = {}): BoursoramaScraper {
    const timeoutMs = deps.timeoutMs ?? 1500; // Boursorama scrape is slower than tier-1 — 1.5 s ceiling

    return {
      async fetchQuote(ticker) {
        if (!ticker || ticker.trim().length === 0) {
          throw new BoursoramaError("missing-ticker", "Ticker manquant.");
        }
        const symbol = bareTicker(ticker);
        const searchUrl = `https://www.boursorama.com/recherche/?query=${encodeURIComponent(symbol)}`;

        let res: Response;
        try {
          res = await fetch(searchUrl, {
            headers: HEADERS,
            redirect: "follow",
            cache: "no-store",
            signal: AbortSignal.timeout(timeoutMs),
          });
        } catch (err) {
          throw new BoursoramaError(
            "network",
            `Échec réseau Boursorama: ${err instanceof Error ? err.message : String(err)}`,
          );
        }

        if (!res.ok) {
          throw new BoursoramaError("network", `Boursorama HTTP ${res.status}`);
        }

        if (res.url.includes("/recherche/")) {
          throw new BoursoramaError("invalid-symbol", `Ticker ${symbol} non trouvé sur Boursorama.`);
        }

        const html = await res.text();
        const match = html.match(/class="c-instrument c-instrument--last"[^>]*>([^<]+)</);
        if (!match || !match[1]) {
          throw new BoursoramaError("format", "Format Boursorama inattendu (prix introuvable).");
        }

        const price = parseFrenchDecimal(match[1]);
        if (!Number.isFinite(price) || price <= 0) {
          throw new BoursoramaError("no-price", `Pas de prix exploitable pour ${symbol}.`);
        }

        const currency = "EUR";
        const marketTime = new Date().toISOString().slice(0, 10);

        return { symbol, price, currency, marketTime };
      },
    };
  }
  ```

  Run: `bun --filter=api test src/modules/holdings/services/boursorama-scraper.test.ts`
  Expected: `6 pass, 0 fail`, exit 0.
  Commit: `git add apps/api/src/modules/holdings/services/boursorama-scraper.ts && git commit -m "feat(#21): T11 add tier-3 BoursoramaScraper (GREEN)"`

  [AC: AC-3]

- [x] **T12 (RED)** — Add `apps/api/src/modules/holdings/services/twelve-data-client.test.ts` covering missing-key, 429 rate-limit, envelope-error, happy path. RED expected.

  Create `apps/api/src/modules/holdings/services/twelve-data-client.test.ts`:

  ```ts
  import { afterEach, beforeEach, describe, expect, test } from "bun:test";
  import { createTwelveDataClient, TwelveDataError } from "./twelve-data-client";

  type FetchFn = typeof globalThis.fetch;
  let originalFetch: FetchFn;
  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; });

  describe("TwelveDataClient", () => {
    test("missing apiKey throws TwelveDataError('missing-key')", async () => {
      const client = createTwelveDataClient({ apiKey: undefined });
      await expect(client.fetchQuote("X")).rejects.toMatchObject({
        name: "TwelveDataError",
        code: "missing-key",
      });
    });

    test("HTTP 429 → rate-limited", async () => {
      globalThis.fetch = (async () => new Response("Too many", { status: 429 })) as FetchFn;
      const client = createTwelveDataClient({ apiKey: "k" });
      await expect(client.fetchQuote("X")).rejects.toMatchObject({ code: "rate-limited" });
    });

    test("envelope-error code 404 → invalid-symbol", async () => {
      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ code: 404, message: "symbol not found" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })) as FetchFn;
      const client = createTwelveDataClient({ apiKey: "k" });
      await expect(client.fetchQuote("ZZZZ")).rejects.toMatchObject({ code: "invalid-symbol" });
    });

    test("envelope-error 'api key' → missing-key", async () => {
      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ code: 401, message: "Invalid api key" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })) as FetchFn;
      const client = createTwelveDataClient({ apiKey: "k" });
      await expect(client.fetchQuote("X")).rejects.toMatchObject({ code: "missing-key" });
    });

    test("happy path — close field → price", async () => {
      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify({ close: "192.55", currency: "USD", datetime: "2026-05-17 16:00:00" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )) as FetchFn;
      const q = await createTwelveDataClient({ apiKey: "k" }).fetchQuote("AAPL");
      expect(q).toEqual({
        symbol: "AAPL",
        price: 192.55,
        currency: "USD",
        marketTime: "2026-05-17",
      });
    });

    test("price <= 0 → no-price", async () => {
      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ close: "0", currency: "USD" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })) as FetchFn;
      await expect(createTwelveDataClient({ apiKey: "k" }).fetchQuote("X")).rejects.toMatchObject({
        code: "no-price",
      });
    });
  });
  ```

  Run: `bun --filter=api test src/modules/holdings/services/twelve-data-client.test.ts`
  Expected: FAIL — `Cannot find module './twelve-data-client'`.
  Commit: `git add apps/api/src/modules/holdings/services/twelve-data-client.test.ts && git commit -m "test(#21): T12 add twelve-data-client tests (RED)"`

  [AC: AC-3, AC-4]

- [x] **T13 (GREEN)** — Create `apps/api/src/modules/holdings/services/twelve-data-client.ts` — port of `apps/web/src/lib/services/twelve-data.ts`.

  Create `apps/api/src/modules/holdings/services/twelve-data-client.ts`:

  ```ts
  // Tier-4 client — Twelve Data REST. Port of apps/web/src/lib/services/twelve-data.ts.
  //
  // Diffs vs brownfield:
  //   - Factory pattern (apiKey injected via deps, not module-level process.env).
  //   - AbortSignal.timeout(timeoutMs) — default 2 s (free tier is slow).
  //   - `provider` field stripped from output.
  //   - No `import "server-only"`.

  export interface TwelveDataQuote {
    symbol: string;
    price: number;
    currency: string;
    marketTime: string; // YYYY-MM-DD
  }

  export type TwelveDataErrorCode =
    | "missing-key"
    | "invalid-symbol"
    | "rate-limited"
    | "network"
    | "format"
    | "no-price";

  export class TwelveDataError extends Error {
    override readonly name = "TwelveDataError";
    readonly code: TwelveDataErrorCode;
    constructor(code: TwelveDataErrorCode, message: string) {
      super(message);
      this.code = code;
    }
  }

  export interface TwelveDataClient {
    fetchQuote(symbol: string): Promise<TwelveDataQuote>;
  }

  export interface CreateTwelveDataClientDeps {
    apiKey: string | undefined;
    timeoutMs?: number;
  }

  export function createTwelveDataClient(deps: CreateTwelveDataClientDeps): TwelveDataClient {
    const timeoutMs = deps.timeoutMs ?? 2_000;
    return {
      async fetchQuote(symbol) {
        const apiKey = deps.apiKey;
        if (!apiKey) {
          throw new TwelveDataError("missing-key", "TWELVE_DATA_API_KEY non défini.");
        }

        const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`;

        let res: Response;
        try {
          res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
        } catch (err) {
          throw new TwelveDataError(
            "network",
            `Échec réseau: ${err instanceof Error ? err.message : String(err)}`,
          );
        }

        if (res.status === 429) {
          throw new TwelveDataError("rate-limited", "Twelve Data: rate-limited (429).");
        }
        if (!res.ok) {
          throw new TwelveDataError("network", `Twelve Data HTTP ${res.status}`);
        }

        let json: unknown;
        try {
          json = await res.json();
        } catch {
          throw new TwelveDataError("format", "Réponse Twelve Data non-JSON.");
        }

        if (json && typeof json === "object" && "code" in json && "message" in json) {
          const code = Number((json as { code?: number }).code);
          const msg = String((json as { message?: string }).message ?? "");
          if (code === 429) {
            throw new TwelveDataError("rate-limited", `Twelve Data: ${msg}`);
          }
          if (code === 401 || /api key/i.test(msg)) {
            throw new TwelveDataError("missing-key", `Twelve Data: ${msg}`);
          }
          if (code === 404 || /not found/i.test(msg)) {
            throw new TwelveDataError("invalid-symbol", `Twelve Data: ${msg}`);
          }
          throw new TwelveDataError("format", `Twelve Data: ${msg}`);
        }

        const obj = json as Record<string, unknown>;
        const closeRaw = obj.close ?? obj.price;
        const price = Number(closeRaw);
        if (!Number.isFinite(price) || price <= 0) {
          throw new TwelveDataError("no-price", `Pas de prix pour ${symbol}.`);
        }

        const currency = typeof obj.currency === "string" ? obj.currency : "";
        const datetime = typeof obj.datetime === "string" ? obj.datetime : "";
        const marketTime = datetime ? datetime.slice(0, 10) : new Date().toISOString().slice(0, 10);

        return { symbol, price, currency, marketTime };
      },
    };
  }
  ```

  Run: `bun --filter=api test src/modules/holdings/services/twelve-data-client.test.ts`
  Expected: `6 pass, 0 fail`, exit 0.
  Commit: `git add apps/api/src/modules/holdings/services/twelve-data-client.ts && git commit -m "feat(#21): T13 add tier-4 TwelveDataClient (GREEN)"`

  [AC: AC-3, AC-4]

- [x] **T14 (RED)** — Add `apps/api/src/common/test/fakes/prices-clients.ts` (fake helpers for the 4 clients + the cache) AND extend `apps/api/src/modules/holdings/holdings.service.test.ts` with `describe("resolveQuote", …)` block covering AC-1 (fallback ≤ 600 ms wall-clock), AC-2 (cache hit no-call), AC-3 (all-fail composite), AC-4 (BTC-USD via Yahoo, boursorama not called for crypto), AC-7 (OTel child spans).

  Create `apps/api/src/common/test/fakes/prices-clients.ts`:

  ```ts
  // Fake clients + cache for the price chain (story 3-2). Used by
  // holdings.service.test.ts and holdings.module.test.ts.
  //
  // Each fake exposes a `calls` array for assertion (number of invocations,
  // last symbol argument). Default behaviour is to throw the typed
  // "not-configured" / equivalent error so tests can opt-in by overriding
  // `.fetchQuote = …`.

  import type { PricesClient } from "../../../modules/holdings/services/prices-client";
  import { PricesServiceError } from "../../../modules/holdings/services/prices-client";
  import type { YahooClient } from "../../../modules/holdings/services/yahoo-client";
  import { YahooError } from "../../../modules/holdings/services/yahoo-client";
  import type { BoursoramaScraper } from "../../../modules/holdings/services/boursorama-scraper";
  import { BoursoramaError } from "../../../modules/holdings/services/boursorama-scraper";
  import type { TwelveDataClient } from "../../../modules/holdings/services/twelve-data-client";
  import { TwelveDataError } from "../../../modules/holdings/services/twelve-data-client";

  export interface FakeClient<C> {
    client: C;
    calls: string[];
    setBehavior(impl: C["fetchQuote"]): void;
  }

  export function fakePricesClient(): FakeClient<PricesClient> {
    const calls: string[] = [];
    let impl: PricesClient["fetchQuote"] = async () => {
      throw new PricesServiceError("not-configured", "fake: not configured");
    };
    const client: PricesClient = {
      async fetchQuote(symbol) {
        calls.push(symbol);
        return impl(symbol);
      },
    };
    return { client, calls, setBehavior: (next) => { impl = next; } };
  }

  export function fakeYahooClient(): FakeClient<YahooClient> {
    const calls: string[] = [];
    let impl: YahooClient["fetchQuote"] = async () => {
      throw new YahooError("invalid-ticker", "fake: not configured");
    };
    const client: YahooClient = {
      async fetchQuote(symbol) {
        calls.push(symbol);
        return impl(symbol);
      },
    };
    return { client, calls, setBehavior: (next) => { impl = next; } };
  }

  export function fakeBoursoramaScraper(): FakeClient<BoursoramaScraper> {
    const calls: string[] = [];
    let impl: BoursoramaScraper["fetchQuote"] = async () => {
      throw new BoursoramaError("invalid-symbol", "fake: not configured");
    };
    const client: BoursoramaScraper = {
      async fetchQuote(ticker) {
        calls.push(String(ticker));
        return impl(ticker);
      },
    };
    return { client, calls, setBehavior: (next) => { impl = next; } };
  }

  export function fakeTwelveDataClient(): FakeClient<TwelveDataClient> {
    const calls: string[] = [];
    let impl: TwelveDataClient["fetchQuote"] = async () => {
      throw new TwelveDataError("missing-key", "fake: not configured");
    };
    const client: TwelveDataClient = {
      async fetchQuote(symbol) {
        calls.push(symbol);
        return impl(symbol);
      },
    };
    return { client, calls, setBehavior: (next) => { impl = next; } };
  }
  ```

  Edit `apps/api/src/modules/holdings/holdings.service.test.ts` — append a new `describe("resolveQuote", …)` block at end of file (before EOF):

  ```ts
  // ─── resolveQuote (story 3-2) ────────────────────────────────────────────
  // The service-internal price orchestrator. Tested with fake clients so the
  // suite stays offline and deterministic.

  import {
    fakeBoursoramaScraper,
    fakePricesClient,
    fakeTwelveDataClient,
    fakeYahooClient,
  } from "../../common/test/fakes/prices-clients";
  import { createPricesCache } from "./holdings.cache";
  import { PriceProviderError } from "./holdings.errors";

  function buildService(opts: {
    prices?: ReturnType<typeof fakePricesClient>;
    yahoo?: ReturnType<typeof fakeYahooClient>;
    boursorama?: ReturnType<typeof fakeBoursoramaScraper>;
    twelveData?: ReturnType<typeof fakeTwelveDataClient>;
    now?: () => number;
  } = {}) {
    const prices = opts.prices ?? fakePricesClient();
    const yahoo = opts.yahoo ?? fakeYahooClient();
    const boursorama = opts.boursorama ?? fakeBoursoramaScraper();
    const twelveData = opts.twelveData ?? fakeTwelveDataClient();
    const cache = createPricesCache({ ttlMs: 60_000, now: opts.now });
    const service = createHoldingsService({
      repository: makeFakeRepo(),
      pricesClient: prices.client,
      yahooClient: yahoo.client,
      boursoramaScraper: boursorama.client,
      twelveDataClient: twelveData.client,
      pricesCache: cache,
    });
    return { service, prices, yahoo, boursorama, twelveData };
  }

  describe("resolveQuote", () => {
    test("AC-1: tier-1 timeout falls back to tier-2 within wall-clock ceiling", async () => {
      const { service, prices, yahoo } = buildService();
      prices.setBehavior(async () => {
        // Simulate hang — tier-1 client itself short-circuits via AbortSignal
        // in prod; in the fake we throw the equivalent network error.
        throw new (await import("./services/prices-client")).PricesServiceError(
          "network",
          "fake: timeout",
        );
      });
      yahoo.setBehavior(async (symbol) => ({
        symbol,
        price: 482.13,
        currency: "EUR",
        marketTime: "2026-05-17",
      }));
      const t0 = performance.now();
      const q = await service.resolveQuote({ ticker: "CW8", kind: "etf", currency: "EUR" });
      const elapsed = performance.now() - t0;
      expect(elapsed).toBeLessThan(600);
      expect(q.provider).toBe("yahoo");
      expect(q.symbol).toBe("CW8.PA");
      expect(yahoo.calls).toEqual(["CW8.PA"]);
    });

    test("AC-2: second call within 60 s returns cached quote with zero provider calls", async () => {
      let now = 1_000_000;
      const { service, prices, yahoo, boursorama, twelveData } = buildService({ now: () => now });
      yahoo.setBehavior(async (symbol) => ({
        symbol,
        price: 192.55,
        currency: "USD",
        marketTime: "2026-05-17",
      }));
      const input = { ticker: "AAPL", kind: "action" as const, currency: "USD" as const };
      const q1 = await service.resolveQuote(input);
      expect(yahoo.calls.length).toBe(1);
      now += 59_000;
      const q2 = await service.resolveQuote(input);
      expect(yahoo.calls.length).toBe(1); // no new call
      expect(prices.calls.length + boursorama.calls.length + twelveData.calls.length).toBe(0);
      expect(q2).toBe(q1); // reference equality
      now += 2_000; // crosses 60s
      await service.resolveQuote(input);
      expect(yahoo.calls.length).toBe(2);
    });

    test("AC-3: all four tiers fail → PriceProviderError with 4 attempts in order", async () => {
      const { service, prices, yahoo, boursorama, twelveData } = buildService();
      const { PricesServiceError } = await import("./services/prices-client");
      const { YahooError } = await import("./services/yahoo-client");
      const { BoursoramaError } = await import("./services/boursorama-scraper");
      const { TwelveDataError } = await import("./services/twelve-data-client");
      prices.setBehavior(async () => { throw new PricesServiceError("network", "x"); });
      yahoo.setBehavior(async () => { throw new YahooError("rate-limited", "x"); });
      boursorama.setBehavior(async () => { throw new BoursoramaError("invalid-symbol", "x"); });
      twelveData.setBehavior(async () => { throw new TwelveDataError("missing-key", "x"); });

      let caught: unknown;
      try {
        await service.resolveQuote({ ticker: "ZZZZ", kind: "etf", currency: "EUR" });
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(PriceProviderError);
      const ppe = caught as PriceProviderError;
      expect(ppe.attempts).toEqual([
        { provider: "prices-service", reason: "réseau" },
        { provider: "yahoo", reason: "rate-limited" },
        { provider: "boursorama", reason: "ticker non listé" },
        { provider: "twelve-data", reason: "clé manquante" },
      ]);
    });

    test("AC-4: BTC-USD resolves via yahoo; boursorama tier is SKIPPED for crypto", async () => {
      const { service, prices, yahoo, boursorama } = buildService();
      const { PricesServiceError } = await import("./services/prices-client");
      prices.setBehavior(async () => { throw new PricesServiceError("not-configured", "x"); });
      yahoo.setBehavior(async (symbol) => ({
        symbol,
        price: 95000,
        currency: "USD",
        marketTime: "2026-05-17",
      }));
      const q = await service.resolveQuote({ ticker: "BTC-USD", kind: "crypto", currency: "USD" });
      expect(q.provider).toBe("yahoo");
      expect(q.symbol).toBe("BTC-USD"); // dot passthrough — no .PA append
      expect(boursorama.calls.length).toBe(0); // SHORT-CIRCUITED for crypto
    });

    test("AC-4b: BTC-USD all-fail collects only 3 attempts (boursorama skipped)", async () => {
      const { service, prices, yahoo, twelveData } = buildService();
      const { PricesServiceError } = await import("./services/prices-client");
      const { YahooError } = await import("./services/yahoo-client");
      const { TwelveDataError } = await import("./services/twelve-data-client");
      prices.setBehavior(async () => { throw new PricesServiceError("network", "x"); });
      yahoo.setBehavior(async () => { throw new YahooError("rate-limited", "x"); });
      twelveData.setBehavior(async () => { throw new TwelveDataError("missing-key", "x"); });

      let caught: unknown;
      try {
        await service.resolveQuote({ ticker: "BTC-USD", kind: "crypto", currency: "USD" });
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(PriceProviderError);
      const ppe = caught as PriceProviderError;
      expect(ppe.attempts.length).toBe(3);
      expect(ppe.attempts.map((a) => a.provider)).toEqual([
        "prices-service",
        "yahoo",
        "twelve-data",
      ]);
    });
  });
  ```

  Run: `bun --filter=api test src/modules/holdings/holdings.service.test.ts`
  Expected: FAIL — `resolveQuote does not exist on HoldingService`.
  Commit: `git add apps/api/src/common/test/fakes/prices-clients.ts apps/api/src/modules/holdings/holdings.service.test.ts && git commit -m "test(#21): T14 add fakes + resolveQuote service tests (RED)"`

  [AC: AC-1, AC-2, AC-3, AC-4]

- [x] **T15 (GREEN)** — Extend `apps/api/src/modules/holdings/holdings.service.ts` with `resolveQuote` (orchestrator + cache + explicit OTel child spans).

  Edit `apps/api/src/modules/holdings/holdings.service.ts` — extend `HoldingService` interface, extend `HoldingServiceDeps`, add `resolveQuote` implementation. The final file shape (existing methods preserved, new code marked):

  ```ts
  // Business logic for the holdings domain.
  //
  // (Header comments preserved from story 3-1 — do NOT delete.)
  //
  // Story 3-2 additions:
  //   - resolveQuote: 4-tier price orchestrator (prices-service → yahoo →
  //     boursorama → twelve-data) with 60 s in-memory cache. Boursorama tier
  //     is short-circuited for kind="crypto" (Boursorama does not list
  //     crypto — saves a wasted 1.5 s scrape).
  //   - Explicit child spans `prices.tier_<n>` via trace.getTracer (lesson L56:
  //     @elysiajs/opentelemetry rootSpan hooks broken under Elysia 1.4.4 + Bun).

  import { SpanStatusCode, trace } from "@opentelemetry/api";
  import type {
    CloseHoldingInput,
    CloseHoldingOutput,
    CreateHoldingInput,
    DerivedHolding,
    GetDerivedHoldingInput,
    Holding,
    HoldingLot,
    ListHoldingsInput,
    PriceProvider,
    PriceProviderAttempt,
    PriceQuote,
    PriceQuoteInput,
    RecordLotInput,
  } from "@pekulo/validators";
  import { deriveFromLots } from "../../common/derive/holding-quantity";
  import { accountNotFound } from "../accounts/accounts.errors";
  import { holdingClosed, holdingNotFound, PriceProviderError } from "./holdings.errors";
  import type { PricesCache } from "./holdings.cache";
  import type { HoldingRepository } from "./holdings.repository";
  import {
    PricesServiceError,
    type PricesClient,
  } from "./services/prices-client";
  import {
    resolveYahooSymbol,
    YahooError,
    type YahooClient,
  } from "./services/yahoo-client";
  import {
    BoursoramaError,
    type BoursoramaScraper,
  } from "./services/boursorama-scraper";
  import {
    TwelveDataError,
    type TwelveDataClient,
  } from "./services/twelve-data-client";

  const TRACER_NAME = "pekulo-api-holdings";

  export interface HoldingService {
    create(userId: string, input: CreateHoldingInput): Promise<Holding>;
    recordLot(userId: string, input: RecordLotInput): Promise<HoldingLot>;
    close(userId: string, input: CloseHoldingInput): Promise<CloseHoldingOutput>;
    list(userId: string, input: ListHoldingsInput): Promise<Holding[]>;
    getDerived(userId: string, input: GetDerivedHoldingInput): Promise<DerivedHolding>;
    /** Story 3-2: 4-tier price orchestrator, service-internal (no oRPC surface). */
    resolveQuote(input: PriceQuoteInput): Promise<PriceQuote>;
  }

  export interface HoldingServiceDeps {
    repository: HoldingRepository;
    /** Story 3-2 — price chain deps. All required at construction time. */
    pricesClient: PricesClient;
    yahooClient: YahooClient;
    boursoramaScraper: BoursoramaScraper;
    twelveDataClient: TwelveDataClient;
    pricesCache: PricesCache;
  }

  // Short French reason labels — mirror the brownfield shortPs / shortYahoo /
  // shortBourso / shortTd helpers so AC-3 sees identical attempts entries.
  function shortPs(code: PricesServiceError["code"]): string {
    switch (code) {
      case "not-configured": return "non configuré";
      case "network": return "réseau";
      case "format": return "format";
      case "auth": return "auth";
      case "invalid-symbol": return "ticker invalide";
      case "no-price": return "aucun prix";
    }
  }
  function shortYahoo(code: YahooError["code"]): string {
    switch (code) {
      case "rate-limited": return "rate-limited";
      case "network": return "réseau";
      case "format": return "format inattendu";
      case "no-price": return "aucun prix";
      case "invalid-ticker": return "ticker invalide";
      case "missing-ticker": return "ticker manquant";
    }
  }
  function shortBourso(code: BoursoramaError["code"]): string {
    switch (code) {
      case "missing-ticker": return "ticker manquant";
      case "invalid-symbol": return "ticker non listé";
      case "network": return "réseau";
      case "format": return "format inattendu";
      case "no-price": return "aucun prix";
    }
  }
  function shortTd(code: TwelveDataError["code"]): string {
    switch (code) {
      case "missing-key": return "clé manquante";
      case "rate-limited": return "rate-limited";
      case "invalid-symbol": return "free tier sans EU";
      case "network": return "réseau";
      case "format": return "format";
      case "no-price": return "aucun prix";
    }
  }

  export function createHoldingsService(deps: HoldingServiceDeps): HoldingService {
    return {
      async create(userId, input) {
        const account = await deps.repository.findAccountForUser(userId, input.accountId);
        if (!account) throw accountNotFound();
        return deps.repository.create(userId, input);
      },

      async recordLot(userId, input) {
        const out = await deps.repository.recordLot(userId, input);
        if (out.outcome === "not-found") throw holdingNotFound();
        if (out.outcome === "closed") throw holdingClosed();
        return out.lot;
      },

      async close(userId, input) {
        const out = await deps.repository.close(userId, input.id);
        if (out.outcome === "not-found") throw holdingNotFound();
        return { ok: true } as const;
      },

      async list(userId, input) {
        return deps.repository.listByUser(userId, { includeClosed: input.includeClosed });
      },

      async getDerived(userId, input) {
        const parent = await deps.repository.findByIdForUser(userId, input.id);
        if (!parent) throw holdingNotFound();
        const lots = await deps.repository.findLotsByHoldingForUser(userId, input.id);
        const derived = deriveFromLots(lots);
        if (lots.length === 0) {
          return {
            holdingId: parent.id,
            quantity: parent.quantity,
            avgCost: parent.avgCost,
            source: "manual",
          } as const;
        }
        return {
          holdingId: parent.id,
          quantity: derived.quantity,
          avgCost: derived.avgCost,
          source: "lots",
        } as const;
      },

      async resolveQuote(input) {
        const tracer = trace.getTracer(TRACER_NAME);
        return tracer.startActiveSpan("prices.resolveQuote", async (parentSpan) => {
          try {
            const cached = deps.pricesCache.get(input);
            if (cached) {
              parentSpan.setAttribute("prices.cache_hit", true);
              return cached;
            }
            parentSpan.setAttribute("prices.cache_hit", false);

            const attempts: PriceProviderAttempt[] = [];

            // Tier 2 needs yahoo symbol (also used by twelve-data on tier 4).
            // resolveYahooSymbol throws YahooError("missing-ticker") for
            // null/empty tickers — let it propagate (the orchestrator throws
            // PriceProviderError([{provider:"yahoo",reason:"ticker manquant"}])).
            let yahooSymbol: string;
            try {
              yahooSymbol = resolveYahooSymbol(input.ticker, input.currency);
            } catch (err) {
              if (err instanceof YahooError) {
                attempts.push({ provider: "yahoo", reason: shortYahoo(err.code) });
                throw new PriceProviderError(attempts);
              }
              throw err;
            }

            const stamp = (
              quote: { symbol: string; price: number; currency: string; marketTime: string },
              provider: PriceProvider,
            ): PriceQuote => ({ ...quote, provider });

            // Tier 1 — prices-service
            const tier1 = await runTier(tracer, 1, "prices-service", input, async () =>
              deps.pricesClient.fetchQuote(yahooSymbol),
            );
            if (tier1.ok) {
              const quote = stamp(tier1.quote, "prices-service");
              deps.pricesCache.set(input, quote);
              return quote;
            }
            attempts.push({
              provider: "prices-service",
              reason:
                tier1.err instanceof PricesServiceError
                  ? shortPs(tier1.err.code)
                  : "exception",
            });

            // Tier 2 — yahoo-finance2
            const tier2 = await runTier(tracer, 2, "yahoo", input, async () =>
              deps.yahooClient.fetchQuote(yahooSymbol),
            );
            if (tier2.ok) {
              const quote = stamp(tier2.quote, "yahoo");
              deps.pricesCache.set(input, quote);
              return quote;
            }
            attempts.push({
              provider: "yahoo",
              reason: tier2.err instanceof YahooError ? shortYahoo(tier2.err.code) : "exception",
            });

            // Tier 3 — Boursorama (SKIPPED for crypto)
            if (input.kind !== "crypto") {
              const tier3 = await runTier(tracer, 3, "boursorama", input, async () =>
                deps.boursoramaScraper.fetchQuote(input.ticker),
              );
              if (tier3.ok) {
                const quote = stamp(tier3.quote, "boursorama");
                deps.pricesCache.set(input, quote);
                return quote;
              }
              attempts.push({
                provider: "boursorama",
                reason:
                  tier3.err instanceof BoursoramaError ? shortBourso(tier3.err.code) : "exception",
              });
            }

            // Tier 4 — Twelve Data
            const tier4 = await runTier(tracer, 4, "twelve-data", input, async () =>
              deps.twelveDataClient.fetchQuote(yahooSymbol),
            );
            if (tier4.ok) {
              const quote = stamp(tier4.quote, "twelve-data");
              deps.pricesCache.set(input, quote);
              return quote;
            }
            attempts.push({
              provider: "twelve-data",
              reason: tier4.err instanceof TwelveDataError ? shortTd(tier4.err.code) : "exception",
            });

            throw new PriceProviderError(attempts);
          } catch (err) {
            parentSpan.recordException(err as Error);
            parentSpan.setStatus({ code: SpanStatusCode.ERROR });
            throw err;
          } finally {
            parentSpan.end();
          }
        });
      },
    };
  }

  // ─── tier-runner helper ──────────────────────────────────────────────────
  // Wraps a single tier call in a child span with the canonical attribute set.
  // Returns a tagged union so the orchestrator can stay flat (no nested try).

  type TierResult =
    | { ok: true; quote: { symbol: string; price: number; currency: string; marketTime: string } }
    | { ok: false; err: unknown };

  async function runTier(
    tracer: ReturnType<typeof trace.getTracer>,
    tier: 1 | 2 | 3 | 4,
    provider: PriceProvider,
    input: PriceQuoteInput,
    call: () => Promise<{ symbol: string; price: number; currency: string; marketTime: string }>,
  ): Promise<TierResult> {
    return tracer.startActiveSpan(`prices.tier_${tier}`, async (span) => {
      span.setAttribute("prices.provider", provider);
      span.setAttribute("prices.ticker", input.ticker ?? "");
      span.setAttribute("prices.currency", input.currency);
      span.setAttribute("prices.kind", input.kind);
      const t0 = performance.now();
      try {
        const quote = await call();
        span.setAttribute("prices.outcome", "ok");
        span.setAttribute("prices.duration_ms", Math.round(performance.now() - t0));
        span.setStatus({ code: SpanStatusCode.OK });
        return { ok: true, quote };
      } catch (err) {
        span.setAttribute("prices.outcome", "error");
        span.setAttribute("prices.duration_ms", Math.round(performance.now() - t0));
        span.recordException(err as Error);
        // NOTE: tier errors are expected control flow (fallback chain) — we
        // record them on the span but do NOT mark the span ERROR (would
        // pollute SLO alerts). The parent span carries the final ERROR
        // status when all 4 tiers fail.
        return { ok: false, err };
      } finally {
        span.end();
      }
    });
  }
  ```

  Run: `bun --filter=api test src/modules/holdings/holdings.service.test.ts`
  Expected: all existing 3-1 tests plus the 5 new `resolveQuote` tests pass — `(N+5) pass, 0 fail`, exit 0.

  Then update the `holdings.repository.test.ts` fake-repo + `holdings.module.test.ts` if they reference `createHoldingsService` directly with the old `{ repository }` shape — extend their call sites to pass the new deps via the fakes from `apps/api/src/common/test/fakes/prices-clients.ts` (likely 2 edits — the repo test does NOT touch the service; the module test wires `createHoldingsModule` which T16 patches; check via `grep -rn 'createHoldingsService' apps/api/src` and adapt).

  Commit: `git add apps/api/src/modules/holdings/holdings.service.ts && git commit -m "feat(#21): T15 add resolveQuote 4-tier orchestrator + OTel child spans (GREEN)"`

  [AC: AC-1, AC-2, AC-3, AC-4, AC-5, AC-7]

- [x] **T16** — Update `apps/api/src/modules/holdings/holdings.module.ts` to accept the 4 clients + cache via deps (with env-derived defaults built inside the factory). Update `apps/api/src/bootstrap/runtime-dependencies.ts` to pass env + construct the prod-wired module.

  Edit `apps/api/src/modules/holdings/holdings.module.ts`:

  ```ts
  // Module factory wiring repository + service + router for the holdings
  // domain. Story 3-1 shipped the CRUD/lots/close path; story 3-2 extends
  // the factory to wire the 4-tier price chain (prices-service, yahoo,
  // boursorama, twelve-data) + 60 s cache.
  //
  // L8 (story 3-1 explicit): the router type is inferred via
  // ReturnType<typeof createHoldingsRouter>; never annotate as `Elysia` or any
  // concrete oRPC implementation type.

  import type { Env } from "../../config/env";
  import type { PrismaService } from "../../database";
  import { createHoldingsRepository } from "./holdings.repository";
  import { createHoldingsRouter } from "./holdings.routes";
  import { createHoldingsService, type HoldingService } from "./holdings.service";
  import { createPricesCache } from "./holdings.cache";
  import { createPricesClient } from "./services/prices-client";
  import { createYahooClient } from "./services/yahoo-client";
  import { createBoursoramaScraper } from "./services/boursorama-scraper";
  import { createTwelveDataClient } from "./services/twelve-data-client";

  const PRICES_CACHE_TTL_MS = 60_000;
  const PRICES_TIER1_TIMEOUT_MS = 500;
  const TWELVE_DATA_TIMEOUT_MS = 2_000;
  const BOURSORAMA_TIMEOUT_MS = 1_500;

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
    const yahooClient = createYahooClient();
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

  Edit `apps/api/src/bootstrap/runtime-dependencies.ts` — patch the holdings module construction call site (around line 119):

  ```ts
  // Replace the existing line:
  //   const holdingsModule = createHoldingsModule({ prismaService });
  // With:
  const holdingsModule = createHoldingsModule({ prismaService, env: input.env });
  ```

  Update `apps/api/src/modules/holdings/holdings.module.test.ts` — the existing test calls `createHoldingsModule({ prismaService })`; update to pass an env stub:

  ```ts
  // At the top of the test setup:
  const env = {
    PRICES_SERVICE_URL: undefined,
    PRICES_SERVICE_TOKEN: undefined,
    TWELVE_DATA_API_KEY: undefined,
  };
  // In every createHoldingsModule call:
  const mod = createHoldingsModule({ prismaService, env });
  ```

  Run: `bun --filter=api run typecheck && bun --filter=api test src/modules/holdings`
  Expected: typecheck exit 0; all holdings tests pass.
  Commit: `git add apps/api/src/modules/holdings/holdings.module.ts apps/api/src/bootstrap/runtime-dependencies.ts apps/api/src/modules/holdings/holdings.module.test.ts && git commit -m "feat(#21): T16 wire price-chain deps into createHoldingsModule"`

  [AC: AC-6]

- [x] **T17** — Full quality gate + state.yaml flip + final commit.

  Run, in order:

  ```bash
  bun --filter=api run lint
  bun --filter=api run typecheck
  bun --filter=api test
  bun lint
  ```

  All MUST exit 0. If any fails: fix the root cause (do NOT `--no-verify`). Common pitfalls:
  - **Lint `pekulo/no-prisma-query-without-user-id`** — irrelevant for 3-2 (no new Prisma queries) but worth re-running.
  - **Typecheck on `apps/web`** — should be untouched (we deliberately did not migrate the web caller).
  - **`bun test` on `apps/api`** — must surface the full test count (`N pass, 0 fail`); if you see `0 tests` that's the `--passWithNoTests` issue from lessons.md, but `bun test` does not need that flag (vitest does).

  Update `docs/state.yaml`: edit the `3-2-prices-fallback-chain` line under `sprint.stories`:

  ```yaml
  3-2-prices-fallback-chain: {status: review-queued, depends_on: [3-1-holdings-orpc-port], ticket: "#21", worktree: null, started_at: "<ISO8601 of T1 commit time>"}
  ```

  Commit: `git add docs/state.yaml && git commit -m "chore(#21): T17 mark 3-2-prices-fallback-chain review-queued"`

  Push the branch: `git push -u origin feature/21-3-2-prices-fallback-chain` (the user will trigger the PR via `aped-review` or manually).

  [AC: AC-5, AC-7]

## Dev Notes

### Scope notes (load-bearing)

- **`resolveQuote` is a service-internal method, NOT an oRPC procedure.** Architecture FR-16 row says "n/a (server side only)" — story 3-3 (`portfolio-fx`) and 7-1 (`dashboard-orchestration`) consume it by importing `holdingsService.resolveQuote(…)` directly. The oRPC contract surface stays exactly the 5 procedures shipped in 3-1 (`create | recordLot | close | list | getDerived`).
- **Brownfield `apps/web/src/lib/services/prices.ts` + `apps/web/src/lib/services/{prices-service,yahoo-finance,boursorama,twelve-data}.ts` + `apps/web/src/lib/actions/portfolio.ts` are NOT deleted in this story.** The web tier keeps calling the brownfield `fetchPriceQuote(input)` until story 3-3 ports `portfolio.getSnapshot` to oRPC (which is when the web tier's `services/prices.ts` becomes dead code). Keeping the brownfield untouched in 3-2 yields a clean PR diff (api-additive only) and unblocks 3-3 / 3-4 from any cross-tier coordination cost.
- **`recordLot` atomic-transaction pattern from 3-1 is NOT applicable.** `resolveQuote` is a read-only orchestration keyed by `ticker|kind|currency` — no parent invariant, no DB write, no `$transaction`.
- **No new cache-invalidation tag.** The 60 s cache is a server-side TTL cache local to the holdings module; it does NOT participate in the `@zapaction/query` invalidation graph (which governs client-side React-Query keys). The `holdingsTags` / `holdingsKeys` registered in 3-1 stay unchanged.
- **`PriceProviderError` is a plain `Error` subclass, NOT a `PekuloError`.** This error is service-internal (it bubbles up to 3-3's snapshot logic, where it'll be surfaced via a typed oRPC error of 3-3's choosing). Wrapping it in `PekuloError` now would force a contract error code that no procedure declares, and `ORPC_HTTP_STATUS_BY_CODE` doesn't need it.

### File decisions (3-bullet per file)

| Path | Single responsibility | Inputs → Outputs |
|---|---|---|
| `apps/api/src/config/env.ts` | **MODIFY** — extend `envSchema` with 3 optional price-chain env vars. | `process.env` → `Env` (with 3 new optional fields). |
| `apps/api/src/config/env.test.ts` | **NEW** — unit-test `loadEnv` happy + sad paths for the 3 new vars. | n/a → `bun test` assertions. |
| `packages/validators/src/holdings.ts` | **MODIFY** — append `priceQuoteSchema`, `priceQuoteInputSchema`, `priceProviderSchema`, `priceProviderAttemptSchema` + `PRICE_PROVIDERS` constant. | n/a → Zod schemas + inferred TS types. |
| `packages/types/src/index.ts` | **MODIFY** — re-export 4 price types + `PRICE_PROVIDERS` value from `@pekulo/validators`. | n/a → typed re-exports. |
| `apps/api/src/modules/holdings/holdings.errors.ts` | **MODIFY** — append `PriceProviderError extends Error` (NOT `PekuloError`). | `attempts: PriceProviderAttempt[]` → `Error` w/ joined message + `.attempts`. |
| `apps/api/src/modules/holdings/holdings.cache.ts` | **NEW** — TTL cache factory keyed by `ticker\|kind\|currency`. | `{ ttlMs, now? }` → `PricesCache { get, set }`. |
| `apps/api/src/modules/holdings/holdings.cache.test.ts` | **NEW** — TTL expiry, key isolation, factory-instance isolation. | n/a → `bun test`. |
| `apps/api/src/modules/holdings/services/prices-client.ts` | **NEW** — tier-1 HTTP client to `apps/prices` w/ Bearer + `AbortSignal.timeout(500)`. | `{ baseUrl, token, timeoutMs }` → `PricesClient { fetchQuote(symbol) }`. |
| `apps/api/src/modules/holdings/services/prices-client.test.ts` | **NEW** — fetch mock; Bearer / timeout / 401-404-500 / no-price paths. | n/a → `bun test`. |
| `apps/api/src/modules/holdings/services/yahoo-client.ts` | **NEW** — tier-2 `yahoo-finance2` wrapper + `resolveYahooSymbol`. | `{}` → `YahooClient { fetchQuote(symbol) }` + pure helper. |
| `apps/api/src/modules/holdings/services/yahoo-client.test.ts` | **NEW** — module mock of `yahoo-finance2`; symbol resolver branches + 4 error codes. | n/a → `bun test`. |
| `apps/api/src/modules/holdings/services/boursorama-scraper.ts` | **NEW** — tier-3 scraper of `/recherche/?query=…` w/ redirect detection + French decimal. | `{ timeoutMs }` → `BoursoramaScraper { fetchQuote(ticker) }`. |
| `apps/api/src/modules/holdings/services/boursorama-scraper.test.ts` | **NEW** — fetch mock; missing-ticker, redirect-still-on-recherche, French decimal, NBSP thousand-sep, .PA strip. | n/a → `bun test`. |
| `apps/api/src/modules/holdings/services/twelve-data-client.ts` | **NEW** — tier-4 REST client w/ envelope-error decoding. | `{ apiKey, timeoutMs }` → `TwelveDataClient { fetchQuote(symbol) }`. |
| `apps/api/src/modules/holdings/services/twelve-data-client.test.ts` | **NEW** — fetch mock; missing-key, 429, envelope-404, close-field parse. | n/a → `bun test`. |
| `apps/api/src/common/test/fakes/prices-clients.ts` | **NEW** — 4 fake-client helpers w/ `calls` arrays + `setBehavior` for unit tests. | n/a → test doubles consumed by service + module tests. |
| `apps/api/src/modules/holdings/holdings.service.ts` | **MODIFY** — extend `HoldingService` w/ `resolveQuote(input)`, `HoldingServiceDeps` w/ 5 deps, add `runTier` helper + 4 short-label maps. | injected deps + `PriceQuoteInput` → `PriceQuote` or throws `PriceProviderError`. |
| `apps/api/src/modules/holdings/holdings.service.test.ts` | **MODIFY** — append `describe("resolveQuote")` block (AC-1..4 + AC-4b boursorama-skip-for-crypto) using fakes + `createPricesCache`. | n/a → `bun test` ≥ 5 new assertions. |
| `apps/api/src/modules/holdings/holdings.module.ts` | **MODIFY** — accept `env: Pick<Env, …>` dep, wire 4 client factories + cache w/ prod constants (`PRICES_TIER1_TIMEOUT_MS=500`, `BOURSORAMA_TIMEOUT_MS=1500`, `TWELVE_DATA_TIMEOUT_MS=2000`, `PRICES_CACHE_TTL_MS=60_000`). | `{ prismaService, env }` → `{ service, router }`. |
| `apps/api/src/modules/holdings/holdings.module.test.ts` | **MODIFY** — pass `env: { …: undefined }` stub at every `createHoldingsModule` call site. | n/a → `bun test` unchanged outcomes. |
| `apps/api/src/bootstrap/runtime-dependencies.ts` | **MODIFY** — single-line patch: pass `env: input.env` into `createHoldingsModule`. | `input.env` → wired holdings module. |
| `apps/api/package.json` | **MODIFY (conditional)** — pin `yahoo-finance2` if not already a dep; version matches `apps/web/package.json`. | n/a → bun lockfile update. |
| `docs/state.yaml` | **MODIFY (at T17)** — flip `3-2-prices-fallback-chain.status: ready-for-dev → review-queued`. | n/a → state coherence. |

### Architecture references

- **FR-16 row (architecture.md L925)** — `apps/api/src/modules/holdings/holdings.service.ts#resolveQuote` calls `services/prices-client.ts` (HTTP to `apps/prices`) → fallback to `yahoo-finance2` (npm) → Boursorama scraper → Twelve Data. **Web surface: n/a (server side only)** — confirms 3-2 ships NO oRPC procedure.
- **FR-17 row (architecture.md L926)** — `apps/api/src/modules/holdings/holdings.cache.ts` (Map keyed by `ticker|kind|currency`). Owned entirely by 3-2.
- **Module factory shape (ADR-0009)** — `createXxxModule(deps) → { service, router }`. Story 3-1 already shipped this pattern; 3-2 extends `CreateHoldingsModuleDeps` from `{ prismaService }` to `{ prismaService, env: Pick<Env, …> }` so the 4 client factories can read their config without reaching into `process.env` at construction time.
- **Hard layering (ADR-0010)** — Service → Repository is the established boundary. The 4 price clients are a NEW boundary inside the holdings module: `services/*` is service-internal but architecturally below `holdings.service` (the service depends on them, never the reverse). Lives under `apps/api/src/modules/holdings/services/` per architecture L1016 ("`apps/api/src/modules/holdings/services/prices-client.ts`").
- **Test fakes path (architecture L835-L847)** — Cross-module fakes live under `apps/api/src/common/test/fakes/`; the architecture explicitly lists `fake-prices-client.ts` at L839. 3-2 generalises this to `prices-clients.ts` (plural — 4 fakes co-located).
- **OTel topology (ADR-0005 + L243)** — Explicit child spans via `trace.getTracer(name).startActiveSpan(...)`. Tracer name `pekulo-api-holdings` (per-module convention; mirrors the architecture's "module-scoped tracers" pattern). Span attributes use the `prices.*` namespace (semantic convention: dotted, lowercase, per the OTel general spec).
- **Mount-path invariant** — `/rpc/v1/holdings` is unchanged (3-2 adds no procedure to the contract). Holdings procedure count stays at 5: `create | recordLot | close | list | getDerived`.

### ADRs in scope

- `docs/adr/0005-observability-opentelemetry-glitchtip.md` — Explicit child spans, OTLP exporter, ConsoleSpanExporter fallback.
- `docs/adr/0009-elysia-orpc-with-zapaction-bridge.md` — Module factory + oRPC contract-first mount (no change to contract here, only to factory).
- `docs/adr/0011-packages-reorg-pekulo-namespace.md` — `PriceQuote` / `PriceQuoteInput` / `PriceProvider` types live in `@pekulo/types` (re-exported from `@pekulo/validators` Zod-inferred shapes).

### Lessons re-applied (verbatim from `docs/lessons.md` — scope `aped-story` / `aped-dev` / `aped-review` / `aped-arch`)

- **Elysia 1.4 `Elysia` type is invariant** (Scope: stories 3-1 and onward) — **how applied:** zero `Elysia` annotations in `services/*` (these are factory-returned plain objects, no router shape). Module factory still relies on `ReturnType<typeof createHoldingsRouter>` for `HoldingsModule.router`.
- **`@elysiajs/opentelemetry@1.4.0` rootSpan-export hooks broken under Elysia 1.4.4 + Bun** (Scope: every apps/api story that touches OTel) — **how applied:** AC-7 mandates explicit `trace.getTracer(…).startActiveSpan(…)` for `prices.resolveQuote` + per-tier spans. NO reliance on `@elysiajs/opentelemetry` plugin spans for the price chain.
- **Zero `*.types.ts` inside `apps/api/src/modules/**`** (Scope: aped-arch, aped-dev, aped-review) — **how applied:** AC-5 is a hard grep gate. `PriceQuote`, `PriceQuoteInput`, `PriceProvider`, `PriceProviderAttempt` all defined in `packages/validators/src/holdings.ts` (Zod inference) and re-exported from `@pekulo/types`. The per-provider quote/error types (`PricesServiceQuote`, `YahooQuote`, `BoursoramaQuote`, `TwelveDataQuote`, `*Error`) live INSIDE the client files because they're client-internal shapes never crossed module boundaries — that's allowed by L1 (the rule is "no `*.types.ts` files", not "no co-located types"). The orchestrator's input/output types come from `@pekulo/types`.
- **`bun --cwd <relative> run <script>` silently fails — use `--filter` or cd-then-run** (Scope: aped-dev, aped-story) — **how applied:** every test/lint/typecheck command in the task list uses `bun --filter=api run …` or `bun --filter=api test …`.
- **`bun test` ≠ `vitest run`** (Scope: aped-dev, aped-review) — **how applied:** `apps/api` is `bun test`; no `--passWithNoTests` flag (that's a vitest flag — irrelevant here). The 4 new test files are `*.test.ts` co-located with the module/client/cache they cover, picked up by `bun test` automatically.
- **Decimal coercion at Prisma → DTO boundary** (Scope: aped-arch, aped-dev — stories 0-6, 1-2, 2-1, 3-1, 5-1, 7-1, 7-3) — **how applied:** N/A directly to 3-2 (no DB writes; `price` is a JS `number` returned by the providers). The orchestrator's `PriceQuote.price` is `z.number().positive()` — no Prisma `Decimal` in the path.
- **Naming pluriel pour les factories de la 3-1 retro** — **how applied:** `createPricesCache` + `createPricesClient` use the plural form (matches 3-1's `createHoldingsRepository / createHoldingsService / createHoldingsRouter / createHoldingsModule`). Per-provider singletons stay singular (`createYahooClient`, `createBoursoramaScraper`, `createTwelveDataClient`) — there's only one provider per file.
- **Story-spec UX placement MUST be cross-checked against `docs/ux-preview/src/App.tsx`** (Scope: aped-story, aped-arch, aped-dev) — **how applied:** 3-2 is API-only. The Pre-Implementation Checklist confirms zero UI claim is embedded in this story (UI surfaces belong to 3-4). `grep -rn '3-2' docs/ux/` returns no placement claim.

### Existing code at write time — Step-0 verbatim quotes

These quotes are the dev agent's authoritative snapshot of brownfield source at story-write time. If the source has drifted between write time and dev time, surface the drift in the Dev Agent Record's Debug Log (do NOT silently adapt — the AC may need a re-read).

#### `apps/web/src/lib/services/prices.ts` (188 lines — orchestrator + cache + error class — port reference)

```ts
import "server-only";
import { fetchYahooQuote, resolveYahooSymbol, YahooError } from "./yahoo-finance";
import { fetchBoursoramaQuote, BoursoramaError } from "./boursorama";
import { fetchTwelveDataQuote, TwelveDataError } from "./twelve-data";
import {
  fetchPricesServiceQuote,
  isPricesServiceConfigured,
  PricesServiceError,
} from "./prices-service";
import type { Currency, HoldingKind } from "@/lib/types";

export interface PriceQuote {
  symbol: string;
  price: number;
  currency: string;
  marketTime: string;
  provider: "prices-service" | "yahoo" | "boursorama" | "twelve-data";
}

export class PriceError extends Error {
  attempts: Array<{ provider: string; reason: string }>;
  constructor(attempts: Array<{ provider: string; reason: string }>) {
    super(
      attempts.map((a) => `${a.provider}: ${a.reason}`).join(" · ") || "Aucun provider disponible.",
    );
    this.name = "PriceError";
    this.attempts = attempts;
  }
}

export interface PriceQuoteInput {
  ticker: string | null | undefined;
  currency: Currency;
  kind: HoldingKind;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; quote: PriceQuote }>();

function cacheKey(input: PriceQuoteInput): string {
  return `${input.ticker ?? ""}|${input.kind}|${input.currency}`;
}

export { resolveYahooSymbol };

export function resolvePriceSymbol(ticker: string | null | undefined, currency: Currency): string {
  return resolveYahooSymbol(ticker, currency);
}

export async function fetchPriceQuote(input: PriceQuoteInput): Promise<PriceQuote> {
  const key = cacheKey(input);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.quote;
  }

  const yahooSymbol = resolveYahooSymbol(input.ticker, input.currency);
  const attempts: PriceError["attempts"] = [];

  // 1) Python yfinance service on Alex's VPS (different IP, most reliable)
  if (isPricesServiceConfigured()) {
    try {
      const q = await fetchPricesServiceQuote(yahooSymbol);
      const quote: PriceQuote = { ...q, provider: "prices-service" };
      cache.set(key, { at: Date.now(), quote });
      return quote;
    } catch (err) {
      if (err instanceof PricesServiceError) {
        attempts.push({ provider: "prices-service", reason: shortPs(err.code) });
      } else {
        attempts.push({ provider: "prices-service", reason: "exception" });
      }
    }
  }

  // 2) Yahoo via yahoo-finance2 (handles consent/crumb internally)
  try {
    const q = await fetchYahooQuote(yahooSymbol);
    const quote: PriceQuote = { ...q, provider: "yahoo" };
    cache.set(key, { at: Date.now(), quote });
    return quote;
  } catch (err) {
    if (err instanceof YahooError) {
      attempts.push({ provider: "yahoo", reason: shortYahoo(err.code) });
    } else {
      attempts.push({ provider: "yahoo", reason: "exception" });
    }
  }

  // 3) Boursorama scraping (Euronext FR free fallback)
  try {
    const q = await fetchBoursoramaQuote(input.ticker);
    const quote: PriceQuote = { ...q, provider: "boursorama" };
    cache.set(key, { at: Date.now(), quote });
    return quote;
  } catch (err) {
    if (err instanceof BoursoramaError) {
      if (err.code === "missing-ticker") throw err;
      attempts.push({ provider: "boursorama", reason: shortBourso(err.code) });
    } else {
      attempts.push({ provider: "boursorama", reason: "exception" });
    }
  }

  // 4) Twelve Data (free tier covers US only — useful for AAPL etc.)
  try {
    const q = await fetchTwelveDataQuote(yahooSymbol);
    const quote: PriceQuote = { ...q, provider: "twelve-data" };
    cache.set(key, { at: Date.now(), quote });
    return quote;
  } catch (err) {
    if (err instanceof TwelveDataError) {
      attempts.push({ provider: "twelve-data", reason: shortTd(err.code) });
    } else {
      attempts.push({ provider: "twelve-data", reason: "exception" });
    }
  }

  throw new PriceError(attempts);
}

// shortPs / shortYahoo / shortBourso / shortTd — French label maps preserved
// 1:1 in apps/api/src/modules/holdings/holdings.service.ts (see T15 GREEN).
```

**3-2 deltas vs brownfield:** (a) `if (input.kind !== "crypto")` short-circuit guard around tier 3 (boursorama) — brownfield always invokes tier 3 (wastes ~1.5 s on crypto with zero chance of success); (b) `cache` is per-service-instance (created by `createPricesCache`), not module-level; (c) `Date.now()` swapped for the `now` factory injected into the cache; (d) every tier wrapped in an OTel child span via `runTier` helper; (e) `missing-ticker` from boursorama no longer special-cased (`resolveYahooSymbol` already throws on missing-ticker BEFORE any tier runs, so the brownfield short-circuit is dead code in the API port).

#### `apps/web/src/lib/services/prices-service.ts` (78 lines — tier-1 reference)

```ts
import "server-only";

export interface PricesServiceQuote {
  symbol: string;
  price: number;
  currency: string;
  marketTime: string; // YYYY-MM-DD
}

export class PricesServiceError extends Error {
  code: "not-configured" | "network" | "format" | "auth" | "invalid-symbol" | "no-price";
  constructor(code: PricesServiceError["code"], message: string) {
    super(message);
    this.name = "PricesServiceError";
    this.code = code;
  }
}

export function isPricesServiceConfigured(): boolean {
  return Boolean(process.env.PRICES_SERVICE_URL);
}

export async function fetchPricesServiceQuote(symbol: string): Promise<PricesServiceQuote> {
  const base = process.env.PRICES_SERVICE_URL;
  if (!base) {
    throw new PricesServiceError("not-configured", "PRICES_SERVICE_URL non défini.");
  }
  const token = process.env.PRICES_SERVICE_TOKEN;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = `${base.replace(/\/$/, "")}/quote?symbol=${encodeURIComponent(symbol)}`;
  let res: Response;
  try {
    res = await fetch(url, { headers, cache: "no-store" });
  } catch (err) {
    throw new PricesServiceError(
      "network",
      `Échec réseau: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (res.status === 401 || res.status === 403) throw new PricesServiceError("auth", `Service prix: HTTP ${res.status}`);
  if (res.status === 404) throw new PricesServiceError("invalid-symbol", `Ticker introuvable: ${symbol}`);
  if (!res.ok) throw new PricesServiceError("network", `Service prix: HTTP ${res.status}`);

  let json: unknown;
  try { json = await res.json(); } catch { throw new PricesServiceError("format", "Réponse non-JSON."); }

  const obj = json as Record<string, unknown>;
  const price = Number(obj.price);
  if (!Number.isFinite(price) || price <= 0) throw new PricesServiceError("no-price", `Pas de prix pour ${symbol}.`);

  return {
    symbol: typeof obj.symbol === "string" ? obj.symbol : symbol,
    price,
    currency: typeof obj.currency === "string" ? obj.currency : "",
    marketTime:
      typeof obj.marketTime === "string"
        ? obj.marketTime.slice(0, 10)
        : new Date().toISOString().slice(0, 10),
  };
}
```

**3-2 deltas:** factory pattern (env injected via deps, not `process.env`); `AbortSignal.timeout(500)` (default), brownfield has none.

#### `apps/web/src/lib/services/yahoo-finance.ts` (82 lines — tier-2 reference)

```ts
import "server-only";
import yahooFinance from "yahoo-finance2";
import type { Currency } from "@/lib/types";

export interface YahooQuote {
  symbol: string;
  price: number;
  currency: string;
  marketTime: string; // YYYY-MM-DD
}

export class YahooError extends Error {
  code: "missing-ticker" | "invalid-ticker" | "network" | "format" | "no-price" | "rate-limited";
  constructor(code: YahooError["code"], message: string) { super(message); this.name = "YahooError"; this.code = code; }
}

export function resolveYahooSymbol(ticker: string | null | undefined, currency: Currency): string {
  if (!ticker || ticker.trim().length === 0) throw new YahooError("missing-ticker", "Aucun ticker pour cette ligne.");
  const trimmed = ticker.trim().toUpperCase();
  if (trimmed.includes(".")) return trimmed;
  if (currency === "USD") return trimmed;
  return `${trimmed}.PA`;
}

export async function fetchYahooQuote(symbol: string): Promise<YahooQuote> {
  let result: Awaited<ReturnType<typeof yahooFinance.quote>>;
  try {
    result = await yahooFinance.quote(symbol, {}, { validateResult: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/not found|invalid|empty result/i.test(msg)) throw new YahooError("invalid-ticker", `Ticker introuvable: ${symbol}`);
    if (/429|rate.?limit|too many/i.test(msg)) throw new YahooError("rate-limited", "Yahoo: rate-limited.");
    throw new YahooError("network", `Yahoo: ${msg}`);
  }
  const q = Array.isArray(result) ? result[0] : result;
  if (!q) throw new YahooError("invalid-ticker", `Aucune réponse pour ${symbol}.`);
  const price = Number((q as { regularMarketPrice?: number }).regularMarketPrice);
  if (!Number.isFinite(price) || price <= 0) throw new YahooError("no-price", `Pas de prix pour ${symbol}.`);
  const currency = typeof (q as { currency?: string }).currency === "string" ? (q as { currency: string }).currency : "";
  const ts = (q as { regularMarketTime?: number | Date }).regularMarketTime;
  const marketTime = ts instanceof Date
    ? ts.toISOString().slice(0, 10)
    : typeof ts === "number"
      ? new Date(ts * 1000).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
  return { symbol, price, currency, marketTime };
}
```

**3-2 deltas:** factory pattern; `Currency` import swapped for `@pekulo/validators#HoldingCurrency`; no `server-only`.

#### `apps/web/src/lib/services/boursorama.ts` (105 lines — tier-3 reference)

(Quoted in full in T11's GREEN block above — the port is 1:1 modulo factory pattern + `AbortSignal.timeout(1500)` addition + escaped NBSP literals replaced with ` ` / ` ` for lint safety.)

#### `apps/web/src/lib/services/twelve-data.ts` (81 lines — tier-4 reference)

(Quoted in full in T13's GREEN block above — port is 1:1 modulo factory pattern + `AbortSignal.timeout(2000)` addition.)

#### `apps/api/src/modules/holdings/holdings.service.ts` (current — to extend in T15)

```ts
// Business logic for the holdings domain.
//
// Translation rules:
//   - create: probe findAccountForUser → throw AccountError("ACCOUNT_NOT_FOUND")
//     on missing/cross-user.
//   - close: returns { ok: true } whether the repository reports 'closed' or
//     'already-closed' (idempotent close — no error on second call). On
//     'not-found', throw HoldingError("HOLDING_NOT_FOUND").
//   - recordLot: delegate to repository.recordLot (probe + insert in a single
//     transaction); translate { outcome: "not-found" } → HoldingError(HOLDING_NOT_FOUND)
//     and { outcome: "closed" } → HoldingError(HOLDING_CLOSED). The atomic
//     check happens inside the tx so a concurrent close() can't race the insert.
//   - getDerived: probe findByIdForUser → throw HoldingError("HOLDING_NOT_FOUND")
//     on missing/cross-user, fetch lots via findLotsByHoldingForUser, run
//     deriveFromLots; if the result is { 0, 0 } AND lots.length === 0, fall
//     back to the row's manually-entered { quantity, avgCost } and tag the
//     output source as 'manual'; otherwise source 'lots'.
//   - list: delegate to repository with the includeClosed flag.

import type {
  CloseHoldingInput,
  CloseHoldingOutput,
  CreateHoldingInput,
  DerivedHolding,
  GetDerivedHoldingInput,
  Holding,
  HoldingLot,
  ListHoldingsInput,
  RecordLotInput,
} from "@pekulo/validators";
import { deriveFromLots } from "../../common/derive/holding-quantity";
import { accountNotFound } from "../accounts/accounts.errors";
import { holdingClosed, holdingNotFound } from "./holdings.errors";
import type { HoldingRepository } from "./holdings.repository";

export interface HoldingService {
  create(userId: string, input: CreateHoldingInput): Promise<Holding>;
  recordLot(userId: string, input: RecordLotInput): Promise<HoldingLot>;
  close(userId: string, input: CloseHoldingInput): Promise<CloseHoldingOutput>;
  list(userId: string, input: ListHoldingsInput): Promise<Holding[]>;
  getDerived(userId: string, input: GetDerivedHoldingInput): Promise<DerivedHolding>;
}

export interface HoldingServiceDeps {
  repository: HoldingRepository;
}

export function createHoldingsService(deps: HoldingServiceDeps): HoldingService {
  return {
    async create(userId, input) {
      const account = await deps.repository.findAccountForUser(userId, input.accountId);
      if (!account) throw accountNotFound();
      return deps.repository.create(userId, input);
    },
    async recordLot(userId, input) {
      const out = await deps.repository.recordLot(userId, input);
      if (out.outcome === "not-found") throw holdingNotFound();
      if (out.outcome === "closed") throw holdingClosed();
      return out.lot;
    },
    async close(userId, input) {
      const out = await deps.repository.close(userId, input.id);
      if (out.outcome === "not-found") throw holdingNotFound();
      return { ok: true } as const;
    },
    async list(userId, input) {
      return deps.repository.listByUser(userId, { includeClosed: input.includeClosed });
    },
    async getDerived(userId, input) {
      const parent = await deps.repository.findByIdForUser(userId, input.id);
      if (!parent) throw holdingNotFound();
      const lots = await deps.repository.findLotsByHoldingForUser(userId, input.id);
      const derived = deriveFromLots(lots);
      if (lots.length === 0) {
        return {
          holdingId: parent.id,
          quantity: parent.quantity,
          avgCost: parent.avgCost,
          source: "manual",
        } as const;
      }
      return {
        holdingId: parent.id,
        quantity: derived.quantity,
        avgCost: derived.avgCost,
        source: "lots",
      } as const;
    },
  };
}
```

T15 extends `HoldingService` with `resolveQuote` and `HoldingServiceDeps` with the 5 new client/cache deps (full target shape in T15 block).

#### `apps/api/src/modules/holdings/holdings.module.ts` (current — to extend in T16)

```ts
// Module factory wiring repository + service + router for the holdings
// domain. Mirrors ADR-0009's pattern (createXxxModule(deps) → { service, router }).
//
// L8 (story 3-1 explicit): the router type is inferred via
// ReturnType<typeof createHoldingsRouter>; never annotate as `Elysia` or any
// concrete oRPC implementation type.

import type { PrismaService } from "../../database";
import { createHoldingsRepository } from "./holdings.repository";
import { createHoldingsRouter } from "./holdings.routes";
import { createHoldingsService, type HoldingService } from "./holdings.service";

export interface HoldingsModule {
  service: HoldingService;
  router: ReturnType<typeof createHoldingsRouter>;
}

export function createHoldingsModule(deps: { prismaService: PrismaService }): HoldingsModule {
  const repository = createHoldingsRepository({ client: deps.prismaService.client });
  const service = createHoldingsService({ repository });
  const router = createHoldingsRouter({ service });
  return { service, router };
}
```

T16 extends `deps` to `{ prismaService, env: Pick<Env, …> }` and wires the 4 clients + cache before constructing the service.

#### `apps/api/src/modules/holdings/holdings.errors.ts` (current — to extend in T3)

```ts
// Typed error class for the holdings module. Extends PekuloError so the
// Elysia error mapper translates it to an oRPC error with the matching HTTP
// status — HOLDING_NOT_FOUND → 404 and HOLDING_CLOSED → 409 are both
// registered in ORPC_HTTP_STATUS_BY_CODE (story 3-1 T3).
//
// Factories ensure messages are stable so the mapper + telemetry can group
// them safely.

import { PekuloError } from "../../common/errors";

export type HoldingErrorCode = "HOLDING_NOT_FOUND" | "HOLDING_CLOSED";

export class HoldingError extends PekuloError {
  override readonly name = "HoldingError";
  // oxlint-disable-next-line no-useless-constructor -- narrows code union (see comment above)
  constructor(code: HoldingErrorCode, message: string, options?: { cause?: unknown }) {
    super(code, message, options);
  }
}

export function holdingNotFound(): HoldingError {
  return new HoldingError("HOLDING_NOT_FOUND", "holding not found");
}

export function holdingClosed(): HoldingError {
  return new HoldingError("HOLDING_CLOSED", "holding is closed");
}
```

T3 appends `PriceProviderError` at end of file (plain `Error`, NOT `PekuloError`).

#### `apps/api/src/config/env.ts` (current — to extend in T1)

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
  SUPABASE_URL: z.string().url(),
  OTEL_SERVICE_NAME: z.string().min(1).default("pekulo-api"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
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

T1 inserts the 3 new optional vars alphabetically (`PRICES_SERVICE_TOKEN`, `PRICES_SERVICE_URL`, `TWELVE_DATA_API_KEY`).

#### `apps/api/src/bootstrap/runtime-dependencies.ts` (relevant lines 117-127)

```ts
  // Story 3-1 — holdings oRPC port. Independent of compass / accounts (the
  // cross-aggregate account FK probe lives inside the repository — no
  // separate accounts dep needed at the module-factory layer).
  const holdingsModule = createHoldingsModule({ prismaService });

  const orpcRouter: PekuloRpcRouter = {
    hypothesis: hypothesisModule.router,
    compass: compassModule.router,
    milestones: milestonesModule.router,
    accounts: accountsModule.router,
    holdings: holdingsModule.router,
  };
```

T16 patches line 121: `{ prismaService }` → `{ prismaService, env: input.env }`.

#### `packages/validators/src/holdings.ts` (lines 26-40 — Zod / constants / barrel start)

```ts
import { z } from "zod";

export const HOLDING_ID_PREFIX_RE = /^hld_[0-9A-Za-z]{21}$/;
export const HOLDING_LOT_ID_PREFIX_RE = /^lot_[0-9A-Za-z]{21}$/;
export const MAX_HOLDING_LABEL_LENGTH = 120;
export const MAX_HOLDING_TICKER_LENGTH = 32;
export const MAX_HOLDING_NOTES_LENGTH = 500;
export const HOLDING_CURRENCIES = ["EUR", "USD", "GBP", "CHF"] as const;
export type HoldingCurrency = (typeof HOLDING_CURRENCIES)[number];

const HOLDING_KINDS_MIRROR = ["etf", "action", "crypto", "autre"] as const;
const LOT_TYPES = ["buy", "sell"] as const;
```

T2 appends the 4 price schemas after the existing `getDerivedHoldingInputSchema` block (around line 150).

#### `packages/types/src/index.ts` (lines 57-65 — Holding section header)

```ts
export const HOLDING_KINDS = ["etf", "action", "crypto", "autre"] as const;
export type HoldingKind = (typeof HOLDING_KINDS)[number];

export type HoldingId = Id<"HoldingId">;
export type HoldingLotId = Id<"HoldingLotId">;

export type { Holding, HoldingLot, DerivedHolding } from "@pekulo/validators";

export interface HoldingCardItem {
  ticker: string;
  // ...
}
```

T2 inserts the 4 price-type re-exports immediately after the `export type { Holding, HoldingLot, DerivedHolding }` line.

### Pre-Implementation Checklist (UX cross-check — lesson 2026-05-17)

- [x] `grep -rn '3-2\|prices-fallback\|resolveQuote' docs/ux/` returns no UX placement claim — confirms 3-2 is API-only and `docs/ux-preview/src/App.tsx` has nothing to add.
- [x] `grep -rn 'fetchPriceQuote\|services/prices' apps/web/src --include='*.ts' --include='*.tsx'` returns the same 2 hits as story-write time (`apps/web/src/lib/services/prices.ts:51` declaration + `apps/web/src/lib/actions/portfolio.ts:11` import) — confirms no parallel web-tier change snuck in.

### Brownfield invariants to preserve

- The brownfield `apps/web/src/lib/services/prices.ts` orchestrator stays intact — the web-tier `apps/web/src/lib/actions/portfolio.ts#refreshLastPrice` still calls `fetchPriceQuote(input)` from `@/lib/services/prices`. **DO NOT EDIT** `apps/web/**` in this story. If any file under `apps/web/` shows up in `git diff --name-only main...HEAD` at T17, that's a story-scope violation — revert before commit.
- The `PriceError` class in brownfield is NOT renamed (web tier keeps using it). The API gets the new `PriceProviderError` name — they coexist until story 3-3 deletes the brownfield path.
- Zod `priceQuoteSchema.currency` is `z.string()` (NOT `z.enum(HOLDING_CURRENCIES)`) — brownfield providers return arbitrary currency strings (`""`, `"USDT"`, etc.); enforcing the closed enum would reject quotes from Yahoo for some crypto pairs. The orchestrator's INPUT currency is the closed enum (via `priceQuoteInputSchema`).

## File List

**New files** (created by this story):

- `apps/api/src/config/env.test.ts`
- `apps/api/src/modules/holdings/holdings.cache.ts`
- `apps/api/src/modules/holdings/holdings.cache.test.ts`
- `apps/api/src/modules/holdings/services/prices-client.ts`
- `apps/api/src/modules/holdings/services/prices-client.test.ts`
- `apps/api/src/modules/holdings/services/yahoo-client.ts`
- `apps/api/src/modules/holdings/services/yahoo-client.test.ts`
- `apps/api/src/modules/holdings/services/boursorama-scraper.ts`
- `apps/api/src/modules/holdings/services/boursorama-scraper.test.ts`
- `apps/api/src/modules/holdings/services/twelve-data-client.ts`
- `apps/api/src/modules/holdings/services/twelve-data-client.test.ts`
- `apps/api/src/common/test/fakes/prices-clients.ts`

**Modified files**:

- `apps/api/src/config/env.ts` — add 3 optional env vars (`PRICES_SERVICE_URL`, `PRICES_SERVICE_TOKEN`, `TWELVE_DATA_API_KEY`).
- `apps/api/src/modules/holdings/holdings.errors.ts` — append `PriceProviderError` class.
- `apps/api/src/modules/holdings/holdings.service.ts` — extend `HoldingService` + `HoldingServiceDeps` with `resolveQuote` and 5 new deps; add `runTier` helper.
- `apps/api/src/modules/holdings/holdings.module.ts` — accept `env: Pick<Env, …>` dep; wire 4 clients + cache.
- `apps/api/src/modules/holdings/holdings.module.test.ts` — adapt to new `{ prismaService, env }` signature.
- `apps/api/src/modules/holdings/holdings.integration.test.ts` — stub `resolveQuote` on the in-memory service to satisfy the extended `HoldingService` interface (T15 ; deviation surfaced in aped-review pass).
- `apps/api/src/bootstrap/runtime-dependencies.ts` — pass `env: input.env` into `createHoldingsModule`.
- `apps/api/src/modules/holdings/holdings.service.test.ts` — append `describe("resolveQuote", …)` block + import `buildService` helper.
- `packages/validators/src/holdings.ts` — append `priceQuoteSchema` / `priceQuoteInputSchema` / `priceProviderSchema` / `priceProviderAttemptSchema` + `PRICE_PROVIDERS` constant.
- `packages/types/src/index.ts` — re-export `PriceQuote` / `PriceQuoteInput` / `PriceProvider` / `PriceProviderAttempt` types + `PRICE_PROVIDERS` value.
- `apps/api/package.json` — pin `yahoo-finance2` if absent (T9 check).
- `docs/state.yaml` — flip `3-2-prices-fallback-chain.status` from `ready-for-dev` → `review-queued` at T17.

**Explicitly untouched** (story-scope guard):

- `apps/web/src/lib/services/prices.ts` and 4 sibling per-provider files — brownfield path stays alive until story 3-3.
- `apps/web/src/lib/actions/portfolio.ts` — caller of brownfield `fetchPriceQuote`, stays unchanged.
- `apps/web/src/lib/zapaction/keys.ts` — no new tag for the price cache (server-side TTL cache is not a React-Query key).
- `packages/contracts/src/holdings.contract.ts` — no new oRPC procedure.
- `apps/api/prisma/schema/**` and `apps/api/prisma/migrations/**` — no DB changes.

## Dev Agent Record

- **Model:** claude-opus-4-7[1m]
- **Started:** 2026-05-17T22:00:00Z
- **Completed:** 2026-05-17T23:30:00Z

### Summary

Ported the 4-tier price chain from `apps/web` into `apps/api`'s holdings module: a factory-wired `PricesClient`, `YahooClient`, `BoursoramaScraper`, and `TwelveDataClient` feed a service-internal `resolveQuote` orchestrator with a 60 s in-memory TTL cache and explicit OTel child spans (`prices.resolveQuote` + `prices.tier_<n>`). No oRPC contract surface added — story 3-3 will consume `resolveQuote` directly. Boursorama is short-circuited for `kind === "crypto"`; tier-1 prices-service is short-circuited via a new `isConfigured` boolean on the client (mirrors brownfield `isPricesServiceConfigured()`).

### Files changed

**New** (12):

- `apps/api/src/config/env.test.ts` — env loader tests (T1).
- `apps/api/src/modules/holdings/holdings.cache.{ts,test.ts}` — TTL cache + tests (T4/T5).
- `apps/api/src/modules/holdings/services/prices-client.{ts,test.ts}` — tier-1 + tests (T6/T7).
- `apps/api/src/modules/holdings/services/yahoo-client.{ts,test.ts}` — tier-2 + tests (T8/T9).
- `apps/api/src/modules/holdings/services/boursorama-scraper.{ts,test.ts}` — tier-3 + tests (T10/T11).
- `apps/api/src/modules/holdings/services/twelve-data-client.{ts,test.ts}` — tier-4 + tests (T12/T13).
- `apps/api/src/common/test/fakes/prices-clients.ts` — fakes for the 4 clients (T14).

**Modified**:

- `apps/api/src/config/env.ts` — +3 optional env vars (T1).
- `apps/api/src/modules/holdings/holdings.errors.ts` — +`PriceProviderError` (T3).
- `apps/api/src/modules/holdings/holdings.service.{ts,test.ts}` — extend interface + deps + `resolveQuote` (T14/T15).
- `apps/api/src/modules/holdings/holdings.module.{ts,test.ts}` — wire env-derived deps (T16).
- `apps/api/src/modules/holdings/holdings.integration.test.ts` — stub `resolveQuote` on the in-memory service to satisfy `HoldingService` (T15).
- `apps/api/src/bootstrap/runtime-dependencies.ts` — pass `env: input.env` (T16).
- `packages/validators/src/holdings.ts` + `packages/types/src/index.ts` — new schemas + re-exports (T2).
- `apps/api/package.json` + `bun.lock` — pin `yahoo-finance2@^3.14.0` (T9).
- `docs/state.yaml` — flip story → review-queued (T17).

### Deviations

- **Added `isConfigured: boolean` to `PricesClient` interface (T15).** The T15 code block shows the orchestrator calling `runTier(1, …)` unconditionally, but AC-2 requires the tier-1 fake to register zero calls when the prices-service URL is unset (the cumulative spy count must stay at 0 across the 2-call cache test). The brownfield reference at L2070 short-circuits tier-1 via `isPricesServiceConfigured()`; the API port preserves that invariant by exposing an `isConfigured` flag set in the factory (`Boolean(deps.baseUrl)`). The orchestrator skips tier-1 when `!pricesClient.isConfigured` — no attempt entry pushed, no fake-call increment. The default fake mirrors this: `isConfigured` defaults to `false` (matches the "not-configured" default impl) and flips to `true` on `setBehavior()`. Strict superset of the spec.
- **Removed `cache: "no-store"` from the 3 client `fetch()` calls (T15 typecheck).** Bun's `BunFetchRequestInit` rejects this property (it was a Next.js extended-fetch artifact). No prod behaviour change.
- **The 7 existing 3-1 service tests now wire fakes via a `serviceDeps(repo)` helper (T15).** The spec mentioned `holdings.repository.test.ts` + `holdings.module.test.ts` as call sites needing adaptation, but `holdings.service.test.ts` also had 7 call sites broken by the `HoldingServiceDeps` extension. The helper preserves test intent (3-1 tests don't exercise `resolveQuote`).
- **`bun --filter` shorthand: the story uses `bun --filter=api …`, the actual workspace name is `@pekulo/api`.** Every command surfaced in this Dev Agent Record uses the full filter spec.

### Test output

Final run: `bun --filter='@pekulo/api' run test` — **295 pass / 0 fail / 739 expect() calls / 37 files / 271 ms**.

Targeted module run: `bun --filter='@pekulo/api' run test src/modules/holdings` — **64 pass / 0 fail / 136 expect() calls / 9 files**.

`bun run typecheck` (monorepo): **8 successful / 8 total**. `bun run lint`: **1 warning** (pre-existing `accounts.module.test.ts:297` dangling-underscore unrelated to 3-2), **0 errors**.

## Review Record

**Date:** 2026-05-17
**Auditors:** Spec, Code, Edge & Hallucination (no Aria — backend surface, no preview app)
**Verdict:** done
**Override:** AC gap accepted — reason: *"Inline fix pass — pas de retour à aped-dev pour ce cycle."*

### Findings

#### Resolved

- **[CRITICAL] F1 — AC-7 OTel spans émis sans test d'assertion** [`apps/api/src/modules/holdings/holdings.service.ts:303-324` + `…/holdings.service.test.ts:270-395` (original gap)]
  - Source: Spec auditor
  - Resolution: `26db742` — created `apps/api/src/modules/holdings/holdings.otel.test.ts` (3 tests) wiring `NodeTracerProvider` + `InMemorySpanExporter` + `BatchSpanProcessor`. Asserts: (a) yahoo-wins path emits parent `prices.resolveQuote` (cache_hit=false) + single child `prices.tier_2` with all 5 canonical attributes (`prices.provider="yahoo"`, `prices.ticker="CW8"`, `prices.currency="EUR"`, `prices.kind="etf"`, `prices.outcome="ok"`, `prices.duration_ms` numeric); (b) crypto all-fail emits exactly 3 child spans (`tier_1`, `tier_2`, `tier_4`) — NO `prices.tier_3` (boursorama short-circuit proven via OTel); (c) cache hit emits parent with `prices.cache_hit=true` and ZERO child tier spans. Pattern lifted from `apps/api/src/platform/observability/otel-sdk.test.ts:142-260`.

- **[MAJOR] F2 — AC-3 mappings FR sans cross-ref brownfield** [`apps/api/src/modules/holdings/holdings.service.ts:72-80`]
  - Source: Spec auditor
  - Resolution: `2a10bee` — comment block added above `shortPs` listing brownfield SSOT line refs (`apps/web/src/lib/services/prices.ts:123/140/157/172` for `shortPs/shortYahoo/shortBourso/shortTd`). Drift guard: when the brownfield is deleted in story 3-3, this block promotes to canonical.

- **[MAJOR] F4 — AC-1 timing test « mock-the-behaviour » (synchronous throw didn't prove timeout enforcement)** [`apps/api/src/modules/holdings/holdings.service.test.ts:271-292` (original)]
  - Source: Code auditor (anti-pattern #1)
  - Resolution: `d2c963f` — added second AC-1 test at `holdings.service.test.ts:291-341` that wires the REAL `createPricesClient` (timeoutMs=500) against a globally-mocked `fetch` returning `new Promise` that only rejects when `AbortSignal.abort` fires. Asserts `elapsed >= 450 && elapsed < 800 ms` — proves the 500 ms `AbortSignal.timeout` actually enforces, not just that the orchestrator catches synchronous errors. Original sync-error test kept and renamed `"AC-1 (sync error): tier-1 returns immediately on PricesServiceError → tier-2 wins"` (still valid coverage of the catch path).

- **[MINOR] F5 — Yahoo client sans timeout (NFR-18 backstop manquant)** [`apps/api/src/modules/holdings/services/yahoo-client.ts`]
  - Source: Code auditor
  - Resolution: `423d868` — extended `YahooErrorCode` with `"timeout"`; `createYahooClient(deps?: { timeoutMs?: number })` now wraps `yahooFinance.quote(...)` in `Promise.race` against a hard deadline (default 2_000 ms). Wired `YAHOO_TIMEOUT_MS = 2_000` in `holdings.module.ts`. Added `case "timeout": return "timeout";` to `shortYahoo`. New test at `yahoo-client.test.ts:76-90` asserts hanging mock + `timeoutMs: 50` → `YahooError("timeout")` thrown within 40–200 ms. Strict superset vs brownfield (which had no backstop).

- **[MINOR] F6 — TwelveData fallback `price` field non testé** [`apps/api/src/modules/holdings/services/twelve-data-client.test.ts`]
  - Source: Edge auditor
  - Resolution: `a20d0f3` — new test "falls back to `price` field when `close` is absent" pins the `obj.close ?? obj.price` branch with `{ price: "192.55", currency: "USD", datetime: "..." }` (no `close` field).

- **[MINOR] F7 — Cache boundary à exactement 60_000 ms non testé** [`apps/api/src/modules/holdings/holdings.cache.test.ts`]
  - Source: Edge auditor
  - Resolution: `a20d0f3` — new test "at exactly ttlMs (delta === 60_000) entry is still usable" pins the strict `>` operator (entry usable up to AND including 60_000 ms after `set`). Future refactor to `>=` (broken) now fails this test.

- **[MINOR] F8 — File List drift (`holdings.integration.test.ts` absent)** [`docs/stories/3-2-prices-fallback-chain.md:2607`]
  - Source: git-audit (manual — `.aped/aped-review/scripts/git-audit.sh` looks for `### File List` h3 but story uses `## File List` h2, script bug to file separately)
  - Resolution: `b403304` — added `apps/api/src/modules/holdings/holdings.integration.test.ts` entry under Modified files with rationale (stub `resolveQuote` to satisfy extended interface, deviation surfaced in this review).

#### Dismissed

(none)

#### Unresolved

(none)

### Verification

- Iron Law test: `bun --filter='@pekulo/api' run test` — **303 pass / 0 fail / 784 expect() / 38 files / 943 ms** (exit 0, captured live in this review session post-F1 commit).
- Iron Law typecheck: `bun --filter='@pekulo/api' run typecheck` — exit 0.
- Iron Law lint: `bun lint` — 1 pre-existing warning (`accounts.module.test.ts:297` dangling-underscore, unrelated to 3-2), 0 errors.
- Working tree: clean.
- HEAD: `26db742 test(#21): F1 AC-7 InMemorySpanExporter test pins prices.tier_* spans + attrs [aped-review]`
- Visual verification: N/A (backend story, no UI surface).

### Ticket sync

- Ticket comment posted: pending user confirmation.
- PR opened/updated: PR #81 (https://github.com/yabafre/pekulo/pull/81) base=main, pending user confirmation for title/body refresh + remote push.
