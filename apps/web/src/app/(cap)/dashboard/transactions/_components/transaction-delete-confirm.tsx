"use client";

import { useState, type CSSProperties } from "react";
import { Text, View } from "@pekulo/ui/client";
import { PekuloDialog, pekuloFontSizes, pekuloRadius } from "@pekulo/ui";
import type { Transaction } from "@pekulo/validators";
import { userErrorMessage } from "@/lib/user-error-message";
import { useDeleteTransaction } from "../_hooks/use-delete-transaction";

const NOT_FOUND_MESSAGE = "Cette transaction est introuvable (déjà supprimée ?). Recharge la page.";

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
  fontSize: pekuloFontSizes.bodySm,
  fontWeight: 500,
});

export interface TransactionDeleteConfirmProps {
  transaction: Transaction;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}

export function TransactionDeleteConfirm({
  transaction,
  open,
  onOpenChange,
}: TransactionDeleteConfirmProps) {
  const { mutate, isPending, error, reset } = useDeleteTransaction();
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
      { id: transaction.id },
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
          <View flexDirection="column" gap="$3" padding="$4">
            <PekuloDialog.Title>Supprimer « {transaction.label} » ?</PekuloDialog.Title>
            <PekuloDialog.Description>
              Cette action est irréversible. La transaction sera effacée définitivement.
            </PekuloDialog.Description>
            {envelopeError && (
              <Text role="alert" color="$danger" fontSize="$caption">
                {envelopeError}
              </Text>
            )}
            {error && !envelopeError && (
              <Text role="alert" color="$danger" fontSize="$caption">
                {userErrorMessage(error, "transaction-delete")}
              </Text>
            )}
            <View flexDirection="row" gap="$3" marginTop="$2">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                style={dangerBtn(isPending)}
              >
                {isPending ? "Suppression…" : "Supprimer"}
              </button>
              <PekuloDialog.Close asChild>
                <View
                  render="button"
                  paddingVertical="$2"
                  paddingHorizontal="$3"
                  cursor="pointer"
                  backgroundColor="transparent"
                  borderWidth={0}
                  alignItems="center"
                >
                  <Text color="$colorTertiary" fontSize="$caption">
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
