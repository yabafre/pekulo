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

export default function ClotureSheet() {
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
    ? formatMonthKey(`${current.year}-${String(current.monthNum).padStart(2, "0")}`)
    : "";
  const open = current ? isWithinCloseWindow(current.year, current.monthNum, nowDate()) : false;

  function save() {
    if (!current) return;
    if (!open) {
      setError(`Clôture possible du ${closeWindowLabel(current.year, current.monthNum)}.`);
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
      `${monthLabel} clôturé`,
    );
  }

  return (
    <SheetScaffold
      title={monthLabel ? `Clôturer ${monthLabel.toLowerCase()}` : "Clôturer le mois"}
      primaryLabel="Clôturer"
      onPrimary={current ? save : undefined}
      primaryDisabled={pending || !open}
      error={error}
    >
      <FormSection
        footer={
          current
            ? `Vérifiez les montants avant de figer le mois. Fenêtre de clôture : ${closeWindowLabel(current.year, current.monthNum)}.`
            : undefined
        }
      >
        <AmountField label="Entrées" value={income} onChange={setIncome} testID="clo-income" />
        <AmountField
          label="Sorties"
          value={spending}
          onChange={setSpending}
          testID="clo-spending"
        />
        <AmountField
          label="Virements"
          value={transfers}
          onChange={setTransfers}
          testID="clo-transfers"
        />
        <AmountField
          label="Variation nette"
          value={netChange}
          onChange={setNetChange}
          testID="clo-net"
        />
      </FormSection>
    </SheetScaffold>
  );
}
