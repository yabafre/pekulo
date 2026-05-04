// AC-2 + AC-6 (verbatim from story 0-4-prisma-setup):
//   AC-2: every prefix matches /^[a-z]{2,4}$/, prefixes are unique, exactly 14
//         entries from ADR-0012, getPrefix returns/throws as expected.
//   AC-6: registry is unique and well-formed; the test computes
//         Object.values(ID_PREFIXES).length === new Set(Object.values(ID_PREFIXES)).size.

import { describe, expect, it } from "bun:test";
import { ID_PREFIXES, MissingPrefixError, getPrefix } from "./id-prefixes.config";

describe("id-prefixes.config", () => {
  it("exposes exactly 14 model entries (ADR-0012)", () => {
    expect(Object.keys(ID_PREFIXES)).toHaveLength(14);
  });

  it("every prefix matches /^[a-z]{2,4}$/", () => {
    for (const [model, prefix] of Object.entries(ID_PREFIXES)) {
      expect(prefix, `prefix for ${model}`).toMatch(/^[a-z]{2,4}$/);
    }
  });

  it("every prefix is unique across the registry", () => {
    const values = Object.values(ID_PREFIXES);
    expect(new Set(values).size, "duplicate prefix in ID_PREFIXES").toBe(values.length);
  });

  it("contains the expected ADR-0012 keys", () => {
    const expected = [
      "Account",
      "Holding",
      "HoldingLot",
      "Transaction",
      "Kpi",
      "MonthlyTracking",
      "Hypothesis",
      "CompassHistory",
      "Milestone",
      "RealEstate",
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
