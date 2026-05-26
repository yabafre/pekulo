"use client";

// 5-5 cloture modal (AC-1 / AC-7). PekuloDialog on desktop ; on mobile we
// keep the same Dialog rather than swap to PekuloSheet — the 4 numeric
// fields fit comfortably on mobile and the close-window CTA UX is
// "decisive moment" rather than "background browse" (lesson 2026-05-17
// applies for the inverse: sheets are for bottom-anchored browse flows).
// The form's aria-label is the test selector.

import { useEffect, useState } from "react";
import {
  PekuloButton,
  PekuloDialog,
  PekuloField,
  PekuloFieldError,
  PekuloFieldGroup,
  PekuloFieldLabel,
  PekuloInput,
  PekuloSubmitButton,
} from "@pekulo/ui";
import { View } from "@pekulo/ui/client";
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
  const monthName = MONTH_LABELS_FR[monthNum - 1];
  const { mutate, isPending, reset } = useSignOffMonthly();

  // Pre-fill from derived values; re-sync when the modal opens (the user
  // might re-open later in the close window with different live aggregates).
  const [incomeStr, setIncomeStr] = useState(String(derivedIncomeEur));
  const [spendingStr, setSpendingStr] = useState(String(derivedSpendingEur));
  const [transfersStr, setTransfersStr] = useState(String(derivedTransfersEur));
  const [netChangeStr, setNetChangeStr] = useState(String(derivedNetChangeEur));
  const [validationError, setValidationError] = useState<string | null>(null);
  const [envelopeError, setEnvelopeError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setIncomeStr(String(derivedIncomeEur));
      setSpendingStr(String(derivedSpendingEur));
      setTransfersStr(String(derivedTransfersEur));
      setNetChangeStr(String(derivedNetChangeEur));
      setValidationError(null);
      setEnvelopeError(null);
      reset();
    }
  }, [open, derivedIncomeEur, derivedSpendingEur, derivedTransfersEur, derivedNetChangeEur, reset]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setValidationError(null);
    setEnvelopeError(null);
    const income = Number(incomeStr);
    const spending = Number(spendingStr);
    const transfers = Number(transfersStr);
    const netChange = Number(netChangeStr);
    if (!Number.isFinite(income) || income < 0) {
      setValidationError("Entrées invalides (≥ 0)");
      return;
    }
    if (!Number.isFinite(spending) || spending < 0) {
      setValidationError("Sorties invalides (≥ 0)");
      return;
    }
    if (!Number.isFinite(transfers) || transfers < 0) {
      setValidationError("Transferts invalides (≥ 0)");
      return;
    }
    if (!Number.isFinite(netChange)) {
      setValidationError("Net invalide");
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
      <PekuloDialog.Content>
        <PekuloDialog.Title>
          Clôturer {monthName} {year}
        </PekuloDialog.Title>
        <PekuloDialog.Description>
          Les valeurs ci-dessous seront figées sur la fiche mensuelle. Tu pourras les rééditer en
          réouvrant le mois.
        </PekuloDialog.Description>
        <form onSubmit={handleSubmit} aria-label="Clôturer le mois">
          <View padding="$4" gap="$4">
            <PekuloFieldGroup>
              <PekuloField>
                <PekuloFieldLabel htmlFor="cloture-income">Entrées (€)</PekuloFieldLabel>
                <PekuloInput
                  id="cloture-income"
                  inputMode="decimal"
                  value={incomeStr}
                  onChange={(e) => setIncomeStr(e.currentTarget.value)}
                />
              </PekuloField>
              <PekuloField>
                <PekuloFieldLabel htmlFor="cloture-spending">Sorties (€)</PekuloFieldLabel>
                <PekuloInput
                  id="cloture-spending"
                  inputMode="decimal"
                  value={spendingStr}
                  onChange={(e) => setSpendingStr(e.currentTarget.value)}
                />
              </PekuloField>
              <PekuloField>
                <PekuloFieldLabel htmlFor="cloture-transfers">Transferts (€)</PekuloFieldLabel>
                <PekuloInput
                  id="cloture-transfers"
                  inputMode="decimal"
                  value={transfersStr}
                  onChange={(e) => setTransfersStr(e.currentTarget.value)}
                />
              </PekuloField>
              <PekuloField>
                <PekuloFieldLabel htmlFor="cloture-net">Net (€)</PekuloFieldLabel>
                <PekuloInput
                  id="cloture-net"
                  inputMode="decimal"
                  value={netChangeStr}
                  onChange={(e) => setNetChangeStr(e.currentTarget.value)}
                />
              </PekuloField>
              {validationError !== null && <PekuloFieldError>{validationError}</PekuloFieldError>}
              {envelopeError !== null && <PekuloFieldError>{envelopeError}</PekuloFieldError>}
            </PekuloFieldGroup>
            <View flexDirection="row" gap="$2" justifyContent="flex-end" marginTop="$2">
              <PekuloButton
                variant="ghost"
                onPress={() => onOpenChange(false)}
                disabled={isPending}
              >
                Annuler
              </PekuloButton>
              <PekuloSubmitButton loading={isPending} fullWidth={false}>
                Confirmer la clôture
              </PekuloSubmitButton>
            </View>
          </View>
        </form>
      </PekuloDialog.Content>
    </PekuloDialog>
  );
}
