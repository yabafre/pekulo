"use client";

import { useState, type CSSProperties } from "react";
import { Text, View } from "@pekulo/ui/client";
import {
  HOLDING_CURRENCIES,
  MAX_HOLDING_LABEL_LENGTH,
  MAX_HOLDING_TICKER_LENGTH,
  MAX_HOLDING_NOTES_LENGTH,
  type Account,
  type HoldingCurrency,
} from "@pekulo/validators";
import { HOLDING_KINDS, type HoldingKind } from "@pekulo/types";
import { useAppForm } from "@/hooks/form-hook";
import { useCreateHolding } from "../_hooks/use-create-holding";
import {
  FormField as Field,
  formInputStyle as inputStyle,
  formSubmitStyle as submitStyle,
} from "../../../_components/form-primitives";
import submitPill from "../../../_components/submit-pill.module.css";

const KIND_LABEL: Record<HoldingKind, string> = {
  etf: "ETF",
  action: "Action",
  crypto: "Crypto",
  autre: "Autre",
};

const selectStyle: CSSProperties = {
  ...inputStyle,
  appearance: "none",
};

const ACCOUNT_NOT_FOUND_MSG = "Compte introuvable. Recharge la page.";

export interface HoldingCreateFormProps {
  accounts: Account[];
  onSuccess?: () => void;
}

export function HoldingCreateForm({ accounts, onSuccess }: HoldingCreateFormProps) {
  const [envelopeError, setEnvelopeError] = useState<string | null>(null);
  const { mutate, isPending, error, isSuccess, reset } = useCreateHolding();

  const form = useAppForm({
    defaultValues: {
      accountId: accounts[0]?.id ?? "",
      kind: "etf" as HoldingKind,
      ticker: "",
      label: "",
      currency: "EUR" as HoldingCurrency,
      quantity: "0",
      avgCost: "0",
      notes: "",
    },
    validators: {
      onSubmit: ({ value }) => {
        const trimmedLabel = value.label.trim();
        if (trimmedLabel.length === 0) {
          return "Libellé requis";
        }
        if (trimmedLabel.length > MAX_HOLDING_LABEL_LENGTH) {
          return `Libellé > ${MAX_HOLDING_LABEL_LENGTH} caractères`;
        }
        const trimmedTicker = value.ticker.trim();
        if (trimmedTicker.length > MAX_HOLDING_TICKER_LENGTH) {
          return `Ticker > ${MAX_HOLDING_TICKER_LENGTH} caractères`;
        }
        const trimmedNotes = value.notes.trim();
        if (trimmedNotes.length > MAX_HOLDING_NOTES_LENGTH) {
          return `Notes > ${MAX_HOLDING_NOTES_LENGTH} caractères`;
        }
        const qNum = Number(value.quantity);
        if (!Number.isFinite(qNum) || qNum < 0) {
          return "Quantité invalide (>= 0)";
        }
        const aNum = Number(value.avgCost);
        if (!Number.isFinite(aNum) || aNum < 0) {
          return "Prix moyen invalide (>= 0)";
        }
        if (value.accountId.length === 0) {
          return "Compte requis";
        }
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      const trimmedLabel = value.label.trim();
      const trimmedTicker = value.ticker.trim();
      const trimmedNotes = value.notes.trim();
      const qNum = Number(value.quantity);
      const aNum = Number(value.avgCost);
      setEnvelopeError(null);
      mutate(
        {
          accountId: value.accountId,
          kind: value.kind,
          ticker: trimmedTicker.length > 0 ? trimmedTicker : null,
          isin: null,
          label: trimmedLabel,
          currency: value.currency,
          quantity: qNum,
          avgCost: aNum,
          notes: trimmedNotes.length > 0 ? trimmedNotes : null,
        },
        {
          onSuccess: (result) => {
            if (!result.ok) {
              setEnvelopeError(ACCOUNT_NOT_FOUND_MSG);
              return;
            }
            form.reset();
            reset();
            onSuccess?.();
          },
        },
      );
    },
  });

  const submitDisabled = isPending || accounts.length === 0;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      aria-label="Ajouter un placement"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <View
        flexDirection="column"
        gap="$2"
        paddingHorizontal="$1"
        paddingVertical="$2"
        maxHeight="60vh"
        overflowY="auto"
      >
        <form.Field name="accountId">
          {(field) => (
            <Field>
              <Text
                render="label"
                htmlFor="hld-account"
                color="$colorSecondary"
                fontSize="$caption"
              >
                Compte
              </Text>
              <select
                id="hld-account"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.value)}
                required
                style={selectStyle}
              >
                {accounts.length === 0 && (
                  <option value="">Aucun compte — crée-en un dans Paramètres</option>
                )}
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </form.Field>
        <form.Field name="kind">
          {(field) => (
            <Field>
              <Text render="label" htmlFor="hld-kind" color="$colorSecondary" fontSize="$caption">
                Classe
              </Text>
              <select
                id="hld-kind"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.value as HoldingKind)}
                style={selectStyle}
              >
                {HOLDING_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </form.Field>
        <form.Field name="ticker">
          {(field) => (
            <Field>
              <Text render="label" htmlFor="hld-ticker" color="$colorSecondary" fontSize="$caption">
                Ticker (optionnel)
              </Text>
              <input
                id="hld-ticker"
                type="text"
                maxLength={MAX_HOLDING_TICKER_LENGTH}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.value)}
                style={inputStyle}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="label">
          {(field) => (
            <Field>
              <Text render="label" htmlFor="hld-label" color="$colorSecondary" fontSize="$caption">
                Libellé
              </Text>
              <input
                id="hld-label"
                type="text"
                maxLength={MAX_HOLDING_LABEL_LENGTH}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.value)}
                required
                style={inputStyle}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="currency">
          {(field) => (
            <Field>
              <Text
                render="label"
                htmlFor="hld-currency"
                color="$colorSecondary"
                fontSize="$caption"
              >
                Devise
              </Text>
              <select
                id="hld-currency"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.value as HoldingCurrency)}
                style={selectStyle}
              >
                {HOLDING_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </form.Field>
        <form.Field name="quantity">
          {(field) => (
            <Field>
              <Text
                render="label"
                htmlFor="hld-quantity"
                color="$colorSecondary"
                fontSize="$caption"
              >
                Quantité
              </Text>
              <input
                id="hld-quantity"
                type="number"
                min={0}
                step="any"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.value)}
                required
                style={inputStyle}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="avgCost">
          {(field) => (
            <Field>
              <Text
                render="label"
                htmlFor="hld-avgcost"
                color="$colorSecondary"
                fontSize="$caption"
              >
                Prix unitaire moyen
              </Text>
              <input
                id="hld-avgcost"
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
              <Text render="label" htmlFor="hld-notes" color="$colorSecondary" fontSize="$caption">
                Notes (optionnel)
              </Text>
              <input
                id="hld-notes"
                type="text"
                maxLength={MAX_HOLDING_NOTES_LENGTH}
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
        {envelopeError && (
          <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
            {(clientError) =>
              clientError ? null : (
                <Text role="alert" color="$danger" fontSize="$caption">
                  {envelopeError}
                </Text>
              )
            }
          </form.Subscribe>
        )}
        {error && !envelopeError && (
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
        {isSuccess && !envelopeError && !error && (
          <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
            {(clientError) =>
              clientError ? null : (
                <Text role="status" color="$success" fontSize="$caption">
                  Placement ajouté.
                </Text>
              )
            }
          </form.Subscribe>
        )}
      </View>
      <View paddingTop="$2">
        <button
          type="submit"
          disabled={submitDisabled}
          aria-disabled={submitDisabled}
          className={submitPill.pill}
          style={{
            ...submitStyle(submitDisabled),
            alignSelf: "stretch",
            width: "100%",
            height: 44,
            padding: "0 24px",
            marginTop: 0,
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: 0.01,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          {isPending ? "Ajout…" : "Ajouter le placement"}
        </button>
      </View>
    </form>
  );
}
