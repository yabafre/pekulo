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
  "transfer",
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
    transfer: "Transfert",
  };

export const transactionTypeSchema = z.enum(["inflow", "outflow"]);
export type TransactionType = z.infer<typeof transactionTypeSchema>;

export const transactionCategorySchema = z.enum(TRANSACTION_CATEGORIES);
export type TransactionCategory = z.infer<typeof transactionCategorySchema>;

// ─── ID regexes ───────────────────────────────────────────────────────────
const TRANSACTION_ID_REGEX = /^tx_[0-9A-Za-z]{21}$/;
const ACCOUNT_ID_REGEX = /^acc_[0-9A-Za-z]{21}$/;
const TRANSFER_PAIR_ID_REGEX = /^tp_[0-9A-Za-z]{21}$/;
// Shape + month/day range — rejects "2026-13-01" / "2026-02-32". A refine
// below also rejects day-in-month overflows ("2026-02-30", "2026-02-29" in
// non-leap years, "2026-04-31"). UI fences this via PekuloDatePicker; the
// boundary refine guards the oRPC API for CSV import (5-2) + script callers.
const ISO_DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const isoDateString = (msg = "Date YYYY-MM-DD requise") =>
  z
    .string()
    .regex(ISO_DATE_REGEX, msg)
    .refine((s) => {
      const d = new Date(`${s}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
    }, "Date invalide (jour hors mois)");

// `z.number().min(0)` alone accepts Infinity (Infinity >= 0 is true), which
// Postgres Decimal rejects later as a confusing 500 INTERNAL. Chain
// `.finite()` to surface as a clean 400.
const amountSchema = (msg = "Montant ≥ 0") => z.number().finite("Montant invalide").min(0, msg);

// ─── DTO (row shape returned by reads) ───────────────────────────────────
// transferPairId: nullable grouping tp_<base62> set by the service on the
// rule-based transfer match (story 5-3, FR-30). System-set only — never on
// the create / update input shapes below.
export const transactionSchema = z.object({
  id: z.string().regex(TRANSACTION_ID_REGEX),
  accountId: z.string().regex(ACCOUNT_ID_REGEX),
  occurredOn: isoDateString(),
  label: z.string().min(1).max(120),
  amount: amountSchema(),
  type: transactionTypeSchema,
  category: transactionCategorySchema,
  isImprevu: z.boolean(),
  notes: z.string().max(500).nullable(),
  transferPairId: z.string().regex(TRANSFER_PAIR_ID_REGEX).nullable(),
  // Story 6-2 (FR-32) — pending LLM suggestion. System-set; null until the
  // categoriser runs. `.optional()` keeps pre-6-2 fixtures valid; reads always
  // populate them (null or value). suggestedRoute mirrors the server route_actual
  // ('ollama' | 'third_party' | 'foundation_models'); kept as a plain string to
  // avoid coupling the transactions DTO to the LLM enum.
  suggestedCategory: transactionCategorySchema.nullable().optional(),
  suggestedConfidence: z.number().min(0).max(1).nullable().optional(),
  suggestedRoute: z.string().nullable().optional(),
  suggestedAt: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type Transaction = z.infer<typeof transactionSchema>;

// ─── Inputs ───────────────────────────────────────────────────────────────
export const createTransactionInputSchema = z.object({
  accountId: z.string().regex(ACCOUNT_ID_REGEX, "accountId invalide"),
  occurredOn: isoDateString(),
  label: z.string().min(1, "Libellé requis").max(120, "Libellé > 120 caractères"),
  amount: amountSchema(),
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
    occurredOn: isoDateString().optional(),
    label: z.string().min(1).max(120).optional(),
    amount: amountSchema().optional(),
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

// ─── CSV import (story 5-2) ──────────────────────────────────────────────
// Positional 4-column CSV: date (YYYY-MM-DD), amount (signed), label, account-label.
// Validation happens server-side via apps/api/src/modules/transactions/services/csv-parser.ts.
// Two procedures: previewImportCsv (csvText → row-by-row breakdown), importCsv (rows → atomic persist).

export const rawCsvRowSchema = z.object({
  occurredOn: z.string(),
  amountRaw: z.string(),
  label: z.string(),
  accountLabel: z.string(),
});
export type RawCsvRow = z.infer<typeof rawCsvRowSchema>;

export const validatedCsvRowSchema = z.object({
  occurredOn: isoDateString(),
  amount: amountSchema(),
  type: transactionTypeSchema,
  category: transactionCategorySchema,
  label: z.string().min(1, "Libellé requis").max(120, "Libellé > 120 caractères"),
  accountId: z.string().regex(ACCOUNT_ID_REGEX, "accountId invalide"),
  isImprevu: z.boolean(),
  notes: z.string().max(500).nullable(),
});
export type ValidatedCsvRow = z.infer<typeof validatedCsvRowSchema>;

export const previewedRowSchema = z.object({
  index: z.number().int().min(0),
  raw: rawCsvRowSchema,
  parsed: validatedCsvRowSchema.optional(),
  error: z.string().optional(),
});
export type PreviewedRow = z.infer<typeof previewedRowSchema>;

export const previewImportCsvInputSchema = z.object({
  csvText: z.string().min(1, "CSV vide").max(2_000_000, "CSV > 2 MB"),
});
export type PreviewImportCsvInput = z.infer<typeof previewImportCsvInputSchema>;

export const previewImportCsvOutputSchema = z.object({
  rows: z.array(previewedRowSchema),
  summary: z.object({
    total: z.number().int().min(0),
    valid: z.number().int().min(0),
    invalid: z.number().int().min(0),
  }),
});
export type PreviewImportCsvOutput = z.infer<typeof previewImportCsvOutputSchema>;

export const importCsvInputSchema = z.object({
  rows: z.array(validatedCsvRowSchema).min(1, "rows requis (min 1)").max(1000, "max 1000 lignes"),
});
export type ImportCsvInput = z.infer<typeof importCsvInputSchema>;

export const importCsvOutputSchema = z.object({
  ok: z.literal(true),
  persisted: z.number().int().min(0),
});
export type ImportCsvOutput = z.infer<typeof importCsvOutputSchema>;
