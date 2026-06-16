"use client";
// apps/web/src/app/(cap)/dashboard/_components/recent-activity-section.tsx
// Story 7-2 (FR-42, AC-2) — the shared Recent-activity widget. Renders the
// overview.recentActivity rows (server-shaped: account label resolved, logo
// proxy attached, direction/amount mapped); each row is a button that routes to
// /dashboard/transactions on press. Skeleton while loading; empty state when
// there is no activity. `variant` switches bento card ↔ flat section.
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CategoryIcon,
  PekuloActivityRow,
  PekuloSkeleton,
  Section,
  TransactionLogo,
} from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import type { Activity } from "@pekulo/types";
import { TRANSACTION_CATEGORY_LABELS } from "@pekulo/validators";
import { useDashboardOverview } from "../_hooks/use-dashboard-overview";

export function RecentActivitySection({ variant = "flat" }: { variant?: "flat" | "card" }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const { data, isLoading } = useDashboardOverview();
  const items = data?.recentActivity ?? [];
  const body =
    isLoading || !data ? (
      <PekuloSkeleton lines={5} height={48} />
    ) : items.length === 0 ? (
      <Text color="$colorTertiary" fontSize="$caption">
        {t("noRecentActivity")}
      </Text>
    ) : (
      <View flexDirection="column" role="list" aria-label={t("recentActivity")}>
        {items.map((item, i) => {
          const activity: Activity = {
            label: item.label,
            account: item.account,
            category: TRANSACTION_CATEGORY_LABELS[item.category],
            direction: item.direction,
            amountEur: item.amountEur,
            logoUrl: item.logoUrl,
          };
          return (
            <View key={`${item.label}-${item.amountEur}-${i}`} role="listitem">
              <View
                render="button"
                onPress={() => router.push("/dashboard/transactions")}
                cursor="pointer"
                backgroundColor="transparent"
                borderWidth={0}
                width="100%"
                aria-label={`${item.label}, voir dans les transactions`}
              >
                <PekuloActivityRow
                  tx={activity}
                  categoryPrefix={
                    <CategoryIcon
                      category={item.category}
                      size={14}
                      color="var(--colorTertiary)"
                      style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }}
                    />
                  }
                  logo={<TransactionLogo src={item.logoUrl} category={item.category} />}
                />
              </View>
            </View>
          );
        })}
      </View>
    );
  if (variant === "card") {
    return (
      <Section title={t("recentActivity")} ariaLabel={t("recentActivity")}>
        {body}
      </Section>
    );
  }
  return (
    <View render="section" aria-labelledby="act-h" flexDirection="column">
      <Text
        id="act-h"
        render="h2"
        color="$color"
        fontSize="$h3"
        fontWeight="600"
        marginBottom="$3"
        $lg={{ fontSize: "$h2" }}
      >
        {t("recentActivity")}
      </Text>
      {body}
    </View>
  );
}
