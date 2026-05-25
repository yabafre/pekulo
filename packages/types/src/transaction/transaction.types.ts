// packages/types/src/transaction/transaction.types.ts
// Transactions domain types — Zod-inferred DTO + inputs re-exported from
// @pekulo/validators. UI-display shapes (Activity, Suggestion, LLM_ROUTES,
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
}

// LLM routing labels — UI-display variant. Backend labels are
// `'foundation_models' | 'ollama' | 'third_party'` (architecture L243 +
// ADR-0008). The two surfaces are reconciled when transactions feature
// epic 6-x wires the real router.
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
