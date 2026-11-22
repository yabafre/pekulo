// apps/mobile/app/sheets/account-balance.tsx
// Record a new balance for an account (native iOS form sheet) — the web
// `account-balance-form.tsx` equivalent, calling `accounts.recordBalanceChange`
// so the balance history keeps a dated entry. Params: `id` (account).

import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import { AmountField, DateField, FormSection } from "../../components/form/fields";
import { SheetScaffold, useMutationRunner } from "../../components/form/sheet";
import { formatAmountInput, parseAmountInput, toUtcDay } from "../../lib/forms";
import { useAccountMutations } from "../../lib/hooks/use-mobile-mutations";
import { useMobileCapData } from "../../lib/hooks/use-mobile-queries";
import { useI18n } from "../../lib/i18n";

export default function AccountBalanceSheet() {
  const { t } = useI18n();
  const { id = "" } = useLocalSearchParams<{ id?: string }>();
  const { data } = useMobileCapData();
  const { recordBalance } = useAccountMutations();
  const { run, error, pending } = useMutationRunner({ dismiss: true });
  const account = data?.accountEntities.find((a) => a.id === id);

  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date());
  const [hydrated, setHydrated] = useState(false);

  // Prefill with the current balance unless the user already started typing.
  useEffect(() => {
    if (!account || hydrated) return;
    setHydrated(true);
    if (amount !== "") return;
    setAmount(formatAmountInput(account.cashBalance));
  }, [account, hydrated, amount]);

  return (
    <SheetScaffold
      title={
        account
          ? t("cap.balanceSheet.titleWithAccount", { label: account.label })
          : t("cap.balanceSheet.title")
      }
      onPrimary={() => {
        void run(
          () =>
            recordBalance.mutateAsync({
              id,
              valuedOn: toUtcDay(date),
              cashBalance: parseAmountInput(amount),
            }),
          t("cap.balanceSheet.updated"),
        );
      }}
      primaryDisabled={pending}
      error={error}
    >
      <FormSection footer={t("cap.balanceSheet.footer")}>
        <AmountField
          label={t("cap.balanceSheet.newBalance")}
          value={amount}
          onChange={setAmount}
          testID="bal-amount"
        />
        <DateField
          label={t("common.fields.date")}
          value={date}
          onChange={setDate}
          maximumDate={new Date()}
          testID="bal-date"
        />
      </FormSection>
    </SheetScaffold>
  );
}
