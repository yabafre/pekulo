"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { TransactionCreateForm } from "./transaction-create-form";
import { TransactionEditForm } from "./transaction-edit-form";
import { TransactionDeleteConfirm } from "./transaction-delete-confirm";

// Flat layout — mirrors ux-preview TransactionsScreen's "Récentes" section
// (App.tsx:1360-1372): title + "Filtrer" HeaderAction (Search icon) — no
// inline "+ Ajouter" pill since the global top-bar "Nouvelle transaction"
// button is the canonical add entrypoint per ux-preview L283-300. The
// global button deep-links via /dashboard/transactions?new=1 ; this
// component reads the search param and auto-opens the create dialog.

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

type DialogKind = "create" | "edit" | "delete" | null;

export function TransactionsRecentSection() {
  const { data, isLoading, error } = useTransactions(50);
  const { data: accounts } = useAccounts();
  const [openDialog, setOpenDialog] = useState<DialogKind>(null);
  const [activeTx, setActiveTx] = useState<Transaction | null>(null);
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const accountLabelById = useMemo(() => {
    const map = new Map<string, string>();
    (accounts ?? []).forEach((a) => map.set(a.id, a.label));
    return map;
  }, [accounts]);

  // Deep-link: the top-bar "Nouvelle transaction" pill routes here with
  // ?new=1 ; auto-open the create dialog once on mount when the param is
  // present, then strip it from the URL so a refresh doesn't re-open.
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setOpenDialog("create");
      const next = new URLSearchParams(searchParams.toString());
      next.delete("new");
      router.replace(`${pathname}${next.size > 0 ? `?${next.toString()}` : ""}`, { scroll: false });
    }
  }, [searchParams, router, pathname]);

  const closeAll = () => {
    setOpenDialog(null);
    setActiveTx(null);
  };
  const openFor = (kind: Exclude<DialogKind, null | "create">, tx: Transaction) => {
    setActiveTx(tx);
    setOpenDialog(kind);
  };

  const items = data?.items ?? [];

  return (
    <Section
      ariaLabel="Récentes"
      title="Récentes"
      flat
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

      <PekuloDialog open={openDialog === "create"} onOpenChange={(o) => !o && closeAll()}>
        <PekuloDialog.Portal>
          <PekuloDialog.Overlay />
          <PekuloDialog.Content>
            <View flexDirection="column" gap="$3">
              <PekuloDialog.Title>Ajouter une transaction</PekuloDialog.Title>
              <PekuloDialog.Description>
                Renseigne le compte, la date, le libellé et le montant.
              </PekuloDialog.Description>
            </View>
            <TransactionCreateForm onSuccess={closeAll} />
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
