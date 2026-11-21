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
import { Plus, Wallet } from "lucide-react-native";
import { useState } from "react";
import { Pressable } from "react-native";

import { useMutationRunner } from "../../../components/form/sheet";
import { ScreenShell } from "../../../components/screen-shell";
import { ScreenErrorState, ScreenLoadingSkeleton } from "../../../components/screen-states";
import { TabHeaderActions } from "../../../components/tab-stack-layout";
import { confirmDestructive, showActions } from "../../../lib/actions";
import { useAuth } from "../../../lib/auth/auth-context";
import { formatCompactEur, formatEur } from "../../../lib/format";
import {
  useAccountMutations,
  useMilestoneMutations,
} from "../../../lib/hooks/use-mobile-mutations";
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
  const milestoneMutations = useMilestoneMutations();
  const accountMutations = useAccountMutations();
  const { run } = useMutationRunner();

  function openCreateMenu() {
    showActions("Ajouter", [
      { label: "Nouvelle transaction", onPress: () => router.push("/sheets/transaction") },
      { label: "Nouveau palier", onPress: () => router.push("/sheets/milestone") },
      { label: "Nouveau compte", onPress: () => router.push("/sheets/account") },
    ]);
  }

  function deleteMilestone(id: string, label: string) {
    confirmDestructive({
      title: `Supprimer « ${label} » ?`,
      message: "Le palier sera retiré de votre trajectoire.",
      confirmLabel: "Supprimer",
      onConfirm: () => {
        void run(() => milestoneMutations.remove.mutateAsync({ id }), "Palier supprimé");
      },
    });
  }

  function openAccountActions(id: string, label: string) {
    showActions(label, [
      {
        label: "Mettre à jour le solde",
        onPress: () => router.push(`/sheets/account-balance?id=${id}`),
      },
      { label: "Modifier", onPress: () => router.push(`/sheets/account?id=${id}`) },
      {
        label: "Supprimer",
        destructive: true,
        onPress: () =>
          confirmDestructive({
            title: `Supprimer « ${label} » ?`,
            message: "Le compte et son historique de solde seront supprimés.",
            confirmLabel: "Supprimer",
            onConfirm: () => {
              void run(() => accountMutations.remove.mutateAsync({ id }), "Compte supprimé");
            },
          }),
      },
    ]);
  }

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
    accountEntities: [],
  };

  return (
    <ScreenShell
      respectTopSafeArea
      topBar={<PekuloTopTabToggle topTab={topTab} onChange={setTopTab} />}
      headerRight={
        <TabHeaderActions
          addLabel="Ajouter"
          onAdd={openCreateMenu}
          settingsTestID="open-settings-btn"
        />
      }
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
                  isDeleting={milestoneMutations.remove.isPending}
                  onDelete={(id) => deleteMilestone(id, milestone.label)}
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

          <Section
            flat
            title="Comptes"
            ariaLabel="Comptes bancaires et livrets"
            action={
              <HeaderAction
                icon={Plus}
                label="Ajouter"
                onPress={() => router.push("/sheets/account")}
              />
            }
          >
            {viewData.accounts.length > 0 ? (
              viewData.accounts.map((acc, index) => {
                const entity = viewData.accountEntities[index];
                return (
                  <Pressable
                    key={entity?.id ?? `${acc.label}-${acc.type}`}
                    testID={entity ? `account-row-${entity.id}` : undefined}
                    accessibilityRole="button"
                    accessibilityHint="Ouvre les actions du compte"
                    disabled={!entity}
                    onPress={() => entity && openAccountActions(entity.id, entity.label)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  >
                    <PekuloAccountRow
                      label={acc.label}
                      type={acc.type}
                      balanceEur={acc.balanceEur}
                    />
                  </Pressable>
                );
              })
            ) : (
              <PekuloEmptyState
                icon={Wallet}
                title="Aucun compte"
                message="Ajoutez un livret, un PEA ou un compte courant pour suivre votre patrimoine."
                ctaLabel="Ajouter un compte"
                onCta={() => router.push("/sheets/account")}
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
