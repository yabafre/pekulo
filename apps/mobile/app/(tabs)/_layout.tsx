// apps/mobile/app/(tabs)/_layout.tsx
// AC-3 (verbatim from story 10-2-mobile-app-bootstrap:38):
//   Given the mobile navigation shell, When the application launches at the
//   root route, Then the Cap tab renders as the initial screen, all five
//   primary destinations (`Cap`, `Transactions`, `Mensuel`, `Portefeuille`,
//   `Immobilier`) are navigable, and `Paramètres` opens in one tap from the
//   Cap header.
import { pekuloColors, useThemeSetting } from "@pekulo/ui";
import { NativeTabs } from "expo-router/native-tabs";

import { useI18n } from "../../lib/i18n";

export default function TabsLayout() {
  // TR-strict chrome: grayscale only, driven by the Pekulo tokens so the glass
  // bar keeps ≥ 4.5:1 contrast in both themes.
  const { resolvedTheme } = useThemeSetting();
  const { t } = useI18n();
  const palette = resolvedTheme === "pekulo-light" ? pekuloColors.light : pekuloColors.dark;

  return (
    <NativeTabs
      minimizeBehavior="onScrollDown"
      tintColor={palette.text.primary}
      iconColor={palette.text.secondary}
      labelStyle={{ color: palette.text.secondary }}
    >
      {/* Icon + title, as Apple's HIG recommends for tab bars; SF Symbols are
          sized by UIKit to the HIG glyph targets. Outline at rest, filled
          when selected. */}
      <NativeTabs.Trigger name="(cap)" accessibilityLabel={t("common.tabs.cap")} testID="tab-cap">
        <NativeTabs.Trigger.Icon
          sf={{ default: "location.north.line", selected: "location.north.line.fill" }}
          md="explore"
        />
        <NativeTabs.Trigger.Label>{t("common.tabs.cap")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="transactions"
        accessibilityLabel={t("common.tabs.transactions")}
        testID="tab-transactions"
      >
        <NativeTabs.Trigger.Icon sf="arrow.left.arrow.right" md="swap_horiz" />
        <NativeTabs.Trigger.Label>{t("common.tabs.transactions")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="mensuel"
        accessibilityLabel={t("common.tabs.monthly")}
        testID="tab-mensuel"
      >
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
        <NativeTabs.Trigger.Label>{t("common.tabs.monthly")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="portefeuille"
        accessibilityLabel={t("common.tabs.portfolio")}
        testID="tab-portefeuille"
      >
        <NativeTabs.Trigger.Icon
          sf={{ default: "chart.pie", selected: "chart.pie.fill" }}
          md="pie_chart"
        />
        <NativeTabs.Trigger.Label>{t("common.tabs.portfolio")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="immobilier"
        accessibilityLabel={t("common.tabs.realestate")}
        testID="tab-immobilier"
      >
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
        <NativeTabs.Trigger.Label>{t("common.tabs.realestate")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
