"use client";

import { useState } from "react";
import {
  PekuloDatePicker,
  PekuloField,
  PekuloFieldError,
  PekuloFieldGroup,
  PekuloFieldLabel,
  PekuloInput,
  PekuloSelect,
  PekuloSubmitButton,
} from "@pekulo/ui";
import { View } from "@pekulo/ui/client";
import {
  TRANSACTION_CATEGORIES,
  TRANSACTION_CATEGORY_LABELS,
  type Transaction,
  type TransactionCategory,
  type TransactionType,
  type UpdateTransactionInput,
} from "@pekulo/validators";
import { useAppForm } from "@/hooks/form-hook";
import { useUpdateTransaction } from "../_hooks/use-update-transaction";

const TYPE_LABEL: Record<TransactionType, string> = {
  inflow: "Entrée",
  outflow: "Sortie",
};

export interface TransactionEditFormProps {
  transaction: Transaction;
  onSuccess?: () => void;
}

export function TransactionEditForm({ transaction, onSuccess }: TransactionEditFormProps) {
  const { mutate, isPending, reset } = useUpdateTransaction();
  const [envelopeError, setEnvelopeError] = useState<string | null>(null);

  const form = useAppForm({
    defaultValues: {
      occurredOn: transaction.occurredOn,
      label: transaction.label,
      amount: String(transaction.amount),
      type: transaction.type,
      category: transaction.category,
      notes: transaction.notes ?? "",
    },
    validators: {
      onSubmit: ({ value }) => {
        const trimmed = value.label.trim();
        if (trimmed.length === 0) return "Libellé requis";
        if (trimmed.length > 120) return "Libellé > 120 caractères";
        const amt = Number(value.amount);
        if (!Number.isFinite(amt) || amt < 0) return "Montant invalide (≥ 0)";
        if (value.notes.trim().length > 500) return "Notes > 500 caractères";
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      setEnvelopeError(null);
      const trimmedLabel = value.label.trim();
      const trimmedNotes = value.notes.trim();
      const amount = Number(value.amount);
      const patch: UpdateTransactionInput = { id: transaction.id };
      if (value.occurredOn !== transaction.occurredOn) patch.occurredOn = value.occurredOn;
      if (trimmedLabel !== transaction.label) patch.label = trimmedLabel;
      if (amount !== transaction.amount) patch.amount = amount;
      if (value.type !== transaction.type) patch.type = value.type;
      if (value.category !== transaction.category) patch.category = value.category;
      const newNotes = trimmedNotes.length > 0 ? trimmedNotes : null;
      if (newNotes !== transaction.notes) patch.notes = newNotes;
      mutate(patch, {
        onSuccess: (result) => {
          if (result.ok) {
            reset();
            onSuccess?.();
          } else {
            setEnvelopeError(result.message);
          }
        },
      });
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      aria-label="Modifier la transaction"
    >
      <View padding="$4">
        <PekuloFieldGroup>
          <form.Field name="occurredOn">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="tx-edit-date">Date</PekuloFieldLabel>
                <PekuloDatePicker
                  id="tx-edit-date"
                  value={field.state.value ? new Date(field.state.value) : undefined}
                  onChange={(d) => field.handleChange(d ? d.toISOString().slice(0, 10) : "")}
                />
              </PekuloField>
            )}
          </form.Field>
          <form.Field name="label">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="tx-edit-label">Libellé</PekuloFieldLabel>
                <PekuloInput
                  id="tx-edit-label"
                  type="text"
                  maxLength={120}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.currentTarget.value)}
                />
              </PekuloField>
            )}
          </form.Field>
          <form.Field name="amount">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="tx-edit-amount">Montant (€)</PekuloFieldLabel>
                <PekuloInput
                  id="tx-edit-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.currentTarget.value)}
                />
              </PekuloField>
            )}
          </form.Field>
          <form.Field name="type">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="tx-edit-type">Type</PekuloFieldLabel>
                <PekuloSelect
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as TransactionType)}
                >
                  <PekuloSelect.Trigger id="tx-edit-type">
                    <PekuloSelect.Value placeholder="Type" />
                  </PekuloSelect.Trigger>
                  <PekuloSelect.Content>
                    <PekuloSelect.Group>
                      <PekuloSelect.Item value="inflow" index={0}>
                        {TYPE_LABEL.inflow}
                      </PekuloSelect.Item>
                      <PekuloSelect.Item value="outflow" index={1}>
                        {TYPE_LABEL.outflow}
                      </PekuloSelect.Item>
                    </PekuloSelect.Group>
                  </PekuloSelect.Content>
                </PekuloSelect>
              </PekuloField>
            )}
          </form.Field>
          <form.Field name="category">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="tx-edit-category">Catégorie</PekuloFieldLabel>
                <PekuloSelect
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as TransactionCategory)}
                >
                  <PekuloSelect.Trigger id="tx-edit-category">
                    <PekuloSelect.Value placeholder="Catégorie" />
                  </PekuloSelect.Trigger>
                  <PekuloSelect.Content>
                    <PekuloSelect.Group>
                      {TRANSACTION_CATEGORIES.map((c, i) => (
                        <PekuloSelect.Item key={c} value={c} index={i}>
                          {TRANSACTION_CATEGORY_LABELS[c]}
                        </PekuloSelect.Item>
                      ))}
                    </PekuloSelect.Group>
                  </PekuloSelect.Content>
                </PekuloSelect>
              </PekuloField>
            )}
          </form.Field>
          <form.Field name="notes">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="tx-edit-notes">Notes (optionnel)</PekuloFieldLabel>
                <PekuloInput
                  id="tx-edit-notes"
                  type="text"
                  maxLength={500}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.currentTarget.value)}
                />
              </PekuloField>
            )}
          </form.Field>
          <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
            {(clientError) =>
              clientError ? <PekuloFieldError>{String(clientError)}</PekuloFieldError> : null
            }
          </form.Subscribe>
          {envelopeError && <PekuloFieldError>{envelopeError}</PekuloFieldError>}
          <PekuloSubmitButton loading={isPending} loadingLabel="Enregistrement…">
            Enregistrer
          </PekuloSubmitButton>
        </PekuloFieldGroup>
      </View>
    </form>
  );
}
