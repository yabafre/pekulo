"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Text, View } from "@pekulo/ui/client";
import {
  HeaderAction,
  PekuloActivityRow,
  PekuloButton,
  PekuloDialog,
  PekuloPopover,
  PekuloSkeleton,
  Section,
  pekuloFontSizes,
  pekuloRadius,
  useToast,
} from "@pekulo/ui";
import { ArrowLeftRight, MoreHorizontal, Search, Upload } from "lucide-react";
import { TRANSACTION_CATEGORY_LABELS, type Transaction } from "@pekulo/validators";
import type { Activity } from "@pekulo/types";
import { useAccounts } from "../../_accounts/_hooks/use-accounts";
import { useTransactions } from "../_hooks/use-transactions";
import { CsvImportForm } from "./csv-import-form";
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

// "Récentes" grows the page in PAGE_STEP increments up to the listTransactions
// contract cap (LIST_MAX=200) via "Charger plus" — the backend already paginates
// (listByUser cursor-based, returns nextCursor). Browsing beyond 200 belongs to
// the Filtrer/search screen. Stays within zapaction (useTransactions re-reads
// with the bigger window — no raw react-query).
const PAGE_STEP = 50;
const LIST_MAX = 200;

export function TransactionsRecentSection() {
  const [limit, setLimit] = useState(PAGE_STEP);
  const { data, isLoading, isFetching, error } = useTransactions(limit);
  const { data: accounts } = useAccounts();
  const [openDialog, setOpenDialog] = useState<DialogKind>(null);
  const [activeTx, setActiveTx] = useState<Transaction | null>(null);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const toast = useToast();
  // Hydration guard — TanStack Query keeps in-memory cache between visits ;
  // SSR rendered the skeleton (no cache), client first paint sees cached
  // data and would jump straight to the list → role="status" vs role="list"
  // mismatch. Render the loading state until mounted to keep server + first
  // client render identical, then transition to real data.
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => setIsHydrated(true), []);
  const showLoading = !isHydrated || isLoading;

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
  // nextCursor present ⇒ more rows exist beyond the window; gated by LIST_MAX.
  const hasMore = Boolean(data?.nextCursor) && limit < LIST_MAX;

  return (
    <Section
      ariaLabel="Récentes"
      title="Récentes"
      action={
        <View flexDirection="row" gap="$2">
          <HeaderAction icon={Upload} label="Importer" onPress={() => setCsvImportOpen(true)} />
          <HeaderAction
            icon={Search}
            label="Filtrer"
            onPress={() => toast.info("Bientôt", "Le filtre transactions arrive plus tard.")}
          />
        </View>
      }
    >
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
          <PekuloSkeleton lines={3} height={48} />
        </View>
      )}
      {error && !showLoading && (
        <Text color="$danger" fontSize="$caption" role="alert">
          {error.message}
        </Text>
      )}
      {!showLoading && !error && items.length === 0 && (
        <Text color="$colorTertiary" fontSize="$caption">
          Aucune transaction. Ajoute la première pour démarrer le suivi mensuel.
        </Text>
      )}

      {!showLoading && items.length > 0 && (
        <View flexDirection="column" role="list" aria-label="Liste des transactions">
          {items.map((tx) => {
            const activity: Activity = {
              label: tx.label,
              account: accountLabelById.get(tx.accountId) ?? "—",
              category: TRANSACTION_CATEGORY_LABELS[tx.category],
              direction: tx.type === "inflow" ? "in" : "out",
              amountEur: tx.amount,
            };
            // Story 5-3 AC-8 — inline ⇆ ArrowLeftRight glyph prefixed to the
            // category text when the row was tagged `transfer` by the rule.
            // 14 px / colorTertiary / aria-hidden so SR readers announce only
            // the "Transfert" label, not the icon.
            const categoryPrefix =
              tx.category === "transfer" ? (
                <ArrowLeftRight
                  size={14}
                  color="var(--colorTertiary)"
                  aria-hidden
                  style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }}
                />
              ) : undefined;
            return (
              <View key={tx.id} role="listitem" flexDirection="row" alignItems="center" gap="$3">
                <View flex={1} minWidth={0}>
                  <PekuloActivityRow tx={activity} categoryPrefix={categoryPrefix} />
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

      {!showLoading && hasMore && (
        <View paddingTop="$3" alignItems="center">
          <PekuloButton
            variant="secondary"
            loading={isFetching}
            onPress={() => setLimit((l) => Math.min(LIST_MAX, l + PAGE_STEP))}
          >
            Charger plus
          </PekuloButton>
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

      <CsvImportForm open={csvImportOpen} onOpenChange={setCsvImportOpen} />
    </Section>
  );
}
