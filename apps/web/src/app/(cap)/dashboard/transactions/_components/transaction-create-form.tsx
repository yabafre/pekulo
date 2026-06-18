"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  CategoryIcon,
  PekuloDatePicker,
  PekuloField,
  PekuloFieldDescription,
  PekuloFieldError,
  PekuloFieldGroup,
  PekuloFieldLabel,
  PekuloInput,
  PekuloSelect,
  PekuloSubmitButton,
  PekuloSwitch,
} from "@pekulo/ui";
import { View } from "@pekulo/ui/client";
import {
  TRANSACTION_CATEGORIES,
  TRANSACTION_CATEGORY_LABELS,
  type TransactionCategory,
  type TransactionType,
} from "@pekulo/validators";
import { useAppForm } from "@/hooks/form-hook";
import { useAccounts } from "../../_accounts/_hooks/use-accounts";
import { useCreateTransaction } from "../_hooks/use-create-transaction";

export interface TransactionCreateFormProps {
  onSuccess?: () => void;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export function TransactionCreateForm({ onSuccess }: TransactionCreateFormProps) {
  const t = useTranslations("transactions");
  const TYPE_LABEL: Record<TransactionType, string> = {
    inflow: t("types.inflow"),
    outflow: t("types.outflow"),
  };
  const { data: accounts } = useAccounts();
  const { mutate, isPending, reset } = useCreateTransaction();
  const [envelopeError, setEnvelopeError] = useState<string | null>(null);
  const firstAccountId = accounts && accounts.length > 0 ? accounts[0]!.id : "";

  const form = useAppForm({
    defaultValues: {
      accountId: firstAccountId,
      occurredOn: todayIso(),
      label: "",
      amount: "0",
      type: "outflow" as TransactionType,
      category: "courses" as TransactionCategory,
      isImprevu: false,
      notes: "",
    },
    validators: {
      onSubmit: ({ value }) => {
        if (!value.accountId) return t("errors.accountRequired");
        if (!/^acc_[0-9A-Za-z]{21}$/.test(value.accountId)) return t("errors.accountInvalid");
        const trimmed = value.label.trim();
        if (trimmed.length === 0) return t("errors.labelRequired");
        if (trimmed.length > 120) return t("errors.labelTooLong");
        const amt = Number(value.amount);
        if (!Number.isFinite(amt) || amt < 0) return t("errors.amountInvalid");
        const notes = value.notes.trim();
        if (notes.length > 500) return t("errors.notesTooLong");
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      setEnvelopeError(null);
      const trimmedLabel = value.label.trim();
      const trimmedNotes = value.notes.trim();
      mutate(
        {
          accountId: value.accountId,
          occurredOn: value.occurredOn,
          label: trimmedLabel,
          amount: Number(value.amount),
          type: value.type,
          category: value.category,
          isImprevu: value.isImprevu,
          notes: trimmedNotes.length > 0 ? trimmedNotes : null,
        },
        {
          onSuccess: (result) => {
            if (result.ok) {
              form.reset();
              reset();
              onSuccess?.();
            } else {
              setEnvelopeError(result.message);
            }
          },
        },
      );
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      aria-label={t("createFormAria")}
    >
      <View padding="$4">
        <PekuloFieldGroup>
          <form.Field name="accountId">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="tx-account">{t("fields.account")}</PekuloFieldLabel>
                <PekuloSelect
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v)}
                >
                  <PekuloSelect.Trigger id="tx-account">
                    <PekuloSelect.Value placeholder={t("chooseAccount")} />
                  </PekuloSelect.Trigger>
                  <PekuloSelect.Content>
                    <PekuloSelect.Group>
                      {(accounts ?? []).map((a, i) => (
                        <PekuloSelect.Item key={a.id} value={a.id} index={i}>
                          {a.label}
                        </PekuloSelect.Item>
                      ))}
                    </PekuloSelect.Group>
                  </PekuloSelect.Content>
                </PekuloSelect>
                {(accounts ?? []).length === 0 && (
                  <PekuloFieldDescription>{t("noAccountHint")}</PekuloFieldDescription>
                )}
              </PekuloField>
            )}
          </form.Field>
          <form.Field name="occurredOn">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="tx-date">{t("fields.date")}</PekuloFieldLabel>
                <PekuloDatePicker
                  id="tx-date"
                  value={field.state.value ? new Date(field.state.value) : undefined}
                  onChange={(d) => field.handleChange(d ? d.toISOString().slice(0, 10) : "")}
                />
              </PekuloField>
            )}
          </form.Field>
          <form.Field name="label">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="tx-label">{t("fields.label")}</PekuloFieldLabel>
                <PekuloInput
                  id="tx-label"
                  type="text"
                  maxLength={120}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.currentTarget.value)}
                  required
                />
              </PekuloField>
            )}
          </form.Field>
          <form.Field name="amount">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="tx-amount">{t("fields.amount")}</PekuloFieldLabel>
                <PekuloInput
                  id="tx-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.currentTarget.value)}
                  required
                />
              </PekuloField>
            )}
          </form.Field>
          <form.Field name="type">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="tx-type">{t("fields.type")}</PekuloFieldLabel>
                <PekuloSelect
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as TransactionType)}
                >
                  <PekuloSelect.Trigger id="tx-type">
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
                <PekuloFieldLabel htmlFor="tx-category">{t("fields.category")}</PekuloFieldLabel>
                <PekuloSelect
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as TransactionCategory)}
                >
                  <PekuloSelect.Trigger id="tx-category">
                    <PekuloSelect.Value placeholder={t("chooseCategory")} />
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
          <form.Field name="isImprevu">
            {(field) => (
              <PekuloField>
                <View flexDirection="row" alignItems="center" gap="$3">
                  <PekuloSwitch
                    id="tx-imprevu"
                    checked={field.state.value}
                    onCheckedChange={(v: boolean) => field.handleChange(v)}
                  />
                  <PekuloFieldLabel htmlFor="tx-imprevu">{t("fields.imprevu")}</PekuloFieldLabel>
                </View>
              </PekuloField>
            )}
          </form.Field>
          <form.Field name="notes">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="tx-notes">{t("fields.notesOptional")}</PekuloFieldLabel>
                <PekuloInput
                  id="tx-notes"
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
          <PekuloSubmitButton loading={isPending} loadingLabel={t("adding")}>
            {t("addTransaction")}
          </PekuloSubmitButton>
        </PekuloFieldGroup>
      </View>
    </form>
  );
}
