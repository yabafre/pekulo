// apps/mobile/app/sheets/transaction.tsx
// Create / edit a transaction (native iOS form sheet). Mirrors the web
// `transaction-create-form.tsx` / `transaction-edit-form.tsx` fields and
// validates with the shared `createTransactionInputSchema` /
// `updateTransactionInputSchema` through `useTransactionMutations`.
// Params: `id` (edit mode), `month` (YYYY-MM list the row came from).

import { PekuloButton, PekuloSegmentedControl } from "@pekulo/ui";
import type { TransactionCategory, TransactionType } from "@pekulo/validators";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react-native";
import { useEffect, useState } from "react";

import {
  AmountField,
  DateField,
  DestructiveButton,
  FormSection,
  SelectField,
  SwitchField,
  TextField,
} from "../../components/form/fields";
import { SheetScaffold, useMutationRunner } from "../../components/form/sheet";
import { confirmDestructive } from "../../lib/actions";
import { formatAmountInput, fromIsoDate, parseAmountInput, toIsoDate } from "../../lib/forms";
import { useTransactionMutations } from "../../lib/hooks/use-mobile-mutations";
import { useMobileTransactionsData } from "../../lib/hooks/use-mobile-queries";
import { useOptions } from "../../lib/options";

export default function TransactionSheet() {
  const options = useOptions();
  const params = useLocalSearchParams<{ id?: string; month?: string }>();
  const router = useRouter();
  const editId = params.id;
  const { data } = useMobileTransactionsData(params.month);
  const mutations = useTransactionMutations();
  const { run, error, pending } = useMutationRunner({ dismiss: true });

  const existing = editId ? data?.rows.find((row) => row.id === editId)?.raw : undefined;
  const accountOptions = data?.accountOptions ?? [];

  const [type, setType] = useState<TransactionType>("outflow");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date());
  const [accountId, setAccountId] = useState("");
  const [category, setCategory] = useState<TransactionCategory>("autre");
  const [isImprevu, setIsImprevu] = useState(false);
  const [notes, setNotes] = useState("");
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const edit =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setDirty(true);
      setter(value);
    };

  // Prefill once the cached row is available (edit mode), unless the user
  // already started editing before it arrived.
  useEffect(() => {
    if (!existing || hydratedId === existing.id) return;
    setHydratedId(existing.id);
    if (dirty) return;
    setType(existing.type);
    setLabel(existing.label);
    setAmount(formatAmountInput(existing.amount));
    setDate(fromIsoDate(existing.occurredOn));
    setAccountId(existing.accountId);
    setCategory(existing.category);
    setIsImprevu(existing.isImprevu);
    setNotes(existing.notes ?? "");
  }, [existing, hydratedId, dirty]);

  // Default the account to the first one once accounts load (create mode).
  const firstAccountId = accountOptions[0]?.value;
  useEffect(() => {
    if (!editId && !accountId && firstAccountId) setAccountId(firstAccountId);
  }, [editId, accountId, firstAccountId]);

  function save() {
    const fields = {
      accountId,
      occurredOn: toIsoDate(date),
      label: label.trim(),
      amount: parseAmountInput(amount),
      type,
      category,
      isImprevu,
      notes: notes.trim() === "" ? null : notes.trim(),
    };
    void run(
      () =>
        editId
          ? mutations.update.mutateAsync({ id: editId, ...fields })
          : mutations.create.mutateAsync(fields),
      editId ? "Transaction modifiée" : "Transaction ajoutée",
    );
  }

  function remove() {
    if (!editId) return;
    confirmDestructive({
      title: "Supprimer la transaction ?",
      message: "Elle sera retirée de vos totaux. Cette action est définitive.",
      confirmLabel: "Supprimer",
      onConfirm: () => {
        void run(() => mutations.remove.mutateAsync({ id: editId }), "Transaction supprimée");
      },
    });
  }

  return (
    <SheetScaffold
      title={editId ? "Modifier la transaction" : "Nouvelle transaction"}
      primaryLabel={editId ? "Enregistrer" : "Ajouter"}
      onPrimary={save}
      primaryDisabled={pending}
      error={error}
    >
      <PekuloSegmentedControl<TransactionType>
        ariaLabel="Type de transaction"
        value={type}
        onChange={edit(setType)}
        options={[
          { value: "outflow", label: "Sortie", icon: ArrowUpRight },
          { value: "inflow", label: "Entrée", icon: ArrowDownLeft },
        ]}
      />

      <FormSection>
        <TextField
          label="Libellé"
          value={label}
          onChange={edit(setLabel)}
          placeholder="Courses, salaire…"
          maxLength={120}
          testID="tx-label"
        />
        <AmountField label="Montant" value={amount} onChange={edit(setAmount)} testID="tx-amount" />
      </FormSection>

      <FormSection>
        <DateField label="Date" value={date} onChange={edit(setDate)} testID="tx-date" />
        <SelectField
          label="Compte"
          value={accountId}
          options={accountOptions}
          onChange={edit(setAccountId)}
          placeholder="Aucun compte"
          testID="tx-account"
        />
        <SelectField
          label="Catégorie"
          value={category}
          options={options.transactionCategories}
          onChange={edit(setCategory)}
          testID="tx-category"
        />
        <SwitchField
          label="Imprévu"
          value={isImprevu}
          onChange={edit(setIsImprevu)}
          testID="tx-imprevu"
        />
      </FormSection>

      <FormSection title="Notes">
        <TextField
          label="Notes (facultatif)"
          value={notes}
          onChange={edit(setNotes)}
          multiline
          maxLength={500}
          testID="tx-notes"
        />
      </FormSection>

      {editId ? (
        <DestructiveButton
          label="Supprimer la transaction"
          testID="tx-delete-btn"
          onPress={remove}
        />
      ) : null}
      {accountOptions.length === 0 && !editId ? (
        <PekuloButton
          variant="secondary"
          size="lg"
          style={{ width: "100%", height: 44 }}
          onPress={() => router.push("/sheets/account")}
        >
          Créer un compte d’abord
        </PekuloButton>
      ) : null}
    </SheetScaffold>
  );
}
