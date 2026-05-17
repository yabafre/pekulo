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
