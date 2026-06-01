// packages/types/src/transaction/transaction.types.ts
// Transactions domain types — Zod-inferred DTO + inputs re-exported from
// @pekulo/validators. UI-display shapes (Activity, Suggestion, LLM_ROUTE_BADGES,
// TX_DIRECTIONS) preserved as inline interfaces consumed by @pekulo/ui rows.

import type { Id } from "../shared/shared.types";

export type TransactionId = Id<"TransactionId">;

export type {
  TransactionType,
  TransactionCategory,
  Transaction,
  CreateTransactionInput,
  UpdateTransactionInput,
  GetTransactionInput,
  DeleteTransactionInput,
  ListTransactionsInput,
  ListTransactionsOutput,
  // Story 5-2 — CSV bulk import shapes.
  RawCsvRow,
  ValidatedCsvRow,
  PreviewedRow,
  PreviewImportCsvInput,
  PreviewImportCsvOutput,
  ImportCsvInput,
  ImportCsvOutput,
} from "@pekulo/validators";

// ─── UI display shapes (unchanged from pre-5-1) ──────────────────────────
export const TX_DIRECTIONS = ["in", "out"] as const;
export type TxDirection = (typeof TX_DIRECTIONS)[number];

export interface Activity {
  label: string;
  account: string;
  category: string;
  direction: TxDirection;
  amountEur: number;
  // Story 6-10 — opaque Pekulo proxy URL for the merchant/bank logo, or
  // null/undefined → row renders the category icon.
  logoUrl?: string | null;
}

// LLM route badge labels — UI-display variant (the "iOS / Ollama / Cloud"
// chip). The canonical backend routing enum is `LlmRoute`
// (`'foundation_models' | 'ollama' | 'third_party'`) in `../llm`, iso with the
// Prisma `LlmRoute` enum + `llmRouteSchema` (ADR-0008). Story 6-1 reconciled
// the name clash by renaming this UI variant to `LlmRouteBadge`; the badge is
// derived from the server `route_actual` at the row layer (story 6-4).
export const LLM_ROUTE_BADGES = ["ios", "ollama", "cloud"] as const;
export type LlmRouteBadge = (typeof LLM_ROUTE_BADGES)[number];

export interface Suggestion {
  label: string;
  account: string;
  dateLabel: string;
  direction: TxDirection;
  amountEur: number;
  suggestedCategory: string;
  confidence: number;
  route: LlmRouteBadge;
  // Story 6-10 — opaque Pekulo proxy URL for the merchant/bank logo, or
  // null/undefined → row renders the category icon.
  logoUrl?: string | null;
}
