"use client";

import { useTranslations } from "next-intl";
import { PekuloSettingRow, Section } from "@pekulo/ui";
import { View } from "@pekulo/ui/client";
import { useHypothesisProjection } from "../_hooks/use-hypothesis-projection";

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

// Story 7-4 (FR-57) — READ-ONLY hypothesis inputs in Paramètres. Reads the
// stored projection inputs (monthlyContribution + assumed annual rate) via the
// 7-3 projection read; currentWealthEur is irrelevant to these two fields, so
// it passes 0. Editing is OUT of scope for 7-4 (a later story may add a form
// using useRecordHypothesisProjection — decision D2).
export function HypothesisSettings() {
  const t = useTranslations("hypothesis");
  const projection = useHypothesisProjection(0);
  const monthly = projection.data?.monthlyContribution ?? 0;
  const ratePct = ((projection.data?.annualRate ?? 0) * 100).toFixed(2);
  return (
    <Section title={t("settings.title")} ariaLabel={t("settings.ariaLabel")}>
      <View flexDirection="column">
        <PekuloSettingRow label={t("settings.monthlyContribution")} value={eur0.format(monthly)} />
        <PekuloSettingRow
          label={t("settings.annualRate")}
          value={t("settings.rateValue", { rate: ratePct })}
        />
      </View>
    </Section>
  );
}
