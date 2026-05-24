// packages/validators/src/transactions/transactions.schemas.ts
// Zod source of truth for the transactions aggregate (story 5-1). 9 schemas
// covering the DTO + 5 inputs + cursor pagination + ok envelope. Categories
// (12 closed enum) + French labels exported for UI consumers.
//
// R1: every zod import goes through @pekulo/zod (not "zod" direct).
// Prefixed IDs (ADR-0012): transaction ids match /^tx_[0-9A-Za-z]{21}$/.

import { z } from "@pekulo/zod";

// ─── Closed enums + label maps ───────────────────────────────────────────
export const TRANSACTION_CATEGORIES = [
  "salaire",
  "freelance",
  "remote",
  "bonus",
  "loyer",
  "courses",
  "transport",
  "sorties",
  "voyage",
  "sante",
  "imprevu",
  "autre",
] as const;

export const TRANSACTION_CATEGORY_LABELS: Record<(typeof TRANSACTION_CATEGORIES)[number], string> =
  {
    salaire: "Salaire",
    freelance: "Freelance",
    remote: "Remote",
    bonus: "Bonus",
    loyer: "Loyer",
    courses: "Courses",
    transport: "Transport",
    sorties: "Sorties",
    voyage: "Voyage",
    sante: "Santé",
    imprevu: "Imprévu",
    autre: "Autre",
  };

export const transactionTypeSchema = z.enum(["inflow", "outflow"]);
export type TransactionType = z.infer<typeof transactionTypeSchema>;

export const transactionCategorySchema = z.enum(TRANSACTION_CATEGORIES);
export type TransactionCategory = z.infer<typeof transactionCategorySchema>;

// ─── ID regexes ───────────────────────────────────────────────────────────
const TRANSACTION_ID_REGEX = /^tx_[0-9A-Za-z]{21}$/;
const ACCOUNT_ID_REGEX = /^acc_[0-9A-Za-z]{21}$/;
// Shape + month/day range — rejects "2026-13-01" / "2026-02-32".
// Day-in-month semantics (e.g. Feb 30) deferred to a refine if ever needed;
// AC-12 only requires shape + range validation.
const ISO_DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// ─── DTO (row shape returned by reads) ───────────────────────────────────
export const transactionSchema = z.object({
  id: z.string().regex(TRANSACTION_ID_REGEX),
  accountId: z.string().regex(ACCOUNT_ID_REGEX),
  occurredOn: z.string().regex(ISO_DATE_REGEX, "Date YYYY-MM-DD requise"),
  label: z.string().min(1).max(120),
  amount: z.number().min(0),
  type: transactionTypeSchema,
  category: transactionCategorySchema,
  isImprevu: z.boolean(),
  notes: z.string().max(500).nullable(),
  createdAt: z.string(),
});
export type Transaction = z.infer<typeof transactionSchema>;

// ─── Inputs ───────────────────────────────────────────────────────────────
export const createTransactionInputSchema = z.object({
  accountId: z.string().regex(ACCOUNT_ID_REGEX, "accountId invalide"),
  occurredOn: z.string().regex(ISO_DATE_REGEX, "Date YYYY-MM-DD requise"),
  label: z.string().min(1, "Libellé requis").max(120, "Libellé > 120 caractères"),
  amount: z.number().min(0, "Montant ≥ 0"),
  type: transactionTypeSchema,
  category: transactionCategorySchema,
  isImprevu: z.boolean(),
  notes: z.string().max(500, "Notes > 500 caractères").nullable(),
});
export type CreateTransactionInput = z.infer<typeof createTransactionInputSchema>;

export const updateTransactionInputSchema = z
  .object({
    id: z.string().regex(TRANSACTION_ID_REGEX, "id invalide"),
    accountId: z.string().regex(ACCOUNT_ID_REGEX).optional(),
    occurredOn: z.string().regex(ISO_DATE_REGEX).optional(),
    label: z.string().min(1).max(120).optional(),
    amount: z.number().min(0).optional(),
    type: transactionTypeSchema.optional(),
    category: transactionCategorySchema.optional(),
    isImprevu: z.boolean().optional(),
    notes: z.string().max(500).nullable().optional(),
  })
  .refine(
    (v) => {
      const { id: _id, ...rest } = v;
      return Object.values(rest).some((x) => x !== undefined);
    },
    { message: "updateTransaction requires at least one field beyond id" },
  );
export type UpdateTransactionInput = z.infer<typeof updateTransactionInputSchema>;

export const transactionIdSchema = z.object({
  id: z.string().regex(TRANSACTION_ID_REGEX),
});

export const getTransactionInputSchema = z.object({
  id: z.string().regex(TRANSACTION_ID_REGEX),
});
export type GetTransactionInput = z.infer<typeof getTransactionInputSchema>;

export const deleteTransactionInputSchema = z.object({
  id: z.string().regex(TRANSACTION_ID_REGEX),
});
export type DeleteTransactionInput = z.infer<typeof deleteTransactionInputSchema>;

export const listTransactionsInputSchema = z.object({
  limit: z.number().int().min(1).max(200).optional().default(50),
  cursor: z.string().optional(), // opaque base64url(`${occurredOnISO}|${id}`)
  accountId: z.string().regex(ACCOUNT_ID_REGEX).optional(),
});
export type ListTransactionsInput = z.infer<typeof listTransactionsInputSchema>;

export const listTransactionsOutputSchema = z.object({
  items: z.array(transactionSchema),
  nextCursor: z.string().nullable(),
});
export type ListTransactionsOutput = z.infer<typeof listTransactionsOutputSchema>;

// ─── Envelope ─────────────────────────────────────────────────────────────
export const transactionsOkSchema = z.object({ ok: z.literal(true) });
