"use client";

// 5-5 cloture modal (AC-1 / AC-7).
//
// Portal + Overlay are mandatory for the dialog to render as a true overlay
// — without them PekuloDialog.Content lands inline in the parent card
// (5-5 first-pass regression caught by Alex's visual review). The DS
// primitive's animations (scale+fade enter/exit, $backgroundOverlay scrim)
// only fire under the Portal.
//
// Modal Content already brings padding $6 + gap $3 from PekuloDialog —
// the form body adds no further padding, only inner gap. Tabular-nums on
// the 4 numeric inputs aligns the digit columns (SSOT --font-feature-tabular).
// Submit affordance is a primary PekuloButton (white chrome per TR-strict);
// Cancel is the ghost variant.

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  PekuloButton,
  PekuloDialog,
  PekuloDialogCloseX as DialogCloseX,
  PekuloField,
  PekuloFieldGroup,
  PekuloFieldLabel,
  PekuloInput,
} from "@pekulo/ui";
import { View, Text } from "@pekulo/ui/client";
import { useSignOffMonthly } from "../_hooks/use-sign-off-monthly";

const MONTH_LABELS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

interface ClotureModalProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  year: number;
  monthNum: number;
  derivedIncomeEur: number;
  derivedSpendingEur: number;
  derivedTransfersEur: number;
  derivedNetChangeEur: number;
  onSuccess?: () => void;
}

const tabularInputStyle = { fontVariantNumeric: "tabular-nums" as const };

export function ClotureModal({
  open,
  onOpenChange,
  year,
  monthNum,
  derivedIncomeEur,
  derivedSpendingEur,
  derivedTransfersEur,
  derivedNetChangeEur,
  onSuccess,
}: ClotureModalProps) {
  const t = useTranslations();
  const monthName = MONTH_LABELS_FR[monthNum - 1] ?? "";
  const { mutate, isPending, reset } = useSignOffMonthly();

  // Review F9: pre-fill via toFixed(2) so float arithmetic drift from
  // derive (e.g. 0.1 + 0.2 → 0.30000000000000004) never surfaces in the
  // input. Two decimals = centime precision, matches the AC ack on amounts.
  const fmt = (v: number) => v.toFixed(2);
  const [incomeStr, setIncomeStr] = useState(fmt(derivedIncomeEur));
  const [spendingStr, setSpendingStr] = useState(fmt(derivedSpendingEur));
  const [transfersStr, setTransfersStr] = useState(fmt(derivedTransfersEur));
  const [netChangeStr, setNetChangeStr] = useState(fmt(derivedNetChangeEur));
  const [validationError, setValidationError] = useState<string | null>(null);
  const [envelopeError, setEnvelopeError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setIncomeStr(fmt(derivedIncomeEur));
      setSpendingStr(fmt(derivedSpendingEur));
      setTransfersStr(fmt(derivedTransfersEur));
      setNetChangeStr(fmt(derivedNetChangeEur));
      setValidationError(null);
      setEnvelopeError(null);
      reset();
    }
  }, [open, derivedIncomeEur, derivedSpendingEur, derivedTransfersEur, derivedNetChangeEur, reset]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setValidationError(null);
    setEnvelopeError(null);
    // Review F6: FR-locale comma normalize. Alex pastes amounts from her
    // bank statement which uses "1234,56" (FR format) — without the swap
    // Number(",") returns NaN and the form rejects with a generic
    // "invalide" error that obscures the comma issue. Strip whitespace
    // too (export sources occasionally insert thousand-separator spaces).
    const parseAmount = (s: string) => Number(s.replace(/\s/g, "").replace(",", "."));
    const income = parseAmount(incomeStr);
    const spending = parseAmount(spendingStr);
    const transfers = parseAmount(transfersStr);
    const netChange = parseAmount(netChangeStr);
    if (!Number.isFinite(income) || income < 0) {
      setValidationError(t("mensuel.cloture.errorIncome"));
      return;
    }
    if (!Number.isFinite(spending) || spending < 0) {
      setValidationError(t("mensuel.cloture.errorSpending"));
      return;
    }
    if (!Number.isFinite(transfers) || transfers < 0) {
      setValidationError(t("mensuel.cloture.errorTransfers"));
      return;
    }
    if (!Number.isFinite(netChange)) {
      setValidationError(t("mensuel.cloture.errorNet"));
      return;
    }
    mutate(
      {
        year,
        monthNum,
        incomeEur: income,
        spendingEur: spending,
        transfersEur: transfers,
        netChangeEur: netChange,
      },
      {
        onSuccess: (result) => {
          if (result.ok) {
            onOpenChange(false);
            onSuccess?.();
          } else {
            setEnvelopeError(result.message);
          }
        },
      },
    );
  }

  return (
    <PekuloDialog open={open} onOpenChange={onOpenChange}>
      <PekuloDialog.Portal>
        <PekuloDialog.Overlay />
        <PekuloDialog.Content>
          <DialogCloseX />
          <View flexDirection="column" gap="$2">
            <PekuloDialog.Title>
              {t("mensuel.cloture.title", { month: monthName, year })}
            </PekuloDialog.Title>
            <PekuloDialog.Description>{t("mensuel.cloture.description")}</PekuloDialog.Description>
          </View>
          <form onSubmit={handleSubmit} aria-label={t("mensuel.cloture.formAria")}>
            <View flexDirection="column" gap="$4" marginTop="$2">
              <PekuloFieldGroup>
                <PekuloField>
                  <PekuloFieldLabel htmlFor="cloture-income">
                    {t("mensuel.cloture.labelIncome")}
                  </PekuloFieldLabel>
                  <PekuloInput
                    id="cloture-income"
                    inputMode="decimal"
                    value={incomeStr}
                    onChange={(e) => setIncomeStr(e.currentTarget.value)}
                    style={tabularInputStyle}
                  />
                </PekuloField>
                <PekuloField>
                  <PekuloFieldLabel htmlFor="cloture-spending">
                    {t("mensuel.cloture.labelSpending")}
                  </PekuloFieldLabel>
                  <PekuloInput
                    id="cloture-spending"
                    inputMode="decimal"
                    value={spendingStr}
                    onChange={(e) => setSpendingStr(e.currentTarget.value)}
                    style={tabularInputStyle}
                  />
                </PekuloField>
                <PekuloField>
                  <PekuloFieldLabel htmlFor="cloture-transfers">
                    {t("mensuel.cloture.labelTransfers")}
                  </PekuloFieldLabel>
                  <PekuloInput
                    id="cloture-transfers"
                    inputMode="decimal"
                    value={transfersStr}
                    onChange={(e) => setTransfersStr(e.currentTarget.value)}
                    style={tabularInputStyle}
                  />
                </PekuloField>
                <PekuloField>
                  <PekuloFieldLabel htmlFor="cloture-net">
                    {t("mensuel.cloture.labelNet")}
                  </PekuloFieldLabel>
                  <PekuloInput
                    id="cloture-net"
                    inputMode="decimal"
                    value={netChangeStr}
                    onChange={(e) => setNetChangeStr(e.currentTarget.value)}
                    style={tabularInputStyle}
                  />
                </PekuloField>
              </PekuloFieldGroup>
              {validationError !== null && (
                <Text role="alert" color="$danger" fontSize="$caption">
                  {validationError}
                </Text>
              )}
              {envelopeError !== null && (
                <Text role="alert" color="$danger" fontSize="$caption">
                  {envelopeError}
                </Text>
              )}
              <View flexDirection="row" gap="$2" justifyContent="flex-end" marginTop="$2">
                <PekuloButton
                  variant="ghost"
                  onPress={() => onOpenChange(false)}
                  disabled={isPending}
                >
                  {t("common.cancel")}
                </PekuloButton>
                <PekuloButton type="submit" disabled={isPending}>
                  {isPending ? t("mensuel.cloture.submitting") : t("mensuel.cloture.submit")}
                </PekuloButton>
              </View>
            </View>
          </form>
        </PekuloDialog.Content>
      </PekuloDialog.Portal>
    </PekuloDialog>
  );
}
