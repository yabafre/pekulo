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
// Closed enum literal + derived type live HERE as the cross-app source of
// truth (L1 — domain types/closed enum literals belong in @pekulo/types
// since both apps/web and apps/api consume them).
//
// @pekulo/validators/src/accounts.ts mirrors the literal inline in z.enum
// (it can't import from here — @pekulo/types already declares
// @pekulo/validators for downstream re-exports like Account / Compass /
// Milestone, and Turbo refuses the reverse edge). Keep both sides in sync;
// drift caught at code review.
export const ACCOUNT_TYPES = ["livret", "pea", "cto", "av", "autre"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** UI prop shape consumed by PekuloAccountRow / PekuloAccountsSection. */
export interface AccountCardItem {
  label: string;
  type: AccountType;
  institution?: string;
  balanceEur: number;
}

/** Canonical domain entity (z.infer from @pekulo/validators#accountSchema). */
export type { Account } from "@pekulo/validators";

// ─── Holding (Portfolio) ─────────────────────────────────────────────────
// Closed enum literal + derived type. The 'crypto' value is part of the V1
// surface (story 3-1 extended the brownfield holding_kind enum).
//
// @pekulo/validators/src/holdings.ts mirrors the literal inline in z.enum
// (Turbo cycle constraint — same shape as ACCOUNT_TYPES / HOLDING_KINDS_MIRROR
// pair). Reviewer-enforced invariant: this literal MUST equal the validator's
// HOLDING_KINDS_MIRROR exactly.
export const HOLDING_KINDS = ["etf", "action", "crypto", "autre"] as const;
export type HoldingKind = (typeof HOLDING_KINDS)[number];

/** Branded id primitives — opaque strings until the wire shape is parsed. */
export type HoldingId = Id<"HoldingId">;
export type HoldingLotId = Id<"HoldingLotId">;

/** Canonical domain entities — z.infer from @pekulo/validators. */
export type { Holding, HoldingLot, DerivedHolding } from "@pekulo/validators";

/** UI prop shape consumed by PekuloHoldingRow / PekuloPortfolioSection. */
export interface HoldingCardItem {
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

// ─── Milestones (legacy UI mockup) ───────────────────────────────────────
// `MilestoneCardItem` is the legacy V1 design-system row shape used by
// PekuloMilestoneRow / PekuloMilestonesCard mockups (label/targetEur/
// progressPct/deltaEur/status). Story 1-4 will replace these mockups with
// real data wired from the milestones domain via hooks/server actions.
// Domain entity + bounds for the real DB row live in the "Milestones DB row"
// section below.
export const MILESTONE_STATUSES = ["ahead", "on-track", "behind"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export interface MilestoneCardItem {
  /**
   * Domain id of the underlying Milestone row when the item is wired to
   * live data. Optional so legacy DS mockups (which carry only the visual
   * payload) keep typechecking; consumers wired to the milestones domain
   * (story 1-4) populate it via the derive helper so PekuloMilestoneRow
   * can offer per-row affordances (delete / edit).
   */
  id?: string;
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

// ─── Compass (story 1-1) ─────────────────────────────────────────────────
// Canonical shapes live in @pekulo/validators (Zod inference) and are
// re-exported here as the single import surface for feature modules.
export type { Compass, CompassSetupState } from "@pekulo/validators";

// Compass domain bounds — SSOT in @pekulo/validators. min(2) on horizon is
// load-bearing for milestones (story 1-2): horizonYears=1 would derive the
// empty year range [currentYear+1, currentYear].
export { MAX_OBJECTIF_EUR, MIN_HORIZON_YEARS, MAX_HORIZON_YEARS } from "@pekulo/validators";

// Append-only audit row written when the compass is updated (ADR-0001).
export interface CompassHistoryEntry {
  id: string;
  userId: string;
  objectif: number;
  horizonYears: number;
  valuedOn: Date;
  createdAt: Date;
}

// Probe consumed by the compass module's getSetupState handler — story 1-2
// wires the Prisma-backed implementation; the compass module receives it
// at construction time so it does not import from milestones directly.
export interface MilestonePresenceProbe {
  hasAny(userId: string): Promise<boolean>;
}

// Read-only contract the milestones service needs from the compass aggregate
// (story 1-2 Q4=A). Implemented in runtime-dependencies.ts as a closure over
// Prisma (NOT compassService) to keep module instantiation acyclic.
export interface CompassReader {
  read(userId: string): Promise<{ objectif: number; horizonYears: number } | null>;
}

// Compass-progress curve types (story 1-3, FR-7). Re-exported from
// @pekulo/validators (Zod-inferred runtime SSOT) — kept in lockstep with the
// Compass / MilestoneStatus pattern above.
export type { CompassCurve, CompassCurvePoint, CompassProgress } from "@pekulo/validators";

// Wealth-history feed consumed by compass.getCompassCurve. V1 source is the
// brownfield `monthly_tracking` table via the runtime-dependencies adapter
// (closure over prismaService.client.monthlyTracking.findMany). Mirrors the
// CompassReader injection pattern (story 1-2): the compass module declares
// the interface, the runtime wires the Prisma-backed adapter — the module
// stays decoupled from MonthlyTracking and Epic 5's eventual port.
export interface WealthSnapshot {
  at: Date;
  totalEur: number;
}

export interface WealthHistoryProvider {
  read(userId: string): Promise<WealthSnapshot[]>;
}

// ─── Milestones — DB row + computed status (story 1-2) ───────────────────
// Re-exported from @pekulo/validators for the same reason as Compass above:
// validators is the runtime SSOT, types is the typed import surface.
export type { Milestone, MilestoneStatusEntry } from "@pekulo/validators";

// Milestones domain bounds — SSOT in @pekulo/validators. `MILESTONES_PER_USER_CAP`
// gates the FR-3 cap (≤ 20 rows / user); `MAX_TARGET_CAPITAL_EUR` /
// `MAX_LABEL_LENGTH` bound the row payload. `MILESTONE_STATUS_TOLERANCE_RATIO`
// is the FR-6 ±5% band used by both the API helper (status classification)
// and apps/web (tooltip copy).
export {
  MAX_TARGET_CAPITAL_EUR,
  MAX_LABEL_LENGTH,
  MILESTONES_PER_USER_CAP,
  MILESTONE_STATUS_TOLERANCE_RATIO,
} from "@pekulo/validators";
