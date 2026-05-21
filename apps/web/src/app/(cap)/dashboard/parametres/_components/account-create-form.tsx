"use client";

import { type CSSProperties } from "react";
import { Text, View } from "@pekulo/ui/client";
import {
  ACCOUNT_CURRENCIES,
  MAX_ACCOUNT_LABEL_LENGTH,
  MAX_ACCOUNT_NOTES_LENGTH,
} from "@pekulo/validators";
import { ACCOUNT_TYPES, type AccountType } from "@pekulo/types";
import { useAppForm } from "@/hooks/form-hook";
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
import submitPill from "../../../_components/submit-pill.module.css";

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
  const { mutate, isPending, error, isSuccess, reset } = useCreateAccount();

  const form = useAppForm({
    defaultValues: {
      label: "",
      type: "livret" as AccountType,
      cashBalance: "0",
      notes: "",
    },
    validators: {
      onSubmit: ({ value }) => {
        const trimmed = value.label.trim();
        if (trimmed.length === 0) {
          return "Libellé requis";
        }
        if (trimmed.length > MAX_ACCOUNT_LABEL_LENGTH) {
          return `Libellé > ${MAX_ACCOUNT_LABEL_LENGTH} caractères`;
        }
        const balance = Number(value.cashBalance);
        if (!Number.isFinite(balance) || balance < 0) {
          return "Solde invalide (>= 0)";
        }
        const trimmedNotes = value.notes.trim();
        if (trimmedNotes.length > MAX_ACCOUNT_NOTES_LENGTH) {
          return `Notes > ${MAX_ACCOUNT_NOTES_LENGTH} caractères`;
        }
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      const trimmed = value.label.trim();
      const balance = Number(value.cashBalance);
      const trimmedNotes = value.notes.trim();
      mutate(
        {
          label: trimmed,
          type: value.type,
          currency: FORCED_CURRENCY,
          cashBalance: balance,
          notes: trimmedNotes.length > 0 ? trimmedNotes : null,
        },
        {
          onSuccess: () => {
            form.reset();
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
      aria-label="Ajouter un compte"
    >
      <View flexDirection="column" gap="$3" padding="$4">
        <form.Field name="label">
          {(field) => (
            <Field>
              <Text render="label" htmlFor="acc-label" color="$colorSecondary" fontSize="$caption">
                Libellé
              </Text>
              <input
                id="acc-label"
                type="text"
                maxLength={MAX_ACCOUNT_LABEL_LENGTH}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.value)}
                required
                style={inputStyle}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="type">
          {(field) => (
            <Field>
              <Text render="label" htmlFor="acc-type" color="$colorSecondary" fontSize="$caption">
                Type
              </Text>
              <select
                id="acc-type"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.value as AccountType)}
                style={selectStyle}
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </form.Field>
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
        <form.Field name="cashBalance">
          {(field) => (
            <Field>
              <Text
                render="label"
                htmlFor="acc-balance"
                color="$colorSecondary"
                fontSize="$caption"
              >
                Solde initial
              </Text>
              <input
                id="acc-balance"
                type="number"
                min={0}
                step="0.01"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.value)}
                required
                style={inputStyle}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="notes">
          {(field) => (
            <Field>
              <Text render="label" htmlFor="acc-notes" color="$colorSecondary" fontSize="$caption">
                Notes (optionnel)
              </Text>
              <input
                id="acc-notes"
                type="text"
                maxLength={MAX_ACCOUNT_NOTES_LENGTH}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.value)}
                style={inputStyle}
              />
            </Field>
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
          {(clientError) =>
            clientError ? (
              <Text role="alert" color="$danger" fontSize="$caption">
                {String(clientError)}
              </Text>
            ) : null
          }
        </form.Subscribe>
        {error && (
          <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
            {(clientError) =>
              clientError ? null : (
                <Text role="alert" color="$danger" fontSize="$caption">
                  {error.message}
                </Text>
              )
            }
          </form.Subscribe>
        )}
        {isSuccess && !error && (
          <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
            {(clientError) =>
              clientError ? null : (
                <Text role="status" color="$success" fontSize="$caption">
                  Compte ajouté.
                </Text>
              )
            }
          </form.Subscribe>
        )}
        <button
          type="submit"
          disabled={isPending}
          aria-disabled={isPending}
          className={submitPill.pill}
          style={submitStyle(isPending)}
        >
          {isPending ? "Ajout…" : "Ajouter le compte"}
        </button>
      </View>
    </form>
  );
}
