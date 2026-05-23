"use client";

import { useState } from "react";
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

const KIND_LABEL: Record<HoldingKind, string> = {
  etf: "ETF",
  action: "Action",
  crypto: "Crypto",
  autre: "Autre",
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
      <View paddingHorizontal="$1" paddingVertical="$2" maxHeight="60vh" overflowY="auto">
        <PekuloFieldGroup>
          <form.Field name="accountId">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="hld-account">Compte</PekuloFieldLabel>
                <PekuloSelect
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v)}
                >
                  <PekuloSelect.Trigger id="hld-account">
                    <PekuloSelect.Value
                      placeholder={
                        accounts.length === 0
                          ? "Aucun compte — crée-en un dans Paramètres"
                          : "Choisir un compte"
                      }
                    />
                  </PekuloSelect.Trigger>
                  <PekuloSelect.Content>
                    <PekuloSelect.Group>
                      {accounts.map((a, i) => (
                        <PekuloSelect.Item key={a.id} value={a.id} index={i}>
                          {a.label}
                        </PekuloSelect.Item>
                      ))}
                    </PekuloSelect.Group>
                  </PekuloSelect.Content>
                </PekuloSelect>
              </PekuloField>
            )}
          </form.Field>
          <form.Field name="kind">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="hld-kind">Classe</PekuloFieldLabel>
                <PekuloSelect
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as HoldingKind)}
                >
                  <PekuloSelect.Trigger id="hld-kind">
                    <PekuloSelect.Value placeholder="Choisir une classe" />
                  </PekuloSelect.Trigger>
                  <PekuloSelect.Content>
                    <PekuloSelect.Group>
                      {HOLDING_KINDS.map((k, i) => (
                        <PekuloSelect.Item key={k} value={k} index={i}>
                          {KIND_LABEL[k]}
                        </PekuloSelect.Item>
                      ))}
                    </PekuloSelect.Group>
                  </PekuloSelect.Content>
                </PekuloSelect>
              </PekuloField>
            )}
          </form.Field>
          <form.Field name="ticker">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="hld-ticker">Ticker (optionnel)</PekuloFieldLabel>
                <PekuloInput
                  id="hld-ticker"
                  type="text"
                  maxLength={MAX_HOLDING_TICKER_LENGTH}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.currentTarget.value)}
                />
              </PekuloField>
            )}
          </form.Field>
          <form.Field name="label">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="hld-label">Libellé</PekuloFieldLabel>
                <PekuloInput
                  id="hld-label"
                  type="text"
                  maxLength={MAX_HOLDING_LABEL_LENGTH}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.currentTarget.value)}
                  required
                />
              </PekuloField>
            )}
          </form.Field>
          <form.Field name="currency">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="hld-currency">Devise</PekuloFieldLabel>
                <PekuloSelect
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as HoldingCurrency)}
                >
                  <PekuloSelect.Trigger id="hld-currency">
                    <PekuloSelect.Value placeholder="Choisir une devise" />
                  </PekuloSelect.Trigger>
                  <PekuloSelect.Content>
                    <PekuloSelect.Group>
                      {HOLDING_CURRENCIES.map((c, i) => (
                        <PekuloSelect.Item key={c} value={c} index={i}>
                          {c}
                        </PekuloSelect.Item>
                      ))}
                    </PekuloSelect.Group>
                  </PekuloSelect.Content>
                </PekuloSelect>
              </PekuloField>
            )}
          </form.Field>
          <form.Field name="quantity">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="hld-quantity">Quantité</PekuloFieldLabel>
                <PekuloInput
                  id="hld-quantity"
                  type="number"
                  min={0}
                  step="any"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.currentTarget.value)}
                  required
                />
              </PekuloField>
            )}
          </form.Field>
          <form.Field name="avgCost">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="hld-avgcost">Prix unitaire moyen</PekuloFieldLabel>
                <PekuloInput
                  id="hld-avgcost"
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
                <PekuloFieldLabel htmlFor="hld-notes">Notes (optionnel)</PekuloFieldLabel>
                <PekuloInput
                  id="hld-notes"
                  type="text"
                  maxLength={MAX_HOLDING_NOTES_LENGTH}
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
          {isSuccess && !envelopeError && !error && (
            <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
              {(clientError) =>
                clientError ? null : (
                  <PekuloFieldDescription color="$success">
                    Placement ajouté.
                  </PekuloFieldDescription>
                )
              }
            </form.Subscribe>
          )}
        </PekuloFieldGroup>
      </View>
      <View paddingTop="$2">
        <PekuloSubmitButton loading={isPending} loadingLabel="Ajout…" disabled={submitDisabled}>
          Ajouter le placement
        </PekuloSubmitButton>
      </View>
    </form>
  );
}
