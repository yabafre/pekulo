import { Link } from "expo-router";
import { Text, View } from "@pekulo/ui/client";

import { useI18n } from "../lib/i18n";

export default function NotFoundScreen() {
  const { t } = useI18n();
  return (
    <View
      flex={1}
      backgroundColor="$background"
      alignItems="center"
      justifyContent="center"
      padding="$6"
      gap="$4"
    >
      <Text color="$color" fontSize="$h2" fontWeight="600">
        {t("settings.notFound.title")}
      </Text>
      <Link href="/">
        <Text color="$colorSecondary" fontSize="$bodySm">
          {t("settings.notFound.back")}
        </Text>
      </Link>
    </View>
  );
}
