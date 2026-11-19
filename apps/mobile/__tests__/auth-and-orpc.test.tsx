import * as SecureStore from "expo-secure-store";

import appConfig from "../app.json";

describe("10-4 mobile Supabase Auth (expo-secure-store) and @pekulo/contracts oRPC", () => {
  // AC-1 (verbatim from story 10-4-mobile-auth-and-orpc:16):
  //   Given the mobile authentication client backed by chunked device secure storage,
  //   When a user signs in with email and password (including session payloads exceeding
  //   the platform's 2048-byte single-entry limit), Then the session is split, persisted,
  //   and reassembled losslessly, the authentication context exposes the active session
  //   and user email, and signing out purges all stored chunks and clears the client query cache.
  it("registers expo-secure-store plugin in app.json and resolves SecureStore in Jest (AC-1)", async () => {
    expect(appConfig.expo.plugins).toContain("expo-secure-store");
    await SecureStore.setItemAsync("probe-key", "probe-value");
    expect(await SecureStore.getItemAsync("probe-key")).toBe("probe-value");
  });
});
