// apps/mobile/__tests__/android/sheet-presentation.test.ts
// Story 10-6 AC-6 — Android form-sheet chrome.
//
// AC-6 (verbatim from story 10-6-android-parity-and-maestro):
//   Given the form sheets and Paramètres, When presented on Android, Then they
//   are headerless, keep their detents (at most three, Android's limit), and
//   cast no drop shadow.
import { Platform } from "react-native";

import { SHEET_ROUTES, sheetOptions } from "../../lib/sheet-presentation";

const CHROME = { background: "#000000", ink: "#ffffff" };

describe("Android sheet presentation (story 10-6, AC-6)", () => {
  it("presents every sheet headerless, with its detents and no elevation", () => {
    expect(Platform.OS).toBe("android");
    for (const { detents } of [...SHEET_ROUTES, { name: "parametres", detents: [1.0] }]) {
      const options = sheetOptions(detents, CHROME);
      expect(options).toMatchObject({
        headerShown: false,
        presentation: "formSheet",
        sheetAllowedDetents: detents,
        sheetElevation: 0,
      });
    }
  });

  it("keeps every sheet within Android's three-detent limit", () => {
    for (const { name, detents } of SHEET_ROUTES) {
      expect({ name, count: detents.length <= 3 }).toEqual({ name, count: true });
    }
    expect(SHEET_ROUTES.map((s) => s.name)).toContain("sheets/delete-account");
  });
});
