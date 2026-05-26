"use client";

// 5-5 reopen confirm (AC-3). PekuloDialog confirm shape — explicit
// "Réouvrir / Annuler" choice, body explains the consequence (the row
// flips back to derived and edits resume). Same envelope-narrow shape
// as ClotureModal.

import { useState } from "react";
import { PekuloButton, PekuloDialog, PekuloFieldError } from "@pekulo/ui";
import { View } from "@pekulo/ui/client";
import { useReopenMonthly } from "../_hooks/use-reopen-monthly";

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

interface ReopenConfirmProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  year: number;
  monthNum: number;
  onSuccess?: () => void;
}

export function ReopenConfirm({
  open,
  onOpenChange,
  year,
  monthNum,
  onSuccess,
}: ReopenConfirmProps) {
  const monthName = MONTH_LABELS_FR[monthNum - 1];
  const { mutate, isPending } = useReopenMonthly();
  const [envelopeError, setEnvelopeError] = useState<string | null>(null);

  function handleConfirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnvelopeError(null);
    mutate(
      { year, monthNum },
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
          Réouvrir {monthName} {year} ?
        </PekuloDialog.Title>
        <PekuloDialog.Description>
          Le mois redeviendra modifiable et l'agrégat repassera en mode dérivé. Les valeurs figées
          actuelles seront ignorées (mais conservées en base — tu pourras les rééditer avant la
          prochaine clôture).
        </PekuloDialog.Description>
        <form onSubmit={handleConfirm} aria-label="Réouvrir le mois">
          <View padding="$4" gap="$3">
            {envelopeError !== null && <PekuloFieldError>{envelopeError}</PekuloFieldError>}
            <View flexDirection="row" gap="$2" justifyContent="flex-end" marginTop="$2">
              <PekuloButton
                variant="ghost"
                onPress={() => onOpenChange(false)}
                disabled={isPending}
              >
                Annuler
              </PekuloButton>
              <PekuloButton type="submit" disabled={isPending}>
                {isPending ? "Réouverture…" : "Réouvrir"}
              </PekuloButton>
            </View>
          </View>
        </form>
      </PekuloDialog.Content>
    </PekuloDialog>
  );
}
