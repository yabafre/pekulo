"use client";
// apps/web/src/app/(cap)/dashboard/_components/composition-section.tsx
// Story 7-2 (FR-43, AC-9) — the shared Composition widget. Derives the three
// wealth rows (Liquide / Placements / Immobilier) from the dashboard overview,
// each with its share-of-total %. Skeleton while loading; empty state when the
// user has no wealth yet. `variant` switches between the bento card (desktop)
// and a flat section (mobile / Patrimoine view) — same body either way.
import { PekuloCompositionRow, PekuloSkeleton, Section } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { useDashboardOverview } from "../_hooks/use-dashboard-overview";

const ROWS = [
  { key: "liquideEur", label: "Liquide" },
  { key: "placementsEur", label: "Placements" },
  { key: "immobilierEur", label: "Immobilier" },
] as const;

export function CompositionSection({ variant = "flat" }: { variant?: "flat" | "card" }) {
  const { data, isLoading } = useDashboardOverview();
  const body =
    isLoading || !data ? (
      <PekuloSkeleton lines={3} height={40} />
    ) : data.totalWealthEur <= 0 ? (
      <Text color="$colorTertiary" fontSize="$caption">
        Aucune donnée de patrimoine pour l'instant.
      </Text>
    ) : (
      <View flexDirection="column">
        {ROWS.map(({ key, label }) => {
          const amount = data.composition[key];
          const pct = data.totalWealthEur > 0 ? amount / data.totalWealthEur : 0;
          return <PekuloCompositionRow key={key} label={label} amount={amount} pct={pct} />;
        })}
      </View>
    );
  if (variant === "card") {
    return (
      <Section title="Composition" ariaLabel="Composition du patrimoine">
        {body}
      </Section>
    );
  }
  return (
    <View render="section" aria-labelledby="comp-h" flexDirection="column">
      <Text
        id="comp-h"
        render="h2"
        color="$color"
        fontSize="$h3"
        fontWeight="600"
        marginBottom="$3"
        $lg={{ fontSize: "$h2" }}
      >
        Composition
      </Text>
      {body}
    </View>
  );
}
