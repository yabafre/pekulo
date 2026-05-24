// apps/web/src/app/(cap)/dashboard/transactions/page.tsx
// RSC shell — mirrors ux-preview TransactionsScreen (App.tsx L1284-1374):
//   1. Stats row (Net / À confirmer / + Entrées + Sorties lg)
//   2. Suggestions IA (placeholder until 6-4)
//   3. Récentes (5-1 owner)
// Each child is a Client component subscribing to the relevant zapaction
// queries — tag-invalidations propagate without a server round-trip.

import { pekuloSpacing } from "@pekulo/ui";
import { TransactionsRecentSection } from "./_components/transactions-recent-section";
import { TransactionsStatsRow } from "./_components/transactions-stats-row";
import { TransactionsSuggestionsSection } from "./_components/transactions-suggestions-section";

export default function TransactionsPage() {
  return (
    <div
      style={{
        display: "flex",
        padding: pekuloSpacing[4],
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 960,
          display: "flex",
          flexDirection: "column",
          gap: pekuloSpacing[6],
        }}
      >
        <TransactionsStatsRow />
        <TransactionsSuggestionsSection />
        <TransactionsRecentSection />
      </div>
    </div>
  );
}
