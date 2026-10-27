// apps/api/src/modules/advisory/advisory-analysis.service.ts
// Orchestration for the deterministic advisory snapshot (story 12-2).
//
// Responsibilities:
//   - read the existing domain ports (accounts, holdings, real estate,
//     compass, monthly) through narrow injected functions;
//   - enrich holdings with live prices and FX through the shared helpers;
//   - hand a complete, immutable input to the pure engine.
//
// The service deliberately owns no access check: every route in
// advisory.routes.ts is already behind the 12-1 gate middleware, and 12-3
// must call this service only from that gated flow (AC-4).

import type { AdvisorySnapshot } from "@pekulo/types";
import type {
  Account,
  FxRates,
  GetMonthlyInput,
  GetMonthlyOutput,
  Holding,
  HoldingCurrency,
  PriceQuote,
  PriceQuoteInput,
  RealEstate,
  TotalEquityOutput,
} from "@pekulo/validators";
import {
  computeAdvisorySnapshot,
  type AdvisorySnapshotInput,
} from "../../common/derive/advisory-snapshot";
import { createFxRatesReader } from "../../common/market-data/fx-rates-reader";
import { priceHoldings } from "../../common/market-data/price-holdings";

export interface AdvisoryAnalysisPorts {
  listAccounts: (userId: string) => Promise<Account[]>;
  listHoldings: (userId: string) => Promise<Holding[]>;
  resolveQuote: (input: PriceQuoteInput) => Promise<PriceQuote>;
  getRates: (base: HoldingCurrency) => Promise<FxRates>;
  getTotalEquity: (userId: string) => Promise<TotalEquityOutput>;
  listProperties: (userId: string) => Promise<RealEstate[]>;
  getCompass: (userId: string) => Promise<{ objectif: number } | null>;
  getMonthly: (userId: string, input: GetMonthlyInput) => Promise<GetMonthlyOutput>;
  /** Optional clock seam — tests pin the current month deterministically. */
  clock?: () => Date;
  /** Optional FX warn sink — tests assert the cold-start log without a global spy. */
  warn?: (message: string) => void;
}

export interface AdvisoryAnalysisService {
  getSnapshot(userId: string): Promise<AdvisorySnapshot>;
}

export function createAdvisoryAnalysisService(
  deps: AdvisoryAnalysisPorts,
): AdvisoryAnalysisService {
  const fxRates = createFxRatesReader({ getRates: deps.getRates, warn: deps.warn });
  const clock = deps.clock ?? (() => new Date());

  return {
    async getSnapshot(userId) {
      const now = clock();
      const period: GetMonthlyInput = {
        year: now.getUTCFullYear(),
        monthNum: now.getUTCMonth() + 1,
      };

      const [accounts, holdings, fx, equity, properties, compass, monthly] = await Promise.all([
        deps.listAccounts(userId),
        deps.listHoldings(userId),
        // FX is best-effort (NFR-19) but never a silent 1:1: the reader
        // serves last-known-good rates ("stale") or marks a cold outage
        // "unavailable" and logs it. fx.read never throws.
        fxRates.read("EUR"),
        deps.getTotalEquity(userId),
        deps.listProperties(userId),
        // The compass is optional: a read failure degrades to "no compass"
        // rather than 500-ing the whole snapshot. The wealth-bearing reads
        // above intentionally have NO catch — a failed accounts/holdings/
        // equity read MUST surface (finance correctness > availability).
        deps.getCompass(userId).catch(() => null),
        deps.getMonthly(userId, period),
      ]);

      const priced = await priceHoldings(holdings, { resolveQuote: deps.resolveQuote });
      const input: AdvisorySnapshotInput = {
        accounts,
        holdings: priced,
        rates: fx.rates,
        fxSource: fx.source,
        equity,
        properties,
        compass,
        monthly,
      };

      return computeAdvisorySnapshot(input);
    },
  };
}
