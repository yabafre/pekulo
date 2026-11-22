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
import { useI18n } from "../../../lib/i18n";
import { accountTypeLabel } from "../../../lib/options";

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
  const { t } = useI18n();

  function openCreateMenu() {
    showActions(t("common.actions.add"), [
      {
        label: t("cap.createMenu.newTransaction"),
        onPress: () => router.push("/sheets/transaction"),
      },
      {
        label: t("cap.createMenu.newMilestone"),
        onPress: () => router.push("/sheets/milestone"),
      },
      { label: t("cap.createMenu.newAccount"), onPress: () => router.push("/sheets/account") },
    ]);
  }

  function deleteMilestone(id: string, label: string) {
    confirmDestructive({
      title: t("cap.milestones.deleteTitle", { label }),
      message: t("cap.milestones.deleteMessage"),
      confirmLabel: t("common.actions.delete"),
      onConfirm: () => {
        void run(() => milestoneMutations.remove.mutateAsync({ id }), t("cap.milestones.deleted"));
      },
    });
  }

  function openAccountActions(id: string, label: string) {
    showActions(label, [
      {
        label: t("cap.accounts.updateBalance"),
        onPress: () => router.push(`/sheets/account-balance?id=${id}`),
      },
      { label: t("common.actions.edit"), onPress: () => router.push(`/sheets/account?id=${id}`) },
      {
        label: t("common.actions.delete"),
        destructive: true,
        onPress: () =>
          confirmDestructive({
            title: t("cap.accounts.deleteTitle", { label }),
            message: t("cap.accounts.deleteMessage"),
            confirmLabel: t("common.actions.delete"),
            onConfirm: () => {
              void run(
                () => accountMutations.remove.mutateAsync({ id }),
                t("cap.accounts.deleted"),
              );
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
      topBar={
        <PekuloTopTabToggle
          topTab={topTab}
          onChange={setTopTab}
          labels={{
            cap: t("cap.topTabs.cap"),
            patrimoine: t("cap.topTabs.patrimoine"),
            ariaLabel: t("cap.topTabs.ariaLabel"),
          }}
        />
      }
      headerRight={
        <TabHeaderActions
          addLabel={t("common.actions.add")}
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
          title={t("cap.loadError")}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : topTab === "cap" ? (
        <View gap="$8">
          <PekuloHero
            variant="mobile"
            label={t("cap.hero.label")}
            deltaCaption={t("cap.hero.deltaCaption")}
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
                    {t("cap.kpi.progress")}
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
                  {t("cap.kpi.target", {
                    amount: formatCompactEur(viewData.targetCapital),
                    year: viewData.targetYear,
                  })}
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
                <PekuloStat
                  label={t("cap.kpi.nextMilestone")}
                  value={viewData.nextMilestoneLabel}
                />
                <Text
                  color="$colorTertiary"
                  fontSize="$xs"
                  numberOfLines={1}
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {t("cap.kpi.planPerYear", { amount: formatEur(viewData.requiredYearlyEur) })}
                </Text>
              </View>
            </View>
          </View>

          {viewData.milestones.length > 0 && (
            <Section
              flat
              title={t("cap.milestones.title")}
              ariaLabel={t("cap.milestones.ariaLabel")}
            >
              {viewData.milestones.map((milestone) => (
                <PekuloMilestoneRow
                  key={milestone.id ?? `${milestone.label}-${milestone.targetYear}`}
                  milestone={milestone}
                  isDeleting={milestoneMutations.remove.isPending}
                  onDelete={(id) => deleteMilestone(id, milestone.label)}
                  statusLabels={{
                    ahead: t("cap.milestones.status.ahead"),
                    "on-track": t("cap.milestones.status.onTrack"),
                    behind: t("cap.milestones.status.behind"),
                  }}
                  deleteAriaLabel={(label) => t("cap.milestones.deleteAria", { label })}
                />
              ))}
            </Section>
          )}

          {viewData.composition.length > 0 && (
            <Section
              flat
              title={t("cap.composition.title")}
              ariaLabel={t("cap.composition.ariaLabel")}
            >
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
              title={t("cap.activity.title")}
              ariaLabel={t("cap.activity.title")}
              action={
                <HeaderAction
                  label={t("cap.activity.seeAll")}
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
              {t("cap.patrimoine.total")}
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
            title={t("cap.accounts.title")}
            ariaLabel={t("cap.accounts.ariaLabel")}
            action={
              <HeaderAction
                icon={Plus}
                label={t("common.actions.add")}
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
                    accessibilityHint={t("cap.accounts.rowHint")}
                    disabled={!entity}
                    onPress={() => entity && openAccountActions(entity.id, entity.label)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  >
                    <PekuloAccountRow
                      label={acc.label}
                      type={acc.type}
                      balanceEur={acc.balanceEur}
                      typeLabel={accountTypeLabel(t, acc.type)}
                    />
                  </Pressable>
                );
              })
            ) : (
              <PekuloEmptyState
                icon={Wallet}
                title={t("cap.accounts.emptyTitle")}
                message={t("cap.accounts.emptyMessage")}
                ctaLabel={t("cap.accounts.emptyCta")}
                onCta={() => router.push("/sheets/account")}
              />
            )}
          </Section>

          {viewData.composition.length > 0 && (
            <Section
              flat
              title={t("cap.composition.title")}
              ariaLabel={t("cap.composition.ariaLabel")}
            >
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
