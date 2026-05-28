// packages/types/src/account/account.types.ts
// Account (Comptes / Patrimoine) types.
//
// Closed enum literal + derived type live HERE as the cross-app source of
// truth (L1 — domain types/closed enum literals belong in @pekulo/types
// since both apps/web and apps/api consume them).
//
// @pekulo/validators/src/accounts.ts mirrors the literal inline in z.enum
// (it can't import from here — @pekulo/types already declares
// @pekulo/validators for downstream re-exports like Account / Compass /
// Milestone, and Turbo refuses the reverse edge). Keep both sides in sync;
// drift caught at code review.

// Story 5-6 FEAT13 (2026-05-27) adds "banque" for Bridge checking accounts.
export const ACCOUNT_TYPES = ["livret", "pea", "cto", "av", "autre", "banque"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** UI prop shape consumed by PekuloAccountRow / PekuloAccountsSection. */
export interface AccountCardItem {
  label: string;
  type: AccountType;
  institution?: string;
  balanceEur: number;
}

/** Canonical domain entity (z.infer from @pekulo/validators#accountSchema). */
export type { Account } from "@pekulo/validators";
