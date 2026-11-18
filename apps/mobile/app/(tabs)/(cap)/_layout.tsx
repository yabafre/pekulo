// apps/mobile/app/(tabs)/(cap)/_layout.tsx
// AC-3 (verbatim from story 10-2-mobile-app-bootstrap:38):
//   Given the mobile navigation shell, When the application launches at the
//   root route, Then the Cap tab renders as the initial screen, all five
//   primary destinations (`Cap`, `Transactions`, `Mensuel`, `Portefeuille`,
//   `Immobilier`) are navigable, and `Paramètres` opens in one tap from the
//   Cap header.
import Stack from "expo-router/stack";

export default function CapStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: "Cap" }} />
    </Stack>
  );
}
