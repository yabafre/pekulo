// packages/types/src/index.ts
// Pekulo shared TypeScript types — domain entities consumed across apps/web,
// apps/api (DTOs), and apps/mobile (V1.5). Per ADR-0011 + architecture
// L366–L368 the types live here, NOT inlined in component files.
//
// Conventions:
//   - PascalCase domain types (Account, Holding, MonthlyRecord, …).
//   - SCREAMING_SNAKE_CASE `as const` arrays for closed enumerations
//     (ACCOUNT_TYPES, HOLDING_KINDS, LLM_ROUTES, …) — string-literal
//     unions are derived via `(typeof X)[number]`.
//   - Branded primitives for prefixed IDs (`AccountId`, `HoldingId`, …).
//
// V1 (a) scope: UI-visible row entities consumed by `@pekulo/ui` components.
// As feature epics 1–9 land, repository layer + Prisma-derived types are
// exported here too (architecture L1039–L1043).

// ─── Branded ID primitives ───────────────────────────────────────────────
// (placeholder shape — full prefix scheme arrives with story 0-4 alongside
// the Prisma id-prefixes registry; UI types reference these as opaque
// strings until then.)
export type Id<TBrand extends string> = string & { __brand: TBrand };

// ─── Account (Comptes / Patrimoine) ──────────────────────────────────────
export const ACCOUNT_TYPES = ["livret", "pea", "cto", "av", "autre"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export interface Account {
  label: string;
  type: AccountType;
  institution?: string;
  balanceEur: number;
}

// ─── Holding (Portfolio) ─────────────────────────────────────────────────
export const HOLDING_KINDS = ["etf", "action", "crypto", "autre"] as const;
export type HoldingKind = (typeof HOLDING_KINDS)[number];

export interface Holding {
  ticker: string;
  label: string;
  account: string;
  kind: HoldingKind;
  quantity: number;
  pricePerUnit: number;
  marketValueEur: number;
  pnlEur: number;
  pnlPct: number;
}

// ─── Transactions (Activity + Suggestion) ────────────────────────────────
export const TX_DIRECTIONS = ["in", "out"] as const;
export type TxDirection = (typeof TX_DIRECTIONS)[number];

export interface Activity {
  label: string;
  account: string;
  category: string;
  direction: TxDirection;
  amountEur: number;
}

// LLM routing labels — UI-display variant. Backend labels are
// `'foundation_models' | 'ollama' | 'third_party'` (architecture L243 +
// ADR-0008). The two surfaces are reconciled when transactions feature
// epic 5-x wires the real router.
export const LLM_ROUTES = ["ios", "ollama", "cloud"] as const;
export type LlmRoute = (typeof LLM_ROUTES)[number];

export interface Suggestion {
  label: string;
  account: string;
  dateLabel: string;
  direction: TxDirection;
  amountEur: number;
  suggestedCategory: string;
  confidence: number;
  route: LlmRoute;
}

// ─── Milestones (Compass paliers) ────────────────────────────────────────
export const MILESTONE_STATUSES = ["ahead", "on-track", "behind"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export interface Milestone {
  label: string;
  targetEur: number;
  targetYear: number;
  progressPct: number;
  deltaEur: number;
  status: MilestoneStatus;
}

// ─── Monthly tracking ────────────────────────────────────────────────────
export interface MonthlyRecord {
  monthLabel: string;
  incomeEur: number;
  spendingEur: number;
  netEur: number;
  closed?: boolean;
}

// ─── Real-estate ─────────────────────────────────────────────────────────
export interface Property {
  label: string;
  valuationEur: number;
  debtRemainingEur: number;
  monthlyPaymentEur: number;
  yearsRemaining: number;
  repaidPct: number;
}

// ─── Composition (wealth-class repartition) ──────────────────────────────
export interface CompositionItem {
  label: string;
  amount: number;
  pct: number;
  sub?: string;
}

// ─── Stat tone (Mensuel / generic value display) ─────────────────────────
export const STAT_TONES = ["gain", "loss"] as const;
export type StatTone = (typeof STAT_TONES)[number];
