import { Link } from "expo-router";
import { Text, View } from "@pekulo/ui/client";

export default function NotFoundScreen() {
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
        Page introuvable
      </Text>
      <Link href="/">
        <Text color="$colorSecondary" fontSize="$bodySm">
          Retour au Cap
        </Text>
      </Link>
    </View>
  );
}
