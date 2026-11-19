// apps/mobile/app/(tabs)/(cap)/index.tsx
// Cap & Patrimoine root screen ("/"). Consumes `useMobileCapData()` (live oRPC
// `dashboard.getOverview`, `compass.getCompass`, `milestones.list/getStatuses`,
// `accounts.list`, with deterministic preview fallback) and renders @pekulo/ui
// native components (`PekuloTopTabToggle`, `PekuloHero`, `PekuloStat`,
// `PekuloCompositionRow`, `PekuloMilestoneRow`, `PekuloActivityRow`,
// `PekuloAccountRow`).

import {
  PekuloAccountRow,
  PekuloActivityRow,
  PekuloCompositionRow,
  PekuloHero,
  PekuloMilestoneRow,
  PekuloStat,
  PekuloTopTabToggle,
  Section,
  type PekuloTopTab,
} from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable } from "react-native";

import { ScreenShell } from "../../../components/screen-shell";
import { useMobileCapData } from "../../../lib/hooks/use-mobile-queries";

function SettingsAvatarLink() {
  return (
    <Link href="/parametres" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ouvrir les paramètres"
        hitSlop={8}
        testID="open-settings-btn"
      >
        <View
          width={36}
          height={36}
          borderRadius="$full"
          backgroundColor="$backgroundMuted"
          alignItems="center"
          justifyContent="center"
        >
          <Text color="$color" fontSize="$bodySm" fontWeight="600">
            A
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

export default function CapScreen() {
  const [topTab, setTopTab] = useState<PekuloTopTab>("cap");
  const { data } = useMobileCapData();

  const viewData = data ?? {
    totalEur: 180400,
    aheadEur: 2781,
    targetCapital: 800000,
    targetYear: 2055,
    requiredYearlyEur: 20653,
    progressLabel: "22,6 %",
    nextMilestoneLabel: "100 k€ · 2032",
    composition: [],
    milestones: [],
    recentActivity: [],
    accounts: [],
  };

  return (
    <ScreenShell
      title="Cap"
      subtitle="Trajectoire vers votre objectif patrimonial"
      headerRight={<SettingsAvatarLink />}
    >
      <PekuloTopTabToggle topTab={topTab} onChange={setTopTab} />

      {topTab === "cap" ? (
        <View gap="$5">
          <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$5">
            <PekuloHero
              variant="card"
              totalEur={viewData.totalEur}
              aheadEur={viewData.aheadEur}
              targetCapital={viewData.targetCapital}
              targetYear={viewData.targetYear}
              requiredYearlyEur={viewData.requiredYearlyEur}
            />
            <View flexDirection="row" gap="$4">
              <View flex={1}>
                <PekuloStat label="Avancement" value={viewData.progressLabel} />
              </View>
              <View flex={1}>
                <PekuloStat label="Prochain palier" value={viewData.nextMilestoneLabel} />
              </View>
            </View>
          </View>

          {viewData.milestones.length > 0 && (
            <Section title="Paliers" ariaLabel="Paliers du cap">
              {viewData.milestones.map((milestone) => (
                <PekuloMilestoneRow
                  key={milestone.id ?? `${milestone.label}-${milestone.targetYear}`}
                  milestone={milestone}
                />
              ))}
            </Section>
          )}

          {viewData.composition.length > 0 && (
            <Section title="Composition" ariaLabel="Composition du patrimoine">
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
            <Section title="Activité récente" ariaLabel="Activité récente">
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
        <View gap="$5">
          <Section title="Comptes" ariaLabel="Comptes bancaires et livrets">
            {viewData.accounts.map((acc) => (
              <PekuloAccountRow
                key={`${acc.label}-${acc.type}`}
                label={acc.label}
                type={acc.type}
                balanceEur={acc.balanceEur}
              />
            ))}
          </Section>

          {viewData.composition.length > 0 && (
            <Section title="Composition" ariaLabel="Composition du patrimoine">
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
