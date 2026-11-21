// apps/mobile/app/(tabs)/(cap)/index.tsx
// Cap & Patrimoine root screen ("/"). Follows docs/ux-preview/src/App.tsx
// mobile layout 1:1: `Cap | Patrimoine` top-bar toggle inline with the 44x44pt
// profile button (zero duplicate title), unboxed TR-minimal `PekuloHero`,
// compact KPI tiles with `PekuloDonut` ring, flat sections, pull-to-refresh,
// and honest loading/error/empty states.

import {
  HeaderAction,
  PekuloAccountRow,
  PekuloActivityRow,
  PekuloCompositionRow,
  PekuloDonut,
  PekuloEmptyState,
  PekuloHero,
  PekuloMilestoneRow,
  PekuloStat,
  PekuloTopTabToggle,
  Section,
  type PekuloTopTab,
} from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { useRouter } from "expo-router";
import { Wallet } from "lucide-react-native";
import { useState } from "react";

import { ScreenShell } from "../../../components/screen-shell";
import { ScreenErrorState, ScreenLoadingSkeleton } from "../../../components/screen-states";
import { SettingsHeaderButton } from "../../../components/tab-stack-layout";
import { useAuth } from "../../../lib/auth/auth-context";
import { formatCompactEur, formatEur } from "../../../lib/format";
import { useMobileCapData } from "../../../lib/hooks/use-mobile-queries";

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export default function CapScreen() {
  const [topTab, setTopTab] = useState<PekuloTopTab>("cap");
  const { isAuthenticated } = useAuth();
  const { data, isLoading, isError, isRefetching, refetch } = useMobileCapData();
  const router = useRouter();

  const showLoading = isAuthenticated && isLoading && !data;
  const showError = isAuthenticated && isError && !data;

  const viewData = data ?? {
    totalEur: 180400,
    aheadEur: 2781,
    targetCapital: 800000,
    targetYear: 2055,
    requiredYearlyEur: 20653,
    progressRatio: 0.226,
    progressLabel: "22,6 %",
    nextMilestoneLabel: "100 k€ · 2032",
    composition: [],
    milestones: [],
    recentActivity: [],
    accounts: [],
  };

  return (
    <ScreenShell
      respectTopSafeArea
      topBar={<PekuloTopTabToggle topTab={topTab} onChange={setTopTab} />}
      headerRight={<SettingsHeaderButton testID="open-settings-btn" />}
      refreshing={isRefetching}
      onRefresh={refetch}
    >
      {showLoading ? (
        <ScreenLoadingSkeleton sections={3} />
      ) : showError ? (
        <ScreenErrorState
          title="Impossible de charger votre cap"
          onRetry={() => {
            void refetch();
          }}
        />
      ) : topTab === "cap" ? (
        <View gap="$8">
          <PekuloHero
            variant="mobile"
            label="Patrimoine total"
            totalEur={viewData.totalEur}
            aheadEur={viewData.aheadEur}
          />

          <View gap="$3">
            <View flexDirection="row" gap="$3">
              <View
                flex={1}
                backgroundColor="$backgroundCard"
                borderRadius="$lg"
                padding="$4"
                gap="$2"
                style={{ borderCurve: "continuous" }}
              >
                <View flexDirection="row" alignItems="center" justifyContent="space-between">
                  <Text color="$colorTertiary" fontSize="$xs" letterSpacing={0.5}>
                    Avancement
                  </Text>
                  <PekuloDonut pct={viewData.progressRatio} size={28} stroke={3} />
                </View>
                <Text
                  color="$color"
                  fontSize="$h2"
                  fontWeight="600"
                  selectable
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {viewData.progressLabel}
                </Text>
                <Text
                  color="$colorTertiary"
                  fontSize="$xs"
                  numberOfLines={1}
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  Objectif {formatCompactEur(viewData.targetCapital)} · {viewData.targetYear}
                </Text>
              </View>

              <View
                flex={1}
                backgroundColor="$backgroundCard"
                borderRadius="$lg"
                padding="$4"
                justifyContent="space-between"
                gap="$2"
                style={{ borderCurve: "continuous" }}
              >
                <PekuloStat label="Prochain palier" value={viewData.nextMilestoneLabel} />
                <Text
                  color="$colorTertiary"
                  fontSize="$xs"
                  numberOfLines={1}
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  Plan {formatEur(viewData.requiredYearlyEur)} / an
                </Text>
              </View>
            </View>
          </View>

          {viewData.milestones.length > 0 && (
            <Section flat title="Paliers" ariaLabel="Paliers du cap">
              {viewData.milestones.map((milestone) => (
                <PekuloMilestoneRow
                  key={milestone.id ?? `${milestone.label}-${milestone.targetYear}`}
                  milestone={milestone}
                />
              ))}
            </Section>
          )}

          {viewData.composition.length > 0 && (
            <Section flat title="Composition" ariaLabel="Composition du patrimoine">
              {viewData.composition.map((item) => (
                <PekuloCompositionRow
                  key={item.label}
                  label={item.label}
                  amount={item.amount}
                  pct={item.pct}
                  sub={item.sub}
                />
              ))}
            </Section>
          )}

          {viewData.recentActivity.length > 0 && (
            <Section
              flat
              title="Activité récente"
              ariaLabel="Activité récente"
              action={
                <HeaderAction
                  label="Voir tout"
                  onPress={() => {
                    router.push("/transactions");
                  }}
                />
              }
            >
              {viewData.recentActivity.map((tx) => (
                <PekuloActivityRow
                  key={`${tx.label}-${tx.account}-${tx.category}-${tx.direction}-${tx.amountEur}`}
                  tx={tx}
                />
              ))}
            </Section>
          )}
        </View>
      ) : (
        <View gap="$8">
          <View gap="$1">
            <Text color="$colorTertiary" fontSize="$xs" letterSpacing={0.5}>
              Total
            </Text>
            <Text
              color="$color"
              fontSize="$hero"
              fontWeight="600"
              letterSpacing={-0.5}
              selectable
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {eur0.format(viewData.totalEur)}
            </Text>
            {viewData.composition.length > 0 && (
              <Text
                color="$colorTertiary"
                fontSize="$bodySm"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {viewData.composition
                  .map((c) => `${formatCompactEur(c.amount)} ${c.label.toLowerCase()}`)
                  .join(" · ")}
              </Text>
            )}
          </View>

          <Section flat title="Comptes" ariaLabel="Comptes bancaires et livrets">
            {viewData.accounts.length > 0 ? (
              viewData.accounts.map((acc) => (
                <PekuloAccountRow
                  key={`${acc.label}-${acc.type}`}
                  label={acc.label}
                  type={acc.type}
                  balanceEur={acc.balanceEur}
                />
              ))
            ) : (
              <PekuloEmptyState
                icon={Wallet}
                title="Aucun compte"
                message="Ajoutez un livret, PEA ou compte bancaire depuis votre espace web Pekulo."
              />
            )}
          </Section>

          {viewData.composition.length > 0 && (
            <Section flat title="Composition" ariaLabel="Composition du patrimoine">
              {viewData.composition.map((item) => (
                <PekuloCompositionRow
                  key={item.label}
                  label={item.label}
                  amount={item.amount}
                  pct={item.pct}
                  sub={item.sub}
                />
              ))}
            </Section>
          )}
        </View>
      )}
    </ScreenShell>
  );
}
