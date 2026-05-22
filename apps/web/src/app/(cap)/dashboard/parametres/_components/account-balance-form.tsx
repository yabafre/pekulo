"use client";

import { useState } from "react";
import {
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

function isoToday(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export interface AccountBalanceFormProps {
  account: Account;
  onSuccess?: () => void;
}

export function AccountBalanceForm({ account, onSuccess }: AccountBalanceFormProps) {
  const [envelopeError, setEnvelopeError] = useState<string | null>(null);
  const { mutate, isPending, error, isSuccess, reset, data } = useRecordBalanceChange();
  const envelopeRejected = data?.ok === false ? data : null;

  const form = useAppForm({
    defaultValues: {
      valuedOn: isoToday(),
      cashBalance: String(account.cashBalance),
    },
    validators: {
      onSubmit: ({ value }) => {
        if (!value.valuedOn || value.valuedOn.length === 0) {
          return "Date requise";
        }
        const balance = Number(value.cashBalance);
        if (!Number.isFinite(balance) || balance < 0) {
          return "Solde invalide (>= 0)";
        }
        // ISO date string → UTC midnight; matches the API's z.coerce.date.
        const valued = new Date(`${value.valuedOn}T00:00:00.000Z`);
        if (Number.isNaN(valued.getTime())) {
          return "Date invalide";
        }
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      const balance = Number(value.cashBalance);
      // ISO date string → UTC midnight; matches the API's z.coerce.date.
      const valued = new Date(`${value.valuedOn}T00:00:00.000Z`);
      setEnvelopeError(null);
      mutate(
        { id: account.id, valuedOn: valued, cashBalance: balance },
        {
          onSuccess: (result) => {
            if (!result.ok) {
              setEnvelopeError("Compte introuvable — il a peut-être été supprimé.");
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
      aria-label={`Modifier le solde de ${account.label}`}
    >
      <View padding="$4">
        <PekuloFieldGroup>
          <form.Field name="valuedOn">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="acc-bal-date">Date</PekuloFieldLabel>
                <PekuloInput
                  id="acc-bal-date"
                  type="date"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.currentTarget.value)}
                  required
                />
              </PekuloField>
            )}
          </form.Field>
          <form.Field name="cashBalance">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="acc-bal-amount">Nouveau solde</PekuloFieldLabel>
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
                    Solde enregistré.
                  </PekuloFieldDescription>
                )
              }
            </form.Subscribe>
          )}
          <PekuloSubmitButton loading={isPending} loadingLabel="Enregistrement…">
            Enregistrer le solde
          </PekuloSubmitButton>
        </PekuloFieldGroup>
      </View>
    </form>
  );
}
