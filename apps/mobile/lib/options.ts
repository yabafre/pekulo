// apps/mobile/lib/options.ts
// Localised select options for the mobile sheets. Values come from the shared
// enums in `@pekulo/types` / `@pekulo/validators`; labels come from the i18n
// dictionaries (aligned with apps/web/messages).

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
  type SuggestableTransactionCategory,
  type TransactionCategory,
} from "@pekulo/validators";
import { useMemo } from "react";

import type { SelectOption } from "../components/form/fields";
import { useI18n, type MessageKey, type Translate } from "./i18n";

const PROPERTY_TYPE_KEY: Record<PropertyType, MessageKey> = {
  "residence-principale": "common.propertyTypes.residencePrincipale",
  locatif: "common.propertyTypes.locatif",
  autre: "common.propertyTypes.autre",
};

export function categoryLabel(t: Translate, category: string): string {
  return t(`common.categories.${category}` as MessageKey);
}

export function accountTypeLabel(t: Translate, type: AccountType): string {
  return t(`common.accountTypes.${type}` as MessageKey);
}

export function holdingKindLabel(t: Translate, kind: HoldingKind): string {
  return t(`common.holdingKinds.${kind}` as MessageKey);
}

export function propertyTypeLabel(t: Translate, type: PropertyType): string {
  return t(PROPERTY_TYPE_KEY[type]);
}

export function useOptions() {
  const { t } = useI18n();
  return useMemo(
    () => ({
      transactionCategories: TRANSACTION_CATEGORIES.map(
        (value): SelectOption<TransactionCategory> => ({ value, label: categoryLabel(t, value) }),
      ),
      suggestableCategories: SUGGESTABLE_TRANSACTION_CATEGORIES.map(
        (value): SelectOption<SuggestableTransactionCategory> => ({
          value,
          label: categoryLabel(t, value),
        }),
      ),
      accountTypes: ACCOUNT_TYPES.map(
        (value): SelectOption<AccountType> => ({ value, label: accountTypeLabel(t, value) }),
      ),
      holdingKinds: HOLDING_KINDS.map(
        (value): SelectOption<HoldingKind> => ({ value, label: holdingKindLabel(t, value) }),
      ),
      holdingCurrencies: HOLDING_CURRENCIES.map(
        (value): SelectOption<(typeof HOLDING_CURRENCIES)[number]> => ({ value, label: value }),
      ),
      propertyTypes: PROPERTY_TYPES.map(
        (value): SelectOption<PropertyType> => ({ value, label: propertyTypeLabel(t, value) }),
      ),
    }),
    [t],
  );
}
