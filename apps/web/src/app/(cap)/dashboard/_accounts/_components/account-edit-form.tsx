"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  PekuloField,
  PekuloFieldDescription,
  PekuloFieldError,
  PekuloFieldGroup,
  PekuloFieldLabel,
  PekuloInput,
  PekuloSelect,
  PekuloSubmitButton,
} from "@pekulo/ui";
import { View } from "@pekulo/ui/client";
import {
  ACCOUNT_CURRENCIES,
  MAX_ACCOUNT_LABEL_LENGTH,
  MAX_ACCOUNT_NOTES_LENGTH,
  type Account,
  type UpdateAccountInput,
} from "@pekulo/validators";
import { ACCOUNT_TYPES, type AccountType } from "@pekulo/types";
import { useAppForm } from "@/hooks/form-hook";
import { useUpdateAccount } from "../_hooks/use-update-account";

export interface AccountEditFormProps {
  account: Account;
  onSuccess?: () => void;
}

export function AccountEditForm({ account, onSuccess }: AccountEditFormProps) {
  const t = useTranslations("accounts");
  const TYPE_LABEL: Record<AccountType, string> = {
    livret: t("types.livret"),
    pea: t("types.pea"),
    cto: t("types.cto"),
    av: t("types.av"),
    autre: t("types.autre"),
    banque: t("types.banque"),
  };
  // Devise stays locked to the account's existing currency until FX ships
  // in story 3-3 (Story 2-3 review HIGH #6). The legacy multi-currency
  // selector let users switch USD→EUR while the Patrimoine total still
  // summed raw cashBalance under a "€" glyph.
  const currency = account.currency;
  void ACCOUNT_CURRENCIES;
  const [envelopeError, setEnvelopeError] = useState<string | null>(null);
  const { mutate, isPending, error, isSuccess, reset, data } = useUpdateAccount();
  const envelopeRejected = data?.ok === false ? data : null;

  const form = useAppForm({
    defaultValues: {
      label: account.label,
      type: account.type,
      cashBalance: String(account.cashBalance),
      notes: account.notes ?? "",
    },
    validators: {
      onSubmit: ({ value }) => {
        const trimmed = value.label.trim();
        if (trimmed.length === 0) {
          return t("labelRequired");
        }
        const balance = Number(value.cashBalance);
        if (!Number.isFinite(balance) || balance < 0) {
          return t("balanceInvalid");
        }
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      const trimmed = value.label.trim();
      const balance = Number(value.cashBalance);
      // updateAccountInputSchema.refine demands at least one of
      // label/type/currency/cashBalance/notes — diff payload below.
      const patch: UpdateAccountInput = { id: account.id } as UpdateAccountInput;
      if (trimmed !== account.label) patch.label = trimmed;
      if (value.type !== account.type) patch.type = value.type;
      if (currency !== account.currency) patch.currency = currency;
      if (balance !== account.cashBalance) patch.cashBalance = balance;
      const trimmedNotes = value.notes.trim();
      const nextNotes = trimmedNotes.length > 0 ? trimmedNotes : null;
      if (nextNotes !== account.notes) patch.notes = nextNotes;

      const hasChange =
        patch.label !== undefined ||
        patch.type !== undefined ||
        patch.currency !== undefined ||
        patch.cashBalance !== undefined ||
        patch.notes !== undefined;
      if (!hasChange) {
        onSuccess?.();
        return;
      }

      setEnvelopeError(null);
      mutate(patch, {
        onSuccess: (result) => {
          if (!result.ok) {
            setEnvelopeError(result.code === "ACCOUNT_NOT_FOUND" ? t("notFound") : result.message);
            return;
          }
          reset();
          onSuccess?.();
        },
      });
    },
  });

  // Re-seed form when the account prop reference changes (id/version refresh).
  useEffect(() => {
    form.reset({
      label: account.label,
      type: account.type,
      cashBalance: String(account.cashBalance),
      notes: account.notes ?? "",
    });
    setEnvelopeError(null);
  }, [account.id, account.label, account.type, account.cashBalance, account.notes, form]);

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
          <form.Field name="label">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="acc-edit-label">{t("fields.label")}</PekuloFieldLabel>
                <PekuloInput
                  id="acc-edit-label"
                  type="text"
                  maxLength={MAX_ACCOUNT_LABEL_LENGTH}
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
                <PekuloFieldLabel htmlFor="acc-edit-type">{t("fields.type")}</PekuloFieldLabel>
                <PekuloSelect
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as AccountType)}
                >
                  <PekuloSelect.Trigger id="acc-edit-type">
                    <PekuloSelect.Value placeholder={t("chooseType")} />
                  </PekuloSelect.Trigger>
                  <PekuloSelect.Content>
                    <PekuloSelect.Group>
                      {ACCOUNT_TYPES.map((at, i) => (
                        <PekuloSelect.Item key={at} value={at} index={i}>
                          {TYPE_LABEL[at]}
                        </PekuloSelect.Item>
                      ))}
                    </PekuloSelect.Group>
                  </PekuloSelect.Content>
                </PekuloSelect>
              </PekuloField>
            )}
          </form.Field>
          <PekuloField>
            <PekuloFieldLabel htmlFor="acc-edit-currency">{t("fields.currency")}</PekuloFieldLabel>
            <PekuloInput
              id="acc-edit-currency"
              type="text"
              value={currency}
              readOnly
              aria-readonly="true"
              style={{ opacity: 0.6, cursor: "not-allowed" }}
            />
            <PekuloFieldDescription>{t("currencyNote")}</PekuloFieldDescription>
          </PekuloField>
          <form.Field name="cashBalance">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="acc-edit-balance">
                  {t("fields.balance")}
                </PekuloFieldLabel>
                <PekuloInput
                  id="acc-edit-balance"
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
          <form.Field name="notes">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="acc-edit-notes">{t("fields.notes")}</PekuloFieldLabel>
                <PekuloInput
                  id="acc-edit-notes"
                  type="text"
                  maxLength={MAX_ACCOUNT_NOTES_LENGTH}
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
          {envelopeError && (
            <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
              {(clientError) =>
                clientError ? null : <PekuloFieldError>{envelopeError}</PekuloFieldError>
              }
            </form.Subscribe>
          )}
          {error && !envelopeError && (
            <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
              {(clientError) =>
                clientError ? null : <PekuloFieldError>{error.message}</PekuloFieldError>
              }
            </form.Subscribe>
          )}
          {isSuccess && !envelopeRejected && !error && (
            <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
              {(clientError) =>
                clientError ? null : (
                  <PekuloFieldDescription color="$success">{t("updated")}</PekuloFieldDescription>
                )
              }
            </form.Subscribe>
          )}
          <PekuloSubmitButton loading={isPending} loadingLabel={t("saving")}>
            {t("save")}
          </PekuloSubmitButton>
        </PekuloFieldGroup>
      </View>
    </form>
  );
}
