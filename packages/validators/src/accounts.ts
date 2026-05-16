// Accounts module validators — Zod schemas + Zod-inferred TS types.
//
// Conventions (story 1-1 / 1-2 precedent):
//   - camelCase schema names + `Schema` suffix.
//   - Closed enum literal source-of-truth lives in @pekulo/types#ACCOUNT_TYPES
//     (L1 — cross-app domain literals belong in types). Inlined below in
//     z.enum because @pekulo/validators cannot import from @pekulo/types
//     (types → validators edge already exists for Account / Compass /
//     Milestone re-exports; Turbo refuses the reverse). Keep the inlined
//     literal in sync with @pekulo/types#ACCOUNT_TYPES.
//   - The DOMAIN `Account` shape is z.infer<typeof accountSchema>; the UI
//     shape lives at @pekulo/types#AccountCardItem (renamed in story 2-1).
//
// Defense-in-depth at the validator layer (AC-9):
//   - cashBalance >= 0 mirrors the brownfield CHECK (cash_balance >= 0).
//   - label length 1..120 (matches brownfield TEXT NOT NULL guarded by app
//     code — no DB-level length constraint).
//   - notes optional, max 500.

import { z } from "zod";

export const ACCOUNT_ID_PREFIX_RE = /^acc_[0-9A-Za-z]{21}$/;
export const MAX_ACCOUNT_LABEL_LENGTH = 120;
export const MAX_ACCOUNT_NOTES_LENGTH = 500;
export const ACCOUNT_CURRENCIES = ["EUR", "USD", "GBP", "CHF"] as const;
export type AccountCurrency = (typeof ACCOUNT_CURRENCIES)[number];

// MIRROR of @pekulo/types#ACCOUNT_TYPES — kept inline because validators cannot
// import from types (would create a Turbo workspace cycle). Reviewer-enforced
// invariant: this literal MUST equal @pekulo/types#ACCOUNT_TYPES exactly.
const ACCOUNT_TYPES_MIRROR = ["livret", "pea", "cto", "av", "autre"] as const;

export const accountIdSchema = z
  .string()
  .regex(ACCOUNT_ID_PREFIX_RE, "id must match /^acc_[0-9A-Za-z]{21}$/");

// Row / DTO shape — output of list, create, update, get. After the 2-1
// migration every account id in the DB matches ACCOUNT_ID_PREFIX_RE (legacy
// UUIDs were re-id'd in-place).
export const accountSchema = z.object({
  id: accountIdSchema,
  userId: z.string().uuid(),
  label: z.string().min(1).max(MAX_ACCOUNT_LABEL_LENGTH),
  type: z.enum(ACCOUNT_TYPES_MIRROR),
  currency: z.enum(ACCOUNT_CURRENCIES),
  cashBalance: z.number().min(0),
  notes: z.string().max(MAX_ACCOUNT_NOTES_LENGTH).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Account = z.infer<typeof accountSchema>;

export const createAccountInputSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "label cannot be empty whitespace")
    .max(MAX_ACCOUNT_LABEL_LENGTH, `label must be <= ${MAX_ACCOUNT_LABEL_LENGTH} chars`),
  type: z.enum(ACCOUNT_TYPES_MIRROR),
  currency: z.enum(ACCOUNT_CURRENCIES),
  cashBalance: z.number().min(0, "cashBalance must be >= 0"),
  notes: z.string().max(MAX_ACCOUNT_NOTES_LENGTH).nullable().optional(),
});
export type CreateAccountInput = z.infer<typeof createAccountInputSchema>;

export const updateAccountInputSchema = z
  .object({
    id: accountIdSchema,
    label: z.string().trim().min(1).max(MAX_ACCOUNT_LABEL_LENGTH).optional(),
    type: z.enum(ACCOUNT_TYPES_MIRROR).optional(),
    currency: z.enum(ACCOUNT_CURRENCIES).optional(),
    cashBalance: z.number().min(0).optional(),
    notes: z.string().max(MAX_ACCOUNT_NOTES_LENGTH).nullable().optional(),
  })
  .refine(
    (v) =>
      v.label !== undefined ||
      v.type !== undefined ||
      v.currency !== undefined ||
      v.cashBalance !== undefined ||
      v.notes !== undefined,
    {
      message: "at least one of label / type / currency / cashBalance / notes must be provided",
    },
  );
export type UpdateAccountInput = z.infer<typeof updateAccountInputSchema>;

export const deleteAccountInputSchema = z.object({ id: accountIdSchema });
export type DeleteAccountInput = z.infer<typeof deleteAccountInputSchema>;

export const deleteAccountOutputSchema = z.object({ ok: z.literal(true) });
export type DeleteAccountOutput = z.infer<typeof deleteAccountOutputSchema>;

export const listAccountsOutputSchema = z.array(accountSchema);
