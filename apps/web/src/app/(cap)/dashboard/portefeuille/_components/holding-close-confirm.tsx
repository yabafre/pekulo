"use client";

import { useState } from "react";
import { Text, View } from "@pekulo/ui/client";
import { PekuloDialog, PekuloFieldError, PekuloSubmitButton } from "@pekulo/ui";
import type { Holding } from "@pekulo/validators";
import { useCloseHolding } from "../_hooks/use-close-holding";

const NOT_FOUND_MSG = "Ce placement est introuvable (déjà supprimé ?). Recharge la page.";

export interface HoldingCloseConfirmProps {
  holding: Holding;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}

export function HoldingCloseConfirm({ holding, open, onOpenChange }: HoldingCloseConfirmProps) {
  const { mutate, isPending, error, reset } = useCloseHolding();
  const [envelopeError, setEnvelopeError] = useState<string | null>(null);

  const handleClose = (next: boolean) => {
    if (!next) {
      setEnvelopeError(null);
      reset();
    }
    onOpenChange(next);
  };

  const handleConfirm = () => {
    setEnvelopeError(null);
    mutate(
      { id: holding.id },
      {
        onSuccess: (result) => {
          if (result.ok) {
            onOpenChange(false);
            return;
          }
          setEnvelopeError(NOT_FOUND_MSG);
        },
      },
    );
  };

  return (
    <PekuloDialog open={open} onOpenChange={handleClose}>
      <PekuloDialog.Portal>
        <PekuloDialog.Overlay />
        <PekuloDialog.Content>
          <View flexDirection="column" gap="$3" padding="$4">
            <PekuloDialog.Title>
              Clôturer « {holding.ticker ?? holding.label} » ?
            </PekuloDialog.Title>
            <PekuloDialog.Description>
              Le placement disparaît de la liste active. Les lots restent enregistrés pour
              l'historique. Cette action est idempotente — clôturer à nouveau n'a pas d'effet.
            </PekuloDialog.Description>
            {envelopeError && <PekuloFieldError>{envelopeError}</PekuloFieldError>}
            {error && !envelopeError && <PekuloFieldError>{error.message}</PekuloFieldError>}
            <View flexDirection="row" gap="$3" alignItems="center">
              <PekuloSubmitButton
                type="button"
                variant="danger"
                fullWidth={false}
                loading={isPending}
                loadingLabel="Clôture…"
                onClick={handleConfirm}
              >
                Marquer comme clôturé
              </PekuloSubmitButton>
              <PekuloDialog.Close asChild>
                <View
                  render="button"
                  paddingVertical="$2"
                  cursor="pointer"
                  backgroundColor="transparent"
                  borderWidth={0}
                >
                  <Text color="$colorTertiary" fontSize="$caption" hoverStyle={{ color: "$color" }}>
                    Annuler
                  </Text>
                </View>
              </PekuloDialog.Close>
            </View>
          </View>
        </PekuloDialog.Content>
      </PekuloDialog.Portal>
    </PekuloDialog>
  );
}
