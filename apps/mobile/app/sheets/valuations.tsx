// apps/mobile/app/sheets/valuations.tsx
// Read-only valuation history for a property (native iOS sheet) — the web
// `valuation-history-dialog.tsx` equivalent. Params: `id` (property).

import { PekuloEmptyState } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { useLocalSearchParams } from "expo-router";
import { History } from "lucide-react-native";
import { useMemo } from "react";

import { FormSection } from "../../components/form/fields";
import { SheetScaffold } from "../../components/form/sheet";
import { ScreenLoadingSkeleton } from "../../components/screen-states";
import { useMobileValuations } from "../../lib/hooks/use-mobile-queries";
import { useI18n } from "../../lib/i18n";

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export default function ValuationsSheet() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, isLoading } = useMobileValuations(id);
  const { t, locale } = useI18n();
  const day = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }),
    [locale],
  );
  const rows = [...(data ?? [])].sort(
    (a, b) => new Date(b.valuedOn).getTime() - new Date(a.valuedOn).getTime(),
  );

  return (
    <SheetScaffold title={t("realestate.valuations.title")}>
      {isLoading ? (
        <ScreenLoadingSkeleton sections={1} />
      ) : rows.length === 0 ? (
        <PekuloEmptyState
          icon={History}
          title={t("realestate.valuations.emptyTitle")}
          message={t("realestate.valuations.emptyMessage")}
        />
      ) : (
        <FormSection>
          {rows.map((row) => (
            <View
              key={row.id}
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              minHeight={36}
            >
              <Text color="$colorSecondary" fontSize="$bodySm">
                {day.format(new Date(row.valuedOn))}
              </Text>
              <Text
                color="$color"
                fontSize="$body"
                fontWeight="600"
                selectable
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {eur0.format(row.amount)}
              </Text>
            </View>
          ))}
        </FormSection>
      )}
    </SheetScaffold>
  );
}
