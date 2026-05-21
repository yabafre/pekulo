"use client";

import { useState, type CSSProperties } from "react";
import { Text, View } from "@pekulo/ui/client";
import { PekuloDialog, pekuloRadius } from "@pekulo/ui";
import type { RealEstate } from "@pekulo/types";
import { useDeleteProperty } from "../_hooks/use-delete-property";
import { DialogCloseX } from "./dialog-close-x";

const NOT_FOUND_MESSAGE = "Bien introuvable (déjà supprimé ?). Recharge la page.";

const dangerBtn = (disabled: boolean): CSSProperties => ({
  alignSelf: "flex-start",
  backgroundColor: "var(--danger)",
  color: "var(--colorOnAccent)",
  height: 40,
  padding: "0 16px",
  borderRadius: pekuloRadius.full,
  border: "none",
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.5 : 1,
  fontSize: 14,
  fontWeight: 500,
});

export interface PropertyDeleteConfirmProps {
  property: RealEstate;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}

export function PropertyDeleteConfirm({
  property,
  open,
  onOpenChange,
}: PropertyDeleteConfirmProps) {
  const { mutate, isPending, error, reset } = useDeleteProperty();
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
      { id: property.id },
      {
        onSuccess: (result) => {
          if (result.ok) {
            onOpenChange(false);
            return;
          }
          setEnvelopeError(NOT_FOUND_MESSAGE);
        },
      },
    );
  };

  return (
    <PekuloDialog open={open} onOpenChange={handleClose}>
      <PekuloDialog.Portal>
        <PekuloDialog.Overlay />
        <PekuloDialog.Content>
          <DialogCloseX />
          <View flexDirection="column" gap="$3" padding="$4">
            <PekuloDialog.Title>Supprimer « {property.label} » ?</PekuloDialog.Title>
            <PekuloDialog.Description>
              Cette action est irréversible. Le bien, son crédit, son loyer et l'historique de
              valorisation seront effacés (cascade Prisma).
            </PekuloDialog.Description>
            {envelopeError && (
              <Text role="alert" color="$danger" fontSize="$caption">
                {envelopeError}
              </Text>
            )}
            {error && !envelopeError && (
              <Text role="alert" color="$danger" fontSize="$caption">
                {error.message}
              </Text>
            )}
            <View flexDirection="row" gap="$3" alignItems="center">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                aria-disabled={isPending}
                style={dangerBtn(isPending)}
              >
                {isPending ? "Suppression…" : "Supprimer"}
              </button>
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
