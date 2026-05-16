"use client";

import { useState } from "react";
import { Text, View } from "@pekulo/ui/client";
import type { Account } from "@pekulo/validators";
import { useRecordBalanceChange } from "../_hooks/use-record-balance-change";
import {
  FormField as Field,
  formInputStyle as inputStyle,
  formSubmitStyle as submitStyle,
} from "../../../_components/form-primitives";

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
  const [valuedOn, setValuedOn] = useState(isoToday());
  const [cashBalance, setCashBalance] = useState(String(account.cashBalance));
  const [clientError, setClientError] = useState<string | null>(null);
  const { mutate, isPending, error, isSuccess, reset } = useRecordBalanceChange();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);
    if (!valuedOn || valuedOn.length === 0) {
      setClientError("Date requise");
      return;
    }
    const balance = Number(cashBalance);
    if (!Number.isFinite(balance) || balance < 0) {
      setClientError("Solde invalide (>= 0)");
      return;
    }
    // ISO date string → UTC midnight; matches the API's z.coerce.date.
    const valued = new Date(`${valuedOn}T00:00:00.000Z`);
    if (Number.isNaN(valued.getTime())) {
      setClientError("Date invalide");
      return;
    }
    mutate(
      { id: account.id, valuedOn: valued, cashBalance: balance },
      {
        onSuccess: () => {
          reset();
          onSuccess?.();
        },
      },
    );
  };

  return (
    <form onSubmit={onSubmit} aria-label={`Modifier le solde de ${account.label}`}>
      <View flexDirection="column" gap="$3" padding="$4">
        <Field>
          <Text render="label" htmlFor="acc-bal-date" color="$colorSecondary" fontSize="$caption">
            Date
          </Text>
          <input
            id="acc-bal-date"
            type="date"
            value={valuedOn}
            onChange={(e) => setValuedOn(e.currentTarget.value)}
            required
            style={inputStyle}
          />
        </Field>
        <Field>
          <Text render="label" htmlFor="acc-bal-amount" color="$colorSecondary" fontSize="$caption">
            Nouveau solde
          </Text>
          <input
            id="acc-bal-amount"
            type="number"
            min={0}
            step="0.01"
            value={cashBalance}
            onChange={(e) => setCashBalance(e.currentTarget.value)}
            required
            style={inputStyle}
          />
        </Field>
        {clientError && (
          <Text role="alert" color="$danger" fontSize="$caption">
            {clientError}
          </Text>
        )}
        {error && !clientError && (
          <Text role="alert" color="$danger" fontSize="$caption">
            {error.message}
          </Text>
        )}
        {isSuccess && !clientError && !error && (
          <Text role="status" color="$success" fontSize="$caption">
            Solde enregistré.
          </Text>
        )}
        <button
          type="submit"
          disabled={isPending}
          aria-disabled={isPending}
          style={submitStyle(isPending)}
        >
          {isPending ? "Enregistrement…" : "Enregistrer le solde"}
        </button>
      </View>
    </form>
  );
}
