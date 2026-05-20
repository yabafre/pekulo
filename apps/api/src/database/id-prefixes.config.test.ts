// AC-2 + AC-6 (verbatim from story 0-4-prisma-setup):
//   AC-2: every prefix matches /^[a-z]{2,4}$/, prefixes are unique, the
//         registry tracks every model from ADR-0012, getPrefix returns/throws
//         as expected. Story 2-2 widens the count to 15 by registering
//         AccountBalanceLog → "abl". Story 4-1 widens to 16 by registering
//         RealEstateMortgage → "resm".
//   AC-6: registry is unique and well-formed; the test computes
//         Object.values(ID_PREFIXES).length === new Set(Object.values(ID_PREFIXES)).size.

import { describe, expect, it } from "bun:test";
import { ID_PREFIXES, MissingPrefixError, getPrefix } from "./id-prefixes.config";

describe("id-prefixes.config", () => {
  it("exposes exactly 16 model entries (ADR-0012 + story 2-2 abl + story 4-1 resm)", () => {
    expect(Object.keys(ID_PREFIXES)).toHaveLength(16);
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
      "Hypothesis",
      "CompassHistory",
      "Milestone",
      "RealEstate",
      "RealEstateMortgage",
      "RealEstateRental",
      "RealEstateValuation",
      "LlmCallLog",
      "LlmOptIn",
    ].sort();
    expect(Object.keys(ID_PREFIXES).sort()).toEqual(expected);
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
});
