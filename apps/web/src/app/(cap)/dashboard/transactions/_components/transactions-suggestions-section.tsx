"use client";

// Suggestions IA — story 6-4 (FR-33). Mirrors ux-preview TransactionsScreen
// (App.tsx L1333-1357): a Section listing pending PekuloSuggestionRow rows with
// Confirmer / Modifier. Confirm sends the suggested category; Modifier opens a
// CategoryPicker dialog and sends the chosen one. The server decides accept vs
// override. Hydration-guarded (R13); no <Suspense> (loading via isLoading).

import { useEffect, useMemo, useState } from "react";
import { Text, View } from "@pekulo/ui/client";
import {
  CategoryPicker,
  PekuloDialog,
  PekuloEmptyState,
  PekuloPagination,
  PekuloSkeleton,
  PekuloSubmitButton,
  Section,
  PekuloSuggestionRow,
  useToast,
} from "@pekulo/ui";
import { Bot, Check } from "lucide-react";
import {
  SUGGESTABLE_TRANSACTION_CATEGORIES,
  TRANSACTION_CATEGORY_LABELS,
  type ConfirmCategorisationInput,
  type Transaction,
} from "@pekulo/validators";
import type { LlmRouteBadge, Suggestion } from "@pekulo/types";
import { useAccounts } from "../../_accounts/_hooks/use-accounts";
import { usePendingSuggestions } from "../_hooks/use-pending-suggestions";
import { useConfirmCategorisation } from "../_hooks/use-confirm-categorisation";
import { AiTransparencyNotice } from "../../_llm/_components/ai-transparency-notice";

const ROUTE_BADGE: Record<string, LlmRouteBadge> = {
  foundation_models: "ios",
  ollama: "ollama",
  third_party: "cloud",
};

const OVERRIDE_OPTIONS = SUGGESTABLE_TRANSACTION_CATEGORIES.map((c) => ({
  value: c,
  label: TRANSACTION_CATEGORY_LABELS[c],
}));

// YYYY-MM-DD → "01 mai", pinned to UTC so the day never shifts by timezone.
function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

export function TransactionsSuggestionsSection() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = usePendingSuggestions(page);
  const { data: accounts } = useAccounts();
  const confirm = useConfirmCategorisation();
  const toast = useToast();
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => setIsHydrated(true), []);
  const showLoading = !isHydrated || isLoading;

  const totalCount = data?.totalCount ?? 0;
  const pageSize = data?.pageSize ?? 10;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  // Clamp when the current page falls past the end — confirming the last row on
  // the last page shrinks the set; never leave the user stranded on a blank page.
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const [overrideTx, setOverrideTx] = useState<Transaction | null>(null);
  const [overrideCategory, setOverrideCategory] = useState<string>("courses");

  const accountLabelById = useMemo(() => {
    const map = new Map<string, string>();
    (accounts ?? []).forEach((a) => map.set(a.id, a.label));
    return map;
  }, [accounts]);

  const items = data?.items ?? [];

  const runConfirm = (id: string, category: string) => {
    confirm.mutate({ id, category } as ConfirmCategorisationInput, {
      onSuccess: (result) => {
        if (!result.ok) toast.danger("Échec", result.message);
      },
    });
  };

  const openOverride = (tx: Transaction) => {
    setOverrideCategory(tx.suggestedCategory ?? "courses");
    setOverrideTx(tx);
  };
  const closeOverride = () => setOverrideTx(null);

  return (
    <Section
      ariaLabel="Suggestions IA"
      title="Suggestions IA"
      action={
        <View flexDirection="row" alignItems="center" gap="$2">
          <Bot size={12} strokeWidth={2} aria-hidden />
          <Text color="$colorTertiary" fontSize="$caption">
            {totalCount} à valider
          </Text>
        </View>
      }
    >
      {showLoading && (
        <View role="status" aria-live="polite">
          <Text
            position="absolute"
            width={1}
            height={1}
            overflow="hidden"
            color="$colorTertiary"
            fontSize="$caption"
          >
            Chargement…
          </Text>
          <PekuloSkeleton lines={2} height={56} />
        </View>
      )}
      {error && !showLoading && (
        <Text color="$danger" fontSize="$caption" role="alert">
          {error.message}
        </Text>
      )}
      {!showLoading && !error && items.length === 0 && (
        <PekuloEmptyState
          icon={Check}
          title="Tout est catégorisé"
          message="Vos nouvelles transactions apparaîtront ici dès qu'elles seront importées."
        />
      )}
      {!showLoading && items.length > 0 && (
        <>
          <AiTransparencyNotice />
          <View flexDirection="column" role="list" aria-label="Suggestions à confirmer">
            {items.map((tx) => {
              const suggestion: Suggestion = {
                label: tx.label,
                account: accountLabelById.get(tx.accountId) ?? "—",
                dateLabel: formatDay(tx.occurredOn),
                direction: tx.type === "inflow" ? "in" : "out",
                amountEur: tx.amount,
                suggestedCategory: tx.suggestedCategory
                  ? TRANSACTION_CATEGORY_LABELS[tx.suggestedCategory]
                  : "—",
                confidence: tx.suggestedConfidence ?? 0,
                route: ROUTE_BADGE[tx.suggestedRoute ?? "ollama"] ?? "ollama",
              };
              return (
                <View key={tx.id} role="listitem">
                  <PekuloSuggestionRow
                    tx={suggestion}
                    disabled={confirm.isPending}
                    onConfirm={() =>
                      tx.suggestedCategory && runConfirm(tx.id, tx.suggestedCategory)
                    }
                    onEdit={() => openOverride(tx)}
                  />
                </View>
              );
            })}
          </View>
          <PekuloPagination
            page={page}
            pageCount={pageCount}
            onPageChange={setPage}
            ariaLabel="Pagination des suggestions"
          />
        </>
      )}

      {overrideTx && (
        <PekuloDialog open={overrideTx !== null} onOpenChange={(o) => !o && closeOverride()}>
          <PekuloDialog.Portal>
            <PekuloDialog.Overlay />
            <PekuloDialog.Content>
              <View flexDirection="column" gap="$3">
                <PekuloDialog.Title>
                  Corriger la catégorie de « {overrideTx.label} »
                </PekuloDialog.Title>
                <CategoryPicker
                  id="suggestion-override-category"
                  value={overrideCategory}
                  onValueChange={setOverrideCategory}
                  options={OVERRIDE_OPTIONS}
                />
                <form
                  aria-label="Corriger la catégorie"
                  onSubmit={(e) => {
                    e.preventDefault();
                    runConfirm(overrideTx.id, overrideCategory);
                    closeOverride();
                  }}
                >
                  <PekuloSubmitButton loading={confirm.isPending} loadingLabel="Enregistrement…">
                    Enregistrer la catégorie
                  </PekuloSubmitButton>
                </form>
                <PekuloDialog.Close asChild>
                  <View
                    render="button"
                    paddingVertical="$2"
                    cursor="pointer"
                    backgroundColor="transparent"
                    borderWidth={0}
                    alignItems="center"
                  >
                    <Text
                      color="$colorTertiary"
                      fontSize="$caption"
                      hoverStyle={{ color: "$color" }}
                    >
                      Annuler
                    </Text>
                  </View>
                </PekuloDialog.Close>
              </View>
            </PekuloDialog.Content>
          </PekuloDialog.Portal>
        </PekuloDialog>
      )}
    </Section>
  );
}
