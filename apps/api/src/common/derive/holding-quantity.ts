// Pure port of brownfield apps/web/src/lib/derive-lots.ts. Weighted-average
// cost basis from a holding's lot history. Lots sorted by (occurredOn,
// createdAt) ascending; sell lots reduce cost proportionally; over-sells
// floor to zero. Returns 6-decimal rounded values.
//
// No I/O, no logger, no DB. Pure function — callable from any layer.
// The service layer (apps/api/src/modules/holdings/holdings.service.ts)
// falls back to the row's manually-entered { quantity, avgCost } when this
// function returns zeros AND the lot list is empty (zero-lot back-compat,
// AC-12).

import type { HoldingLot } from "@pekulo/validators";

export interface DerivedHoldingState {
  quantity: number;
  avgCost: number;
}

export function deriveFromLots(lots: HoldingLot[]): DerivedHoldingState {
  if (lots.length === 0) return { quantity: 0, avgCost: 0 };

  const sorted = [...lots].sort((a, b) => {
    const occurredDelta = a.occurredOn.getTime() - b.occurredOn.getTime();
    if (occurredDelta !== 0) return occurredDelta;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  let qty = 0;
  let cost = 0;

  for (const lot of sorted) {
    if (lot.type === "buy") {
      cost += lot.quantity * lot.priceUnit + lot.fees;
      qty += lot.quantity;
    } else {
      const avg = qty > 0 ? cost / qty : 0;
      cost -= lot.quantity * avg;
      qty -= lot.quantity;
      if (qty < 0) qty = 0;
      if (cost < 0) cost = 0;
    }
  }

  const safeQty = Math.max(0, qty);
  const avgCost = safeQty > 0 ? cost / safeQty : 0;
  return { quantity: round(safeQty, 6), avgCost: round(avgCost, 6) };
}

function round(n: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}
