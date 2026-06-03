// packages/validators/src/transactions/transactions.schemas.ts
// Zod source of truth for the transactions aggregate (story 5-1). 9 schemas
// covering the DTO + 5 inputs + cursor pagination + ok envelope. Categories
// (17 closed enum) + French labels exported for UI consumers.
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
  "factures",
  "restauration",
  "abonnements",
  "retrait",
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
    factures: "Factures",
    restauration: "Restauration",
    abonnements: "Abonnements",
    retrait: "Retrait",
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

// ─── Month key (story 6-9, FR-64) ────────────────────────────────────────
// Calendar-month key "YYYY-MM" — shape-validates the year + a 01–12 month.
// The day is intentionally absent: the server expands it to a half-open
// [monthStart, nextMonthStart) UTC range (mirrors monthly.repository's
// firstDayOfMonthUTC / firstDayOfNextMonthUTC). Used by the month navigator.
// Year 0000 is rejected (iso with the web `MONTH_KEY_REGEX` in month-key.ts) —
// it is unreachable from any real occurredOn date and keeps the client-side
// `shiftMonth` from ever stepping into a negative ordinal.
const MONTH_KEY_REGEX = /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/;
export const monthKeySchema = z.string().regex(MONTH_KEY_REGEX, "Mois YYYY-MM requis");
export type MonthKey = z.infer<typeof monthKeySchema>;

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
  // Story 6-10 (FR-65) — resolved 3-tier logo as an OPAQUE Pekulo proxy URL
  // (/v1/logos?ref=...). null = no merchant/bank logo resolved → UI falls to
  // the category icon. System-set on read (logos.service.enrich); never an
  // input field. NOT a real third-party URL on the wire — it points at
  // apps/api's streaming proxy.
  logoUrl: z.string().nullable().optional(),
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
  // Story 6-9 (FR-64) — calendar-month scope. When present, listByUser filters
  // occurredOn to [monthStart, nextMonthStart) UTC; cursor pagination still
  // applies WITHIN the month. Absent = the unscoped recent window (pre-6-9
  // behaviour — the pending-suggestions poll + any non-month caller keep it).
  month: monthKeySchema.optional(),
  // Story 6-9 ext — when present, listByUser switches to OFFSET pagination
  // (1-based `page`, pageSize = `limit`) and returns `totalCount` for numbered
  // pages. Absent = cursor pagination (the default, D2). A documented deviation
  // from D2/NFR-16 scoped to the Récentes list: bounded at Persona #1 scale
  // (≤200 tx/month); revisit if a user approaches the 50k cap.
  page: z.number().int().min(1).optional(),
});
export type ListTransactionsInput = z.infer<typeof listTransactionsInputSchema>;

export const listTransactionsOutputSchema = z.object({
  items: z.array(transactionSchema),
  nextCursor: z.string().nullable(),
  // Story 6-9 ext — total match count for numbered (offset) pagination; absent
  // in cursor mode (the default). The Récentes list derives pageCount from it.
  totalCount: z.number().nullable().optional(),
});
export type ListTransactionsOutput = z.infer<typeof listTransactionsOutputSchema>;

// ─── Month summary (story 6-9, FR-64) ────────────────────────────────────
// The navigator's stat cards (Net / Entrées / Sorties), server-aggregated over
// the WHOLE month so >200-tx months are exact (AC-4), reusing the /mensuel pure
// derive so transfers are EXCLUDED (AC-6). `month` omitted on input = the server
// resolves the most recent month with activity (current calendar month when the
// user has none). The resolved month is echoed back so the client seeds the
// navigator without a second round-trip.
export const monthSummaryInputSchema = z.object({
  month: monthKeySchema.optional(),
});
export type MonthSummaryInput = z.infer<typeof monthSummaryInputSchema>;

export const monthSummaryOutputSchema = z.object({
  month: monthKeySchema,
  incomeEur: z.number(),
  spendingEur: z.number(),
  netChangeEur: z.number(),
});
export type MonthSummaryOutput = z.infer<typeof monthSummaryOutputSchema>;

// ─── Envelope ─────────────────────────────────────────────────────────────
export const transactionsOkSchema = z.object({ ok: z.literal(true) });

// ─── Suggestion confirm / override (story 6-4, FR-33) ────────────────────────
// The user-facing categories a confirm/override may set: the closed enum minus
// the two system values 'transfer' (rule-owned, 5-3) and 'autre' (the
// un-categorised state being replaced). NARROWED per the 2026-05-30 lesson —
// confirmCategorisation is a trusted write, so its input accepts only the
// legitimate subset, never the full transactionCategorySchema.
export const SUGGESTABLE_TRANSACTION_CATEGORIES = [
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
  "factures",
  "restauration",
  "abonnements",
  "retrait",
] as const;
// Compile-time guard: every suggestable value is a real TransactionCategory.
const suggestableSubsetGuard: readonly TransactionCategory[] = SUGGESTABLE_TRANSACTION_CATEGORIES;
void suggestableSubsetGuard;

export const suggestableTransactionCategorySchema = z.enum(SUGGESTABLE_TRANSACTION_CATEGORIES);
export type SuggestableTransactionCategory = z.infer<typeof suggestableTransactionCategorySchema>;

// ─── Transaction source (story 6-7, FR-33 amended) ───────────────────────
// Where a transaction was created — drives the épic-6 categorisation policy:
// 'manual' rows keep the suggestion→confirm flow (6-4); 'csv'/'bridge' (bulk
// import) rows get the LLM suggestion APPLIED directly as the final category
// (no pending state). SERVER-INTERNAL — deliberately NOT part of the public
// Transaction DTO (the web "· IA" provenance hint derives from
// category === suggestedCategory instead). Plain string column, NO DB CHECK
// (lesson 2026-05-27 — the value universe is enumerated here + validated in
// the app layer, mirroring the free-String `category`).
export const TRANSACTION_SOURCES = ["manual", "csv", "bridge"] as const;
export const transactionSourceSchema = z.enum(TRANSACTION_SOURCES);
export type TransactionSource = z.infer<typeof transactionSourceSchema>;

export const confirmCategorisationInputSchema = z.object({
  id: z.string().regex(TRANSACTION_ID_REGEX, "id invalide"),
  category: suggestableTransactionCategorySchema,
});
export type ConfirmCategorisationInput = z.infer<typeof confirmCategorisationInputSchema>;

// Numbered (offset) pagination of the pending-suggestion triage list. NB: this
// list deliberately uses OFFSET, not the keyset convention NFR-16 mandates for
// the large append-only feeds (transactions list, llm_call_log). Numbered pages
// with random page-jump need a total count + skip/take; the pending set is a
// small bounded subset (category='autre' AND suggestedCategory != null), so the
// offset is sound here. Recorded so aped-review treats it as a decision, not a
// violation. (docs/quick-specs/2026-06-01-suggestions-ia-pagination.md)
export const listPendingSuggestionsInputSchema = z.object({
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(50).optional().default(10),
  // Story 6-9 ext (FR-64) — calendar-month scope. Present → listPendingByUser
  // filters occurredOn to the [monthStart, nextMonth) UTC range so the
  // Suggestions IA list + the "À confirmer" count reflect the active month.
  // Absent = the unscoped pending backlog (pre-ext callers unchanged).
  month: monthKeySchema.optional(),
});
export type ListPendingSuggestionsInput = z.infer<typeof listPendingSuggestionsInputSchema>;

export const listPendingSuggestionsOutputSchema = z.object({
  items: z.array(transactionSchema),
  totalCount: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});
export type ListPendingSuggestionsOutput = z.infer<typeof listPendingSuggestionsOutputSchema>;

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
