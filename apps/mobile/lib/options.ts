// apps/mobile/lib/options.ts
// Select options for the mobile sheets. Values come from the shared enums in
// `@pekulo/types` / `@pekulo/validators`; labels mirror apps/web/messages/fr.json
// so both platforms name things identically.

import {
  ACCOUNT_TYPES,
  HOLDING_KINDS,
  PROPERTY_TYPES,
  type AccountType,
  type HoldingKind,
  type PropertyType,
} from "@pekulo/types";
import {
  HOLDING_CURRENCIES,
  SUGGESTABLE_TRANSACTION_CATEGORIES,
  TRANSACTION_CATEGORIES,
  TRANSACTION_CATEGORY_LABELS,
  type SuggestableTransactionCategory,
  type TransactionCategory,
} from "@pekulo/validators";

import type { SelectOption } from "../components/form/fields";

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  livret: "Livret",
  pea: "PEA",
  cto: "CTO",
  av: "Assurance vie",
  autre: "Autre",
  banque: "Compte courant",
};

const HOLDING_KIND_LABELS: Record<HoldingKind, string> = {
  etf: "ETF",
  action: "Action",
  crypto: "Crypto",
  autre: "Autre",
};

const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  "residence-principale": "Résidence principale",
  locatif: "Locatif",
  autre: "Autre",
};

export const TRANSACTION_CATEGORY_OPTIONS: SelectOption<TransactionCategory>[] =
  TRANSACTION_CATEGORIES.map((value) => ({ value, label: TRANSACTION_CATEGORY_LABELS[value] }));

export const SUGGESTABLE_CATEGORY_OPTIONS: SelectOption<SuggestableTransactionCategory>[] =
  SUGGESTABLE_TRANSACTION_CATEGORIES.map((value) => ({
    value,
    label: TRANSACTION_CATEGORY_LABELS[value],
  }));

export const ACCOUNT_TYPE_OPTIONS: SelectOption<AccountType>[] = ACCOUNT_TYPES.map((value) => ({
  value,
  label: ACCOUNT_TYPE_LABELS[value],
}));

export const HOLDING_KIND_OPTIONS: SelectOption<HoldingKind>[] = HOLDING_KINDS.map((value) => ({
  value,
  label: HOLDING_KIND_LABELS[value],
}));

export const HOLDING_CURRENCY_OPTIONS: SelectOption<(typeof HOLDING_CURRENCIES)[number]>[] =
  HOLDING_CURRENCIES.map((value) => ({ value, label: value }));

export const PROPERTY_TYPE_OPTIONS: SelectOption<PropertyType>[] = PROPERTY_TYPES.map((value) => ({
  value,
  label: PROPERTY_TYPE_LABELS[value],
}));

export function propertyTypeLabel(value: PropertyType): string {
  return PROPERTY_TYPE_LABELS[value];
}
