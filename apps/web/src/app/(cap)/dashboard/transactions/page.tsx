// apps/web/src/app/(cap)/dashboard/transactions/page.tsx
// RSC shell — story 6-9 (FR-64) wraps the month-scoped subtree in the
// MonthScopeProvider (URL ?month= via nuqs) under a single <Suspense> boundary.
// The provider reads useSearchParams (through nuqs) → Next.js requires a
// Suspense ancestor on the consuming subtree or the whole route bails to CSR
// (lesson 2026-05-26; the cap-shell already consumes ?tab one layer up). The
// pre-6-9 page wrapped only Récentes; now the navigator + stats + Récentes all
// share the provider, so the boundary moves up to wrap all three. Stats + Récentes
// already render placeholders/skeletons until hydration, so moving them under
// Suspense is consistent with their existing SSR output. The Suggestions IA
// section is month-agnostic but lives inside the provider for layout order.
//
// <NuqsAdapter> is installed once at the app root (layout.tsx).

import { Suspense } from "react";
import { MonthNavigator } from "./_components/month-navigator";
import { MonthScopeProvider } from "./_components/month-scope-context";
import { TransactionsRecentSection } from "./_components/transactions-recent-section";
import { TransactionsStatsRow } from "./_components/transactions-stats-row";
import { TransactionsSuggestionsSection } from "./_components/transactions-suggestions-section";

export default function TransactionsPage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        padding: "8px 4px 0",
        width: "100%",
      }}
    >
      <Suspense fallback={null}>
        <MonthScopeProvider>
          <MonthNavigator />
          <TransactionsStatsRow />
          <TransactionsSuggestionsSection />
          <TransactionsRecentSection />
        </MonthScopeProvider>
      </Suspense>
    </div>
  );
}
