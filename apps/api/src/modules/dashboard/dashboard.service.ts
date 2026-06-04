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
