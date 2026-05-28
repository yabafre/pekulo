"use client";

import { useState, type CSSProperties } from "react";
import { Text, View } from "@pekulo/ui/client";
import { PekuloDialog, pekuloFontSizes, pekuloRadius } from "@pekulo/ui";
import type { BankConnection } from "@pekulo/validators";
import { useRevokeBankConnection } from "../_hooks/use-revoke-bank-connection";

const PROVIDER_UNAVAILABLE_MESSAGE = "Bridge est indisponible — réessaie dans un instant.";
const NOT_FOUND_MESSAGE = "Cette connexion est introuvable (déjà révoquée ?). Recharge la page.";

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

export interface BankConnectionRevokeConfirmProps {
  connection: BankConnection;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}

export function BankConnectionRevokeConfirm({
  connection,
  open,
  onOpenChange,
}: BankConnectionRevokeConfirmProps) {
  const { mutate, isPending, error, reset } = useRevokeBankConnection();
  const [envelopeError, setEnvelopeError] = useState<string | null>(null);

  const handleClose = (next: boolean) => {
    if (!next) {
      setEnvelopeError(null);
      reset();
    }
    onOpenChange(next);
  };

  const label = connection.displayName ?? connection.providerItemId;

  const handleConfirm = () => {
    setEnvelopeError(null);
    mutate(
      { connectionId: connection.id },
      {
        onSuccess: (result) => {
          if (result.ok) {
            onOpenChange(false);
            return;
          }
          setEnvelopeError(
            result.code === "BANK_PROVIDER_UNAVAILABLE"
              ? PROVIDER_UNAVAILABLE_MESSAGE
              : NOT_FOUND_MESSAGE,
          );
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
            <PekuloDialog.Title>Révoquer « {label} » ?</PekuloDialog.Title>
            <PekuloDialog.Description>
              L'accès Bridge sera révoqué et la connexion retirée de Pekulo. Les transactions déjà
              importées sont conservées.
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
                {isPending ? "Révocation…" : "Révoquer"}
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
