// apps/api/src/common/derive/property-equity.test.ts
// Pure derive unit tests (story 4-2). FR-25 — net property equity.

import { describe, expect, test } from "bun:test";
import { computePropertyEquity } from "./property-equity";

describe("computePropertyEquity", () => {
  // AC-2 (verbatim from ticket #25):
  //   Given valuation=250000, outstandingPrincipal=180000,
  //   Then equity = 70000.
  test("AC-2 — valuation 250000 − outstandingPrincipal 180000 = 70000", () => {
    expect(
      computePropertyEquity({
        property: { currentValuation: 250_000 },
        mortgage: { outstandingPrincipal: 180_000 },
      }),
    ).toBe(70_000);
  });

  // AC-5 — no mortgage → equity = currentValuation.
  test("AC-5 — no mortgage → equity equals currentValuation", () => {
    expect(
      computePropertyEquity({
        property: { currentValuation: 400_000 },
        mortgage: null,
      }),
    ).toBe(400_000);
  });

  // Underwater — outstandingPrincipal > valuation → negative equity.
  test("AC-3 partial — underwater property → negative equity", () => {
    expect(
      computePropertyEquity({
        property: { currentValuation: 100_000 },
        mortgage: { outstandingPrincipal: 120_000 },
      }),
    ).toBe(-20_000);
  });

  test("zero valuation + zero debt → zero", () => {
    expect(
      computePropertyEquity({
        property: { currentValuation: 0 },
        mortgage: null,
      }),
    ).toBe(0);
  });
});
