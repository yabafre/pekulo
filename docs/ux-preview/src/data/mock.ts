/**
 * Mock data for the Pekulo UX prototype.
 * Persona #1 = Alex. Locale fr-FR. Today = 2026-05-03.
 * Every value comes from realistic Pekulo usage (PRD journeys J1–J9).
 *
 * The shape mirrors apps/web Supabase domain types so screens transplant 1:1.
 */

export const TODAY = "2026-05-03";
export const USER = {
  email: "alex@pekulo.app",
  displayName: "Alex",
  locale: "fr-FR" as const,
  theme: "system" as const,
  thirdPartyLLMOptIn: false,
};

/* ─────────────────────────────────────────────────────────────────────────
   Compass + milestones (Group A — FR-1 → FR-8)
   ───────────────────────────────────────────────────────────────────────── */

export const COMPASS = {
  targetCapital: 800_000,
  targetYear: 2055,
  startedOn: "2024-09-12",
  startCapital: 38_500,
  updatedOn: "2025-11-04",
};

export type MilestoneStatus = "ahead" | "on-track" | "behind";

export const MILESTONES: Array<{
  id: string;
  label: string;
  targetCapital: number;
  targetYear: number;
  status: MilestoneStatus;
  deltaEur: number;
}> = [
  {
    id: "m-1",
    label: "Premier palier — 250 k€",
    targetCapital: 250_000,
    targetYear: 2029,
    status: "behind",
    deltaEur: -5_900,
  },
  {
    id: "m-2",
    label: "Cap intermédiaire — 400 k€",
    targetCapital: 400_000,
    targetYear: 2038,
    status: "on-track",
    deltaEur: 2_100,
  },
  {
    id: "m-3",
    label: "Trois quarts — 600 k€",
    targetCapital: 600_000,
    targetYear: 2047,
    status: "ahead",
    deltaEur: 18_400,
  },
];

/* ─────────────────────────────────────────────────────────────────────────
   Wealth snapshot — fed by accounts + holdings + real-estate
   ───────────────────────────────────────────────────────────────────────── */

export const WEALTH = {
  totalEur: 180_400, // sum of cash + holdings (FX-adjusted) + RE equity
  cashEur: 15_200,
  holdingsEur: 37_700,
  realEstateEur: 127_500,
  asOf: TODAY,
  progressRatio: 180_400 / 800_000, // 22.55 %
  required12mEur: 21_383, // €/year linear plan
  // 12-month wealth points for the dashboard curve (actual vs plan)
  curve12m: [
    { month: "2025-06", actual: 161_200, plan: 159_017 },
    { month: "2025-07", actual: 163_300, plan: 160_799 },
    { month: "2025-08", actual: 162_100, plan: 162_581 },
    { month: "2025-09", actual: 165_800, plan: 164_363 },
    { month: "2025-10", actual: 168_400, plan: 166_145 },
    { month: "2025-11", actual: 170_200, plan: 167_927 },
    { month: "2025-12", actual: 172_900, plan: 169_709 },
    { month: "2026-01", actual: 174_100, plan: 171_491 },
    { month: "2026-02", actual: 173_500, plan: 173_273 },
    { month: "2026-03", actual: 176_800, plan: 175_055 },
    { month: "2026-04", actual: 178_900, plan: 176_837 },
    { month: "2026-05", actual: 180_400, plan: 178_619 },
  ],
};

/* ─────────────────────────────────────────────────────────────────────────
   Accounts (Group B — FR-9 → FR-12)
   ───────────────────────────────────────────────────────────────────────── */

export type AccountType = "livret" | "pea" | "cto" | "av" | "autre";

export const ACCOUNTS: Array<{
  id: string;
  label: string;
  type: AccountType;
  currency: "EUR" | "USD";
  cashBalance: number;
  institution: string;
}> = [
  {
    id: "a-1",
    label: "Livret A",
    type: "livret",
    currency: "EUR",
    cashBalance: 12_000,
    institution: "Crédit Mutuel",
  },
  {
    id: "a-2",
    label: "PEA Bourse Direct",
    type: "pea",
    currency: "EUR",
    cashBalance: 340,
    institution: "Bourse Direct",
  },
  {
    id: "a-3",
    label: "CTO Trade Republic",
    type: "cto",
    currency: "EUR",
    cashBalance: 180,
    institution: "Trade Republic",
  },
  {
    id: "a-4",
    label: "AV Boursorama",
    type: "av",
    currency: "EUR",
    cashBalance: 18_000,
    institution: "Boursorama Vie",
  },
  {
    id: "a-5",
    label: "Compte courant CIC",
    type: "autre",
    currency: "EUR",
    cashBalance: 3_200,
    institution: "CIC",
  },
];

/* ─────────────────────────────────────────────────────────────────────────
   Holdings (Group C — FR-13 → FR-20)
   ───────────────────────────────────────────────────────────────────────── */

export type HoldingKind = "etf" | "action" | "crypto" | "autre";

export const HOLDINGS: Array<{
  id: string;
  ticker: string;
  label: string;
  kind: HoldingKind;
  currency: "EUR" | "USD";
  accountId: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValueEur: number;
  unrealizedPnlEur: number;
  unrealizedPnlPct: number;
  provider: "prices-service" | "yahoo" | "boursorama" | "twelve-data";
  closed?: boolean;
}> = [
  {
    id: "h-1",
    ticker: "CW8.PA",
    label: "Amundi MSCI World UCITS ETF",
    kind: "etf",
    currency: "EUR",
    accountId: "a-2",
    quantity: 38,
    avgCost: 368.42,
    currentPrice: 402.18,
    marketValueEur: 15_283,
    unrealizedPnlEur: 1_283,
    unrealizedPnlPct: 0.0916,
    provider: "prices-service",
  },
  {
    id: "h-2",
    ticker: "PE500.PA",
    label: "Amundi PEA S&P 500 UCITS ETF",
    kind: "etf",
    currency: "EUR",
    accountId: "a-2",
    quantity: 412,
    avgCost: 42.1,
    currentPrice: 47.85,
    marketValueEur: 19_714,
    unrealizedPnlEur: 2_369,
    unrealizedPnlPct: 0.1366,
    provider: "yahoo",
  },
  {
    id: "h-3",
    ticker: "VWCE.DE",
    label: "Vanguard FTSE All-World UCITS",
    kind: "etf",
    currency: "EUR",
    accountId: "a-3",
    quantity: 22,
    avgCost: 108.3,
    currentPrice: 118.74,
    marketValueEur: 2_612,
    unrealizedPnlEur: 230,
    unrealizedPnlPct: 0.0964,
    provider: "yahoo",
  },
  {
    id: "h-4",
    ticker: "AAPL",
    label: "Apple Inc.",
    kind: "action",
    currency: "USD",
    accountId: "a-3",
    quantity: 8,
    avgCost: 189.5,
    currentPrice: 217.9,
    marketValueEur: 1_565,
    unrealizedPnlEur: 204,
    unrealizedPnlPct: 0.1499,
    provider: "twelve-data",
  },
  {
    id: "h-5",
    ticker: "BTC-EUR",
    label: "Bitcoin",
    kind: "crypto",
    currency: "EUR",
    accountId: "a-3",
    quantity: 0.022,
    avgCost: 84_300,
    currentPrice: 91_540,
    marketValueEur: 2_014,
    unrealizedPnlEur: 159,
    unrealizedPnlPct: 0.0859,
    provider: "yahoo",
  },
  {
    id: "h-6",
    ticker: "ETH-EUR",
    label: "Ethereum",
    kind: "crypto",
    currency: "EUR",
    accountId: "a-3",
    quantity: 0.31,
    avgCost: 2_980,
    currentPrice: 3_290,
    marketValueEur: 1_020,
    unrealizedPnlEur: 96,
    unrealizedPnlPct: 0.104,
    provider: "yahoo",
  },
];

/* ─────────────────────────────────────────────────────────────────────────
   Real-estate (Group D — FR-21 → FR-27)
   ───────────────────────────────────────────────────────────────────────── */

export type PropertyType = "residence-principale" | "locatif" | "autre";

export const PROPERTIES: Array<{
  id: string;
  label: string;
  type: PropertyType;
  currentValuationEur: number;
  lastValuedAt: string;
  mortgage?: {
    outstandingPrincipalEur: number;
    annualRatePct: number;
    monthlyPaymentEur: number;
    termRemainingMonths: number;
    startedOn: string;
  };
  rental?: {
    monthlyRentEur: number;
    monthlyChargesEur: number;
    furnished: boolean;
  };
  netEquityEur: number;
  monthlyCashflowEur?: number;
}> = [
  {
    id: "p-1",
    label: "Appartement Lyon 7e",
    type: "residence-principale",
    currentValuationEur: 295_000,
    lastValuedAt: "2026-03-14",
    mortgage: {
      outstandingPrincipalEur: 167_500,
      annualRatePct: 1.85,
      monthlyPaymentEur: 842,
      termRemainingMonths: 281,
      startedOn: "2022-04-01",
    },
    netEquityEur: 127_500,
  },
];

/* ─────────────────────────────────────────────────────────────────────────
   Transactions (Group E — FR-28 → FR-36) + LLM-categorisation demo (J4)
   ───────────────────────────────────────────────────────────────────────── */

export type TransactionType = "inflow" | "outflow" | "transfer";
export type LLMRoute = "foundation-models" | "ollama" | "third-party" | "rule-transfer";

export const TX_CATEGORIES = [
  "Salaire",
  "Logement",
  "Énergie",
  "Télécoms",
  "Alimentation",
  "Restauration",
  "Transport",
  "Loisirs",
  "Investissement",
  "Santé",
  "Abonnements",
  "Transfert",
  "Autre",
] as const;
export type TxCategory = (typeof TX_CATEGORIES)[number];

export const TRANSACTIONS: Array<{
  id: string;
  occurredOn: string;
  amountEur: number;
  type: TransactionType;
  label: string;
  accountId: string;
  category: TxCategory | null; // null when not yet confirmed
  suggestedCategory?: TxCategory; // LLM suggestion
  suggestionConfidence?: number; // 0..1
  llmRoute?: LLMRoute;
  confirmed: boolean; // user accepted/overrode
}> = [
  // Confirmed (already categorised)
  {
    id: "t-01",
    occurredOn: "2026-05-02",
    amountEur: 3_450,
    type: "inflow",
    label: "SALAIRE — VIRT MENSUEL",
    accountId: "a-5",
    category: "Salaire",
    confirmed: true,
  },
  {
    id: "t-02",
    occurredOn: "2026-05-02",
    amountEur: -842,
    type: "outflow",
    label: "CIC PRET HABITAT 2204XXX",
    accountId: "a-5",
    category: "Logement",
    confirmed: true,
  },
  {
    id: "t-03",
    occurredOn: "2026-05-02",
    amountEur: -89.0,
    type: "outflow",
    label: "EDF FACTURE AVR",
    accountId: "a-5",
    category: "Énergie",
    confirmed: true,
  },
  {
    id: "t-04",
    occurredOn: "2026-04-30",
    amountEur: -19.99,
    type: "outflow",
    label: "FREE MOBILE 06XX",
    accountId: "a-5",
    category: "Télécoms",
    confirmed: true,
  },
  {
    id: "t-05",
    occurredOn: "2026-04-30",
    amountEur: -500.0,
    type: "transfer",
    label: "VIRT TRADE REPUBLIC",
    accountId: "a-5",
    category: "Transfert",
    confirmed: true,
    llmRoute: "rule-transfer",
  },

  // Awaiting LLM confirmation (J4 — pre-filled, editable)
  {
    id: "t-06",
    occurredOn: "2026-05-01",
    amountEur: -67.43,
    type: "outflow",
    label: "CARREFOUR LYON PARTDIEU",
    accountId: "a-5",
    category: null,
    suggestedCategory: "Alimentation",
    suggestionConfidence: 0.94,
    llmRoute: "foundation-models",
    confirmed: false,
  },
  {
    id: "t-07",
    occurredOn: "2026-05-01",
    amountEur: -38.5,
    type: "outflow",
    label: "LE GARET RESTAURANT",
    accountId: "a-5",
    category: null,
    suggestedCategory: "Restauration",
    suggestionConfidence: 0.91,
    llmRoute: "foundation-models",
    confirmed: false,
  },
  {
    id: "t-08",
    occurredOn: "2026-04-29",
    amountEur: -76.0,
    type: "outflow",
    label: "SNCF TGV INOUI PARIS",
    accountId: "a-5",
    category: null,
    suggestedCategory: "Transport",
    suggestionConfidence: 0.88,
    llmRoute: "ollama",
    confirmed: false,
  },
  {
    id: "t-09",
    occurredOn: "2026-04-29",
    amountEur: -10.99,
    type: "outflow",
    label: "SPOTIFY ABONNEMENT",
    accountId: "a-5",
    category: null,
    suggestedCategory: "Abonnements",
    suggestionConfidence: 0.97,
    llmRoute: "foundation-models",
    confirmed: false,
  },
  {
    id: "t-10",
    occurredOn: "2026-04-28",
    amountEur: -23.5,
    type: "outflow",
    label: "FNAC LYON BELLECOUR",
    accountId: "a-5",
    category: null,
    suggestedCategory: "Loisirs",
    suggestionConfidence: 0.62,
    llmRoute: "ollama",
    confirmed: false,
  },
  {
    id: "t-11",
    occurredOn: "2026-04-28",
    amountEur: -8.2,
    type: "outflow",
    label: "BOULANGERIE PETIT FOUR",
    accountId: "a-5",
    category: null,
    suggestedCategory: "Alimentation",
    suggestionConfidence: 0.81,
    llmRoute: "foundation-models",
    confirmed: false,
  },
  {
    id: "t-12",
    occurredOn: "2026-04-27",
    amountEur: -250.0,
    type: "outflow",
    label: "TRADE REPUBLIC ACHAT BTC",
    accountId: "a-3",
    category: null,
    suggestedCategory: "Investissement",
    suggestionConfidence: 0.93,
    llmRoute: "foundation-models",
    confirmed: false,
  },
];

/* ─────────────────────────────────────────────────────────────────────────
   Monthly tracking (Group F — FR-37 → FR-40)
   ───────────────────────────────────────────────────────────────────────── */

export const MONTHLY: Array<{
  yearMonth: string;
  incomeEur: number;
  spendingEur: number;
  transfersEur: number;
  netEur: number;
  signedOff: boolean;
  signedOffAt?: string;
}> = [
  {
    yearMonth: "2026-05",
    incomeEur: 3_450,
    spendingEur: 1_186,
    transfersEur: 500,
    netEur: 1_764,
    signedOff: false,
  },
  {
    yearMonth: "2026-04",
    incomeEur: 3_450,
    spendingEur: 2_103,
    transfersEur: 800,
    netEur: 547,
    signedOff: false,
  },
  {
    yearMonth: "2026-03",
    incomeEur: 3_450,
    spendingEur: 1_984,
    transfersEur: 600,
    netEur: 866,
    signedOff: true,
    signedOffAt: "2026-04-03",
  },
  {
    yearMonth: "2026-02",
    incomeEur: 3_450,
    spendingEur: 2_312,
    transfersEur: 500,
    netEur: 638,
    signedOff: true,
    signedOffAt: "2026-03-02",
  },
  {
    yearMonth: "2026-01",
    incomeEur: 3_780,
    spendingEur: 2_198,
    transfersEur: 800,
    netEur: 782,
    signedOff: true,
    signedOffAt: "2026-02-04",
  },
  {
    yearMonth: "2025-12",
    incomeEur: 4_120,
    spendingEur: 2_760,
    transfersEur: 500,
    netEur: 860,
    signedOff: true,
    signedOffAt: "2026-01-05",
  },
];

/* ─────────────────────────────────────────────────────────────────────────
   LLM activity log (Group E — FR-35 → FR-36)
   ───────────────────────────────────────────────────────────────────────── */

export const LLM_LOG: Array<{
  id: string;
  occurredAt: string;
  route: LLMRoute;
  inputBytes: number;
  latencyMs: number;
  outcome: "success" | "fallback" | "error";
}> = [
  {
    id: "l-01",
    occurredAt: "2026-05-03T08:14:22Z",
    route: "foundation-models",
    inputBytes: 142,
    latencyMs: 287,
    outcome: "success",
  },
  {
    id: "l-02",
    occurredAt: "2026-05-03T08:14:23Z",
    route: "foundation-models",
    inputBytes: 118,
    latencyMs: 301,
    outcome: "success",
  },
  {
    id: "l-03",
    occurredAt: "2026-05-03T08:14:24Z",
    route: "ollama",
    inputBytes: 165,
    latencyMs: 1_142,
    outcome: "success",
  },
  {
    id: "l-04",
    occurredAt: "2026-05-03T08:14:25Z",
    route: "foundation-models",
    inputBytes: 102,
    latencyMs: 264,
    outcome: "success",
  },
  {
    id: "l-05",
    occurredAt: "2026-05-03T08:14:26Z",
    route: "ollama",
    inputBytes: 198,
    latencyMs: 2_087,
    outcome: "fallback",
  },
  {
    id: "l-06",
    occurredAt: "2026-05-03T08:14:28Z",
    route: "foundation-models",
    inputBytes: 130,
    latencyMs: 273,
    outcome: "success",
  },
];

/* ─────────────────────────────────────────────────────────────────────────
   Hypotheses & projections (Group J — FR-57 → FR-59)
   ───────────────────────────────────────────────────────────────────────── */

export const HYPOTHESIS = {
  monthlyContributionEur: 850,
  assumedAnnualRatePct: 6.5,
  // 30y projection vs compass-required curve, in 5y ticks (yyyy-mm)
  curve: [
    { date: "2026-05", projected: 180_400, required: 180_400 },
    { date: "2031-05", projected: 264_700, required: 287_315 },
    { date: "2036-05", projected: 388_900, required: 394_230 },
    { date: "2041-05", projected: 552_600, required: 501_145 },
    { date: "2046-05", projected: 769_400, required: 608_060 },
    { date: "2051-05", projected: 1_055_000, required: 714_975 },
    { date: "2055-05", projected: 1_354_200, required: 800_000 },
  ],
  monthlyShortfallEur: 0, // projection beats plan, so 0; if negative, show €/mo gap
};
