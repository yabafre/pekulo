// AC-2 + AC-6 (verbatim from story 0-4-prisma-setup):
//   AC-2: every prefix matches /^[a-z]{2,4}$/, prefixes are unique, the
//         registry tracks every model from ADR-0012, getPrefix returns/throws
//         as expected. Story 2-2 widens the count to 15 by registering
//         AccountBalanceLog → "abl". Story 4-1 widens to 16 by registering
//         RealEstateMortgage → "resm". Story 5-4 widens to 17 by registering
//         MonthlyRecord → "mr". Story 5-6 widens to 18 by registering
//         BankConnection → "bnk".
//   AC-6: registry is unique and well-formed; the test computes
//         Object.values(ID_PREFIXES).length === new Set(Object.values(ID_PREFIXES)).size.

import { describe, expect, it } from "bun:test";
import { Prisma } from "@generated/prisma/client";
import { ID_PREFIXES, MissingPrefixError, getPrefix } from "./id-prefixes.config";

describe("id-prefixes.config", () => {
  it("exposes exactly 23 model entries (… + 8-2 UserPref:null)", () => {
    expect(Object.keys(ID_PREFIXES)).toHaveLength(23);
  });

  it("every prefix matches /^[a-z]{2,4}$/ (or is null for brownfield models)", () => {
    for (const [model, prefix] of Object.entries(ID_PREFIXES)) {
      if (prefix === null) {
        // Brownfield exception (Hypothesis): native UUID column, opt-out.
        continue;
      }
      expect(prefix, `prefix for ${model}`).toMatch(/^[a-z]{2,4}$/);
    }
  });

  it("every non-null prefix is unique across the registry", () => {
    const values = Object.values(ID_PREFIXES).filter((v) => v !== null);
    expect(new Set(values).size, "duplicate prefix in ID_PREFIXES").toBe(values.length);
  });

  it("Hypothesis is registered with null (brownfield UUID, opt-out)", () => {
    expect(getPrefix("Hypothesis")).toBeNull();
  });

  it("contains the expected ADR-0012 keys", () => {
    const expected = [
      "Account",
      "AccountBalanceLog",
      "Holding",
      "HoldingLot",
      "Transaction",
      "Kpi",
      "MonthlyTracking",
      "MonthlyRecord",
      "Hypothesis",
      "CompassHistory",
      "Milestone",
      "RealEstate",
      "RealEstateMortgage",
      "RealEstateRental",
      "RealEstateValuation",
      "LlmCallLog",
      "LlmOptIn",
      "BankConnection",
      "BridgeUser",
      "MerchantLogoCache",
      "ProviderLogoCache",
      "DashboardLayout",
      "UserPref",
    ].sort();
    expect(Object.keys(ID_PREFIXES).sort()).toEqual(expected);
  });

  // Story 6-10 (FR-65): the logo caches use a natural-key PK (merchantKey /
  // providerId), no synthetic id — so they opt out of prefix injection (null),
  // same shape as BridgeUser. Without this the upsert in logos.repository.ts
  // would throw MissingPrefixError on the create branch.
  it("logo caches are registered null (natural-key PK, opt-out)", () => {
    expect(getPrefix("MerchantLogoCache")).toBeNull();
    expect(getPrefix("ProviderLogoCache")).toBeNull();
  });

  // Story 7-2 (D6): dashboard_layout has a `user_id` PK (UUID FK to auth.users),
  // no synthetic id — opt out of prefix injection (null), same shape as
  // BridgeUser. Without this, saveLayout's upsert create branch throws
  // MissingPrefixError (the runtime 500 the stubbed unit tests could not catch).
  it("dashboard layout is registered null (user_id PK, opt-out)", () => {
    expect(getPrefix("DashboardLayout")).toBeNull();
  });

  // Story 8-2 (FR-51/FR-52): user_pref has a `user_id` PK (UUID FK to
  // auth.users), no synthetic id — opt out of prefix injection (null), same
  // shape as DashboardLayout. Without this, the getOrCreate upsert's create
  // branch throws MissingPrefixError (lesson 2026-06-05).
  it("user pref is registered null (user_id PK, opt-out)", () => {
    expect(getPrefix("UserPref")).toBeNull();
  });

  it("getPrefix returns the registered prefix for a known model", () => {
    expect(getPrefix("Account")).toBe("acc");
    expect(getPrefix("HoldingLot")).toBe("lot");
    expect(getPrefix("LlmOptIn")).toBe("llmo");
  });

  it("getPrefix throws MissingPrefixError on an unknown model", () => {
    expect(() => getPrefix("FakeModel")).toThrow(MissingPrefixError);
    expect(() => getPrefix("FakeModel")).toThrow(/FakeModel/);
  });

  // Story 7-2 (aped-review F3): close the lesson-2026-06-05 class for good.
  // The prefixed-ids extension fires `getPrefix(model)` on EVERY create/upsert
  // (prefixed-ids.injector); an unregistered Prisma model throws
  // MissingPrefixError at RUNTIME (a 500 on the first write) while every stubbed
  // unit test stays green — exactly how 7-2's saveLayout 500 slipped past. This
  // meta-test enumerates the generated client's DMMF and fails in CI the moment
  // a new model lands without an ID_PREFIXES entry, so the next story can't ship
  // the same latent 500. (Reverse direction — extra ID_PREFIXES keys that aren't
  // Prisma models — is harmless and intentionally allowed: ADR-0012 pre-registers
  // future models.)
  it("every Prisma model (DMMF) is registered in ID_PREFIXES (a prefix or null)", () => {
    const dmmfModels = Prisma.dmmf.datamodel.models.map((m) => m.name);
    const registered = new Set(Object.keys(ID_PREFIXES));
    const unregistered = dmmfModels.filter((name) => !registered.has(name));
    expect(
      unregistered,
      `unregistered Prisma model(s) — add to apps/api/src/database/id-prefixes.config.ts ` +
        `(a 2–4 char prefix, or null for natural-key / user_id-PK tables): ${unregistered.join(", ")}`,
    ).toEqual([]);
  });

  // AC-1 (verbatim from story 5-6-bridge-connector):
  //   Given a valid Bridge OAuth callback, when completeConnection({code, state})
  //   resolves, then a BankConnection row is persisted. The bnk prefix is the
  //   ADR-0012 registration that lets the prefixed-ids extension stamp every
  //   create with bnk_<base62> (story 5-6 — added 2026-05-27).
  it("BankConnection prefix resolves to bnk (story 5-6)", () => {
    expect(getPrefix("BankConnection")).toBe("bnk");
  });
});
