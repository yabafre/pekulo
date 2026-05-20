// Zod source of truth for the transactions aggregate. Will land server-side
// when Epic 6 migrates transactions to oRPC ; the schemas + category labels
// live here today so the form code in apps/web can validate input + render
// French UI labels against the same shape the future api will accept.
//
// Relocated from apps/web/src/lib/schemas/transactions.ts during the
// archi-audit pass (PR #86) — every Zod schema in the monorepo lives under
// @pekulo/validators per ADR-0011 and routes its `z` through @pekulo/zod (R1).

import { z } from "@pekulo/zod";

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

export const transactionInputSchema = z.object({
  id: z.string().uuid().optional(),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date YYYY-MM-DD requise"),
  label: z.string().min(1, "Libellé requis").max(120),
  amount: z.number().min(0, "Montant ≥ 0"),
  type: transactionTypeSchema,
  category: transactionCategorySchema,
  isImprevu: z.boolean(),
  notes: z.string().max(500).optional().nullable(),
});

export type TransactionInput = z.infer<typeof transactionInputSchema>;

export const transactionIdSchema = z.object({ id: z.string().uuid() });
export type TransactionId = z.infer<typeof transactionIdSchema>;

export const transactionFiltersSchema = z.object({
  year: z.number().int().optional(),
  monthNum: z.number().int().min(1).max(12).optional(),
  type: transactionTypeSchema.optional(),
  categories: z.array(transactionCategorySchema).optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;
