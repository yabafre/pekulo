"use client";

import { useState, type CSSProperties } from "react";
import { Text, View } from "@pekulo/ui/client";
import {
  ACCOUNT_CURRENCIES,
  MAX_ACCOUNT_LABEL_LENGTH,
  MAX_ACCOUNT_NOTES_LENGTH,
  type Account,
  type UpdateAccountInput,
} from "@pekulo/validators";
import { ACCOUNT_TYPES, type AccountType } from "@pekulo/types";
import { useUpdateAccount } from "../_hooks/use-update-account";
import {
  FormField as Field,
  formInputStyle as inputStyle,
  formSubmitStyle as submitStyle,
} from "../../../_components/form-primitives";
import submitPill from "../../../_components/submit-pill.module.css";

const TYPE_LABEL: Record<AccountType, string> = {
  livret: "Livret",
  pea: "PEA",
  cto: "CTO",
  av: "Assurance vie",
  autre: "Autre",
};

const selectStyle: CSSProperties = { ...inputStyle, appearance: "none" };

export interface AccountEditFormProps {
  account: Account;
  onSuccess?: () => void;
}

export function AccountEditForm({ account, onSuccess }: AccountEditFormProps) {
  const [label, setLabel] = useState(account.label);
  const [type, setType] = useState<AccountType>(account.type);
  // Devise stays locked to the account's existing currency until FX ships
  // in story 3-3 (Story 2-3 review HIGH #6). The legacy multi-currency
  // selector let users switch USD→EUR while the Patrimoine total still
  // summed raw cashBalance under a "€" glyph.
  const currency = account.currency;
  const [cashBalance, setCashBalance] = useState(String(account.cashBalance));
  const [notes, setNotes] = useState(account.notes ?? "");
  void ACCOUNT_CURRENCIES;
  const [clientError, setClientError] = useState<string | null>(null);
  const [envelopeError, setEnvelopeError] = useState<string | null>(null);
  const { mutate, isPending, error, isSuccess, reset, data } = useUpdateAccount();
  const envelopeRejected = data?.ok === false ? data : null;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);
    const trimmed = label.trim();
    if (trimmed.length === 0) {
      setClientError("Libellé requis");
      return;
    }
    const balance = Number(cashBalance);
    if (!Number.isFinite(balance) || balance < 0) {
      setClientError("Solde invalide (>= 0)");
      return;
    }
    // updateAccountInputSchema.refine demands at least one of
    // label/type/currency/cashBalance/notes — diff payload below.
    const patch: UpdateAccountInput = { id: account.id } as UpdateAccountInput;
    if (trimmed !== account.label) patch.label = trimmed;
    if (type !== account.type) patch.type = type;
    if (currency !== account.currency) patch.currency = currency;
    if (balance !== account.cashBalance) patch.cashBalance = balance;
    const trimmedNotes = notes.trim();
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
          setEnvelopeError(
            result.code === "ACCOUNT_NOT_FOUND"
              ? "Compte introuvable — il a peut-être été supprimé."
              : result.message,
          );
          return;
        }
        reset();
        onSuccess?.();
      },
    });
  };

  return (
    <form onSubmit={onSubmit} aria-label="Modifier le compte">
      <View flexDirection="column" gap="$3" padding="$4">
        <Field>
          <Text render="label" htmlFor="acc-edit-label" color="$colorSecondary" fontSize="$caption">
            Libellé
          </Text>
          <input
            id="acc-edit-label"
            type="text"
            maxLength={MAX_ACCOUNT_LABEL_LENGTH}
            value={label}
            onChange={(e) => setLabel(e.currentTarget.value)}
            required
            style={inputStyle}
          />
        </Field>
        <Field>
          <Text render="label" htmlFor="acc-edit-type" color="$colorSecondary" fontSize="$caption">
            Type
          </Text>
          <select
            id="acc-edit-type"
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
          <Text
            render="label"
            htmlFor="acc-edit-currency"
            color="$colorSecondary"
            fontSize="$caption"
          >
            Devise
          </Text>
          <input
            id="acc-edit-currency"
            type="text"
            value={currency}
            readOnly
            aria-readonly="true"
            style={{ ...inputStyle, opacity: 0.6, cursor: "not-allowed" }}
          />
          <Text color="$colorTertiary" fontSize="$caption">
            Multi-devises arrive avec les portefeuilles (story 3-3).
          </Text>
        </Field>
        <Field>
          <Text
            render="label"
            htmlFor="acc-edit-balance"
            color="$colorSecondary"
            fontSize="$caption"
          >
            Solde
          </Text>
          <input
            id="acc-edit-balance"
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
          <Text render="label" htmlFor="acc-edit-notes" color="$colorSecondary" fontSize="$caption">
            Notes
          </Text>
          <input
            id="acc-edit-notes"
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
        {envelopeError && !clientError && (
          <Text role="alert" color="$danger" fontSize="$caption">
            {envelopeError}
          </Text>
        )}
        {error && !clientError && !envelopeError && (
          <Text role="alert" color="$danger" fontSize="$caption">
            {error.message}
          </Text>
        )}
        {isSuccess && !envelopeRejected && !clientError && !error && (
          <Text role="status" color="$success" fontSize="$caption">
            Compte mis à jour.
          </Text>
        )}
        <button
          type="submit"
          disabled={isPending}
          aria-disabled={isPending}
          className={submitPill.pill}
          style={submitStyle(isPending)}
        >
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </View>
    </form>
  );
}
