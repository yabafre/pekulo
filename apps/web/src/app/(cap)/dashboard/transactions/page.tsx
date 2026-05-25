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
// Suspense boundary required: cap-shell.tsx consumes useSearchParams
// (tab=patrimoine query param threading) one layer up. Next.js requires
// any route ancestor of a useSearchParams reader to render under Suspense,
// otherwise the entire route bails to CSR (next-best-practices skill,
// suspense-boundaries.md). Wrapping TransactionsRecentSection — the
// heaviest data subtree below the shell — keeps SSR for the Stats and
// Suggestions sections while satisfying the framework rule. Note: the
// previous comment claimed `?new=1` deep-link was the trigger ; that
// path was removed in 902f4d3 when the dialog lifted to cap-shell.

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
