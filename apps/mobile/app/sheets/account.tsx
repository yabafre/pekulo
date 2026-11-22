// apps/mobile/app/sheets/account.tsx
// Create / edit an account (native iOS form sheet), mirroring the web
// `account-create-form.tsx` / `account-edit-form.tsx`. Currency is locked to
// EUR exactly like the web (story 2-3 review HIGH #6) until FX ships.
// Params: `id` (edit mode).

import type { AccountType } from "@pekulo/types";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import { AmountField, FormSection, SelectField, TextField } from "../../components/form/fields";
import { SheetScaffold, useMutationRunner } from "../../components/form/sheet";
import { parseAmountInput } from "../../lib/forms";
import { useAccountMutations } from "../../lib/hooks/use-mobile-mutations";
import { useMobileCapData } from "../../lib/hooks/use-mobile-queries";
import { useI18n } from "../../lib/i18n";
import { useOptions } from "../../lib/options";

const FORCED_CURRENCY = "EUR" as const;

export default function AccountSheet() {
  const { t } = useI18n();
  const options = useOptions();
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const { data } = useMobileCapData();
  const { create, update } = useAccountMutations();
  const { run, error, pending } = useMutationRunner({ dismiss: true });
  const existing = editId ? data?.accountEntities.find((a) => a.id === editId) : undefined;

  const [label, setLabel] = useState("");
  const [type, setType] = useState<AccountType>("banque");
  const [balance, setBalance] = useState("");
  const [notes, setNotes] = useState("");
  const [hydrated, setHydrated] = useState(false);

  const [dirty, setDirty] = useState(false);
  const edit =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setDirty(true);
      setter(value);
    };

  // Prefill from the cached account unless the user already started editing.
  useEffect(() => {
    if (!existing || hydrated) return;
    setHydrated(true);
    if (dirty) return;
    setLabel(existing.label);
    setType(existing.type);
    setNotes(existing.notes ?? "");
  }, [existing, hydrated, dirty]);

  function save() {
    const cleanNotes = notes.trim() === "" ? null : notes.trim();
    void run(
      () =>
        editId
          ? update.mutateAsync({ id: editId, label: label.trim(), type, notes: cleanNotes })
          : create.mutateAsync({
              label: label.trim(),
              type,
              currency: FORCED_CURRENCY,
              cashBalance: parseAmountInput(balance),
              notes: cleanNotes,
            }),
      editId ? t("cap.accountSheet.updated") : t("cap.accountSheet.added"),
    );
  }

  return (
    <SheetScaffold
      title={editId ? t("cap.accountSheet.editTitle") : t("cap.accountSheet.createTitle")}
      primaryLabel={editId ? t("common.actions.save") : t("common.actions.add")}
      onPrimary={save}
      primaryDisabled={pending}
      error={error}
    >
      <FormSection>
        <TextField
          label={t("cap.accountSheet.name")}
          value={label}
          onChange={edit(setLabel)}
          placeholder={t("cap.accountSheet.namePlaceholder")}
          maxLength={120}
          testID="acc-label"
        />
        <SelectField
          label={t("common.fields.type")}
          value={type}
          options={options.accountTypes}
          onChange={edit(setType)}
          testID="acc-type"
        />
        {editId ? null : (
          <AmountField
            label={t("cap.accountSheet.balance")}
            value={balance}
            onChange={setBalance}
            testID="acc-balance"
          />
        )}
      </FormSection>
      <FormSection title={t("common.fields.notes")} footer={t("cap.accountSheet.notesFooter")}>
        <TextField
          label={t("common.fields.notesOptional")}
          value={notes}
          onChange={edit(setNotes)}
          multiline
          maxLength={500}
          testID="acc-notes"
        />
      </FormSection>
    </SheetScaffold>
  );
}
