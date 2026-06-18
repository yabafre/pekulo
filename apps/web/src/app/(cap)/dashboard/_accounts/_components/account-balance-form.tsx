"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  PekuloDatePicker,
  PekuloField,
  PekuloFieldDescription,
  PekuloFieldError,
  PekuloFieldGroup,
  PekuloFieldLabel,
  PekuloInput,
  PekuloSubmitButton,
} from "@pekulo/ui";
import { View } from "@pekulo/ui/client";
import type { Account } from "@pekulo/validators";
import { useAppForm } from "@/hooks/form-hook";
import { useRecordBalanceChange } from "../_hooks/use-record-balance-change";

// Returns today's UTC midnight as a Date — matches the API's z.coerce.date.
function utcMidnightToday(): Date {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = d.getUTCMonth();
  const dd = d.getUTCDate();
  return new Date(Date.UTC(yyyy, mm, dd));
}

export interface AccountBalanceFormProps {
  account: Account;
  onSuccess?: () => void;
}

export function AccountBalanceForm({ account, onSuccess }: AccountBalanceFormProps) {
  const t = useTranslations("accounts");
  const [envelopeError, setEnvelopeError] = useState<string | null>(null);
  const { mutate, isPending, error, isSuccess, reset, data } = useRecordBalanceChange();
  const envelopeRejected = data?.ok === false ? data : null;

  const form = useAppForm({
    defaultValues: {
      valuedOn: utcMidnightToday(),
      cashBalance: String(account.cashBalance),
    },
    validators: {
      onSubmit: ({ value }) => {
        if (!value.valuedOn || Number.isNaN(value.valuedOn.getTime())) {
          return t("dateRequired");
        }
        const balance = Number(value.cashBalance);
        if (!Number.isFinite(balance) || balance < 0) {
          return t("balanceInvalid");
        }
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      const balance = Number(value.cashBalance);
      setEnvelopeError(null);
      mutate(
        { id: account.id, valuedOn: value.valuedOn, cashBalance: balance },
        {
          onSuccess: (result) => {
            if (!result.ok) {
              setEnvelopeError(t("notFound"));
              return;
            }
            reset();
            onSuccess?.();
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
      aria-label={t("balanceFormAria", { label: account.label })}
    >
      <View padding="$4">
        <PekuloFieldGroup>
          <form.Field name="valuedOn">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="acc-bal-date">{t("fields.date")}</PekuloFieldLabel>
                <PekuloDatePicker
                  id="acc-bal-date"
                  value={field.state.value}
                  onChange={(d) => d && field.handleChange(d)}
                />
              </PekuloField>
            )}
          </form.Field>
          <form.Field name="cashBalance">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="acc-bal-amount">
                  {t("fields.newBalance")}
                </PekuloFieldLabel>
                <PekuloInput
                  id="acc-bal-amount"
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
                  <PekuloFieldDescription color="$success">
                    {t("balanceSaved")}
                  </PekuloFieldDescription>
                )
              }
            </form.Subscribe>
          )}
          <PekuloSubmitButton loading={isPending} loadingLabel={t("saving")}>
            {t("saveBalance")}
          </PekuloSubmitButton>
        </PekuloFieldGroup>
      </View>
    </form>
  );
}
