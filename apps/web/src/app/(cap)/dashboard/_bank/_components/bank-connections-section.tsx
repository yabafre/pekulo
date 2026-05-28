"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Text, View } from "@pekulo/ui/client";
import { PekuloDialog, PekuloSkeleton, pekuloFontSizes, pekuloRadius } from "@pekulo/ui";
import { Plus, RefreshCw } from "lucide-react";
import type { BankConnection } from "@pekulo/validators";
import { useBankConnections } from "../_hooks/use-bank-connections";
import { useInitiateBankConnection } from "../_hooks/use-initiate-bank-connection";
import { BankConnectionRow } from "./bank-connection-row";
import { BankConnectionRenameForm } from "./bank-connection-rename-form";
import { BankConnectionRevokeConfirm } from "./bank-connection-revoke-confirm";

const addPill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 32,
  padding: "0 12px",
  borderRadius: pekuloRadius.full,
  backgroundColor: "var(--backgroundMuted)",
  color: "var(--color)",
  border: "none",
  cursor: "pointer",
  fontSize: pekuloFontSizes.caption,
  fontWeight: 500,
};

const refreshBtn = (busy: boolean): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  borderRadius: pekuloRadius.full,
  backgroundColor: "transparent",
  color: "var(--colorTertiary)",
  border: "none",
  cursor: busy ? "default" : "pointer",
  opacity: busy ? 0.5 : 1,
});

type DialogKind = "rename" | "revoke" | null;

export function BankConnectionsSection() {
  // `refetch` re-reads the connections list (status + lastRefreshedAt the
  // cron/webhook already updated server-side) without a full page reload —
  // story 5-7 follow-up. Live push (SSE) is deferred to a dedicated story.
  const { data, isLoading, error, isFetching, refetch } = useBankConnections();
  const initiate = useInitiateBankConnection();
  const [openDialog, setOpenDialog] = useState<DialogKind>(null);
  const [active, setActive] = useState<BankConnection | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  // R13 hydration guard — !isHydrated || isLoading (lesson 2026-05-26).
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => setIsHydrated(true), []);
  const showLoading = !isHydrated || isLoading;

  const closeAll = () => {
    setOpenDialog(null);
    setActive(null);
  };
  const openFor = (kind: Exclude<DialogKind, null>, connection: BankConnection) => {
    setActive(connection);
    setOpenDialog(kind);
  };

  const onConnect = () => {
    setConnectError(null);
    const redirectUri =
      typeof window !== "undefined"
        ? `${window.location.origin}/dashboard/bank/callback`
        : undefined;
    initiate.mutate(
      { redirectUri },
      {
        onSuccess: (result) => {
          if (result.ok) {
            window.location.href = result.data.connectUrl;
          } else {
            setConnectError(result.message);
          }
        },
        onError: (err) => setConnectError(err instanceof Error ? err.message : "Erreur inconnue"),
      },
    );
  };

  const connections = data ?? [];

  return (
    <View render="section" aria-labelledby="bank-h" flexDirection="column">
      <View
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        marginBottom="$3"
      >
        <Text
          id="bank-h"
          render="h2"
          color="$color"
          fontSize="$h3"
          fontWeight="600"
          $lg={{ fontSize: "$h2" }}
        >
          Connexions bancaires
        </Text>
        <View flexDirection="row" alignItems="center" gap="$2">
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            style={refreshBtn(isFetching)}
            aria-label={isFetching ? "Rafraîchissement…" : "Rafraîchir les connexions"}
          >
            <RefreshCw size={16} strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            onClick={onConnect}
            disabled={initiate.isPending}
            style={addPill}
            aria-label="Connecter une banque"
          >
            <Plus size={12} strokeWidth={2.25} aria-hidden />
            {initiate.isPending ? "Ouverture…" : "Connecter une banque"}
          </button>
        </View>
      </View>

      {connectError && (
        <Text role="alert" color="$danger" fontSize="$caption" marginBottom="$2">
          {connectError}
        </Text>
      )}

      {showLoading && (
        <View role="status" aria-live="polite">
          <Text
            color="$colorTertiary"
            fontSize="$caption"
            position="absolute"
            width={1}
            height={1}
            overflow="hidden"
          >
            Chargement…
          </Text>
          <PekuloSkeleton lines={2} height={48} />
        </View>
      )}
      {error && !showLoading && (
        <Text color="$danger" fontSize="$caption" role="alert">
          {error.message}
        </Text>
      )}
      {!showLoading && !error && connections.length === 0 && (
        <Text color="$colorTertiary" fontSize="$caption">
          Aucune banque connectée. Connecte ta première banque pour importer tes transactions
          automatiquement.
        </Text>
      )}

      {!showLoading && connections.length > 0 && (
        <View flexDirection="column" role="list" aria-label="Liste des connexions bancaires">
          {connections.map((connection) => (
            <BankConnectionRow
              key={connection.id}
              connection={connection}
              onRename={(c) => openFor("rename", c)}
              onRevoke={(c) => openFor("revoke", c)}
            />
          ))}
        </View>
      )}

      {active && (
        <PekuloDialog open={openDialog === "rename"} onOpenChange={(o) => !o && closeAll()}>
          <PekuloDialog.Portal>
            <PekuloDialog.Overlay />
            <PekuloDialog.Content>
              <View flexDirection="column" gap="$3">
                <PekuloDialog.Title>
                  Renommer « {active.displayName ?? active.providerItemId} »
                </PekuloDialog.Title>
              </View>
              <BankConnectionRenameForm connection={active} onSuccess={closeAll} />
              <PekuloDialog.Close asChild>
                <View
                  render="button"
                  paddingVertical="$2"
                  cursor="pointer"
                  backgroundColor="transparent"
                  borderWidth={0}
                  alignItems="center"
                >
                  <Text color="$colorTertiary" fontSize="$caption" hoverStyle={{ color: "$color" }}>
                    Annuler
                  </Text>
                </View>
              </PekuloDialog.Close>
            </PekuloDialog.Content>
          </PekuloDialog.Portal>
        </PekuloDialog>
      )}

      {active && (
        <BankConnectionRevokeConfirm
          connection={active}
          open={openDialog === "revoke"}
          onOpenChange={(o) => !o && closeAll()}
        />
      )}
    </View>
  );
}
