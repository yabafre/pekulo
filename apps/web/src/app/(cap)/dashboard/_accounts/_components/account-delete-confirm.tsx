"use client";

import { useState, type CSSProperties } from "react";
import { Text, View } from "@pekulo/ui/client";
import { PekuloDialog, pekuloFontSizes, pekuloRadius } from "@pekulo/ui";
import type { Account } from "@pekulo/validators";
import { useDeleteAccount } from "../_hooks/use-delete-account";

const FK_MESSAGE = "Ce compte est référencé par des positions — supprimez-les d'abord.";
const NOT_FOUND_MESSAGE = "Ce compte est introuvable (déjà supprimé ?). Recharge la page.";

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

export interface AccountDeleteConfirmProps {
  account: Account;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}

export function AccountDeleteConfirm({ account, open, onOpenChange }: AccountDeleteConfirmProps) {
  const { mutate, isPending, error, reset } = useDeleteAccount();
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
      { id: account.id },
      {
        onSuccess: (result) => {
          if (result.ok) {
            onOpenChange(false);
            return;
          }
          if (result.code === "ACCOUNT_REFERENCED_FK") {
            setEnvelopeError(FK_MESSAGE);
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
            <PekuloDialog.Title>Supprimer « {account.label} » ?</PekuloDialog.Title>
            <PekuloDialog.Description>
              Cette action est irréversible. Le solde et l'historique du compte seront effacés.
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
