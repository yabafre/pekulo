// bun:test — third-party opt-in gate (story 6-1, AC-2 / DR-7).
import { test, expect } from "bun:test";
import { requireThirdPartyOptIn, type ThirdPartyOptInReader } from "./opt-in-guard";
import { isPekuloError } from "../../common/errors";

const reader = (optedIn: boolean): ThirdPartyOptInReader => ({
  isThirdPartyOptedIn: async () => optedIn,
});

test("resolves when the user is opted in", async () => {
  await requireThirdPartyOptIn(reader(true), "u1");
});

test("throws LLM_OPT_IN_REQUIRED when not opted in (DR-7)", async () => {
  try {
    await requireThirdPartyOptIn(reader(false), "u1");
    throw new Error("expected throw");
  } catch (err) {
    expect(isPekuloError(err) && err.code === "LLM_OPT_IN_REQUIRED").toBe(true);
  }
});
