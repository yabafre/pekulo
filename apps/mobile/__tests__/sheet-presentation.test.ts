// apps/mobile/__tests__/sheet-presentation.test.ts
// Story 10-6 AC-2 / AC-6 — iOS sheets keep the 10-5 presentation (native
// transparent header carrying the Stack.Toolbar items); Android-only options
// never leak to iOS.
//
// AC-2 (verbatim from story 10-6-android-parity-and-maestro):
//   ... And iOS headers and toolbar items are unchanged.
import { sheetOptions } from "../lib/sheet-presentation";

describe("iOS sheet presentation (story 10-6, AC-2/AC-6)", () => {
  it("keeps the native transparent header and no Android elevation", () => {
    const options = sheetOptions([0.5, 1.0], { background: "#000000", ink: "#ffffff" });
    expect(options).toEqual({
      headerShown: true,
      presentation: "formSheet",
      sheetGrabberVisible: true,
      sheetAllowedDetents: [0.5, 1.0],
      headerTransparent: true,
      headerShadowVisible: false,
      headerTitleStyle: { color: "#ffffff" },
      headerTintColor: "#ffffff",
      contentStyle: { backgroundColor: "#000000" },
    });
  });
});
