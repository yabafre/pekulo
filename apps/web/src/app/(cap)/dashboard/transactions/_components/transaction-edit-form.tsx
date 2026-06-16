"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  CategoryIcon,
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

export interface TransactionEditFormProps {
  transaction: Transaction;
  onSuccess?: () => void;
}

export function TransactionEditForm({ transaction, onSuccess }: TransactionEditFormProps) {
  const t = useTranslations("transactions");
  const TYPE_LABEL: Record<TransactionType, string> = {
    inflow: t("types.inflow"),
    outflow: t("types.outflow"),
  };
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
        if (trimmed.length === 0) return t("errors.labelRequired");
        if (trimmed.length > 120) return t("errors.labelTooLong");
        const amt = Number(value.amount);
        if (!Number.isFinite(amt) || amt < 0) return t("errors.amountInvalid");
        if (value.notes.trim().length > 500) return t("errors.notesTooLong");
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
      // Short-circuit on no-op submit — the validator refine would reject
      // with 400 ("requires at least one field beyond id") and surface as
      // a red banner. Better UX: tell the user inline before the round-trip.
      const { id: _id, ...changed } = patch;
      if (Object.keys(changed).length === 0) {
        setEnvelopeError(t("errors.noChange"));
        return;
      }
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
      aria-label={t("editFormAria")}
    >
      <View padding="$4">
        <PekuloFieldGroup>
          <form.Field name="occurredOn">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="tx-edit-date">{t("fields.date")}</PekuloFieldLabel>
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
                <PekuloFieldLabel htmlFor="tx-edit-label">{t("fields.label")}</PekuloFieldLabel>
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
                <PekuloFieldLabel htmlFor="tx-edit-amount">{t("fields.amount")}</PekuloFieldLabel>
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
                <PekuloFieldLabel htmlFor="tx-edit-type">{t("fields.type")}</PekuloFieldLabel>
                <PekuloSelect
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as TransactionType)}
                >
                  <PekuloSelect.Trigger id="tx-edit-type">
                    <PekuloSelect.Value placeholder={t("fields.type")} />
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
                <PekuloFieldLabel htmlFor="tx-edit-category">
                  {t("fields.category")}
                </PekuloFieldLabel>
                <PekuloSelect
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as TransactionCategory)}
                >
                  <PekuloSelect.Trigger id="tx-edit-category">
                    <PekuloSelect.Value placeholder={t("fields.category")} />
                  </PekuloSelect.Trigger>
                  <PekuloSelect.Content>
                    <PekuloSelect.Group>
                      {TRANSACTION_CATEGORIES.map((c, i) => (
                        <PekuloSelect.Item
                          key={c}
                          value={c}
                          index={i}
                          icon={<CategoryIcon category={c} size={16} />}
                        >
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
                <PekuloFieldLabel htmlFor="tx-edit-notes">
                  {t("fields.notesOptional")}
                </PekuloFieldLabel>
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
          <PekuloSubmitButton loading={isPending} loadingLabel={t("saving")}>
            {t("save")}
          </PekuloSubmitButton>
        </PekuloFieldGroup>
      </View>
    </form>
  );
}
