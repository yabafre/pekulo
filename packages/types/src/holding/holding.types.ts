// packages/types/src/holding/holding.types.ts
// Holding (Portfolio) types.
//
// Closed enum literal + derived type. The 'crypto' value is part of the V1
// surface (story 3-1 extended the brownfield holding_kind enum).
//
// @pekulo/validators/src/holdings.ts mirrors the literal inline in z.enum
// (Turbo cycle constraint — same shape as ACCOUNT_TYPES / HOLDING_KINDS_MIRROR
// pair). Reviewer-enforced invariant: this literal MUST equal the validator's
// HOLDING_KINDS_MIRROR exactly.

import type { Id } from "../shared";

export const HOLDING_KINDS = ["etf", "action", "crypto", "autre"] as const;
export type HoldingKind = (typeof HOLDING_KINDS)[number];

/** Branded id primitives — opaque strings until the wire shape is parsed. */
export type HoldingId = Id<"HoldingId">;
export type HoldingLotId = Id<"HoldingLotId">;

/** Canonical domain entities — z.infer from @pekulo/validators. */
export type { Holding, HoldingLot, DerivedHolding } from "@pekulo/validators";

/** Price chain (story 3-2) — service-internal DTOs, no oRPC surface. */
export type {
  PriceQuote,
  PriceQuoteInput,
  PriceProvider,
  PriceProviderAttempt,
} from "@pekulo/validators";
export { PRICE_PROVIDERS } from "@pekulo/validators";

/** FX + portfolio snapshot (story 3-3) — pure helper outputs, no oRPC surface. */
export type { FxSource, FxRates, PortfolioSnapshotFx, HoldingPnl } from "@pekulo/validators";
export { FX_SOURCES } from "@pekulo/validators";

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
