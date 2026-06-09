// apps/web/src/app/(cap)/dashboard/_lib/to-activity.ts
// Single source of the Transaction → Activity (PekuloActivityRow `tx` prop)
// mapping. Extracted from the inline copy in transactions-recent-section
// (story 7-2 / D4). `accountLabel` is resolved by the caller (it owns the
// accountId→label map). The category is turned into its French label here; the
// raw enum is still passed to the row's icon/logo at the call site.
import { TRANSACTION_CATEGORY_LABELS, type Transaction } from "@pekulo/validators";
import type { Activity } from "@pekulo/types";

export function txToActivity(tx: Transaction, accountLabel: string): Activity {
  return {
    label: tx.label,
    account: accountLabel,
    category: TRANSACTION_CATEGORY_LABELS[tx.category],
    direction: tx.type === "inflow" ? "in" : "out",
    amountEur: tx.amount,
    logoUrl: tx.logoUrl ?? null,
  };
}
