// apps/web/src/app/(cap)/dashboard/_data/_components/data-section.tsx
// Story 11-1 (FR-49). Server Component. Placement is dictated by the
// ux-preview SSOT (docs/ux-preview/src/App.tsx → SettingsScreen): the
// « Vos données » Section sits after « Intelligence artificielle ». The
// second row of that preview section — "Supprimer mon compte" (destructive)
// — belongs to story 11-2 and is deliberately absent here.
import { getTranslations } from "next-intl/server";
import { Section } from "@pekulo/ui";
import { View } from "@pekulo/ui/client";
import { ExportDataRow } from "./export-data-row";

export async function DataSection() {
  const t = await getTranslations("settings");
  return (
    <Section ariaLabel={t("data.title")} title={t("data.title")}>
      <View flexDirection="column">
        <ExportDataRow
          label={t("data.exportLabel")}
          sub={t("data.exportSub")}
          action={t("data.exportAction")}
        />
      </View>
    </Section>
  );
}
