"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { parseAsInteger, useQueryState } from "nuqs";
import { Text, View } from "@pekulo/ui/client";
import {
  CategoryIcon,
  HeaderAction,
  PekuloActivityRow,
  PekuloDialog,
  PekuloPagination,
  PekuloPopover,
  PekuloSkeleton,
  Section,
  TransactionLogo,
  pekuloFontSizes,
  pekuloRadius,
  useToast,
} from "@pekulo/ui";
import { MoreHorizontal, Search, Upload } from "lucide-react";
import { TRANSACTION_CATEGORY_LABELS, type Transaction } from "@pekulo/validators";
import type { Activity } from "@pekulo/types";
import { useAccounts } from "../../_accounts/_hooks/use-accounts";
import { useTransactions } from "../_hooks/use-transactions";
import { useMonthScope } from "./month-scope-context";
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

// "Récentes" uses numbered OFFSET pagination, 10 rows/page (story 6-9 ext),
// mirroring the Suggestions IA section. The active page lives in the URL
// (?page via nuqs) so it is shareable + back-button-correct; listTransactions
// returns totalCount in page mode to derive the page count.
const PAGE_SIZE = 10;

export function TransactionsRecentSection() {
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const { month } = useMonthScope();
  const { data, isLoading, error } = useTransactions(PAGE_SIZE, month ?? undefined, page);
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
  const totalCount = data?.totalCount ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  // Clamp when the current page falls past the end (switching to a month with
  // fewer pages, or deleting the last rows). Guard on `data`: an un-cached page
  // is briefly undefined → totalCount 0 → pageCount 1, which would otherwise
  // yank the user back to page 1 on every navigation.
  useEffect(() => {
    if (data && page > pageCount) void setPage(pageCount);
  }, [data, page, pageCount, setPage]);

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
            // Story 6-8 (DR-13) — every row shows its category icon as an
            // inline caption prefix (14 px / colorTertiary / aria-hidden so SR
            // readers announce only the category label). 'transfer' resolves to
            // ArrowLeftRight via CATEGORY_ICONS, preserving story 5-3 AC-8.
            const categoryPrefix = (
              <CategoryIcon
                category={tx.category}
                size={14}
                color="var(--colorTertiary)"
                style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }}
              />
            );
            return (
              <View key={tx.id} role="listitem" flexDirection="row" alignItems="center" gap="$3">
                <View flex={1} minWidth={0}>
                  <PekuloActivityRow
                    tx={activity}
                    categoryPrefix={categoryPrefix}
                    logo={<TransactionLogo src={tx.logoUrl} category={tx.category} />}
                  />
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

      {!showLoading && pageCount > 1 && (
        <PekuloPagination
          page={page}
          pageCount={pageCount}
          onPageChange={(p) => void setPage(p)}
          ariaLabel="Pagination des transactions"
        />
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
