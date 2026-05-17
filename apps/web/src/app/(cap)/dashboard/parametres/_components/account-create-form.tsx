"use client";

import { useState, type CSSProperties } from "react";
import { Text, View } from "@pekulo/ui/client";
import {
  ACCOUNT_CURRENCIES,
  MAX_ACCOUNT_LABEL_LENGTH,
  MAX_ACCOUNT_NOTES_LENGTH,
} from "@pekulo/validators";
import { ACCOUNT_TYPES, type AccountType } from "@pekulo/types";
import { useCreateAccount } from "../_hooks/use-create-account";
// Devise lives behind the FX work in story 3-3; until that ships, every new
// account is created in EUR. The Patrimoine total sums raw `cashBalance`
// values and formats them as EUR — exposing the multi-currency selector
// would let the user enter a USD balance that then displays under a "€"
// glyph. Lock to EUR for the V1 perso window. (Story 2-3 review HIGH #6.)
const FORCED_CURRENCY: (typeof ACCOUNT_CURRENCIES)[number] = "EUR";
void ACCOUNT_CURRENCIES;
import {
  FormField as Field,
  formInputStyle as inputStyle,
  formSubmitStyle as submitStyle,
} from "../../../_components/form-primitives";

const TYPE_LABEL: Record<AccountType, string> = {
  livret: "Livret",
  pea: "PEA",
  cto: "CTO",
  av: "Assurance vie",
  autre: "Autre",
};

const selectStyle: CSSProperties = {
  ...inputStyle,
  appearance: "none",
};

export interface AccountCreateFormProps {
  onSuccess?: () => void;
}

export function AccountCreateForm({ onSuccess }: AccountCreateFormProps) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<AccountType>("livret");
  const [cashBalance, setCashBalance] = useState("0");
  const [notes, setNotes] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const { mutate, isPending, error, isSuccess, reset } = useCreateAccount();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);
    const trimmed = label.trim();
    if (trimmed.length === 0) {
      setClientError("Libellé requis");
      return;
    }
    if (trimmed.length > MAX_ACCOUNT_LABEL_LENGTH) {
      setClientError(`Libellé > ${MAX_ACCOUNT_LABEL_LENGTH} caractères`);
      return;
    }
    const balance = Number(cashBalance);
    if (!Number.isFinite(balance) || balance < 0) {
      setClientError("Solde invalide (>= 0)");
      return;
    }
    const trimmedNotes = notes.trim();
    if (trimmedNotes.length > MAX_ACCOUNT_NOTES_LENGTH) {
      setClientError(`Notes > ${MAX_ACCOUNT_NOTES_LENGTH} caractères`);
      return;
    }
    mutate(
      {
        label: trimmed,
        type,
        currency: FORCED_CURRENCY,
        cashBalance: balance,
        notes: trimmedNotes.length > 0 ? trimmedNotes : null,
      },
      {
        onSuccess: () => {
          setLabel("");
          setType("livret");
          setCashBalance("0");
          setNotes("");
          reset();
          onSuccess?.();
        },
      },
    );
  };

  return (
    <form onSubmit={onSubmit} aria-label="Ajouter un compte">
      <View flexDirection="column" gap="$3" padding="$4">
        <Field>
          <Text render="label" htmlFor="acc-label" color="$colorSecondary" fontSize="$caption">
            Libellé
          </Text>
          <input
            id="acc-label"
            type="text"
            maxLength={MAX_ACCOUNT_LABEL_LENGTH}
            value={label}
            onChange={(e) => setLabel(e.currentTarget.value)}
            required
            style={inputStyle}
          />
        </Field>
        <Field>
          <Text render="label" htmlFor="acc-type" color="$colorSecondary" fontSize="$caption">
            Type
          </Text>
          <select
            id="acc-type"
            value={type}
            onChange={(e) => setType(e.currentTarget.value as AccountType)}
            style={selectStyle}
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <Text render="label" htmlFor="acc-currency" color="$colorSecondary" fontSize="$caption">
            Devise
          </Text>
          <input
            id="acc-currency"
            type="text"
            value={FORCED_CURRENCY}
            readOnly
            aria-readonly="true"
            style={{ ...inputStyle, opacity: 0.6, cursor: "not-allowed" }}
          />
          <Text color="$colorTertiary" fontSize="$caption">
            Multi-devises arrive avec les portefeuilles (story 3-3).
          </Text>
        </Field>
        <Field>
          <Text render="label" htmlFor="acc-balance" color="$colorSecondary" fontSize="$caption">
            Solde initial
          </Text>
          <input
            id="acc-balance"
            type="number"
            min={0}
            step="0.01"
            value={cashBalance}
            onChange={(e) => setCashBalance(e.currentTarget.value)}
            required
            style={inputStyle}
          />
        </Field>
        <Field>
          <Text render="label" htmlFor="acc-notes" color="$colorSecondary" fontSize="$caption">
            Notes (optionnel)
          </Text>
          <input
            id="acc-notes"
            type="text"
            maxLength={MAX_ACCOUNT_NOTES_LENGTH}
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
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
            Compte ajouté.
          </Text>
        )}
        <button
          type="submit"
          disabled={isPending}
          aria-disabled={isPending}
          style={submitStyle(isPending)}
        >
          {isPending ? "Ajout…" : "Ajouter le compte"}
        </button>
      </View>
    </form>
  );
}
