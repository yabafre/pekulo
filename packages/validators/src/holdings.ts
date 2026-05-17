// packages/validators/src/holdings.ts
// Holdings module validators — Zod schemas + Zod-inferred TS types.
//
// Conventions (story 1-1 / 2-1 precedent):
//   - camelCase schema names + `Schema` suffix.
//   - Closed enum literal (HOLDING_KINDS) MIRROR of @pekulo/types#HOLDING_KINDS
//     (Turbo cycle constraint — validators can't import from types because
//     types re-exports validators-inferred Holding). Keep the inlined literal
//     in sync with @pekulo/types#HOLDING_KINDS.
//   - The DOMAIN `Holding` / `HoldingLot` / `DerivedHolding` shapes are
//     z.infer<…>; the UI shape lives at @pekulo/types#HoldingCardItem
//     (renamed in story 3-1).
//
// Defense-in-depth at the validator layer (AC-5):
//   - lot quantity > 0 mirrors the brownfield CHECK (quantity > 0) on
//     holding_lots.
//   - lot priceUnit >= 0 mirrors CHECK (price_unit >= 0).
//   - lot fees >= 0 mirrors CHECK (fees >= 0).
//   - holding quantity >= 0 + avgCost >= 0 + lastPrice >= 0 mirror their
//     brownfield checks.
//   - ticker length 1..32 (no DB length constraint today; defense in depth).
//   - label length 1..120 (matches brownfield TEXT NOT NULL guarded by app
//     code).
//   - notes optional, max 500.

import { z } from "zod";

export const HOLDING_ID_PREFIX_RE = /^hld_[0-9A-Za-z]{21}$/;
export const HOLDING_LOT_ID_PREFIX_RE = /^lot_[0-9A-Za-z]{21}$/;
export const MAX_HOLDING_LABEL_LENGTH = 120;
export const MAX_HOLDING_TICKER_LENGTH = 32;
export const MAX_HOLDING_NOTES_LENGTH = 500;
export const HOLDING_CURRENCIES = ["EUR", "USD", "GBP", "CHF"] as const;
export type HoldingCurrency = (typeof HOLDING_CURRENCIES)[number];

// MIRROR of @pekulo/types#HOLDING_KINDS — kept inline because validators
// cannot import from types (would create a Turbo workspace cycle).
// Reviewer-enforced invariant: this literal MUST equal @pekulo/types#HOLDING_KINDS
// exactly.
const HOLDING_KINDS_MIRROR = ["etf", "action", "crypto", "autre"] as const;
const LOT_TYPES = ["buy", "sell"] as const;

export const holdingIdSchema = z
  .string()
  .regex(HOLDING_ID_PREFIX_RE, "id must match /^hld_[0-9A-Za-z]{21}$/");

export const holdingLotIdSchema = z
  .string()
  .regex(HOLDING_LOT_ID_PREFIX_RE, "id must match /^lot_[0-9A-Za-z]{21}$/");

// Row / DTO shape — output of list, create, getDerived(parent).
// After the 3-1 migration every holding id in the DB matches HOLDING_ID_PREFIX_RE
// (legacy UUIDs were re-id'd in-place).
export const holdingSchema = z.object({
  id: holdingIdSchema,
  userId: z.string().uuid(),
  accountId: z.string().min(1),
  kind: z.enum(HOLDING_KINDS_MIRROR),
  ticker: z.string().max(MAX_HOLDING_TICKER_LENGTH).nullable(),
  isin: z.string().max(32).nullable(),
  label: z.string().min(1).max(MAX_HOLDING_LABEL_LENGTH),
  currency: z.enum(HOLDING_CURRENCIES),
  quantity: z.number().min(0),
  avgCost: z.number().min(0),
  lastPrice: z.number().min(0),
  lastPriceAt: z.date().nullable(),
  notes: z.string().max(MAX_HOLDING_NOTES_LENGTH).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  closedAt: z.date().nullable(),
});
export type Holding = z.infer<typeof holdingSchema>;

export const holdingLotSchema = z.object({
  id: holdingLotIdSchema,
  userId: z.string().uuid(),
  holdingId: holdingIdSchema,
  type: z.enum(LOT_TYPES),
  occurredOn: z.date(),
  quantity: z.number().positive(),
  priceUnit: z.number().min(0),
  fees: z.number().min(0),
  notes: z.string().max(MAX_HOLDING_NOTES_LENGTH).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type HoldingLot = z.infer<typeof holdingLotSchema>;

export const derivedHoldingSchema = z.object({
  holdingId: holdingIdSchema,
  quantity: z.number().min(0),
  avgCost: z.number().min(0),
  source: z.enum(["lots", "manual"]),
});
export type DerivedHolding = z.infer<typeof derivedHoldingSchema>;

export const createHoldingInputSchema = z.object({
  accountId: z.string().min(1),
  ticker: z
    .string()
    .trim()
    .min(1, "ticker cannot be empty whitespace")
    .max(MAX_HOLDING_TICKER_LENGTH, `ticker must be <= ${MAX_HOLDING_TICKER_LENGTH} chars`)
    .nullable()
    .optional(),
  isin: z.string().max(32).nullable().optional(),
  kind: z.enum(HOLDING_KINDS_MIRROR),
  currency: z.enum(HOLDING_CURRENCIES),
  label: z.string().trim().min(1).max(MAX_HOLDING_LABEL_LENGTH),
  quantity: z.number().min(0, "quantity must be >= 0"),
  avgCost: z.number().min(0, "avgCost must be >= 0"),
  notes: z.string().max(MAX_HOLDING_NOTES_LENGTH).nullable().optional(),
});
export type CreateHoldingInput = z.infer<typeof createHoldingInputSchema>;

export const recordLotInputSchema = z.object({
  holdingId: holdingIdSchema,
  type: z.enum(LOT_TYPES),
  // Coerce — clients send ISO strings over the oRPC wire envelope; matches
  // recordBalanceChangeInputSchema.valuedOn precedent (story 2-2).
  occurredOn: z.coerce.date(),
  quantity: z.number().positive("quantity must be > 0"),
  priceUnit: z.number().min(0, "priceUnit must be >= 0"),
  fees: z.number().min(0, "fees must be >= 0").default(0),
  notes: z.string().max(MAX_HOLDING_NOTES_LENGTH).nullable().optional(),
});
export type RecordLotInput = z.infer<typeof recordLotInputSchema>;

export const closeHoldingInputSchema = z.object({
  id: holdingIdSchema,
});
export type CloseHoldingInput = z.infer<typeof closeHoldingInputSchema>;

export const closeHoldingOutputSchema = z.object({ ok: z.literal(true) });
export type CloseHoldingOutput = z.infer<typeof closeHoldingOutputSchema>;

export const listHoldingsInputSchema = z
  .object({
    includeClosed: z.boolean().default(false),
  })
  .default({ includeClosed: false });
export type ListHoldingsInput = z.infer<typeof listHoldingsInputSchema>;

export const listHoldingsOutputSchema = z.array(holdingSchema);
export type ListHoldingsOutput = z.infer<typeof listHoldingsOutputSchema>;

export const getDerivedHoldingInputSchema = z.object({
  id: holdingIdSchema,
});
export type GetDerivedHoldingInput = z.infer<typeof getDerivedHoldingInputSchema>;
