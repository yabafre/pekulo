import { Linking } from "react-native";

import { assertReleaseSupabaseConfigured } from "../lib/auth/auth-context";
import { getLegalUrl, openLegalUrl } from "../lib/legal";
import { createChunkedSecureStorage, SECURE_STORE_OPTIONS } from "../lib/supabase/secure-storage";

// AC-2 & AC-4 (verbatim from story 10-7-store-compliance-and-agent-testers:28,30):
//   AC-2: links to Privacy Policy, Terms of Service, and Support open the
//   canonical HTTPS URLs (defaulting to `https://pekulo.app` when no HTTPS
//   override is configured) in the system browser.
//   AC-4: When any token or chunk is persisted, Then the Keychain accessibility
//   option restricts it to the current device after first unlock so tokens are
//   excluded from iCloud backups; And Given a release mobile build with
//   Supabase environment variables missing and preview mode not explicitly
//   opted in, When authentication initialises, Then the app fails fast with an
//   explicit configuration error rather than silently entering preview mode,
//   while end-to-end test preview builds continue to opt in explicitly.
describe("legal links & mobile security hardening (story 10-7, AC-2, AC-4)", () => {
  it("resolves legal URLs against EXPO_PUBLIC_WEB_BASE_URL with https://pekulo.app default", () => {
    expect(getLegalUrl("/privacy", {})).toBe("https://pekulo.app/privacy");
    expect(getLegalUrl("/terms", { EXPO_PUBLIC_WEB_BASE_URL: "https://staging.pekulo.app/" })).toBe(
      "https://staging.pekulo.app/terms",
    );
    expect(getLegalUrl("/support", { EXPO_PUBLIC_WEB_BASE_URL: "http://insecure.example" })).toBe(
      "https://pekulo.app/support",
    );
  });

  it("opens legal URLs via Linking.openURL", async () => {
    const openSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    await openLegalUrl("/privacy");
    expect(openSpy).toHaveBeenCalledWith("https://pekulo.app/privacy");
    openSpy.mockRestore();
  });

  it("writes SecureStore items with AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY", async () => {
    const store = new Map<string, string>();
    const setItemAsync = jest.fn(async (key: string, value: string, _options?: unknown) => {
      store.set(key, value);
    });
    const storage = createChunkedSecureStorage({
      getItemAsync: async (key: string) => store.get(key) ?? null,
      setItemAsync,
      deleteItemAsync: async (key: string) => {
        store.delete(key);
      },
    });

    await storage.setItem("pekulo-mobile-auth", "short-token");
    expect(setItemAsync).toHaveBeenCalledWith(
      "pekulo-mobile-auth",
      "short-token",
      SECURE_STORE_OPTIONS,
    );

    setItemAsync.mockClear();
    const largeToken = "x".repeat(4000);
    await storage.setItem("pekulo-mobile-auth", largeToken);
    expect(setItemAsync.mock.calls.length).toBeGreaterThan(2);
    for (const call of setItemAsync.mock.calls) {
      expect(call[2]).toEqual(SECURE_STORE_OPTIONS);
    }
  });

  it("throws in release builds when Supabase is unconfigured unless EXPO_PUBLIC_ALLOW_PREVIEW=1", () => {
    expect(() => assertReleaseSupabaseConfigured(false, {}, false)).toThrow(
      /EXPO_PUBLIC_SUPABASE_URL/i,
    );
    expect(() =>
      assertReleaseSupabaseConfigured(false, { EXPO_PUBLIC_ALLOW_PREVIEW: "1" }, false),
    ).not.toThrow();
    expect(() => assertReleaseSupabaseConfigured(true, {}, false)).not.toThrow();
    expect(() => assertReleaseSupabaseConfigured(false, {}, true)).not.toThrow();
  });
});
