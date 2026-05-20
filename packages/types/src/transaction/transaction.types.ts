// packages/types/src/transaction/transaction.types.ts
// Transaction types — Activity (UI feed) + Suggestion (LLM) + data-row
// entity (Transaction).

// String-literal unions mirror the zod enums in @pekulo/validators —
// re-exported so apps/web type-narrowing (form field `type` / `category`
// selects) doesn't have to import from two locations.
export type { TransactionType, TransactionCategory } from "@pekulo/validators";

import type { TransactionType, TransactionCategory } from "@pekulo/validators";

// Data-row shape for the transactions table. Distinct from the UI-display
// `Activity` below (which is the truncated row for the Recent Activity feed
// on the dashboard). Returned by the brownfield Supabase reader being ported
// in Epic 6.
export interface Transaction {
  id: string;
  occurredOn: string; // YYYY-MM-DD
  label: string;
  amount: number;
  type: TransactionType;
  category: TransactionCategory;
  isImprevu: boolean;
  notes: string | null;
  createdAt: string;
}

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
