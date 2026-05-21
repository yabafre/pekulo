// apps/api/src/common/derive/rental-cashflow.test.ts
// Pure derive unit tests (story 4-2). FR-24 — monthly rental cash-flow.
// Mirrors the holding-pnl.test.ts shape (story 3-3).

import { describe, expect, test } from "bun:test";
import { computeRentalCashFlow } from "./rental-cashflow";

describe("computeRentalCashFlow", () => {
  // AC-1 (verbatim from ticket #25):
  //   Given rent=1200, charges=200, mortgage monthlyPayment=600,
  //   Then cashflow = +400.
  test("AC-1 — rent 1200 − charges 200 − monthlyPayment 600 = +400", () => {
    expect(
      computeRentalCashFlow({
        rental: { monthlyRent: 1200, monthlyCharges: 200 },
        mortgage: { monthlyPayment: 600 },
      }),
    ).toBe(400);
  });

  // AC-4 first branch: rental present, mortgage null.
  test("AC-4a — rental present, no mortgage → rent − charges", () => {
    expect(
      computeRentalCashFlow({
        rental: { monthlyRent: 1200, monthlyCharges: 200 },
        mortgage: null,
      }),
    ).toBe(1000);
  });

  // AC-4 second branch: no rental → null.
  test("AC-4b — no rental → null (cashflow undefined)", () => {
    expect(
      computeRentalCashFlow({
        rental: null,
        mortgage: { monthlyPayment: 600 },
      }),
    ).toBeNull();
  });

  test("AC-4c — no rental + no mortgage → null", () => {
    expect(computeRentalCashFlow({ rental: null, mortgage: null })).toBeNull();
  });

  // Zero-edge: rent equals charges + mortgage → exactly 0.
  test("zero cashflow when rent = charges + monthlyPayment", () => {
    expect(
      computeRentalCashFlow({
        rental: { monthlyRent: 800, monthlyCharges: 200 },
        mortgage: { monthlyPayment: 600 },
      }),
    ).toBe(0);
  });
});
