// apps/web/src/app/(cap)/dashboard/transactions/page.tsx
// RSC shell — mirrors ux-preview TransactionsScreen (App.tsx L1284-1374):
//   1. Stats row (Net / À confirmer / + Entrées + Sorties lg)
//   2. Suggestions IA (placeholder until 6-4)
//   3. Récentes (5-1 owner)
//
// Padding: ZERO outer padding here. `bento.module.css .main` already
// applies 24/20px mobile + 16/8px desktop ; doubling up via pekuloSpacing[4]
// (parametres precedent) reads as inset on this page. Matches
// portefeuille/immobilier shape — minimal padding on the inner wrapper.
//
// Suspense boundary required: TransactionsRecentSection consumes
// useSearchParams (?new=1 deep-link from the top-bar "Nouvelle transaction"
// pill) — without Suspense the route bails out to CSR per Next.js docs
// (next-best-practices skill, suspense-boundaries.md).

import { Suspense } from "react";
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
      <TransactionsStatsRow />
      <TransactionsSuggestionsSection />
      <Suspense fallback={null}>
        <TransactionsRecentSection />
      </Suspense>
    </div>
  );
}
