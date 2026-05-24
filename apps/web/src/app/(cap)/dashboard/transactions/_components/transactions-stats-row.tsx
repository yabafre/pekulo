"use client";

// apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-stats-row.tsx
// Mirrors ux-preview TransactionsScreen stat row (App.tsx L1297-1330):
//   - 2 cards on mobile (Net + À confirmer)
//   - 4 cards on desktop (+ Entrées + Sorties)
// Aggregates are derived over the current month from useTransactions(50).
// "À confirmer" is a placeholder (0) until story 6-x ships the LLM
// suggestions surface (FR-33).

import type { CSSProperties } from "react";
import { Text, View } from "@pekulo/ui/client";
import { Section } from "@pekulo/ui";
import { useTransactions } from "../_hooks/use-transactions";

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const signed = (n: number) => `${n >= 0 ? "+" : ""}${eur0.format(n)}`;

const currentMonthLabel = () =>
  new Date().toLocaleDateString("fr-FR", { month: "long" }).toLowerCase().slice(0, 3);

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

export function TransactionsStatsRow() {
  const { data } = useTransactions(200);
  const items = data?.items ?? [];

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const inMonth = items.filter((t) => {
    const d = new Date(t.occurredOn);
    return d.getFullYear() === y && d.getMonth() === m;
  });
  const totalInflow = inMonth.filter((t) => t.type === "inflow").reduce((s, t) => s + t.amount, 0);
  const totalOutflow = inMonth
    .filter((t) => t.type === "outflow")
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const net = totalInflow - totalOutflow;
  const monthLabel = currentMonthLabel();
  // Placeholder until 6-x — count of LLM suggestions awaiting confirmation.
  const pendingCount = 0;

  return (
    <>
      <View display="block" $lg={{ display: "none" }}>
        <div style={gridStyle}>
          <Section ariaLabel="Net du mois" flat>
            <Text color="$colorTertiary" fontSize="$caption">
              Net · {monthLabel}
            </Text>
            <Text
              marginTop="$2"
              fontSize="$h2"
              fontWeight="600"
              color={net >= 0 ? "$success" : "$danger"}
            >
              {signed(net)}
            </Text>
          </Section>
          <Section ariaLabel="En attente IA" flat>
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
          <Section ariaLabel="Net du mois" flat>
            <Text color="$colorTertiary" fontSize="$caption">
              Net · {monthLabel}
            </Text>
            <Text
              marginTop="$2"
              fontSize="$h2"
              fontWeight="600"
              color={net >= 0 ? "$success" : "$danger"}
            >
              {signed(net)}
            </Text>
          </Section>
          <Section ariaLabel="En attente IA" flat>
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
          <Section ariaLabel="Entrées du mois" flat>
            <Text color="$colorTertiary" fontSize="$caption">
              Entrées · {monthLabel}
            </Text>
            <Text marginTop="$2" fontSize="$h2" fontWeight="600" color="$color">
              {eur0.format(totalInflow)}
            </Text>
          </Section>
          <Section ariaLabel="Sorties du mois" flat>
            <Text color="$colorTertiary" fontSize="$caption">
              Sorties · {monthLabel}
            </Text>
            <Text marginTop="$2" fontSize="$h2" fontWeight="600" color="$color">
              {eur0.format(totalOutflow)}
            </Text>
          </Section>
        </div>
      </View>
    </>
  );
}
