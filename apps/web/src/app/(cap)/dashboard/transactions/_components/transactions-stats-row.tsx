"use client";

// apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-stats-row.tsx
// Mirrors ux-preview TransactionsScreen stat row (App.tsx L1297-1330):
//   - 2 cards on mobile (Net + À confirmer)
//   - 4 cards on desktop (+ Entrées + Sorties)
// Aggregates are derived over the current month from useTransactions(200).
// "À confirmer" is a placeholder (0) until story 6-x ships the LLM
// suggestions surface (FR-33).

import { useEffect, useState, type CSSProperties } from "react";
import { Text, View } from "@pekulo/ui/client";
import { Section } from "@pekulo/ui";
import { useTransactions } from "../_hooks/use-transactions";

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const signed = (n: number) => `${n >= 0 ? "+" : ""}${eur0.format(n)}`;

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 16,
};

const gridStyleLg: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 16,
};

const PLACEHOLDER = "—";

export function TransactionsStatsRow() {
  const { data } = useTransactions(200);

  // Hydration guard — same pattern as transactions-recent-section.tsx.
  // SSR has no TanStack cache and renders "+0 €"; client first paint sees
  // cached data (when present) and renders real numbers → React 19 logs a
  // recoverable hydration mismatch. Also gates `new Date()` so the
  // current-month filter agrees across server / client at month boundaries.
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => setIsHydrated(true), []);

  const items = data?.items ?? [];

  // All time-dependent + cache-dependent derivations live behind the hydration
  // guard. Before mount we render a stable PLACEHOLDER so the SSR HTML matches
  // the first client paint exactly.
  let monthLabel = PLACEHOLDER;
  let netLabel = PLACEHOLDER;
  let netColor: "$success" | "$danger" | "$color" = "$color";
  let inflowLabel = PLACEHOLDER;
  let outflowLabel = PLACEHOLDER;

  if (isHydrated) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const inMonth = items.filter((t) => {
      const d = new Date(t.occurredOn);
      return d.getFullYear() === y && d.getMonth() === m;
    });
    const totalInflow = inMonth
      .filter((t) => t.type === "inflow")
      .reduce((s, t) => s + t.amount, 0);
    const totalOutflow = inMonth
      .filter((t) => t.type === "outflow")
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const net = totalInflow - totalOutflow;
    monthLabel = now.toLocaleDateString("fr-FR", { month: "long" }).toLowerCase().slice(0, 3);
    netLabel = signed(net);
    netColor = net >= 0 ? "$success" : "$danger";
    inflowLabel = eur0.format(totalInflow);
    outflowLabel = eur0.format(totalOutflow);
  }
  // Placeholder until 6-x — count of LLM suggestions awaiting confirmation.
  const pendingCount = 0;

  return (
    <>
      <View display="block" $lg={{ display: "none" }}>
        <div style={gridStyle}>
          <Section ariaLabel="Net du mois">
            <Text color="$colorTertiary" fontSize="$caption">
              Net · {monthLabel}
            </Text>
            <Text marginTop="$2" fontSize="$h2" fontWeight="600" color={netColor}>
              {netLabel}
            </Text>
          </Section>
          <Section ariaLabel="En attente IA">
            <Text color="$colorTertiary" fontSize="$caption">
              À confirmer
            </Text>
            <View flexDirection="row" alignItems="baseline" gap="$2" marginTop="$2">
              <Text fontSize="$h2" fontWeight="600" color="$color">
                {pendingCount}
              </Text>
              <Text color="$colorTertiary" fontSize="$caption">
                suggestions
              </Text>
            </View>
          </Section>
        </div>
      </View>
      <View display="none" $lg={{ display: "block" }}>
        <div style={gridStyleLg}>
          <Section ariaLabel="Net du mois">
            <Text color="$colorTertiary" fontSize="$caption">
              Net · {monthLabel}
            </Text>
            <Text marginTop="$2" fontSize="$h2" fontWeight="600" color={netColor}>
              {netLabel}
            </Text>
          </Section>
          <Section ariaLabel="En attente IA">
            <Text color="$colorTertiary" fontSize="$caption">
              À confirmer
            </Text>
            <View flexDirection="row" alignItems="baseline" gap="$2" marginTop="$2">
              <Text fontSize="$h2" fontWeight="600" color="$color">
                {pendingCount}
              </Text>
              <Text color="$colorTertiary" fontSize="$caption">
                suggestions
              </Text>
            </View>
          </Section>
          <Section ariaLabel="Entrées du mois">
            <Text color="$colorTertiary" fontSize="$caption">
              Entrées · {monthLabel}
            </Text>
            <Text marginTop="$2" fontSize="$h2" fontWeight="600" color="$color">
              {inflowLabel}
            </Text>
          </Section>
          <Section ariaLabel="Sorties du mois">
            <Text color="$colorTertiary" fontSize="$caption">
              Sorties · {monthLabel}
            </Text>
            <Text marginTop="$2" fontSize="$h2" fontWeight="600" color="$color">
              {outflowLabel}
            </Text>
          </Section>
        </div>
      </View>
    </>
  );
}
