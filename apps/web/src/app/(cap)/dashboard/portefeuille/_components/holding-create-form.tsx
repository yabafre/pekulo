"use client";

import { useState } from "react";
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

export interface HoldingCreateFormProps {
  accounts: Account[];
  onSuccess?: () => void;
}

export function HoldingCreateForm({ accounts, onSuccess }: HoldingCreateFormProps) {
  const t = useTranslations("portefeuille");
  const KIND_LABEL: Record<HoldingKind, string> = {
    etf: t("kinds.etf"),
    action: t("kinds.action"),
    crypto: t("kinds.crypto"),
    autre: t("kinds.autre"),
  };
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
          return t("labelRequired");
        }
        if (trimmedLabel.length > MAX_HOLDING_LABEL_LENGTH) {
          return t("labelTooLong", { max: MAX_HOLDING_LABEL_LENGTH });
        }
        const trimmedTicker = value.ticker.trim();
        if (trimmedTicker.length > MAX_HOLDING_TICKER_LENGTH) {
          return t("tickerTooLong", { max: MAX_HOLDING_TICKER_LENGTH });
        }
        const trimmedNotes = value.notes.trim();
        if (trimmedNotes.length > MAX_HOLDING_NOTES_LENGTH) {
          return t("notesTooLong", { max: MAX_HOLDING_NOTES_LENGTH });
        }
        const qNum = Number(value.quantity);
        if (!Number.isFinite(qNum) || qNum < 0) {
          return t("quantityInvalid");
        }
        const aNum = Number(value.avgCost);
        if (!Number.isFinite(aNum) || aNum < 0) {
          return t("avgCostInvalid");
        }
        if (value.accountId.length === 0) {
          return t("accountRequired");
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
              setEnvelopeError(t("accountNotFound"));
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
      aria-label={t("addHoldingTitle")}
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <View paddingHorizontal="$1" paddingVertical="$2" maxHeight="60vh" overflowY="auto">
        <PekuloFieldGroup>
          <form.Field name="accountId">
            {(field) => (
              <PekuloField>
                <PekuloFieldLabel htmlFor="hld-account">{t("fields.account")}</PekuloFieldLabel>
                <PekuloSelect
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v)}
                >
                  <PekuloSelect.Trigger id="hld-account">
                    <PekuloSelect.Value
                      placeholder={
                        accounts.length === 0 ? t("noAccountPlaceholder") : t("chooseAccount")
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
                <PekuloFieldLabel htmlFor="hld-kind">{t("fields.kind")}</PekuloFieldLabel>
                <PekuloSelect
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as HoldingKind)}
                >
                  <PekuloSelect.Trigger id="hld-kind">
                    <PekuloSelect.Value placeholder={t("chooseKind")} />
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
                <PekuloFieldLabel htmlFor="hld-ticker">{t("fields.ticker")}</PekuloFieldLabel>
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
                <PekuloFieldLabel htmlFor="hld-label">{t("fields.label")}</PekuloFieldLabel>
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
                <PekuloFieldLabel htmlFor="hld-currency">{t("fields.currency")}</PekuloFieldLabel>
                <PekuloSelect
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as HoldingCurrency)}
                >
                  <PekuloSelect.Trigger id="hld-currency">
                    <PekuloSelect.Value placeholder={t("chooseCurrency")} />
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
                <PekuloFieldLabel htmlFor="hld-quantity">{t("fields.quantity")}</PekuloFieldLabel>
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
                <PekuloFieldLabel htmlFor="hld-avgcost">{t("fields.avgCost")}</PekuloFieldLabel>
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
                <PekuloFieldLabel htmlFor="hld-notes">{t("fields.notes")}</PekuloFieldLabel>
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
                  <PekuloFieldDescription color="$success">{t("added")}</PekuloFieldDescription>
                )
              }
            </form.Subscribe>
          )}
        </PekuloFieldGroup>
      </View>
      <View paddingTop="$2">
        <PekuloSubmitButton
          loading={isPending}
          loadingLabel={t("adding")}
          disabled={submitDisabled}
        >
          {t("addHoldingSubmit")}
        </PekuloSubmitButton>
      </View>
    </form>
  );
}
