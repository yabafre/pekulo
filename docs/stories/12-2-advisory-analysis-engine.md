# Story: 12-2-advisory-analysis-engine — Deterministic advisory analysis engine (the numbers layer)

**Epic:** Epic 12 — Private internal AI advisory tool (internal / non-product)
**Status:** review
**Source:** ticket
**Ticket:** #115
**Ticket URL:** https://github.com/yabafre/pekulo/issues/115
**Origin:** aped-from-ticket
**Branch:** feature/115-12-2-advisory-analysis-engine

## User Story

**As an** authorized advisory user, **I want** a deterministic snapshot of my financial situation (wealth, allocation, gap-to-compass, monthly cashflow, fiscalité signals), **so that** any recommendation is grounded in computed figures, never LLM-invented numbers.

## Acceptance Criteria

- **AC-1 (complete deterministic snapshot)** — **Given** a user with accounts, holdings, real estate, a compass and a current month, **When** the advisory snapshot is requested by an allowlisted caller, **Then** the response exposes total wealth, investable wealth, the three-way allocation with percentages, the compass gap, the current-month cashflow envelope, a portfolio block with instrument-level positions and `byKind`, factual fiscalité signals, and FX provenance — every numeric field produced by the deterministic engine.
- **AC-2 (no holdings degrade gracefully)** — **Given** a user with no holdings, **When** the snapshot is requested, **Then** `portfolio` is `null` and every other block is still present; no price resolution is attempted and no error is returned.
- **AC-3 (determinism)** — **Given** the same accounts, holdings, rates, equity, properties, compass and monthly envelope, **When** the engine runs twice, **Then** the two snapshots are deep-equal, including array ordering and rounded percentages; the engine reads no clock and performs no IO.
- **AC-4 (gate inherited)** — **Given** a caller who is neither an owner nor an active allowlisted user, **When** they request the snapshot, **Then** the API answers 403 `FORBIDDEN` before any accounts, holdings, equity, compass or monthly read and before any engine computation runs; an active allowlisted caller receives 200.
- **AC-5 (verification and scope)** — **Given** the story is complete, **When** the API tests, typecheck and lint run, **Then** each exits 0; the story makes no LLM call, writes no database row, adds no migration and introduces no environment variable.

## Tasks

- [x] **T1 — Publish the snapshot wire schema and barrel** [AC: AC-1, AC-2]
  The schema is the contract between the deterministic layer (12-2) and the LLM layer (12-3). It is deliberately closed: any figure the LLM may cite must appear here.

  **Path:** `packages/validators/src/advisory/advisory.snapshot.schemas.ts` (create)

  ```ts
  // packages/validators/src/advisory/advisory.snapshot.schemas.ts
  // Deterministic advisory snapshot wire schema (story 12-2, ADR-0016 §3).
  //
  // The deterministic engine owns every number on this surface; this schema is
  // the boundary between that engine (12-2) and the LLM layer (12-3). A field
  // added here is a figure the LLM is allowed to cite, so the shape stays closed
  // and explicit.
  import { z } from "@pekulo/zod";
  import { accountSchema } from "../accounts";
  import { fxSourceSchema, holdingIdSchema, holdingSchema } from "../holdings";
  import { propertyTypeSchema } from "../realestate";

  export const ADVISORY_SNAPSHOT_SCHEMA_VERSION = 1;

  export const ADVISORY_ALLOCATION_KEYS = ["cash", "investments", "real-estate"] as const;
  export const advisoryAllocationKeySchema = z.enum(ADVISORY_ALLOCATION_KEYS);
  export type AdvisoryAllocationKey = z.infer<typeof advisoryAllocationKeySchema>;

  export const advisorySnapshotWealthSchema = z.object({
    totalEur: z.number().finite(),
    investableEur: z.number().finite(),
    cashEur: z.number().finite(),
    investmentsEur: z.number().finite(),
    realEstateEquityEur: z.number().finite(),
    unrealizedPnlEur: z.number().finite(),
  });
  export type AdvisorySnapshotWealth = z.infer<typeof advisorySnapshotWealthSchema>;

  export const advisorySnapshotAllocationLineSchema = z.object({
    key: advisoryAllocationKeySchema,
    amountEur: z.number().finite(),
    pct: z.number().finite(),
  });
  export type AdvisorySnapshotAllocationLine = z.infer<
    typeof advisorySnapshotAllocationLineSchema
  >;

  export const advisorySnapshotCompassSchema = z.object({
    targetEur: z.number().finite().positive(),
    currentWealthEur: z.number().finite().min(0),
    percent: z.number().finite().min(0),
    gapEur: z.number().finite(),
  });
  export type AdvisorySnapshotCompass = z.infer<typeof advisorySnapshotCompassSchema>;

  export const advisorySnapshotMonthlyCashflowSchema = z.object({
    year: z.number().int().min(2020).max(2099),
    monthNum: z.number().int().min(1).max(12),
    incomeEur: z.number().finite().min(0),
    spendingEur: z.number().finite().min(0),
    transfersEur: z.number().finite().min(0),
    netChangeEur: z.number().finite(),
    source: z.enum(["derived", "persisted"]),
  });
  export type AdvisorySnapshotMonthlyCashflow = z.infer<
    typeof advisorySnapshotMonthlyCashflowSchema
  >;

  export const advisorySnapshotPositionSchema = z.object({
    holdingId: holdingIdSchema,
    accountId: z.string().min(1),
    ticker: z.string().max(32).nullable(),
    label: z.string().min(1).max(120),
    kind: holdingSchema.shape.kind,
    currency: holdingSchema.shape.currency,
    quantity: z.number().finite().min(0),
    avgCost: z.number().finite().min(0),
    lastPrice: z.number().finite().min(0),
    marketValueEur: z.number().finite(),
    pnlEur: z.number().finite(),
    pnlPct: z.number().finite(),
  });
  export type AdvisorySnapshotPosition = z.infer<typeof advisorySnapshotPositionSchema>;

  export const advisorySnapshotByKindSchema = z.object({
    kind: holdingSchema.shape.kind,
    marketValueEur: z.number().finite().min(0),
    pct: z.number().finite().min(0),
  });
  export type AdvisorySnapshotByKind = z.infer<typeof advisorySnapshotByKindSchema>;

  export const advisorySnapshotPortfolioSchema = z.object({
    holdingsCount: z.number().int().positive(),
    investedEur: z.number().finite().min(0),
    marketValueEur: z.number().finite().min(0),
    pnlEur: z.number().finite(),
    byKind: z.array(advisorySnapshotByKindSchema).length(4),
    positions: z.array(advisorySnapshotPositionSchema),
  });
  export type AdvisorySnapshotPortfolio = z.infer<typeof advisorySnapshotPortfolioSchema>;

  export const advisorySnapshotFiscalEnvelopeSchema = z.object({
    accountType: accountSchema.shape.type,
    amountEur: z.number().finite(),
    pct: z.number().finite(),
  });
  export type AdvisorySnapshotFiscalEnvelope = z.infer<
    typeof advisorySnapshotFiscalEnvelopeSchema
  >;

  export const advisorySnapshotFiscalPropertySchema = z.object({
    propertyType: propertyTypeSchema,
    netEquityEur: z.number().finite(),
    pct: z.number().finite(),
  });
  export type AdvisorySnapshotFiscalProperty = z.infer<
    typeof advisorySnapshotFiscalPropertySchema
  >;

  export const advisorySnapshotFiscaliteSchema = z.object({
    computation: z.literal("none"),
    envelopes: z.array(advisorySnapshotFiscalEnvelopeSchema),
    properties: z.array(advisorySnapshotFiscalPropertySchema),
    cryptoEur: z.number().finite().min(0),
  });
  export type AdvisorySnapshotFiscalite = z.infer<typeof advisorySnapshotFiscaliteSchema>;

  export const advisorySnapshotFxSchema = z.object({
    base: z.literal("EUR"),
    source: fxSourceSchema,
    asOf: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "asOf must be YYYY-MM-DD")
      .nullable(),
  });
  export type AdvisorySnapshotFx = z.infer<typeof advisorySnapshotFxSchema>;

  export const advisorySnapshotSchema = z.object({
    schemaVersion: z.literal(ADVISORY_SNAPSHOT_SCHEMA_VERSION),
    baseCurrency: z.literal("EUR"),
    wealth: advisorySnapshotWealthSchema,
    allocation: z.array(advisorySnapshotAllocationLineSchema).length(3),
    compass: advisorySnapshotCompassSchema.nullable(),
    monthlyCashflow: advisorySnapshotMonthlyCashflowSchema,
    portfolio: advisorySnapshotPortfolioSchema.nullable(),
    fiscalite: advisorySnapshotFiscaliteSchema,
    fx: advisorySnapshotFxSchema,
  });
  export type AdvisorySnapshot = z.infer<typeof advisorySnapshotSchema>;
  ```

  **Path:** `packages/validators/src/advisory/index.ts` (modify)

  ```ts
  export * from "./advisory.schemas";
  export * from "./advisory.snapshot.schemas";
  ```

  **Run:** `bun --filter='@pekulo/api' run typecheck`

  **Expected:** exit 0. The API consumes the validators barrel, so the new module is typechecked through the existing workspace edge.

  **Commit:** `git commit -m "feat(#115): advisory snapshot wire schema (AC-1, AC-2)"`

- [x] **T2 — Publish the snapshot types through `@pekulo/types`** [AC: AC-1]
  The engine and the future 12-3 prompt builder should import advisory types from the shared types package, matching the compass and hypothesis convention.

  **Path:** `packages/types/src/advisory/advisory.types.ts` (create)

  ```ts
  // packages/types/src/advisory/advisory.types.ts
  // Advisory surface types (story 12-2). The Zod-inferred shapes in
  // @pekulo/validators are the runtime SSOT; this module re-exports them so
  // apps/api and apps/web can import the domain shapes from @pekulo/types.
  export type {
    AdvisoryAllocationKey,
    AdvisorySnapshot,
    AdvisorySnapshotAllocationLine,
    AdvisorySnapshotByKind,
    AdvisorySnapshotCompass,
    AdvisorySnapshotFiscalEnvelope,
    AdvisorySnapshotFiscalProperty,
    AdvisorySnapshotFiscalite,
    AdvisorySnapshotFx,
    AdvisorySnapshotMonthlyCashflow,
    AdvisorySnapshotPortfolio,
    AdvisorySnapshotPosition,
    AdvisorySnapshotWealth,
  } from "@pekulo/validators";
  ```

  **Path:** `packages/types/src/advisory/index.ts` (create)

  ```ts
  export * from "./advisory.types";
  ```

  **Path:** `packages/types/src/index.ts` (modify — insert after `export * from "./shared";`)

  ```ts
  export * from "./shared";
  export * from "./advisory";
  export * from "./account";
  export * from "./holding";
  export * from "./transaction";
  export * from "./milestone";
  export * from "./monthly";
  export * from "./realestate";
  export * from "./composition";
  export * from "./stat";
  export * from "./compass";
  export * from "./hypothesis";
  export * from "./llm";
  ```

  **Run:**
  ```bash
  bun --filter='@pekulo/types' run typecheck
  bun --filter='@pekulo/api' run typecheck
  ```

  **Expected:** both exit 0.

  **Commit:** `git commit -m "feat(#115): re-export advisory snapshot types (AC-1)"`

- [x] **T3 — Build the pure deterministic engine** [AC: AC-1, AC-2, AC-3]
  The engine composes the existing derives and owns every number. It must not read the clock, call Prisma, fetch prices or call the LLM. Live prices and FX enter through arguments only.

  **Path:** `apps/api/src/common/derive/portfolio-fx.ts` (modify — make `convertToBase` shareable)

  ```ts
  // Shared with holding-pnl.ts (which keeps its private mirror) and with the
  // advisory snapshot engine. Both copies are pure and identical; keep them in
  // sync if the FX rule changes.
  export function convertToBase(amount: number, from: HoldingCurrency, rates: FxRates): number {
    if (from === rates.base) return amount;
    const r = rates.rates[from];
    if (!r || r <= 0) return amount; // unknown rate → identity (best-effort, mirrors brownfield)
    return amount / r;
  }
  ```

  **Path:** `apps/api/src/common/derive/advisory-snapshot.ts` (create)

  ```ts
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
          right.marketValueEur - left.marketValueEur ||
          left.holdingId.localeCompare(right.holdingId),
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
  ```

  **Run:** `bun --filter='@pekulo/api' run typecheck`

  **Expected:** exit 0.

  **Commit:** `git commit -m "feat(#115): deterministic advisory snapshot engine (AC-1, AC-2, AC-3)"`

- [x] **T4 — Prove the engine reference, degradation and determinism** [AC: AC-1, AC-2, AC-3]
  The reference fixture is deliberately the same shape the dashboard uses: 20 000 € cash, 6 000 € live-priced holdings and 250 000 € real-estate equity, so the totals are easy to audit by hand.

  **Path:** `apps/api/src/common/derive/advisory-snapshot.test.ts` (create)

  ```ts
  import { describe, expect, test } from "bun:test";
  import type {
    Account,
    FxRates,
    GetMonthlyOutput,
    Holding,
    RealEstate,
    TotalEquityOutput,
  } from "@pekulo/validators";
  import {
    computeAdvisorySnapshot,
    type AdvisorySnapshotInput,
  } from "./advisory-snapshot";

  const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const NOW = new Date("2026-10-27T00:00:00Z");
  const ACC_LIVRET = "acc_000000000000000000000";
  const ACC_PEA = "acc_000000000000000000001";
  const RES_ID = "res_000000000000000000000";

  function acct(over: Partial<Account> = {}): Account {
    return {
      id: ACC_LIVRET,
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

  function hold(over: Partial<Holding> = {}): Holding {
    return {
      id: "hld_000000000000000000001",
      userId: USER,
      accountId: ACC_LIVRET,
      kind: "etf",
      ticker: "CW8",
      isin: null,
      label: "Holding",
      currency: "EUR",
      quantity: 10,
      avgCost: 80,
      lastPrice: 100,
      lastPriceAt: NOW,
      notes: null,
      createdAt: NOW,
      updatedAt: NOW,
      closedAt: null,
      ...over,
    };
  }

  function property(over: Partial<RealEstate> = {}): RealEstate {
    return {
      id: RES_ID,
      userId: USER,
      label: "Résidence",
      propertyType: "residence-principale",
      currentValuation: 300_000,
      lastValuedOn: NOW,
      createdAt: NOW,
      updatedAt: NOW,
      ...over,
    };
  }

  const RATES: FxRates = {
    base: "EUR",
    date: "2026-10-27",
    rates: { EUR: 1, USD: 1.08, GBP: 0.85, CHF: 0.95 },
  };

  const MONTHLY: GetMonthlyOutput = {
    source: "derived",
    record: {
      year: 2026,
      monthNum: 10,
      incomeEur: 5_000,
      spendingEur: 3_000,
      transfersEur: 500,
      netChangeEur: 2_000,
      signedOffAt: null,
    },
  };

  const EQUITY: TotalEquityOutput = {
    totalEquityEur: 250_000,
    perProperty: [{ propertyId: RES_ID, netEquityEur: 250_000 }],
  };

  function baseInput(over: Partial<AdvisorySnapshotInput> = {}): AdvisorySnapshotInput {
    const accounts = [
      acct({ id: ACC_LIVRET, type: "livret", cashBalance: 10_000 }),
      acct({ id: ACC_PEA, type: "pea", cashBalance: 10_000 }),
    ];
    const holdings = Array.from({ length: 6 }, (_, index) =>
      hold({
        id: `hld_${(index + 1).toString().padStart(21, "0")}`,
        accountId: index < 3 ? ACC_LIVRET : ACC_PEA,
        ticker: `T${index + 1}`,
      }),
    );
    return {
      accounts,
      holdings,
      rates: RATES,
      fxSource: "live",
      equity: EQUITY,
      properties: [property()],
      compass: { objectif: 800_000 },
      monthly: MONTHLY,
      ...over,
    };
  }

  describe("computeAdvisorySnapshot", () => {
    test("AC-1 — full reference snapshot is computed by the engine", () => {
      const snapshot = computeAdvisorySnapshot(baseInput());

      expect(snapshot.schemaVersion).toBe(1);
      expect(snapshot.baseCurrency).toBe("EUR");
      expect(snapshot.wealth).toEqual({
        totalEur: 276_000,
        investableEur: 26_000,
        cashEur: 20_000,
        investmentsEur: 6_000,
        realEstateEquityEur: 250_000,
        unrealizedPnlEur: 1_200,
      });
      expect(snapshot.allocation).toEqual([
        { key: "cash", amountEur: 20_000, pct: 7.2 },
        { key: "investments", amountEur: 6_000, pct: 2.2 },
        { key: "real-estate", amountEur: 250_000, pct: 90.6 },
      ]);
      expect(snapshot.compass).toEqual({
        targetEur: 800_000,
        currentWealthEur: 26_000,
        percent: 3.3,
        gapEur: 774_000,
      });
      expect(snapshot.monthlyCashflow).toEqual({
        year: 2026,
        monthNum: 10,
        incomeEur: 5_000,
        spendingEur: 3_000,
        transfersEur: 500,
        netChangeEur: 2_000,
        source: "derived",
      });
      expect(snapshot.portfolio?.holdingsCount).toBe(6);
      expect(snapshot.portfolio?.investedEur).toBe(4_800);
      expect(snapshot.portfolio?.marketValueEur).toBe(6_000);
      expect(snapshot.portfolio?.pnlEur).toBe(1_200);
      expect(snapshot.portfolio?.byKind).toEqual([
        { kind: "etf", marketValueEur: 6_000, pct: 100 },
        { kind: "action", marketValueEur: 0, pct: 0 },
        { kind: "crypto", marketValueEur: 0, pct: 0 },
        { kind: "autre", marketValueEur: 0, pct: 0 },
      ]);
      expect(snapshot.portfolio?.positions[0]).toMatchObject({
        holdingId: "hld_000000000000000000001",
        marketValueEur: 1_000,
        pnlEur: 200,
        pnlPct: 0.25,
      });
      expect(snapshot.fiscalite).toEqual({
        computation: "none",
        envelopes: [
          { accountType: "livret", amountEur: 13_000, pct: 50 },
          { accountType: "pea", amountEur: 13_000, pct: 50 },
        ],
        properties: [
          { propertyType: "residence-principale", netEquityEur: 250_000, pct: 90.6 },
        ],
        cryptoEur: 0,
      });
      expect(snapshot.fx).toEqual({ base: "EUR", source: "live", asOf: "2026-10-27" });
    });

    test("AC-2 — no holdings returns portfolio null and keeps every other block", () => {
      const snapshot = computeAdvisorySnapshot(baseInput({ holdings: [] }));

      expect(snapshot.portfolio).toBeNull();
      expect(snapshot.wealth.totalEur).toBe(270_000);
      expect(snapshot.wealth.investmentsEur).toBe(0);
      expect(snapshot.allocation).toEqual([
        { key: "cash", amountEur: 20_000, pct: 7.4 },
        { key: "investments", amountEur: 0, pct: 0 },
        { key: "real-estate", amountEur: 250_000, pct: 92.6 },
      ]);
      expect(snapshot.compass).toEqual({
        targetEur: 800_000,
        currentWealthEur: 20_000,
        percent: 2.5,
        gapEur: 780_000,
      });
      expect(snapshot.fiscalite.cryptoEur).toBe(0);
    });

    test("AC-3 — the same inputs produce a deep-equal snapshot", () => {
      const first = computeAdvisorySnapshot(baseInput());
      const second = computeAdvisorySnapshot(baseInput());

      expect(second).toEqual(first);
    });

    test("AC-1 — no compass degrades to compass null", () => {
      const snapshot = computeAdvisorySnapshot(baseInput({ compass: null }));

      expect(snapshot.compass).toBeNull();
      expect(snapshot.wealth.totalEur).toBe(276_000);
    });

    test("AC-1 — an overdraft is surfaced raw and the compass clamps to 0 %", () => {
      const snapshot = computeAdvisorySnapshot(
        baseInput({
          accounts: [acct({ id: ACC_LIVRET, cashBalance: -50_000 })],
          holdings: [],
          equity: { totalEquityEur: 0, perProperty: [] },
          properties: [],
          compass: { objectif: 800_000 },
        }),
      );

      expect(snapshot.wealth.totalEur).toBe(-50_000);
      expect(snapshot.allocation.every((line) => line.pct === 0)).toBe(true);
      expect(snapshot.compass).toEqual({
        targetEur: 800_000,
        currentWealthEur: 0,
        percent: 0,
        gapEur: 800_000,
      });
    });

    test("AC-1 — a USD holding is converted to EUR for value and PnL", () => {
      const snapshot = computeAdvisorySnapshot(
        baseInput({
          accounts: [acct({ id: ACC_LIVRET, cashBalance: 0 })],
          holdings: [
            hold({
              accountId: ACC_LIVRET,
              kind: "action",
              ticker: "USDX",
              currency: "USD",
              quantity: 1,
              avgCost: 50,
              lastPrice: 60,
            }),
          ],
          equity: { totalEquityEur: 0, perProperty: [] },
          properties: [],
          compass: null,
        }),
      );

      expect(snapshot.wealth.investmentsEur).toBeCloseTo(60 / 1.08, 6);
      expect(snapshot.portfolio?.positions[0]?.marketValueEur).toBeCloseTo(60 / 1.08, 6);
      expect(snapshot.portfolio?.positions[0]?.pnlEur).toBeCloseTo(10 / 1.08, 6);
      expect(snapshot.portfolio?.positions[0]?.pnlPct).toBe(0.2);
      expect(snapshot.allocation[1]?.pct).toBe(100);
    });

    test("AC-1 — crypto exposure is surfaced both in the portfolio and in fiscalité", () => {
      const snapshot = computeAdvisorySnapshot(
        baseInput({
          holdings: [
            hold({
              accountId: ACC_LIVRET,
              kind: "crypto",
              ticker: "BTC",
              quantity: 1,
              avgCost: 0,
              lastPrice: 500,
            }),
          ],
        }),
      );

      expect(snapshot.fiscalite.cryptoEur).toBe(500);
      expect(snapshot.portfolio?.byKind).toEqual([
        { kind: "etf", marketValueEur: 0, pct: 0 },
        { kind: "action", marketValueEur: 0, pct: 0 },
        { kind: "crypto", marketValueEur: 500, pct: 100 },
        { kind: "autre", marketValueEur: 0, pct: 0 },
      ]);
    });

    test("AC-1 — null rates keep the explicit unavailable FX provenance", () => {
      const snapshot = computeAdvisorySnapshot(
        baseInput({ rates: null, fxSource: "unavailable" }),
      );

      expect(snapshot.wealth.investmentsEur).toBe(6_000);
      expect(snapshot.fx).toEqual({
        base: "EUR",
        source: "unavailable",
        asOf: null,
      });
    });
  });
  ```

  **Run:** `bun --filter='@pekulo/api' run test src/common/derive/advisory-snapshot.test.ts`

  **Expected:** all tests pass, including the reference, the no-holdings branch and the determinism assertion.

  **Commit:** `git commit -m "test(#115): advisory snapshot engine coverage (AC-1, AC-2, AC-3)"`

- [x] **T5 — Extract the shared live-pricing helper** [AC: AC-1, AC-3]
  The dashboard and the advisory engine must use the same dedupe + bounded-concurrency policy (NFR-16). Extracting it removes the risk of the two paths drifting; the dashboard tests remain the regression net.

  **Path:** `apps/api/src/common/market-data/price-holdings.ts` (create)

  ```ts
  // apps/api/src/common/market-data/price-holdings.ts
  // Shared live-price enrichment for holdings (story 12-2 extraction).
  //
  // Two guards keep this linear at the NFR-16 cap (≤500 holdings):
  //   1. dedupe identical {ticker, kind, currency} so N lots of the same
  //      security resolve ONE quote;
  //   2. bound concurrency so a cold cache cannot fan out 500 provider chains
  //      in a single tick (thundering-herd against upstream providers).
  //
  // A null ticker (manual entry) or a rejected quote keeps the stored lastPrice.
  // This helper never throws on a price miss.

  import type { Holding, PriceQuote, PriceQuoteInput } from "@pekulo/validators";

  export const PRICE_CONCURRENCY = 8;

  export interface PriceHoldingsDeps {
    resolveQuote: (input: PriceQuoteInput) => Promise<PriceQuote>;
  }

  export async function priceHoldings(
    holdings: Holding[],
    deps: PriceHoldingsDeps,
  ): Promise<Holding[]> {
    const quoteKey = (holding: Holding) => `${holding.ticker}|${holding.kind}|${holding.currency}`;
    const distinct = new Map<string, PriceQuoteInput>();
    for (const holding of holdings) {
      const ticker = holding.ticker;
      if (!ticker) continue;
      const key = quoteKey(holding);
      if (!distinct.has(key)) {
        distinct.set(key, { ticker, kind: holding.kind, currency: holding.currency });
      }
    }

    const prices = new Map<string, number>();
    const inputs = [...distinct.entries()];
    for (let index = 0; index < inputs.length; index += PRICE_CONCURRENCY) {
      const batch = inputs.slice(index, index + PRICE_CONCURRENCY);
      // Sequential by design: each batch runs in parallel, but batches are awaited
      // one at a time to bound the fan-out (parallelising ALL batches is exactly
      // the unbounded thundering-herd this guard prevents — NFR-16).
      // oxlint-disable-next-line no-await-in-loop -- bounded price fan-out, see above
      await Promise.all(
        batch.map(async ([key, input]) => {
          try {
            const quote = await deps.resolveQuote(input);
            prices.set(key, quote.price);
          } catch {
            // graceful fallback — leave unset, the holding keeps its stored lastPrice
          }
        }),
      );
    }

    return holdings.map((holding) => {
      if (!holding.ticker) return holding;
      const price = prices.get(quoteKey(holding));
      return price === undefined ? holding : { ...holding, lastPrice: price };
    });
  }
  ```

  **Path:** `apps/api/src/common/market-data/price-holdings.test.ts` (create)

  ```ts
  import { describe, expect, test } from "bun:test";
  import type { Holding, PriceQuote } from "@pekulo/validators";
  import { PRICE_CONCURRENCY, priceHoldings } from "./price-holdings";

  const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const NOW = new Date("2026-10-27T00:00:00Z");

  function hold(over: Partial<Holding> = {}): Holding {
    return {
      id: "hld_000000000000000000001",
      userId: USER,
      accountId: "acc_000000000000000000000",
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

  function quote(symbol: string, price: number): PriceQuote {
    return {
      symbol,
      price,
      currency: "EUR",
      marketTime: "2026-10-27",
      provider: "yahoo",
    };
  }

  describe("priceHoldings", () => {
    test("dedupes identical {ticker, kind, currency} keys", async () => {
      let calls = 0;
      const out = await priceHoldings(
        [
          hold({ id: "hld_000000000000000000001" }),
          hold({ id: "hld_000000000000000000002" }),
          hold({ id: "hld_000000000000000000003" }),
        ],
        {
          resolveQuote: async ({ ticker }) => {
            calls += 1;
            return quote(ticker ?? "T", 100);
          },
        },
      );

      expect(calls).toBe(1);
      expect(out.map((holding) => holding.lastPrice)).toEqual([100, 100, 100]);
    });

    test("a null ticker is never resolved and keeps the stored lastPrice", async () => {
      let calls = 0;
      const out = await priceHoldings([hold({ ticker: null, lastPrice: 42 })], {
        resolveQuote: async () => {
          calls += 1;
          return quote("T", 100);
        },
      });

      expect(calls).toBe(0);
      expect(out[0]?.lastPrice).toBe(42);
    });

    test("a rejected quote keeps the stored lastPrice", async () => {
      const out = await priceHoldings([hold({ lastPrice: 90 })], {
        resolveQuote: async () => {
          throw new Error("all tiers down");
        },
      });

      expect(out[0]?.lastPrice).toBe(90);
    });

    test("the same ticker with a different currency resolves a distinct quote", async () => {
      let calls = 0;
      const out = await priceHoldings(
        [
          hold({ id: "hld_000000000000000000001", ticker: "CW8", currency: "EUR" }),
          hold({ id: "hld_000000000000000000002", ticker: "CW8", currency: "USD" }),
        ],
        {
          resolveQuote: async () => {
            calls += 1;
            return quote("CW8", 100);
          },
        },
      );

      expect(calls).toBe(2);
      expect(out).toHaveLength(2);
    });

    test("bounds the cold fan-out to PRICE_CONCURRENCY", async () => {
      let inFlight = 0;
      let maxInFlight = 0;
      const holdings = Array.from({ length: PRICE_CONCURRENCY * 3 }, (_, index) =>
        hold({
          id: `hld_${index.toString().padStart(21, "0")}`,
          ticker: `T${index}`,
        }),
      );

      const out = await priceHoldings(holdings, {
        resolveQuote: async ({ ticker }) => {
          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
          await new Promise((resolve) => setTimeout(resolve, 1));
          inFlight -= 1;
          return quote(ticker ?? "T", 100);
        },
      });

      expect(maxInFlight).toBe(PRICE_CONCURRENCY);
      expect(out.every((holding) => holding.lastPrice === 100)).toBe(true);
    });
  });
  ```

  **Path:** `apps/api/src/modules/dashboard/dashboard.service.ts` (modify — add the shared import)

  ```ts
  import { computeSnapshotFx } from "../../common/derive/portfolio-fx";
  import { computeMonthlyGap, computeRequiredCurve } from "../../common/derive/hypothesis-gap";
  import { createFxRatesReader } from "./fx-rates-source";
  import { priceHoldings } from "../../common/market-data/price-holdings";
  ```

  **Path:** `apps/api/src/modules/dashboard/dashboard.service.ts` (modify — delete the local pricing block)

  ```ts
    // Enrich each holding with a LIVE price; fall back to the stored lastPrice on
    // a null ticker (manual entry) or any resolveQuote rejection (all tiers
    // failed — NFR-18). The holdings module's 60s PricesCache fronts resolveQuote,
    // so steady-state loads are cache hits.
    //
    // Two guards keep this linear at the NFR-16 cap (≤500 holdings): (1) dedup
    // identical {ticker,kind,currency} so N lots of the same security resolve ONE
    // quote, and (2) bound concurrency so a COLD cache (after the 60s TTL) cannot
    // fan out 500 provider chains in a single tick (thundering-herd against the
    // upstream price providers).
    const PRICE_CONCURRENCY = 8;
    async function priceHoldings(holdings: Holding[]): Promise<Holding[]> {
      const quoteKey = (h: Holding) => `${h.ticker}|${h.kind}|${h.currency}`;
      const distinct = new Map<string, PriceQuoteInput>();
      for (const h of holdings) {
        if (!h.ticker) continue;
        const key = quoteKey(h);
        if (!distinct.has(key)) {
          distinct.set(key, { ticker: h.ticker, kind: h.kind, currency: h.currency });
        }
      }

      const prices = new Map<string, number>();
      const inputs = [...distinct.entries()];
      for (let i = 0; i < inputs.length; i += PRICE_CONCURRENCY) {
        const batch = inputs.slice(i, i + PRICE_CONCURRENCY);
        // Sequential by design: each batch runs in parallel, but batches are awaited
        // one at a time to bound the fan-out (parallelising ALL batches is exactly
        // the unbounded thundering-herd this guard prevents — NFR-16).
        // oxlint-disable-next-line no-await-in-loop -- bounded price fan-out, see above
        await Promise.all(
          batch.map(async ([key, input]) => {
            try {
              const quote = await deps.resolveQuote(input);
              prices.set(key, quote.price);
            } catch {
              // graceful fallback — leave unset, the holding keeps its stored lastPrice
            }
          }),
        );
      }

      return holdings.map((h) => {
        if (!h.ticker) return h;
        const price = prices.get(quoteKey(h));
        return price === undefined ? h : { ...h, lastPrice: price };
      });
    }
  ```

  **Path:** `apps/api/src/modules/dashboard/dashboard.service.ts` (modify — call the shared helper)

  ```ts
        const priced = await priceHoldings(holdings, { resolveQuote: deps.resolveQuote });
  ```

  **Run:**
  ```bash
  bun --filter='@pekulo/api' run test src/common/market-data/price-holdings.test.ts src/modules/dashboard/dashboard.service.test.ts
  ```

  **Expected:** the new helper suite passes and every existing dashboard test stays green, including the dedupe and price-fallback regressions.

  **Commit:** `git commit -m "refactor(#115): extract shared live-pricing helper (AC-1, AC-3)"`

- [x] **T6 — Move the FX last-known-good reader to the shared market-data layer** [AC: AC-1]
  This is a file move plus an import update, not a behaviour change. The reader keeps serving `live` → `stale` → `unavailable` and never silently converts 1:1.

  **Path:** `apps/api/src/common/market-data/fx-rates-reader.ts` (create)

  ```ts
  // apps/api/src/common/market-data/fx-rates-reader.ts
  // Last-known-good caching layer over the FX provider (frankfurter-client).
  //
  // WHY: the dashboard and the advisory snapshot convert USD/GBP/CHF holdings
  // to EUR. The brownfield path did `getRates(...).catch(() => null)`, and
  // computeSnapshotFx silently converts 1:1 when rates are null — so when
  // Frankfurter is down, a USD holding was over-reported by ~8 % (the EUR/USD
  // spread) with NO signal to the user. This wrapper removes that silent 1:1
  // fallback:
  //
  //   - success            → cache rates + stamp source "live".
  //   - failure WITH cache  → serve the last-known-good rates + source "stale"
  //                           (conversion still happens, never 1:1).
  //   - failure NO cache    → rates null + source "unavailable" + a structured
  //                           warn log. The 1:1 identity conversion still occurs
  //                           (the caller must not 500 on a cold FX outage —
  //                           NFR-18 spirit), but it is now EXPLICITLY surfaced
  //                           via the source instead of being silent.
  //
  // The cache is in-memory / per-process (no persistence needed — a fresh
  // "live" read on the next provider recovery overwrites it). It is keyed by
  // `base` so a future multi-base read keeps independent last-known-good rows.

  import type { FxRates, FxSource, HoldingCurrency } from "@pekulo/validators";

  export interface FxRatesResult {
    /**
     * The rates to convert with, or null when the provider is down AND nothing
     * was ever cached (cold start). A null result maps to the 1:1 identity
     * conversion downstream, paired with source "unavailable".
     */
    rates: FxRates | null;
    /** Explicit provenance — see FX_SOURCES. Never "fallback" from this reader. */
    source: FxSource;
  }

  export interface FxRatesReader {
    /** Read rates for `base`, never throws — degrades to stale/unavailable. */
    read(base: HoldingCurrency): Promise<FxRatesResult>;
  }

  export interface CreateFxRatesReaderDeps {
    /** The underlying provider read (frankfurter-client.getRates). May reject. */
    getRates: (base: HoldingCurrency) => Promise<FxRates>;
    /**
     * Structured warn sink for the cold-start outage (cold FX miss). Defaults to
     * console.warn; injectable so tests can assert the log without spying on the
     * global console.
     */
    warn?: (message: string) => void;
  }

  export function createFxRatesReader(deps: CreateFxRatesReaderDeps): FxRatesReader {
    const warn = deps.warn ?? ((message: string) => console.warn(message));
    // Last-known-good rates per base. In-memory: a process restart re-cold-starts,
    // and the very next live read repopulates it.
    const lastKnownGood = new Map<HoldingCurrency, FxRates>();

    return {
      async read(base) {
        try {
          const rates = await deps.getRates(base);
          lastKnownGood.set(base, rates);
          return { rates, source: "live" };
        } catch (err) {
          const cached = lastKnownGood.get(base);
          if (cached) {
            // Provider down this read but we have a prior live snapshot — serve
            // it. Conversion stays correct (not 1:1); the "stale" source +
            // cached `date` let the UI flag the staleness.
            return { rates: cached, source: "stale" };
          }
          // Cold start + provider down: no rate ever cached. We keep the 1:1
          // identity behaviour (downstream sees rates: null) but make it EXPLICIT
          // and logged — never again a silent 1:1.
          warn(
            `[fx] rates unavailable (cold start, no cached rate for base=${base}): ${
              err instanceof Error ? err.message : String(err)
            } — converting 1:1, source=unavailable`,
          );
          return { rates: null, source: "unavailable" };
        }
      },
    };
  }
  ```

  **Path:** `apps/api/src/common/market-data/fx-rates-reader.test.ts` (create)

  ```ts
  // apps/api/src/common/market-data/fx-rates-reader.test.ts
  // Last-known-good FX caching layer: live → stale → unavailable, never silent 1:1.
  import { describe, expect, test } from "bun:test";
  import { createFxRatesReader } from "./fx-rates-reader";
  import type { FxRates } from "@pekulo/validators";

  const RATES_A: FxRates = {
    base: "EUR",
    date: "2026-06-04",
    rates: { EUR: 1, USD: 1.08, GBP: 0.85, CHF: 0.95 },
  };
  const RATES_B: FxRates = {
    base: "EUR",
    date: "2026-06-05",
    rates: { EUR: 1, USD: 1.1, GBP: 0.86, CHF: 0.96 },
  };

  describe("createFxRatesReader", () => {
    test("success → source 'live' and the fresh rates", async () => {
      const reader = createFxRatesReader({ getRates: async () => RATES_A });
      const out = await reader.read("EUR");
      expect(out.source).toBe("live");
      expect(out.rates).toEqual(RATES_A);
    });

    test("failure AFTER a prior success → source 'stale' with the last-known-good rates", async () => {
      let succeed = true;
      const reader = createFxRatesReader({
        getRates: async () => {
          if (succeed) return RATES_A;
          throw new Error("frankfurter down");
        },
      });

      const first = await reader.read("EUR");
      expect(first.source).toBe("live");
      expect(first.rates).toEqual(RATES_A);

      succeed = false;
      const second = await reader.read("EUR");
      expect(second.source).toBe("stale");
      // The cached rates are served — NEVER a 1:1 fallback.
      expect(second.rates).toEqual(RATES_A);
    });

    test("a later success overwrites the cached last-known-good", async () => {
      let current: FxRates | Error = RATES_A;
      const reader = createFxRatesReader({
        getRates: async () => {
          if (current instanceof Error) throw current;
          return current;
        },
      });

      await reader.read("EUR");
      current = RATES_B;
      const live = await reader.read("EUR");
      expect(live.source).toBe("live");
      expect(live.rates).toEqual(RATES_B);

      current = new Error("down");
      const stale = await reader.read("EUR");
      expect(stale.source).toBe("stale");
      expect(stale.rates).toEqual(RATES_B);
    });

    test("cold start + failure → source 'unavailable', rates null, AND a structured warn log", async () => {
      const logs: string[] = [];
      const reader = createFxRatesReader({
        getRates: async () => {
          throw new Error("frankfurter down");
        },
        warn: (message) => logs.push(message),
      });

      const out = await reader.read("EUR");
      expect(out.source).toBe("unavailable");
      expect(out.rates).toBeNull();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toContain("[fx]");
      expect(logs[0]).toContain("unavailable");
      expect(logs[0]).toContain("base=EUR");
      expect(logs[0]).toContain("frankfurter down");
    });

    test("read never throws even when getRates rejects", async () => {
      const reader = createFxRatesReader({
        getRates: async () => {
          throw new Error("boom");
        },
        warn: () => {},
      });

      await expect(reader.read("EUR")).resolves.toMatchObject({ source: "unavailable" });
    });
  });
  ```

  **Path:** `apps/api/src/modules/dashboard/dashboard.service.ts` (modify — import the moved reader)

  ```ts
  import { createFxRatesReader } from "../../common/market-data/fx-rates-reader";
  ```

  **Run:**
  ```bash
  git rm apps/api/src/modules/dashboard/fx-rates-source.ts apps/api/src/modules/dashboard/fx-rates-source.test.ts
  bun --filter='@pekulo/api' run test src/common/market-data/fx-rates-reader.test.ts src/modules/dashboard/dashboard.service.test.ts
  ```

  **Expected:** both files are removed, the moved reader suite passes and every dashboard FX test stays green.

  **Commit:** `git commit -m "refactor(#115): move FX reader to shared market-data (AC-1)"`

- [x] **T7 — Compose the orchestration service** [AC: AC-1, AC-2, AC-3]
  The service is the only layer that touches live prices, FX and the current month. The access check stays in the router gate; the analysis service must never be called from an ungated path.

  **Path:** `apps/api/src/modules/advisory/advisory-analysis.service.ts` (create)

  ```ts
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

        const [accounts, holdings, fx, equity, properties, compass, monthly] =
          await Promise.all([
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
  ```

  **Run:** `bun --filter='@pekulo/api' run typecheck`

  **Expected:** exit 0.

  **Commit:** `git commit -m "feat(#115): advisory analysis orchestration service (AC-1, AC-2, AC-3)"`

- [x] **T8 — Cover the service branches with stub ports** [AC: AC-1, AC-2, AC-3]
  The service tests use the same reference totals as the engine suite, then isolate the orchestration-only concerns: UTC month selection, no-price path, compass failure, FX outage and pricing outage.

  **Path:** `apps/api/src/modules/advisory/advisory-analysis.service.test.ts` (create)

  ```ts
  import { describe, expect, test } from "bun:test";
  import type {
    Account,
    FxRates,
    GetMonthlyOutput,
    Holding,
    RealEstate,
    TotalEquityOutput,
  } from "@pekulo/validators";
  import {
    createAdvisoryAnalysisService,
    type AdvisoryAnalysisPorts,
  } from "./advisory-analysis.service";

  const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const NOW = new Date("2026-10-27T00:00:00Z");
  const ACC_LIVRET = "acc_000000000000000000000";
  const ACC_PEA = "acc_000000000000000000001";
  const RES_ID = "res_000000000000000000000";

  function acct(over: Partial<Account> = {}): Account {
    return {
      id: ACC_LIVRET,
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

  function hold(over: Partial<Holding> = {}): Holding {
    return {
      id: "hld_000000000000000000001",
      userId: USER,
      accountId: ACC_LIVRET,
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

  function property(over: Partial<RealEstate> = {}): RealEstate {
    return {
      id: RES_ID,
      userId: USER,
      label: "Résidence",
      propertyType: "residence-principale",
      currentValuation: 300_000,
      lastValuedOn: NOW,
      createdAt: NOW,
      updatedAt: NOW,
      ...over,
    };
  }

  const RATES: FxRates = {
    base: "EUR",
    date: "2026-10-27",
    rates: { EUR: 1, USD: 1.08, GBP: 0.85, CHF: 0.95 },
  };

  const MONTHLY: GetMonthlyOutput = {
    source: "derived",
    record: {
      year: 2026,
      monthNum: 10,
      incomeEur: 5_000,
      spendingEur: 3_000,
      transfersEur: 500,
      netChangeEur: 2_000,
      signedOffAt: null,
    },
  };

  const EQUITY: TotalEquityOutput = {
    totalEquityEur: 250_000,
    perProperty: [{ propertyId: RES_ID, netEquityEur: 250_000 }],
  };

  function basePorts(over: Partial<AdvisoryAnalysisPorts> = {}): AdvisoryAnalysisPorts {
    return {
      listAccounts: async () => [
        acct({ id: ACC_LIVRET, type: "livret", cashBalance: 10_000 }),
        acct({ id: ACC_PEA, type: "pea", cashBalance: 10_000 }),
      ],
      listHoldings: async () =>
        Array.from({ length: 6 }, (_, index) =>
          hold({
            id: `hld_${(index + 1).toString().padStart(21, "0")}`,
            accountId: index < 3 ? ACC_LIVRET : ACC_PEA,
            ticker: `T${index + 1}`,
          }),
        ),
      resolveQuote: async ({ ticker }) => ({
        symbol: ticker ?? "T",
        price: 100,
        currency: "EUR",
        marketTime: "2026-10-27",
        provider: "yahoo",
      }),
      getRates: async () => RATES,
      getTotalEquity: async () => EQUITY,
      listProperties: async () => [property()],
      getCompass: async () => ({ objectif: 800_000 }),
      getMonthly: async () => MONTHLY,
      clock: () => NOW,
      warn: () => {},
      ...over,
    };
  }

  describe("createAdvisoryAnalysisService", () => {
    test("AC-1 — composes the reference snapshot and selects the current UTC month", async () => {
      let period: { year: number; monthNum: number } | undefined;
      const service = createAdvisoryAnalysisService(
        basePorts({
          getMonthly: async (_userId, input) => {
            period = input;
            return MONTHLY;
          },
        }),
      );

      const snapshot = await service.getSnapshot(USER);

      expect(period).toEqual({ year: 2026, monthNum: 10 });
      expect(snapshot.wealth.totalEur).toBe(276_000);
      expect(snapshot.portfolio?.holdingsCount).toBe(6);
      expect(snapshot.monthlyCashflow).toEqual({
        year: 2026,
        monthNum: 10,
        incomeEur: 5_000,
        spendingEur: 3_000,
        transfersEur: 500,
        netChangeEur: 2_000,
        source: "derived",
      });
      expect(snapshot.fx).toEqual({ base: "EUR", source: "live", asOf: "2026-10-27" });
    });

    test("AC-2 — no holdings never calls the price chain and returns portfolio null", async () => {
      let quoteCalls = 0;
      const service = createAdvisoryAnalysisService(
        basePorts({
          listHoldings: async () => [],
          resolveQuote: async () => {
            quoteCalls += 1;
            throw new Error("unused");
          },
        }),
      );

      const snapshot = await service.getSnapshot(USER);

      expect(snapshot.portfolio).toBeNull();
      expect(quoteCalls).toBe(0);
      expect(snapshot.wealth.totalEur).toBe(270_000);
    });

    test("AC-3 — two service calls over the same ports are deep-equal", async () => {
      const service = createAdvisoryAnalysisService(basePorts());

      const first = await service.getSnapshot(USER);
      const second = await service.getSnapshot(USER);

      expect(second).toEqual(first);
    });

    test("AC-1 — a compass read failure degrades to compass null", async () => {
      const service = createAdvisoryAnalysisService(
        basePorts({
          getCompass: async () => {
            throw new Error("compass read down");
          },
        }),
      );

      const snapshot = await service.getSnapshot(USER);

      expect(snapshot.compass).toBeNull();
      expect(snapshot.wealth.totalEur).toBe(276_000);
    });

    test("AC-1 — a cold FX outage is explicit and converts 1:1", async () => {
      const warnings: string[] = [];
      const service = createAdvisoryAnalysisService(
        basePorts({
          getRates: async () => {
            throw new Error("frankfurter down");
          },
          warn: (message) => warnings.push(message),
        }),
      );

      const snapshot = await service.getSnapshot(USER);

      expect(snapshot.fx).toEqual({
        base: "EUR",
        source: "unavailable",
        asOf: null,
      });
      expect(snapshot.wealth.investmentsEur).toBe(6_000);
      expect(warnings).toHaveLength(1);
    });

    test("AC-1 — a pricing outage falls back to the stored lastPrice", async () => {
      const service = createAdvisoryAnalysisService(
        basePorts({
          resolveQuote: async () => {
            throw new Error("all tiers down");
          },
        }),
      );

      const snapshot = await service.getSnapshot(USER);

      expect(snapshot.wealth.investmentsEur).toBe(5_400);
      expect(snapshot.wealth.totalEur).toBe(275_400);
    });

    test("AC-1 — a persisted monthly envelope keeps its source", async () => {
      const service = createAdvisoryAnalysisService(
        basePorts({
          getMonthly: async () => ({
            source: "persisted",
            record: {
              id: "mr_000000000000000000000",
              year: 2026,
              monthNum: 10,
              incomeEur: 1_000,
              spendingEur: 500,
              transfersEur: 100,
              netChangeEur: 500,
              signedOffAt: "2026-11-03T00:00:00.000Z",
              createdAt: "2026-11-03T00:00:00.000Z",
            },
          }),
        }),
      );

      const snapshot = await service.getSnapshot(USER);

      expect(snapshot.monthlyCashflow.source).toBe("persisted");
      expect(snapshot.monthlyCashflow.netChangeEur).toBe(500);
    });
  });
  ```

  **Run:** `bun --filter='@pekulo/api' run test src/modules/advisory/advisory-analysis.service.test.ts`

  **Expected:** all service tests pass, including the UTC month assertion and both outage paths.

  **Commit:** `git commit -m "test(#115): advisory analysis service coverage (AC-1, AC-2, AC-3)"`

- [x] **T9 — Expose the snapshot procedure in the advisory contract** [AC: AC-1, AC-4]
  The procedure has no input: the subject is always the JWT user and the gate already ran. Declaring the same typed errors keeps the 403 envelope identical to the 12-1 procedures.

  **Path:** `packages/contracts/src/advisory/advisory.contract.ts` (modify — imports)

  ```ts
  import { oc } from "@orpc/contract";
  import {
    advisoryAccessEntrySchema,
    advisoryAccessListSchema,
    advisorySnapshotSchema,
    advisoryStatusSchema,
    advisoryTargetInputSchema,
  } from "@pekulo/validators";
  ```

  **Path:** `packages/contracts/src/advisory/advisory.contract.ts` (modify — add the procedure)

  ```ts
  export const advisoryContractV1 = {
    status: oc.output(advisoryStatusSchema).errors(advisoryErrors),
    snapshot: oc.output(advisorySnapshotSchema).errors(advisoryErrors),
    grant: oc
      .input(advisoryTargetInputSchema)
      .output(advisoryAccessEntrySchema)
      .errors(advisoryErrors),
    ban: oc.input(advisoryTargetInputSchema).output(advisoryAccessEntrySchema).errors(advisoryErrors),
    list: oc.output(advisoryAccessListSchema).errors(advisoryErrors),
  } as const;
  ```

  **Run:** `bun --filter='@pekulo/contracts' run typecheck`

  **Expected:** exit 0. Do not run the API typecheck at this point: the contract now exposes a procedure the API router does not implement yet, so T10 closes that gap.

  **Commit:** `git commit -m "feat(#115): advisory snapshot contract procedure (AC-1, AC-4)"`

- [x] **T10 — Implement the gated snapshot handler and its route tests** [AC: AC-1, AC-4]
  The handler is mounted on the same gated router as the 12-1 procedures, so the 12-1 middleware runs before `getSnapshot` and AC-4 is inherited by construction.

  **Path:** `apps/api/src/modules/advisory/advisory.routes.ts` (modify — import and signature)

  ```ts
  import type { AdvisoryAccessService } from "./advisory.service";
  import type { AdvisoryAnalysisService } from "./advisory-analysis.service";

  const impl = implement(advisoryContract).$context<{
    userId: string;
    email: string | null;
  }>();

  function requireUserId(userId: string | undefined): asserts userId is string {
    if (!userId || !userId.trim()) {
      throw new PekuloError("UNAUTHORIZED", "user context missing");
    }
  }

  export function createAdvisoryRouter(deps: {
    service: AdvisoryAccessService;
    analysis: AdvisoryAnalysisService;
  }) {
  ```

  **Path:** `apps/api/src/modules/advisory/advisory.routes.ts` (modify — add the handler)

  ```ts
      list: gated.list.handler(async ({ context, errors }) => {
        requireUserId(context.userId);
        try {
          return await deps.service.list(context.userId);
        } catch (err) {
          if (isPekuloError(err) && err.code === "FORBIDDEN") {
            throw errors.FORBIDDEN({ message: err.message });
          }
          throw err;
        }
      }),

      snapshot: gated.snapshot.handler(async ({ context }) => {
        requireUserId(context.userId);
        return deps.analysis.getSnapshot(context.userId);
      }),
    });
  }
  ```

  **Path:** `apps/api/src/modules/advisory/advisory.test-fixtures.ts` (create)

  ```ts
  import type { AdvisorySnapshot } from "@pekulo/types";

  export function advisorySnapshotFixture(): AdvisorySnapshot {
    return {
      schemaVersion: 1,
      baseCurrency: "EUR",
      wealth: {
        totalEur: 276_000,
        investableEur: 26_000,
        cashEur: 20_000,
        investmentsEur: 6_000,
        realEstateEquityEur: 250_000,
        unrealizedPnlEur: 1_200,
      },
      allocation: [
        { key: "cash", amountEur: 20_000, pct: 7.2 },
        { key: "investments", amountEur: 6_000, pct: 2.2 },
        { key: "real-estate", amountEur: 250_000, pct: 90.6 },
      ],
      compass: {
        targetEur: 800_000,
        currentWealthEur: 26_000,
        percent: 3.3,
        gapEur: 774_000,
      },
      monthlyCashflow: {
        year: 2026,
        monthNum: 10,
        incomeEur: 5_000,
        spendingEur: 3_000,
        transfersEur: 500,
        netChangeEur: 2_000,
        source: "derived",
      },
      portfolio: {
        holdingsCount: 1,
        investedEur: 800,
        marketValueEur: 900,
        pnlEur: 100,
        byKind: [
          { kind: "etf", marketValueEur: 900, pct: 100 },
          { kind: "action", marketValueEur: 0, pct: 0 },
          { kind: "crypto", marketValueEur: 0, pct: 0 },
          { kind: "autre", marketValueEur: 0, pct: 0 },
        ],
        positions: [
          {
            holdingId: "hld_000000000000000000000",
            accountId: "acc_000000000000000000000",
            ticker: "CW8",
            label: "ETF Monde",
            kind: "etf",
            currency: "EUR",
            quantity: 10,
            avgCost: 80,
            lastPrice: 90,
            marketValueEur: 900,
            pnlEur: 100,
            pnlPct: 0.125,
          },
        ],
      },
      fiscalite: {
        computation: "none",
        envelopes: [{ accountType: "pea", amountEur: 26_000, pct: 100 }],
        properties: [
          { propertyType: "residence-principale", netEquityEur: 250_000, pct: 90.6 },
        ],
        cryptoEur: 0,
      },
      fx: { base: "EUR", source: "live", asOf: "2026-10-27" },
    };
  }
  ```

  **Path:** `apps/api/src/modules/advisory/advisory.routes.test.ts` (replace the file)

  ```ts
  // AC-1, AC-3, AC-4, AC-8 (verbatim from story 12-1-advisory-access-gate):
  //   AC-1 (deny before compute) — Given a signed-in user who is neither an owner nor
  //   the holder of an active advisory_access row, When they call any /rpc/v1/advisory/*
  //   procedure, Then the API answers 403 FORBIDDEN within the 100 ms gate budget, the
  //   procedure handler never runs, and no advisory data is read or computed.
  //   AC-8 (owner operations) — Given an owner configured in the environment, When
  //   they call status, list, grant or ban, Then the calls succeed; an active non-owner
  //   calling list, grant or ban gets 403; granting or banning an owner returns 400
  //   BAD_REQUEST; the owner is implicitly allowed without a record; and granted_by is
  //   the owner from the JWT, never a client-supplied value.

  import { describe, expect, test } from "bun:test";
  import { createRouterClient } from "@orpc/server";
  import { PekuloError } from "../../common/errors";
  import { advisorySnapshotFixture } from "./advisory.test-fixtures";
  import type { AdvisoryAccessService } from "./advisory.service";
  import type { AdvisoryAnalysisService } from "./advisory-analysis.service";
  import { createAdvisoryRouter } from "./advisory.routes";

  function service(over: Partial<AdvisoryAccessService> = {}): AdvisoryAccessService {
    return {
      isOwner: () => false,
      assertAllowed: async () => {},
      getStatus: async () => ({ access: "active", owner: false }),
      list: async () => [],
      grant: async () => ({}) as any,
      ban: async () => ({}) as any,
      ...over,
    };
  }

  function analysis(over: Partial<AdvisoryAnalysisService> = {}): AdvisoryAnalysisService {
    return {
      getSnapshot: async () => advisorySnapshotFixture(),
      ...over,
    };
  }

  describe("createAdvisoryRouter", () => {
    test("creates a router with status, snapshot, grant, ban and list handlers", () => {
      const router = createAdvisoryRouter({ service: service(), analysis: analysis() });

      expect(router).toHaveProperty("status");
      expect(router).toHaveProperty("snapshot");
      expect(router).toHaveProperty("grant");
      expect(router).toHaveProperty("ban");
      expect(router).toHaveProperty("list");
    });

    test("status handler invokes getStatus for allowlisted user", async () => {
      const router = createAdvisoryRouter({ service: service(), analysis: analysis() });
      const client = createRouterClient(router, { context: { userId: "user-1", email: null } });

      const status = await client.status();

      expect(status).toEqual({ access: "active", owner: false });
    });

    test("snapshot handler returns the analysis snapshot for an allowlisted user", async () => {
      const router = createAdvisoryRouter({ service: service(), analysis: analysis() });
      const client = createRouterClient(router, { context: { userId: "user-1", email: null } });

      const snapshot = await client.snapshot();

      expect(snapshot).toEqual(advisorySnapshotFixture());
    });

    test("middleware rejects missing user context with typed UNAUTHORIZED (401)", async () => {
      const router = createAdvisoryRouter({ service: service(), analysis: analysis() });
      const client = createRouterClient(router, { context: { userId: "", email: null } });
      let error: any;
      try {
        await client.status();
      } catch (err) {
        error = err;
      }

      expect(error?.code).toBe("UNAUTHORIZED");
      expect(error?.status).toBe(401);
    });

    test("middleware maps PekuloError FORBIDDEN to typed contract FORBIDDEN (403)", async () => {
      const router = createAdvisoryRouter({
        service: service({
          assertAllowed: async () => {
            throw new PekuloError("FORBIDDEN", "restricted access");
          },
        }),
        analysis: analysis(),
      });
      const client = createRouterClient(router, { context: { userId: "user-1", email: null } });
      let error: any;
      try {
        await client.status();
      } catch (err) {
        error = err;
      }

      expect(error?.code).toBe("FORBIDDEN");
      expect(error?.status).toBe(403);
    });

    test("AC-4 — the snapshot gate rejects before the analysis engine runs", async () => {
      let engineCalls = 0;
      const router = createAdvisoryRouter({
        service: service({
          assertAllowed: async () => {
            throw new PekuloError("FORBIDDEN", "restricted access");
          },
        }),
        analysis: analysis({
          getSnapshot: async () => {
            engineCalls += 1;
            return advisorySnapshotFixture();
          },
        }),
      });
      const client = createRouterClient(router, { context: { userId: "user-1", email: null } });
      let error: any;
      try {
        await client.snapshot();
      } catch (err) {
        error = err;
      }

      expect(error?.code).toBe("FORBIDDEN");
      expect(error?.status).toBe(403);
      expect(engineCalls).toBe(0);
    });
  });
  ```

  **Run:** `bun --filter='@pekulo/api' run test src/modules/advisory/advisory.routes.test.ts`

  **Expected:** all route tests pass, including the snapshot handler and the gate-before-engine assertion.

  **Commit:** `git commit -m "feat(#115): gated advisory snapshot handler (AC-1, AC-4)"`

- [x] **T11 — Wire the analysis service into the module factory** [AC: AC-1, AC-4]
  The module factory now returns the access service, the analysis service and the single gated router. The router remains the only mount point, so no ungated snapshot path exists.

  **Path:** `apps/api/src/modules/advisory/advisory.module.ts` (replace the file)

  ```ts
  // Module factory wiring repository + access service + analysis service + router
  // for the private advisory surface (stories 12-1 and 12-2, ADR-0016 §3/§4).
  // Mirrors ADR-0009 (createXxxModule(deps) → { service, analysis, router }).
  import type { PrismaService } from "../../database";
  import {
    createAdvisoryAnalysisService,
    type AdvisoryAnalysisPorts,
    type AdvisoryAnalysisService,
  } from "./advisory-analysis.service";
  import { createAdvisoryRepository } from "./advisory.repository";
  import { createAdvisoryService, type AdvisoryAccessService } from "./advisory.service";
  import { createAdvisoryRouter } from "./advisory.routes";

  export interface AdvisoryModule {
    service: AdvisoryAccessService;
    analysis: AdvisoryAnalysisService;
    router: ReturnType<typeof createAdvisoryRouter>;
  }

  export function createAdvisoryModule(
    deps: {
      prismaService: PrismaService;
      ownerUserIds: ReadonlySet<string>;
    } & AdvisoryAnalysisPorts,
  ): AdvisoryModule {
    const repository = createAdvisoryRepository({ client: deps.prismaService.client });
    const service = createAdvisoryService({
      repository,
      ownerUserIds: deps.ownerUserIds,
    });
    const analysis = createAdvisoryAnalysisService(deps);
    const router = createAdvisoryRouter({ service, analysis });
    return { service, analysis, router };
  }
  ```

  **Path:** `apps/api/src/modules/advisory/advisory.module.test.ts` (replace the file)

  ```ts
  // AC-1, AC-8 (verbatim from story 12-1-advisory-access-gate):
  //   AC-1 (deny before compute) — Given a signed-in user who is neither an owner nor
  //   the holder of an active advisory_access row, When they call any /rpc/v1/advisory/*
  //   procedure, Then the API answers 403 FORBIDDEN within the 100 ms gate budget, the
  //   procedure handler never runs, and no advisory data is read or computed.
  //   AC-8 (owner operations) — Given an owner configured in the environment, When
  //   they call status, list, grant or ban, Then the calls succeed; an active non-owner
  //   calling list, grant or ban gets 403; granting or banning an owner returns 400
  //   BAD_REQUEST; the owner is implicitly allowed without a record; and granted_by is
  //   the owner from the JWT, never a client-supplied value.

  import { describe, expect, test } from "bun:test";
  import type { PrismaService } from "../../database";
  import { createAdvisoryModule } from "./advisory.module";

  describe("createAdvisoryModule", () => {
    test("wires repository, services and router with owner set", () => {
      const prismaService = {
        client: {
          advisoryAccess: {},
        },
      } as unknown as PrismaService;

      const mod = createAdvisoryModule({
        prismaService,
        ownerUserIds: new Set(["owner-1"]),
        listAccounts: async () => [],
        listHoldings: async () => [],
        resolveQuote: async () => {
          throw new Error("unused");
        },
        getRates: async () => ({
          base: "EUR",
          date: "2026-10-27",
          rates: { EUR: 1, USD: 1.08, GBP: 0.85, CHF: 0.95 },
        }),
        getTotalEquity: async () => ({ totalEquityEur: 0, perProperty: [] }),
        listProperties: async () => [],
        getCompass: async () => null,
        getMonthly: async (_userId, input) => ({
          source: "derived",
          record: {
            year: input.year,
            monthNum: input.monthNum,
            incomeEur: 0,
            spendingEur: 0,
            transfersEur: 0,
            netChangeEur: 0,
            signedOffAt: null,
          },
        }),
      });

      expect(mod).toHaveProperty("service");
      expect(mod).toHaveProperty("analysis");
      expect(mod).toHaveProperty("router");
      expect(mod.service.isOwner("owner-1")).toBe(true);
      expect(mod.service.isOwner("other")).toBe(false);
    });
  });
  ```

  **Run:** `bun --filter='@pekulo/api' run test src/modules/advisory/advisory.module.test.ts`

  **Expected:** the module test passes and exposes `service`, `analysis` and `router`.

  **Commit:** `git commit -m "feat(#115): wire advisory analysis into module factory (AC-1, AC-4)"`

- [x] **T12 — Wire the production ports at the composition root** [AC: AC-1, AC-4]
  Every port is an existing module service or the holdings price/FX surface. There is no new environment variable and no new Prisma query outside the existing modules.

  **Path:** `apps/api/src/bootstrap/runtime-dependencies.ts` (modify — extend the advisory module construction)

  ```ts
    // Story 12-1 (ADR-0016 §4) — private advisory access gate. The owner set is
    // parsed from env here, at the composition root; the module itself never
    // reads process.env.
    // Story 12-2 (ADR-0016 §3) — deterministic snapshot ports. The advisory
    // module composes existing services; it owns no table and no LLM path.
    const advisoryModule = createAdvisoryModule({
      prismaService,
      ownerUserIds: parseAdvisoryOwnerUserIds(input.env.ADVISORY_OWNER_USER_IDS),
      listAccounts: (userId) => accountsModule.service.list(userId),
      listHoldings: (userId) => holdingsModule.service.list(userId, { includeClosed: false }),
      resolveQuote: (input) => holdingsModule.service.resolveQuote(input),
      getRates: (base) => holdingsModule.frankfurterClient.getRates(base),
      getTotalEquity: (userId) => realestateModule.service.getTotalEquity(userId),
      listProperties: (userId) => realestateModule.service.listProperties(userId),
      getCompass: (userId) => compassModule.service.getCompass(userId),
      getMonthly: (userId, input) => monthlyModule.service.getMonthly(userId, input),
    });
  ```

  **Run:**
  ```bash
  bun --filter='@pekulo/api' run typecheck
  bun --filter='@pekulo/api' run test src/modules/advisory/advisory.module.test.ts src/modules/advisory/advisory.routes.test.ts
  ```

  **Expected:** typecheck exits 0; both advisory suites pass with the production-shaped ports.

  **Commit:** `git commit -m "feat(#115): wire advisory analysis ports at runtime (AC-1, AC-4)"`

- [x] **T13 — Prove the gate inheritance across the HTTP boundary** [AC: AC-4]
  The integration test boots the real router, real gate service and real RPC mount. The analysis stub counts calls, so the test can prove the engine is unreachable for a non-allowlisted or banned caller.

  **Path:** `apps/api/src/modules/advisory/advisory.integration.test.ts` (modify — imports)

  ```ts
  import { afterAll, beforeAll, describe, expect, test } from "bun:test";
  import { Elysia } from "elysia";
  import { SignJWT } from "jose";
  import type { AdvisorySnapshot } from "@pekulo/types";
  import type { AdvisoryAccessEntry } from "@pekulo/validators";
  import { extractRequestId } from "../../common/errors";
  import { mapErrorToOrpcResponse } from "../../platform/http/error-mapper";
  import { mountOrpc, type PekuloRpcRouter } from "../../platform/http/orpc-mount";
  import { createJwtVerifier } from "../../platform/security";
  import type { AdvisoryAccessRepository } from "./advisory.repository";
  import { createAdvisoryRouter } from "./advisory.routes";
  import { createAdvisoryService } from "./advisory.service";
  import type { AdvisoryAnalysisService } from "./advisory-analysis.service";
  import { advisorySnapshotFixture } from "./advisory.test-fixtures";
  ```

  **Path:** `apps/api/src/modules/advisory/advisory.integration.test.ts` (modify — analysis stub)

  ```ts
  const repository = new InMemoryAdvisoryRepository();
  let snapshotReads = 0;
  const analysis: AdvisoryAnalysisService = {
    async getSnapshot() {
      snapshotReads += 1;
      return advisorySnapshotFixture();
    },
  };
  ```

  **Path:** `apps/api/src/modules/advisory/advisory.integration.test.ts` (modify — router construction)

  ```ts
    const router = createAdvisoryRouter({ service, analysis });
  ```

  **Path:** `apps/api/src/modules/advisory/advisory.integration.test.ts` (append after the 12-1 describe block)

  ```ts
  describe("advisory snapshot /rpc/v1/advisory HTTP boundary (story 12-2)", () => {
    test("AC-4 — an unknown caller is 403 and the engine never runs", async () => {
      repository.rows.delete(USER_UNKNOWN);
      const before = snapshotReads;

      const res = await call("snapshot", {}, await signFor(USER_UNKNOWN));

      expect(res.status).toBe(403);
      const body = (await res.json()) as { json: { code: string } };
      expect(body.json.code).toBe("FORBIDDEN");
      expect(snapshotReads).toBe(before);
    });

    test("AC-4 — a banned caller is 403 and the engine never runs", async () => {
      repository.rows.set(USER_BANNED, entry(USER_BANNED, "banned"));
      const before = snapshotReads;

      const res = await call("snapshot", {}, await signFor(USER_BANNED));

      expect(res.status).toBe(403);
      const body = (await res.json()) as { json: { code: string } };
      expect(body.json.code).toBe("FORBIDDEN");
      expect(snapshotReads).toBe(before);
    });

    test("AC-1 — an active allowlisted caller receives the snapshot", async () => {
      repository.rows.set(USER_MEMBER, entry(USER_MEMBER, "active"));
      const before = snapshotReads;

      const res = await call("snapshot", {}, await signFor(USER_MEMBER));

      expect(res.status).toBe(200);
      const body = (await res.json()) as { json: AdvisorySnapshot };
      expect(body.json.wealth.totalEur).toBe(276_000);
      expect(body.json.portfolio?.holdingsCount).toBe(1);
      expect(snapshotReads).toBe(before + 1);
    });
  });
  ```

  **Run:** `bun --filter='@pekulo/api' run test src/modules/advisory/advisory.integration.test.ts`

  **Expected:** the 12-1 boundary tests still pass and the three new snapshot tests prove 403-before-engine for unknown and banned callers plus 200 for an active allowlisted caller.

  **Commit:** `git commit -m "test(#115): snapshot gate inheritance across HTTP (AC-4)"`

- [x] **T14 — Lock the schema and contract, then run the final verification** [AC: AC-1, AC-5]
  This task closes the loop: the wire schema rejects any drift (including a computation claim or a malformed holding id), the contract advertises `snapshot`, and the full advisory surface is verified.

  **Path:** `apps/api/src/modules/advisory/advisory.snapshot.schemas.test.ts` (create)

  ```ts
  import { describe, expect, test } from "bun:test";
  import {
    ADVISORY_SNAPSHOT_SCHEMA_VERSION,
    advisorySnapshotSchema,
  } from "@pekulo/validators";
  import { advisorySnapshotFixture } from "./advisory.test-fixtures";

  describe("advisory snapshot schema", () => {
    test("accepts the reference snapshot", () => {
      expect(ADVISORY_SNAPSHOT_SCHEMA_VERSION).toBe(1);
      expect(advisorySnapshotSchema.safeParse(advisorySnapshotFixture()).success).toBe(true);
    });

    test("accepts portfolio: null", () => {
      const fixture = advisorySnapshotFixture();
      expect(advisorySnapshotSchema.safeParse({ ...fixture, portfolio: null }).success).toBe(true);
    });

    test("rejects an unknown schema version", () => {
      const fixture = advisorySnapshotFixture();
      expect(advisorySnapshotSchema.safeParse({ ...fixture, schemaVersion: 2 }).success).toBe(
        false,
      );
    });

    test("rejects any computation claim other than none", () => {
      const fixture = advisorySnapshotFixture();
      const parsed = advisorySnapshotSchema.safeParse({
        ...fixture,
        fiscalite: { ...fixture.fiscalite, computation: "tax" },
      });
      expect(parsed.success).toBe(false);
    });

    test("rejects a missing allocation block", () => {
      const { allocation, ...rest } = advisorySnapshotFixture();
      expect(allocation).toHaveLength(3);
      expect(advisorySnapshotSchema.safeParse(rest).success).toBe(false);
    });

    test("rejects an invalid holding id", () => {
      const fixture = advisorySnapshotFixture();
      const portfolio = fixture.portfolio;
      if (!portfolio) throw new Error("fixture must include a portfolio");
      const position = portfolio.positions[0];
      if (!position) throw new Error("fixture must include a position");
      const parsed = advisorySnapshotSchema.safeParse({
        ...fixture,
        portfolio: {
          ...portfolio,
          positions: [{ ...position, holdingId: "invalid" }],
        },
      });
      expect(parsed.success).toBe(false);
    });
  });
  ```

  **Path:** `apps/api/src/modules/advisory/advisory.contract.test.ts` (replace the file)

  ```ts
  // AC-8 (verbatim from story 12-1-advisory-access-gate):
  //   AC-8 (owner operations) — Given an owner configured in the environment, When
  //   they call status, list, grant or ban, Then the calls succeed; an active non-owner
  //   calling list, grant or ban gets 403; granting or banning an owner returns 400
  //   BAD_REQUEST; the owner is implicitly allowed without a record; and granted_by is
  //   the owner from the JWT, never a client-supplied value.

  import { describe, expect, test } from "bun:test";
  import {
    advisoryContract,
    advisoryContractMeta,
    advisoryContractV1,
    pekuloContract,
  } from "@pekulo/contracts";

  describe("advisory contract", () => {
    test("exposes status, snapshot, grant, ban, list procedures", () => {
      expect(advisoryContract).toHaveProperty("status");
      expect(advisoryContract).toHaveProperty("snapshot");
      expect(advisoryContract).toHaveProperty("grant");
      expect(advisoryContract).toHaveProperty("ban");
      expect(advisoryContract).toHaveProperty("list");
    });

    test("advisoryContract is alias of advisoryContractV1", () => {
      expect(advisoryContract).toBe(advisoryContractV1);
    });

    test("advisoryContractMeta provides moduleKey and mountPath", () => {
      expect(advisoryContractMeta).toEqual({
        moduleKey: "advisory",
        mountPath: "/rpc/v1/advisory",
        version: "v1",
      });
    });

    test("pekuloContract includes advisory contract", () => {
      expect(pekuloContract).toHaveProperty("advisory");
      expect(pekuloContract.advisory).toBe(advisoryContract);
    });
  });
  ```

  **Run:**
  ```bash
  bun --filter='@pekulo/api' run test src/modules/advisory/advisory.snapshot.schemas.test.ts src/modules/advisory/advisory.contract.test.ts
  bun --filter='@pekulo/api' run test src/modules/advisory src/common/derive/advisory-snapshot.test.ts src/common/market-data
  bun --filter='@pekulo/api' run typecheck
  bun run lint
  ```

  **Expected:** every command exits 0; the advisory, engine and market-data suites pass; typecheck and lint report no errors.

  **Commit:** `git commit -m "test(#115): snapshot schema and contract coverage (AC-1, AC-5)"`

## Dev Notes

- **Architecture:** ADR-0016 §3 is the requirement source. The deterministic engine owns every number on the private advisory surface; the LLM (12-3) may only explain and recommend over this snapshot. The engine is a pure derive under `apps/api/src/common/derive/` and composes the existing `portfolio-fx`, `holding-pnl` and `compass-progress` helpers. It performs no IO, reads no clock, calls no LLM and owns no table.
- **Default next story:** 12-3 will consume `AdvisorySnapshot` from `@pekulo/types` and build its dedicated prompt builder over it. Every field in the schema is therefore a deliberate, citable figure. Do not add a field to the snapshot "for convenience" in 12-3; extend the engine here if a new computed figure is needed.
- **Total vs investable:** `wealth.totalEur` includes real-estate equity (the hero figure). `compass` is computed on `wealth.investableEur` (cash + market value), matching the dashboard and the compass module (quick-spec 2026-06-10). Real estate is excluded from the cap because the primary residence would peg every compass near 100 %. The raw investable value is preserved even when negative; only the compass ratio clamps to 0.
- **Fiscalité is factual, not a tax engine:** the block exposes envelope exposure by account type, property equity by property type and crypto EUR exposure, with `computation: "none"`. The public PRD excludes tax computation, and ADR-0016 §3 requires the engine to own any figure the LLM cites. Do not add tax rates, taxable bases or tax-due amounts in this story. If the product later needs them, that is a separate engine change with its own requirements.
- **Portfolio block:** positions are instrument-level (holding id, account id, ticker, label, kind, native currency, quantity, average cost, last price, EUR market value, EUR PnL and PnL ratio). `byKind` is a four-row fixed-order aggregate of the portfolio market value, not of total wealth. This is what lets 12-3 recommend instruments without inventing figures.
- **Monthly cashflow:** the service asks the monthly module for the current UTC month. `getMonthly` already returns the persisted envelope when the month is signed off and the derived envelope otherwise. The snapshot copies the envelope and preserves `source: "derived" | "persisted"`; it does not re-derive transactions in the advisory module.
- **No `generatedAt`:** an ISO timestamp would make two runs over the same inputs differ and would weaken AC-3. The snapshot is a pure function of its inputs. Freshness is carried only by `fx.asOf` (the provider rate date) and by the monthly envelope's year/month.
- **Determinism:** allocation lines are always `cash`, `investments`, `real-estate`; fiscal envelopes follow the account-type order; fiscal properties follow the property-type order; `byKind` follows `etf`, `action`, `crypto`, `autre`; positions are sorted by EUR market value descending then holding id ascending. All percentages go through one `round1` helper. A denominator `<= 0` yields 0 %.
- **FX provenance:** the shared reader returns `live`, `stale` or `unavailable`. The pure `computeSnapshotFx` helper's own `fxSource` (`live`/`fallback`) is deliberately ignored; the reader is the authority. On a cold outage the reader returns `rates: null` and the engine converts 1:1, but the snapshot stamps `source: "unavailable"` and `asOf: null`, so the degradation is explicit.
- **Error posture:** the compass read is optional and degrades to `null`. The accounts, holdings, equity, properties and monthly reads are wealth-bearing or snapshot-bearing and intentionally have no catch: a failed read must surface rather than silently under-report the user's position. A per-quote price failure degrades to the stored `lastPrice`, exactly like the dashboard (NFR-18 spirit).
- **Shared market-data extraction:** `priceHoldings` and the FX reader move to `apps/api/src/common/market-data/` because two modules now need the same NFR-16 dedupe/concurrency and NFR-19 provenance policy. This is a mechanical extraction, not a new subsystem. The dashboard tests are the regression net; the moved FX test is unchanged.
- **Gate inheritance:** the `snapshot` handler is added to the same `gated` router as the 12-1 procedures. The 12-1 `.use()` middleware runs before any handler, so a non-allowlisted or banned caller is rejected before `analysis.getSnapshot` is reached. The analysis service deliberately has no access check; 12-3 must only call it from the gated advisory flow.
- **No persistence:** the snapshot is computed on read and returned. No advisory session or snapshot row is written in 12-2. Encryption-at-rest and session persistence belong to 12-3.
- **No new environment variable:** the only config remains `ADVISORY_OWNER_USER_IDS` from 12-1.
- **No migration:** no Prisma model, no SQL and no RLS change.
- **No LLM call:** the advisory LLM surface and its dedicated prompt builder are 12-3. This story must not import the llm module or `llm-prompt-builder.ts`.
- **CLI commands:** always use the workspace filter (lesson 2026-05-19): `bun --filter='@pekulo/api' run test …`, not a bare `bun test`. Bun test path arguments follow the script name.
- **Task ordering:** T1–T4 build and prove the pure layer; T5–T6 extract the shared market-data helpers; T7–T8 build the orchestration service; T9–T12 expose the contract, handler, module and runtime; T13–T14 prove the HTTP boundary and lock the schema. T9 intentionally leaves the API typecheck red until T10 adds the handler; that is the contract-first sequence, and T10 closes it in one commit.
- **Scope guardrails:** no UI (12-4), no LLM call (12-3), no advisory persistence, no migration, no new env, no public PRD FR. Do not change `sprint.active_epic`; this story remains outside the active sprint, as 12-1 did.
- **Doc-debt flag (pre-existing):** `docs/prd.md` (DR-3/NFR-12) and `docs/architecture.md` still do not mention ADR-0016 or the advisory carve-out. The epic cache records the gap. This story does not edit those documents; surface the gap for a dedicated doc-sync pass rather than smuggling an architecture rewrite into an implementation commit.
- **Lessons applied:** 2026-06-05 scope-expansion caution (the market-data extraction is mechanical and covered by existing tests); 2026-05-31 doc-sync is part of the change (flag, do not silently widen); 2026-05-19 workspace filter.
- **Testing:** the pure engine is tested against a hand-computed reference (276 000 € total, 26 000 € investable, 3.3 % compass, 774 000 € gap). The service tests isolate the orchestration branches with stub ports. The route tests use `createRouterClient` and a counting analysis stub. The integration test is the only HTTP boot and proves the 12-1 gate runs before the snapshot engine.
- **Dependencies:** no new package. The story uses existing `@pekulo/validators`, `@pekulo/types`, `@pekulo/contracts`, `@orpc/*`, `bun:test`, and the existing domain services. `fxSourceSchema`, `holdingSchema.shape.kind`, `holdingSchema.shape.currency`, `accountSchema.shape.type`, `holdingIdSchema` and `propertyTypeSchema` are already exported from the validators barrel; the story must not export the private enum mirrors.

### Existing code at write time (Step-0 quotes)

`packages/validators/src/advisory/index.ts` (current barrel — append the snapshot export):

```ts
export * from "./advisory.schemas";
```

`packages/types/src/index.ts` (current barrel — insert `export * from "./advisory";` after shared):

```ts
export * from "./shared";
export * from "./account";
export * from "./holding";
export * from "./transaction";
export * from "./milestone";
export * from "./monthly";
export * from "./realestate";
export * from "./composition";
export * from "./stat";
export * from "./compass";
export * from "./hypothesis";
export * from "./llm";
```

`apps/api/src/common/derive/portfolio-fx.ts` (current private helper — export it, keep the FX rule unchanged):

```ts
// INVARIANT: mirror of common/derive/holding-pnl.ts#convertToBase — keep in sync.
function convertToBase(amount: number, from: HoldingCurrency, rates: FxRates): number {
  if (from === rates.base) return amount;
  const r = rates.rates[from];
  if (!r || r <= 0) return amount; // unknown rate → identity (best-effort, mirrors brownfield)
  return amount / r;
}
```

`apps/api/src/modules/dashboard/dashboard.service.ts` (current imports — add the shared price helper in T5, then move the FX import in T6):

```ts
import { computeSnapshotFx } from "../../common/derive/portfolio-fx";
import { computeMonthlyGap, computeRequiredCurve } from "../../common/derive/hypothesis-gap";
import { createFxRatesReader } from "./fx-rates-source";
```

`apps/api/src/modules/dashboard/dashboard.service.ts` (current local pricing block — delete it in T5):

```ts
  // Enrich each holding with a LIVE price; fall back to the stored lastPrice on
  // a null ticker (manual entry) or any resolveQuote rejection (all tiers
  // failed — NFR-18). The holdings module's 60s PricesCache fronts resolveQuote,
  // so steady-state loads are cache hits.
  //
  // Two guards keep this linear at the NFR-16 cap (≤500 holdings): (1) dedup
  // identical {ticker,kind,currency} so N lots of the same security resolve ONE
  // quote, and (2) bound concurrency so a COLD cache (after the 60s TTL) cannot
  // fan out 500 provider chains in a single tick (thundering-herd against the
  // upstream price providers).
  const PRICE_CONCURRENCY = 8;
  async function priceHoldings(holdings: Holding[]): Promise<Holding[]> {
    const quoteKey = (h: Holding) => `${h.ticker}|${h.kind}|${h.currency}`;
    const distinct = new Map<string, PriceQuoteInput>();
    for (const h of holdings) {
      if (!h.ticker) continue;
      const key = quoteKey(h);
      if (!distinct.has(key)) {
        distinct.set(key, { ticker: h.ticker, kind: h.kind, currency: h.currency });
      }
    }

    const prices = new Map<string, number>();
    const inputs = [...distinct.entries()];
    for (let i = 0; i < inputs.length; i += PRICE_CONCURRENCY) {
      const batch = inputs.slice(i, i + PRICE_CONCURRENCY);
      // Sequential by design: each batch runs in parallel, but batches are awaited
      // one at a time to bound the fan-out (parallelising ALL batches is exactly
      // the unbounded thundering-herd this guard prevents — NFR-16).
      // oxlint-disable-next-line no-await-in-loop -- bounded price fan-out, see above
      await Promise.all(
        batch.map(async ([key, input]) => {
          try {
            const quote = await deps.resolveQuote(input);
            prices.set(key, quote.price);
          } catch {
            // graceful fallback — leave unset, the holding keeps its stored lastPrice
          }
        }),
      );
    }

    return holdings.map((h) => {
      if (!h.ticker) return h;
      const price = prices.get(quoteKey(h));
      return price === undefined ? h : { ...h, lastPrice: price };
    });
  }
```

`apps/api/src/modules/dashboard/dashboard.service.ts` (current call site — pass the port to the shared helper):

```ts
      const priced = await priceHoldings(holdings);
```

`apps/api/src/modules/advisory/advisory.routes.ts` (current imports and signature — add the analysis service):

```ts
import { implement } from "@orpc/server";
import { advisoryContract } from "@pekulo/contracts";
import { isPekuloError, PekuloError } from "../../common/errors";
import type { AdvisoryAccessService } from "./advisory.service";

const impl = implement(advisoryContract).$context<{
  userId: string;
  email: string | null;
}>();

function requireUserId(userId: string | undefined): asserts userId is string {
  if (!userId || !userId.trim()) {
    throw new PekuloError("UNAUTHORIZED", "user context missing");
  }
}

export function createAdvisoryRouter(deps: { service: AdvisoryAccessService }) {
```

`apps/api/src/modules/advisory/advisory.routes.ts` (current tail — append the snapshot handler after `list`):

```ts
    list: gated.list.handler(async ({ context, errors }) => {
      requireUserId(context.userId);
      try {
        return await deps.service.list(context.userId);
      } catch (err) {
        if (isPekuloError(err) && err.code === "FORBIDDEN") {
          throw errors.FORBIDDEN({ message: err.message });
        }
        throw err;
      }
    }),
  });
}
```

`apps/api/src/modules/advisory/advisory.routes.test.ts` (current router constructions — every call needs `analysis`):

```ts
    const router = createAdvisoryRouter({ service });
```

`apps/api/src/modules/advisory/advisory.module.ts` (current file — extend the deps and return `analysis`):

```ts
// Module factory wiring repository + service + router for the private
// advisory access gate (story 12-1, ADR-0016 §4). Mirrors ADR-0009
// (createXxxModule(deps) → { service, router }).
import type { PrismaService } from "../../database";
import { createAdvisoryRepository } from "./advisory.repository";
import { createAdvisoryService, type AdvisoryAccessService } from "./advisory.service";
import { createAdvisoryRouter } from "./advisory.routes";

export interface AdvisoryModule {
  service: AdvisoryAccessService;
  router: ReturnType<typeof createAdvisoryRouter>;
}

export function createAdvisoryModule(deps: {
  prismaService: PrismaService;
  ownerUserIds: ReadonlySet<string>;
}): AdvisoryModule {
  const repository = createAdvisoryRepository({ client: deps.prismaService.client });
  const service = createAdvisoryService({
    repository,
    ownerUserIds: deps.ownerUserIds,
  });
  const router = createAdvisoryRouter({ service });
  return { service, router };
}
```

`apps/api/src/modules/advisory/advisory.module.test.ts` (current factory call — add every analysis port):

```ts
    const mod = createAdvisoryModule({
      prismaService,
      ownerUserIds: new Set(["owner-1"]),
    });
```

`packages/contracts/src/advisory/advisory.contract.ts` (current imports and procedure map — add `snapshot`):

```ts
import { oc } from "@orpc/contract";
import {
  advisoryAccessEntrySchema,
  advisoryAccessListSchema,
  advisoryStatusSchema,
  advisoryTargetInputSchema,
} from "@pekulo/validators";

const forbiddenError = {
  status: 403 as const,
  message: "advisory surface is restricted to allowlisted users",
};
const badRequestError = {
  status: 400 as const,
  message: "cannot change advisory access of an owner",
};
const unauthorizedError = {
  status: 401 as const,
  message: "authentication required",
};

const advisoryErrors = {
  FORBIDDEN: forbiddenError,
  BAD_REQUEST: badRequestError,
  UNAUTHORIZED: unauthorizedError,
} as const;

export const advisoryContractV1 = {
  status: oc.output(advisoryStatusSchema).errors(advisoryErrors),
  grant: oc
    .input(advisoryTargetInputSchema)
    .output(advisoryAccessEntrySchema)
    .errors(advisoryErrors),
  ban: oc.input(advisoryTargetInputSchema).output(advisoryAccessEntrySchema).errors(advisoryErrors),
  list: oc.output(advisoryAccessListSchema).errors(advisoryErrors),
} as const;
```

`apps/api/src/bootstrap/runtime-dependencies.ts` (current advisory construction — extend it with the analysis ports):

```ts
  // Story 12-1 (ADR-0016 §4) — private advisory access gate. The owner set is
  // parsed from env here, at the composition root; the module itself never
  // reads process.env.
  const advisoryModule = createAdvisoryModule({
    prismaService,
    ownerUserIds: parseAdvisoryOwnerUserIds(input.env.ADVISORY_OWNER_USER_IDS),
  });
```

`apps/api/src/modules/advisory/advisory.integration.test.ts` (current imports and router construction — add the analysis stub):

```ts
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { SignJWT } from "jose";
import type { AdvisoryAccessEntry } from "@pekulo/validators";
import { extractRequestId } from "../../common/errors";
import { mapErrorToOrpcResponse } from "../../platform/http/error-mapper";
import { mountOrpc, type PekuloRpcRouter } from "../../platform/http/orpc-mount";
import { createJwtVerifier } from "../../platform/security";
import type { AdvisoryAccessRepository } from "./advisory.repository";
import { createAdvisoryRouter } from "./advisory.routes";
import { createAdvisoryService } from "./advisory.service";
```

```ts
  const router = createAdvisoryRouter({ service });
```

`apps/api/src/modules/advisory/advisory.contract.test.ts` (current procedure assertion — add `snapshot`):

```ts
  test("exposes status, grant, ban, list procedures", () => {
    expect(advisoryContract).toHaveProperty("status");
    expect(advisoryContract).toHaveProperty("grant");
    expect(advisoryContract).toHaveProperty("ban");
    expect(advisoryContract).toHaveProperty("list");
  });
```

`docs/state.yaml` (current epic-12 entry — flip to `ready-for-dev` after the story file exists):

```yaml
    12-2-advisory-analysis-engine: {status: pending, depends_on: [12-1-advisory-access-gate, 1-1-compass-domain, 3-1-holdings-orpc-port, 4-1-realestate-domain, 5-1-transactions-record], ticket: "#115", worktree: null}
```

### Existing patterns to follow

- **Pure derive:** `apps/api/src/common/derive/compass-progress.ts` and `holding-pnl.ts` — no IO, no clock, all inputs by argument, hand-computed tests.
- **FX reader:** `apps/api/src/modules/dashboard/fx-rates-source.ts` — injected provider, injectable warn sink, in-memory last-known-good cache.
- **Pricing helper:** the current local `priceHoldings` in `apps/api/src/modules/dashboard/dashboard.service.ts` — dedupe by quote key, bounded batches, stored-price fallback.
- **Module factory:** `apps/api/src/modules/dashboard/dashboard.module.ts` — `createXxxModule(deps) → { router }`; this story extends the advisory shape to `{ service, analysis, router }`.
- **Contract + routes:** `advisory.contract.ts` and `advisory.routes.ts` (12-1) — `oc.output(...).errors(...)`, `implement(...).$context(...).use(...)`, typed error re-throw.
- **Route tests:** `advisory.routes.test.ts` (12-1) — `createRouterClient` with a context object, typed error assertions.
- **HTTP boundary:** `advisory.integration.test.ts` (12-1) — real Elysia + `mountOrpc` + jose HS256, fake repository, `PORT_BASE` clear of siblings.

### File decision map (why each file changes)

**`packages/validators/src/advisory/advisory.snapshot.schemas.ts`** — create
- **Decision:** the wire schema for the advisory snapshot, under the advisory validators folder next to the 12-1 schemas.
- **Why:** one trusted definition for the version-locked JSON contract; `schemaVersion` literal, `computation` literal enum limited to `"none"`, and `holdingId`/`accountId` refs to the existing ID regexes.
- **Risk if omitted:** the engine, contract and 12-3 could each invent a slightly different shape; AC-1's "every figure engine-computed" would be unverifiable.

**`packages/validators/src/advisory/index.ts`** — modify (add `export * from "./advisory.snapshot.schemas";`)
- **Decision:** re-export the snapshot schemas from the advisory barrel.
- **Why:** consumers import only from the package root for validators, mirroring 12-1.
- **Risk if omitted:** a dead schema; `advisory.snapshot.schemas.ts` would be unreachable from `@pekulo/validators`.

**`packages/types/src/advisory/advisory.types.ts`** — create
- **Decision:** re-export the snapshot types under the public domain types package.
- **Why:** 12-3 (LLM prompt builder) consumes `AdvisorySnapshot` from `@pekulo/types`, never from the engine's internal module.
- **Risk if omitted:** 12-3 imports a fake or ad-hoc snapshot type; the wire schema would be the only truth.

**`packages/types/src/advisory/index.ts`** — create
- **Decision:** barrel for the advisory types.
- **Why:** matches the `export * from "./X"` pattern of every other types subfolder.
- **Risk if omitted:** inconsistent import paths from `@pekulo/types`.

**`packages/types/src/index.ts`** — modify (add `export * from "./advisory";` after `./shared`)
- **Decision:** surface the advisory types at the package root.
- **Why:** all domain types are root-exported; the LLM and API packages import from root.
- **Risk if omitted:** `import type { AdvisorySnapshot } from "@pekulo/types"` fails at compile time.

**`apps/api/src/common/derive/advisory-snapshot.ts`** — create
- **Decision:** the pure deterministic engine (`computeAdvisorySnapshot`) that owns every advisory figure.
- **Why:** ADR-0016 §3 demands deterministic engine-owned numbers; a pure derive is testable without IO and matches the existing derives.
- **Risk if omitted:** figures would be computed twice, once in the API and once (unverifiably) by the LLM.

**`apps/api/src/common/derive/advisory-snapshot.test.ts`** — create
- **Decision:** hand-computed reference tests for the engine.
- **Why:** guards totals, percentages, gap and orderings against regression; reference 276 000 € / 26 000 € / 3.3 %.
- **Risk if omitted:** silent arithmetic drift in the figures the LLM will cite.

**`apps/api/src/common/market-data/price-holdings.ts`** — create
- **Decision:** extract the dashboard's dedupe + bounded-concurrency pricing into a shared helper.
- **Why:** advisory now needs the exact same NFR-16 behavior; duplicate implementations would diverge.
- **Risk if omitted:** the advisory snapshot prices uncapped and thundering-herds the providers on a cold cache.

**`apps/api/src/common/market-data/price-holdings.test.ts`** — create
- **Decision:** port the pricing behavior tests (dedupe, batch cap, fallback).
- **Why:** NFR-16/18 are behavior contracts, not implementation details.
- **Risk if omitted:** the extraction is a pure move with no safety net.

**`apps/api/src/common/market-data/fx-rates-reader.ts`** — create
- **Decision:** move `createFxRatesReader` (last-known-good FX) into the shared market-data folder.
- **Why:** advisory needs the same NFR-19 provenance policy; both modules import one reader.
- **Risk if omitted:** two FX policies (one silent-1:1, one provenance-aware) on the same money numbers.

**`apps/api/src/common/market-data/fx-rates-reader.test.ts`** — create
- **Decision:** the reader's tests move unchanged with it.
- **Why:** the provenance state machine (live→stale→unavailable) is already locked by tests.
- **Risk if omitted:** a moved file with no proof the move is byte-identical in behavior.

**`apps/api/src/common/derive/portfolio-fx.ts`** — modify (export `convertToBase`)
- **Decision:** export the existing private `convertToBase` so the engine reuses the one FX rule.
- **Why:** keep the invariant "mirror of holding-pnl" honest — one rule, two call sites.
- **Risk if omitted:** the engine would duplicate the division and drift from `holding-pnl`.

**`apps/api/src/modules/dashboard/dashboard.service.ts`** — modify (use shared helpers, delete local `priceHoldings`, swap FX import)
- **Decision:** dashboard calls the shared `priceHoldings` and the moved FX reader; its local block is deleted.
- **Why:** one implementation of the pricing/FX policy; dashboard behavior is unchanged (its tests prove it).
- **Risk if omitted:** two pricing implementations, and the advisory helper would be dead on day one.

**`apps/api/src/modules/advisory/advisory-analysis.service.ts`** — create
- **Decision:** `createAdvisoryAnalysisService` orchestrates the engine's inputs and returns a gated `getSnapshot`.
- **Why:** the engine stays pure; the service supplies accounts, holdings, priced quotes, FX, equity, properties, compass and monthly in parallel.
- **Risk if omitted:** the module would wire the engine directly into the router with no testable orchestration.

**`apps/api/src/modules/advisory/advisory-analysis.service.test.ts`** — create
- **Decision:** stub-port tests for each orchestration branch.
- **Why:** proves parallel reads, compass degradation, holdings pricing, and the return shape without HTTP.
- **Risk if omitted:** orchestration bugs (wrong period, missing read) only surface at the HTTP layer.

**`apps/api/src/modules/advisory/advisory.test-fixtures.ts`** — create
- **Decision:** shared `advisorySnapshotFixture` used by route tests, schema tests and the integration test.
- **Why:** one reference snapshot (276 000 €, one holding, three allocation lines) across the test suites.
- **Risk if omitted:** each suite re-invents a slightly different snapshot and tests drift apart.

**`apps/api/src/modules/advisory/advisory.routes.ts`** — modify (add `snapshot` to `deps` and handler)
- **Decision:** accept `analysis` and register a `snapshot` procedure inside the existing gated router.
- **Why:** the 12-1 `.use()` middleware then protects the engine before it ever runs; the handler is one line.
- **Risk if omitted:** the snapshot would be routed outside the gate or the contract would dangle.

**`apps/api/src/modules/advisory/advisory.routes.test.ts`** — modify (add analysis stub to each construction, snapshot handler tests)
- **Decision:** prove `snapshot` returns the analysis output and that errors map to typed oRPC errors.
- **Why:** the handler must follow the identical error contract as `list` (FORBIDDEN/UNAUTHORIZED).
- **Risk if omitted:** an untested handler leaks raw errors through the RPC boundary.

**`apps/api/src/modules/advisory/advisory.module.ts`** — modify (extend deps, return `analysis`)
- **Decision:** the module factory builds `analysis` from the runtime ports and returns `{ service, analysis, router }`.
- **Why:** the composition root must not know the service's dependencies; the factory wires them.
- **Risk if omitted:** `runtime-dependencies` would hand-wire the analysis service, breaking ADR-0009.

**`apps/api/src/modules/advisory/advisory.module.test.ts`** — modify (pass analysis ports, assert `analysis`)
- **Decision:** the factory smoke test covers the new deps and the returned shape.
- **Why:** a factory that compiles but wires nothing would fail loudly here, not in prod.
- **Risk if omitted:** a wiring typo passes typecheck but 500s at runtime.

**`packages/contracts/src/advisory/advisory.contract.ts`** — modify (add `snapshot` procedure with `advisorySnapshotSchema` + `advisoryErrors`)
- **Decision:** `snapshot: oc.output(advisorySnapshotSchema).errors(advisoryErrors)` after `status`.
- **Why:** the wire contract advertises the snapshot before any implementation; the LLM and client can rely on it.
- **Risk if omitted:** the client has no typed shape; 12-3 could drift from the wire.

**`apps/api/src/bootstrap/runtime-dependencies.ts`** — modify (pass analysis ports to `createAdvisoryModule`)
- **Decision:** the composition root passes resolved services (monthly, compass with catch, holdings client, real-estate, FX reader, provider).
- **Why:** the root is the only place with access to every port; the module stays framework-free.
- **Risk if omitted:** advisory ships without real data sources and returns a hollow snapshot in prod.

**`apps/api/src/modules/advisory/advisory.integration.test.ts`** — modify (analysis stub, snapshot gate tests)
- **Decision:** add a counting `analysis` stub and three HTTP tests (unknown 403, banned 403, allowlisted 200).
- **Why:** AC-4 is only proven where the real gate middleware and real RPC mount run.
- **Risk if omitted:** the gate's placement relative to the engine is asserted only by unit tests.

**`apps/api/src/modules/advisory/advisory.contract.test.ts`** — modify (assert `snapshot`)
- **Decision:** the procedure inventory asserts `snapshot` alongside status/grant/ban/list.
- **Why:** the contract is the source of truth for the surface; a missing procedure fails here.
- **Risk if omitted:** adding a procedure without advertising it in the contract test.

**`apps/api/src/modules/advisory/advisory.snapshot.schemas.test.ts`** — create
- **Decision:** schema acceptance/rejection lock (fixture, `portfolio: null`, version 2, computation `"tax"`, missing allocation, bad holding id).
- **Why:** the version literal and the `"none"` computation are story-critical invariants.
- **Risk if omitted:** a future "quick win" could loosen the schema without review.

**`apps/api/src/modules/dashboard/fx-rates-source.ts` + `fx-rates-source.test.ts`** — delete
- **Decision:** `git rm` after the readers move to `common/market-data`; nothing imports the old paths.
- **Why:** a dead dashboard-only copy invites a second FX policy.
- **Risk if omitted:** two readers; a future fix lands in the wrong one.

**`docs/state.yaml`** — modify (12-2 status → `ready-for-dev` after the story file exists)
- **Decision:** flip `status: pending` to `status: ready-for-dev`, keeping `depends_on`, `ticket` and `worktree`.
- **Why:** the state ledger is the source of truth for the pipeline; `aped-story` and `aped-sprint` read it.
- **Risk if omitted:** the pipeline never offers this story to a worktree.

## File List

**Creates**

- `packages/validators/src/advisory/advisory.snapshot.schemas.ts`
- `packages/types/src/advisory/advisory.types.ts`
- `packages/types/src/advisory/index.ts`
- `apps/api/src/common/derive/advisory-snapshot.ts`
- `apps/api/src/common/derive/advisory-snapshot.test.ts`
- `apps/api/src/common/market-data/price-holdings.ts`
- `apps/api/src/common/market-data/price-holdings.test.ts`
- `apps/api/src/common/market-data/fx-rates-reader.ts`
- `apps/api/src/common/market-data/fx-rates-reader.test.ts`
- `apps/api/src/modules/advisory/advisory-analysis.service.ts`
- `apps/api/src/modules/advisory/advisory-analysis.service.test.ts`
- `apps/api/src/modules/advisory/advisory.test-fixtures.ts`
- `apps/api/src/modules/advisory/advisory.snapshot.schemas.test.ts`

**Modifies**

- `packages/validators/src/advisory/index.ts`
- `packages/types/src/index.ts`
- `apps/api/src/common/derive/portfolio-fx.ts`
- `apps/api/src/modules/dashboard/dashboard.service.ts`
- `apps/api/src/modules/advisory/advisory.routes.ts`
- `apps/api/src/modules/advisory/advisory.routes.test.ts`
- `apps/api/src/modules/advisory/advisory.module.ts`
- `apps/api/src/modules/advisory/advisory.module.test.ts`
- `packages/contracts/src/advisory/advisory.contract.ts`
- `apps/api/src/bootstrap/runtime-dependencies.ts`
- `apps/api/src/modules/advisory/advisory.integration.test.ts`
- `apps/api/src/modules/advisory/advisory.contract.test.ts`
- `docs/state.yaml`

**Deletes**

- `apps/api/src/modules/dashboard/fx-rates-source.ts`
- `apps/api/src/modules/dashboard/fx-rates-source.test.ts`

## Dev Agent Record

### Summary
Implemented the deterministic advisory snapshot (schema, types, pure engine), extracted the shared pricing and FX reader into `common/market-data`, and exposed a gated `snapshot` procedure wired at the composition root. Scope held: no LLM call, no DB write, no migration, no env variable. Model: Claude Sonnet 5.5. Started 2026-10-27T14:54Z, completed 2026-10-27T15:00Z.

### Files changed
- `apps/api/src/bootstrap/runtime-dependencies.ts`
- `apps/api/src/common/derive/advisory-snapshot.test.ts`
- `apps/api/src/common/derive/advisory-snapshot.ts`
- `apps/api/src/common/derive/portfolio-fx.ts`
- `apps/api/src/common/market-data/fx-rates-reader.test.ts`
- `apps/api/src/common/market-data/fx-rates-reader.ts`
- `apps/api/src/common/market-data/price-holdings.test.ts`
- `apps/api/src/common/market-data/price-holdings.ts`
- `apps/api/src/modules/advisory/advisory-analysis.service.test.ts`
- `apps/api/src/modules/advisory/advisory-analysis.service.ts`
- `apps/api/src/modules/advisory/advisory.contract.test.ts`
- `apps/api/src/modules/advisory/advisory.integration.test.ts`
- `apps/api/src/modules/advisory/advisory.module.test.ts`
- `apps/api/src/modules/advisory/advisory.module.ts`
- `apps/api/src/modules/advisory/advisory.routes.test.ts`
- `apps/api/src/modules/advisory/advisory.routes.ts`
- `apps/api/src/modules/advisory/advisory.snapshot.schemas.test.ts`
- `apps/api/src/modules/advisory/advisory.test-fixtures.ts`
- `apps/api/src/modules/dashboard/dashboard.service.ts`
- `apps/api/src/modules/dashboard/fx-rates-source.ts (deleted)`
- `apps/api/src/modules/dashboard/fx-rates-source.test.ts (deleted)`
- `packages/contracts/src/advisory/advisory.contract.ts`
- `packages/types/src/advisory/advisory.types.ts`
- `packages/types/src/advisory/index.ts`
- `packages/types/src/index.ts`
- `packages/validators/src/advisory/advisory.snapshot.schemas.ts`
- `packages/validators/src/advisory/index.ts`
- `docs/state.yaml`

### Deviations
- T1 shipped with a small inline-fixture schema test (RED first); T14 later replaced it with the full fixture-based suite from the story.
- T5/T6/T8/T13/T14 tests were taken verbatim from the story; RED was witnessed by temporarily removing the implementation (missing module) or via the missing handler/contract property. T2 (type re-export) and T12 (runtime wiring) were driven by typecheck RED, not a runtime test.
- `convertToBase` in `portfolio-fx.ts` keeps its original INVARIANT comment plus the story's sharing note.
- Doc-debt on `docs/prd.md` / `docs/architecture.md` (ADR-0016) is intentionally untouched, as the story requires.

### Test output
`bun --filter='@pekulo/api' run test` → 1089 pass, 0 fail, 3002 expect() calls, 128 files, exit 0. `bun --filter='@pekulo/api' run typecheck` → exit 0. `bun run lint` → 0 errors (warnings pre-existing in apps/web).
