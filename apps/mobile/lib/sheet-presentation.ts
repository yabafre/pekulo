// apps/mobile/lib/sheet-presentation.ts
// Form-sheet presentation shared by Paramètres and every `sheets/*` route
// (used by app/_layout.tsx):
//   - iOS: native transparent header carrying `Stack.Toolbar` items (10-5);
//   - Android (story 10-6 AC-2/AC-6): headerless (the scaffold renders its own
//     header row) and `sheetElevation: 0` (design-spec: no drop shadows).
import { Platform } from "react-native";

const IS_ANDROID = Platform.OS === "android";

// Edit/create flows presented as native form sheets. Short forms open at a
// medium detent and can be dragged to full height; long forms open full height.
// Android honours at most three detents — every entry stays ≤ 2.
export const SHEET_ROUTES: { name: string; detents: number[] }[] = [
  { name: "sheets/transaction", detents: [1.0] },
  { name: "sheets/milestone", detents: [0.6, 1.0] },
  { name: "sheets/account", detents: [1.0] },
  { name: "sheets/account-balance", detents: [0.5, 1.0] },
  { name: "sheets/holding", detents: [1.0] },
  { name: "sheets/lot", detents: [1.0] },
  { name: "sheets/property", detents: [0.75, 1.0] },
  { name: "sheets/valuation", detents: [0.5, 1.0] },
  { name: "sheets/valuations", detents: [0.6, 1.0] },
  { name: "sheets/mortgage", detents: [1.0] },
  { name: "sheets/rental", detents: [0.6, 1.0] },
  { name: "sheets/cloture", detents: [1.0] },
  { name: "sheets/compass", detents: [0.6, 1.0] },
  { name: "sheets/delete-account", detents: [0.6, 1.0] },
];

/** Form-sheet presentation shared by Paramètres and every `sheets/*` route. */
export function sheetOptions(detents: number[], chrome: { background: string; ink: string }) {
  if (IS_ANDROID) {
    return {
      headerShown: false,
      presentation: "formSheet" as const,
      sheetGrabberVisible: true,
      sheetAllowedDetents: detents,
      sheetElevation: 0,
      contentStyle: { backgroundColor: chrome.background },
    };
  }
  return {
    headerShown: true,
    presentation: "formSheet" as const,
    sheetGrabberVisible: true,
    sheetAllowedDetents: detents,
    headerTransparent: true,
    headerShadowVisible: false,
    headerTitleStyle: { color: chrome.ink },
    headerTintColor: chrome.ink,
    contentStyle: { backgroundColor: chrome.background },
  };
}
