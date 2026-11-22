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
import { useI18n } from "../../lib/i18n";
import { useOptions } from "../../lib/options";

export default function TransactionSheet() {
  const options = useOptions();
  const { t } = useI18n();
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
      editId ? t("transactions.toasts.updated") : t("transactions.toasts.added"),
    );
  }

  function remove() {
    if (!editId) return;
    confirmDestructive({
      title: t("transactions.delete.title"),
      message: t("transactions.delete.message"),
      confirmLabel: t("common.actions.delete"),
      onConfirm: () => {
        void run(
          () => mutations.remove.mutateAsync({ id: editId }),
          t("transactions.toasts.deleted"),
        );
      },
    });
  }

  return (
    <SheetScaffold
      title={editId ? t("transactions.editTransaction") : t("transactions.newTransaction")}
      primaryLabel={editId ? t("common.actions.save") : t("common.actions.add")}
      onPrimary={save}
      primaryDisabled={pending}
      error={error}
    >
      <PekuloSegmentedControl<TransactionType>
        ariaLabel={t("transactions.form.typeAria")}
        value={type}
        onChange={edit(setType)}
        options={[
          { value: "outflow", label: t("transactions.form.outflow"), icon: ArrowUpRight },
          { value: "inflow", label: t("transactions.form.inflow"), icon: ArrowDownLeft },
        ]}
      />

      <FormSection>
        <TextField
          label={t("transactions.form.label")}
          value={label}
          onChange={edit(setLabel)}
          placeholder={t("transactions.form.labelPlaceholder")}
          maxLength={120}
          testID="tx-label"
        />
        <AmountField
          label={t("transactions.form.amount")}
          value={amount}
          onChange={edit(setAmount)}
          testID="tx-amount"
        />
      </FormSection>

      <FormSection>
        <DateField
          label={t("common.fields.date")}
          value={date}
          onChange={edit(setDate)}
          testID="tx-date"
        />
        <SelectField
          label={t("common.fields.account")}
          value={accountId}
          options={accountOptions}
          onChange={edit(setAccountId)}
          placeholder={t("common.fields.noAccount")}
          testID="tx-account"
        />
        <SelectField
          label={t("transactions.form.category")}
          value={category}
          options={options.transactionCategories}
          onChange={edit(setCategory)}
          testID="tx-category"
        />
        <SwitchField
          label={t("transactions.form.imprevu")}
          value={isImprevu}
          onChange={edit(setIsImprevu)}
          testID="tx-imprevu"
        />
      </FormSection>

      <FormSection title={t("common.fields.notes")}>
        <TextField
          label={t("common.fields.notesOptional")}
          value={notes}
          onChange={edit(setNotes)}
          multiline
          maxLength={500}
          testID="tx-notes"
        />
      </FormSection>

      {editId ? (
        <DestructiveButton
          label={t("transactions.delete.button")}
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
          {t("transactions.form.createAccountFirst")}
        </PekuloButton>
      ) : null}
    </SheetScaffold>
  );
}
