"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
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
import type { Transaction } from "@pekulo/validators";
import { userErrorMessage } from "@/lib/user-error-message";
import { useAccounts } from "../../_accounts/_hooks/use-accounts";
import { txToActivity } from "../../_lib/to-activity";
import { useTransactions } from "../_hooks/use-transactions";
import { useMonthScope } from "./month-scope-context";
import { CsvImportForm } from "./csv-import-form";
import { TransactionEditForm } from "./transaction-edit-form";
import { TransactionDeleteConfirm } from "./transaction-delete-confirm";
import { AiTransparencyNotice } from "../../_llm/_components/ai-transparency-notice";
import { usePendingSuggestions } from "../_hooks/use-pending-suggestions";

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

// Inline "Réessayer" pill shown next to a load-error message — muted-pill
// treatment via DS tokens (no hardcoded colours), matching accounts-section.
const retryBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
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

// Story 6-7 (FR-33 amended) — an AUTO-APPLIED (not yet user-edited) row: the
// final category still equals the machine suggestion. A manual edit changes
// `category` (suggested_* untouched on edit) → the predicate goes false and the
// "· IA" hint disappears (AC-6). 'autre' rows and pending suggestions
// (category === 'autre') are excluded.
function isAiApplied(tx: Transaction): boolean {
  return (
    tx.category !== "autre" && tx.suggestedCategory != null && tx.category === tx.suggestedCategory
  );
}

export function TransactionsRecentSection() {
  const t = useTranslations();
  const [rawPage, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  // A malformed ?page=0 / ?page=-3 clamps to page 1 rather than silently
  // dropping into cursor mode (a falsy page → unscoped window, no totalCount).
  const page = rawPage < 1 ? 1 : rawPage;
  const { month } = useMonthScope();
  // Gate on the resolved month so the list does not fire a throwaway no-month
  // request while MonthScopeProvider resolves the active month (aped-debug
  // 2026-06-03 — load-time double-fetch).
  const { data, isLoading, error, refetch } = useTransactions(
    PAGE_SIZE,
    month ?? undefined,
    page,
    month != null,
  );
  // Story 6-7 — the AI notice shows for an auto-applied batch ONLY when there
  // are no pending suggestions (the suggestions section owns the notice in the
  // pending case). This guarantees exactly one notice renders (no double-banner
  // on a first visit that has both pending + applied rows).
  const { data: pendingData } = usePendingSuggestions(
    1,
    undefined,
    month ?? undefined,
    month != null,
  );
  const pendingTotal = pendingData?.totalCount ?? 0;
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

  // Reset to page 1 when the user navigates to a different month, so prev/next
  // never lands them on a deep page of the newly-selected month. The ref tracks
  // the previous month so the initial mount AND the null→server-resolved seed
  // don't reset — a deep link `?month=2026-02&page=3` keeps page 3. The reset
  // uses nuqs' default "replace" history mode, so Back still restores the prior
  // month+page that setMonth pushed.
  const prevMonthRef = useRef(month);
  useEffect(() => {
    if (prevMonthRef.current !== null && month !== null && month !== prevMonthRef.current) {
      void setPage(1);
    }
    prevMonthRef.current = month;
  }, [month, setPage]);

  return (
    <Section
      ariaLabel={t("transactions.recentTitle")}
      title={t("transactions.recentTitle")}
      action={
        <View flexDirection="row" gap="$2">
          <HeaderAction
            icon={Upload}
            label={t("transactions.import")}
            onPress={() => setCsvImportOpen(true)}
          />
          <HeaderAction
            icon={Search}
            label={t("transactions.filter")}
            onPress={() => toast.info(t("transactions.soon"), t("transactions.filterSoon"))}
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
            {t("transactions.loading")}
          </Text>
          <PekuloSkeleton lines={3} height={48} />
        </View>
      )}
      {error && !showLoading && (
        <View role="alert" flexDirection="column" gap="$2" alignItems="flex-start">
          <Text color="$danger" fontSize="$caption">
            {userErrorMessage(error, "transactions")}
          </Text>
          <button type="button" onClick={() => void refetch()} style={retryBtn}>
            {t("transactions.retry")}
          </button>
        </View>
      )}
      {!showLoading && !error && items.length === 0 && (
        <Text color="$colorTertiary" fontSize="$caption">
          {t("transactions.empty")}
        </Text>
      )}

      {!showLoading && items.length > 0 && (
        <>
          {items.some(isAiApplied) && pendingTotal === 0 ? <AiTransparencyNotice /> : null}
          <View flexDirection="column" role="list" aria-label={t("transactions.listAria")}>
            {items.map((tx) => {
              const activity = txToActivity(tx, accountLabelById.get(tx.accountId) ?? "—");
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
                      aiApplied={isAiApplied(tx)}
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
                      aria-label={t("transactions.editRowAria", { label: tx.label })}
                    >
                      {t("transactions.edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => openFor("delete", tx)}
                      style={dangerRowActionBtn}
                      aria-label={t("transactions.deleteRowAria", { label: tx.label })}
                    >
                      {t("transactions.delete")}
                    </button>
                  </View>
                  <View marginLeft="$2" $lg={{ display: "none" }}>
                    <PekuloPopover>
                      <PekuloPopover.Trigger
                        style={kebabBtn}
                        aria-label={t("transactions.actionsRowAria", { label: tx.label })}
                      >
                        <MoreHorizontal size={18} strokeWidth={2} aria-hidden />
                      </PekuloPopover.Trigger>
                      <PekuloPopover.Content minWidth={180}>
                        <button
                          type="button"
                          onClick={() => openFor("edit", tx)}
                          style={popoverActionBtnNeutral}
                        >
                          {t("transactions.edit")}
                        </button>
                        <button
                          type="button"
                          onClick={() => openFor("delete", tx)}
                          style={popoverActionBtnDanger}
                        >
                          {t("transactions.delete")}
                        </button>
                      </PekuloPopover.Content>
                    </PekuloPopover>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}

      {!showLoading && pageCount > 1 && (
        <PekuloPagination
          page={page}
          pageCount={pageCount}
          onPageChange={(p) => void setPage(p)}
          ariaLabel={t("transactions.paginationAria")}
        />
      )}

      {activeTx && (
        <PekuloDialog open={openDialog === "edit"} onOpenChange={(o) => !o && closeAll()}>
          <PekuloDialog.Portal>
            <PekuloDialog.Overlay />
            <PekuloDialog.Content>
              <View flexDirection="column" gap="$3">
                <PekuloDialog.Title>
                  {t("transactions.editTitle", { label: activeTx.label })}
                </PekuloDialog.Title>
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
                    {t("common.cancel")}
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
