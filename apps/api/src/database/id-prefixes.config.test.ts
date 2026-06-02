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
import { ID_PREFIXES, MissingPrefixError, getPrefix } from "./id-prefixes.config";

describe("id-prefixes.config", () => {
  it("exposes exactly 21 model entries (… + 6-10 MerchantLogoCache:null + ProviderLogoCache:null)", () => {
    expect(Object.keys(ID_PREFIXES)).toHaveLength(21);
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

  it("getPrefix returns the registered prefix for a known model", () => {
    expect(getPrefix("Account")).toBe("acc");
    expect(getPrefix("HoldingLot")).toBe("lot");
    expect(getPrefix("LlmOptIn")).toBe("llmo");
  });

  it("getPrefix throws MissingPrefixError on an unknown model", () => {
    expect(() => getPrefix("FakeModel")).toThrow(MissingPrefixError);
    expect(() => getPrefix("FakeModel")).toThrow(/FakeModel/);
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
