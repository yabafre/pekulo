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
import { useCreateHolding } from "../_hooks/use-create-holding";
import {
  FormField as Field,
  formInputStyle as inputStyle,
  formSubmitStyle as submitStyle,
} from "../../../_components/form-primitives";
import submitPill from "./submit-pill.module.css";

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
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? "");
  const [kind, setKind] = useState<HoldingKind>("etf");
  const [ticker, setTicker] = useState("");
  const [label, setLabel] = useState("");
  const [currency, setCurrency] = useState<HoldingCurrency>("EUR");
  const [quantity, setQuantity] = useState("0");
  const [avgCost, setAvgCost] = useState("0");
  const [notes, setNotes] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const [envelopeError, setEnvelopeError] = useState<string | null>(null);
  const { mutate, isPending, error, isSuccess, reset } = useCreateHolding();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);
    setEnvelopeError(null);
    const trimmedLabel = label.trim();
    if (trimmedLabel.length === 0) {
      setClientError("Libellé requis");
      return;
    }
    if (trimmedLabel.length > MAX_HOLDING_LABEL_LENGTH) {
      setClientError(`Libellé > ${MAX_HOLDING_LABEL_LENGTH} caractères`);
      return;
    }
    const trimmedTicker = ticker.trim();
    if (trimmedTicker.length > MAX_HOLDING_TICKER_LENGTH) {
      setClientError(`Ticker > ${MAX_HOLDING_TICKER_LENGTH} caractères`);
      return;
    }
    const trimmedNotes = notes.trim();
    if (trimmedNotes.length > MAX_HOLDING_NOTES_LENGTH) {
      setClientError(`Notes > ${MAX_HOLDING_NOTES_LENGTH} caractères`);
      return;
    }
    const qNum = Number(quantity);
    if (!Number.isFinite(qNum) || qNum < 0) {
      setClientError("Quantité invalide (>= 0)");
      return;
    }
    const aNum = Number(avgCost);
    if (!Number.isFinite(aNum) || aNum < 0) {
      setClientError("Prix moyen invalide (>= 0)");
      return;
    }
    if (accountId.length === 0) {
      setClientError("Compte requis");
      return;
    }
    mutate(
      {
        accountId,
        kind,
        ticker: trimmedTicker.length > 0 ? trimmedTicker : null,
        isin: null,
        label: trimmedLabel,
        currency,
        quantity: qNum,
        avgCost: aNum,
        notes: trimmedNotes.length > 0 ? trimmedNotes : null,
      },
      {
        onSuccess: (result) => {
          if (!result.ok) {
            setEnvelopeError(
              result.code === "ACCOUNT_NOT_FOUND" ? ACCOUNT_NOT_FOUND_MSG : result.message,
            );
            return;
          }
          setLabel("");
          setTicker("");
          setQuantity("0");
          setAvgCost("0");
          setNotes("");
          reset();
          onSuccess?.();
        },
      },
    );
  };

  const submitDisabled = isPending || accounts.length === 0;
  return (
    <form
      onSubmit={onSubmit}
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
        <Field>
          <Text render="label" htmlFor="hld-account" color="$colorSecondary" fontSize="$caption">
            Compte
          </Text>
          <select
            id="hld-account"
            value={accountId}
            onChange={(e) => setAccountId(e.currentTarget.value)}
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
        <Field>
          <Text render="label" htmlFor="hld-kind" color="$colorSecondary" fontSize="$caption">
            Classe
          </Text>
          <select
            id="hld-kind"
            value={kind}
            onChange={(e) => setKind(e.currentTarget.value as HoldingKind)}
            style={selectStyle}
          >
            {HOLDING_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <Text render="label" htmlFor="hld-ticker" color="$colorSecondary" fontSize="$caption">
            Ticker (optionnel)
          </Text>
          <input
            id="hld-ticker"
            type="text"
            maxLength={MAX_HOLDING_TICKER_LENGTH}
            value={ticker}
            onChange={(e) => setTicker(e.currentTarget.value)}
            style={inputStyle}
          />
        </Field>
        <Field>
          <Text render="label" htmlFor="hld-label" color="$colorSecondary" fontSize="$caption">
            Libellé
          </Text>
          <input
            id="hld-label"
            type="text"
            maxLength={MAX_HOLDING_LABEL_LENGTH}
            value={label}
            onChange={(e) => setLabel(e.currentTarget.value)}
            required
            style={inputStyle}
          />
        </Field>
        <Field>
          <Text render="label" htmlFor="hld-currency" color="$colorSecondary" fontSize="$caption">
            Devise
          </Text>
          <select
            id="hld-currency"
            value={currency}
            onChange={(e) => setCurrency(e.currentTarget.value as HoldingCurrency)}
            style={selectStyle}
          >
            {HOLDING_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <Text render="label" htmlFor="hld-quantity" color="$colorSecondary" fontSize="$caption">
            Quantité
          </Text>
          <input
            id="hld-quantity"
            type="number"
            min={0}
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.currentTarget.value)}
            required
            style={inputStyle}
          />
        </Field>
        <Field>
          <Text render="label" htmlFor="hld-avgcost" color="$colorSecondary" fontSize="$caption">
            Prix unitaire moyen
          </Text>
          <input
            id="hld-avgcost"
            type="number"
            min={0}
            step="0.01"
            value={avgCost}
            onChange={(e) => setAvgCost(e.currentTarget.value)}
            required
            style={inputStyle}
          />
        </Field>
        <Field>
          <Text render="label" htmlFor="hld-notes" color="$colorSecondary" fontSize="$caption">
            Notes (optionnel)
          </Text>
          <input
            id="hld-notes"
            type="text"
            maxLength={MAX_HOLDING_NOTES_LENGTH}
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
        {isSuccess && !clientError && !envelopeError && !error && (
          <Text role="status" color="$success" fontSize="$caption">
            Placement ajouté.
          </Text>
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
