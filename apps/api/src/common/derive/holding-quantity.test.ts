// Pure helper tests for the lot-derive computation (port of brownfield
// apps/web/src/lib/derive-lots.ts). Mirrors the brownfield assertions plus
// AC-1's three-lot weighted-average fixture.

import { describe, expect, test } from "bun:test";
import type { HoldingLot } from "@pekulo/validators";
import { deriveFromLots } from "./holding-quantity";

function lot(overrides: Partial<HoldingLot>): HoldingLot {
  return {
    id: "lot_xxxxxxxxxxxxxxxxxxxxx",
    userId: "00000000-0000-0000-0000-000000000000",
    holdingId: "hld_xxxxxxxxxxxxxxxxxxxxx",
    type: "buy",
    occurredOn: new Date("2026-01-01"),
    quantity: 1,
    priceUnit: 100,
    fees: 0,
    notes: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("deriveFromLots", () => {
  test("AC-1: three buy lots → weighted-average matches expected", () => {
    // AC-1 (verbatim from story 3-1):
    //   Given a holding with three buy lots { qty=10, priceUnit=100, fees=1 },
    //   { qty=5, priceUnit=120, fees=0.5 }, { qty=5, priceUnit=80, fees=0 } …
    //   Then { quantity, avgCost } equals exactly
    //   { quantity: 20, avgCost: (10*100 + 1 + 5*120 + 0.5 + 5*80) / 20 }.
    const lots: HoldingLot[] = [
      lot({
        type: "buy",
        occurredOn: new Date("2026-01-01"),
        quantity: 10,
        priceUnit: 100,
        fees: 1,
      }),
      lot({
        type: "buy",
        occurredOn: new Date("2026-02-01"),
        quantity: 5,
        priceUnit: 120,
        fees: 0.5,
      }),
      lot({
        type: "buy",
        occurredOn: new Date("2026-03-01"),
        quantity: 5,
        priceUnit: 80,
        fees: 0,
      }),
    ];
    const out = deriveFromLots(lots);
    expect(out.quantity).toBe(20);
    // (10*100 + 1) + (5*120 + 0.5) + (5*80) = 1001 + 600.5 + 400 = 2001.5
    // avgCost = 2001.5 / 20 = 100.075
    expect(out.avgCost).toBe(100.075);
  });

  test("empty list → { quantity: 0, avgCost: 0 }", () => {
    expect(deriveFromLots([])).toEqual({ quantity: 0, avgCost: 0 });
  });

  test("chronological order tie-broken by createdAt", () => {
    const lots: HoldingLot[] = [
      lot({
        type: "buy",
        occurredOn: new Date("2026-02-01"),
        createdAt: new Date("2026-02-01T12:00:00Z"),
        quantity: 5,
        priceUnit: 100,
        fees: 0,
      }),
      lot({
        type: "buy",
        occurredOn: new Date("2026-02-01"),
        createdAt: new Date("2026-02-01T10:00:00Z"),
        quantity: 5,
        priceUnit: 120,
        fees: 0,
      }),
    ];
    const out = deriveFromLots(lots);
    expect(out.quantity).toBe(10);
    expect(out.avgCost).toBe(110);
  });

  test("sell-then-buy preserves positive cost via proportional reduction", () => {
    const lots: HoldingLot[] = [
      lot({
        type: "buy",
        occurredOn: new Date("2026-01-01"),
        quantity: 10,
        priceUnit: 100,
        fees: 0,
      }),
      lot({
        type: "sell",
        occurredOn: new Date("2026-02-01"),
        quantity: 4,
        priceUnit: 120,
        fees: 0,
      }),
      lot({
        type: "buy",
        occurredOn: new Date("2026-03-01"),
        quantity: 2,
        priceUnit: 80,
        fees: 0,
      }),
    ];
    const out = deriveFromLots(lots);
    // buy 10@100 → qty=10, cost=1000
    // sell 4 → cost -= 4 * (1000/10) = 400 → qty=6, cost=600
    // buy 2@80 → qty=8, cost=600+160=760 → avg=95
    expect(out.quantity).toBe(8);
    expect(out.avgCost).toBe(95);
  });

  test("over-sell floors to zero", () => {
    const lots: HoldingLot[] = [
      lot({
        type: "buy",
        occurredOn: new Date("2026-01-01"),
        quantity: 5,
        priceUnit: 100,
        fees: 0,
      }),
      lot({
        type: "sell",
        occurredOn: new Date("2026-02-01"),
        quantity: 10,
        priceUnit: 100,
        fees: 0,
      }),
    ];
    const out = deriveFromLots(lots);
    expect(out.quantity).toBe(0);
    expect(out.avgCost).toBe(0);
  });
});
