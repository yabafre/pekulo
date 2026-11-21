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

export default function AccountBalanceSheet() {
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
      title={account ? `Solde · ${account.label}` : "Mettre à jour le solde"}
      onPrimary={() => {
        void run(
          () =>
            recordBalance.mutateAsync({
              id,
              valuedOn: toUtcDay(date),
              cashBalance: parseAmountInput(amount),
            }),
          "Solde mis à jour",
        );
      }}
      primaryDisabled={pending}
      error={error}
    >
      <FormSection footer="Le nouveau solde est ajouté à l’historique du compte.">
        <AmountField
          label="Nouveau solde"
          value={amount}
          onChange={setAmount}
          testID="bal-amount"
        />
        <DateField
          label="Date"
          value={date}
          onChange={setDate}
          maximumDate={new Date()}
          testID="bal-date"
        />
      </FormSection>
    </SheetScaffold>
  );
}
