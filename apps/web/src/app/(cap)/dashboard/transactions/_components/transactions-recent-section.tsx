"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Text, View } from "@pekulo/ui/client";
import {
  HeaderAction,
  PekuloActivityRow,
  PekuloDialog,
  PekuloPopover,
  PekuloSkeleton,
  Section,
  pekuloFontSizes,
  pekuloRadius,
  useToast,
} from "@pekulo/ui";
import { MoreHorizontal, Search } from "lucide-react";
import { TRANSACTION_CATEGORY_LABELS, type Transaction } from "@pekulo/validators";
import type { Activity } from "@pekulo/types";
import { useAccounts } from "../../parametres/_hooks/use-accounts";
import { useTransactions } from "../_hooks/use-transactions";
import { TransactionEditForm } from "./transaction-edit-form";
import { TransactionDeleteConfirm } from "./transaction-delete-confirm";

// Flat layout — mirrors ux-preview TransactionsScreen's "Récentes" section
// (App.tsx:1360-1372): title + "Filtrer" HeaderAction (Search icon) — no
// inline "+ Ajouter" pill. The canonical add entrypoint is the global
// top-bar "Nouvelle transaction" pill (cap-shell.tsx owns the dialog).
// This component owns edit + delete dialogs only (per-row CRUD).

const rowActionBtn: CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--colorTertiary)",
  fontSize: pekuloFontSizes.xs,
  padding: "4px 8px",
};

const dangerRowActionBtn: CSSProperties = { ...rowActionBtn, color: "var(--danger)" };

const kebabBtn: CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--colorTertiary)",
  width: 32,
  height: 32,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: pekuloRadius.full,
};

const popoverActionBtnBase: CSSProperties = {
  display: "flex",
  alignItems: "center",
  width: "100%",
  padding: "8px 12px",
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: pekuloFontSizes.bodySm,
  fontWeight: 500,
  borderRadius: pekuloRadius.md,
  textAlign: "left",
};
const popoverActionBtnNeutral: CSSProperties = {
  ...popoverActionBtnBase,
  color: "var(--color)",
};
const popoverActionBtnDanger: CSSProperties = {
  ...popoverActionBtnBase,
  color: "var(--danger)",
};

type DialogKind = "edit" | "delete" | null;

export function TransactionsRecentSection() {
  const { data, isLoading, error } = useTransactions(50);
  const { data: accounts } = useAccounts();
  const [openDialog, setOpenDialog] = useState<DialogKind>(null);
  const [activeTx, setActiveTx] = useState<Transaction | null>(null);
  const toast = useToast();

  const accountLabelById = useMemo(() => {
    const map = new Map<string, string>();
    (accounts ?? []).forEach((a) => map.set(a.id, a.label));
    return map;
  }, [accounts]);

  const closeAll = () => {
    setOpenDialog(null);
    setActiveTx(null);
  };
  const openFor = (kind: Exclude<DialogKind, null>, tx: Transaction) => {
    setActiveTx(tx);
    setOpenDialog(kind);
  };

  const items = data?.items ?? [];

  return (
    <Section
      ariaLabel="Récentes"
      title="Récentes"
      action={
        <HeaderAction
          icon={Search}
          label="Filtrer"
          onPress={() => toast.info("Bientôt", "Le filtre transactions arrive plus tard.")}
        />
      }
    >
      {isLoading && (
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
          <PekuloSkeleton lines={3} height={48} />
        </View>
      )}
      {error && !isLoading && (
        <Text color="$danger" fontSize="$caption" role="alert">
          {error.message}
        </Text>
      )}
      {!isLoading && !error && items.length === 0 && (
        <Text color="$colorTertiary" fontSize="$caption">
          Aucune transaction. Ajoute la première pour démarrer le suivi mensuel.
        </Text>
      )}

      {items.length > 0 && (
        <View flexDirection="column" role="list" aria-label="Liste des transactions">
          {items.map((tx) => {
            const activity: Activity = {
              label: tx.label,
              account: accountLabelById.get(tx.accountId) ?? "—",
              category: TRANSACTION_CATEGORY_LABELS[tx.category],
              direction: tx.type === "inflow" ? "in" : "out",
              amountEur: tx.amount,
            };
            return (
              <View key={tx.id} role="listitem" flexDirection="row" alignItems="center" gap="$3">
                <View flex={1} minWidth={0}>
                  <PekuloActivityRow tx={activity} />
                </View>
                <View
                  flexDirection="row"
                  gap="$2"
                  marginLeft="$2"
                  display="none"
                  $lg={{ display: "flex" }}
                >
                  <button
                    type="button"
                    onClick={() => openFor("edit", tx)}
                    style={rowActionBtn}
                    aria-label={`Modifier ${tx.label}`}
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => openFor("delete", tx)}
                    style={dangerRowActionBtn}
                    aria-label={`Supprimer ${tx.label}`}
                  >
                    Supprimer
                  </button>
                </View>
                <View marginLeft="$2" $lg={{ display: "none" }}>
                  <PekuloPopover>
                    <PekuloPopover.Trigger style={kebabBtn} aria-label={`Actions ${tx.label}`}>
                      <MoreHorizontal size={18} strokeWidth={2} aria-hidden />
                    </PekuloPopover.Trigger>
                    <PekuloPopover.Content minWidth={180}>
                      <button
                        type="button"
                        onClick={() => openFor("edit", tx)}
                        style={popoverActionBtnNeutral}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => openFor("delete", tx)}
                        style={popoverActionBtnDanger}
                      >
                        Supprimer
                      </button>
                    </PekuloPopover.Content>
                  </PekuloPopover>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {activeTx && (
        <PekuloDialog open={openDialog === "edit"} onOpenChange={(o) => !o && closeAll()}>
          <PekuloDialog.Portal>
            <PekuloDialog.Overlay />
            <PekuloDialog.Content>
              <View flexDirection="column" gap="$3">
                <PekuloDialog.Title>Modifier « {activeTx.label} »</PekuloDialog.Title>
              </View>
              <TransactionEditForm transaction={activeTx} onSuccess={closeAll} />
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

      {activeTx && (
        <TransactionDeleteConfirm
          transaction={activeTx}
          open={openDialog === "delete"}
          onOpenChange={(o) => !o && closeAll()}
        />
      )}
    </Section>
  );
}
