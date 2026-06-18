import { getTranslations } from "next-intl/server";
import { Section } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { settingsClient } from "@/lib/orpc/modules";
import { ensureRequestContext } from "@/lib/orpc/request-context";
import { ThemeControl } from "./theme-control";
import { LangControl } from "./lang-control";

// Server Component (story 8-2). Reads the persisted pref directly via the oRPC
// client behind the auth guard — mirrors AccountSection's RSC read pattern
// (getSettings is a 'use server' action for client callers; an RSC reads the
// client directly to avoid a needless action round-trip).
export async function AppearanceSection() {
  const t = await getTranslations("settings");
  await ensureRequestContext();
  const pref = await settingsClient.get();
  return (
    <Section ariaLabel={t("appearance.title")} title={t("appearance.title")}>
      <View flexDirection="column" gap={4}>
        <View flexDirection="column" gap={2}>
          <Text color="$colorTertiary" fontSize="$caption">
            {t("appearance.theme")}
          </Text>
          <ThemeControl initial={pref.theme} />
        </View>
        <View flexDirection="column" gap={2}>
          <Text color="$colorTertiary" fontSize="$caption">
            {t("appearance.language")}
          </Text>
          <LangControl />
        </View>
      </View>
    </Section>
  );
}
