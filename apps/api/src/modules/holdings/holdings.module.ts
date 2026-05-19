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
