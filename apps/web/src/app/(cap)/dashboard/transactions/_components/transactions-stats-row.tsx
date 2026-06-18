"use client";

// apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-stats-row.tsx
// Mirrors ux-preview TransactionsScreen stat row (App.tsx L1297-1330):
//   - 2 cards on mobile (Net + À confirmer)
//   - 4 cards on desktop (+ Entrées + Sorties)
// Story 6-9 (FR-64): Net/Entrées/Sorties come from the SERVER monthSummary for
// the active month (MonthScopeProvider) — transfers excluded (/mensuel
// semantics). The pre-6-9 client `new Date()` current-month filter over
// useTransactions(200) is removed (no client clock dependency, no >200
// truncation). "À confirmer" stays the live pending count (story 6-4).

import { useEffect, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Text, View } from "@pekulo/ui/client";
import { Section } from "@pekulo/ui";
import { usePendingSuggestions } from "../_hooks/use-pending-suggestions";
import { formatMonthName } from "./month-key";
import { useMonthScope } from "./month-scope-context";

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const signed = (n: number) => `${n >= 0 ? "+" : ""}${eur0.format(n)}`;

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 16,
};

const gridStyleLg: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 16,
};

const PLACEHOLDER = "—";

export function TransactionsStatsRow() {
  const t = useTranslations("transactions");
  const { summary, month } = useMonthScope();
  // "À confirmer" — live pending-suggestion total, scoped to the active month
  // (story 6-9 ext; shares the pending(1, month) cache with the Suggestions IA
  // section so both reflect the same month).
  const { data: pendingData } = usePendingSuggestions(
    1,
    undefined,
    month ?? undefined,
    month != null,
  );

  // Hydration guard (R13) — the summary comes from the TanStack cache, so SSR
  // renders the PLACEHOLDER and the client renders real numbers on the first
  // cached paint → without the guard React 19 logs a hydration mismatch.
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => setIsHydrated(true), []);

  let monthLabel = PLACEHOLDER;
  let netLabel = PLACEHOLDER;
  let netColor: "$success" | "$danger" | "$color" = "$color";
  let inflowLabel = PLACEHOLDER;
  let outflowLabel = PLACEHOLDER;

  if (isHydrated && summary) {
    monthLabel = formatMonthName(summary.month);
    netLabel = signed(summary.netChangeEur);
    netColor = summary.netChangeEur >= 0 ? "$success" : "$danger";
    inflowLabel = eur0.format(summary.incomeEur);
    outflowLabel = eur0.format(summary.spendingEur);
  }
  const pendingCount = isHydrated ? (pendingData?.totalCount ?? 0) : 0;

  return (
    <>
      <View display="block" $lg={{ display: "none" }}>
        <div style={gridStyle}>
          <Section ariaLabel={t("statNetAria")}>
            <Text color="$colorTertiary" fontSize="$caption">
              {t("statNetMonth", { month: monthLabel })}
            </Text>
            <Text marginTop="$2" fontSize="$h2" fontWeight="600" color={netColor}>
              {netLabel}
            </Text>
          </Section>
          <Section ariaLabel={t("statPendingAria")}>
            <Text color="$colorTertiary" fontSize="$caption">
              {t("statToConfirm")}
            </Text>
            <View flexDirection="row" alignItems="baseline" gap="$2" marginTop="$2">
              <Text fontSize="$h2" fontWeight="600" color="$color">
                {pendingCount}
              </Text>
              <Text color="$colorTertiary" fontSize="$caption">
                {t("statSuggestions")}
              </Text>
            </View>
          </Section>
        </div>
      </View>
      <View display="none" $lg={{ display: "block" }}>
        <div style={gridStyleLg}>
          <Section ariaLabel={t("statNetAria")}>
            <Text color="$colorTertiary" fontSize="$caption">
              {t("statNetMonth", { month: monthLabel })}
            </Text>
            <Text marginTop="$2" fontSize="$h2" fontWeight="600" color={netColor}>
              {netLabel}
            </Text>
          </Section>
          <Section ariaLabel={t("statPendingAria")}>
            <Text color="$colorTertiary" fontSize="$caption">
              {t("statToConfirm")}
            </Text>
            <View flexDirection="row" alignItems="baseline" gap="$2" marginTop="$2">
              <Text fontSize="$h2" fontWeight="600" color="$color">
                {pendingCount}
              </Text>
              <Text color="$colorTertiary" fontSize="$caption">
                {t("statSuggestions")}
              </Text>
            </View>
          </Section>
          <Section ariaLabel={t("statInflowAria")}>
            <Text color="$colorTertiary" fontSize="$caption">
              {t("statInflowMonth", { month: monthLabel })}
            </Text>
            <Text marginTop="$2" fontSize="$h2" fontWeight="600" color="$color">
              {inflowLabel}
            </Text>
          </Section>
          <Section ariaLabel={t("statOutflowAria")}>
            <Text color="$colorTertiary" fontSize="$caption">
              {t("statOutflowMonth", { month: monthLabel })}
            </Text>
            <Text marginTop="$2" fontSize="$h2" fontWeight="600" color="$color">
              {outflowLabel}
            </Text>
          </Section>
        </div>
      </View>
    </>
  );
}
