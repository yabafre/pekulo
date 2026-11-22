// apps/mobile/app/sheets/cloture.tsx
// Sign off the current month (native iOS form sheet) — the web
// `cloture-modal.tsx` equivalent. Figures are prefilled from the derived month
// and stay editable; the sheet only submits inside the same close window as
// the web (last 5 days of the month → 5 days after, UTC).

import { useEffect, useState } from "react";

import { AmountField, FormSection } from "../../components/form/fields";
import { SheetScaffold, useMutationRunner } from "../../components/form/sheet";
import {
  closeWindowLabel,
  formatAmountInput,
  formatMonthKey,
  isWithinCloseWindow,
  nowDate,
  parseAmountInput,
} from "../../lib/forms";
import { useMonthlyMutations } from "../../lib/hooks/use-mobile-mutations";
import { useMobileMonthlyData } from "../../lib/hooks/use-mobile-queries";
import { useI18n } from "../../lib/i18n";

export default function ClotureSheet() {
  const { t, lang, locale } = useI18n();
  const { data } = useMobileMonthlyData();
  const { signOff } = useMonthlyMutations();
  const { run, error, setError, pending } = useMutationRunner({ dismiss: true });
  const current = data?.current;

  const [income, setIncome] = useState("");
  const [spending, setSpending] = useState("");
  const [transfers, setTransfers] = useState("");
  const [netChange, setNetChange] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!current || hydrated) return;
    setIncome(formatAmountInput(current.incomeEur));
    setSpending(formatAmountInput(current.spendingEur));
    setTransfers(formatAmountInput(current.transfersEur));
    setNetChange(formatAmountInput(current.netChangeEur));
    setHydrated(true);
  }, [current, hydrated]);

  const monthLabel = current
    ? formatMonthKey(`${current.year}-${String(current.monthNum).padStart(2, "0")}`, locale)
    : "";
  // Month names are lowercase mid-sentence in French, capitalised in English.
  const monthLabelInline = lang === "fr" ? monthLabel.toLowerCase() : monthLabel;
  const open = current ? isWithinCloseWindow(current.year, current.monthNum, nowDate()) : false;

  function save() {
    if (!current) return;
    if (!open) {
      setError(
        t("monthly.sheet.windowError", {
          range: closeWindowLabel(current.year, current.monthNum, locale),
        }),
      );
      return;
    }
    void run(
      () =>
        signOff.mutateAsync({
          year: current.year,
          monthNum: current.monthNum,
          incomeEur: parseAmountInput(income),
          spendingEur: parseAmountInput(spending),
          transfersEur: parseAmountInput(transfers),
          netChangeEur: parseAmountInput(netChange),
        }),
      t("monthly.sheet.done", { month: monthLabel }),
    );
  }

  return (
    <SheetScaffold
      title={
        monthLabel
          ? t("monthly.sheet.title", { month: monthLabelInline })
          : t("monthly.sheet.titleFallback")
      }
      primaryLabel={t("monthly.sheet.primary")}
      onPrimary={current ? save : undefined}
      primaryDisabled={pending || !open}
      error={error}
    >
      <FormSection
        footer={
          current
            ? t("monthly.sheet.footer", {
                range: closeWindowLabel(current.year, current.monthNum, locale),
              })
            : undefined
        }
      >
        <AmountField
          label={t("monthly.sheet.income")}
          value={income}
          onChange={setIncome}
          testID="clo-income"
        />
        <AmountField
          label={t("monthly.sheet.spending")}
          value={spending}
          onChange={setSpending}
          testID="clo-spending"
        />
        <AmountField
          label={t("monthly.sheet.transfers")}
          value={transfers}
          onChange={setTransfers}
          testID="clo-transfers"
        />
        <AmountField
          label={t("monthly.sheet.netChange")}
          value={netChange}
          onChange={setNetChange}
          testID="clo-net"
        />
      </FormSection>
    </SheetScaffold>
  );
}
