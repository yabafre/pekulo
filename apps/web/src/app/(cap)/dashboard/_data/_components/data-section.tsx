// apps/web/src/app/(cap)/dashboard/_data/_components/data-section.tsx
// Story 11-1 (FR-49) + story 11-2 (FR-50). Server Component. Placement is
// dictated by the ux-preview SSOT (docs/ux-preview/src/App.tsx →
// SettingsScreen): the « Vos données » Section sits after « Intelligence
// artificielle », and holds exactly two rows — export first, delete second.
// Both rows are now built; the section matches the preview.
import { getTranslations } from "next-intl/server";
import { Section } from "@pekulo/ui";
import { View } from "@pekulo/ui/client";
import { createClient } from "@/lib/supabase/server";
import { ExportDataRow } from "./export-data-row";
import { DeleteAccountRow } from "./delete-account-row";

export async function DataSection() {
  const t = await getTranslations("settings");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // No session → no account to delete. The route is behind the proxy's auth
  // gate, so this is defence in depth rather than a reachable branch; it also
  // keeps the component renderable in tests that mount it without a session.
  const email = user?.email ?? "";

  return (
    <Section ariaLabel={t("data.title")} title={t("data.title")}>
      <View flexDirection="column">
        <ExportDataRow
          label={t("data.exportLabel")}
          sub={t("data.exportSub")}
          action={t("data.exportAction")}
        />
        {email && (
          <DeleteAccountRow
            label={t("data.deleteLabel")}
            sub={t("data.deleteSub")}
            action={t("data.deleteAction")}
            email={email}
          />
        )}
      </View>
    </Section>
  );
}
