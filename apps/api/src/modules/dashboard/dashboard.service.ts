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
import { computeMonthlyGap, computeRequiredCurve } from "../../common/derive/hypothesis-gap";
import { createFxRatesReader } from "../../common/market-data/fx-rates-reader";
import { priceHoldings } from "../../common/market-data/price-holdings";
import type { HypothesisGap, HypothesisProjection } from "@pekulo/types";
import type {
  ComputeProgressInput,
  ComputeProgressOutput,
} from "../../common/derive/compass-progress";
import type {
  Account,
  DashboardActivity,
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
  // story 7-2 D3 — last N confirmed activity rows, already shaped to the
  // dashboard activity DTO (account label resolved, direction/amount mapped).
  listRecentActivity: (userId: string, limit: number) => Promise<DashboardActivity[]>;
  // Story 7-4 (FR-59) — the 7-3 hypothesis projection read, injected as a port
  // so the dashboard composes the gap WITHOUT a dashboard↔hypothesis cycle: the
  // caller passes currentWealthEur (the overview investable wealth), exactly as
  // getProjection takes it (7-3 decoupling).
  getHypothesisProjection: (
    userId: string,
    currentWealthEur: number,
  ) => Promise<HypothesisProjection>;
}

export interface DashboardService {
  getOverview(userId: string): Promise<DashboardOverview>;
  getHypothesisGap(userId: string, currentWealthEur: number): Promise<HypothesisGap | null>;
}

export function createDashboardService(deps: DashboardPorts): DashboardService {
  // FX read with a last-known-good in-memory cache (created ONCE per service so
  // the cache survives across getOverview calls). This kills the brownfield
  // silent 1:1 fallback: a provider outage now serves the last live rates with
  // source "stale", or (cold start) converts 1:1 with an EXPLICIT "unavailable"
  // source + a warn log — never a silent 8 % USD over-report.
  const fxRates = createFxRatesReader({ getRates: deps.getRates });

  return {
    async getOverview(userId) {
      const [accounts, holdings, fx, equity, compassRow, recentActivity] = await Promise.all([
        deps.listAccounts(userId),
        deps.listHoldings(userId),
        // FX is best-effort (NFR-19) but NEVER a silent 1:1: the reader serves
        // last-known-good rates ("stale") on a provider outage, or marks the
        // cold-start outage "unavailable" + logs it. fx.read never throws.
        fxRates.read("EUR"),
        deps.getTotalEquity(userId),
        // The compass is optional (the schema is .nullable()): a read failure
        // degrades to "no compass" rather than 500-ing the whole overview. The
        // three wealth-bearing reads above intentionally have NO catch — a
        // failed accounts/holdings/equity read MUST surface, never silently
        // under-report net wealth (finance correctness > availability here).
        deps.getCompass(userId).catch(() => null),
        // recent activity is presentational — degrade to [] on any failure so a
        // logo/transactions hiccup never 500s the wealth aggregate (AC-7).
        deps.listRecentActivity(userId, 5).catch(() => [] as DashboardActivity[]),
      ]);

      const priced = await priceHoldings(holdings, { resolveQuote: deps.resolveQuote });
      const snapshot = computeSnapshotFx(accounts, priced, fx.rates, "EUR");
      const totalWealthEur = snapshot.kpi.capitalTotal + equity.totalEquityEur;

      // The cap measures INVESTABLE wealth — cash + market value (= capitalTotal)
      // — NOT total net wealth (quick-spec 2026-06-10, Alex's decision). Real-
      // estate equity is excluded: the primary residence dwarfs the investable
      // base, so including it would peg every compass near 100 %. Clamp to ≥0 for
      // the ratio: computeProgress rejects a negative currentWealth (INVALID_
      // WEALTH → 400), so an overdrawn account reads 0 %, never an error
      // (NFR-18 — getOverview never throws). totalWealthEur stays the hero figure.
      const investableWealthEur = Math.max(0, snapshot.kpi.capitalTotal);
      const compass = compassRow
        ? {
            ...deps.computeProgress({
              currentWealth: investableWealthEur,
              capitalTarget: compassRow.objectif,
            }),
            currentWealth: investableWealthEur,
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
        // Source comes from the caching reader (live | stale | unavailable),
        // NOT from computeSnapshotFx's null-derived "live"/"fallback" — the
        // reader knows whether the rates were fresh, cached, or absent. asOf is
        // the snapshot's rate date (the cached rate date when stale; null when
        // unavailable).
        fx: { source: fx.source, asOf: snapshot.fxAsOf },
        recentActivity,
      };
    },

    async getHypothesisGap(userId, currentWealthEur) {
      // The compass objectif is the cap target; the projection supplies the
      // final wealth + horizon + rate. Both reads are user-scoped (ADR-0013 is
      // enforced inside the underlying module services).
      const [compassRow, projection] = await Promise.all([
        // Compass is optional: no compass → no target → no gap (the card shows
        // the "configure ton cap" hint). Mirror getOverview's degrade-to-null.
        deps.getCompass(userId).catch(() => null),
        // The projection is a wealth-bearing read: a genuine infra failure must
        // degrade to the same null (→ card hint) rather than 500 the whole gap,
        // matching getCompass's degrade-to-null posture (aped-review F1, 7-4).
        deps.getHypothesisProjection(userId, currentWealthEur).catch(() => null),
      ]);
      if (!compassRow || !projection) return null;
      const { objectif } = compassRow;
      const { finalEur: projectedFinalEur, horizonYears, annualRate } = projection;
      const requiredPoints = computeRequiredCurve({ currentWealthEur, objectif, horizonYears });
      const { gapEurPerMonth, reachesCap } = computeMonthlyGap({
        projectedFinalEur,
        objectif,
        horizonYears,
        annualRate,
      });
      return {
        gapEurPerMonth,
        reachesCap,
        projectedFinalEur,
        requiredFinalEur: objectif,
        deltaAtCapEur: projectedFinalEur - objectif,
        horizonYears,
        requiredPoints,
      };
    },
  };
}
