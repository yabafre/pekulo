import { describe, expect, test } from "bun:test";
import type { FxRates } from "@pekulo/validators";
import { computeHoldingPnl } from "./holding-pnl";

const RATES_EUR: FxRates = {
  base: "EUR",
  date: "2026-05-19",
  rates: { EUR: 1, USD: 1.08, GBP: 0.85, CHF: 0.95 },
};

describe("computeHoldingPnl", () => {
  // AC-3 (verbatim from docs/stories/3-3-portfolio-fx.md):
  //   Given a holding row { quantity:10, avgCost:90, lastPrice:100, currency:"USD" }
  //   AND rates={ base:"EUR", date:"2026-05-19", rates:{ EUR:1, USD:1.08, GBP:0.85, CHF:0.95 } },
  //   Then native.pnl===100 AND |native.pnlPct - 0.1111111111| < 1e-6
  //   AND |eur.pnl - 92.5925925926| < 1e-6 AND |eur.pnlPct - 0.1111111111| < 1e-6.
  test("AC-3: USD holding gain → positive native + EUR, pnlPct currency-invariant", () => {
    const out = computeHoldingPnl(
      { quantity: 10, avgCost: 90, lastPrice: 100, currency: "USD" },
      RATES_EUR,
    );
    expect(out.native.pnl).toBe(100); // 10 × (100 − 90)
    expect(Math.abs(out.native.pnlPct - 0.1111111111)).toBeLessThan(1e-6);
    expect(Math.abs(out.eur.pnl - 100 / 1.08)).toBeLessThan(1e-6); // ≈ 92.59
    expect(Math.abs(out.eur.pnlPct - 0.1111111111)).toBeLessThan(1e-6);
  });

  // AC-3 (verbatim from docs/stories/3-3-portfolio-fx.md):
  //   And when lastPrice: 80 instead (loss), Then native.pnl === -100
  //   AND eur.pnl < 0 (sign preserved).
  test("AC-3 sign: lastPrice < avgCost → negative PnL in both currencies", () => {
    const out = computeHoldingPnl(
      { quantity: 10, avgCost: 100, lastPrice: 80, currency: "USD" },
      RATES_EUR,
    );
    expect(out.native.pnl).toBe(-200);
    expect(out.eur.pnl).toBeLessThan(0);
    expect(Math.abs(out.native.pnlPct - -0.2)).toBeLessThan(1e-6);
    expect(Math.abs(out.eur.pnlPct - -0.2)).toBeLessThan(1e-6);
  });

  // AC-4 (verbatim from docs/stories/3-3-portfolio-fx.md):
  //   Given the same holding as AC-3 AND rates=null (Frankfurter unreachable),
  //   Then native.pnl===100 AND eur.pnl===100 (identity — 1:1 path)
  //   AND eur.pnlPct === native.pnlPct.
  test("AC-4: rates=null → eur.pnl === native.pnl (identity 1:1)", () => {
    const out = computeHoldingPnl(
      { quantity: 10, avgCost: 90, lastPrice: 100, currency: "USD" },
      null,
    );
    expect(out.native.pnl).toBe(100);
    expect(out.eur.pnl).toBe(100);
    expect(out.eur.pnlPct).toBe(out.native.pnlPct);
  });

  // AC-4 (verbatim from docs/stories/3-3-portfolio-fx.md):
  //   And when avgCost === 0 (manual entry, zero-cost lot),
  //   Then native.pnlPct === 0 AND eur.pnlPct === 0 (division-by-zero guard).
  test("AC-4 zero-cost guard: avgCost=0 → pnlPct=0 (no division by zero)", () => {
    const out = computeHoldingPnl(
      { quantity: 5, avgCost: 0, lastPrice: 12, currency: "EUR" },
      null,
    );
    expect(out.native.pnl).toBe(60); // 5 × (12 − 0)
    expect(out.native.pnlPct).toBe(0);
    expect(out.eur.pnlPct).toBe(0);
  });

  test("holding in base currency → native and EUR are equal regardless of rates", () => {
    const out = computeHoldingPnl(
      { quantity: 10, avgCost: 5, lastPrice: 7, currency: "EUR" },
      RATES_EUR,
    );
    expect(out.native.pnl).toBe(20);
    expect(out.eur.pnl).toBe(20);
  });

  test("unknown rate (currency not in rates.rates) → identity per holding", () => {
    const partial: FxRates = {
      base: "EUR",
      date: "2026-05-19",
      rates: { EUR: 1 } as FxRates["rates"], // no USD/GBP/CHF
    };
    const out = computeHoldingPnl(
      { quantity: 10, avgCost: 90, lastPrice: 100, currency: "USD" },
      partial,
    );
    expect(out.native.pnl).toBe(100);
    expect(out.eur.pnl).toBe(100); // missing rate → identity (best-effort)
  });

  test("zero-quantity holding → all PnL fields = 0", () => {
    const out = computeHoldingPnl(
      { quantity: 0, avgCost: 100, lastPrice: 120, currency: "USD" },
      RATES_EUR,
    );
    expect(out.native.pnl).toBe(0);
    expect(out.native.pnlPct).toBeCloseTo(0.2); // pct depends on price, not quantity
    expect(out.eur.pnl).toBe(0);
  });
});
