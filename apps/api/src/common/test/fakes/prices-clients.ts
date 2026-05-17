// Fake clients + cache for the price chain (story 3-2). Used by
// holdings.service.test.ts and holdings.module.test.ts.
//
// Each fake exposes a `calls` array for assertion (number of invocations,
// last symbol argument). Default behaviour is to throw the typed
// "not-configured" / equivalent error so tests can opt-in by overriding
// via `setBehavior(...)`.

import {
  PricesServiceError,
  type PricesClient,
} from "../../../modules/holdings/services/prices-client";
import { YahooError, type YahooClient } from "../../../modules/holdings/services/yahoo-client";
import {
  BoursoramaError,
  type BoursoramaScraper,
} from "../../../modules/holdings/services/boursorama-scraper";
import {
  TwelveDataError,
  type TwelveDataClient,
} from "../../../modules/holdings/services/twelve-data-client";

export interface FakeClient<C extends { fetchQuote: (arg: never) => Promise<unknown> }> {
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
  return {
    client,
    calls,
    setBehavior: (next) => {
      impl = next;
    },
  };
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
  return {
    client,
    calls,
    setBehavior: (next) => {
      impl = next;
    },
  };
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
  return {
    client,
    calls,
    setBehavior: (next) => {
      impl = next;
    },
  };
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
  return {
    client,
    calls,
    setBehavior: (next) => {
      impl = next;
    },
  };
}
