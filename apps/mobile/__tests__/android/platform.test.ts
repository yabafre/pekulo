// apps/mobile/__tests__/android/platform.test.ts
// Story 10-6 AC-9 — proves the `android` Jest project really runs under
// jest-expo/android (Platform.OS + `.android` module resolution) before any
// Android surface test relies on it.
//
// AC-9 (verbatim from story 10-6-android-parity-and-maestro):
//   Given the mobile test suite, When it runs, Then the existing suites run under
//   the iOS platform and a second, Android-platform project runs the Android
//   surface tests, proving AC-2..AC-4 on Android against a toolbar stand-in that
//   throws like the real one; And the 16 pre-existing suites (194 tests) stay
//   green.
import { Platform } from "react-native";

describe("android Jest project (story 10-6, AC-9)", () => {
  it("runs with Platform.OS === 'android'", () => {
    expect(Platform.OS).toBe("android");
  });
});
