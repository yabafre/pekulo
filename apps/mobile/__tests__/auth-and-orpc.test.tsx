import * as SecureStore from "expo-secure-store";

import appConfig from "../app.json";
import { getSupabaseConfig, isSupabaseConfigured, supabase } from "../lib/supabase/client";
import { CHUNK_SIZE, createChunkedSecureStorage } from "../lib/supabase/secure-storage";

describe("10-4 mobile Supabase Auth (expo-secure-store) and @pekulo/contracts oRPC", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const internalStore = (
      SecureStore as unknown as Record<string, Map<string, string> | undefined>
    )["__store"];
    internalStore?.clear();
  });

  // AC-1 (verbatim from story 10-4-mobile-auth-and-orpc:16):
  //   Given the mobile authentication client backed by chunked device secure storage,
  //   When a user signs in with email and password (including session payloads exceeding
  //   the platform's 2048-byte single-entry limit), Then the session is split, persisted,
  //   and reassembled losslessly, the authentication context exposes the active session
  //   and user email, and signing out purges all stored chunks and clears the client query cache.
  it("persists and reassembles both small (<1800B) and large (>2048B) session payloads in expo-secure-store (AC-1)", async () => {
    expect(appConfig.expo.plugins).toContain("expo-secure-store");
    expect(typeof supabase.auth.getSession).toBe("function");
    expect(isSupabaseConfigured({})).toBe(false);
    expect(
      getSupabaseConfig({
        EXPO_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        EXPO_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      }),
    ).toEqual({
      url: "https://example.supabase.co",
      anonKey: "anon-key",
      configured: true,
    });

    const storage = createChunkedSecureStorage();

    // 1. Small payload stored directly under key
    await storage.setItem("sb-session-small", '{"token":"short"}');
    expect(await storage.getItem("sb-session-small")).toBe('{"token":"short"}');

    // 2. Large payload (> 2048 bytes, 4200 chars) split into 3 chunks of <= 1800 chars
    const largePayload = JSON.stringify({
      access_token: "a".repeat(2200),
      refresh_token: "r".repeat(1800),
      user: { email: "alex@pekulo.app" },
    });
    expect(largePayload.length).toBeGreaterThan(CHUNK_SIZE * 2);

    await storage.setItem("sb-session-large", largePayload);
    const rawManifest = await SecureStore.getItemAsync("sb-session-large");
    expect(rawManifest).toBe('{"__chunked":true,"count":3}');
    expect(await SecureStore.getItemAsync("sb-session-large__chunk_0")).toHaveLength(CHUNK_SIZE);

    // Reassembles losslessly
    expect(await storage.getItem("sb-session-large")).toBe(largePayload);

    // Missing chunk returns null rather than partial corrupted session
    await SecureStore.deleteItemAsync("sb-session-large__chunk_1");
    expect(await storage.getItem("sb-session-large")).toBeNull();

    // Overwriting with a short value purges old chunks
    await storage.setItem("sb-session-large", largePayload);
    await storage.setItem("sb-session-large", '{"token":"now-short"}');
    expect(await SecureStore.getItemAsync("sb-session-large__chunk_0")).toBeNull();
    expect(await storage.getItem("sb-session-large")).toBe('{"token":"now-short"}');

    // removeItem purges manifest and chunks
    await storage.setItem("sb-session-remove", largePayload);
    await storage.removeItem("sb-session-remove");
    expect(await storage.getItem("sb-session-remove")).toBeNull();
    expect(await SecureStore.getItemAsync("sb-session-remove__chunk_0")).toBeNull();
  });
});
