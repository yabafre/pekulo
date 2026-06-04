"use client";
// apps/web/src/app/(cap)/dashboard/_components/hero-anchor.tsx
// Story 7-2 (FR-41, AC-1, AC-8) — the Cap-view anchor: the headline wealth
// figure + the next-milestone line. The headline is the 7-1 TOTAL-WEALTH
// aggregate (cash + FX holdings + net real-estate equity), NOT the compass
// current-wealth figure (AC-8). The compass donut % lives in the adjacent
// compass widget; here we add only the wealth headline + "Prochain palier".
// `card` adds the Cap-objectif + Plan/an mini-dl (desktop bento card).
import { PekuloCountUpEUR, PekuloSkeleton } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { useDashboardOverview } from "../_hooks/use-dashboard-overview";
import { useCapDashboardState } from "../_compass/_components/compass-section";
import { useMilestoneStatuses } from "../_hooks/use-milestone-statuses";
import { selectNextMilestone } from "../_lib/select-next-milestone";

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const eurCompact = new Intl.NumberFormat("fr-FR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function HeroAnchor({ variant = "mobile" }: { variant?: "mobile" | "card" }) {
  const { data: overview, isLoading } = useDashboardOverview();
  const cap = useCapDashboardState();
  const currentWealth = cap?.currentWealth ?? 0;
  const { data: statuses } = useMilestoneStatuses(currentWealth, { enabled: cap != null });
  const next = selectNextMilestone(statuses);

  // Plan/an = the remaining gap spread linearly over the cap horizon. The
  // donut % itself is owned by the adjacent compass widget. objectif/horizon
  // are optional on the cap state (null until the compass progress resolves).
  const objectif = cap?.compassObjectif ?? null;
  const horizon = cap?.compassHorizonYears ?? null;
  const gap = cap && objectif != null ? Math.max(0, objectif - cap.currentWealth) : 0;
  const requiredYearly = horizon != null && horizon > 0 ? gap / horizon : null;

  return (
    <View
      render="section"
      aria-label="Patrimoine total"
      flexDirection="column"
      flex={variant === "card" ? 1 : undefined}
      justifyContent={variant === "card" ? "space-between" : undefined}
    >
      <View flexDirection="column">
        <Text color="$colorTertiary" fontSize="$caption">
          Patrimoine total
        </Text>

        {isLoading || !overview ? (
          <View marginTop="$2">
            <PekuloSkeleton block width={220} height={40} />
          </View>
        ) : (
          <PekuloCountUpEUR
            value={overview.totalWealthEur}
            color="$color"
            fontSize="$h1"
            fontWeight="600"
            letterSpacing={-0.5}
            marginTop="$2"
          />
        )}

        {next != null ? (
          <Text color="$colorTertiary" fontSize="$bodySm" marginTop="$2">
            Prochain palier · +{eur0.format(next.deltaEur)} à atteindre
          </Text>
        ) : null}
      </View>

      {variant === "card" && objectif != null ? (
        <View flexDirection="row" gap="$6" marginTop="$4">
          <View flexDirection="column">
            <Text color="$colorTertiary" fontSize="$caption">
              Cap
            </Text>
            <Text color="$color" fontSize="$bodySm" fontWeight="600">
              {eur0.format(objectif)}
            </Text>
          </View>
          {requiredYearly != null ? (
            <View flexDirection="column">
              <Text color="$colorTertiary" fontSize="$caption">
                Plan / an
              </Text>
              <Text color="$color" fontSize="$bodySm" fontWeight="600">
                {eurCompact.format(requiredYearly)} €
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
