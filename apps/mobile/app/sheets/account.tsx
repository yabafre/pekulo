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
import { useOptions } from "../../lib/options";

const FORCED_CURRENCY = "EUR" as const;

export default function AccountSheet() {
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
      editId ? "Compte modifié" : "Compte ajouté",
    );
  }

  return (
    <SheetScaffold
      title={editId ? "Modifier le compte" : "Nouveau compte"}
      primaryLabel={editId ? "Enregistrer" : "Ajouter"}
      onPrimary={save}
      primaryDisabled={pending}
      error={error}
    >
      <FormSection>
        <TextField
          label="Nom du compte"
          value={label}
          onChange={edit(setLabel)}
          placeholder="Livret A, PEA…"
          maxLength={120}
          testID="acc-label"
        />
        <SelectField
          label="Type"
          value={type}
          options={options.accountTypes}
          onChange={edit(setType)}
          testID="acc-type"
        />
        {editId ? null : (
          <AmountField
            label="Solde actuel"
            value={balance}
            onChange={setBalance}
            testID="acc-balance"
          />
        )}
      </FormSection>
      <FormSection title="Notes" footer="Les comptes sont tenus en euros.">
        <TextField
          label="Notes (facultatif)"
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
