// apps/api/src/common/derive/advisory-snapshot.ts
// Deterministic advisory snapshot (story 12-2, ADR-0016 §3).
//
// The engine owns every number on the private advisory surface. It composes
// the existing pure derives (portfolio-fx, holding-pnl, compass-progress) and
// the already-computed monthly envelope; it performs no IO, reads no clock,
// and calls no LLM. The service layer alone supplies live prices and FX.
//
// Determinism (AC-3): every ordering is fixed (allocation keys, account types,
// property types, holding kinds, positions by value then id) and every
// percentage is rounded through one helper. Same inputs → deep-equal output.

import { ADVISORY_SNAPSHOT_SCHEMA_VERSION } from "@pekulo/validators";
import type {
  Account,
  FxRates,
  FxSource,
  GetMonthlyOutput,
  Holding,
  PortfolioSnapshotFx,
  RealEstate,
  TotalEquityOutput,
} from "@pekulo/validators";
import type {
  AdvisorySnapshot,
  AdvisorySnapshotAllocationLine,
  AdvisorySnapshotByKind,
  AdvisorySnapshotFiscalEnvelope,
  AdvisorySnapshotFiscalProperty,
  AdvisorySnapshotMonthlyCashflow,
  AdvisorySnapshotPosition,
} from "@pekulo/types";
import { computeHoldingPnl } from "./holding-pnl";
import { computeProgress } from "./compass-progress";
import { computeSnapshotFx, convertToBase } from "./portfolio-fx";

const BASE_CURRENCY = "EUR" as const;

const ACCOUNT_TYPE_ORDER = ["livret", "pea", "cto", "av", "autre", "banque"] as const;
const PROPERTY_TYPE_ORDER = ["residence-principale", "locatif", "autre"] as const;
const HOLDING_KIND_ORDER = ["etf", "action", "crypto", "autre"] as const;

export interface AdvisorySnapshotInput {
  accounts: Account[];
  holdings: Holding[];
  rates: FxRates | null;
  fxSource: FxSource;
  equity: TotalEquityOutput;
  properties: RealEstate[];
  compass: { objectif: number } | null;
  monthly: GetMonthlyOutput;
}

export function computeAdvisorySnapshot(input: AdvisorySnapshotInput): AdvisorySnapshot {
  const snapshot = computeSnapshotFx(input.accounts, input.holdings, input.rates, BASE_CURRENCY);
  const totalWealthEur = snapshot.kpi.capitalTotal + input.equity.totalEquityEur;
  const investableEur = snapshot.kpi.capitalTotal;

  const allocation: AdvisorySnapshotAllocationLine[] = [
    {
      key: "cash",
      amountEur: snapshot.kpi.cash,
      pct: pctOf(snapshot.kpi.cash, totalWealthEur),
    },
    {
      key: "investments",
      amountEur: snapshot.kpi.marketValue,
      pct: pctOf(snapshot.kpi.marketValue, totalWealthEur),
    },
    {
      key: "real-estate",
      amountEur: input.equity.totalEquityEur,
      pct: pctOf(input.equity.totalEquityEur, totalWealthEur),
    },
  ];

  const compass = compassOf(input.compass, investableEur);
  const monthlyCashflow = monthlyCashflowOf(input.monthly);
  const positions = input.holdings
    .map((holding) => positionOf(holding, input.rates))
    .sort(
      (left, right) =>
        right.marketValueEur - left.marketValueEur || left.holdingId.localeCompare(right.holdingId),
    );

  return {
    schemaVersion: ADVISORY_SNAPSHOT_SCHEMA_VERSION,
    baseCurrency: BASE_CURRENCY,
    wealth: {
      totalEur: totalWealthEur,
      investableEur,
      cashEur: snapshot.kpi.cash,
      investmentsEur: snapshot.kpi.marketValue,
      realEstateEquityEur: input.equity.totalEquityEur,
      unrealizedPnlEur: snapshot.kpi.pnl,
    },
    allocation,
    compass,
    monthlyCashflow,
    portfolio:
      input.holdings.length === 0
        ? null
        : {
            holdingsCount: input.holdings.length,
            investedEur: snapshot.kpi.invested,
            marketValueEur: snapshot.kpi.marketValue,
            pnlEur: snapshot.kpi.pnl,
            byKind: byKindOf(positions, snapshot.kpi.marketValue),
            positions,
          },
    fiscalite: {
      computation: "none",
      envelopes: fiscalEnvelopesOf(snapshot.byAccount, input.accounts, investableEur),
      properties: fiscalPropertiesOf(input.equity, input.properties, totalWealthEur),
      cryptoEur: positions
        .filter((position) => position.kind === "crypto")
        .reduce((sum, position) => sum + position.marketValueEur, 0),
    },
    fx: {
      base: BASE_CURRENCY,
      source: input.fxSource,
      asOf: snapshot.fxAsOf,
    },
  };
}

function compassOf(
  compass: { objectif: number } | null,
  investableEur: number,
): AdvisorySnapshot["compass"] {
  if (!compass || !Number.isFinite(compass.objectif) || compass.objectif <= 0) return null;
  const currentWealthEur = Math.max(0, investableEur);
  const progress = computeProgress({
    currentWealth: currentWealthEur,
    capitalTarget: compass.objectif,
  });
  return {
    targetEur: compass.objectif,
    currentWealthEur,
    percent: progress.percent,
    gapEur: progress.gap,
  };
}

function monthlyCashflowOf(monthly: GetMonthlyOutput): AdvisorySnapshotMonthlyCashflow {
  return {
    year: monthly.record.year,
    monthNum: monthly.record.monthNum,
    incomeEur: monthly.record.incomeEur,
    spendingEur: monthly.record.spendingEur,
    transfersEur: monthly.record.transfersEur,
    netChangeEur: monthly.record.netChangeEur,
    source: monthly.source,
  };
}

function positionOf(holding: Holding, rates: FxRates | null): AdvisorySnapshotPosition {
  const marketValueEur = rates
    ? convertToBase(holding.quantity * holding.lastPrice, holding.currency, rates)
    : holding.quantity * holding.lastPrice;
  const pnl = computeHoldingPnl(
    {
      quantity: holding.quantity,
      avgCost: holding.avgCost,
      lastPrice: holding.lastPrice,
      currency: holding.currency,
    },
    rates,
  );

  return {
    holdingId: holding.id,
    accountId: holding.accountId,
    ticker: holding.ticker,
    label: holding.label,
    kind: holding.kind,
    currency: holding.currency,
    quantity: holding.quantity,
    avgCost: holding.avgCost,
    lastPrice: holding.lastPrice,
    marketValueEur,
    pnlEur: pnl.eur.pnl,
    pnlPct: pnl.eur.pnlPct,
  };
}

function byKindOf(
  positions: AdvisorySnapshotPosition[],
  totalMarketValueEur: number,
): AdvisorySnapshotByKind[] {
  const totals = new Map<string, number>();
  for (const position of positions) {
    totals.set(position.kind, (totals.get(position.kind) ?? 0) + position.marketValueEur);
  }
  return HOLDING_KIND_ORDER.map((kind) => {
    const marketValueEur = totals.get(kind) ?? 0;
    return { kind, marketValueEur, pct: pctOf(marketValueEur, totalMarketValueEur) };
  });
}

function fiscalEnvelopesOf(
  byAccount: PortfolioSnapshotFx["byAccount"],
  accounts: Account[],
  totalInvestableEur: number,
): AdvisorySnapshotFiscalEnvelope[] {
  const typeByAccountId = new Map(accounts.map((account) => [account.id, account.type]));
  const totals = new Map<Account["type"], number>();
  for (const row of byAccount) {
    const accountType = typeByAccountId.get(row.accountId);
    if (!accountType) continue;
    totals.set(accountType, (totals.get(accountType) ?? 0) + row.total);
  }
  return ACCOUNT_TYPE_ORDER.flatMap((accountType) => {
    const amountEur = totals.get(accountType);
    if (amountEur === undefined) return [];
    return [{ accountType, amountEur, pct: pctOf(amountEur, totalInvestableEur) }];
  });
}

function fiscalPropertiesOf(
  equity: TotalEquityOutput,
  properties: RealEstate[],
  totalWealthEur: number,
): AdvisorySnapshotFiscalProperty[] {
  const typeByPropertyId = new Map(
    properties.map((property) => [property.id, property.propertyType]),
  );
  const totals = new Map<RealEstate["propertyType"], number>();
  for (const row of equity.perProperty) {
    const propertyType = typeByPropertyId.get(row.propertyId);
    if (!propertyType) continue;
    totals.set(propertyType, (totals.get(propertyType) ?? 0) + row.netEquityEur);
  }
  return PROPERTY_TYPE_ORDER.flatMap((propertyType) => {
    const netEquityEur = totals.get(propertyType);
    if (netEquityEur === undefined) return [];
    return [{ propertyType, netEquityEur, pct: pctOf(netEquityEur, totalWealthEur) }];
  });
}

function pctOf(amountEur: number, totalEur: number): number {
  if (!Number.isFinite(totalEur) || totalEur <= 0) return 0;
  return round1((amountEur / totalEur) * 100);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
