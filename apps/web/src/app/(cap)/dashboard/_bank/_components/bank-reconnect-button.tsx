"use client";

import { useState, type CSSProperties } from "react";
import { Text, View } from "@pekulo/ui/client";
import { pekuloFontSizes, pekuloRadius } from "@pekulo/ui";
import { useReconnectBankConnection } from "../_hooks/use-reconnect-bank-connection";

// SCA re-auth CTA. $warning on a muted pill — no -soft token exists; emerald
// is reserved for monetary deltas (design DNA), so SCA uses $warning.
const reconnectBtn = (disabled: boolean): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 32,
  padding: "0 12px",
  borderRadius: pekuloRadius.full,
  backgroundColor: "var(--backgroundMuted)",
  color: "var(--warning)",
  border: "none",
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.6 : 1,
  fontSize: pekuloFontSizes.caption,
  fontWeight: 500,
});

export interface BankReconnectButtonProps {
  connectionId: string;
}

export function BankReconnectButton({ connectionId }: BankReconnectButtonProps) {
  const { mutate, isPending } = useReconnectBankConnection();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    mutate(
      { connectionId },
      {
        onSuccess: (result) => {
          if (result.ok) {
            window.location.href = result.connectUrl;
          } else {
            setError(result.message);
          }
        },
        onError: (err) => setError(err instanceof Error ? err.message : "Erreur inconnue"),
      },
    );
  };

  return (
    <View flexDirection="column" gap="$1">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        style={reconnectBtn(isPending)}
        aria-label="Reconnecter cette banque"
      >
        {isPending ? "Ouverture…" : "Reconnecter"}
      </button>
      {error && (
        <Text role="alert" color="$danger" fontSize="$xs">
          {error}
        </Text>
      )}
    </View>
  );
}
