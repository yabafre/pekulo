// apps/mobile/__tests__/account-deletion.test.ts
// Story 10-6 AC-4 — the typed-email confirmation shared by the iOS
// `Alert.prompt` path (app/parametres.tsx) and the Android sheet
// (app/sheets/delete-account.tsx).
import { isDeletionEmailConfirmed } from "../lib/account-deletion";

describe("isDeletionEmailConfirmed (story 10-6, AC-4)", () => {
  it("accepts the account email, ignoring case and surrounding spaces", () => {
    expect(isDeletionEmailConfirmed("  Alex@Pekulo.app ", "alex@pekulo.app")).toBe(true);
  });

  it("rejects a different email", () => {
    expect(isDeletionEmailConfirmed("bob@pekulo.app", "alex@pekulo.app")).toBe(false);
  });

  it("rejects empty input", () => {
    expect(isDeletionEmailConfirmed("", "alex@pekulo.app")).toBe(false);
    expect(isDeletionEmailConfirmed(undefined, "alex@pekulo.app")).toBe(false);
  });

  it("rejects everything when the account email is unknown", () => {
    expect(isDeletionEmailConfirmed("   ", null)).toBe(false);
    expect(isDeletionEmailConfirmed("a@b.c", undefined)).toBe(false);
  });
});
