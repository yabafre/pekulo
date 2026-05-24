// apps/web/src/app/(cap)/dashboard/transactions/page.tsx
// RSC shell — delegates every read to the Client section, which subscribes
// to the zapaction queries itself so transactionsTags.list() invalidations
// propagate without a server round-trip. Mirrors parametres/page.tsx shape.

import { pekuloSpacing } from "@pekulo/ui";
import { TransactionsRecentSection } from "./_components/transactions-recent-section";

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
          maxWidth: 720,
          display: "flex",
          flexDirection: "column",
          gap: pekuloSpacing[6],
        }}
      >
        <TransactionsRecentSection />
      </div>
    </div>
  );
}
