"use client";
// apps/web/src/app/(cap)/dashboard/_components/composition-section.tsx
// Story 7-2 (FR-43, AC-9) — the shared Composition widget. Derives the three
// wealth rows (Liquide / Placements / Immobilier) from the dashboard overview,
// each with its share-of-total %. Skeleton while loading; empty state when the
// user has no wealth yet. `variant` switches between the bento card (desktop)
// and a flat section (mobile / Patrimoine view) — same body either way.
import { useTranslations } from "next-intl";
import { PekuloCompositionRow, PekuloSkeleton, Section } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { useDashboardOverview } from "../_hooks/use-dashboard-overview";

// Story 8-2 i18n sweep — the three wealth buckets. `labelKey` resolves to a
// dashboard.composition.* message so the row labels follow the active locale
// (the literal French strings here previously leaked in the EN locale).
const ROWS = [
  { key: "liquideEur", labelKey: "liquide" },
  { key: "placementsEur", labelKey: "placements" },
  { key: "immobilierEur", labelKey: "immobilier" },
] as const;

export function CompositionSection({ variant = "flat" }: { variant?: "flat" | "card" }) {
  const t = useTranslations("dashboard.composition");
  const { data, isLoading } = useDashboardOverview();
  const body =
    isLoading || !data ? (
      <PekuloSkeleton lines={3} height={40} />
    ) : data.totalWealthEur <= 0 ? (
      <Text color="$colorTertiary" fontSize="$caption">
        {t("empty")}
      </Text>
    ) : (
      <View flexDirection="column">
        {ROWS.map(({ key, labelKey }) => {
          const amount = data.composition[key];
          const pct = data.totalWealthEur > 0 ? amount / data.totalWealthEur : 0;
          return <PekuloCompositionRow key={key} label={t(labelKey)} amount={amount} pct={pct} />;
        })}
      </View>
    );
  if (variant === "card") {
    return (
      <Section title={t("title")} ariaLabel={t("ariaLabel")}>
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
        {t("title")}
      </Text>
      {body}
    </View>
  );
}
